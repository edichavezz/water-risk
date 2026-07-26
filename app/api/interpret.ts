import type { VercelRequest, VercelResponse } from '@vercel/node'
import { interpret, type InterpretRequest } from '../server/interpretCore'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  const body = req.body as InterpretRequest
  if (!body?.language || !body?.scope || !Array.isArray(body?.evidence) || body.evidence.length === 0) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  try {
    res.status(200).json(await interpret(body, apiKey))
  } catch (e) {
    console.error('interpret failed:', e)
    res.status(502).json({ error: 'Interpretation service unavailable' })
  }
}
