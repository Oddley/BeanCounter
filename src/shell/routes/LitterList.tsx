import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppBar, Button, ListItem } from '../components'
import { useActiveLitters, useArchivedLitters } from '../db'
import styles from './LitterList.module.css'

export function LitterList() {
  const [showArchived, setShowArchived] = useState(false)
  const active = useActiveLitters()
  const archived = useArchivedLitters()

  const overflowMenu = (
    <Link to="/debug" className={styles.menuLink} aria-label="Debug">
      ⋯
    </Link>
  )

  return (
    <>
      <AppBar title="Litters" menu={overflowMenu} />
      <main className={styles.main}>
        <div className={styles.actions}>
          <Link to="/litters/new">
            <Button>+ New litter</Button>
          </Link>
        </div>

        {active === undefined ? (
          <p className={styles.muted}>Loading…</p>
        ) : active.length === 0 ? (
          <p className={styles.muted}>
            No active litters yet. Tap "New litter" to start.
          </p>
        ) : (
          <ul className={styles.list}>
            {active.map((litter) => (
              <li key={litter.id}>
                <ListItem
                  primary={litter.name}
                  to={`/litters/${litter.id}`}
                  trailing="›"
                />
              </li>
            ))}
          </ul>
        )}

        <div className={styles.archivedToggle}>
          <Button
            variant="secondary"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Button>
        </div>

        {showArchived && archived !== undefined && archived.length > 0 && (
          <ul className={styles.list}>
            {archived.map((litter) => (
              <li key={litter.id}>
                <ListItem
                  primary={litter.name}
                  secondary="archived"
                  to={`/litters/${litter.id}`}
                  dimmed
                  trailing="›"
                />
              </li>
            ))}
          </ul>
        )}

        {showArchived && archived !== undefined && archived.length === 0 && (
          <p className={styles.muted}>No archived litters.</p>
        )}
      </main>
    </>
  )
}
