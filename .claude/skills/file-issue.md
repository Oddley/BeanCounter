# File Issue

File a GitHub issue on this repo. Validates labels exist, structures the body around the project's templates, and supports interactive Q&A when the issue comes in conversationally (foster mama saying "the indicator does this weird thing sometimes").

Use when:
- User asks to file a bug or feature request
- User describes a concrete problem worth capturing
- Mid-session, you spot an out-of-scope concern worth tracking

## Procedure

### Step 1 — Gather information

For each new issue you need:
- **Title**: action-oriented, under 70 chars (e.g. "Lock banner on FeedingSession", not "lock thing")
- **Type label**: one of `bug` / `enhancement`
- **Area label**: zero or one of `area:sync` / `area:ui` / `area:perf` / `area:a11y` / `area:docs`
- **Phase label**: zero or one of `phase:4.5` / `phase:5`
- **Body**: markdown matching the bug or feature template (Step 3)

If the user provides this all up front, skip to Step 2.

**Interactive Q&A mode** — if a user describes a problem conversationally without complete info, gather what's missing via brief follow-ups. Lean on:

For bugs:
- "What were you doing when it happened?" (reproduction context)
- "What did you see vs. what did you expect?" (the diff)
- "What device/browser?" (only if device-specific behavior suspected)
- Ask only one or two questions at a time. Don't interrogate.

For features:
- "What's the situation when you'd want this?"
- "What does this make easier or unblock?"
- Don't demand justification — accepting "because it'd be nicer" is fine.

Draft the title yourself based on what you've learned. Surface it for confirmation: *"Filing as: '<title>' with labels <list>. Sound right?"*

Don't file without explicit user confirmation when in Q&A mode.

### Step 2 — Validate labels exist

Before invoking `gh issue create`, confirm each label exists on the repo:

```bash
gh label list --json name --jq '.[].name'
```

If a label is missing, create it before filing:

```bash
gh label create "label-name" --color "HEXCODE" --description "short description"
```

Color reference (sticking to the project's existing taxonomy):
- `bug` — `d73a4a` (red)
- `enhancement` — `a2eeef` (light blue)
- `area:sync` — `0e8a16` (green)
- `area:ui` — `5319e7` (purple)
- `area:perf` — `fbca04` (yellow)
- `area:a11y` — `1d76db` (blue)
- `area:docs` — `bfdadc` (mint)
- `phase:4.5` — `d4c5f9` (lavender)
- `phase:5` — `c2e0c6` (sage)

### Step 3 — Body templates

**Bug template:**

```markdown
## What happened?
<observed behavior>

## What were you trying to do?
<context the user was in>

## What did you expect?
<intended behavior>

## Device / browser
<if relevant>

## Anything else?
<extras: logs, screenshots, suspicions, related issues>
```

**Feature template:**

```markdown
## What
<the requested change>

## Why
<problem it solves, scenario it enables>

## When does it come up?
<situations / user flow context>

## Acceptance criteria
<concrete signals that "this is done" — if known>
```

Skip sections with no content rather than padding them.

### Step 4 — File the issue

Use a HEREDOC for multi-line bodies to avoid escaping headaches:

```bash
gh issue create \
  --title "Lock banner on FeedingSession" \
  --label "enhancement,area:sync,phase:4.5" \
  --body "$(cat <<'EOF'
## What
Two devices opening the same FeedingSession have no awareness of each other...

## Why
Prevents lost weight entries when foster mama + foster dad both log a feeding...

## Acceptance criteria
- Both devices show banner within 30s
- Banner clears within 90s after one device exits
EOF
)"
```

Returns the URL of the new issue. Surface it to the user.

### Step 5 — Verify and surface

After filing, confirm with a brief response:

> Filed as #<N>: <title> — https://github.com/Oddley/BeanCounter/issues/<N>
>
> Labels: <list>

Don't dump the entire body back at the user.

## Future workflow — issue assignment

When the user assigns Claude an existing issue (workflow vision: "Claude, work on #12"):

1. Fetch the issue: `gh issue view N --json title,body,labels`
2. Confirm scope back to user before starting code changes
3. Implement
4. Reference the issue in the commit message: `feat(scope): description (#12)`
5. Close the issue on merge: `gh issue close N --comment "Shipped in <commit-sha>"`

## Anti-patterns

- ❌ Don't file vague tickets ("UI is bad")
- ❌ Don't file without confirming the title with the user
- ❌ Don't pad the body to fill every template section
- ❌ Don't create labels speculatively — only when needed for an issue you're filing right now
- ❌ Don't file from a half-finished Q&A flow — get explicit go-ahead first
