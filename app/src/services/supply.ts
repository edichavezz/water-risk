import type { PlaceContext } from '../types/place'
import type { SupplyAnswer, SupplyNetwork } from '../types/supply'
import { NO_SUPPLY } from '../types/supply'
import { getReservoirsForLocation } from './reservoirs'

/**
 * Who supplies the water here, and how confidently we know it.
 *
 * The tiers are tried strongest first. Each returns a different *kind* of
 * answer, not a better or worse version of the same one, which is why the
 * provenance travels with the result rather than being flattened away:
 *
 *  - `curated` names real reservoirs, hand-researched from the operator.
 *  - `official-registry` names the distribution network a government register
 *    records, and stops there — Hub'Eau has no source-waterbody field, and
 *    every sample of `nom_installation_amont` came back null.
 *  - `none` is the honest end of the road, and it is not the same as "there
 *    are no reservoirs".
 */
const HUBEAU_UDI = 'https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable/communes_udi'

interface RawUdi {
  code_commune?: string
  nom_commune?: string
  code_reseau?: string
  nom_reseau?: string
  annee?: string
}

/**
 * Latest year only, deduplicated by network code.
 *
 * Hub'Eau returns one row per quartier per year, so Marseille alone answers
 * with 209 rows across a decade. Without both filters the reader would be
 * shown the same network several times over, and networks that stopped
 * supplying the commune years ago alongside the current ones.
 */
export function shapeNetworks(rows: RawUdi[]): SupplyNetwork[] {
  const years = rows.map(r => r.annee).filter((y): y is string => !!y)
  if (years.length === 0) return []
  const latest = years.reduce((a, b) => (b > a ? b : a))

  const byCode = new Map<string, SupplyNetwork>()
  for (const r of rows) {
    if (r.annee !== latest || !r.code_reseau || !r.nom_reseau) continue
    if (!byCode.has(r.code_reseau)) {
      byCode.set(r.code_reseau, { code: r.code_reseau, name: r.nom_reseau })
    }
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function hubeauUdiUrl(municipality: string): string {
  // `size` is generous because the response is one row per quartier per year,
  // and the shaping above needs the whole set to find the latest year.
  return `${HUBEAU_UDI}?nom_commune=${encodeURIComponent(municipality)}&size=500`
}

async function frenchRegistrySupply(place: PlaceContext): Promise<SupplyAnswer> {
  if (!place.municipality) return NO_SUPPLY

  const res = await fetch(hubeauUdiUrl(place.municipality))
  if (!res.ok) throw new Error(`Hub'Eau ${res.status}`)
  const body: { data?: RawUdi[] } = await res.json()

  const networks = shapeNetworks(body.data ?? [])
  if (networks.length === 0) return NO_SUPPLY

  return {
    provenance: 'official-registry',
    networks,
    reservoirs: [],
    source: {
      name: "Hub'Eau — qualité de l'eau potable",
      url: 'https://hubeau.eaufrance.fr/page/api-qualite-eau-potable',
    },
  }
}

export async function getSupplyForLocation(place: PlaceContext): Promise<SupplyAnswer> {
  if (place.countryCode === 'es') {
    const reservoirs = getReservoirsForLocation(place)
    if (reservoirs.length === 0) return NO_SUPPLY
    return {
      provenance: 'curated',
      systemName: reservoirs[0].systemName,
      networks: [],
      reservoirs,
      source: { name: 'REDIAM / MITERD' },
    }
  }

  if (place.countryCode === 'fr') return frenchRegistrySupply(place)

  return NO_SUPPLY
}
