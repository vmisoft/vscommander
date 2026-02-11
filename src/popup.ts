import { moveTo, BOX, resetStyle } from './draw';
import { TextStyle, Theme } from './settings';
import { applyStyle } from './helpers';

export type PopupInputResult =
    | { action: 'consumed' }
    | { action: 'close'; confirm: boolean }
    | { action: 'passthrough' };

export interface PopupGeometry {
    row: number;
    col: number;
    width: number;
    height: number;
}

export interface PopupConfig {
    geometry: PopupGeometry;
    title?: string;
    borderStyle: TextStyle;
    bodyStyle: TextStyle;
    padH?: number;
    padV?: number;
}

export abstract class Popup {
    active = false;

    open(): void {
        this.active = true;
    }

    close(): void {
        this.active = false;
    }

    abstract render(anchorRow: number, anchorCol: number, theme: Theme): string;

    get hasBlink(): boolean {
        return false;
    }

    renderBlink(_anchorRow: number, _anchorCol: number, _theme: Theme): string {
        return '';
    }

    protected static renderFrame(config: PopupConfig): string {
        const { row, col, width, height } = config.geometry;
        const padH = config.padH ?? 0;
        const padV = config.padV ?? 0;
        const body = applyStyle(config.bodyStyle);
        const out: string[] = [];
        const totalWidth = width + 2 * padH;

        let topInner = BOX.horizontal.repeat(width - 2);
        if (config.title && config.title.length < width - 4) {
            const t = ' ' + config.title + ' ';
            const fillLeft = Math.floor((width - 2 - t.length) / 2);
            const fillRight = width - 2 - t.length - fillLeft;
            topInner = BOX.horizontal.repeat(fillLeft) + t + BOX.horizontal.repeat(fillRight);
        }

        for (let v = 0; v < padV; v++) {
            out.push(body + moveTo(row - padV + v, col - padH));
            out.push(' '.repeat(totalWidth));
        }

        out.push(body + moveTo(row, col - padH));
        out.push(' '.repeat(padH) + BOX.topLeft + topInner + BOX.topRight + ' '.repeat(padH));

        for (let r = 1; r < height - 1; r++) {
            out.push(body + moveTo(row + r, col - padH));
            out.push(' '.repeat(padH) + BOX.vertical + ' '.repeat(width - 2) + BOX.vertical + ' '.repeat(padH));
        }

        out.push(body + moveTo(row + height - 1, col - padH));
        out.push(' '.repeat(padH) + BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight + ' '.repeat(padH));

        for (let v = 0; v < padV; v++) {
            out.push(body + moveTo(row + height + v, col - padH));
            out.push(' '.repeat(totalWidth));
        }

        out.push(resetStyle());
        return out.join('');
    }

    protected static renderInputField(
        row: number, col: number, width: number,
        buffer: string, cursorVisible: boolean,
        inputStyle: TextStyle, cursorStyle: TextStyle,
    ): string {
        const out: string[] = [];
        const input = applyStyle(inputStyle);
        const displayText = buffer.slice(0, width);
        const pad = ' '.repeat(Math.max(0, width - displayText.length));

        out.push(input + moveTo(row, col));
        out.push(displayText + pad);

        const cursorCol = col + displayText.length;
        out.push(moveTo(row, cursorCol));
        if (cursorVisible) {
            out.push(applyStyle(cursorStyle) + '|');
        } else {
            out.push(input + ' ');
        }

        out.push(resetStyle());
        return out.join('');
    }
}
