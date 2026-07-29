import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Serves POST /api/interpret in `vite dev`, mirroring the Vercel serverless
// function in api/interpret.ts. The API key stays server-side (read from the
// process env, never a VITE_ prefixed var), so it is never shipped to the browser.
function interpretDevEndpoint(env: Record<string, string>): Plugin {
  return {
    name: 'interpret-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/interpret', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        try {
          const apiKey = env.ANTHROPIC_API_KEY
          if (!apiKey) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            return res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }))
          }
          const mod = await server.ssrLoadModule('/server/interpretCore.ts')
          const body = JSON.parse(Buffer.concat(chunks).toString())
          const out = await mod.interpret(body, apiKey)
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(out))
        } catch (e) {
          res.statusCode = 502
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

// Serves GET /api/wms-proxy in `vite dev`, mirroring api/wms-proxy.ts. Without
// it the coastal layer would only work on a deployed build.
function wmsProxyDevEndpoint(): Plugin {
  return {
    name: 'wms-proxy-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/wms-proxy', async (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; return res.end() }
        try {
          const mod = await server.ssrLoadModule('/server/wmsProxyCore.ts')
          const url = new URL(req.url ?? '', 'http://localhost')
          const out = await mod.proxyWms(Object.fromEntries(url.searchParams))
          res.statusCode = out.status
          res.setHeader('content-type', out.contentType)
          res.setHeader('access-control-allow-origin', '*')
          res.end(
            typeof out.body === 'string' ? out.body : Buffer.from(out.body as ArrayBuffer),
          )
        } catch (e) {
          res.statusCode = 502
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), interpretDevEndpoint(env), wmsProxyDevEndpoint()],
    test: {
      // Default to node so merged data-source tests and the fetch-reservoirs
      // .mjs script test keep working. Component tests opt into jsdom per-file
      // with a `// @vitest-environment jsdom` docblock.
      environment: 'node',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
    },
  }
})
