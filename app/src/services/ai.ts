import type { RiskProfile, UserType, Language } from '../types'

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function callClaude(messages: Message[]): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY not set')
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      messages,
    }),
  })
  if (!res.ok) throw new Error(`Claude API error ${res.status}`)
  const data = await res.json()
  return data.content[0].text as string
}

const USER_TYPE_LABELS: Record<UserType, Record<Language, string>> = {
  buyer: { en: 'property buyer / homeowner', es: 'comprador de vivienda / propietario' },
  renter: { en: 'renter / tenant', es: 'inquilino/a' },
  farmer: { en: 'farmer / smallholder', es: 'agricultor / propietario rural' },
  business: { en: 'small business owner', es: 'propietario de pequeña empresa' },
}

function buildContext(profile: RiskProfile, lang: Language): string {
  const loc = profile.location
  const parts: string[] = [
    `Location: ${loc.municipio || loc.displayName}${loc.provincia ? ', ' + loc.provincia : ''}, Spain`,
    `River basin: ${loc.basin ?? 'unknown'}`,
  ]

  if (profile.floodZone) {
    if (profile.floodZone.inZone) {
      parts.push(`Flood risk: IN a ${profile.floodZone.returnPeriod}-year return period flood zone (SNCZI official data)`)
    } else {
      parts.push('Flood risk: NOT in a mapped flood zone')
    }
  }

  if (profile.drought) {
    const levelLabels: Record<string, string> = {
      alert: 'DROUGHT ALERT (severe)',
      warning: 'Drought warning (moderate)',
      watch: 'Drought watch (mild)',
      partial_recovery: 'Partial drought recovery',
      recovery: 'Recovering from drought',
      none: 'No drought conditions currently',
      unknown: 'Drought status unknown',
    }
    parts.push(`Drought status: ${levelLabels[profile.drought.level] ?? profile.drought.level} (Copernicus EDO, updated weekly)`)
  }

  if (profile.reservoirs.length > 0) {
    const resLines = profile.reservoirs.map(
      r => {
        const mean = r.historicalMeanPercent != null ? `, historical mean ~${r.historicalMeanPercent}%` : ''
        const source = r.systemName ? `via ${r.systemName}` : `${r.distanceKm}km away`
        return `${r.name}: ${r.fillPercent}% full${mean} (${source}, data as of ${r.fillPercentAsOf})`
      }
    )
    parts.push(`Nearest reservoirs:\n${resLines.join('\n')}`)
  }

  if (profile.waterQuality) {
    parts.push(`Drinking water: ${profile.waterQuality.compliance}, source: ${profile.waterQuality.sourceType}, last tested: ${profile.waterQuality.year}`)
  }

  if (profile.coastalFlood) {
    const coastalLine = profile.coastalFlood.inServidumbre
      ? 'in 20m servidumbre zone'
      : profile.coastalFlood.inPolicia
      ? 'in 100m policia zone'
      : 'not in coastal zone'
    parts.push(`Coastal zone: ${coastalLine}`)
  }

  if (profile.groundwater) {
    parts.push(
      `Groundwater: ${profile.groundwater.inOverexploitedUnit ? 'in overexploited unit: ' + profile.groundwater.unitName : 'not in overexploited unit'}`
    )
  }

  if (profile.bathingWater) {
    parts.push(`Nearest bathing site: ${profile.bathingWater.siteName} (${profile.bathingWater.distanceKm} km) — rated ${profile.bathingWater.rating} (${profile.bathingWater.year})`)
  }

  return parts.join('\n')
}

export async function generateRiskSummary(
  profile: RiskProfile,
  userType: UserType,
  lang: Language
): Promise<string> {
  const context = buildContext(profile, lang)
  const persona = USER_TYPE_LABELS[userType][lang]
  const langInstruction = lang === 'es'
    ? 'Respond entirely in Spanish.'
    : 'Respond in English.'

  const prompt = lang === 'es'
    ? `Eres un experto en riesgos hídricos en España. Analiza los siguientes datos para una persona que es ${persona}.

${context}

Escribe un resumen claro y directo (máximo 120 palabras) de lo que estos datos significan específicamente para un ${persona}. Usa lenguaje sencillo, sin tecnicismos innecesarios. Menciona implicaciones concretas relevantes para este perfil de usuario.`
    : `You are a water risk expert for Spain. Analyse the following data for someone who is a ${persona}.

${context}

Write a clear, direct summary (max 120 words) of what these data points mean specifically for a ${persona}. Use plain language. Mention concrete implications relevant to this user type. ${langInstruction}`

  return callClaude([{ role: 'user', content: prompt }])
}

export async function generateQuestions(
  profile: RiskProfile,
  userType: UserType,
  lang: Language
): Promise<string[]> {
  const context = buildContext(profile, lang)
  const persona = USER_TYPE_LABELS[userType][lang]

  const targets: Record<UserType, Record<Language, string>> = {
    buyer: {
      en: 'estate agent, notary, and mortgage lender',
      es: 'agente inmobiliario, notario y entidad hipotecaria',
    },
    renter: {
      en: 'landlord and municipality',
      es: 'propietario y ayuntamiento',
    },
    farmer: {
      en: 'irrigation community (comunidad de regantes), river basin authority, and groundwater registry',
      es: 'comunidad de regantes, confederación hidrográfica y registro de aguas',
    },
    business: {
      en: 'municipality, water utility, and insurer',
      es: 'ayuntamiento, empresa de aguas y aseguradora',
    },
  }

  const target = targets[userType][lang]

  const prompt = lang === 'es'
    ? `Eres un experto en riesgos hídricos en España. Basándote en estos datos:

${context}

Genera exactamente 6 preguntas concretas que un ${persona} debería hacer a su ${target} antes de tomar decisiones. Las preguntas deben ser específicas para esta ubicación y sus riesgos hídricos. Devuelve SOLO las preguntas, una por línea, sin numeración ni viñetas.`
    : `You are a water risk expert for Spain. Based on this data:

${context}

Generate exactly 6 specific questions a ${persona} should ask their ${target} before making decisions. Questions must be specific to this location and its water risks. Return ONLY the questions, one per line, no numbering or bullets.`

  const text = await callClaude([{ role: 'user', content: prompt }])
  return text
    .split('\n')
    .map(q => q.trim())
    .filter(q => q.length > 10)
    .slice(0, 6)
}
