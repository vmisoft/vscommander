import { FrameBuffer } from '../frameBuffer';
import { Theme } from '../settings';
import { FormTheme, FormComponent } from './formView';

export interface GridButton {
    label: string;
    primary?: boolean;  // rendered with { } braces (the default action)
}

// A generic grid of push buttons laid out as one or more centered rows. The
// caller drives selection and focus; the component renders the rows and
// hit-tests pointer coordinates. Disabled buttons render dimmed.
export class ButtonGrid implements FormComponent {
    readonly rows: GridButton[][];
    selected = 0;                   // flat row-major index
    disabled = new Set<number>();
    readonly focusStops = 1;

    constructor(rows: GridButton[][]) {
        this.rows = rows;
    }

    get height(): number {
        return this.rows.length;
    }

    get count(): number {
        let n = 0;
        for (const r of this.rows) n += r.length;
        return n;
    }

    handleInput(): boolean {
        return false;
    }

    private rowOffset(rowIndex: number): number {
        let off = 0;
        for (let r = 0; r < rowIndex; r++) off += this.rows[r].length;
        return off;
    }

    // Hit-test a coordinate relative to the component's top-left; returns the
    // flat button index, or -1.
    hitTest(relRow: number, relCol: number, _innerWidth: number): number {
        if (relRow < 0 || relRow >= this.rows.length) return -1;
        const row = this.rows[relRow];
        const layout = ButtonGrid.layout(row);
        for (let i = 0; i < row.length; i++) {
            if (relCol >= layout[i].x && relCol < layout[i].x + layout[i].width) {
                return this.rowOffset(relRow) + i;
            }
        }
        return -1;
    }

    private static layout(row: GridButton[]): { x: number; width: number }[] {
        const out: { x: number; width: number }[] = [];
        let x = 0;
        for (let i = 0; i < row.length; i++) {
            if (i > 0) x += 1;
            const width = row[i].label.length + 4;
            out.push({ x, width });
            x += width;
        }
        return out;
    }

    render(fb: FrameBuffer, row: number, col: number, innerWidth: number,
           focused: boolean, _subFocus: number, ft: FormTheme, _theme: Theme): void {
        const bodyStyle = ft.body.idle;
        const buttonStyle = ft.button.idle;
        const selectedStyle = ft.button.selected;
        const selectedIndex = focused ? this.selected : -1;

        for (let r = 0; r < this.rows.length; r++) {
            const buttons = this.rows[r];
            fb.fill(row + r, col, innerWidth, 1, ' ', bodyStyle);

            let total = 0;
            for (let i = 0; i < buttons.length; i++) {
                if (i > 0) total += 1;
                total += buttons[i].label.length + 4;
            }
            let x = col + Math.max(0, Math.floor((innerWidth - total) / 2));
            const offset = this.rowOffset(r);

            for (let i = 0; i < buttons.length; i++) {
                if (i > 0) { fb.write(row + r, x, ' ', bodyStyle); x += 1; }
                const flat = offset + i;
                const wrap = buttons[i].primary ? ['{ ', ' }'] : ['[ ', ' ]'];
                const style = this.disabled.has(flat)
                    ? { ...buttonStyle, dim: true }
                    : flat === selectedIndex ? selectedStyle : buttonStyle;
                const text = wrap[0] + buttons[i].label + wrap[1];
                fb.write(row + r, x, text, style);
                x += text.length;
            }
        }
    }
}
