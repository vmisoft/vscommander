import { DBOX, BOX, MBOX } from './draw';
import { Theme } from './settings';
import { Popup, PopupInputResult } from './popup';
import { ButtonGroup } from './buttonGroup';
import { FrameBuffer } from './frameBuffer';

export interface ConfirmPopupConfig {
    title: string;
    bodyLines: string[];
    buttons: string[];
    onConfirm: (buttonIndex: number) => unknown;
}

export class ConfirmPopup extends Popup {
    private config: ConfirmPopupConfig | undefined;
    private buttonGroup: ButtonGroup | undefined;

    constructor() {
        super();
    }

    get selectedButton(): number {
        return this.buttonGroup ? this.buttonGroup.selectedIndex : 0;
    }

    openWith(config: ConfirmPopupConfig): void {
        this.config = config;
        this.buttonGroup = new ButtonGroup(config.buttons);
        super.open();
    }

    close(): void {
        super.close();
    }

    handleInput(data: string): PopupInputResult {
        if (!this.config || !this.buttonGroup) return { action: 'consumed' };

        if (data === '\x1b' || data === '\x1b\x1b') {
            this.close();
            return { action: 'close', confirm: false };
        }

        const result = this.buttonGroup.handleInput(data);
        if (result.confirmed) {
            this.close();
            return { action: 'close', confirm: true };
        }
        if (result.consumed) {
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    invokeConfirm(): unknown {
        if (this.config && this.buttonGroup) {
            return this.config.onConfirm(this.buttonGroup.selectedIndex);
        }
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        if (!this.config || !this.buttonGroup) return new FrameBuffer(0, 0);

        const { title, bodyLines } = this.config;
        const t = theme;
        const bodyStyle = t.confirmBody.idle;

        const titleWithSpaces = ' ' + title + ' ';
        const minTitleWidth = titleWithSpaces.length + 4;
        let contentWidth = Math.max(minTitleWidth, this.buttonGroup.totalWidth);
        for (const line of bodyLines) {
            const w = ConfirmPopup.displayLen(line);
            if (w > contentWidth) contentWidth = w;
        }
        const boxWidth = contentWidth + 4;
        const innerWidth = boxWidth - 2;
        const boxHeight = 2 + bodyLines.length + 1 + 1;
        const totalWidth = boxWidth + 2 * this.padH;
        const totalHeight = boxHeight + 2 * this.padV;

        const fb = new FrameBuffer(totalWidth, totalHeight);
        fb.fill(0, 0, totalWidth, totalHeight, ' ', bodyStyle);
        fb.drawBox(this.padV, this.padH, boxWidth, boxHeight, bodyStyle, DBOX, title);

        for (let i = 0; i < bodyLines.length; i++) {
            const line = bodyLines[i];
            const lineWidth = ConfirmPopup.displayLen(line);
            const padTotal = innerWidth - lineWidth;
            const padLeft = Math.floor(padTotal / 2);
            const rowIdx = this.padV + 1 + i;

            const parts = line.split('*');
            let x = this.padH + 1 + padLeft;
            for (let j = 0; j < parts.length; j++) {
                if (parts[j].length === 0) continue;
                const isBold = j % 2 === 1;
                const segStyle = isBold ? { ...bodyStyle, bold: true } : bodyStyle;
                fb.write(rowIdx, x, parts[j], segStyle);
                x += parts[j].length;
            }
        }

        const sepRow = this.padV + 1 + bodyLines.length;
        fb.drawSeparator(sepRow, this.padH, boxWidth, bodyStyle,
            MBOX.vertDoubleRight, BOX.horizontal, MBOX.vertDoubleLeft);

        const btnRow = sepRow + 1;
        fb.blit(btnRow, this.padH + 1, this.buttonGroup.renderToBuffer(
            innerWidth, t.confirmBody.idle, t.confirmButton.idle, t.confirmButton.selected, true));

        return fb;
    }

    render(rows: number, cols: number, theme: Theme): string {
        if (!this.active || !this.config || !this.buttonGroup) return '';
        const fb = this.renderToBuffer(theme);
        const screenRow = Math.floor((rows - fb.height) / 2) + 1;
        const screenCol = Math.floor((cols - fb.width) / 2) + 1;
        return fb.toAnsi(screenRow, screenCol);
    }

    private static displayLen(text: string): number {
        return text.replace(/\*/g, '').length;
    }

    private static renderMarkup(text: string, baseStyle: string): string {
        const parts = text.split('*');
        const out: string[] = [];
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 1) {
                out.push('\x1b[1m' + parts[i] + '\x1b[22m' + baseStyle);
            } else {
                out.push(parts[i]);
            }
        }
        return out.join('');
    }
}
