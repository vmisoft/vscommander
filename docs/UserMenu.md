# User Menu

Press `F2` to open the User Menu -- a configurable list
of shell commands with hotkey navigation.

Menu items are stored in VS Code settings at user-level
and workspace-level scopes. Items from both scopes are
merged and displayed together, each marked with `(u)` or
`(w)` to show its origin.

## Menu Layout

Each item shows its hotkey, label, a `>>` marker for
submenus, and a scope indicator `(u)` or `(w)`.

## Navigation

  `Up` / `Down`     Move cursor (wraps around)
  `Home` / `End`    Jump to first / last item
  `Enter`           Execute command or enter submenu
  `Right`           Enter submenu
  `Left`            Pop back from submenu
  `Escape`          Close menu (or pop submenu level)
  Hotkey character   Jump to matching item and execute
  `Shift+F2`        Cycle view: All > User > Workspace

## In-Menu Editing

  `Insert`          Create new item (Command or Submenu)
  `F4`              Edit current item
  `Delete`          Delete current item (with confirmation)
  `Ctrl+Up`         Move item up in its scope list
  `Ctrl+Down`       Move item down in its scope list

## Edit Form

The edit form contains:

- Hot key: single character or function key name
- Label: display text for the menu item
- Commands: up to 6 lines of shell commands (hidden
  for submenus)
- Scope: choose User or Workspace storage

Navigate with `Tab` / `Shift+Tab` or `Up` / `Down`.
Press `Enter` or click OK to save; `Escape` to cancel.

Changes are written to VS Code settings immediately.

## Variable Substitution

Commands support `!` tokens that are replaced before
execution:

  `!.!`    Current filename with extension (basename)
  `!.`     Filename without extension
  `` !` `` Extension only (no dot)
  `!\`     Current directory + trailing path separator
  `!#`     Passive panel filename (basename)
  `!#\`    Passive panel directory + trailing separator
  `!&`     Selected files, space-separated, double-quoted
  `!!`     Literal `!`

### Interactive Prompts

  `!?title?init!`   Prompt for input before execution

The title appears in the dialog header. The init value
pre-fills the input field. Multiple prompts in a single
command are collected one at a time.

### Comment Lines

Lines starting with `REM ` or `::` are treated as
comments and skipped during execution.

## Example Configuration

Add to your VS Code settings (User or Workspace):

  "vscommander.userMenu": [
    {
      "hotkey": "a",
      "label": "Compile current file",
      "commands": ["gcc -o !. !.!"]
    },
    {
      "hotkey": "b",
      "label": "Run program",
      "commands": ["./!."]
    },
    {
      "hotkey": "s",
      "label": "Git commands",
      "submenu": true,
      "children": [
        {
          "hotkey": "s",
          "label": "Git status",
          "commands": ["git status"]
        },
        {
          "hotkey": "l",
          "label": "Git log",
          "commands": ["git log --oneline -20"]
        }
      ]
    }
  ]

## See Also

  [Keyboard Reference](KeyRef.md)
  [Command Line](CmdLine.md)
  [Settings and Themes](Settings.md)
