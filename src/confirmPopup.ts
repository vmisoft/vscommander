import { moveTo, hideCursor, resetStyle, DBOX, BOX, MBOX } from './draw';
import { Theme } from './settings';
import { Popup, PopupInputResult } from './popup';
import { applyStyle } from './helpers';

export interface ConfirmPopupConfig {
    title: string;
    bodyLines: string[];
    buttons: string[];
    onConfirm: (buttonIndex: number) => unknown;
}

export class ConfirmPopup extends Popup {
    private config: ConfirmPopupConfig | undefined;
    selectedButton = 0;

    openWith(config: ConfirmPopupConfig): void {
        this.config = config;
        this.selectedButton = 0;
        super.open();
    }

    close(): void {
        super.close();
    }

    handleInput(data: string): PopupInputResult {
        if (!this.config) return { action: 'consumed' };

        if (data === '\x1b' || data === '\x1b\x1b') {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === '\r') {
            this.close();
            return { action: 'close', confirm: true };
        }

        if (data === '\x1b[D' || data === '\x1b[C' || data === '\t') {
            this.selectedButton = (this.selectedButton + 1) % this.config.buttons.length;
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    invokeConfirm(): unknown {
        if (this.config) {
            return this.config.onConfirm(this.selectedButton);
        }
    }

    render(rows: number, cols: number, theme: Theme): string {
        if (!this.active || !this.config) return '';

        const { title, bodyLines, buttons } = this.config;
        const t = theme;
        const padH = 2;
        const padV = 1;

        const buttonParts = buttons.map((b, i) => {
            const wrap = i === 0 ? ['{ ', ' }'] : ['[ ', ' ]'];
            return wrap[0] + b + wrap[1];
        });
        const buttonsRow = buttonParts.join(' ');

        const titleWithSpaces = ' ' + title + ' ';
        const minTitleWidth = titleWithSpaces.length + 4;
        let contentWidth = Math.max(minTitleWidth, buttonsRow.length);
        for (const line of bodyLines) {
            const w = ConfirmPopup.displayLen(line);
            if (w > contentWidth) contentWidth = w;
        }
        const boxWidth = contentWidth + 4;
        const innerWidth = boxWidth - 2;

        const boxHeight = 2 + bodyLines.length + 1 + 1;
        const totalWidth = boxWidth + 2 * padH;
        const totalHeight = boxHeight + 2 * padV;

        const startRow = Math.floor((rows - totalHeight) / 2) + 1 + padV;
        const startCol = Math.floor((cols - totalWidth) / 2) + 1 + padH;

        const bodyStyle = applyStyle(t.confirmBody.idle);
        const out: string[] = [];

        for (let v = 0; v < padV; v++) {
            out.push(bodyStyle + moveTo(startRow - padV + v, startCol - padH));
            out.push(' '.repeat(totalWidth));
        }

        const titleFillTotal = innerWidth - titleWithSpaces.length;
        const titleFillLeft = Math.floor(titleFillTotal / 2);
        const titleFillRight = titleFillTotal - titleFillLeft;
        out.push(bodyStyle + moveTo(startRow, startCol - padH));
        out.push(' '.repeat(padH) + DBOX.topLeft + DBOX.horizontal.repeat(titleFillLeft) + titleWithSpaces + DBOX.horizontal.repeat(titleFillRight) + DBOX.topRight + ' '.repeat(padH));

        for (let i = 0; i < bodyLines.length; i++) {
            const line = bodyLines[i];
            const lineWidth = ConfirmPopup.displayLen(line);
            const padTotal = innerWidth - lineWidth;
            const padLeft = Math.floor(padTotal / 2);
            const padRight = padTotal - padLeft;
            out.push(bodyStyle + moveTo(startRow + 1 + i, startCol - padH));
            out.push(' '.repeat(padH) + DBOX.vertical + ' '.repeat(padLeft) + ConfirmPopup.renderMarkup(line, bodyStyle) + ' '.repeat(padRight) + DBOX.vertical + ' '.repeat(padH));
        }

        const sepRow = startRow + 1 + bodyLines.length;
        out.push(bodyStyle + moveTo(sepRow, startCol - padH));
        out.push(' '.repeat(padH) + MBOX.vertDoubleRight + BOX.horizontal.repeat(innerWidth) + MBOX.vertDoubleLeft + ' '.repeat(padH));

        const btnRow = sepRow + 1;
        const btnPadTotal = innerWidth - buttonsRow.length;
        const btnPadLeft = Math.floor(btnPadTotal / 2);
        const btnPadRight = btnPadTotal - btnPadLeft;
        out.push(bodyStyle + moveTo(btnRow, startCol - padH));
        out.push(' '.repeat(padH) + DBOX.vertical + ' '.repeat(btnPadLeft));

        for (let i = 0; i < buttons.length; i++) {
            if (i > 0) out.push(bodyStyle + ' ');
            const wrap = i === 0 ? ['{ ', ' }'] : ['[ ', ' ]'];
            const style = i === this.selectedButton ? t.confirmButton.selected : t.confirmButton.idle;
            out.push(applyStyle(style) + wrap[0] + buttons[i] + wrap[1]);
        }

        out.push(bodyStyle + ' '.repeat(btnPadRight) + DBOX.vertical + ' '.repeat(padH));

        const botRow = btnRow + 1;
        out.push(bodyStyle + moveTo(botRow, startCol - padH));
        out.push(' '.repeat(padH) + DBOX.bottomLeft + DBOX.horizontal.repeat(innerWidth) + DBOX.bottomRight + ' '.repeat(padH));

        for (let v = 0; v < padV; v++) {
            out.push(bodyStyle + moveTo(botRow + 1 + v, startCol - padH));
            out.push(' '.repeat(totalWidth));
        }

        out.push(resetStyle() + hideCursor());
        return out.join('');
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
