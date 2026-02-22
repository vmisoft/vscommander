# Panel Layout

VSCommander displays two independent file panels side by
side, each with its own directory path, file listing,
info bar, and summary statistics.

## Structure

  Top border     -- directory path and clock (`HH:MM`)
  Column headers -- "Name" centered in each column
  File listing   -- files in 1, 2, or 3 columns
  Separator      -- horizontal line above the info bar
  Info bar       -- selected file name, size, date
  Bottom border  -- total bytes, file count, dir count

## File Listing

Files flow top-to-bottom, then left-to-right (newspaper
style). Directories are shown in blue+bold, dotfiles in
dim gray, regular files in aqua. Symbolic links display
a yellow right-arrow indicator in their column.

Change column count with `Ctrl+1`, `Ctrl+2`, `Ctrl+3`
or via [Menus and Sorting](Menus.md).

## Info Bar

Shows the selected file's name, size (or `<DIR>` for
directories), and modification date. Symbolic links show
the link target path with a yellow arrow.

When sorting by description, the info bar shows the file
description instead of the date.

## Bottom Border

Each pane shows total bytes, file count, and directory
count. When files are selected, shows selected file count
and total size instead.

## Dotfiles

Hidden files (starting with `.`) appear in dim gray.
Toggle visibility with `Ctrl+H` or via settings.
See [Settings and Themes](Settings.md).

## See Also

  [Keyboard Reference](KeyRef.md)
  [Quick View](QuickView.md)
  [Command Line](CmdLine.md)
