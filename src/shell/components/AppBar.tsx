import { Link } from 'react-router-dom'
import { SyncIndicator } from './SyncIndicator'
import styles from './AppBar.module.css'

export interface AppBarProps {
  readonly title: string
  readonly backTo?: string
}

export function AppBar({ title, backTo }: AppBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        {backTo !== undefined && (
          <Link to={backTo} className={styles.back} aria-label="Back">
            ‹
          </Link>
        )}
      </div>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.right}>
        <SyncIndicator />
      </div>
    </header>
  )
}
