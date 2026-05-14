#!/usr/bin/env node
// Detached dev-server wrapper: start/stop/status.
//
// `dev:start` launches `npm run dev` as a background process, writes its
// PID to .dev-server.pid, and redirects stdout/stderr to .dev-server.log.
// `dev:stop` reads the PID and kills the process tree (taskkill /T on
// Windows, SIGTERM elsewhere).
// `dev:status` prints whether the server appears to be running based on
// the PID file.
//
// The dev server keeps running after this script exits — it's detached.

import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const pidFile = join(repoRoot, '.dev-server.pid')
const logFile = join(repoRoot, '.dev-server.log')

const cmd = process.argv[2] ?? ''
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function isAlive(pid) {
  try {
    // Signal 0 is a no-op check — throws if process doesn't exist.
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readPid() {
  if (!existsSync(pidFile)) return null
  const raw = readFileSync(pidFile, 'utf8').trim()
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function clearPidFile() {
  try {
    unlinkSync(pidFile)
  } catch {
    /* file may not exist */
  }
}

function startServer() {
  const existing = readPid()
  if (existing !== null && isAlive(existing)) {
    console.error(
      `Dev server already running (PID ${existing}). Run 'npm run dev:stop' first.`,
    )
    process.exit(1)
  }
  if (existing !== null) {
    // Stale PID file; clear it before starting.
    clearPidFile()
  }

  const out = openSync(logFile, 'w')
  const err = openSync(logFile, 'a')
  const child = spawn(npmCmd, ['run', 'dev'], {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', out, err],
    windowsHide: true,
    // Windows requires shell:true to launch .cmd files. macOS/Linux
    // gets shell:false (cleaner process tree).
    shell: process.platform === 'win32',
  })

  if (typeof child.pid !== 'number') {
    console.error('Failed to spawn dev server (no PID).')
    process.exit(1)
  }

  writeFileSync(pidFile, String(child.pid))
  child.unref()

  console.log(`Dev server started (PID ${child.pid}).`)
  console.log(`Logs: .dev-server.log`)
  console.log(`URL:  http://localhost:5173 (or your nip.io variant)`)
}

function stopServer() {
  const pid = readPid()
  if (pid === null) {
    console.log('No PID file found; nothing to stop.')
    return
  }
  if (process.platform === 'win32') {
    // Kill the npm.cmd process AND all its children (vite, node).
    spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], {
      stdio: 'inherit',
    })
  } else {
    try {
      // Negative PID kills the process group, taking children with it.
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch (innerErr) {
        console.error(
          `Failed to kill PID ${pid}:`,
          innerErr instanceof Error ? innerErr.message : innerErr,
        )
      }
    }
  }
  clearPidFile()
  console.log('Dev server stopped.')
}

function statusServer() {
  const pid = readPid()
  if (pid === null) {
    console.log('Dev server: not running (no PID file)')
    return
  }
  if (isAlive(pid)) {
    console.log(`Dev server: running (PID ${pid})`)
  } else {
    console.log(`Dev server: PID file points to ${pid} but process is gone`)
    console.log(`Run 'npm run dev:stop' to clean up the stale PID file.`)
  }
}

switch (cmd) {
  case 'start':
    startServer()
    break
  case 'stop':
    stopServer()
    break
  case 'status':
    statusServer()
    break
  default:
    console.error(
      'Usage: node scripts/dev-server.mjs <start|stop|status>',
    )
    process.exit(1)
}
