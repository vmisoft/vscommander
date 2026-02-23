# VSCommander -- User Guide

## What Is It

A dual-panel file manager inside your VS Code editor, styled after Far Manager. It opens as an editor tab with the file manager panel shown by default. Toggle the panel off with `Ctrl+O` to use the underlying shell, toggle it back on to browse files. Your shell session stays intact underneath.

## Built-in Help

Press `F1` while the panel is open to access the built-in help system. It shows a table of contents with all help topics -- navigate with arrow keys, press Enter to read a topic, Tab/Shift+Tab to jump between links, Backspace to go back, Escape to close.

The help content is also available as markdown files in the [`docs/`](docs/) folder.

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
╚══ Bytes: 45,678, files: 12, dirs: 3 ╝╚══ Bytes: 1,234, files: 5, dirs: 2 ╝  <- bottom borders
$ ls -la                                                <- command line
 1Help 2Menu 3View 4Edit 5Copy 6Move 7Mkdir 8Del  9Conf 10Quit  <- function key bar
```

- **Top border**: Double-line frame with the pane's directory path centered; clock (HH:MM) in the right pane's top border
- **Column headers**: "Name" centered in each inner column
- **File listing**: Files displayed in multiple columns (1, 2, or 3 per pane — configurable). Files flow top-to-bottom, then left-to-right (newspaper style). Directories shown in blue+bold, dotfiles in dim gray, regular files in aqua. Symbolic links display a yellow right-arrow indicator (`→`) in the rightmost character of their column
- **Separator**: Single-line horizontal separator between the file list and info bar, with junctions at inner column dividers
- **Info bar**: Each pane shows its selected file's name, size (or `<DIR>` for directories), and modification date
- **Bottom border**: Each pane shows its own summary stats (total bytes, file count, directory count)
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
| `Enter` | Open selected directory / enter archive / open file in editor / execute command if text is entered |
| `F1` | Open built-in help system |
| `F2` | Open User Menu (configurable shell commands) |
| `F3` | Open internal file viewer (text/hex modes, search, encoding) |
| `F4` | Open selected file in VS Code editor |
| `F5` | Copy selected file(s) to the other pane |
| `F6` | Move or rename selected file(s) |
| `F7` | Open Make Directory dialog |
| `F8` | Delete selected file or directory (moves to Recycle Bin / Trash on Windows and macOS; permanently deletes on Linux and FreeBSD) |
| `Shift+F8` | Permanently delete selected file or directory (bypasses Recycle Bin / Trash on all platforms) |
| `F9` | Open top menu bar (Left / Files / Commands / Options / Right) |
| `F10` | Quit VSCommander (with confirmation) |
| `Ctrl+H` | Toggle dotfile (hidden file) visibility |
| `Ctrl+P` | Toggle visibility of inactive pane (shows terminal beneath) |
| `Ctrl+Q` | Quick View -- preview file or directory under cursor in the inactive pane |
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
| `Ctrl+F3`..`Ctrl+F11` | Direct sort mode shortcuts (Name, Extension, Date, Size, Unsorted, Creation, Access, Description, Owner) |
| `Ctrl+F12` | Open Sort Modes popup |

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

## User Menu (F2)

Press `F2` to open the User Menu -- a configurable list of shell commands with hotkey navigation. The menu is stored in VS Code settings at user-level and workspace-level scopes.

### Menu display

Each item shows: hotkey, label, `>>` for submenus, and `(u)` or `(w)` to indicate whether it comes from User or Workspace settings.

### Navigation

| Key | Action |
|-----|--------|
| `Up` / `Down` | Navigate items (wraps around) |
| `Home` / `End` | Jump to first/last item |
| `Enter` | Execute command or enter submenu |
| `Right` | Enter submenu |
| `Left` | Pop back from submenu |
| `Escape` | Close menu (or pop submenu) |
| Hotkey character | Jump to item and execute |
| `Shift+F2` | Cycle view filter: All -> User only -> Workspace only -> All |

### In-menu editing

| Key | Action |
|-----|--------|
| `Insert` | Create new item (choose Command or Submenu) |
| `F4` | Edit current item |
| `Delete` | Delete current item (with confirmation) |
| `Ctrl+Up` | Move item up |
| `Ctrl+Down` | Move item down |

The edit form allows setting the hotkey, label, command lines (for commands), and scope (User or Workspace). Changes are saved to VS Code settings immediately.

### Variable substitution

Commands support variable substitution using `!` tokens:

| Token | Meaning |
|-------|---------|
| `!.!` | Current filename with extension |
| `!.` | Filename without extension |
| `` !` `` | Extension only (no dot) |
| `!\` | Current directory + trailing path separator |
| `!#` | Passive panel filename |
| `!#\` | Passive panel directory + trailing separator |
| `!&` | Selected files, space-separated, double-quoted |
| `!?title?init!` | Interactive prompt (asks for input before execution) |
| `!!` | Literal `!` |

### Example configuration

Add to your VS Code settings (User or Workspace):

```json
"vscommander.userMenu": [
    { "hotkey": "a", "label": "Compile current file", "commands": ["gcc -o !. !.!"] },
    { "hotkey": "b", "label": "Run program", "commands": ["./!."] },
    { "hotkey": "s", "label": "Git status", "commands": ["git status"] }
]
```

## Change Drive

Press `Alt+F1` to open the Change Drive popup for the left pane, or `Alt+F2` for the right pane. The popup lists available drives or mounted filesystems depending on your platform:

- **Windows**: Lists disk drives sorted alphabetically (C:, D:, etc.) with type (fixed, removable, network, cdrom), total size, and free space
- **macOS**: Lists volumes from `/Volumes/` with their actual volume labels (e.g., "Macintosh HD", "exssd") plus total and free space. The root volume appears first, followed by other volumes alphabetically
- **Linux / FreeBSD**: Lists mounted filesystems from `df`, filtering out virtual filesystems (tmpfs, proc, sysfs, etc.). The root filesystem `/` appears first, followed by `/mnt/*` mount points, then the rest alphabetically. Mount points with spaces in their names are supported

Below the drives, a **Home directories** section lists the Home directory itself followed by well-known subdirectories (Desktop, Documents, Downloads, Movies, Music, Pictures, Public) -- only those that actually exist. This section is refreshed each time the popup is opened.

If you have a workspace directory open in VS Code, it appears at the bottom of the list as a "VSCode Explorer" entry (showing the directory name on the right) for quick navigation. The VSCode Explorer entry always has the hotkey `0`.

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

Directories are copied recursively. Before copying begins, a scanning dialog appears showing the current folder being scanned, the number of files found, and the total size in bytes. Once scanning completes, a progress dialog appears on the panel showing the source and destination paths, a per-file progress bar, file count, and overall progress bar. Press `Esc` to cancel during either phase.

If an individual file or directory fails to copy, an error dialog appears with the error message and the full source path (truncated to fit the screen). Four options are available: **Retry** (attempt the operation again), **Skip** (skip the failed item and continue), **Navigate** (abort the copy and navigate the active panel to the problematic file), or **Cancel** (abort the entire copy). Press `Esc` on the error dialog to cancel.

### Symlink Handling

When copying or moving directories that contain symbolic links, VSCommander preserves symlinks as symlinks rather than copying their target content. During the scan phase, symlinks whose targets resolve to a location inside the copied tree are detected as "internal" symlinks.

If internal symlinks are found, a **Softlinks** dialog appears after scanning with four options:

| Button | Behavior |
|--------|----------|
| **Target** (default) | Remap internal symlinks so they point to the corresponding location in the destination tree. External relative symlinks are recalculated from the new location (or converted to absolute if on a different drive). External absolute symlinks are kept as-is. |
| **No change** | Copy every symlink's raw link value verbatim, without any adjustment. |
| **Source** | Internal symlinks become absolute paths pointing back to the original source tree. External symlinks are kept as-is. |
| **Ask** | Prompt for each symlink individually with the same Target / No change / Source / Cancel choices. |

Press `Esc` on the policy dialog to cancel the entire operation.

When no internal symlinks are detected, the "Target" policy is applied silently -- all symlinks are still preserved as symlinks with external relative paths recalculated from the new location.

## Move / Rename (F6)

Press `F6` to move or rename the selected file(s). Works the same as Copy but moves files instead. When the source and destination are on the same filesystem, the operation is instant (rename). For cross-filesystem moves, files are copied then deleted. The same scanning and progress dialogs appear during the operation; press `Esc` to cancel.

If the target path is the same directory with a different name, this acts as a rename.

## Make Directory (F7)

Press `F7` to open the Make Directory dialog. The dialog appears centered on the screen with the following fields:

- **Directory name**: Type the name of the new directory to create in the active pane's current directory. Intermediate directories are created automatically (e.g. `a/b/c` creates all three levels).
- **Link type**: Cycle through `none`, `symbolic`, and `junction` (Windows only) with Space or arrow keys. When set to `symbolic` or `junction`, a symbolic link or junction is created instead of a regular directory.
- **Target**: When link type is not `none`, enter the target path for the link.
- **Process multiple names**: Check this box (Space to toggle) to create multiple directories at once by separating names with semicolons (e.g. `src;lib;docs`).

Navigation within the dialog:

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Move focus between controls |
| `Up` / `Down` | Move focus between controls (when not consumed by the focused control) |
| `Space` | Toggle checkbox / cycle dropdown |
| `Enter` | Confirm (OK) from any field; on Cancel button, cancels |
| `Escape` | Cancel and close |
| Arrow keys | Navigate within input fields (Left/Right) or cycle dropdown options |

After confirming, the directory is created and the cursor moves to the newly created entry. Both panes are refreshed to reflect the change.

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
| Sort modes | Ctrl+F12 | Open the Sort Modes popup (see below) |
| Show dotfiles | Ctrl+H | Toggle visibility of hidden files |
| Re-read | Ctrl+R | Refresh the directory listing |
| Change drive | Alt+F1/F2 | Open the Change Drive popup |

Active options show a checkmark. Column count and sort mode are per-pane.

### Sort Modes Popup

Open from the Left/Right panel menu (**Sort modes**) or press `Ctrl+F12`. The popup lists all available sort modes with a checkmark next to the active one. Select a mode and press Enter to apply it to the active pane.

| Sort Mode | Shortcut | Description |
|-----------|----------|-------------|
| Name | Ctrl+F3 | Sort alphabetically by name |
| Extension | Ctrl+F4 | Sort by file extension, then name |
| Write time | Ctrl+F5 | Sort by modification date (newest first) |
| Size | Ctrl+F6 | Sort by file size |
| Unsorted | Ctrl+F7 | Display entries in filesystem order |
| Creation time | Ctrl+F8 | Sort by creation time (newest first) |
| Access time | Ctrl+F9 | Sort by last access time (newest first) |
| Change time | | Sort by status change time (newest first) |
| Description | Ctrl+F10 | Sort by file descriptions (see below) |
| Owner | Ctrl+F11 | Sort by owner UID |
| Allocated size | | Sort by allocated disk blocks |
| Hard links | | Sort by hard link count (most first) |
| Streams count | | Sort by NTFS alternate data stream count (Windows only) |
| Streams size | | Sort by NTFS alternate data stream total size (Windows only) |

Below the sort modes, three toggles control sorting behavior:

| Toggle | Shortcut | Description |
|--------|----------|-------------|
| Use sort groups | Shift+F11 | Group files by custom patterns with assigned priorities |
| Show selected first | Shift+F12 | Move selected files to the top of the list |
| Show directories first | | Group directories before files regardless of sort order |

**Sort direction**: The active sort mode is marked with `▲` (ascending) or `▼` (descending). Selecting the already-active mode toggles the direction. The same applies to the `Ctrl+F3`..`Ctrl+F11` shortcuts. The column header shows a lowercase letter for ascending (e.g. `n`) or uppercase for descending (e.g. `N`).

Navigation: `Up`/`Down` to move, `Enter` to select, `Escape` to cancel. Hotkey letters activate items directly.

### Files Menu

| Item | Shortcut | Description |
|------|----------|-------------|
| View | F3 | Open internal file viewer |
| Edit | F4 | Open file in VS Code editor |
| Copy | F5 | Copy file (not yet implemented) |
| Rename or move | F6 | Rename or move file (not yet implemented) |
| Make directory | F7 | Open the Make Directory dialog |
| Delete | F8 | Delete selected file or directory |

### Commands Menu

| Item | Shortcut | Description |
|------|----------|-------------|
| Swap panels | Ctrl+U | Swap left and right pane directories |
| Panels On/Off | Ctrl+O | Toggle the panel overlay |

### Options Menu

| Item | Description |
|------|-------------|
| All settings | Open VS Code settings filtered to VSCommander |
| Save settings | Persist all current in-memory settings to a chosen scope (User, Workspace, or Remote) |
| Delete settings | Remove persisted VSCommander settings from a chosen scope |
| Reset settings | Reset all in-memory settings to defaults for the current session (use Save settings to persist) |
| Change theme | Open the theme selection popup with live preview |
| Edit colors | Open the interactive color editor (see below) |
| Copy theme colors | Snapshot all current theme colors as explicit overrides |
| Reset colors | Remove all color overrides (disabled when no overrides exist) |

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
| F1 | Help | Opens built-in help system with topic navigation |
| F2 | Menu | Inactive (not yet implemented) |
| F3 | View | Open internal file viewer |
| F4 | Edit | Opens selected file in VS Code editor |
| F5 | Copy | Copies selected file(s) to the opposite pane with a target path dialog |
| F6 | Move | Moves or renames selected file(s) with a target path dialog |
| F7 | Mkdir | Opens the Make Directory dialog to create directories or symbolic links |
| F8 | Del | Moves to Recycle Bin / Trash (Windows, macOS) or permanently deletes (Linux, FreeBSD) with confirmation |
| F9 | Conf | Opens the top menu bar with Left, Files, Commands, Options, Right menus |
| F10 | Quit | Quits VSCommander (with confirmation) |

## Info Bar

Each pane has its own info bar (between the separator and bottom border) showing details about the currently selected file:

- **File name** on the left
- **Size** (formatted with commas, or `<DIR>` for directories) and **date** (YYYY-MM-DD) on the right
- **Symbolic links**: When the cursor is on a symlink, the info bar shows the link name followed by a yellow right-arrow (`→`) and the link target path. Long target paths are truncated with `...` to fit the available width. Directory symlinks show `<DIR>` for size; file symlinks show their target's actual size

## Dotfile Visibility

By default, dotfiles (hidden files starting with `.`) are shown. They appear in a dim gray color to distinguish them from regular files.

- Press `Ctrl+H` while the panel is open to toggle dotfile visibility for the current session
- Use the `vscommander.showDotfiles` setting to change the persistent default

## File Descriptions (Sort by Description)

When you sort by description (via F9 > Left/Right menu > Sort by description), VSCommander reads file descriptions from `descript.ion` files -- a classic format used by Far Manager, Norton Commander, and other file managers.

**How descriptions are loaded:**

1. **`descript.ion` file**: VSCommander looks for a `descript.ion` file in the current directory (case-insensitive search). Each line maps a filename to a description:
   ```
   readme.txt This is the project readme
   "file with spaces.doc" Important document
   ```
   - Filenames with spaces must be enclosed in double quotes
   - A leading numeric token (file size) after the filename is stripped per Far Manager convention
   - Lookup is case-insensitive

2. **README fallback**: For directories that have no `descript.ion` entry, VSCommander tries to read the first non-empty line from a README file inside that directory (`readme.txt`, `readme.md`, `README.txt`, `README.md`, or `README`, tried in that order).

**Info bar**: When sorting by description, the info bar shows the filename followed by the description text (truncated to fit) instead of the modification date.

Files without descriptions sort before files with descriptions (empty string sorts first), then alphabetically by name within the same description.

## Archive Navigation

VSCommander can browse archive files (ZIP, TAR, 7Z, RAR) as if they were directories, replicating the classic Far Manager archive plugin experience.

### Opening an Archive

Press `Enter` on an archive file to open it. The pane switches to archive browsing mode -- the top border shows the archive filename and current path within the archive (e.g. `archive.zip:src/lib`). Directory entries and files inside the archive are displayed exactly like a normal directory listing. Sorting and selection work as usual.

### Navigation Inside Archives

| Key | Action |
|-----|--------|
| `Enter` on a directory | Navigate into that directory within the archive |
| `Enter` on `..` | Go up one level within the archive; at the archive root, exit the archive |
| `Enter` on a file | Extract the file to a temp directory and open it in VS Code |
| `Ctrl+PageUp` | Go up one level within the archive; at the root, exit the archive |
| `Ctrl+PageDown` | Enter the selected directory within the archive |
| `F3` on a file | Extract to temp and view the file |
| `F4` on a file | Extract to temp and open the file in the editor |

### Exiting an Archive

Navigate up past the archive root (press `..` or `Ctrl+PageUp` when at the top level) to exit the archive and return to the filesystem directory containing the archive file. The cursor returns to the archive file.

### Extracting Files (F5)

Press `F5` while inside an archive to extract the selected files (or the file under the cursor) to the other pane's directory. The standard Copy dialog appears with the target path pre-filled. A progress bar shows extraction progress. Directories are extracted recursively with their full subtree.

### Adding Files to Archives (F5)

When the other pane is inside an archive and you press `F5`, the selected files from the filesystem are added to the archive at its current virtual directory. For read-only formats (TAR, RAR), an error message is shown.

### Deleting from Archives (F8)

Press `F8` while inside an archive to delete the selected entries. A confirmation dialog shows the entries to be deleted. Directories are deleted recursively with all their contents. For read-only formats (TAR, RAR), an error message is shown.

### Make Directory in Archives (F7)

Press `F7` while inside an archive to create a new empty directory entry. The standard Make Directory dialog appears (link options are ignored). For read-only formats (TAR, RAR), an error message is shown.

### Moving Files (F6)

Press `F6` while inside an archive to move (extract + delete) the selected entries to the other pane's directory. When the other pane is inside an archive and you press `F6`, the selected files are added to the archive and deleted from the filesystem. For read-only formats (TAR, RAR), an error message is shown.

### Supported Formats

| Format | Extensions | Write Support |
|--------|-----------|---------------|
| ZIP | `.zip`, `.jar`, `.war`, `.ear`, `.apk` | Full (add, delete, mkdir) |
| TAR | `.tar`, `.tar.gz`, `.tgz`, `.tar.bz2`, `.tbz2`, `.tar.xz`, `.txz` | Read only |
| 7-Zip | `.7z` | Add, delete, mkdir |
| RAR | `.rar` | Read only |

## Command Line

The bottom row of the panel (above the function key bar) shows a live view of your shell's current line. Keystrokes are forwarded to the shell in real time and the shell's output is rendered directly -- what you see is exactly what the shell produces, with no manual prompt tracking.

Press Enter to execute a typed command. The panel automatically hides to show the full terminal output while the command runs, then reappears with refreshed directory listings once the command finishes. This lets you see the complete output of your commands and ensures the panel reflects any filesystem changes (created files, deleted directories, etc.). If you press `Ctrl+O` while a command is still running, the panel appears with the file listings as usual, but the command line row shows an animated spinner indicating the command is in progress. Press `Ctrl+O` again to dismiss the panel and return to the terminal. When the command finishes while the panel is showing, the command line returns to its normal shell prompt view. When the command line is empty, pressing Enter opens the selected directory as usual.

## Half-Panel Mode (Ctrl+P)

Press `Ctrl+P` to hide the inactive pane and show recent terminal output in its place. This lets you see command output while keeping one file pane visible.

- The active pane stays in place; the inactive side shows terminal output with full color support (colored `ls`, syntax-highlighted output, etc.)
- The terminal area is borderless and fills the entire pane space for maximum visibility
- Press `Ctrl+P` again to restore both panes
- Pressing `Tab` to switch panes also swaps which side shows the terminal
- Use `Ctrl+O` to hide both panes and see the full terminal as before
- When you execute a command (type + Enter) in half-panel mode, the panel stays visible -- the terminal area shows command output live, and both file panes refresh when the command finishes
- The `cd` commands triggered by pane navigation are suppressed from the terminal area, keeping the output clean

## Quick View (Ctrl+Q)

Press `Ctrl+Q` to enter Quick View mode. The inactive pane is replaced with a Quick View panel that previews the file or directory under the cursor, rendered directly inside the terminal.

- **File preview**: When the cursor is on a file, the Quick View panel displays the file's text content. Reading is performed asynchronously to keep the interface responsive -- an animated spinner is shown while the file loads. Binary files are displayed with non-printable characters rendered as CP437/Windows-1252 glyphs, matching Far Manager's binary display
- **Directory info**: When the cursor is on a directory, the panel shows the folder path, link target (if the folder is a symbolic link), number of sub-directories, number of files, and total file size. A recursive scan runs asynchronously with an animated spinner; once complete, the status changes to "Scanning complete"
- **Scrolling**: Press `Tab` to move focus to the Quick View panel -- the panel title becomes active and the file pane cursor disappears. Use `Up`/`Down` to scroll vertically by one line, `PgUp`/`PgDn` or `Home`/`End` to scroll vertically by one page, `Left`/`Right` to scroll horizontally (text files) or vertically by one page (binary files), `Ctrl+Home`/`Ctrl+End` or `Ctrl+PgUp`/`Ctrl+PgDn` to jump to the file beginning or end. Press `Tab` again to return focus to the file pane
- When the cursor is on `..`, the last preview stays visible

Exiting Quick View:

| Key | Action |
|-----|--------|
| `Ctrl+Q` | Toggle Quick View off -- restores both panes |
| `Ctrl+O` | Exit Quick View, hide the panel entirely |
| `Enter` | On a file: exit Quick View, open file normally |

While in Quick View mode, `Ctrl+P` (toggle pane), `Ctrl+Left`, and `Ctrl+Right` (resize) are disabled. `Ctrl+U` (swap panels) exits Quick View first, then swaps.

## Internal File Viewer (F3)

Press `F3` on a file to open the internal viewer. The viewer takes over the full terminal screen with a title bar at the top, file content in the middle, and a function key bar at the bottom.

**Title bar** shows: filename, mode indicator (`t` for text, `h` for hex), encoding, file size, column position, and scroll percentage.

**Display modes**:
- **Text mode** (default): Displays file content with tab expansion (8 spaces). Use arrow keys and PgUp/PgDn to scroll. Overflow arrows (`<<` / `>>`) appear when content extends beyond the viewport.
- **Hex mode** (`F4`): Shows file bytes in hexadecimal with 16 bytes per line -- address, hex groups, and ASCII representation. Binary files automatically open in hex mode.
- **Wrap mode** (`F2`): Wraps long lines to fit the terminal width (text mode only).

**Navigation**:

| Key | Action |
|-----|--------|
| `Up` / `Down` | Scroll one line |
| `PgUp` / `PgDn` | Scroll one page |
| `Ctrl+Home` | Jump to file start |
| `Ctrl+End` | Jump to file end |
| `Home` | Reset horizontal scroll to column 0 |
| `End` | Scroll to end of longest visible line |
| `Left` / `Right` | Horizontal scroll (text mode, no-wrap only) |
| `Ctrl+Left` / `Ctrl+Right` | Horizontal scroll 20 characters |
| Mouse wheel | Scroll up/down |

**Actions**:

| Key | Action |
|-----|--------|
| `F2` | Toggle wrap mode |
| `F4` | Toggle hex mode |
| `F7` | Open search dialog |
| `Shift+F7` | Find next match |
| `Alt+F7` | Find previous match |
| `F8` | Cycle encoding (UTF-8 -> Latin-1 -> UTF-16LE -> UTF-8) |
| `F6` | Open file in VS Code editor |
| `F3` / `F10` / `Esc` | Close viewer |

**Search** (`F7`): Opens a search dialog with options for case sensitivity, whole words, regular expressions, and hex search. Use the `Prev` and `Next` buttons (or `Shift+F7` / `Alt+F7`) to navigate between matches. Found matches are highlighted in the content area.

**Encoding** (`F8`): Cycles through UTF-8, Latin-1, and UTF-16LE encodings. The file is re-read with the selected encoding. The current encoding is shown in the title bar and on the F8 key label.

**Large files**: The viewer reads files in 256KB chunks, loading more data as you scroll. This keeps the viewer responsive even for very large files.

## Fullscreen / Detach

Press `Alt+Enter` to detach the VSCommander terminal from the editor area into a separate fullscreen window. Press `Alt+Enter` again to exit fullscreen and reattach back to the editor area.

## Settings

Configure VSCommander in VS Code settings (`Ctrl+,` / `Cmd+,`):

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `vscommander.theme` | string | `"far"` | Color theme (see below) |
| `vscommander.showDotfiles` | boolean | `true` | Show dotfiles (hidden files) in the panel |
| `vscommander.clock` | boolean | `true` | Show clock (HH:MM) in the top-right corner |
| `vscommander.panelColumns` | number | `2` | Number of file columns per panel (1, 2, or 3) |
| `vscommander.windowsBackend` | string | `"winpty"` | Windows PTY backend: `"winpty"` (legacy, default) or `"conpty"` (Windows Pseudo Console). Ignored on other platforms. |

Settings are read from VS Code configuration when the panel is first opened. After that, all changes you make through the panel (theme, colors, dotfile visibility, etc.) are **in-memory only** -- they take effect immediately but do not survive a restart.

### Saving and Deleting Settings

To persist your current settings, use **F9 > Options > Save settings**. A popup lets you choose the scope:

- **User** -- saves to your global VS Code settings (available everywhere). When connected to a remote (SSH, WSL, etc.), this button shows as **Remote: \<name\>** and saves to the remote host's user settings.
- **Workspace** -- saves to the current workspace's `.vscode/settings.json`

To remove persisted settings, use **F9 > Options > Delete settings**. Scopes that have no VSCommander settings are shown as disabled (grayed out). Deleting settings from a scope removes all `vscommander.*` keys from that scope; your current in-memory settings remain active for the rest of the session.

### Color Theme

The `vscommander.theme` setting controls the panel's color scheme:

- **`"far"`** (default): Classic Far Manager theme -- cyan-on-dark-blue with teal accents. Hardcoded true-color values for a pixel-perfect retro look.
- **`"vscode"`**: Colors that match the active VS Code color theme. Uses ANSI standard color indices that VS Code's terminal resolves to the current theme's `terminal.ansi*` color tokens. Automatically adapts when you switch between dark and light themes, and works with any installed color theme (Dark+, Light+, Monokai, Solarized, etc.).

The panel redraws instantly when you change the setting or switch VS Code themes.

### Change Theme Popup

Open from **F9 > Options > Change theme**. The popup shows the available themes in a list on the left, with a live preview on the right. The preview displays a mock file panel, command line, function key bar, copy dialog, and a confirm dialog -- all rendered with the selected theme's colors. Use Up/Down to browse themes and see the preview update instantly.

The popup has four buttons:

- **OK** -- apply the selected theme and close
- **Edit** -- apply the selected theme and open the interactive color editor for fine-tuning
- **Reset** -- apply the selected theme and reset all color overrides to defaults (with confirmation)
- **Cancel** -- discard changes and close

### Color Overrides

Every visual element can be individually customized via `vscommander.colors.*` settings. Each setting is an object with optional properties:

- `fg` -- foreground color
- `bg` -- background color
- `bold` -- bold text (`true`/`false`)
- `selectedFg` -- foreground when cursor is on this element
- `selectedBg` -- background when cursor is on this element
- `selectedBold` -- bold when cursor is on this element

Color values can be hex strings (e.g. `ff0000` for red) or ANSI index notation (`@0`-`@15` for the 16 standard terminal colors, `@d` for the terminal's default foreground/background). Overrides are applied on top of the active base theme (`far` or `vscode`).

Example in `settings.json`:
```json
"vscommander.colors.directory": { "fg": "@4", "bold": true },
"vscommander.colors.border": { "fg": "@8" }
```

The settings are organized into groups in the VS Code settings UI: **Colors: Panel**, **Colors: Files**, **Colors: Command Line & Keys**, **Colors: Search**, **Colors: Drive Popup**, **Colors: Dialogs**, **Colors: Menu**. See the settings editor for the full list of elements.

### Interactive Color Editor

Open from **F9 > Options > Edit colors**. The color editor popup shows all 40 theme elements organized by group (Panel, Command Line, Search, Drive Popup, Dialogs, Menu) on the left, and a color palette with controls on the right.

**Layout:**
- **Left side**: Scrollable element list with group headers. The current element is highlighted with `>`.
- **Right side**: State toggle (Idle/Selected), 16-color ANSI palette grid for foreground and background, hex input fields for custom colors, bold checkbox, and a live sample preview.

**Navigation:**

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Cycle focus: list > state > fg grid > fg hex > bg grid > bg hex > bold > buttons |
| `Up` / `Down` | In element list: move cursor; in palette grid: navigate rows |
| `Left` / `Right` | In state: toggle idle/selected; in palette grid: navigate cells |
| `Space` | In bold checkbox: toggle; in palette grid: confirm selection |
| Arrow keys | In hex input: move cursor within input field |
| `Enter` | In list: jump to fg grid; in buttons: activate OK/Cancel |
| `Escape` | Cancel and close (no changes saved) |

**Palette grid**: Two rows of 8 color cells each, representing the 16 standard ANSI terminal colors. A "Df" (Default) option selects the terminal's default foreground/background. Selected cells are marked with `<>` when focused.

**Hex input**: Type a 6-digit hex color (e.g. `ff0000` for red) for custom colors beyond the 16-color palette. The hex value takes effect once all 6 digits are entered.

**Sample preview**: Shows "Sample text" rendered with the current foreground, background, and bold settings, updating as you make changes.

Press **OK** to apply all changes in memory. Press **Cancel** or **Escape** to discard. To persist color changes across restarts, use **F9 > Options > Save settings**.

**Copy theme colors** (F9 > Options) writes every current color as an explicit in-memory override, creating a snapshot you can then customize incrementally. **Reset colors** clears all overrides, returning to the base theme. Both operations are in-memory only; use **Save settings** to persist.

### Key Binding Settings

Every panel action can be remapped to a different key. Valid key names include `F1`-`F10`, `Shift+F1`-`Shift+F10`, `Alt+F1`-`Alt+F10`, `Ctrl+H`, `Ctrl+P`, `Alt+Enter`, `Ctrl+Left`, `Ctrl+Right`, `Shift+Delete`.

| Setting | Type | Default | Action |
|---------|------|---------|--------|
| `vscommander.keyHelp` | string | `F1` | Help (open help system) |
| `vscommander.keyView` | string | `F3` | Open internal file viewer |
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
| `vscommander.keyQuickView` | string | `Ctrl+Q` | Quick View (preview in inactive pane) |

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
| Left-click on popup controls | Focuses the clicked field (Make Directory dialog) |
| Drag popup by body area | Moves the popup around the screen |
| Left-click outside a popup | Closes the popup |
| Scroll wheel | Moves cursor up/down by 3 entries; scrolls the Drive popup list when open |
| Middle-click | Acts as Enter (open directory, open file, or execute command) |

## File Operation Errors

When a file operation fails, a popup appears with a human-readable error description and the affected path. The behavior depends on the operation:

### Directory Navigation Errors

When navigating into a directory that cannot be read, a popup appears explaining the error with an **OK** button.

### Delete Errors (F8 / Shift+F8)

When a file or directory cannot be deleted, an error popup appears with **Retry**, **Skip**, and **Cancel** buttons:

- **Retry**: Attempt the operation again (useful after fixing permissions or closing a locked file)
- **Skip**: Skip the failed item and continue deleting remaining files
- **Cancel**: Abort the entire delete operation

### Make Directory Errors (F7)

When a directory cannot be created, an error popup appears with **Retry**, **Skip**, and **Cancel** buttons. When creating multiple directories (semicolon-separated), Skip moves to the next name.

### Copy / Move Errors (F5 / F6)

When a file fails to copy or move, an error popup appears with **Retry**, **Skip**, **Navigate**, and **Cancel** buttons. Navigate aborts the operation and positions the cursor on the problematic file.

### macOS Privacy (TCC)

On macOS, when the system denies access (e.g. Desktop, Documents, Downloads), error popups include an additional **Manage privacy** button that opens System Settings > Privacy & Security > Files and Folders, where you can grant VS Code access. After toggling the permission, press Retry or `Ctrl+R` to refresh.

### Common Error Messages

| Error | Meaning |
|-------|---------|
| Permission denied | File permissions prevent the operation |
| File or directory not found | The path no longer exists |
| Already exists | A file or directory with that name already exists |
| No space left on device | The disk is full |
| Read-only file system | The filesystem is mounted read-only |
| Resource is busy or locked | Another process has the file open |
| Directory is not empty | Cannot remove a non-empty directory |
| Disk quota exceeded | Your disk quota has been reached |

## Supported Platforms

Linux, FreeBSD, macOS, and Windows.
