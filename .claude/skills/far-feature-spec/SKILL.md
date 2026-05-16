---
name: far-feature-spec
description: >-
  Produces an implementation-ready specification for a VSCommander feature by
  launching the REAL Far Manager, driving it with scripted keyboard/mouse
  input, capturing its screens, and corroborating with the Far Manager C++
  source. Use when asked to "spec a Far feature", "capture Far behaviour for
  <feature>", "research <feature> from Far Manager", "plan a Far Manager
  feature for VSCommander", or before implementing any Far Manager feature
  replica in the VSCommander extension.
tools: Read, Grep, Glob, Bash, Write, Edit, AskUserQuestion
---

# Far feature spec extractor

Given a feature name, produce one implementation-ready spec for VSCommander by
**observing the real Far Manager** and corroborating with its source. Far is
the source of truth — VSCommander must replicate it exactly.

Running and capturing real Far is the core of this skill. Source reading is
secondary: it explains *why* and pins exact defaults and edge cases behind
what was observed.

## Environment

- This session runs in **WSL (Linux)**; Far Manager is **Windows-only**.
- Far **source** is a sibling checkout — `Glob` for `../FarManager/far` and
  `../mc` relative to the VSCommander repo root. Use only relative paths; never
  write absolute `/home/...` paths into any committed file.
- Far is **driven** through the bundled Windows helper `helper/far-driver.ps1`,
  invoked via WSL→`powershell.exe` interop.
- Output goes to `specs/<feature-slug>.md` with captures in
  `specs/<feature-slug>.captures/`.

## Driving Far — the helper

Invoke the helper per action. Convert its path with `wslpath -w` first:

```
HELPER="$(wslpath -w "$(pwd)/.claude/skills/far-feature-spec/helper/far-driver.ps1")"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HELPER" -Action launch  -StartDir 'C:\Temp\far-spec-sandbox' -Cols 120 -Rows 40
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HELPER" -Action sendkeys -Keys 'key:F7;text:newdir;key:Enter'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HELPER" -Action click   -Col 40 -Row 12
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HELPER" -Action capture -Out 'C:\Temp\far-spec\state-1'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HELPER" -Action quit
```

- **Key spec** (`-Keys`): `;`-separated tokens. `key:<name>` sends a named key
  with optional `Ctrl+`/`Alt+`/`Shift+` prefixes (`key:F7`, `key:Ctrl+F12`,
  `key:Alt+F1`, `key:Enter`, `key:Down`). `text:<literal>` types text.
- **`capture`** writes `<Out>.ansi.txt` (colour text grid, ANSI SGR) and
  `<Out>.png`; it prints the two Windows paths. Convert them with `wslpath -u`
  and copy both into `specs/<slug>.captures/`.
- Allow a settle delay (~400 ms) between a `sendkeys` and the next `capture`.
- Always run `quit` at the end, even on failure.

If `powershell.exe` is not reachable, `/mnt/c` is not mounted, or
`launch` reports Far.exe missing — **stop** and tell the user the WSL↔Windows
bridge is unavailable; do not fabricate captures.

## Mandatory coverage (every spec)

Every spec MUST cover these by default, each backed by an observed capture -
never describe a state you did not capture:

- **Filesystem errors** - each failure class, its error dialog and buttons.
- **Conflicts** - target already exists (as a file / as a directory),
  case-only differences.
- **Archive context** - behaviour when the active panel is inside a
  ZIP / TAR / 7z / RAR archive (or an evidenced "N/A").
- **All UI elements & their behaviour** - the full `Tab` / `Shift+Tab` focus
  cycle and how focus changes a control's colour, the `Escape` key, the
  `Enter` key (default button and per-control), and mouse behaviour per
  element.
- **F1 help** - the Far help topic for the feature and its content.
- **Tests** - every spec item mapped methodically to a test, with a reference
  screenshot for every distinct visual state.
- **Far vs VSCommander** - classify every difference from an existing
  VSCommander implementation: matches Far / intentional improvement
  (documented with its reason) / undocumented divergence (ask the user which
  behaviour to adopt).

