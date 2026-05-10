import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AppBar, Button, Input, ListItem } from '../components'
import {
  useLitter,
  useActiveKittens,
  useArchivedKittens,
  useSettings,
  archiveLitterById,
  activateLitterById,
  renameLitterById,
  persistNewKitten,
  archiveKittenById,
  activateKittenById,
  renameKittenById,
  setStickyLitterById,
  clearStickyLitterById,
} from '../db'
import { hasStickyLitter } from '../../core/settings'
import { validateLitterName } from '../../core/litter'
import { validateKittenName } from '../../core/kitten'
import styles from './LitterDetail.module.css'

export function LitterDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const litter = useLitter(id)
  const activeKittens = useActiveKittens(id)
  const archivedKittens = useArchivedKittens(id)
  const settings = useSettings()

  const [showArchived, setShowArchived] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [addingKitten, setAddingKitten] = useState(false)
  const [newKittenName, setNewKittenName] = useState('')
  const [renameKittenId, setRenameKittenId] = useState('')
  const [renameKittenDraft, setRenameKittenDraft] = useState('')

  if (litter === undefined) {
    return (
      <>
        <AppBar title="" backTo="/litters" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading…</p>
        </main>
      </>
    )
  }

  if (litter.id === '') {
    return (
      <>
        <AppBar title="Not found" backTo="/litters" />
        <main className={styles.main}>
          <p className={styles.muted}>This litter doesn't exist.</p>
          <Link to="/litters">Back to litters</Link>
        </main>
      </>
    )
  }

  const isSticky =
    hasStickyLitter(settings) && settings.stickyLitterId === litter.id

  const startRenameLitter = () => {
    setDraftName(litter.name)
    setEditingName(true)
  }

  const submitRenameLitter = async () => {
    const validation = validateLitterName(draftName)
    if (!validation.valid) return
    await renameLitterById(litter.id, draftName)
    setEditingName(false)
  }

  const submitNewKitten = async () => {
    const validation = validateKittenName(newKittenName)
    if (!validation.valid) return
    await persistNewKitten({ litterId: litter.id, displayName: newKittenName })
    setNewKittenName('')
    setAddingKitten(false)
  }

  const startRenameKitten = (kittenId: string, currentName: string) => {
    setRenameKittenId(kittenId)
    setRenameKittenDraft(currentName)
  }

  const submitRenameKitten = async () => {
    const validation = validateKittenName(renameKittenDraft)
    if (!validation.valid) return
    await renameKittenById(renameKittenId, renameKittenDraft)
    setRenameKittenId('')
    setRenameKittenDraft('')
  }

  return (
    <>
      <AppBar title={litter.name} backTo="/litters" />
      <main className={styles.main}>
        <section className={styles.section}>
          {editingName ? (
            <div className={styles.editRow}>
              <Input
                label="Litter name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                autoFocus
              />
              <div className={styles.buttonRow}>
                <Button onClick={submitRenameLitter}>Save</Button>
                <Button
                  variant="secondary"
                  onClick={() => setEditingName(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={startRenameLitter}>
              Rename litter
            </Button>
          )}
        </section>

        <section className={styles.section}>
          <Button
            variant={isSticky ? 'secondary' : 'primary'}
            onClick={() =>
              isSticky
                ? clearStickyLitterById()
                : setStickyLitterById(litter.id)
            }
          >
            {isSticky ? '★ Pinned (tap to unpin)' : '☆ Pin as default'}
          </Button>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Kittens</h2>
            <Button
              variant="secondary"
              onClick={() => setAddingKitten((v) => !v)}
            >
              {addingKitten ? 'Cancel' : '+ Add'}
            </Button>
          </div>

          {addingKitten && (
            <div className={styles.editRow}>
              <Input
                label="Kitten name"
                value={newKittenName}
                onChange={(e) => setNewKittenName(e.target.value)}
                autoFocus
              />
              <Button onClick={submitNewKitten}>Add kitten</Button>
            </div>
          )}

          {activeKittens === undefined ? (
            <p className={styles.muted}>Loading…</p>
          ) : activeKittens.length === 0 ? (
            <p className={styles.muted}>No active kittens.</p>
          ) : (
            <ul className={styles.list}>
              {activeKittens.map((k) => (
                <li key={k.id}>
                  {renameKittenId === k.id ? (
                    <div className={styles.editRow}>
                      <Input
                        label="Kitten name"
                        value={renameKittenDraft}
                        onChange={(e) => setRenameKittenDraft(e.target.value)}
                        autoFocus
                      />
                      <div className={styles.buttonRow}>
                        <Button onClick={submitRenameKitten}>Save</Button>
                        <Button
                          variant="secondary"
                          onClick={() => setRenameKittenId('')}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <ListItem
                      primary={k.displayName}
                      trailing={
                        <>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              startRenameKitten(k.id, k.displayName)
                            }
                          >
                            Rename
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => archiveKittenById(k.id)}
                          >
                            Archive
                          </Button>
                        </>
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <Button
            variant="secondary"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Hide archived kittens' : 'Show archived kittens'}
          </Button>

          {showArchived &&
            archivedKittens !== undefined &&
            archivedKittens.length > 0 && (
              <ul className={styles.list}>
                {archivedKittens.map((k) => (
                  <li key={k.id}>
                    <ListItem
                      primary={k.displayName}
                      secondary="archived"
                      dimmed
                      trailing={
                        <Button
                          variant="secondary"
                          onClick={() => activateKittenById(k.id)}
                        >
                          Restore
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

          {showArchived &&
            archivedKittens !== undefined &&
            archivedKittens.length === 0 && (
              <p className={styles.muted}>No archived kittens.</p>
            )}
        </section>

        <section className={styles.section}>
          {litter.active ? (
            <Button
              variant="danger"
              onClick={() => archiveLitterById(litter.id)}
            >
              Archive litter
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => activateLitterById(litter.id)}
            >
              Restore litter
            </Button>
          )}
        </section>
      </main>
    </>
  )
}
