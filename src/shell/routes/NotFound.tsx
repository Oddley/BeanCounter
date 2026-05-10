import { Link } from 'react-router-dom'
import { AppBar } from '../components'

export function NotFound() {
  return (
    <>
      <AppBar title="Not found" />
      <main>
        <p>That page doesn't exist.</p>
        <Link to="/">Go home</Link>
      </main>
    </>
  )
}
