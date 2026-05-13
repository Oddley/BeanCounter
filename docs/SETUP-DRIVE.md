# Google Drive OAuth — Developer Setup

One-time setup to get Bean Counter talking to your Google Drive. ~10 minutes of clicking through Google Cloud Console.

This is a developer / deploy task, not an end-user task. You do this once per environment (dev machine, prod deployment). The output is a **client ID** (a public identifier; NOT a secret) that the app uses to identify itself to Google's OAuth servers.

## TL;DR

1. Make a Google Cloud project
2. Enable the Drive API
3. Configure OAuth consent screen
4. Create an OAuth 2.0 Web Client ID, with our dev URL in "Authorized JavaScript origins"
5. Drop the client ID into `.env.local`

---

## Step 1 — Create / pick a Google Cloud project

1. Open https://console.cloud.google.com/
2. Top bar → project picker → **"New Project"**
3. Name it whatever (`bean-counter-dev` works). No organization needed for personal use.
4. Wait ~10 seconds for creation, then make sure it's selected in the top bar

## Step 2 — Enable the Drive API

1. Left menu → **APIs & Services → Library**
2. Search **"Google Drive API"**
3. Click it → **"Enable"**
4. ~30 seconds to enable

## Step 3 — Configure OAuth consent screen

1. Left menu → **APIs & Services → OAuth consent screen**
2. **User type: External** → Create
3. Fill in:
   - **App name:** `Bean Counter` (or whatever)
   - **User support email:** your email
   - **Developer contact email:** your email
   - Skip everything else
4. **Save and Continue**
5. **Scopes screen:** click "Add or Remove Scopes" → search `drive.file` → check **`https://www.googleapis.com/auth/drive.file`** → Update → Save and Continue
6. **Test users:** add the Google account you'll be testing with → Save and Continue
7. **Summary:** Back to Dashboard

You're in "testing" mode — only test users you added can sign in. That's fine for dev. (If we eventually publish a real version, we'd verify the app, which is a bigger deal.)

## Step 4 — Create the OAuth 2.0 Client ID

1. Left menu → **APIs & Services → Credentials**
2. **Create Credentials → OAuth client ID**
3. **Application type:** Web application
4. **Name:** `Bean Counter web client` (or whatever)
5. **Authorized JavaScript origins** — add these:
   - `http://localhost:5173`
   - `http://<your-local-IP>.nip.io:5173` — e.g. `http://192.168.86.25.nip.io:5173`. See note below.
   - When we deploy: the production URL too
6. **Authorized redirect URIs** — leave empty (we use implicit flow, not redirect)

> **Why `.nip.io`?** Google rejects raw LAN IP addresses as JavaScript origins ("must end with a public top-level domain"). `nip.io` is a free DNS service that resolves any `<ip>.nip.io` hostname to that exact IP. So `http://192.168.86.25.nip.io:5173` looks like a `.io` domain to Google but routes to your LAN dev server. The Vite config already allows `.nip.io` hostnames (`server.allowedHosts` in `vite.config.ts`).
>
> Your phone and PC both navigate to the nip.io URL (not the bare IP) when testing Drive-related features.
7. **Create**
8. A modal pops up with your **Client ID** (long string ending in `.apps.googleusercontent.com`). **Copy it.**

## Step 5 — Drop the client ID into `.env.local`

In the project root, create `.env.local` (already gitignored):

```
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
```

Restart the Vite dev server (`npm run dev`) so the env var is picked up.

---

## Troubleshooting

### "Error 400: redirect_uri_mismatch" or "origin mismatch" when signing in

Your dev URL isn't in the **Authorized JavaScript origins** list for the client ID. Add it (Step 4 part 5) and try again. Browser caching can also cause this — hard reload (Ctrl+Shift+R).

### "This app isn't verified" warning during consent

Expected in "testing" mode. Click "Advanced" → "Go to Bean Counter (unsafe)". Only a problem if you publish for general use.

### "Access blocked: bean-counter has not completed verification"

You're trying to sign in with a Google account that wasn't added as a test user in Step 3. Either add the account, or sign in with one you did add.

### Wifi network changes / new dev IP

Your phone's connection to the Vite dev server depends on the PC's IP. If you move networks and the IP changes, update **Authorized JavaScript origins** with the new IP. (Some routers can reserve a fixed IP for your PC; helpful if this keeps happening.)

### Drive API quota

Free tier is generous (1,000 requests / 100 seconds / user). We won't come close in normal use.

---

## When done

Send the client ID over (or just `.env.local` is fine on your dev machine), confirm the dev server picks it up, and we wire up the Connect button.
