# VSCommander

The missing yet essential cross-platform dual-panel file manager for Visual Studio Code, heavily inspired by [Far Manager](https://www.farmanager.com/), [Volkov Commander](https://vc.vvv.kyiv.ua/) and [Norton Commander](https://en.wikipedia.org/wiki/Norton_Commander). It runs as a terminal overlay: your shell stays alive underneath, and you toggle the file panel on and off with `Ctrl+O`.

Previously, a powerful editor was an extension to dual panel file manager. VSCommander is exactly the opposite.

The goal of the project - to preserve the natural look and feel of File Manager while extending its functionality when plactical, and adding support of modern *nix and Windows-compatible operating systems in mind.

<img src="/demo/vscommander.gif?raw=true" width="200px">

The project is a work in progress and not published to the marketplace yet.

## Features

- **Dual-pane browsing**: two independent directory panels side by side
- **Real terminal underneath**: not a webview; the shell session persists when the panel is hidden
- **Quick search**: press `Alt` + any letter to jump to matching files instantly
- **Drive / mount popup**: `Alt+F1` / `Alt+F2` to switch drives (Windows) or mounted filesystems (Linux, macOS, FreeBSD)
- **Half-panel mode**: `Ctrl+P` hides one pane to show recent terminal output alongside your files
- **Multi-column layout**: 1, 2, or 3 file columns per pane (configurable)
- **Function key bar**: F3 View, F4 Edit, F8 Delete, F10 Quit, and more
- **Cross-platform**: Linux, FreeBSD, macOS, and Windows

## Getting Started

### Prerequisites

- [Visual Studio Code](https://code.visualstudio.com/) 1.80 or later
- [Node.js](https://nodejs.org/) (for building from source)

### Install from Source

```bash
git clone https://github.com/vmisoft/vscommander.git
cd vscommander
npm install
npm run compile
```

Then press **F5** in VS Code to launch the Extension Development Host.

### Usage

1. Open the Command Palette (`Ctrl+Shift+P`) and run **VSCommander: Open Terminal**
2. The dual-panel file manager appears in a terminal tab
3. Press `Ctrl+O` to toggle the panel off and use the shell, then again to bring it back

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+O` | Toggle file manager panel on/off |
| `Tab` | Switch between left and right pane |
| `Enter` | Open directory / open file in editor |
| `Up` / `Down` | Navigate file list |
| `PgUp` / `PgDn` | Scroll by page |
| `Home` / `End` | Jump to first / last entry |
| `Alt+letter` | Quick search |
| `Alt+F1` / `Alt+F2` | Change drive popup (left / right pane) |
| `Ctrl+H` | Toggle dotfile visibility |
| `Ctrl+P` | Half-panel mode (show terminal in one pane) |
| `Ctrl+Left` / `Ctrl+Right` | Resize panes |
| `F3` | View -- highlight file in VS Code Explorer |
| `F4` | Edit -- open file in VS Code editor |
| `F8` | Delete selected file or folder |
| `F10` | Close panel and return to shell |
| `Alt+Enter` | Detach to fullscreen / reattach |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vscommander.showDotfiles` | `true` | Show hidden files (dotfiles) |
| `vscommander.clock` | `true` | Show clock in the top-right corner |
| `vscommander.panelColumns` | `2` | File columns per pane (1, 2, or 3) |

## License

MIT
