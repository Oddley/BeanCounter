import { Navigate } from 'react-router-dom'
import { useSettings } from '../db'
import { hasStickyLitter } from '../../core/settings'

export function Home() {
  const settings = useSettings()

  if (settings === undefined) {
    return null
  }

  if (hasStickyLitter(settings)) {
    return (
      <Navigate to={`/litters/${settings.stickyLitterId}/feed`} replace />
    )
  }
  return <Navigate to="/litters" replace />
}
