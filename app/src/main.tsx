import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './i18n/index'
import './index.css'
import App from './App'
import { initRouteSync } from './services/routeSync'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Restore any shared link, then keep the URL in step with the workspace.
initRouteSync()
