# File Selection

Press `Insert` to toggle selection on the current file
and move the cursor down. Selected files are shown in
bright yellow text. The `..` entry cannot be selected.

## Selection Keys

  `Insert`     Toggle selection and move cursor down
  `Numpad *`   Invert selection (toggle all files)
  `Numpad +`   Select all files
  `Numpad -`   Deselect all files

## Shift+Navigation

Hold `Shift` with navigation keys to select ranges:

  `Shift+Up`       Select/deselect upward
  `Shift+Down`     Select/deselect downward
  `Shift+Left`     Select/deselect column left
  `Shift+Right`    Select/deselect column right
  `Shift+PgUp`     Select/deselect page up
  `Shift+PgDn`     Select/deselect page down
  `Shift+Home`     Select/deselect to beginning
  `Shift+End`      Select/deselect to end

## Notes

- Selection is per-pane and cleared when changing dirs
- When files are selected, the bottom border shows total
  size and count of selected files
- Selected files are used by `F5` Copy and `F6` Move:
  the operation applies to all selected files instead
  of just the cursor file

## See Also

  [Copy Files](CopyFiles.md)
  [Keyboard Reference](KeyRef.md)