The template (`templates/feature-spec.md`) has a dedicated mandatory section
for each; fill them all.

## Workflow

Read `references/far-source-map.md` before searching the source.

1. **Resolve & verify.** Locate `../FarManager/far` and `../mc`. Verify the
   helper bridge with a trial `launch` + `capture`; abort cleanly if it fails.
2. **Plan the interaction.** From `references/far-source-map.md` and a quick
   source peek, list every state to capture: base panel; the dialog as opened;
   each control focused in turn across the whole `Tab` cycle; every
   combobox/checkbox toggled; `F1` help; each conflict; each filesystem error;
   archive context; after-confirm and after-cancel.
3. **Prepare a sandbox.** Create a Windows-side temp directory with known
   fixture files so the feature has deterministic content to act on; launch
   Far pointed at it.
4. **Drive & capture (primary).** Walk every planned state: `sendkeys` /
   `click`, then `capture`. Step through the whole focus cycle (one capture
   per focused control), toggle every combobox/checkbox, open `F1` help, and
   capture after-confirm and after-cancel. Collect every `.ansi.txt` + `.png`.
5. **Mine the source (secondary).** Read the feature's `.cpp`: the `DI_*`
   item array (types, positions, `DIF_*` flags, captions — see
   `references/di-item-reference.md`), dialog size (`SetPosition`), the
   `*DlgProc` dynamic rules, default values, and edge-case handling. Read the
   `@Topic` help text (`FarEng.hlf.m4`, or the compiled `FarEng.hlf` shipped
   with the install). Map colours via `references/farcolor-to-vscommander.md`.
6. **Cross-reference Midnight Commander.** Note where `../mc` differs; Far
   governs — MC differences are notes only.
7. **Drive the mandatory paths.** Reproduce and capture every conflict
   (target exists as a file / as a directory), every reproducible filesystem
   error (permission denied, path not found, invalid name), and archive
   context. Then sweep remaining edge cases (symlinks, empty input, long
   paths). Mark each `VERIFIED` (cite a capture and/or `file:line`) or
   `ASSUMED` (and surface it in section 0).
8. **Cross-reference VSCommander & classify.** `Grep` `src/` and read the
   matching `docs/*.md` / `USER.md`. Where VSCommander already implements the
   feature, classify every difference from Far as one of: (a) matches Far;
   (b) an **intentional improvement** — record it in the spec's "Intentional
   improvements over Far" table with the reason; or (c) an undocumented
   **divergence** — record it in the "Divergences needing a decision" table.
9. **Clarify.** Batch questions and ask via `AskUserQuestion` before emitting:
   ambiguous feature name, several candidate Far dialogs, platform-divergent
   behaviour, a Far/MC conflict, and — importantly — every undocumented
   divergence between the existing VSCommander implementation and Far (ask
   which behaviour to adopt). Never guess on filesystem edge-case behaviour.
10. **Emit & scaffold.** See below.

## Emit & scaffold (step 10)

Fill `templates/feature-spec.md` completely — every section, no blanks (write
"N/A" or "UNKNOWN — needs verification"). Then:

- Write the spec to `specs/<feature-slug>.md` (create `specs/` if absent).
- Copy the captures into `specs/<feature-slug>.captures/`; embed each
  `.ansi.txt` grid inline in spec section 3 and link the PNGs.
- Create scaffolding stubs and report every path touched:
  - `docs/<Feature>.md` — H1 title + H2 section headings, backtick hotkeys,
    marked `<!-- DRAFT -->`.
  - `docs/Contents.md` — append the `[Display Name](<Feature>.md)` entry.
  - `USER.md` — append a draft section under a `<!-- DRAFT: <feature> -->`
    marker.
  - `src/test/suite/<NNN> - <description>/` — next free `NNN`; a `test.ts`
    skeleton importing `../harness` with the planned key/mouse sequence as
    comments, plus empty `filesystem/panel1/` and `filesystem/panel2/`.
- Finish with a short summary: the spec path, the capture count, the open
  questions, and the scaffolded paths.
