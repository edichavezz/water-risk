import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

export interface EvidenceItem {
  id: string
  status: string
  summary: string
}

export interface InterpretRequest {
  language: 'en' | 'es'
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
    'Audience: resident or owner. The reader lives in or operates from this location. Frame practically: what to check, what to ask, who to contact (ayuntamiento, water utility). Do not raise resale value or legal-disclosure framing unless the evidence makes it clearly relevant.',
  buyer_investor:
    'Audience: buyer or investor assessing this location before deciding. Lead with legal and insurance implications where the evidence supports them (nota simple, SNCZI flood zone, Consorcio de Compensación de Seguros); suggest consulting a gestor or abogado for cadastral detail.',
}

export function buildSystemPrompt(req: InterpretRequest): string {
  const lines = [
    'You interpret Spanish public water-risk data for one location. Follow these rules strictly:',
    '- Always cite or name the public data used (the sources are in the evidence list).',
    '- Distinguish direct findings from inference.',
    '- Keep every stated source limitation intact; do not soften it.',
    '- Do not offer legal, financial or safety certainty. Suggest verification paths instead.',
    '- If the evidence cannot answer something, say so plainly.',
    '- Never invent an aggregate "overall risk score" or a combined rating.',
    '- Interpret only the evidence provided. Do not infer values for datasets that are unavailable, unsupported or errored.',
    req.audience ? AUDIENCE_FRAMING[req.audience] : '',
    req.language === 'es'
      ? 'Respond in Spanish. Keep Spanish technical/institutional terms as-is.'
      : 'Respond in English. Translate Spanish technical terms with the original in parentheses.',
    'Write a concise interpretation (120-200 words) followed by 3 useful follow-up questions the reader could ask.',
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
