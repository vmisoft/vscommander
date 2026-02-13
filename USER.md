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
╚══ Bytes: 45,678, files: 12, dirs: 3 ╝╚══ Bytes: 1,234, files: 5, dirs: 2 ╝  <- bottom borders
$ ls -la                                                <- command line
 1Help 2Menu 3View 4Edit 5Copy 6Move 7Mkdir 8Del  9Conf 10Quit  <- function key bar
```

- **Top border**: Double-line frame with the pane's directory path centered; clock (HH:MM) in the right pane's top border
- **Column headers**: "Name" centered in each inner column
- **File listing**: Files displayed in multiple columns (1, 2, or 3 per pane — configurable). Files flow top-to-bottom, then left-to-right (newspaper style). Directories shown in blue+bold, dotfiles in dim gray, regular files in aqua
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
| `Enter` | Open selected directory / open file in editor / execute command if text is entered |
| `F3` | View -- highlight file in VS Code Explorer; open in system file manager if outside workspace |
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
| `Ctrl+Q` | Quick View -- preview file under cursor in a VS Code split editor |
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

Below the drives, a **Home directories** section lists well-known directories from your home directory (Desktop, Documents, Downloads, Movies, Music, Pictures, Public) -- only those that actually exist. This section is refreshed each time the popup is opened.

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

Directories are copied recursively. A progress notification shows in VS Code during the operation.

## Move / Rename (F6)

Press `F6` to move or rename the selected file(s). Works the same as Copy but moves files instead. When the source and destination are on the same filesystem, the operation is instant (rename). For cross-filesystem moves, files are copied then deleted.

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
| Panel settings | Open VS Code settings filtered to VSCommander |
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
| F1 | Help | Label only (future) |
| F2 | Menu | Label only (future) |
| F3 | View | Highlights file in VS Code Explorer; opens in system file manager if outside workspace |
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

## Dotfile Visibility

By default, dotfiles (hidden files starting with `.`) are shown. They appear in a dim gray color to distinguish them from regular files.

- Press `Ctrl+H` while the panel is open to toggle dotfile visibility for the current session
- Use the `vscommander.showDotfiles` setting to change the persistent default

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

Press `Ctrl+Q` to enter Quick View mode. The inactive pane disappears and the active pane expands to fill the terminal width, while a VS Code split editor opens on the opposite side to preview the file under the cursor.

- As you move the cursor through the file list, the split editor updates to show the currently highlighted file
- When the cursor is on a **directory**, the split editor shows directory information: full path, number of sub-directories, number of files, and total size. An animated spinner shows during the recursive scan, which runs asynchronously and updates the display when complete
- When the cursor is on `..`, the last preview stays visible
- VS Code handles all file types: text, images, binary (hex view), etc.

Exiting Quick View:

| Key | Action |
|-----|--------|
| `Ctrl+Q` | Toggle Quick View off -- restores both panes, closes split editor |
| `Tab` | Exit Quick View, switch to the other pane, close split editor |
| `Ctrl+O` | Exit Quick View, hide the panel entirely, close split editor |
| `Enter` | On a file: exit Quick View, close split, open file normally |

While in Quick View mode, `Ctrl+P` (toggle pane), `Ctrl+Left`, and `Ctrl+Right` (resize) are disabled. `Ctrl+U` (swap panels) exits Quick View first, then swaps.

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

Settings are read each time the panel is opened. The `Ctrl+H` toggle overrides `showDotfiles` for the current session only.

### Color Theme

The `vscommander.theme` setting controls the panel's color scheme:

- **`"far"`** (default): Classic Far Manager theme -- cyan-on-dark-blue with teal accents. Hardcoded true-color values for a pixel-perfect retro look.
- **`"vscode"`**: Colors that match the active VS Code color theme. Uses ANSI standard color indices that VS Code's terminal resolves to the current theme's `terminal.ansi*` color tokens. Automatically adapts when you switch between dark and light themes, and works with any installed color theme (Dark+, Light+, Monokai, Solarized, etc.).

The panel redraws instantly when you change the setting or switch VS Code themes.

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

Open from **F9 > Options > Edit colors**. The color editor popup shows all 39 theme elements organized by group (Panel, Command Line, Search, Drive Popup, Dialogs, Menu) on the left, and a color palette with controls on the right.

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

Press **OK** to save all changes to VS Code settings. Press **Cancel** or **Escape** to discard.

**Copy theme colors** (F9 > Options) writes every current color as an explicit override, creating a snapshot you can then customize incrementally. **Reset colors** clears all overrides, returning to the base theme.

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
| `vscommander.keyQuickView` | string | `Ctrl+Q` | Quick View (preview file in split editor) |

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

## Supported Platforms

Linux, FreeBSD, macOS, and Windows.
