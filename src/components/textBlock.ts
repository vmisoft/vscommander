import { FrameBuffer } from '../frameBuffer';
import { Theme } from '../settings';
import { FormTheme, FormComponent } from './formView';

export interface TextBlockLine {
    text: string;
    bold?: boolean;
}

export type TextBlockSource = TextBlockLine[] | (() => TextBlockLine[]);

// A generic non-focusable block of left-aligned text lines, each optionally
// bold. The content may be a fixed array or a provider evaluated on every
// render (for live values such as a path or an elapsed-time line).
export class TextBlock implements FormComponent {
    private source: TextBlockSource;
    private fixedHeight?: number;
    readonly focusStops = 0;

    constructor(source: TextBlockSource, fixedHeight?: number) {
        this.source = source;
        this.fixedHeight = fixedHeight;
    }

    private lines(): TextBlockLine[] {
        return typeof this.source === 'function' ? this.source() : this.source;
    }

    get height(): number {
        if (this.fixedHeight !== undefined) return this.fixedHeight;
        return (this.source as TextBlockLine[]).length;
    }

    handleInput(): boolean {
        return false;
    }

    render(fb: FrameBuffer, row: number, col: number, innerWidth: number,
           _focused: boolean, _subFocus: number, ft: FormTheme, _theme: Theme): void {
        const lines = this.lines();
        for (let i = 0; i < this.height; i++) {
            fb.write(row + i, col, ' '.repeat(innerWidth), ft.body.idle);
            const line = lines[i];
            if (!line) continue;
            const style = line.bold ? { ...ft.body.idle, bold: true } : ft.body.idle;
            fb.write(row + i, col + 1, line.text, style);
        }
    }
}
