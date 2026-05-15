import { useEffect } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
  Outlet,
} from 'react-router-dom'
import {
  Home,
  LitterList,
  LitterDetail,
  NewLitter,
  FeedingSession,
  LitterGraph,
  Settings,
  Invite,
  Debug,
  NotFound,
} from '../routes'
import { hasStoredConnection } from '../auth'
import { attemptBootReconnect, isDirty, runSync } from '../sync'
import { installPwaRegistration } from '../pwa'

// Layout wrapper that fires a silent sync on every navigation if local
// has unpublished changes. This is the entirety of the "sync on save"
// wiring under the explicit-save model — any route transition is
// treated as a save point.
function SyncOnNavLayout() {
  const location = useLocation()
  useEffect(() => {
    if (isDirty() && hasStoredConnection()) {
      void runSync()
    }
  }, [location.pathname])
  return <Outlet />
}

const router = createBrowserRouter([
  {
    element: <SyncOnNavLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/litters', element: <LitterList /> },
      { path: '/litters/new', element: <NewLitter /> },
      { path: '/litters/:id', element: <LitterDetail /> },
      { path: '/litters/:litterId/feed', element: <FeedingSession /> },
      { path: '/litters/:id/graph', element: <LitterGraph /> },
      { path: '/settings', element: <Settings /> },
      { path: '/invite', element: <Invite /> },
      { path: '/debug', element: <Debug /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export function App() {
  useEffect(() => {
    attemptBootReconnect()
    installPwaRegistration()
  }, [])

  return <RouterProvider router={router} />
}
