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

  it('refuses request types it does not relay', async () => {
    expect((await proxyWms({ ...valid, REQUEST: 'DescribeLayer' })).status).toBe(400)
    expect((await proxyWms({ ...valid, REQUEST: 'GetLegendGraphic' })).status).toBe(400)
  })

  describe('GetCapabilities', () => {
    const capsQuery = {
      upstream: 'copernicus-drought',
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetCapabilities',
    }

    function xmlFetch(body = '<WMS_Capabilities/>', type = 'text/xml') {
      return vi.fn(async () =>
        new Response(body, { status: 200, headers: { 'content-type': type } }),
      ) as unknown as typeof fetch
    }

    it('relays capabilities for an upstream that opts in', async () => {
      const out = await proxyWms(capsQuery, xmlFetch())
      expect(out.status).toBe(200)
      expect(String(out.body)).toContain('WMS_Capabilities')
    })

    // No LAYERS, WIDTH or HEIGHT on a capabilities request; the tile checks
    // must not reject it.
    it('does not demand tile parameters', async () => {
      const out = await proxyWms(capsQuery, xmlFetch())
      expect(out.status).toBe(200)
    })

    it('is refused for an upstream that does not opt in', async () => {
      const out = await proxyWms({ ...capsQuery, upstream: 'rediam-coastal' }, xmlFetch())
      expect(out.status).toBe(400)
    })

    it('refuses a non-XML capabilities response', async () => {
      const out = await proxyWms(capsQuery, xmlFetch('not xml', 'text/html'))
      expect(out.status).toBe(502)
    })
  })

  describe('GetFeatureInfo', () => {
    const query = {
      ...valid,
      REQUEST: 'GetFeatureInfo',
      QUERY_LAYERS: 'Tramos_homogeneos',
      LAYERS: 'Tramos_homogeneos',
      X: '50',
      Y: '50',
      INFO_FORMAT: 'text/plain',
      FEATURE_COUNT: '10',
    }

    function textFetch(body = "Layer 'Tramos_homogeneos'\n  Feature 1:\n    ZSP = 'x'") {
      return vi.fn(async () =>
        new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } }),
      ) as unknown as typeof fetch
    }

    it('relays a valid feature query and returns the text', async () => {
      const out = await proxyWms(query, textFetch())
      expect(out.status).toBe(200)
      expect(out.contentType).toContain('text/plain')
      expect(String(out.body)).toContain('Feature 1')
    })

    it('forwards the coordinate and query-layer parameters', async () => {
      const f = textFetch()
      await proxyWms(query, f)
      const called = (f as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]
      expect(called).toContain('QUERY_LAYERS=Tramos_homogeneos')
      expect(called).toContain('X=50')
    })

    // QUERY_LAYERS is a second layer list, and validating only LAYERS would let
    // a caller read any layer the upstream hosts.
    it('validates QUERY_LAYERS against the allowlist too', async () => {
      expect((await proxyWms({ ...query, QUERY_LAYERS: 'secret_layer' })).status).toBe(400)
    })

    it('pins INFO_FORMAT to text/plain whatever the caller asks for', async () => {
      const f = textFetch()
      await proxyWms({ ...query, INFO_FORMAT: 'text/html' }, f)
      const called = (f as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]
      expect(called).toContain('INFO_FORMAT=text%2Fplain')
      expect(called).not.toContain('text/html')
    })

    it('rejects pixel coordinates outside the requested raster', async () => {
      expect((await proxyWms({ ...query, X: '9999' })).status).toBe(400)
      expect((await proxyWms({ ...query, Y: '-1' })).status).toBe(400)
    })

    it('caps FEATURE_COUNT', async () => {
      expect((await proxyWms({ ...query, FEATURE_COUNT: '100000' })).status).toBe(400)
    })

    it('is refused for an upstream that does not permit feature queries', async () => {
      const out = await proxyWms({
        ...query, upstream: 'copernicus-drought', LAYERS: 'cdinx', QUERY_LAYERS: 'cdinx',
      })
      expect(out.status).toBe(400)
    })

    it('does not pass off a ServiceExceptionReport as feature text', async () => {
      const xml = vi.fn(async () =>
        new Response('<ServiceExceptionReport/>', {
          status: 200, headers: { 'content-type': 'text/xml' },
        }),
      ) as unknown as typeof fetch
      expect((await proxyWms(query, xml)).status).toBe(502)
    })
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
