import { TextStyle } from './settings';
import { FrameBuffer } from './frameBuffer';

export interface ButtonGroupResult {
    consumed: boolean;
    confirmed?: boolean;
}

export class ButtonGroup {
    labels: string[];
    selectedIndex = 0;
    disabledIndices = new Set<number>();

    constructor(labels: string[]) {
        this.labels = labels;
    }

    private nextEnabled(dir: number): number {
        for (let step = 1; step <= this.labels.length; step++) {
            const idx = (this.selectedIndex + dir * step + this.labels.length * step) % this.labels.length;
            if (!this.disabledIndices.has(idx)) return idx;
        }
        return this.selectedIndex;
    }

    handleInput(data: string): ButtonGroupResult {
        if (data === '\x1b[D' || data === '\x1b[Z') {
            this.selectedIndex = this.nextEnabled(-1);
            return { consumed: true };
        }

        if (data === '\x1b[C' || data === '\t') {
            this.selectedIndex = this.nextEnabled(1);
            return { consumed: true };
        }

        if (data === '\r') {
            if (this.disabledIndices.has(this.selectedIndex)) {
                return { consumed: true };
            }
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
            if (col >= x && col < x + btnWidth) {
                return this.disabledIndices.has(i) ? -1 : i;
            }
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
            const isDisabled = this.disabledIndices.has(i);
            const style = isDisabled
                ? { ...buttonStyle, dim: true }
                : (focused && i === this.selectedIndex) ? selectedButtonStyle : buttonStyle;
            const text = wrap[0] + this.labels[i] + wrap[1];
            fb.write(0, col, text, style);
            col += text.length;
        }

        return fb;
    }

}
