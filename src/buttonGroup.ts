import { TextStyle } from './settings';
import { FrameBuffer } from './frameBuffer';

export interface ButtonGroupResult {
    consumed: boolean;
    confirmed?: boolean;
}

export class ButtonGroup {
    labels: string[];
    selectedIndex = 0;

    constructor(labels: string[]) {
        this.labels = labels;
    }

    handleInput(data: string): ButtonGroupResult {
        if (data === '\x1b[D' || data === '\x1b[Z') {
            this.selectedIndex = (this.selectedIndex - 1 + this.labels.length) % this.labels.length;
            return { consumed: true };
        }

        if (data === '\x1b[C' || data === '\t') {
            this.selectedIndex = (this.selectedIndex + 1) % this.labels.length;
            return { consumed: true };
        }

        if (data === '\r') {
            return { consumed: true, confirmed: true };
        }

        return { consumed: false };
    }

    get totalWidth(): number {
        let w = 0;
        for (let i = 0; i < this.labels.length; i++) {
            if (i > 0) w += 1;
            w += this.labels[i].length + 4;
        }
        return w;
    }

    hitTestCol(col: number, width: number): number {
        const buttonsW = this.totalWidth;
        const padTotal = width - buttonsW;
        const padLeft = Math.max(0, Math.floor(padTotal / 2));
        let x = padLeft;
        for (let i = 0; i < this.labels.length; i++) {
            if (i > 0) x += 1;
            const btnWidth = this.labels[i].length + 4;
            if (col >= x && col < x + btnWidth) return i;
            x += btnWidth;
        }
        return -1;
    }

    renderToBuffer(width: number, bodyStyle: TextStyle, buttonStyle: TextStyle, selectedButtonStyle: TextStyle, focused: boolean = true): FrameBuffer {
        const fb = new FrameBuffer(width, 1);
        const buttonsW = this.totalWidth;
        const padTotal = width - buttonsW;
        const padLeft = Math.max(0, Math.floor(padTotal / 2));

        fb.fill(0, 0, width, 1, ' ', bodyStyle);

        let col = padLeft;
        for (let i = 0; i < this.labels.length; i++) {
            if (i > 0) {
                fb.write(0, col, ' ', bodyStyle);
                col += 1;
            }
            const wrap = i === 0 ? ['{ ', ' }'] : ['[ ', ' ]'];
            const style = (focused && i === this.selectedIndex) ? selectedButtonStyle : buttonStyle;
            const text = wrap[0] + this.labels[i] + wrap[1];
            fb.write(0, col, text, style);
            col += text.length;
        }

        return fb;
    }

}
