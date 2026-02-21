# Command Line

The bottom row of the panel (above the function key bar)
shows a live view of your shell's current line.
Keystrokes are forwarded to the shell in real time.

## Executing Commands

Press `Enter` to execute a typed command. The panel
hides to show full terminal output while the command
runs, then reappears with refreshed directory listings
when the command finishes.

When the command line is empty, pressing `Enter` opens
the selected directory as usual.

## Command Line Keys

  Printable keys   Type into the command line
  `Backspace`      Delete character
  `Ctrl+Enter`     Insert filename into command line
  `Ctrl+[`         Insert left pane path
  `Ctrl+]`         Insert right pane path

## Half-Panel Mode (Ctrl+P)

Press `Ctrl+P` to hide the inactive pane and show recent
terminal output in its place. This lets you see command
output while keeping one file pane visible.

- The active pane stays visible; the inactive side shows
  terminal output with full color support
- Press `Ctrl+P` again to restore both panes
- Pressing `Tab` swaps which side shows the terminal
- When you execute a command in half-panel mode, the
  panel stays visible and the terminal area shows
  command output live
- The `cd` commands from pane navigation are suppressed

## Spinner

If you press `Ctrl+O` while a command is running, the
panel appears with a spinner in the command line row
indicating the command is in progress. Press `Ctrl+O`
again to return to the terminal.

## See Also

  [Keyboard Reference](KeyRef.md)
  [Panel Layout](Panels.md)
