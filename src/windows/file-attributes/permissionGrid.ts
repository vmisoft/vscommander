import { FrameBuffer } from '../../frameBuffer';
import { Theme } from '../../settings';
import { FormTheme } from '../../components/formView';
import { CheckboxGrid, GridCell } from '../../components/checkboxGrid';

// Permission bit for grid cell [row][col]; rows: owner/group/other/special.
const PERM_BITS = [
    [0o400, 0o200, 0o100],     // owner   r w x
    [0o040, 0o020, 0o010],     // group   r w x
    [0o004, 0o002, 0o001],     // other   r w x
    [0o4000, 0o2000, 0o1000],  // special setuid setgid sticky
];
const ROW_LABELS = ['Owner', 'Group', 'Other', 'Special'];
const SPECIAL_LABELS = ['setuid', 'setgid', 'sticky'];

// The POSIX permission grid of the file-attributes window: a 3x3 grid of rwx
// checkboxes plus a setuid/setgid/sticky row and an octal-mode readout. Each
// checkbox is an individual Tab stop. Specialized derivative of CheckboxGrid.
export class PermissionGrid extends CheckboxGrid {
    constructor(mode: number) {
        const cells: GridCell[] = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                cells.push({
                    gridR: r, gridC: c,
                    row: 1 + r, col: 21 + c * 9,
                    on: (mode & PERM_BITS[r][c]) !== 0,
                });
            }
        }
        for (let c = 0; c < 3; c++) {
            cells.push({
                gridR: 3, gridC: c,
                row: 4, col: 14 + c * 14,
                on: (mode & PERM_BITS[3][c]) !== 0,
            });
        }
        super(cells, 6);
    }

    // The permission bits implied by the current checkbox states.
    get mode(): number {
        let m = 0;
        for (const cell of this.cells) {
            if (cell.on) m |= PERM_BITS[cell.gridR][cell.gridC];
        }
        return m;
    }

    render(fb: FrameBuffer, row: number, col: number, innerWidth: number,
           focused: boolean, subFocus: number, ft: FormTheme, theme: Theme): void {
        super.render(fb, row, col, innerWidth, focused, subFocus, ft, theme);
        const label = ft.label.idle;
        const accent = ft.hotkey.idle;
        fb.write(row, col + 2, 'Permissions', label);
        fb.write(row, col + 21, 'Read', label);
        fb.write(row, col + 30, 'Write', label);
        fb.write(row, col + 40, 'Exec', label);
        for (let r = 0; r < 3; r++) {
            fb.write(row + 1 + r, col + 5, ROW_LABELS[r], label);
        }
        fb.write(row + 4, col + 5, ROW_LABELS[3], label);
        for (let c = 0; c < 3; c++) {
            fb.write(row + 4, col + 14 + c * 14 + 4, SPECIAL_LABELS[c], label);
        }
        const octal = (this.mode & 0o7777).toString(8).padStart(4, '0');
        fb.write(row + 5, col + 5, 'Octal mode:  ' + octal, accent);
    }
}
