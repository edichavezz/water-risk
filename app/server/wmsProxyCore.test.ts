import { describe, it, expect, vi } from 'vitest'
import { proxyWms } from './wmsProxyCore'

const valid = {
  upstream: 'rediam-coastal',
  SERVICE: 'WMS',
  VERSION: '1.1.1',
  REQUEST: 'GetMap',
  LAYERS: 'ZSP',
  FORMAT: 'image/png',
  SRS: 'EPSG:3857',
  WIDTH: '256',
  HEIGHT: '256',
  BBOX: '-700000,4300000,-500000,4450000',
}

function imageFetch() {
  return vi.fn(async () =>
    new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }),
  ) as unknown as typeof fetch
}

describe('proxyWms', () => {
  it('relays a valid GetMap and returns the image', async () => {
    const out = await proxyWms(valid, imageFetch())
    expect(out.status).toBe(200)
    expect(out.contentType).toBe('image/png')
  })

  it('only ever calls the upstream named in its own table', async () => {
    const f = imageFetch()
    await proxyWms(valid, f)
    const called = (f as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]
    expect(called).toContain('juntadeandalucia.es')
  })

  // The point of naming upstreams instead of passing URLs: a caller cannot
  // steer this at an arbitrary host.
  it('refuses an unknown upstream', async () => {
    const out = await proxyWms({ ...valid, upstream: 'http://169.254.169.254/' })
    expect(out.status).toBe(400)
  })

  it('drops parameters that could redirect the request', async () => {
    const f = imageFetch()
    await proxyWms({ ...valid, url: 'http://evil.test', map: '/etc/passwd' }, f)
    const called = (f as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]
    expect(called).not.toContain('evil.test')
    expect(called).not.toContain('passwd')
  })

  it('refuses a layer this app does not draw', async () => {
    expect((await proxyWms({ ...valid, LAYERS: 'something_else' })).status).toBe(400)
    expect((await proxyWms({ ...valid, LAYERS: 'ZSP,something_else' })).status).toBe(400)
  })

  it('relays GetMap only', async () => {
    const out = await proxyWms({ ...valid, REQUEST: 'GetCapabilities' })
    expect(out.status).toBe(400)
  })

  it('rejects absurd tile dimensions', async () => {
    expect((await proxyWms({ ...valid, WIDTH: '99999' })).status).toBe(400)
    expect((await proxyWms({ ...valid, HEIGHT: '0' })).status).toBe(400)
  })

  // A WMS reports failure as XML with a 200; that must not reach the map as a
  // tile, or the layer silently paints error documents.
  it('does not pass off a ServiceExceptionReport as a tile', async () => {
    const f = vi.fn(async () =>
      new Response('<ServiceExceptionReport/>', {
        status: 200,
        headers: { 'content-type': 'text/xml' },
      }),
    ) as unknown as typeof fetch
    expect((await proxyWms(valid, f)).status).toBe(502)
  })

  it('reports an unreachable upstream as a gateway error', async () => {
    const f = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    expect((await proxyWms(valid, f)).status).toBe(502)
  })
})
