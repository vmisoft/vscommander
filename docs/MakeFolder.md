# Make Directory

Press `F7` to open the Make Directory dialog.

## Fields

- Directory name: name of the new directory to create.
  Intermediate directories are created automatically
  (e.g. `a/b/c` creates all three levels)
- Link type: cycle through `none`, `symbolic`, and
  `junction` (Windows only) with `Space` or arrow keys.
  When set to symbolic or junction, a link is created
  instead of a regular directory
- Target: when link type is not none, enter the target
  path for the link
- Process multiple names: check this box (`Space` to
  toggle) to create multiple directories at once by
  separating names with semicolons (e.g. `src;lib;docs`)

## Dialog Navigation

  `Tab` / `Shift+Tab`   Move between controls
  `Up` / `Down`         Move between controls
  `Space`               Toggle checkbox / cycle dropdown
  `Enter`               Confirm (OK) from any field
  `Escape`              Cancel and close
  Arrow keys            Navigate within input fields

After confirming, the directory is created and the cursor
moves to the newly created entry.

## See Also

  [Keyboard Reference](KeyRef.md)
  [Panel Layout](Panels.md)
