# Settings and Themes

Configure VSCommander in VS Code settings (`Ctrl+,`).

## General Settings

  `vscommander.theme`         Color theme (`far` / `vscode`)
  `vscommander.showDotfiles`  Show hidden files (default: true)
  `vscommander.clock`         Show clock HH:MM (default: true)
  `vscommander.panelColumns`  Columns per pane (default: 2)

## Color Themes

- `far` (default): Classic Far Manager theme with
  cyan-on-dark-blue and teal accents. Hardcoded
  true-color values for a pixel-perfect retro look
- `vscode`: Colors that match the active VS Code theme.
  Uses ANSI color indices that adapt when you switch
  between dark and light themes

## Change Theme Popup

Open from F9 > Options > Change theme. Shows available
themes with a live preview. Use `Up`/`Down` to browse.

Buttons: OK, Edit, Reset, Cancel.

## Color Overrides

Every visual element can be individually customized via
`vscommander.colors.*` settings. Each setting is an
object with optional properties:

  `fg`           Foreground color
  `bg`           Background color
  `bold`         Bold text (true/false)
  `selectedFg`   Foreground when cursor is on element
  `selectedBg`   Background when cursor is on element
  `selectedBold`  Bold when cursor is on element

Color values: hex strings (`ff0000`) or ANSI index
notation (`@0`-`@15`, `@d` for default).

## Interactive Color Editor

Open from F9 > Options > Edit colors. Shows all theme
elements organized by group, with a 16-color ANSI
palette, hex input, and live sample preview.

Navigation:
  `Tab` / `Shift+Tab`   Cycle focus areas
  `Up` / `Down`         Navigate elements / palette
  `Left` / `Right`      Toggle state / navigate palette
  `Space`               Toggle bold / confirm palette
  `Enter`               Jump to palette / activate button
  `Escape`              Cancel

## Saving and Deleting Settings

All changes are in-memory by default. To persist:
F9 > Options > Save settings.

Scopes:
- User -- global VS Code settings
- Workspace -- workspace `.vscode/settings.json`

To remove persisted settings:
F9 > Options > Delete settings.

## Key Binding Settings

Every panel action can be remapped to a different key.
Valid key names include `F1`-`F10`, `Shift+F1`-`Shift+F10`,
`Alt+F1`-`Alt+F10`, `Ctrl+H`, `Ctrl+P`, etc.

  `vscommander.keyView`       F3    View
  `vscommander.keyEdit`       F4    Edit
  `vscommander.keyCopy`       F5    Copy
  `vscommander.keyMove`       F6    Move/Rename
  `vscommander.keyMkdir`      F7    Mkdir
  `vscommander.keyDelete`     F8    Delete
  `vscommander.keyQuit`       F10   Quit
  `vscommander.keyMenu`       F9    Menu
  `vscommander.keyQuickView`  Ctrl+Q  Quick View

See [Keyboard Reference](KeyRef.md) for the full list.

## Fullscreen / Detach

Press `Alt+Enter` to detach VSCommander into a separate
fullscreen window. Press `Alt+Enter` again to reattach.

## See Also

  [Menus and Sorting](Menus.md)
  [Keyboard Reference](KeyRef.md)
