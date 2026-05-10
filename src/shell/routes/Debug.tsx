import { AppBar } from '../components'
import { useAllLitters, useAllKittens, useSettings } from '../db'
import styles from './Debug.module.css'

export function Debug() {
  const litters = useAllLitters() ?? []
  const kittens = useAllKittens() ?? []
  const settings = useSettings()

  const dump = {
    settings,
    litters,
    kittens,
  }

  return (
    <>
      <AppBar title="Debug" backTo="/" />
      <main className={styles.main}>
        <pre className={styles.pre}>{JSON.stringify(dump, null, 2)}</pre>
      </main>
    </>
  )
}
