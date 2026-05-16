# Far Manager source map

Where things live in the Far Manager source. All paths are **relative to the
VSCommander repo root** — the source is a sibling checkout at `../FarManager`
(and `../mc` for Midnight Commander). Never write absolute `/home/...` paths.

This map is **advisory** — Far refactors files over time. Always re-confirm by
reading the file header and the relevant declarations before trusting it.

## Far Manager — where concerns live

| Concern | File | Grep for |
|---|---|---|
| Key code constants | `../FarManager/far/keys.hpp` | `KEY_F7`, `KEY_CTRL*`, `KEY_SHIFT*`, `KEY_ALT*` |
| Keyboard dispatch / translation | `../FarManager/far/keyboard.cpp` | key name tables, `KeyToVKey` |
| Menu ↔ key mappings | `../FarManager/far/config.cpp` | `MENU_*`, `KEY_F*` |
| Panel key handling | `../FarManager/far/filelist.cpp`, `panel.cpp` | `ProcessKey`, `case KEY_` |
| Function-key bar labels | `../FarManager/far/keybar.cpp` | per-mode label arrays |
| Dialog system / messages | `../FarManager/far/dialog.cpp/.hpp` | `DN_`, `DM_`, `DI_` |
| Dialog builder helper | `../FarManager/far/FarDlgBuilder.cpp/.hpp` | `MakeDialogItems`, `AddEdit` |
| Colour palette enum | `../FarManager/far/farcolor.hpp` | `COL_DIALOG*`, `COL_PANEL*`, `COL_MENU*` |
| Palette default values | `../FarManager/far/palette.cpp` | the default colour table |
| Screen buffer / drawing | `../FarManager/far/scrbuf.cpp` | `Write`, `FillRect` |
| Language strings | `../FarManager/far/lang.*`, the `Far*.lng` files | `lng::M*` ids |
| Help source (m4-templated) | `../FarManager/far/FarEng.hlf.m4` | `@TopicName`, `$ #Title#` |

The **installed** Far also ships a compiled `FarEng.hlf` and `Far*.lng`
(plain, no m4) at `C:\Program Files\Far Manager\` — sometimes easier to read
than the `.m4` source.

## Feature → source file map

| Feature | Far `.cpp` | Help topic | Midnight Commander |
|---|---|---|---|
| Make folder | `mkdir.cpp` | `@MakeFolder` | `mc/src/filemanager/cmd.c` |
| Copy / move | `copy.cpp` | `@CopyDlg`, `@MoveDlg` | `file.c`, `filegui.c` |
| Delete | `delete.cpp` | `@DeleteFile` | `file.c` |
| Find file | `findfile.cpp` | `@FindFileDlg` | `find.c` |
| File attributes | `setattr.cpp` | `@FileAttrDlg` | `chmod.c`, `chown.c` |
| Filter | `filefilter.cpp` | `@FiltersMenu` | `panel.c` |
| Panel sort modes | `filelist.cpp`, `sortdef.cpp` | `@PanelCmdSort` | `panel.c` |
| Change drive | `filepanels.cpp` | `@DriveDlg` | `boxes.c` |
| Internal viewer | `viewer.cpp`, `vmenu.cpp` | `@Viewer` | `mc/src/viewer/` |
| Internal editor | `editor.cpp` | `@Editor` | `mc/src/editor/` |
| User menu | `usermenu.cpp` | `@UserMenu` | user menu |
| Quick view | `qview.cpp` | `@QViewPanel` | — |
| Tree panel | `treelist.cpp` | `@TreePanel` | `tree.c` |
| Find folder / select | `filelist.cpp` | `@SelectDlg` | `panel.c` |

Confirm by `grep`-ing the feature's trigger key in `keybar.cpp` / `config.cpp`
and the `@Topic` in `FarEng.hlf.m4`.

## Dialog item layout

A Far dialog is an array of `DI_*` items built via `MakeDialogItems<N>` or
`FarDialogBuilder`. Read the item array plus the `*DlgProc` handler.

- **Coordinates** are `{{X1,Y1},{X2,Y2}}`, dialog-relative, in character cells.
- The dialog's outer size comes from a `SetPosition({-1,-1,W,H})` call —
  `-1,-1` means centred; `W`×`H` is the outer box including borders.
- A `0` in an item's `X2`/`Y2` often means "auto" (text width, same row).

See `di-item-reference.md` for the `DI_*` / `DIF_*` glossary and
`farcolor-to-vscommander.md` for the colour mapping.

## Midnight Commander

C source under `../mc/src/`: `filemanager/` (panel.c, filegui.c, boxes.c,
file.c, cmd.c), `viewer/`, `editor/`, `src/keymap.c`. Help: `../mc/doc/hlp/`.
MC is a **secondary cross-reference only** — when MC and Far disagree, Far
governs; MC differences are recorded in the spec as notes.
