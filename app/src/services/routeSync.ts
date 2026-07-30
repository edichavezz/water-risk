import { reverseGeocode } from './geocoding'
import { parseRoute, serializeRoute, type RouteState } from './route'
import { submitLocation } from '../components/Entry/submitLocation'
import { useAppStore } from '../store/useAppStore'

export async function applyRouteToStore(route: RouteState): Promise<void> {
  const store = useAppStore.getState()
  if (route.page) store.setPage(route.page)
  if (route.aud) store.setAudience(route.aud)
  if (route.lat === undefined || route.lng === undefined) return
  const loc = await reverseGeocode({ lat: route.lat, lng: route.lng }).catch(() => null)
  if (!loc) return
  await submitLocation(loc)
  const after = useAppStore.getState()
  if (route.ds) after.selectDataset(route.ds)
  // Restores the AI *mode* only — generation still requires an explicit
  // opt-in, so a shared link never auto-generates interpretation (§9.4).
  if (route.mode === 'ai') useAppStore.getState().openAiMode()
  if (route.mode === 'news') useAppStore.getState().openNewsMode()
}

export function subscribeStoreToRoute(): () => void {
  return useAppStore.subscribe(s => {
    // The search stays in the URL while About is open, so returning to the map
    // — or reloading from a shared About link — restores the same place.
    const page = s.page === 'about' ? ('about' as const) : undefined
    const route: RouteState = s.view === 'searched' && s.location
      ? {
          page,
          q: s.location.municipality || s.location.displayName,
          lat: s.location.coordinates.lat,
          lng: s.location.coordinates.lng,
          aud: s.audience ?? undefined,
          ds: s.selectedDataset ?? undefined,
          mode: s.panelMode,
        }
      : { page, aud: s.audience ?? undefined }
    const search = serializeRoute(route)
    if (window.location.search !== search) {
      history.replaceState(null, '', search || window.location.pathname)
    }
  })
}

export function initRouteSync(): void {
  if (typeof window === 'undefined') return
  void applyRouteToStore(parseRoute(window.location.search))
  subscribeStoreToRoute()
}
