import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'
import styles from './Input.module.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string
  readonly error?: string
}

export function Input({ label, error, id, className, ...rest }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const composed = [styles.input, error ? styles.invalid : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input id={inputId} className={composed} {...rest} />
      {error !== undefined && error !== '' && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
