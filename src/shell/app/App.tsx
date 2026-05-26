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
  EditFeeding,
  Settings,
  Invite,
  ConflictResolution,
  ErrorBoundary,
  Debug,
  NotFound,
} from '../routes'

// Lazy-loaded so Recharts and its D3 dependencies land in a separate chunk.
// The service worker precaches this chunk at install time, so there is no
// network cost at navigation time — only a one-time JS parse the first visit
// per session. Closes GitHub issue #5.
const LitterGraph = lazy(() =>
  import('../routes/LitterGraph').then((m) => ({ default: m.LitterGraph })),
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
        element: <EditFeeding />,
      },
      {
        path: '/litters/:id/graph',
        element: (
          <Suspense fallback={null}>
            <LitterGraph />
          </Suspense>
        ),
      },
      { path: '/settings', element: <Settings /> },
      { path: '/invite', element: <Invite /> },
      { path: '/conflicts', element: <ConflictResolution /> },
      { path: '/debug', element: <Debug /> },
      { path: '*', element: <NotFound /> },
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
