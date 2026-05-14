import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import {
  Home,
  LitterList,
  LitterDetail,
  NewLitter,
  FeedingSession,
  LitterGraph,
  Settings,
  Debug,
  NotFound,
} from '../routes'
import { attemptBootReconnect } from '../sync'

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/litters', element: <LitterList /> },
  { path: '/litters/new', element: <NewLitter /> },
  { path: '/litters/:id', element: <LitterDetail /> },
  { path: '/litters/:litterId/feed', element: <FeedingSession /> },
  { path: '/litters/:id/graph', element: <LitterGraph /> },
  { path: '/settings', element: <Settings /> },
  { path: '/debug', element: <Debug /> },
  { path: '*', element: <NotFound /> },
])

export function App() {
  useEffect(() => {
    attemptBootReconnect()
  }, [])

  return <RouterProvider router={router} />
}
