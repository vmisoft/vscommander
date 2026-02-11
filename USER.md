# VSCommander -- User Guide

## What Is It

A dual-panel file manager inside your VS Code editor, styled after Far Manager. It opens as an editor tab with the file manager panel shown by default. Toggle the panel off with `Ctrl+O` to use the underlying shell, toggle it back on to browse files. Your shell session stays intact underneath.

## Getting Started

1. Click the VSCommander icon in the activity bar (left sidebar), then click **Open VSCommander**
2. Or: open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **VSCommander: Open Terminal**
3. The file manager panel opens in an editor tab with your default shell running underneath
4. Press `Ctrl+O` to toggle between the file manager panel and the shell

## Panel Layout

Each pane is an independent box with its own borders, info bar, and stats:

```
╔══ left-path ══════════╗╔══ right-path ════ HH:MM ╗  <- top borders with paths and clock
║  Name  │  Name        ║║  Name  │  Name           ║  <- column headers
║ ..     │ file1.txt    ║║ ..     │ file1.txt       ║  <- file listing (2-col default)
║ src    │ package.json ║║ docs   │ README.md       ║     directories in blue, bold
║ .git   │ .env         ║║ lib    │ index.ts        ║     dotfiles in dim gray
║        │              ║║        │                  ║
╟────────┴──────────────╢╟────────┴─────────────────╢  <- separators
║ package.json  1,234  2025-05-14 ║║ README.md  567  2025-06-01 ║  <- info bars
╚══ Bytes: 45,678, files: 12, folders: 3 ╝╚══ Bytes: 1,234, files: 5, folders: 2 ╝  <- bottom borders
$ ls -la                                                <- command line
 1Help 2Menu 3View 4Edit 5Copy 6Move 7Mkdir 8Del  9Conf 10Quit  <- function key bar
```

- **Top border**: Double-line frame with the pane's directory path centered; clock (HH:MM) in the right pane's top border
- **Column headers**: "Name" centered in each inner column
- **File listing**: Files displayed in multiple columns (1, 2, or 3 per pane — configurable). Files flow top-to-bottom, then left-to-right (newspaper style). Directories shown in blue+bold, dotfiles in dim gray, regular files in aqua
- **Separator**: Single-line horizontal separator between the file list and info bar, with junctions at inner column dividers
- **Info bar**: Each pane shows its selected file's name, size (or `<DIR>` for directories), and modification date
- **Bottom border**: Each pane shows its own summary stats (total bytes, file count, folder count)
- **Command line**: Your shell prompt where you can type commands
- **Function key bar**: F1-F10 labels at the very bottom (F10 closes the panel)

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `Ctrl+O` | Terminal focused | Toggle file manager panel on/off |
| `Alt+Enter` | Terminal focused | Detach to fullscreen window / reattach to editor |

### Inside the Panel

| Key | Action |
|-----|--------|
| `Up` / `Down` | Move cursor through file list |
| `Left` / `Right` | Move cursor between columns; scrolls by one column at edges |
| `PgUp` / `PgDn` | Scroll all columns by one full page, keeping visual cursor position |
| `Home` | Jump to first entry |
| `End` | Jump to last entry |
| `Tab` | Switch between left and right pane |
| `Enter` | Open selected directory / open file in editor / execute command if text is entered |
| `F4` | Open selected file in VS Code editor |
| `F8` | Delete selected file or folder (moves to Recycle Bin / Trash on Windows and macOS; permanently deletes on Linux and FreeBSD) |
| `Shift+F8` / `Shift+Del` | Permanently delete selected file or folder (bypasses Recycle Bin / Trash on all platforms) |
| `F10` | Close panel and return to shell |
| `Ctrl+H` | Toggle dotfile (hidden file) visibility |
| `Ctrl+P` | Toggle visibility of inactive pane (shows terminal beneath) |
| `Ctrl+Left` / `Ctrl+Right` | Move the border between left and right panes |
| Printable keys | Type into the command line at the bottom |
| `Backspace` | Delete character from command line |
| `Alt+F1` | Open Change Drive popup for the left pane |
| `Alt+F2` | Open Change Drive popup for the right pane |
| `Alt+<letter>` | Open quick search popup and jump to first matching entry |

## Quick Search

Press `Alt` + any letter or number to open a search popup. The popup appears near the active pane's left border with a teal input box on a light grey background.

- The initial character is placed in the search box and the cursor jumps to the first matching entry (case-insensitive prefix match)
- Continue typing to narrow the search -- each additional character is accepted only if it extends a valid prefix match
- Press `Backspace` to remove the last character from the search
- Press `Escape` to close the popup and keep the cursor on the matched entry
- Press `Enter` to close the popup and act on the matched entry (enter directory or open file)
- Any navigation key (arrows, Tab, PgUp/PgDn) also closes the popup

