import { describe, it, expect } from 'vitest'
import en from './en.json'
import es from './es.json'

/** Every leaf path in a translation bundle, e.g. `about.whatBody`. */
function paths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix]
  if (Array.isArray(value)) return value.flatMap((v, i) => paths(v, `${prefix}[${i}]`))
  return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k))
}

describe('translation bundles', () => {
  it('define exactly the same keys in English and Spanish', () => {
    const enPaths = paths(en).sort()
    const esPaths = paths(es).sort()

    expect(enPaths.filter(p => !esPaths.includes(p))).toEqual([])
    expect(esPaths.filter(p => !enPaths.includes(p))).toEqual([])
  })

  it('has no empty strings', () => {
    for (const [lang, bundle] of [['en', en], ['es', es]] as const) {
      const empties = paths(bundle).filter(p => {
        const value = p
          .replace(/\[(\d+)\]/g, '.$1')
          .split('.')
          .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], bundle)
        return typeof value === 'string' && value.trim() === ''
      })
      expect(empties, `${lang} has empty strings`).toEqual([])
    }
  })
})
