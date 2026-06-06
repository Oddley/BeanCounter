import type { ActiveFileSnapshot } from '../../../core/active-file'
import { snapshotToJson, parseActiveFile } from '../../../core/active-file'
import {
  getStoredFirebaseConfig,
  type FirebaseConfig,
} from '../../auth/firebase'
import type { InspectionResult, SyncBackend } from '../backend'
import { ConcurrencyConflictError } from '../backend'

// ── Lazy Firebase singletons ───────────────────────────────────────────────
// Initialized on first use so the ~150 KB Firebase chunk only loads for
// users who have configured a Firebase project.

interface FirebaseServices {
  auth: import('firebase/auth').Auth
  db: import('firebase/firestore').Firestore
  uid: string
}

let _services: FirebaseServices | null = null

async function getServices(): Promise<FirebaseServices> {
  if (_services !== null) return _services

  const config = getStoredFirebaseConfig()
  if (config === null) throw new Error('Firebase is not configured')

  const [
    { initializeApp, getApps },
    { getAuth, signInWithPopup, GoogleAuthProvider, browserLocalPersistence, setPersistence },
    { getFirestore },
  ] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])

  const appName = 'beancounter'
  const existing = getApps().find((a) => a.name === appName)
  const app = existing ?? initializeApp(config, appName)

  const auth = getAuth(app)
  await setPersistence(auth, browserLocalPersistence)

  // Re-use existing session if available.
  let uid = auth.currentUser?.uid ?? null
  if (uid === null) {
    const provider = new GoogleAuthProvider()
    provider.addScope('email')
    const result = await signInWithPopup(auth, provider)
    uid = result.user.uid
  }

  _services = { auth, db: getFirestore(app), uid }
  return _services
}

// Called when the user disconnects / changes providers — clears cached instances.
export function resetFirebaseServices(): void {
  _services = null
}

// ── Firestore path ──────────────────────────────────────────────────────────

function activeDocPath(uid: string) {
  return `users/${uid}/state/active`
}

// ── Backend factory ─────────────────────────────────────────────────────────

export function createFirebaseBackend(): SyncBackend {
  return {
    kind: 'firebase',
    displayName: 'Firebase',
    isConfigured: () => getStoredFirebaseConfig() !== null,

    async inspect(): Promise<InspectionResult> {
      const { db, uid } = await getServices()
      const { doc, getDoc } = await import('firebase/firestore')

      const ref = doc(db, activeDocPath(uid))
      const snap = await getDoc(ref)

      if (!snap.exists()) return { kind: 'empty' }

      const data = snap.data() as { snapshot?: unknown; lastSyncedAt?: number }
      if (data.snapshot === undefined) return { kind: 'empty' }

      const parsed = parseActiveFile(JSON.stringify(data.snapshot))
      if (!parsed.ok) {
        return { kind: 'unreadable', error: parsed.error }
      }

      // Use a custom _etag field (written by write()) as the concurrency token.
      const concurrencyToken = (data as { _etag?: string })._etag ?? null

      return { kind: 'exists', file: parsed.file, concurrencyToken }
    },

    async write(
      snapshot: ActiveFileSnapshot,
      concurrencyToken: string | null,
    ): Promise<string | null> {
      const { db, uid } = await getServices()
      const { doc, runTransaction, Timestamp } = await import('firebase/firestore')

      const ref = doc(db, activeDocPath(uid))
      const snapshotData = JSON.parse(snapshotToJson(snapshot)) as unknown

      // Generate a new etag to replace the old one on a successful write.
      const newEtag = crypto.randomUUID()

      await runTransaction(db, async (txn) => {
        const current = await txn.get(ref)

        // Optimistic concurrency: if the caller has a token, verify the
        // document hasn't changed since inspect() ran. Abort if it has so
        // the orchestrator can re-inspect and re-merge — identical semantics
        // to Drive's 412 path.
        if (concurrencyToken !== null) {
          const currentEtag = current.exists()
            ? ((current.data() as { _etag?: string })._etag ?? null)
            : null
          if (currentEtag !== concurrencyToken) {
            throw new ConcurrencyConflictError()
          }
        }

        txn.set(ref, {
          snapshot: snapshotData,
          lastSyncedAt: Timestamp.now(),
          uid,
          _etag: newEtag,
        })
      })

      return newEtag
    },
  }
}

// ── Auth helpers for the setup wizard ────────────────────────────────────────

export async function signInToFirebase(config: FirebaseConfig): Promise<string> {
  const [
    { initializeApp, getApps },
    { getAuth, signInWithPopup, GoogleAuthProvider, browserLocalPersistence, setPersistence },
  ] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ])

  const appName = 'beancounter'
  const existing = getApps().find((a) => a.name === appName)
  const app = existing ?? initializeApp(config, appName)

  const auth = getAuth(app)
  await setPersistence(auth, browserLocalPersistence)

  const provider = new GoogleAuthProvider()
  provider.addScope('email')
  const result = await signInWithPopup(auth, provider)
  return result.user.uid
}

export async function signOutFromFirebase(): Promise<void> {
  if (_services === null) return
  const { signOut } = await import('firebase/auth')
  await signOut(_services.auth)
  _services = null
}

export async function testFirestoreAccess(config: FirebaseConfig, uid: string): Promise<'ok' | 'permission-denied' | 'error'> {
  try {
    const [
      { initializeApp, getApps },
      { getFirestore },
      { doc, getDoc },
    ] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
      import('firebase/firestore'),
    ])

    const appName = 'beancounter'
    const existing = getApps().find((a) => a.name === appName)
    const app = existing ?? initializeApp(config, appName)
    const db = getFirestore(app)

    const ref = doc(db, activeDocPath(uid))
    await getDoc(ref)
    return 'ok'
  } catch (err) {
    if (err instanceof Error && err.message.includes('permission')) return 'permission-denied'
    return 'error'
  }
}
