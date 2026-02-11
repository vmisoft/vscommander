# VSCommander — Development Guide

## Project Overview

Dual-panel file manager VS Code extension overlaid on a real terminal via pseudoterminal + node-pty.

## Build & Run

```bash
npm install
npm run compile        # tsc -p ./
npm run watch          # tsc -watch -p ./
```

Press F5 in VS Code to launch the Extension Development Host. Run "VSCommander: Open Terminal" from the command palette, then Ctrl+O to toggle the panel.

## Architecture

```
src/
  extension.ts   Entry point — Pseudoterminal wiring, command registration, shell ↔ panel routing
  shell.ts       node-pty shell proxy — spawn, resize, data forwarding, kill
  panel.ts       Panel state, directory reading, rendering, keyboard input handling
  draw.ts        Low-level ANSI escape sequence primitives (cursor, box, color, alt screen)
```

Data flow: VS Code terminal ↔ Pseudoterminal (extension.ts) ↔ shell.ts (normal mode) OR panel.ts (panel mode). Toggle switches between alt screen buffer (panel) and main buffer (shell).

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
- Keep `panel.ts` with no knowledge of VS Code APIs
- Keep `shell.ts` with no knowledge of VS Code APIs

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

### Adding New Features

1. Drawing primitives go in `draw.ts`
2. Panel logic (navigation, rendering, input) goes in `panel.ts`
3. Shell/PTY concerns go in `shell.ts`
4. VS Code API integration goes in `extension.ts`
5. Test on multiple platforms or at minimum verify no platform-specific APIs are used without guards
6. Update `USER.md` with any user-visible changes
