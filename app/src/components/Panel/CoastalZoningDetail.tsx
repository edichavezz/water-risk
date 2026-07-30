import { useTranslation } from 'react-i18next'
import type { CoastalZoning } from '../../types'

/**
 * The coastal zoning in force around a point.
 *
 * The caveat is not decoration: this source describes management stretches, not
 * the legal deslinde, so it cannot say whether a particular plot falls inside
 * the 20 m or 100 m strip. Stating that plainly is the difference between
 * useful context and a false reassurance.
 */
export default function CoastalZoningDetail({ zoning }: { zoning: CoastalZoning }) {
  const { t } = useTranslation()

  const rows: [string, string][] = []
  if (zoning.zoning) rows.push([t('panel.coastal.classification'), zoning.zoning])
  if (zoning.sensitivity) rows.push([t('panel.coastal.sensitivity'), zoning.sensitivity])
  if (zoning.location) rows.push([t('panel.coastal.location'), zoning.location])
  if (zoning.profile) {
    rows.push([
      t('panel.coastal.profile'),
      zoning.marker ? `${zoning.profile} (${zoning.marker})` : zoning.profile,
    ])
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-[5px] text-[11.5px]">
          {rows.map(([label, value]) => (
            <div key={label} className="col-span-2 grid grid-cols-subgrid">
              <dt className="font-bold text-muted">{label}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="text-[11.5px] leading-relaxed text-muted">
        {t('panel.coastal.notAVerdict')}
      </p>

      {zoning.profileUrl && (
        <a
          href={zoning.profileUrl}
          target="_blank"
          rel="noreferrer"
          className="self-start text-[12.5px] font-bold text-primary underline hover:text-primary-hover"
        >
          {t('panel.coastal.officialProfile')}
        </a>
      )}
    </div>
  )
}
