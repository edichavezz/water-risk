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
    expect(p).toMatch(/say where each fact comes from/i)
    expect(p).toMatch(/never invent an overall risk score/i)
    expect(p).toMatch(/do not promise .*legally, financially or physically safe/i)
    expect(p).toMatch(/never guess or imply a value/i)
  })

  it('asks for plain language a first-time reader can follow', () => {
    const p = buildSystemPrompt(base)
    expect(p).toMatch(/never looked at water data before/i)
    expect(p).toMatch(/short sentences/i)
    expect(p).toMatch(/bottom line in one plain sentence/i)
    // Depth is the follow-ups' job — that is what lets the text stay light.
    expect(p).toMatch(/follow-up questions to go deeper/i)
    expect(p).toMatch(/80-140 words/)
  })

  it('keeps the audience framing free of unexplained jargon', () => {
    for (const audience of ['buyer_investor', 'resident_owner'] as const) {
      const p = buildSystemPrompt({ ...base, audience })
      expect(p).not.toMatch(/nota simple|Consorcio de Compensación|gestor/i)
    }
  })

  it('includes audience framing only when an audience is set', () => {
    expect(buildSystemPrompt(base)).toMatch(/thinking about buying/i)
    expect(buildSystemPrompt({ ...base, audience: 'resident_owner' })).toMatch(/lives here or owns/i)
    const none = buildSystemPrompt({ ...base, audience: null })
    expect(none).not.toMatch(/thinking about buying/i)
    expect(none).not.toMatch(/lives here or owns/i)
  })

  it('asks for plain language in Spanish too, not just English', () => {
    const es = buildSystemPrompt({ ...base, language: 'es' })
    expect(es).toMatch(/in Spanish/)
    expect(es).toMatch(/plain everyday Spanish/i)
  })
})
