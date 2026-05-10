import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './AppBar.module.css'

export interface AppBarProps {
  readonly title: string
  readonly backTo?: string
  readonly menu?: ReactNode
}

export function AppBar({ title, backTo, menu }: AppBarProps) {
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
      <div className={styles.right}>{menu}</div>
    </header>
  )
}
