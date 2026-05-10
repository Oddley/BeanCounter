import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar, Button, Input } from '../components'
import { validateLitterName } from '../../core/litter'
import { validateKittenName, defaultKittenName } from '../../core/kitten'
import { persistNewLitter, setStickyLitterById } from '../db'
import styles from './NewLitter.module.css'

const MAX_KITTEN_COUNT = 12

function todayMMDD(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

export function NewLitter() {
  const navigate = useNavigate()
  const [name, setName] = useState(todayMMDD)
  const [count, setCount] = useState(4)
  const [kittenNames, setKittenNames] = useState<string[]>(['', '', '', ''])
  const [pinAsDefault, setPinAsDefault] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const adjustCount = (next: number) => {
    const clamped = Math.max(1, Math.min(MAX_KITTEN_COUNT, next))
    setCount(clamped)
    setKittenNames((current) => {
      const copy = [...current]
      while (copy.length < clamped) copy.push('')
      copy.length = clamped
      return copy
    })
  }

  const updateKittenName = (index: number, value: string) => {
    setKittenNames((current) => {
      const copy = [...current]
      copy[index] = value
      return copy
    })
  }

  const litterNameValidation = validateLitterName(name)

  const kittenValidations = kittenNames.map((kn, i) =>
    validateKittenName(kn.trim() || defaultKittenName(i + 1)),
  )

  const allValid =
    litterNameValidation.valid &&
    kittenValidations.every((v) => v.valid) &&
    count > 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!allValid || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await persistNewLitter({
        name,
        kittens: kittenNames.map((displayName) => ({ displayName })),
      })
      if (pinAsDefault) {
        await setStickyLitterById(result.litter.id)
      }
      navigate(`/litters/${result.litter.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save')
      setSubmitting(false)
    }
  }

  return (
    <>
      <AppBar title="New litter" backTo="/litters" />
      <main className={styles.main}>
        <form onSubmit={handleSubmit}>
          <Input
            label="Litter name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={
              name.length > 0 && !litterNameValidation.valid
                ? (litterNameValidation.errors[0] ?? '')
                : ''
            }
            autoFocus
          />

          <div className={styles.countRow}>
            <span className={styles.countLabel}>Number of kittens</span>
            <div className={styles.stepper}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => adjustCount(count - 1)}
                disabled={count <= 1}
                aria-label="Decrease"
              >
                −
              </Button>
              <span className={styles.countValue}>{count}</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => adjustCount(count + 1)}
                disabled={count >= MAX_KITTEN_COUNT}
                aria-label="Increase"
              >
                +
              </Button>
            </div>
          </div>

          {kittenNames.map((kn, i) => (
            <Input
              key={i}
              label={`Kitten ${String(i + 1)}`}
              placeholder={defaultKittenName(i + 1)}
              value={kn}
              onChange={(e) => updateKittenName(i, e.target.value)}
            />
          ))}

          <label className={styles.pinRow}>
            <input
              type="checkbox"
              checked={pinAsDefault}
              onChange={(e) => setPinAsDefault(e.target.checked)}
              className={styles.checkbox}
            />
            <span>Pin as default litter</span>
          </label>

          {submitError !== '' && (
            <div className={styles.error} role="alert">
              {submitError}
            </div>
          )}

          <div className={styles.submit}>
            <Button type="submit" disabled={!allValid || submitting}>
              {submitting ? 'Saving…' : 'Create litter'}
            </Button>
          </div>
        </form>
      </main>
    </>
  )
}
