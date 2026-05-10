# Wind Down

End-of-session checklist: audit local changes, consolidate memory, commit, and push to origin.

Run at the end of every working session on this project.

## Procedure

### Step 1 — Audit Local Changes

Run `git status` and `git diff` to review all outstanding changes.

Classify each change:
- **Stage for commit**: source, docs, config, skills, and any tracked project files
- **Should be gitignored**: machine-local files, build artifacts, secrets not yet in `.gitignore` — update `.gitignore` first, confirm with user
- **Ambiguous**: ask the user before doing anything

Never commit `.claude/settings.local.json` or files outside the project directory.
If the working tree is clean, skip to Step 2.

### Step 2 — Consolidate Memory

Review the session for information worth preserving across future sessions. Write to:
`C:\Users\Branden\.claude\projects\C--Users-Branden-ClaudeBeanCounter\memory\`

| What you learned | Memory type | File pattern |
|---|---|---|
| New project decisions, constraints, context shifts | project | `project_*.md` |
| User corrections, confirmed approaches, preferences | feedback | `feedback_*.md` |
| User background or role information | user | `user_*.md` |
| External references (URLs, tools, services) | reference | `reference_*.md` |

Update `MEMORY.md` index for any files added or renamed.

Only save information that is non-obvious or not derivable from the repo.
Skip ephemeral task details, in-progress state, and anything already in CLAUDE.md.

### Step 3 — Commit

Stage all appropriate changes from Step 1.
Write a conventional commit: `type(scope): description` summarizing the session.
Commit to local git.

If working tree was already clean in Step 1, skip this step.

### Step 4 — Push to Origin

Push all local commits to origin.
Note: this triggers a permission prompt — wait for confirmation before pushing.
Use `git push -u origin main` if the upstream tracking branch is not yet set.
