# VSCommander — Development Guide

## Project Overview

Dual-panel file manager VS Code extension overlaid on a real terminal via pseudoterminal + node-pty.

It is designed to be as close replica as possible to the Far Manager. The Far Manager source code is located inside the "../FarManager" directory.
Also there is a copy of Midnight Commander source code inside the "../mc" directory - both next to the project in the same parent directory.

**IMPORTANT** when implementing a new feature - carefully read the corresponding Far Manager code to get a complete understanding of:
- the feature logic
- edge cases and oddities
- visual representation
- hotkeys, key bindings, and mouse interactions
and replicate the feature EXACTLY.
- when implementing a file system file-related feature (copy, move, deletion, etc) - think of all possible edge cases (low disk space, different filesystems, different drives for the source and target locations, symlinks, hardlinks, recursive soft- and hardlinks, file system errors, bad blocks, missing access permissions, incorrect file state and opned descriptiors, and much more). Read the Far Manager source code and Midnight commander for reference before thinking on how to implement these features. Ask all the necessary clarifying questions before implementation.



## Build & Run

```bash
npm install
npm run compile        # tsc -p ./ (for debugging with F5)
npm run watch          # tsc -watch -p ./ (development)
npm run bundle         # esbuild production bundle (single minified file)
npm run bundle:watch   # esbuild watch mode
npm run typecheck      # tsc --noEmit (type checking only)
npm run package        # bundle + vsce package (produces .vsix)
```

Press F5 in VS Code to launch the Extension Development Host. Run "VSCommander: Open Terminal" from the command palette, then Ctrl+O to toggle the panel.

## Architecture

```
src/
  extension.ts      Orchestrator — Pseudoterminal, command registration, VS Code API. Delegates to components below.
  shell.ts          node-pty shell proxy — spawn, resize, data forwarding, kill
  panel.ts          Panel coordinator — layout, popup routing, pane navigation, render dispatch
  draw.ts           Low-level ANSI escape sequence primitives (cursor, box, color, alt screen)
  timerManager.ts   Generic BlinkTimer + PollTimer — replaces all timer patterns
  copyMoveController.ts  Copy/move orchestration — scan, progress, error dialog, navigate — no vscode
  fileOps.ts        File system operations (mkdir, copy, move, recursive copy) — no vscode
  shellRouter.ts    Shell input tracking, cd suppression, output buffer — no vscode
  quickView.ts      Quick view state machine + QuickViewHost interface — no vscode
  commandLine.ts    Command line row: render, cursor blink, spinner, shell input
  fkeyBar.ts        Function key bar: render, mouse hit-test
  terminalArea.ts   Terminal buffer rendering in hidden-pane area
  cellQuery.ts      Cell-at-coordinate query for popup shadows — pure function
  pane.ts           Single file-list pane: entries, cursor, selection, rendering
  *Popup.ts         Popup dialogs (search, drive, confirm, mkdir, copyMove, menu)
```

Data flow: VS Code terminal ↔ Pseudoterminal (extension.ts) ↔ shell.ts (normal mode) OR panel.ts (panel mode). Toggle switches between alt screen buffer (panel) and main buffer (shell).

Dependency tree:
```
extension.ts (orchestrator)
  ├── timerManager.ts
  ├── copyMoveController.ts
  │     └── fileOps.ts
  ├── shellRouter.ts
  ├── quickView.ts
  ├── directoryInfo.ts
  ├── shell.ts
  └── panel.ts (coordinator)
        ├── commandLine.ts
        ├── fkeyBar.ts
        ├── terminalArea.ts
        ├── cellQuery.ts
        ├── pane.ts
        └── *Popup.ts
```

No new file imports vscode (except extension.ts and directoryInfo.ts which already do).

## Conventions

### Cross-Platform (MANDATORY)

This extension must work on **Linux, FreeBSD, macOS, and Windows**. Every change must respect:

- **Paths**: Always use `path.join()` / `path.resolve()` / `path.dirname()` — never concatenate with `/` or `\`
- **Home directory**: Use `os.homedir()` — never `process.env.HOME` (unset on Windows)
- **Shell detection**: `os.platform() === 'win32'` → PowerShell; otherwise `$SHELL` or `/bin/bash`
- **Terminal characters**: ASCII and standard Unicode box-drawing only (U+2500 block). No emoji — they have inconsistent width across terminal emulators and platforms
- **Line endings**: All source files use LF. The terminal handles its own line endings
- **ANSI sequences**: Stick to xterm-256color — supported by Windows Terminal, conhost (Win10+), and all Unix terminals

### TypeScript

- Strict mode enabled (`"strict": true` in tsconfig)
- Target ES2020, CommonJS modules
- Output to `out/` directory
- Imports: `import * as X from 'X'` style (esModuleInterop enabled)

### Code Style

- No comments unless the logic is non-obvious
- No emoji in code or output strings
- Functions that produce ANSI output return `string` — the caller writes to the emitter
- Panel state is mutated in place, render functions read from it
- Keep `draw.ts` as pure ANSI primitives with no business logic
- Keep `panel.ts` and all files it depends on with no knowledge of VS Code APIs
- Keep `shell.ts` with no knowledge of VS Code APIs
- Only `extension.ts` and `directoryInfo.ts` may import `vscode`

### Settings Persistence (MANDATORY)

All panel settings changes (theme, colors, display options) are IN MEMORY by default.
Settings only persist to VS Code configuration when the user explicitly uses
F9 > Options > Save settings. Never auto-persist settings changes.

### Terminal Rendering

- All drawing uses absolute cursor positioning (`moveTo(row, col)`)
- Panel uses alternate screen buffer (`\x1b[?1049h` / `\x1b[?1049l`) to preserve shell history
- Icon/text column widths must be tracked as display width (terminal cells), not JS string length
- Box borders use Unicode box-drawing: `BOX.topLeft` (`┌`), `BOX.horizontal` (`─`), etc.

### Commands & Keybindings

- `vscommander.open` — opens a new VSCommander terminal
- `vscommander.toggle` — toggles panel overlay (bound to `ctrl+o` when `terminalFocus`)

### User Documentation (MANDATORY)

`USER.md` at the project root is the user-facing guide. **Every feature change must update USER.md** — new keybindings, new commands, new panel behaviors, changed defaults. If you add it to the code, add it to USER.md.

### Readme file (MANDATORY)

`README.md` at the project root is the community-facing project description. **Every major feature must be reflected in USER.md**. The file language is concise, highlighting important and competitive features.

### Workflow

- After each iteration of code changes, run `npm run compile` to check for TypeScript errors before moving on

### Adding New Features

1. Drawing primitives go in `draw.ts`
2. Panel visual components go in their own files (`commandLine.ts`, `fkeyBar.ts`, `terminalArea.ts`, `cellQuery.ts`)
3. Panel coordination (navigation, popup routing) goes in `panel.ts`
4. File system operations go in `fileOps.ts`
5. Shell/PTY concerns go in `shell.ts` or `shellRouter.ts`
6. Timer patterns use `BlinkTimer`/`PollTimer` from `timerManager.ts`
7. VS Code API integration goes in `extension.ts`
8. New files must not import vscode — only `extension.ts` and `directoryInfo.ts` may
9. Test on multiple platforms or at minimum verify no platform-specific APIs are used without guards
10. Update `USER.md` with any user-visible changes
