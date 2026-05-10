import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...rest
}: ButtonProps) {
  const composed = [styles.button, styles[variant], className]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={composed} {...rest}>
      {children}
    </button>
  )
}
