# Internal File Viewer

Press `F3` on a file in the panel to open the internal file viewer. The viewer displays file contents in a full-screen overlay directly in the terminal.

## Screen Layout

```
Row 1:    Title bar -- filename and status information
Rows 2-N: Content area (file text or hex dump)
Row N+1:  Function key bar
           1:Help  2:Wrap  3:Quit  4:Hex  5:     6:Edit  7:Search  8:UTF-8  9:     10:Quit
```

**Title bar format**: `<filename> |t|UTF-8|  filesize  |Col   0| 50%`

- Mode indicator: `t` for text mode, `h` for hex mode
- Encoding: UTF-8, Latin1, or UTF16
- File size in bytes with comma separators
- Current horizontal column position
- Scroll percentage through the file

## Display Modes

### Text Mode (default)

Displays the file as plain text with tab characters expanded to 8-space stops.

When the file extends beyond the viewport:
- A `<<` arrow appears at the left edge when scrolled right
- A `>>` arrow appears at the right edge when content extends beyond

### Hex Mode (F4)

Displays the raw bytes of the file in hexadecimal:

```
0000000000: 48 65 6C 6C 6F 20 57 6F | 72 6C 64 0A 54 68 69 73 | Hello.World.This
```

Each line shows:
- 10-digit hex address
- First 8 bytes in hex
- Separator `|`
- Next 8 bytes in hex
- Separator `|`
- ASCII representation (non-printable characters shown as `.`)

Binary files (files containing null bytes) automatically open in hex mode.

### Wrap Mode (F2)

When enabled, long lines are wrapped at the terminal width instead of requiring horizontal scrolling. Toggle with `F2`. Only applies in text mode.

## Navigation

| Key | Action |
|-----|--------|
| `Up` / `Down` | Scroll one line |
| `PgUp` / `PgDn` | Scroll one page |
| `Ctrl+Home` | Jump to file start |
| `Ctrl+End` | Jump to file end |
| `Home` | Reset horizontal scroll to column 0 |
| `End` | Scroll to end of longest visible line |
| `Left` / `Right` | Horizontal scroll by 1 (text, no-wrap) |
| `Ctrl+Left` / `Ctrl+Right` | Horizontal scroll by 20 characters |
| Mouse wheel | Scroll 3 lines up/down |

## Search (F7)

Press `F7` to open the search dialog:

```
+------------------ Search ------------------+
| Search for:                                 |
| [____________________________________]      |
|                                             |
| [x] Case sensitive  [ ] Regular expression  |
| [ ] Whole words     [ ] Hex search          |
|                                             |
|       [ Prev ]  [ Next ]  [ Cancel ]        |
+---------------------------------------------+
```

**Options**:
- **Case sensitive**: Match exact letter case
- **Regular expression**: Use regex patterns in the search text
- **Whole words**: Match only complete words (word boundaries)
- **Hex search**: Search for hex byte sequences (e.g. `48656C6C6F`)

**Repeat search**:
- `Shift+F7`: Find next match (forward)
- `Alt+F7`: Find previous match (backward)

When a match is found, the viewer scrolls to position it approximately one quarter from the top of the screen, and the matched text is highlighted.

Search wraps around: when reaching the end of the file, the search continues from the beginning (and vice versa for backward search).

## Encoding (F8)

Press `F8` to cycle through text encodings:

1. **UTF-8** (default)
2. **Latin-1** (ISO 8859-1)
3. **UTF-16LE** (Little-endian UTF-16)

The file is re-read with the selected encoding. The current encoding is displayed in the title bar and on the F8 key label in the function bar.

## Other Actions

| Key | Action |
|-----|--------|
| `F6` | Close viewer and open the file in VS Code editor |
| `F3` / `F10` / `Esc` | Close the viewer and return to the panel |

## Large File Support

The viewer reads files in 256KB chunks. Initial load reads the first 256KB, and additional chunks are loaded automatically as you scroll toward the end. This keeps memory usage low and the viewer responsive for files of any size.

When jumping to the end of a large file (`Ctrl+End`), the viewer reads the last 256KB chunk and positions the view at the bottom.

## Theme Colors

The viewer uses these theme color keys:

| Key | Description |
|-----|-------------|
| `viewerText` | Normal text content |
| `viewerStatus` | Title bar / status line |
| `viewerSelected` | Search match highlight |
| `viewerArrows` | Overflow indicators (`<<` / `>>`) |
| `viewerHex` | Hex address and separators |
