# Branden — Toolchain Setup

One-time setup to get this machine ready for Bean Counter development. Assumes nothing is installed.

Estimated time: 10–15 minutes, mostly waiting for installers.

## TL;DR

Run one command in PowerShell, restart, done:

```powershell
winget install OpenJS.NodeJS.LTS
```

Then close and reopen any open terminal/Claude Code so the new PATH is picked up.

---

## Step 1 — Install Node.js

**Why:** Bean Counter is a React + TypeScript + Vite project. All build, test, and dev-server tooling runs on Node.js. `npm` ships inside Node, so this single install also gives us the package manager.

**Method:** Use `winget` (Windows' built-in package manager — already installed on Windows 10 1809+ and Windows 11).

Open **PowerShell** (not Git Bash) and run:

```powershell
winget install OpenJS.NodeJS.LTS
```

- A UAC prompt will appear → approve it
- Downloads ~30 MB, installs in under a minute
- Installer adds `node` and `npm` to your system PATH

**Verify:** Close PowerShell, open a fresh one (so it picks up the new PATH), and run:

```powershell
node --version
npm --version
```

Expected output: `v22.x.x` for Node, `10.x.x` for npm (numbers may be slightly higher — anything LTS or newer is fine).

If `node --version` says "not recognized" after restart, the PATH didn't update. Try logging out and back in, or restart Windows.

### If `npm --version` errors with "running scripts is disabled"

PowerShell's default execution policy blocks `.ps1` scripts. `npm` on Windows ships as a PowerShell wrapper, so it gets blocked. This is a one-time fix:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Confirm with `Y`. No admin needed — `-Scope CurrentUser` keeps it per-account. `RemoteSigned` is the standard developer policy: local scripts run, downloaded scripts must be signed. Retry `npm --version` after this.

---

## Step 2 — Confirm Git

**Status:** Likely already done — you've been committing successfully this session. But worth a one-line check.

In PowerShell:

```powershell
git --version
```

Expected: `git version 2.x.x`. If this works, skip ahead.

---

## Step 3 — Browser for Testing

**Why:** Phase 1+ verification involves loading the dev server on your phone. Desktop browser is the secondary test surface and gives access to DevTools (IndexedDB inspector for data visibility).

**Action:** Use Chrome, Edge, or any Chromium-based browser you already have. No install needed unless you don't have one.

---

## Step 4 — Wifi Sanity Check

**Why:** Phase 1 testing puts the dev server on your PC and accesses it from your phone. Both devices must be on the same wifi network.

**Action:** Confirm your phone and PC are on the same network (same SSID, no guest/isolation mode).

---

## Step 5 — Restart Claude Code

**Why:** Permission and skill changes made during a session don't activate until the next session starts. We added several new permissions and a new `/check-env` skill that you'll want available next session.

**Action:** Quit Claude Code completely. Reopen it on this project directory.

---

## When You're Back

Open a new Claude Code session in this project directory and type:

```
/check-env
```

That runs the diagnostic skill we just set up — it'll probe Node, npm, git, and the working directory, and report any gaps. If everything's green, we're ready to scaffold Phase 1.

If anything's red, paste the report into chat and we'll fix it.

---

## Reference

- Node.js homepage: https://nodejs.org/
- winget docs: https://learn.microsoft.com/en-us/windows/package-manager/winget/
- If winget isn't available on this Windows version, fall back to the .msi installer from nodejs.org
