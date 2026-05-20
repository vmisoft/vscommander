import { moveTo, hideCursor, resetStyle } from './draw';
import { TextStyle } from './settings';
import { applyStyle } from './helpers';

export interface DrawOp {
    row: number;
    col: number;
    text: string;
    style: TextStyle;
}

export interface BoxChars {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    horizontal: string;
    vertical: string;
}

export class FrameBuffer {
    readonly width: number;
    readonly height: number;
    private ops: DrawOp[] = [];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    write(row: number, col: number, text: string, style: TextStyle): void {
        if (row < 0 || row >= this.height) return;
        if (col >= this.width) return;
        if (col < 0) {
            text = text.slice(-col);
            col = 0;
        }
        if (text.length === 0) return;
        if (col + text.length > this.width) {
            text = text.slice(0, this.width - col);
        }
        if (text.length === 0) return;
        this.ops.push({ row, col, text, style });
    }

    blit(row: number, col: number, child: FrameBuffer): void {
        for (const op of child.ops) {
            this.write(row + op.row, col + op.col, op.text, op.style);
        }
    }

    fill(row: number, col: number, w: number, h: number, ch: string, style: TextStyle): void {
        const line = ch.repeat(w);
        for (let r = 0; r < h; r++) {
            this.write(row + r, col, line, style);
        }
    }

    drawBox(row: number, col: number, w: number, h: number, style: TextStyle,
            chars: BoxChars, title?: string): void {
        let topInner = chars.horizontal.repeat(w - 2);
        if (title && title.length < w - 4) {
            const t = ' ' + title + ' ';
            const fillLeft = Math.floor((w - 2 - t.length) / 2);
            const fillRight = w - 2 - t.length - fillLeft;
            topInner = chars.horizontal.repeat(fillLeft) + t + chars.horizontal.repeat(fillRight);
        }
        this.write(row, col, chars.topLeft + topInner + chars.topRight, style);

        for (let r = 1; r < h - 1; r++) {
            this.write(row + r, col, chars.vertical + ' '.repeat(w - 2) + chars.vertical, style);
        }

        this.write(row + h - 1, col, chars.bottomLeft + chars.horizontal.repeat(w - 2) + chars.bottomRight, style);
    }

    drawSeparator(row: number, col: number, w: number, style: TextStyle,
                  leftChar: string, fillChar: string, rightChar: string): void {
        this.write(row, col, leftChar + fillChar.repeat(w - 2) + rightChar, style);
    }

    toAnsi(screenRow: number, screenCol: number): string {
        // Composite the draw ops cell-by-cell: a later op wins over an earlier
        // one on any cell they share. This makes overlays (e.g. an open
        // dropdown list) cleanly cover whatever they are drawn on top of,
        // regardless of column order.
        const grid: ({ ch: string; style: TextStyle } | undefined)[][] =
            Array.from({ length: this.height }, () => new Array(this.width).fill(undefined));
        for (const op of this.ops) {
            if (op.row < 0 || op.row >= this.height) continue;
            for (let i = 0; i < op.text.length; i++) {
                const c = op.col + i;
                if (c < 0 || c >= this.width) continue;
                grid[op.row][c] = { ch: op.text[i], style: op.style };
            }
        }

        // Emit each row as runs of cells sharing the same style; unwritten
        // cells stay transparent (whatever is already on screen shows).
        const out: string[] = [];
        for (let r = 0; r < this.height; r++) {
            let c = 0;
            while (c < this.width) {
                const cell = grid[r][c];
                if (!cell) { c++; continue; }
                const styleStr = applyStyle(cell.style);
                let text = cell.ch;
                let end = c + 1;
                while (end < this.width) {
                    const next = grid[r][end];
                    if (!next || applyStyle(next.style) !== styleStr) break;
                    text += next.ch;
                    end++;
                }
                out.push(moveTo(screenRow + r, screenCol + c) + styleStr + text);
                c = end;
            }
        }
        out.push(resetStyle() + hideCursor());
        return out.join('');
    }
}
