import { useNavigate } from 'react-router-dom'
import { AppBar, Button } from '../components'
import { useAllLitters, useAllKittens, useSettings, wipeAllData } from '../db'
import styles from './Debug.module.css'

export function Debug() {
  const navigate = useNavigate()
  const litters = useAllLitters() ?? []
  const kittens = useAllKittens() ?? []
  const settings = useSettings()

  const dump = {
    settings,
    litters,
    kittens,
  }

  const handleWipe = async () => {
    const ok = window.confirm(
      'Wipe all litters, kittens, and settings? This cannot be undone.',
    )
    if (!ok) return
    await wipeAllData()
    navigate('/', { replace: true })
  }

  return (
    <>
      <AppBar title="Debug" backTo="/" />
      <main className={styles.main}>
        <pre className={styles.pre}>{JSON.stringify(dump, null, 2)}</pre>
        <div className={styles.danger}>
          <Button variant="danger" onClick={handleWipe}>
            Wipe all data
          </Button>
        </div>
      </main>
    </>
  )
}
