# Change Drive

Press `Alt+F1` to open the Change Drive popup for the
left pane, or `Alt+F2` for the right pane.

## Platform Behavior

- Windows: Lists disk drives sorted alphabetically
  (C:, D:, etc.) with type, total size, and free space
- Linux / macOS / FreeBSD: Lists mounted filesystems
  from `df`, filtering out virtual filesystems. The root
  filesystem `/` appears first, followed by `/mnt/*`
  mount points, then the rest alphabetically

## Home Directories

Below the drives, a Home directories section lists
well-known directories from your home (Desktop,
Documents, Downloads, Movies, Music, Pictures, Public)
-- only those that actually exist.

## Workspace Entry

If you have a workspace directory open in VS Code, it
appears at the bottom as a "VSCode Explorer" entry for
quick navigation. The VSCode Explorer entry always has
the hotkey `0`.

## Navigation

  `Up` / `Down`       Move cursor through the list
  `Left` / `Right`    Same as Up / Down
  `Home` / `PgUp`     Jump to first entry
  `End` / `PgDn`      Jump to last entry
  `Enter`             Select the highlighted entry
  `Escape`            Cancel and close
  `1` - `9`           Quick-select by numbered prefix
  `0`                 Quick-select VSCode Explorer
  `a` - `z`           Quick-select by letter prefix

## See Also

  [Keyboard Reference](KeyRef.md)
  [Panel Layout](Panels.md)
