// Firebase auth + config management for the Firebase sync backend.
// The user brings their own Firebase project; we store their config in
// localStorage. Firebase API keys are designed to be public (access is
// controlled by Firestore security rules, not by key secrecy).

const CONFIG_KEY = 'beancounter:firebase-config'

export interface FirebaseConfig {
  readonly apiKey: string
  readonly authDomain: string
  readonly projectId: string
  readonly appId: string
}

export function getStoredFirebaseConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<FirebaseConfig>
    if (!parsed.apiKey || !parsed.authDomain || !parsed.projectId || !parsed.appId) {
      return null
    }
    return parsed as FirebaseConfig
  } catch {
    return null
  }
}

export function setStoredFirebaseConfig(config: FirebaseConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

export function clearStoredFirebaseConfig(): void {
  localStorage.removeItem(CONFIG_KEY)
}

export function isFirebaseConfigured(): boolean {
  return getStoredFirebaseConfig() !== null
}
