import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './interpretCore'
import type { InterpretRequest } from './interpretCore'

const base: InterpretRequest = {
  language: 'en', audience: 'buyer_investor', scope: 'flood',
  location: { name: 'Sevilla', municipio: 'Sevilla', basin: 'guadalquivir' },
  evidence: [{ id: 'flood', status: 'available', summary: 'Outside mapped T10/T100/T500 zones' }],
}

describe('interpretation system prompt', () => {
  it('embeds the safety rules', () => {
    const p = buildSystemPrompt(base)
    expect(p).toMatch(/cite|name the public data/i)
    expect(p).toMatch(/never.*overall risk score/i)
    expect(p).toMatch(/not.*legal, financial or safety certainty/i)
  })
  it('uses audience only for emphasis and includes it when present', () => {
    expect(buildSystemPrompt(base)).toContain('buyer or investor')
    expect(buildSystemPrompt({ ...base, audience: null })).not.toContain('buyer or investor')
  })
  it('instructs Spanish output when language is es', () => {
    expect(buildSystemPrompt({ ...base, language: 'es' })).toMatch(/in Spanish/)
  })
})
