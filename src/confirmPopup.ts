import { DBOX, BOX, MBOX } from './draw';
import { Theme } from './settings';
import { Popup, PopupInputResult } from './popup';
import { ButtonGroup } from './buttonGroup';
import { FrameBuffer } from './frameBuffer';

export interface ConfirmPopupConfig {
    title: string;
    bodyLines: string[];
    buttons: string[];
    disabledButtons?: number[];
    warning?: boolean;
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
        if (config.disabledButtons) {
            this.buttonGroup.disabledIndices = new Set(config.disabledButtons);
            for (let i = 0; i < config.buttons.length; i++) {
                if (!this.buttonGroup.disabledIndices.has(i)) {
                    this.buttonGroup.selectedIndex = i;
                    break;
                }
            }
        }
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
            return this.closeWithConfirm();
        }
        if (result.consumed) {
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        if (!this.buttonGroup) return null;
        const idx = this.hitTestButton(fbRow, fbCol);
        if (idx >= 0) {
            this.buttonGroup.selectedIndex = idx;
            this.mouseDownButton = idx;
            return { action: 'consumed' };
        }
        return null;
    }

    protected override hitTestButton(fbRow: number, fbCol: number): number {
        if (!this.config || !this.buttonGroup) return -1;
        const boxWidth = this.computeBoxWidth();
        const innerWidth = boxWidth - 2;
        const btnRow = this.padV + 1 + this.config.bodyLines.length + 1;
        if (fbRow === btnRow) {
            const localCol = fbCol - this.padH - 1;
            if (localCol >= 0) {
                return this.buttonGroup.hitTestCol(localCol, innerWidth);
            }
        }
        return -1;
    }

    protected override onButtonConfirm(buttonIndex: number): PopupInputResult {
        if (this.buttonGroup) this.buttonGroup.selectedIndex = buttonIndex;
        return this.closeWithConfirm();
    }

    override emitConfirm(): unknown {
        if (this.config && this.buttonGroup) {
            return this.config.onConfirm(this.buttonGroup.selectedIndex);
        }
    }

    private computeBoxWidth(): number {
        if (!this.config || !this.buttonGroup) return 0;
        const titleWithSpaces = ' ' + this.config.title + ' ';
        const minTitleWidth = titleWithSpaces.length + 4;
        let contentWidth = Math.max(minTitleWidth, this.buttonGroup.totalWidth);
        for (const line of this.config.bodyLines) {
            const w = ConfirmPopup.displayLen(line);
            if (w > contentWidth) contentWidth = w;
        }
        let boxWidth = contentWidth + 4;
        const maxBoxWidth = this.termCols - 2 * this.padH;
        if (maxBoxWidth > 0 && boxWidth > maxBoxWidth) {
            boxWidth = maxBoxWidth;
        }
        return boxWidth;
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        if (!this.config || !this.buttonGroup) return new FrameBuffer(0, 0);

        const { title, bodyLines } = this.config;
        const t = theme;
        const isWarning = this.config.warning !== false;
        const bodyStyle = isWarning ? t.popupWarningBody.idle : t.popupInfoBody.idle;

        const boxWidth = this.computeBoxWidth();
        const innerWidth = boxWidth - 2;
        const boxHeight = 2 + bodyLines.length + 1 + 1;
        const totalWidth = boxWidth + 2 * this.padH;
        const totalHeight = boxHeight + 2 * this.padV;

        const fb = new FrameBuffer(totalWidth, totalHeight);
        fb.fill(0, 0, totalWidth, totalHeight, ' ', bodyStyle);
        fb.drawBox(this.padV, this.padH, boxWidth, boxHeight, bodyStyle, DBOX, title);

        for (let i = 0; i < bodyLines.length; i++) {
            const line = ConfirmPopup.truncateMarkup(bodyLines[i], innerWidth);
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
        const btnBody = isWarning ? t.popupWarningBody.idle : t.popupInfoBody.idle;
        const btnIdle = isWarning ? t.popupWarningButton.idle : t.popupInfoButton.idle;
        const btnSel = isWarning ? t.popupWarningButton.selected : t.popupInfoButton.selected;
        fb.blit(btnRow, this.padH + 1, this.buttonGroup.renderToBuffer(
            innerWidth, btnBody, btnIdle, btnSel, true));

        return fb;
    }

    render(rows: number, cols: number, theme: Theme): string {
        if (!this.active || !this.config || !this.buttonGroup) return '';
        const fb = this.renderToBuffer(theme);
        const baseRow = Math.floor((rows - fb.height) / 2) + 1;
        const baseCol = Math.floor((cols - fb.width) / 2) + 1;
        this.setScreenPosition(baseRow, baseCol, fb.width, fb.height);
        return fb.toAnsi(this.screenRow, this.screenCol);
    }

    private static displayLen(text: string): number {
        return text.replace(/\*/g, '').length;
    }

    private static truncateMarkup(text: string, maxWidth: number): string {
        const displayLen = ConfirmPopup.displayLen(text);
        if (displayLen <= maxWidth) return text;
        if (maxWidth <= 3) return text.replace(/\*/g, '').slice(0, maxWidth);
        const plain = text.replace(/\*/g, '');
        return '...' + plain.slice(plain.length - maxWidth + 3);
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
