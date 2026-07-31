import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import type { NewsItem } from '../../types/news'
import { relativeDay } from '../../i18n/formatDate'

/**
 * The Live news tab.
 *
 * Two honesty rules govern everything rendered here, and both are load-bearing:
 *
 * 1. **"Mentioning this area", never "within 20 km".** No free source does a
 *    radius — GDELT's `near20:` is *word* proximity — so the heading, the
 *    caption and the widened-window notice all describe a toponym match. The
 *    design handoff's 20 km promise cannot be kept and is not implied.
 * 2. **Unreachable is not empty.** A throttled GDELT is invisible to the
 *    browser, so "we couldn't reach the source" and "nothing was published"
 *    are separate states with separate copy. Collapsing them would report our
 *    own silence as a finding about the place.
 *
 * A headline sitting beside hazard data borrows that data's authority. The
 * per-item tagging and the caption at the bottom are what stop it.
 */

function Article({ item }: { item: NewsItem }) {
  const { t } = useTranslation()

  return (
    <li className="border-t border-hairline-soft py-2.5">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:underline"
      >
        <span className="font-display text-[12.5px] font-bold leading-snug text-ink">
          {item.title}
        </span>
      </a>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted">
        {/* No pill when nothing matched in the title. GDELT searches the article
            body but returns only the headline, so a piece can legitimately be
            about drought with no way for us to tell — and a guessed tag beside
            hazard data is worse than none. */}
        {item.hazard && (
          <span
            className={`rounded-md px-1.5 py-px text-[9px] font-bold ${
              item.hazard === 'fire'
                ? 'bg-accent-soft text-accent-ink'
                : 'bg-primary-soft text-primary-hover'
            }`}
          >
            {t(`hazard.${item.hazard}`)}
          </span>
        )}
        <span>{item.domain}</span>
        <span aria-hidden>·</span>
        <span>{relativeDay(item.seenAt)}</span>
      </span>
    </li>
  )
}

export default function NewsFeed() {
  const { t } = useTranslation()
  const news = useAppStore(s => s.news)
  const loadNews = useAppStore(s => s.loadNews)
  const location = useAppStore(s => s.location)

  // Mounting *is* the "reader opened the news tab" signal, and it is the only
  // one that also covers arriving on a shared `?mode=news` link. Hanging the
  // fetch off the search instead would spend a GDELT call on every place
  // change, which trips the rate limit within seconds of ordinary browsing.
  // `loadNews` no-ops on a cached or in-flight place, so re-mounting is free.
  useEffect(() => { void loadNews() }, [loadNews, location])

  if (news.status === 'idle' || news.status === 'loading') {
    return <p className="py-6 text-sm text-muted">{t('news.loading')}</p>
  }

  if (news.status === 'unreachable') {
    return (
      <div className="rounded-xl bg-subtle-warm p-4">
        <p className="font-display text-sm font-bold text-ink">{t('news.unreachableTitle')}</p>
        <p className="mt-1 text-sm text-muted">{t('news.unreachableBody')}</p>
        <button
          onClick={() => void loadNews(true)}
          className="mt-3 min-h-11 rounded-lg border border-field px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-subtle-cool"
        >
          {t('states.retry')}
        </button>
      </div>
    )
  }

  const { items, window, ring } = news.answer

  return (
    <div>
      <p className="text-[11.5px] leading-snug text-muted">
        {t(window === 'week' ? 'news.windowWeek' : 'news.windowMonth')}
        {ring === 'region' && ` ${t('news.ringWidened')}`}
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-xl bg-subtle-warm p-4 text-sm text-muted">{t('news.empty')}</p>
      ) : (
        <ul className="mt-2 border-b border-hairline-soft">
          {items.map(item => (
            <Article key={item.url} item={item} />
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted">{t('news.disclaimer')}</p>
      <p className="mt-1 text-[10px] text-muted">{t('news.sourceNote')}</p>
    </div>
  )
}