## Change Drive

Press `Alt+F1` to open the Change Drive popup for the left pane, or `Alt+F2` for the right pane. The popup lists available drives or mounted filesystems depending on your platform:

- **Windows**: Lists disk drives sorted alphabetically (C:, D:, etc.) with type (fixed, removable, network, cdrom), total size, and free space
- **Linux / macOS / FreeBSD**: Lists mounted filesystems from `df`, filtering out virtual filesystems (tmpfs, proc, sysfs, etc.). The root filesystem `/` appears first, followed by `/mnt/*` mount points, then the rest alphabetically

Below the drives, a **Home directories** section lists well-known folders from your home directory (Desktop, Documents, Downloads, Movies, Music, Pictures, Public) -- only those that actually exist. This section is refreshed each time the popup is opened.

If you have a workspace folder open in VS Code, it appears at the bottom of the list as a "VSCode Explorer" entry (showing the folder name on the right) for quick navigation. The VSCode Explorer entry always has the hotkey `0`.

Navigation and selection:

| Key | Action |
|-----|--------|
| `Up` / `Down` | Move cursor through the list |
| `Left` / `Right` | Same as Up / Down |
| `Home` / `PgUp` | Jump to first entry |
| `End` / `PgDn` | Jump to last entry |
| `Enter` | Select the highlighted entry |
| `Escape` | Cancel and close |
| `1`-`9` | Quick-select a drive entry by its numbered prefix |
| `0` | Quick-select the VSCode Explorer entry |
| `a`-`z` | Quick-select additional entries by letter prefix; on Windows, also matches drive letter |

## Multi-Column Display

Each pane can display 1, 2, or 3 columns of files. The default is 2 columns. Files fill columns top-to-bottom, then left-to-right (newspaper style).

Change the column count via the `vscommander.panelColumns` setting. Inner columns are separated by thin vertical lines, with junction characters at the separator row.

## Function Key Bar

The bottom row shows function key labels styled after Far Manager:

| Key | Label | Status |
|-----|-------|--------|
| F1 | Help | Label only (future) |
| F2 | Menu | Label only (future) |
| F3 | View | Highlights file in VS Code Explorer (blinks 2x); opens in system file manager if outside workspace |
| F4 | Edit | Opens selected file in VS Code editor |
| F5 | Copy | Label only (future) |
| F6 | Move | Label only (future) |
| F7 | Mkdir | Label only (future) |
| F8 | Del | Moves to Recycle Bin / Trash (Windows, macOS) or permanently deletes (Linux, FreeBSD) with confirmation |
| F9 | Conf | Label only (future) |
| F10 | Quit | Closes the panel |

## Info Bar

Each pane has its own info bar (between the separator and bottom border) showing details about the currently selected file:

- **File name** on the left
- **Size** (formatted with commas, or `<DIR>` for directories) and **date** (YYYY-MM-DD) on the right

## Dotfile Visibility

By default, dotfiles (hidden files starting with `.`) are shown. They appear in a dim gray color to distinguish them from regular files.

- Press `Ctrl+H` while the panel is open to toggle dotfile visibility for the current session
- Use the `vscommander.showDotfiles` setting to change the persistent default

## Command Line

The bottom row of the panel (above the function key bar) shows a live view of your shell's current line. Keystrokes are forwarded to the shell in real time and the shell's output is rendered directly -- what you see is exactly what the shell produces, with no manual prompt tracking.

Press Enter to execute a typed command. When the command line is empty, pressing Enter opens the selected directory as usual.

## Half-Panel Mode (Ctrl+P)

Press `Ctrl+P` to hide the inactive pane and show recent terminal output in its place. This lets you see command output while keeping one file pane visible.

- The active pane stays in place; the inactive side shows a "Terminal" view with recent shell output
- Press `Ctrl+P` again to restore both panes
- Pressing `Tab` to switch panes also swaps which side shows the terminal
- Use `Ctrl+O` to hide both panes and see the full terminal as before

## Fullscreen / Detach

Press `Alt+Enter` to detach the VSCommander terminal from the editor area into a separate fullscreen window. Press `Alt+Enter` again to exit fullscreen and reattach back to the editor area.

## Settings

Configure VSCommander in VS Code settings (`Ctrl+,` / `Cmd+,`):

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `vscommander.showDotfiles` | boolean | `true` | Show dotfiles (hidden files) in the panel |
| `vscommander.clock` | boolean | `true` | Show clock (HH:MM) in the top-right corner |
| `vscommander.panelColumns` | number | `2` | Number of file columns per panel (1, 2, or 3) |

Settings are read each time the panel is opened. The `Ctrl+H` toggle overrides `showDotfiles` for the current session only.

## Supported Platforms

Linux, FreeBSD, macOS, and Windows.
