# Menus and Sorting

## Top Menu Bar (F9)

Press `F9` to open the top menu bar. Five menus:
Left, Files, Commands, Options, Right.

### Menu Bar Navigation

  `Left` / `Right`  Move between menu items
  `Enter` / `Down`  Open the dropdown
  `Escape`          Close the menu bar
  `Home` / `End`    Jump to first / last menu item
  Hotkey letter      Open matching menu (e.g. `L`)

### Dropdown Navigation

  `Up` / `Down`     Move between items
  `Left` / `Right`  Switch to adjacent menu
  `Enter`           Activate the selected item
  `Escape`          Close dropdown (return to bar)
  `Home` / `End`    Jump to first / last item
  Hotkey letter      Activate matching item

## Left / Right Menus

Control the corresponding pane's display and sorting:

  Brief          `Ctrl+1`    1-column file list
  Medium         `Ctrl+2`    2-column file list
  Full           `Ctrl+3`    3-column file list
  Sort modes     `Ctrl+F12`  Open Sort Modes popup
  Show dotfiles  `Ctrl+H`    Toggle hidden files
  Re-read        `Ctrl+R`    Refresh directory listing
  Change drive   `Alt+F1/F2` Open Change Drive popup

## Sort Modes Popup

Open from the Left/Right menu or press `Ctrl+F12`.

  Name            `Ctrl+F3`   Alphabetical by name
  Extension       `Ctrl+F4`   By file extension
  Write time      `Ctrl+F5`   By modification date
  Size            `Ctrl+F6`   By file size
  Unsorted        `Ctrl+F7`   Filesystem order
  Creation time   `Ctrl+F8`   By creation time
  Access time     `Ctrl+F9`   By last access time
  Change time                 By status change time
  Description     `Ctrl+F10`  By file descriptions
  Owner           `Ctrl+F11`  By owner UID
  Allocated size              By disk blocks
  Hard links                  By hard link count
  Streams count               By NTFS stream count
  Streams size                By NTFS stream size

### Sort Toggles

  Use sort groups       `Shift+F11`  Group by patterns
  Show selected first   `Shift+F12`  Selected files first
  Show dirs first                    Dirs before files

### Sort Direction

The active mode shows an arrow: ascending or descending.
Selecting the already-active mode toggles direction.

## Files Menu

  View              `F3`   Highlight in Explorer
  Edit              `F4`   Open in editor
  Copy              `F5`   Copy files
  Rename or move    `F6`   Move or rename
  Make directory    `F7`   Create directory
  Delete            `F8`   Delete files

## Commands Menu

  Swap panels       `Ctrl+U`   Swap pane directories
  Panels On/Off     `Ctrl+O`   Toggle panel overlay

## Options Menu

  All settings        Open VS Code settings
  Save settings       Persist settings to scope
  Delete settings     Remove persisted settings
  Reset settings      Reset to defaults (session only)
  Change theme        Theme selection with live preview
  Edit colors         Interactive color editor
  Copy theme colors   Snapshot colors as overrides
  Reset colors        Remove all color overrides

## See Also

  [Settings and Themes](Settings.md)
  [Keyboard Reference](KeyRef.md)
