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
        const sorted = [...this.ops].sort((a, b) => {
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
        });
        const out: string[] = [];
        for (const op of sorted) {
            out.push(moveTo(screenRow + op.row, screenCol + op.col));
            out.push(applyStyle(op.style));
            out.push(op.text);
        }
        out.push(resetStyle() + hideCursor());
        return out.join('');
    }
}
