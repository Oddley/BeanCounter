// Shared types for Google libraries loaded at runtime (Identity Services
// + Picker). The single `declare global` block keeps Window.google's
// shape consistent across the gsi.ts and picker.ts modules.

export interface GsiTokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
}

export interface GsiTokenClient {
  requestAccessToken: (overrideConfig?: {
    prompt?: '' | 'none' | 'consent'
  }) => void
}

export interface GsiTokenClientConfig {
  client_id: string
  scope: string
  callback: (response: GsiTokenResponse) => void
  error_callback?: (error: { type: string; message?: string }) => void
}

export interface GsiOAuth2 {
  initTokenClient: (config: GsiTokenClientConfig) => GsiTokenClient
  revoke: (accessToken: string, callback: () => void) => void
}

export interface PickerDocsView {
  setIncludeFolders(b: boolean): PickerDocsView
  setSelectFolderEnabled(b: boolean): PickerDocsView
  setMimeTypes(types: string): PickerDocsView
  setOwnedByMe(b: boolean): PickerDocsView
  setParent(parent: string): PickerDocsView
  // Custom human-readable label for the view's tab in the Picker UI.
  // Without this, both 'My Drive folders' and 'Shared folders' tabs
  // default to 'Folders' and become indistinguishable.
  setLabel(label: string): PickerDocsView
}

export interface PickerBuiltInstance {
  setVisible(visible: boolean): void
}

export interface PickerCallbackData {
  readonly action: string
  readonly docs?: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly mimeType: string
    // Present when the picked item is a file (and Drive returns its
    // immediate parent). Used by the invite-accept flow to verify the
    // picked file is in the inviter's shared folder.
    readonly parentId?: string
  }>
}

export interface PickerBuilder {
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  // GCP project number — required for drive.file scope to be granted
  // on shared-from-another-user files. Without this, the Picker UI
  // works but the scope grant doesn't stick.
  setAppId(appId: string): PickerBuilder
  setTitle(title: string): PickerBuilder
  addView(view: PickerDocsView): PickerBuilder
  setCallback(cb: (data: PickerCallbackData) => void): PickerBuilder
  build(): PickerBuiltInstance
}

export interface PickerNamespace {
  PickerBuilder: new () => PickerBuilder
  Action: { readonly PICKED: string; readonly CANCEL: string }
  DocsView: new (viewId?: unknown) => PickerDocsView
  ViewId: { readonly FOLDERS: unknown }
}

export interface GapiLoadConfig {
  callback: () => void
  onerror?: () => void
}

export interface GapiNamespace {
  load(api: string, config: GapiLoadConfig | (() => void)): void
}

declare global {
  interface Window {
    gapi?: GapiNamespace
    google?: {
      accounts?: { oauth2?: GsiOAuth2 }
      picker?: PickerNamespace
    }
  }
}
