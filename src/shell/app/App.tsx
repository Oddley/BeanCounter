import { lazy, Suspense, useEffect } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
  Outlet,
} from 'react-router-dom'
import { NavDepthProvider } from './NavDepthProvider'
import { AsyncCrashPage } from './AsyncCrashPage'
import {
  installGlobalErrorListeners,
  useUnhandledError,
} from './globalErrorState'
import {
  Home,
  LitterList,
  LitterDetail,
  NewLitter,
  FeedingSession,
  ErrorBoundary,
} from '../routes'

// Non-critical routes lazy-loaded so their modules land in separate chunks,
// reducing the initial JS parse cost for the hot paths above. The service
// worker precaches all chunks at install time, so subsequent navigations
// pay only a one-time parse cost per session — no network round-trip.
// Closes GitHub issues #5 (Recharts / D3 split) and #27 (route splitting).
const LitterGraph = lazy(() =>
  import('../routes/LitterGraph').then((m) => ({ default: m.LitterGraph })),
)
const EditFeeding = lazy(() =>
  import('../routes/EditFeeding').then((m) => ({ default: m.EditFeeding })),
)
const Settings = lazy(() =>
  import('../routes/Settings').then((m) => ({ default: m.Settings })),
)
const Invite = lazy(() =>
  import('../routes/Invite').then((m) => ({ default: m.Invite })),
)
const ConflictResolution = lazy(() =>
  import('../routes/ConflictResolution').then((m) => ({
    default: m.ConflictResolution,
  })),
)
const Debug = lazy(() =>
  import('../routes/Debug').then((m) => ({ default: m.Debug })),
)
const NotFound = lazy(() =>
  import('../routes/NotFound').then((m) => ({ default: m.NotFound })),
)
const SidecarSetup = lazy(() =>
  import('../routes/SidecarSetup').then((m) => ({ default: m.SidecarSetup })),
)
import { hasStoredConnection } from '../auth'
import { attemptBootReconnect, isDirty, runSync } from '../sync'
import { installPwaRegistration } from '../pwa'

// Layout wrapper that fires a silent sync on every navigation if local
// has unpublished changes. This is the entirety of the "sync on save"
// wiring under the explicit-save model — any route transition is
// treated as a save point.
function SyncOnNavLayout() {
  const location = useLocation()
  const unhandledError = useUnhandledError()

  useEffect(() => {
    if (isDirty() && hasStoredConnection()) {
      void runSync()
    }
  }, [location.pathname])

  if (unhandledError !== null) {
    return <AsyncCrashPage error={unhandledError} />
  }

  return (
    <NavDepthProvider>
      <Outlet />
    </NavDepthProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <SyncOnNavLayout />,
    // errorElement on the root layout catches render-time errors from
    // any child route. Falls back to a friendlier UI with a one-tap
    // crash-report affordance instead of React Router's default
    // developer-targeted error page. Closes GitHub issue #17.
    errorElement: <ErrorBoundary />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/litters', element: <LitterList /> },
      { path: '/litters/new', element: <NewLitter /> },
      { path: '/litters/:id', element: <LitterDetail /> },
      { path: '/litters/:litterId/feed', element: <FeedingSession /> },
      {
        path: '/litters/:litterId/edit-feeding/:sessionId',
        element: (
          <Suspense fallback={null}>
            <EditFeeding />
          </Suspense>
        ),
      },
      {
        path: '/litters/:id/graph',
        element: (
          <Suspense fallback={null}>
            <LitterGraph />
          </Suspense>
        ),
      },
      {
        path: '/settings',
        element: (
          <Suspense fallback={null}>
            <Settings />
          </Suspense>
        ),
      },
      {
        path: '/invite',
        element: (
          <Suspense fallback={null}>
            <Invite />
          </Suspense>
        ),
      },
      {
        path: '/conflicts',
        element: (
          <Suspense fallback={null}>
            <ConflictResolution />
          </Suspense>
        ),
      },
      {
        path: '/debug',
        element: (
          <Suspense fallback={null}>
            <Debug />
          </Suspense>
        ),
      },
      {
        path: '/setup-sync',
        element: (
          <Suspense fallback={null}>
            <SidecarSetup />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: (
          <Suspense fallback={null}>
            <NotFound />
          </Suspense>
        ),
      },
    ],
  },
])

export function App() {
  useEffect(() => {
    installGlobalErrorListeners()
    attemptBootReconnect()
    installPwaRegistration()
  }, [])

  return <RouterProvider router={router} />
}
