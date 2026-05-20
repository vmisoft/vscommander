import { FrameBuffer } from '../frameBuffer';
import { Theme } from '../settings';
import { moveTo, resetStyle } from '../draw';
import { applyStyle } from '../helpers';
import { KEY_SPACE, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT } from '../keys';
import { FormTheme, FormComponent } from './formView';

// One cell of a CheckboxGrid.
export interface GridCell {
    gridR: number;   // logical grid row, used for arrow navigation
    gridC: number;   // logical grid column
    row: number;     // render row offset, relative to the component's top
    col: number;     // render column offset, relative to the component's left
    on: boolean;
}

// A generic grid of checkbox cells. Every cell is an individual Tab stop;
// arrow keys move focus between cells by their logical grid coordinates and
// Space toggles the focused cell. Specialized grids derive from this.
export class CheckboxGrid implements FormComponent {
    readonly cells: GridCell[];
    readonly height: number;
    private blinkOn = true;

    constructor(cells: GridCell[], height: number) {
        this.cells = cells;
        this.height = height;
    }

    get focusStops(): number {
        return this.cells.length;
    }

    resetBlink(): void {
        this.blinkOn = true;
    }

    handleInput(data: string, subFocus: number): boolean {
        if (data === KEY_SPACE) {
            this.cells[subFocus].on = !this.cells[subFocus].on;
            return true;
        }
        return false;
    }

    // Arrow keys move focus between cells sharing a logical row/column.
    // Returns the focus-index delta, or null at a grid edge so focus can
    // leave the grid (Up off the top row, Down off the bottom row).
    arrowNav(data: string, subFocus: number): number | null {
        const cur = this.cells[subFocus];
        if (data === KEY_LEFT || data === KEY_RIGHT) {
            const dir = data === KEY_RIGHT ? 1 : -1;
            const t = this.findCell(cur.gridR, cur.gridC + dir);
            return t === null ? null : t - subFocus;
        }
        if (data === KEY_UP || data === KEY_DOWN) {
            const dir = data === KEY_DOWN ? 1 : -1;
            const t = this.findCell(cur.gridR + dir, cur.gridC);
            return t === null ? null : t - subFocus;
        }
        return null;
    }

    private findCell(gridR: number, gridC: number): number | null {
        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i].gridR === gridR && this.cells[i].gridC === gridC) {
                return i;
            }
        }
        return null;
    }

    render(fb: FrameBuffer, row: number, col: number, innerWidth: number,
           focused: boolean, subFocus: number, ft: FormTheme, _theme: Theme): void {
        for (let r = 0; r < this.height; r++) {
            fb.write(row + r, col, ' '.repeat(innerWidth), ft.body.idle);
        }
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            const box = '[' + (cell.on ? 'x' : ' ') + ']';
            const isCur = focused && i === subFocus;
            fb.write(row + cell.row, col + cell.col, box,
                isCur ? ft.button.selected : ft.input.idle);
        }
    }

    renderBlink(absRow: number, absCol: number, subFocus: number, ft: FormTheme): string {
        this.blinkOn = !this.blinkOn;
        const cell = this.cells[subFocus];
        const ch = this.blinkOn ? '|' : (cell.on ? 'x' : ' ');
        const style = this.blinkOn ? ft.inputCursor.idle : ft.button.selected;
        return moveTo(absRow + cell.row, absCol + cell.col + 1)
            + applyStyle(style) + ch + resetStyle();
    }
}
