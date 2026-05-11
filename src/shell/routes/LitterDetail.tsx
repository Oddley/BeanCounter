import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AppBar, Button, Input, ListItem } from '../components'
import {
  useLitter,
  useActiveKittens,
  useArchivedKittens,
  useSettings,
  useOpenSessionForLitter,
  archiveLitterById,
  activateLitterById,
  renameLitterById,
  persistNewKitten,
  archiveKittenById,
  activateKittenById,
  renameKittenById,
  setStickyLitterById,
  clearStickyLitterById,
  persistKittenOrder,
} from '../db'
import { hasStickyLitter } from '../../core/settings'
import { validateLitterName } from '../../core/litter'
import {
  validateKittenName,
  moveKittenUp,
  moveKittenDown,
} from '../../core/kitten'
import styles from './LitterDetail.module.css'

export function LitterDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const litter = useLitter(id)
  const activeKittens = useActiveKittens(id)
  const archivedKittens = useArchivedKittens(id)
  const settings = useSettings()
  const openSession = useOpenSessionForLitter(id)

  const [showArchived, setShowArchived] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [addingKitten, setAddingKitten] = useState(false)
  const [newKittenName, setNewKittenName] = useState('')
  const [renameKittenId, setRenameKittenId] = useState('')
  const [renameKittenDraft, setRenameKittenDraft] = useState('')
  const [reorderMode, setReorderMode] = useState(false)

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
    settings !== undefined &&
    hasStickyLitter(settings) &&
    settings.stickyLitterId === litter.id

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

  const moveUp = async (index: number) => {
    if (activeKittens === undefined) return
    const updated = moveKittenUp(activeKittens, index)
    await persistKittenOrder(updated)
  }

  const moveDown = async (index: number) => {
    if (activeKittens === undefined) return
    const updated = moveKittenDown(activeKittens, index)
    await persistKittenOrder(updated)
  }

  const canReorder =
    activeKittens !== undefined && activeKittens.length >= 2

  return (
    <>
      <AppBar title={litter.name} backTo="/litters" />
      <main className={styles.main}>
        {!reorderMode && litter.active && (
          <section className={styles.section}>
            <Link to={`/litters/${litter.id}/feed`} className={styles.primaryActionLink}>
              <Button className={styles.primaryActionButton}>
                {openSession !== null && openSession !== undefined
                  ? '▶ Resume weights'
                  : '▶ Start weights'}
              </Button>
            </Link>
          </section>
        )}

        {!reorderMode && (
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
        )}

        {!reorderMode && (
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
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              {reorderMode ? 'Reorder kittens' : 'Kittens'}
            </h2>
            {reorderMode ? (
              <Button
                variant="primary"
                onClick={() => setReorderMode(false)}
              >
                Done
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setAddingKitten((v) => !v)}
              >
                {addingKitten ? 'Cancel' : '+ Add'}
              </Button>
            )}
          </div>

          {!reorderMode && addingKitten && (
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
              {activeKittens.map((k, i) => (
                <li key={k.id}>
                  {reorderMode ? (
                    <ListItem
                      primary={k.displayName}
                      trailing={
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => moveUp(i)}
                            disabled={i === 0}
                            aria-label="Move up"
                          >
                            ▲
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => moveDown(i)}
                            disabled={i === activeKittens.length - 1}
                            aria-label="Move down"
                          >
                            ▼
                          </Button>
                        </>
                      }
                    />
                  ) : renameKittenId === k.id ? (
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

          {!reorderMode && canReorder && (
            <div className={styles.reorderToggle}>
              <Button
                variant="secondary"
                onClick={() => setReorderMode(true)}
              >
                Reorder kittens
              </Button>
            </div>
          )}
        </section>

        {!reorderMode && (
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
        )}

        {!reorderMode && (
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
        )}
      </main>
    </>
  )
}
