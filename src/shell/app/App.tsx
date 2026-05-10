import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import {
  Home,
  LitterList,
  LitterDetail,
  NewLitter,
  Debug,
  NotFound,
} from '../routes'

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/litters', element: <LitterList /> },
  { path: '/litters/new', element: <NewLitter /> },
  { path: '/litters/:id', element: <LitterDetail /> },
  { path: '/debug', element: <Debug /> },
  { path: '*', element: <NotFound /> },
])

export function App() {
  return <RouterProvider router={router} />
}
