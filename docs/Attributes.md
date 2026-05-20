# File Attributes

Press `Ctrl+A` to open the File Attributes dialog for the selected file(s),
or for the file under the cursor when nothing is selected.

## Dialog

On Linux, macOS and FreeBSD the dialog edits POSIX attributes:

- **Permissions** -- an `rwx` grid of checkboxes for Owner, Group and Other,
  plus a Special row (setuid, setgid, sticky). Toggle a cell with `Space`;
  the equivalent octal mode is shown live below the grid.
- **Owner** and **Group** -- a name field. When `/etc/passwd` and
  `/etc/group` are available the field has a `[v]` dropdown of known names
  (cycle with `Up`/`Down`); otherwise it is a plain input. A numeric uid/gid
  is also accepted.
- **Change modified time** / **Change accessed time** -- each timestamp is
  opt-in: tick the checkbox to enable its field. The field is masked
  (`YYYY-MM-DD hh:mm:ss`, digits only) -- an incomplete or impossible date
  shows `(invalid)` and blocks **Set**. Left unticked, the timestamp is
  untouched.
- **Apply changes to directory contents** -- shown when a directory is among
  the targets; ticking it applies every change recursively.

Only the fields you actually change are written; everything else is left
untouched.

## Keys

| Key | Action |
|-----|--------|
| `Ctrl+A` | Open the File Attributes dialog |
| `Tab` / `Shift+Tab` | Move between fields |
| `Space` | Toggle the "Apply to directory contents" checkbox |
| `Enter` | Apply the changes (the **Set** button) |
| `Esc` | Cancel -- no change is made |

If a change cannot be applied -- for example permission denied when you are
not the file's owner -- an error dialog offers **Retry**, **Skip**, or
**Cancel**.

## See Also

- [File Selection](Selection.md)
- [Make Directory](MakeFolder.md)
- [Keyboard Reference](KeyRef.md)
