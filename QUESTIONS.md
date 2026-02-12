# VSCommander -- Open Questions

Questions about features with answers from the Far Manager source code.

## Copy (F5) -- ANSWERED

Far Manager's Copy dialog (from `far/copy.cpp` lines 653-1049):
- **Title**: "Copy" (or "Copy current file" for single file)
- **Target path**: Text input showing the opposite pane's directory by default
- **If file exists** dropdown: Ask / Overwrite / Skip / Rename / Append / Only Newer / Ask for Read-Only
- **Preserve timestamps** checkbox
- **Copy symbolic link contents** checkbox (copy link target, not the link itself)
- **Multi destinations** checkbox (copy to multiple paths separated by `;` or `,`)
- **Use filter** checkbox + Filter button
- **Buttons**: Copy, Tree (browse destination), Filter, Cancel
- Supports recursive directory copy
- Shows progress indicator for large operations

**Decision**: Implement simplified version first: target path input + If File Exists dropdown (Ask/Overwrite/Skip) + Copy button + Cancel button. No filter, no multi-dest initially.

## Move / Rename (F6) -- ANSWERED

Same dialog as Copy but:
- Title says "Rename or move" / "Rename or move current file"
- Default action is rename if destination is same directory
- Button says "Move" instead of "Copy"
- Uses `fs.rename()` for same-filesystem moves, falls back to copy+delete for cross-filesystem

**Decision**: Implement same as Copy, but with move semantics. Single dialog.

## File Multi-Selection -- ANSWERED

From `far/filelist.cpp` lines 1338-1429:
- `Insert` / `Numpad 0`: Toggle selection on current file and move cursor down
- `Gray+` (Numpad +): Select by pattern dialog (default: select all with same extension as current file)
- `Gray-` (Numpad -): Unselect by pattern dialog
- `Gray*` (Numpad *): Invert all selection (toggle all files)
- `Ctrl+M`: Restore previous selection
- Selected files shown in **yellow** text
- Info bar / bottom stats show selected count and total size
- Directories can also be selected (Ctrl+Gray* includes dirs)

**Decision**: Implement Insert to toggle selection first. Then Gray+/Gray-/Gray* with pattern dialogs. Yellow text for selected. Update info bar with selection count.

## Left/Right Menu -- View Modes -- ANSWERED

Far Manager has 10 view modes (Ctrl+0 through Ctrl+9):
1. Brief (Ctrl+1): Multi-column, names only (3 columns)
2. Medium (Ctrl+2): 2-column layout
3. Full (Ctrl+3): Single column with name, size, date, time, attributes
4. Wide (Ctrl+4): Wide single-column layout
5. Detailed (Ctrl+5): Maximum details per file
6. Diz (Ctrl+6): File descriptions
7. Long Diz (Ctrl+7): Extended descriptions
8. Owners (Ctrl+8): File ownership
9. Links (Ctrl+9): Hard link info
10. Alternative (Ctrl+0): Custom

**Decision**: Keep our simpler 1/2/3 column model (mapped to Ctrl+1/2/3 or Brief/Medium/Full). These map to Far Manager's first 3 modes. We don't need views 4-10 for now since they're Windows-specific or rarely used.

## Commands Menu -- Missing Items -- ANSWERED

From Far Manager's Commands menu:
- Find File (Alt+F7): Full recursive search with pattern matching
- History (Alt+F8): Command line history popup
- Find Folder (Alt+F10): Browse folder tree
- File View History (Alt+F11): Recently viewed files
- Folders History (Alt+F12): Recently visited folders
- Swap Panels (Ctrl+U): Already implemented
- Compare Folders: Highlight different files between panes
- Folder Shortcuts: Ctrl+0..9 quick-save/load folder paths
- Filter (Ctrl+I): File panel filter

**Decision**: Implement in priority order:
1. Folder History (Alt+F12) - track visited directories, show popup
2. Compare Folders - highlight differences between panes
3. Find File (Alt+F7) - delegate to VS Code search or implement basic glob
4. Folder Shortcuts (Ctrl+0..9) - save/load folder paths

## Options Menu -- ANSWERED

Far Manager Options menu has many items. Most relevant:
- Panel Settings
- Confirmations (which operations show confirmation dialogs)
- File Highlighting (color rules by file mask)
- Colors

**Decision**: Keep simple for now: "Panel settings" opens VS Code settings. Add "Confirmations" later if needed.

## Direct Keyboard Shortcuts -- ANSWERED

The following shortcuts appear in menu items but are NOT yet wired as direct keybindings:
- `Ctrl+R`: Re-read current directory (currently only via menu)
- `Ctrl+U`: Swap panels (currently only via menu)
- `Ctrl+1/2/3`: Change column count (currently only via menu)

**Decision**: Implement these as direct keybindings immediately.

## Per-Pane Column Count -- ANSWERED

Far Manager uses per-pane view modes (each pane can have a different view mode).

**Decision**: Implement per-pane column count. The `panelColumns` setting becomes the default, but each pane tracks its own column count that can be changed via menu or Ctrl+1/2/3.
