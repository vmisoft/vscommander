# Copy and Move Files

## Copy (F5)

Press `F5` to copy the selected file or files to the
opposite pane's directory. If files are selected (via
`Insert`), all selected files are copied; otherwise the
file under the cursor is copied.

The Copy dialog shows:
- Target path: pre-filled with other pane's directory
- If file exists: `Ask`, `Overwrite`, or `Skip`
- Copy / Cancel buttons

Directories are copied recursively. A scanning dialog
shows progress before copying begins, then a progress
dialog shows source/destination paths, per-file progress,
and overall progress. Press `Esc` to cancel.

## Error Handling

If a file fails to copy, an error dialog appears with
four options:
- Retry    -- attempt the operation again
- Skip     -- skip the failed item and continue
- Navigate -- abort and navigate to the problem file
- Cancel   -- abort the entire copy

## Move / Rename (F6)

Press `F6` to move or rename files. Same as Copy but
moves files instead. When source and destination are on
the same filesystem, the operation is instant (rename).
For cross-filesystem moves, files are copied then deleted.

If the target path is the same directory with a different
name, this acts as a rename.

## Symlink Handling

When copying directories containing symbolic links,
VSCommander preserves symlinks as symlinks. Internal
symlinks (pointing within the copied tree) are detected
during scanning.

If internal symlinks are found, a Softlinks dialog
appears with four options:

  Target      Remap internal symlinks to the destination
  No change   Copy symlink values verbatim
  Source       Make internal symlinks point to source
  Ask         Prompt for each symlink individually

When no internal symlinks are detected, the "Target"
policy is applied silently.

## See Also

  [File Selection](Selection.md)
  [Delete Files](DeleteFile.md)
  [Archive Navigation](Archives.md)
