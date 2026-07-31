import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

export interface EvidenceItem {
  id: string
  status: string
  summary: string
}

/** Mirrors `Language` in src/types — the wire format cannot import from the app. */
export type InterpretLanguage = 'en' | 'es' | 'fr' | 'it' | 'el' | 'ar'

export interface InterpretRequest {
  language: InterpretLanguage
  audience: 'resident_owner' | 'buyer_investor' | null
  scope: string // 'location' or a dataset id
  location: { name: string; municipio?: string; provincia?: string; basin?: string }
  evidence: EvidenceItem[]
  question?: string
}

export interface InterpretResponse {
  interpretation: string
  questions: string[]
}

const AUDIENCE_FRAMING: Record<'resident_owner' | 'buyer_investor', string> = {
  resident_owner:
    'The reader lives here or owns the place. Keep it about everyday life: what this means for their water, what they could check, and who they would ask — the town hall (ayuntamiento) or their water company. Leave resale and legal paperwork out of it unless the evidence really points there.',
  buyer_investor:
    'The reader is thinking about buying here and has not decided yet. Point out what would matter before signing, where the evidence supports it — whether the place sits in a mapped flood zone, what that can mean for insurance, and what a property lawyer would check. Explain any official term in plain words the first time you use it.',
}

/**
 * One line per interface language.
 *
 * Every one of them repeats the same instruction in a different direction: the
 * official names in this data are Spanish, French and Italian, and translating
 * them is what makes an answer uncheckable. A reader told about "the national
 * flood map" can find nothing; told "SNCZI", they can. So the name stays and
 * the meaning gets explained — including in the two languages, Greek and
 * Arabic, whose readers share no alphabet with the source documents.
 */
const LANGUAGE_INSTRUCTION: Record<InterpretLanguage, string> = {
  en: 'Write in English. When a source or term only exists in Spanish, French or Italian, give the plain English meaning first and the original name in brackets.',
  es: 'Write in Spanish, in plain everyday Spanish. Keep official Spanish names as they are, but explain what each one means in ordinary words.',
  fr: 'Write in French, in plain everyday French. Keep official French names (VigiEau, the arrêté, the préfecture) as they are. For a Spanish or Italian source, give the plain French meaning first and the original name in brackets.',
  it: 'Write in Italian, in plain everyday Italian. Keep official Italian names as they are. For a Spanish or French source, give the plain Italian meaning first and the original name in brackets.',
  el: 'Write in Greek, in plain everyday Greek. Do not transliterate or translate the official names of sources and legal instruments — write SNCZI, EFFIS, VigiEau, servidumbre de protección in the Latin alphabet exactly as published, and explain what each one is in Greek the first time. A transliterated name cannot be looked up.',
  ar: 'Write in Arabic, in plain everyday Modern Standard Arabic. Do not transliterate or translate the official names of sources and legal instruments — write SNCZI, EFFIS, VigiEau, servidumbre de protección in the Latin alphabet exactly as published, and explain what each one is in Arabic the first time. A transliterated name cannot be looked up. Keep numbers, dates and units in Latin digits so they match the source pages.',
}

export function buildSystemPrompt(req: InterpretRequest): string {
  const lines = [
    'You explain public water data about one place in the Mediterranean to someone who has never looked at water data before. Imagine saying it out loud to a neighbour.',
    'How to write it:',
    '- Open with the bottom line in one plain sentence.',
    '- Short sentences. Everyday words.',
    '- Use an official name only when it is genuinely the name of the thing. Give the everyday meaning first and the name in brackets once, e.g. "the national flood map (SNCZI)".',
    '- Stay high level. The reader can ask follow-up questions to go deeper, so you do not have to cover everything.',
    '- If the data cannot answer something, say so once, plainly, and move on. Do not repeat the caveat or pile on warnings.',
    '- No bullet lists, no headings. Just a short piece of writing.',
    'Rules you must not break:',
    '- Say where each fact comes from, in words a person would use. Every fact you state must be traceable to a named source — this holds in every language, and plain wording is never a reason to drop it.',
    '- Keep the severity word the source uses. Do not upgrade "watch" into "alert", or soften a warning into a reassurance.',
    '- Use only the evidence given. Never guess or imply a value for a dataset that is missing, unsupported or errored.',
    '- Do not explain a reading away with outside or seasonal knowledge ("that is normal for summer"). If the evidence says a level is below its average, that is what you report.',
    '- Do not state what a bank, insurer or public body will require or charge. Say what the reader could ask them instead.',
    '- Never invent an overall risk score, a rating, or a combined verdict.',
    // The app now answers anywhere in the Mediterranean, so a place with one
    // reading and six gaps is a normal case rather than an edge case. Say the
    // picture is thin when it is, instead of writing one dataset up into a
    // confident summary of the place.
    '- Say how much of the picture you actually have. Where most checks have no source for this place, open by saying the picture is thin, and never let one reading stand in for the whole place.',
    '- Do not promise that something is legally, financially or physically safe. Where certainty matters, say plainly who can confirm it.',
    req.audience ? AUDIENCE_FRAMING[req.audience] : '',
    LANGUAGE_INSTRUCTION[req.language] ?? LANGUAGE_INSTRUCTION.en,
    'Write 80-140 words. Then give 3 follow-up questions, phrased the way the reader would ask them, short, each one opening a different direction.',
  ]
  return lines.filter(Boolean).join('\n')
}

const ResponseSchema = z.object({
  interpretation: z.string(),
  questions: z.array(z.string()),
})

export async function interpret(req: InterpretRequest, apiKey: string): Promise<InterpretResponse> {
  const client = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
  const scopeLine =
    req.scope === 'location'
      ? 'Interpret the overall picture for this location.'
      : `Focus on the "${req.scope}" dataset result; mention others only where directly relevant.`
  const response = await client.messages.parse({
    model,
    max_tokens: 1000,
    system: buildSystemPrompt(req),
    messages: [
      {
        role: 'user',
        content: [
          `Location: ${req.location.name}`,
          req.location.municipio ? `Municipality: ${req.location.municipio}` : '',
          req.location.provincia ? `Province: ${req.location.provincia}` : '',
          req.location.basin ? `River basin: ${req.location.basin}` : '',
          scopeLine,
          req.question ? `Question from the reader: ${req.question}` : '',
          'Public data evidence:',
          ...req.evidence.map(e => `- [${e.id}] (${e.status}) ${e.summary}`),
        ].filter(Boolean).join('\n'),
      },
    ],
    output_config: { format: zodOutputFormat(ResponseSchema) },
  })
  if (!response.parsed_output) throw new Error('Model returned unparseable output')
  return response.parsed_output
}
