# VSCommander -- User Guide

## What Is It

A dual-panel file manager inside your VS Code editor, styled after Far Manager. It opens as an editor tab with the file manager panel shown by default. Toggle the panel off with `Ctrl+O` to use the underlying shell, toggle it back on to browse files. Your shell session stays intact underneath.

## Getting Started

1. Press `Alt+C` to open VSCommander (configurable in VS Code keyboard shortcuts)
2. Or: click the VSCommander icon in the activity bar (left sidebar), then click **Open VSCommander**
3. Or: open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **VSCommander: Open Terminal**
4. The file manager panel opens in an editor tab with your default shell running underneath
5. Press `Ctrl+O` to toggle between the file manager panel and the shell

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
- **Function key bar**: F1-F10 labels at the very bottom (F10 quits VSCommander)

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `Ctrl+O` | Terminal focused | Toggle file manager panel on/off |
| `Alt+Enter` | Terminal focused | Detach to fullscreen window / reattach to editor |

### Inside the Panel

All panel shortcuts below show their default key bindings. Every action can be remapped via settings (see [Key Binding Settings](#key-binding-settings)).

| Key | Action |
|-----|--------|
| `Up` / `Down` | Move cursor through file list |
| `Left` / `Right` | Move cursor between columns; scrolls by one column at edges |
| `PgUp` / `PgDn` | Scroll all columns by one full page, keeping visual cursor position |
| `Home` | Jump to first entry |
| `End` | Jump to last entry |
| `Tab` | Switch between left and right pane |
| `Enter` | Open selected directory / open file in editor / execute command if text is entered |
| `F3` | View -- highlight file in VS Code Explorer; open in system file manager if outside workspace |
| `F4` | Open selected file in VS Code editor |
| `F5` | Copy selected file(s) to the other pane |
| `F6` | Move or rename selected file(s) |
| `F7` | Open Make Folder dialog |
| `F8` | Delete selected file or folder (moves to Recycle Bin / Trash on Windows and macOS; permanently deletes on Linux and FreeBSD) |
| `Shift+F8` | Permanently delete selected file or folder (bypasses Recycle Bin / Trash on all platforms) |
| `F9` | Open top menu bar (Left / Files / Commands / Options / Right) |
| `F10` | Quit VSCommander (with confirmation) |
| `Ctrl+H` | Toggle dotfile (hidden file) visibility |
| `Ctrl+P` | Toggle visibility of inactive pane (shows terminal beneath) |
| `Ctrl+R` | Re-read the active pane's directory |
| `Ctrl+U` | Swap left and right pane directories |
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Set active pane to 1, 2, or 3 columns |
| `Ctrl+Left` / `Ctrl+Right` | Move the border between left and right panes |
| Printable keys | Type into the command line at the bottom |
| `Backspace` | Delete character from command line |
| `Alt+F1` | Open Change Drive popup for the left pane |
| `Alt+F2` | Open Change Drive popup for the right pane |
| `Insert` | Toggle selection on current file and move cursor down |
| `Alt+<letter>` | Open quick search popup and jump to first matching entry |

## File Selection

Press `Insert` to toggle selection on the current file and move the cursor down. Selected files are shown in **bright yellow** text. The `..` entry cannot be selected.

| Key | Action |
|-----|--------|
| `Insert` | Toggle selection on current file and move cursor down |
| `Numpad *` | Invert selection (toggle all files) |
| `Numpad +` | Select all files |
| `Numpad -` | Deselect all files |

- Selection is per-pane and cleared when changing directories
- When files are selected, the bottom border shows the total size and count of selected files instead of the usual directory statistics
- Selected files are used by Copy (F5) and Move (F6) operations: when files are selected, the operation applies to all selected files instead of just the cursor file

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

## Copy (F5)

Press `F5` to copy the selected file or files to the opposite pane's directory. If files are selected (via `Insert`), all selected files are copied; otherwise the file under the cursor is copied.

The Copy dialog shows:

- **Target path**: Pre-filled with the other pane's directory. Edit to copy elsewhere.
- **If file exists**: Dropdown with `Ask`, `Overwrite`, or `Skip`. When set to `Ask`, a confirmation dialog appears for each conflicting file.
- **Copy** / **Cancel** buttons

Directories are copied recursively. A progress notification shows in VS Code during the operation.

## Move / Rename (F6)

Press `F6` to move or rename the selected file(s). Works the same as Copy but moves files instead. When the source and destination are on the same filesystem, the operation is instant (rename). For cross-filesystem moves, files are copied then deleted.

If the target path is the same directory with a different name, this acts as a rename.

## Make Folder (F7)

Press `F7` to open the Make Folder dialog. The dialog appears centered on the screen with the following fields:

- **Folder name**: Type the name of the new folder to create in the active pane's current directory. Intermediate directories are created automatically (e.g. `a/b/c` creates all three levels).
- **Link type**: Cycle through `none`, `symbolic`, and `junction` (Windows only) with Space or arrow keys. When set to `symbolic` or `junction`, a symbolic link or junction is created instead of a regular directory.
- **Target**: When link type is not `none`, enter the target path for the link.
- **Process multiple names**: Check this box (Space to toggle) to create multiple folders at once by separating names with semicolons (e.g. `src;lib;docs`).

Navigation within the dialog:

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Move focus between controls |
| `Up` / `Down` | Move focus between controls (when not consumed by the focused control) |
| `Space` | Toggle checkbox / cycle dropdown |
| `Enter` | Confirm (OK) from any field; on Cancel button, cancels |
| `Escape` | Cancel and close |
| Arrow keys | Navigate within input fields (Left/Right) or cycle dropdown options |

After confirming, the folder is created and the cursor moves to the newly created entry. Both panes are refreshed to reflect the change.

## Top Menu Bar (F9)

Press `F9` to open the top menu bar. The menu bar replaces the top border row and displays five menus: **Left**, **Files**, **Commands**, **Options**, **Right**.

### Menu Bar Navigation

| Key | Action |
|-----|--------|
| `Left` / `Right` | Move between menu items |
| `Enter` / `Down` | Open the dropdown for the selected menu |
| `Escape` | Close the menu bar (or close the dropdown and return to the bar) |
| `Home` / `End` | Jump to first / last menu item |
| Hotkey letter | Open the menu whose highlighted letter matches (e.g. `L` for Left) |

### Dropdown Navigation

| Key | Action |
|-----|--------|
| `Up` / `Down` | Move between dropdown items |
| `Left` / `Right` | Switch to adjacent menu (keeps dropdown open) |
| `Enter` | Activate the selected item |
| `Escape` | Close the dropdown (returns to menu bar) |
| `Home` / `End` | Jump to first / last item |
| Hotkey letter | Activate the item whose highlighted letter matches |

### Left / Right Menus

These menus control the corresponding pane's display and sorting:

| Item | Shortcut | Description |
|------|----------|-------------|
| Brief | Ctrl+1 | 1-column file list |
| Medium | Ctrl+2 | 2-column file list (default) |
| Full | Ctrl+3 | 3-column file list |
| Sort by name | | Sort entries alphabetically by name |
| Sort by extension | | Sort entries by file extension, then name |
| Sort by size | | Sort entries by file size |
| Sort by date | | Sort entries by modification date (newest first) |
| Unsorted | | Display entries in filesystem order |
| Show dotfiles | Ctrl+H | Toggle visibility of hidden files |
| Re-read | Ctrl+R | Refresh the directory listing |
| Change drive | Alt+F1/F2 | Open the Change Drive popup |

Active options show a checkmark. Column count and sort mode are per-pane.

### Files Menu

| Item | Shortcut | Description |
|------|----------|-------------|
| View | F3 | Highlight file in VS Code Explorer |
| Edit | F4 | Open file in VS Code editor |
| Copy | F5 | Copy file (not yet implemented) |
| Rename or move | F6 | Rename or move file (not yet implemented) |
| Make folder | F7 | Open the Make Folder dialog |
| Delete | F8 | Delete selected file or folder |

### Commands Menu

| Item | Shortcut | Description |
|------|----------|-------------|
| Swap panels | Ctrl+U | Swap left and right pane directories |
| Panels On/Off | Ctrl+O | Toggle the panel overlay |

### Options Menu

| Item | Description |
|------|-------------|
| Panel settings | Open VS Code settings filtered to VSCommander |

### Mouse in the Menu

- Click a menu bar item to select or toggle its dropdown
- Click a dropdown item to activate it
- Click outside the menu to close it
- Scroll wheel moves through dropdown items

## Multi-Column Display

Each pane can display 1, 2, or 3 columns of files. The default is 2 columns. Files fill columns top-to-bottom, then left-to-right (newspaper style).

Change the column count via the `vscommander.panelColumns` setting. Inner columns are separated by thin vertical lines, with junction characters at the separator row.

## Function Key Bar

The bottom row shows function key labels styled after Far Manager. Labels update dynamically when key bindings are remapped (see [Key Binding Settings](#key-binding-settings)):

| Key | Label | Status |
|-----|-------|--------|
| F1 | Help | Label only (future) |
| F2 | Menu | Label only (future) |
| F3 | View | Highlights file in VS Code Explorer; opens in system file manager if outside workspace |
| F4 | Edit | Opens selected file in VS Code editor |
| F5 | Copy | Copies selected file(s) to the opposite pane with a target path dialog |
| F6 | Move | Moves or renames selected file(s) with a target path dialog |
| F7 | Mkdir | Opens the Make Folder dialog to create directories or symbolic links |
| F8 | Del | Moves to Recycle Bin / Trash (Windows, macOS) or permanently deletes (Linux, FreeBSD) with confirmation |
| F9 | Conf | Opens the top menu bar with Left, Files, Commands, Options, Right menus |
| F10 | Quit | Quits VSCommander (with confirmation) |

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

Press Enter to execute a typed command. The panel automatically hides to show the full terminal output while the command runs, then reappears with refreshed directory listings once the command finishes. This lets you see the complete output of your commands and ensures the panel reflects any filesystem changes (created files, deleted folders, etc.). If you press `Ctrl+O` while a command is still running, the panel appears with the file listings as usual, but the command line row shows an animated spinner indicating the command is in progress. Press `Ctrl+O` again to dismiss the panel and return to the terminal. When the command finishes while the panel is showing, the command line returns to its normal shell prompt view. When the command line is empty, pressing Enter opens the selected directory as usual.

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

### Key Binding Settings

Every panel action can be remapped to a different key. Valid key names include `F1`-`F10`, `Shift+F1`-`Shift+F10`, `Alt+F1`-`Alt+F10`, `Ctrl+H`, `Ctrl+P`, `Alt+Enter`, `Ctrl+Left`, `Ctrl+Right`, `Shift+Delete`.

| Setting | Type | Default | Action |
|---------|------|---------|--------|
| `vscommander.keyView` | string | `F3` | View (reveal file in Explorer) |
| `vscommander.keyEdit` | string | `F4` | Edit (open file in editor) |
| `vscommander.keyCopy` | string | `F5` | Copy (copy files) |
| `vscommander.keyMove` | string | `F6` | Move/Rename (move or rename files) |
| `vscommander.keyMkdir` | string | `F7` | Mkdir (create directory) |
| `vscommander.keyDelete` | string | `F8` | Delete (move to Trash) |
| `vscommander.keyForceDelete` | string | `Shift+F8` | Permanent delete (bypass Trash) |
| `vscommander.keyQuit` | string | `F10` | Quit VSCommander |
| `vscommander.keyMenu` | string | `F9` | Open top menu bar |
| `vscommander.keyDriveLeft` | string | `Alt+F1` | Change Drive popup (left pane) |
| `vscommander.keyDriveRight` | string | `Alt+F2` | Change Drive popup (right pane) |
| `vscommander.keyToggleDotfiles` | string | `Ctrl+H` | Toggle dotfile visibility |
| `vscommander.keyTogglePane` | string | `Ctrl+P` | Toggle inactive pane visibility |
| `vscommander.keyDetach` | string | `Alt+Enter` | Detach/attach fullscreen window |
| `vscommander.keyResizeLeft` | string | `Ctrl+Left` | Move pane border left |
| `vscommander.keyResizeRight` | string | `Ctrl+Right` | Move pane border right |

When an action is bound to an F-key (F1-F10), its label appears in the function key bar at the corresponding position.

## Mouse

Mouse tracking is enabled while the panel is visible and disabled when you switch to the shell, so normal text selection works outside the panel.

| Action | Effect |
|--------|--------|
| Left-click on a file entry | Moves cursor to that entry; clicking the inactive pane switches focus to it |
| Double-click on a file entry | Opens the directory or file (same as Enter) |
| Click and drag in file area | Cursor follows the mouse as you drag |
| Left-click on the F-key bar | Triggers the corresponding function key action |
| Left-click on popup buttons | Activates the clicked button (Confirm, Cancel, OK, etc.) |
| Left-click on popup controls | Focuses the clicked field (Make Folder dialog) |
| Drag popup by body area | Moves the popup around the screen |
| Left-click outside a popup | Closes the popup |
| Scroll wheel | Moves cursor up/down by 3 entries; scrolls the Drive popup list when open |
| Middle-click | Acts as Enter (open directory, open file, or execute command) |

## Supported Platforms

Linux, FreeBSD, macOS, and Windows.
