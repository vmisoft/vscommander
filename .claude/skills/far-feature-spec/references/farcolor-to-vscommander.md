# Far colour → VSCommander colour mapping

When the spec records a dialog/panel element's colour, capture it two ways:

1. **Observed** — the actual foreground/background read from the captured
   screen (`far-driver.ps1` writes ANSI SGR codes into `<state>.ansi.txt`;
   each `\x1b[<fg>;<bg>m` is a real cell colour).
2. **Named** — the Far palette slot the element draws with, found in the
   source. This explains *why* and ties to a configurable theme entry.

The captured ANSI is the source of truth for the spec; the named slot is the
cross-reference.

## Far palette slots (`COL_*`, `../FarManager/far/farcolor.hpp`)

Far names every drawable surface with a `COL_*` constant; defaults live in
`../FarManager/far/palette.cpp`. Slots a feature spec usually needs:

| Far slot family | Surface |
|---|---|
| `COL_DIALOGTEXT` | Dialog body text |
| `COL_DIALOGBOX`, `COL_DIALOGBOXTITLE` | Dialog frame and title |
| `COL_DIALOGEDIT*` | Edit fields (normal / selected / disabled / unchanged) |
| `COL_DIALOGBUTTON`, `COL_DIALOGSELECTEDBUTTON` | Buttons (idle / focused) |
| `COL_DIALOGHIGHLIGHTTEXT` | Accelerator letter highlight |
| `COL_DIALOGLISTTEXT`, `COL_DIALOGLISTSELECTEDTEXT` | List/combo items |
| `COL_PANELTEXT`, `COL_PANELSELECTEDTEXT` | Panel file rows |
| `COL_PANELBOX`, `COL_PANELTITLE` | Panel frame and path title |
| `COL_PANELCURSOR` | Panel cursor bar |
| `COL_MENUTEXT`, `COL_MENUSELECTEDTEXT` | Menu rows |
| `COL_WARNDIALOG*` | Warning/error dialog variants |
| `COL_KEYBARTEXT`, `COL_KEYBARNUM` | Function-key bar |

## VSCommander theme slots

VSCommander's theme is defined in `src/settings.ts` (the `Theme` /
`PanelSettings` types) and editable via the colour editor
(`src/colorEditorPopup.ts`). Each element has `fg`/`bg`/`bold` plus
`selected*` variants. Map each Far `COL_*` slot to the nearest VSCommander
theme element; when none exists, the spec should flag that a **new theme
element** is required.

| Far slot | VSCommander theme element (verify in `src/settings.ts`) |
|---|---|
| `COL_PANELTEXT` / `COL_PANELSELECTEDTEXT` | file row idle / selected |
| `COL_PANELBOX` / `COL_PANELTITLE` | panel border / path |
| `COL_PANELCURSOR` | the active cursor style |
| `COL_DIALOGBOX*` / `COL_DIALOGTEXT` | dialog border / dialog text |
| `COL_DIALOGEDIT*` | dialog input field |
| `COL_DIALOGBUTTON*` | dialog button idle / focused |
| `COL_MENUTEXT*` | menu row idle / selected |
| `COL_KEYBAR*` | fkey bar number / label |
| `COL_WARNDIALOG*` | warning/error dialog |

## How to record a colour in the spec

For every element, the spec's UI element table should give:
`Far slot (COL_*) | observed fg/bg (from capture) | VSCommander theme element
| note (reuse existing / new element needed)`.

Do not invent hex values — read them from `palette.cpp` for the named default,
or from the captured ANSI for the observed value.
