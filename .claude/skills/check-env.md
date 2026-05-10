# Check Env

Probe the local development environment and report what's installed, missing, or out of date. Pure diagnostic — does not install or modify anything.

Run after toolchain setup, after a machine change, or anytime something feels off.

## Procedure

Run each probe and capture both exit status and output. Report results in a table.

| Tool | Required for | Probe |
|---|---|---|
| Node.js | All Phase 1+ work | `node --version` |
| npm | All Phase 1+ work | `npm --version` |
| git | Already in use | `git --version` |
| Working directory | Sanity check | `pwd` |
| Project deps installed | After `npm install` runs | `ls node_modules` exists |
| Vite scripts available | Phase 1+ | `cat package.json` shows `"scripts"` |
| Git remote | Push target | `git remote -v` |

## Report Format

Produce a table with three columns: **Tool**, **Status** (✓ / ✗ / ⚠), and **Detail** (version string, missing message, or warning).

Flag anything missing with the install command (e.g., `winget install OpenJS.NodeJS.LTS` for Node).

End with one sentence: "Toolchain healthy — ready to proceed" OR "Missing: [list]. See docs/SETUP.md."

## Out of Scope

- Do not run `npm install` or any other installer
- Do not modify settings, files, or env
- Do not start dev servers
- Do not commit anything
