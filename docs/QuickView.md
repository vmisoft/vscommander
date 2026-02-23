# Quick View

Press `Ctrl+Q` to enter Quick View mode. The inactive
pane is replaced with a Quick View panel that previews
the file or directory under the cursor, rendered directly
inside the terminal.

## File Preview

When the cursor is on a file, the Quick View panel
displays the file's text content. Reading is performed
asynchronously to keep the interface responsive -- an
animated spinner is shown while the file loads. Only the
visible portion is read from disk (no unnecessary I/O).

Binary files are displayed as ASCII text with
non-printable characters replaced by dots. Tab characters
in text files are expanded to 8-column stops.

## Directory Info

When the cursor is on a directory, the panel shows:

- Folder path (truncated to fit)
- Link target if the folder is a symbolic link
- Number of sub-directories
- Number of files
- Total file size (human-readable + exact byte count)

A recursive scan runs asynchronously with an animated
spinner. Once complete, the status changes to "Scanning
complete".

## Scrolling

Press `Tab` to move focus to the Quick View panel.
The panel title becomes active and the file pane
cursor disappears. When focused, the following keys
scroll the file content:

  `Up` / `Down`           Scroll vertically by one line
  `PgUp` / `PgDn`         Scroll vertically by one page
  `Left` / `Right`        Scroll horizontally (text files)
  `Left` / `Right`        Scroll vertically by one page (binary files)
  `Home` / `End`          Scroll vertically by one page
  `Ctrl+Home`             Jump to file beginning
  `Ctrl+End`              Jump to file end
  `Ctrl+PgUp`             Jump to file beginning
  `Ctrl+PgDn`             Jump to file end

Press `Tab` again to return focus to the file pane.

## Behavior

- As you move the cursor, the Quick View panel updates
  to show the currently highlighted file or directory
- On `..`: the last preview stays visible

## Exiting Quick View

  `Ctrl+Q`    Toggle Quick View off, restore both panes
  `Ctrl+O`    Exit Quick View, hide panel entirely
  `Enter`     On a file: exit Quick View, open file

While in Quick View mode, `Ctrl+P`, `Ctrl+Left`, and
`Ctrl+Right` are disabled. `Ctrl+U` exits Quick View
first, then swaps panels.

## See Also

  [Panel Layout](Panels.md)
  [Keyboard Reference](KeyRef.md)
