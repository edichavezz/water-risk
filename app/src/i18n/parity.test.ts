import { describe, it, expect } from 'vitest'
import { LANGUAGES } from '../types'
import { BUNDLES, LANGUAGE_NAMES } from './index'
import en from './en.json'

/** Every leaf path in a translation bundle, e.g. `about.whatBody`. */
function paths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix]
  if (Array.isArray(value)) return value.flatMap((v, i) => paths(v, `${prefix}[${i}]`))
  return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k))
}

function leaf(bundle: unknown, path: string): unknown {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], bundle)
}

/** The `{{name}}` placeholders in a string, sorted — order is free, presence is not. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort()
}

// English is the reference because it is the fallback: a key missing from en
// renders as its own dotted path in every language at once.
const enPaths = paths(en).sort()

// Iterated rather than listed. The previous version named en and es, so the
// four bundles added alongside this test would have had no coverage at all.
const TRANSLATIONS = LANGUAGES.filter(l => l !== 'en')

describe('translation bundles', () => {
  it('registers every language in LANGUAGES', () => {
    expect(Object.keys(BUNDLES).sort()).toEqual([...LANGUAGES].sort())
    expect(Object.keys(LANGUAGE_NAMES).sort()).toEqual([...LANGUAGES].sort())
  })

  it.each(TRANSLATIONS)('%s defines exactly the same keys as English', lang => {
    const langPaths = paths(BUNDLES[lang]).sort()

    expect(enPaths.filter(p => !langPaths.includes(p)), `missing from ${lang}`).toEqual([])
    expect(langPaths.filter(p => !enPaths.includes(p)), `extra in ${lang}`).toEqual([])
  })

  it.each(LANGUAGES)('%s has no empty strings', lang => {
    const empties = paths(BUNDLES[lang]).filter(p => {
      const value = leaf(BUNDLES[lang], p)
      return typeof value === 'string' && value.trim() === ''
    })
    expect(empties, `${lang} has empty strings`).toEqual([])
  })

  // A dropped `{{percent}}` does not throw — i18next renders the sentence
  // without the number, so a reservoir reads "full" with no figure. Cheap to
  // catch here, near-invisible in review across six alphabets.
  it.each(TRANSLATIONS)('%s keeps every interpolation placeholder', lang => {
    const mismatches = enPaths.flatMap(p => {
      const source = leaf(en, p)
      const target = leaf(BUNDLES[lang], p)
      if (typeof source !== 'string' || typeof target !== 'string') return []
      const a = placeholders(source)
      const b = placeholders(target)
      return a.join(',') === b.join(',') ? [] : [`${p}: expected ${a} got ${b}`]
    })
    expect(mismatches).toEqual([])
  })
})
