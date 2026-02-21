# Quick View

Press `Ctrl+Q` to enter Quick View mode. The inactive
pane disappears and the active pane expands to fill the
terminal width, while a VS Code split editor opens on
the opposite side to preview the file under the cursor.

## Behavior

- As you move the cursor, the split editor updates to
  show the currently highlighted file
- On a directory: shows directory information (path,
  sub-directory count, file count, total size) with an
  animated spinner during recursive scan
- On `..`: the last preview stays visible
- VS Code handles all file types: text, images, binary

## Exiting Quick View

  `Ctrl+Q`    Toggle Quick View off, restore both panes
  `Tab`       Exit Quick View, switch to other pane
  `Ctrl+O`    Exit Quick View, hide panel entirely
  `Enter`     On a file: exit, close split, open file

While in Quick View mode, `Ctrl+P`, `Ctrl+Left`, and
`Ctrl+Right` are disabled. `Ctrl+U` exits Quick View
first, then swaps panels.

## See Also

  [Panel Layout](Panels.md)
  [Keyboard Reference](KeyRef.md)
