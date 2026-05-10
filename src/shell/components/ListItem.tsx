import type { ReactNode, MouseEventHandler } from 'react'
import { Link } from 'react-router-dom'
import styles from './ListItem.module.css'

export interface ListItemProps {
  readonly primary: ReactNode
  readonly secondary?: ReactNode
  readonly to?: string
  readonly onClick?: MouseEventHandler<HTMLElement>
  readonly dimmed?: boolean
  readonly trailing?: ReactNode
}

export function ListItem({
  primary,
  secondary,
  to,
  onClick,
  dimmed = false,
  trailing,
}: ListItemProps) {
  const className = [styles.row, dimmed ? styles.dimmed : '']
    .filter(Boolean)
    .join(' ')

  const inner = (
    <>
      <div className={styles.text}>
        <div className={styles.primary}>{primary}</div>
        {secondary !== undefined && (
          <div className={styles.secondary}>{secondary}</div>
        )}
      </div>
      {trailing !== undefined && (
        <div className={styles.trailing}>{trailing}</div>
      )}
    </>
  )

  if (to !== undefined) {
    return (
      <Link to={to} className={className} onClick={onClick}>
        {inner}
      </Link>
    )
  }

  return (
    <div className={className} onClick={onClick}>
      {inner}
    </div>
  )
}
