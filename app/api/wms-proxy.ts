import type { VercelRequest, VercelResponse } from '@vercel/node'
import { proxyWms } from '../server/wmsProxyCore'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const result = await proxyWms(req.query)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', result.contentType)

  if (result.status !== 200) return res.status(result.status).send(result.body)

  // Caching is what keeps a proxied layer from costing a request per pan.
  if (result.cacheControl) res.setHeader('Cache-Control', result.cacheControl)
  res.status(200).send(Buffer.from(result.body as ArrayBuffer))
}
