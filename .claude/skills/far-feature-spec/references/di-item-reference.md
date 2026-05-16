# Far dialog item reference

A glossary of the dialog-item types and flags used in Far Manager dialog
definitions, so the skill can read a `DI_*` array without re-deriving meanings.
Authoritative source: `../FarManager/far/dialog.hpp` (and the Far plugin SDK
headers) — verify there if a value looks unfamiliar.

## Item types (`DI_*`)

| Type | Element it produces |
|---|---|
| `DI_DOUBLEBOX` | Double-line frame with a centred title — the dialog border |
| `DI_SINGLEBOX` | Single-line frame |
| `DI_TEXT` | Static text label (also used as a horizontal separator) |
| `DI_VTEXT` | Static vertical text |
| `DI_EDIT` | Single-line text input |
| `DI_FIXEDIT` | Fixed-width / masked text input |
| `DI_PSWEDIT` | Password input (masked echo) |
| `DI_COMBOBOX` | Drop-down / editable combo list |
| `DI_LISTBOX` | Scrollable list box |
| `DI_CHECKBOX` | Checkbox (optionally 3-state) |
| `DI_RADIOBUTTON` | Radio button (grouped) |
| `DI_BUTTON` | Push button |
| `DI_USERCONTROL` | Owner-drawn custom control |

## Item flags (`DIF_*`) worth recording in a spec

| Flag | Meaning |
|---|---|
| `DIF_FOCUS` | This control has the initial focus |
| `DIF_DEFAULTBUTTON` | Button activated by `Enter` from anywhere |
| `DIF_SEPARATOR` / `DIF_SEPARATOR2` | Draw a horizontal divider line |
| `DIF_CENTERGROUP` | Centre this run of items as a group (e.g. button row) |
| `DIF_BOXCOLOR` | Use the frame colour |
| `DIF_HISTORY` | Edit field has an input history |
| `DIF_USELASTHISTORY` | Pre-fill the field with the most recent history entry |
| `DIF_EDITEXPAND` | Expand environment variables in the edit field |
| `DIF_EDITPATH` | Edit field is a filesystem path (path completion) |
| `DIF_DROPDOWNLIST` | Combo box is a closed list (not editable) |
| `DIF_LISTWRAPMODE` | List cursor wraps top↔bottom |
| `DIF_LISTNOAMPERSAND` | Do not treat `&` as an accelerator in list items |
| `DIF_3STATE` | Checkbox has a third (indeterminate) state |
| `DIF_GROUP` | Starts a new radio-button group |
| `DIF_DISABLE` | Control starts disabled (greyed) |
| `DIF_HIDDEN` | Control starts hidden |
| `DIF_NOFOCUS` | Control is skipped by Tab focus traversal |

## Accelerators

A `&` before a letter in an item caption marks that letter as the item's
keyboard accelerator (`Alt+letter` activates it). Record these as the
feature's letter hotkeys.

## Dialog messages (`*DlgProc` handlers)

The dialog procedure encodes dynamic UI rules. Common messages:

| Message | Fires when | Typical use |
|---|---|---|
| `DN_INITDIALOG` | Dialog opens | Set initial state |
| `DN_EDITCHANGE` | An edit/combo value changes | Enable/disable dependent fields |
| `DN_BTNCLICK` | A button/checkbox is clicked | React to a toggle |
| `DN_CLOSE` | Dialog is closing | Validate input |
| `DM_ENABLE` / `DM_SETCHECK` | (sent by the proc) | Apply the dynamic rule |

Record every enable/disable / show/hide rule from the proc — those become the
VSCommander dialog's dynamic behaviour.
