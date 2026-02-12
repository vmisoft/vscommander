![VSCommander Screenshot](/media/icon-color.svg)

# VSCommander

The missing yet essential cross-platform dual-panel file manager for Visual Studio Code, heavily inspired by [Far Manager](https://www.farmanager.com/), [Volkov Commander](https://vc.vvv.kyiv.ua/) and [Norton Commander](https://en.wikipedia.org/wiki/Norton_Commander). It runs as a terminal overlay: your shell stays alive underneath, and you toggle the file panel on and off with `Ctrl+O`.

Previously, a powerful editor was an extension to dual panel file manager. VSCommander is exactly the opposite.

The goal of the project - to preserve the natural look and feel of File Manager while extending its functionality when plactical, and adding support of modern *nix and Windows-compatible operating systems in mind.

![VSCommander Screenshot](https://raw.githubusercontent.com/vmisoft/vscommander/refs/heads/master/demo/screenshot.png)


The project is a work in progress and not published to the marketplace yet.

## Features

- **Dual-pane browsing**: two independent directory panels side by side
- **Real terminal underneath**: not a webview; the shell session persists when the panel is hidden
- **Quick search**: press `Alt` + any letter to jump to matching files instantly
- **Drive / mount popup**: `Alt+F1` / `Alt+F2` to switch drives (Windows) or mounted filesystems (Linux, macOS, FreeBSD)
- **Half-panel mode**: `Ctrl+P` hides one pane to show recent terminal output alongside your files
- **Multi-column layout**: 1, 2, or 3 file columns per pane (configurable)
- **Top menu bar**: F9 opens a Far Manager-style menu with Left, Files, Commands, Options, Right menus for sorting, column layout, and all panel operations
- **Sorting**: Sort each pane independently by name, extension, size, date, or unsorted
- **File operations**: F5 Copy, F6 Move/Rename with overwrite handling and progress display
- **File selection**: Insert to toggle selection, batch operations on selected files
- **Function key bar**: F3 View, F4 Edit, F5 Copy, F6 Move, F7 Mkdir, F8 Delete, F9 Config, F10 Quit
- **Mouse support**: click to select files, switch panes, activate popup buttons, scroll with the wheel
- **Configurable key bindings**: remap any panel action to a different key via settings
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
| `F5` | Copy files to other pane |
| `F6` | Move / rename files |
| `F7` | Make folder -- create directories or symbolic links |
| `F8` | Delete selected file or folder |
| `F9` | Open top menu bar (Left / Files / Commands / Options / Right) |
| `F10` | Close panel and return to shell |
| `Alt+Enter` | Detach to fullscreen / reattach |

![VSCommander Demo](https://raw.githubusercontent.com/vmisoft/vscommander/refs/heads/master/demo/vscommander.gif)

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vscommander.showDotfiles` | `true` | Show hidden files (dotfiles) |
| `vscommander.clock` | `true` | Show clock in the top-right corner |
| `vscommander.panelColumns` | `2` | File columns per pane (1, 2, or 3) |
| `vscommander.keyView` | `F3` | Key binding for View |
| `vscommander.keyEdit` | `F4` | Key binding for Edit |
| `vscommander.keyCopy` | `F5` | Key binding for Copy |
| `vscommander.keyMove` | `F6` | Key binding for Move/Rename |
| `vscommander.keyMkdir` | `F7` | Key binding for Mkdir |
| `vscommander.keyDelete` | `F8` | Key binding for Delete |
| `vscommander.keyMenu` | `F9` | Key binding for Menu |
| `vscommander.keyQuit` | `F10` | Key binding for Quit |
| `vscommander.key*` | -- | All panel actions are remappable (see USER.md) |

## License

MIT

