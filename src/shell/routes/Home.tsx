import { Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, SETTINGS_SINGLETON_ID } from '../db'
import { hasStickyLitter } from '../../core/settings'

export function Home() {
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_SINGLETON_ID))

  if (settings === undefined) {
    return null
  }

  if (hasStickyLitter(settings)) {
    return <Navigate to={`/litters/${settings.stickyLitterId}`} replace />
  }
  return <Navigate to="/litters" replace />
}
