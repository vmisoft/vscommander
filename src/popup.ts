import { moveTo, resetStyle } from './draw';
import { TextStyle, Theme } from './settings';
import { applyStyle, dimStyle } from './helpers';
import { FrameBuffer } from './frameBuffer';

export type PopupInputResult =
    | { action: 'consumed' }
    | { action: 'close'; confirm: boolean; command?: unknown }
    | { action: 'passthrough' };

export abstract class Popup {
    active = false;
    padding = 1;
    termRows = 0;
    termCols = 0;
    protected screenRow = 0;
    protected screenCol = 0;
    protected fbWidth = 0;
    protected fbHeight = 0;
    protected mouseDownButton = -1;
    private _confirmAction: (() => unknown) | null = null;
    private _isDragging = false;
    private dragAnchorRow = 0;
    private dragAnchorCol = 0;
    private dragStartOffsetRow = 0;
    private dragStartOffsetCol = 0;
    protected dragOffsetRow = 0;
    protected dragOffsetCol = 0;

    get padH(): number {
        return this.padding * 2;
    }

    get padV(): number {
        return this.padding;
    }

    get isDragging(): boolean {
        return this._isDragging;
    }

    open(): void {
        this.active = true;
        this._confirmAction = null;
        this.dragOffsetRow = 0;
        this.dragOffsetCol = 0;
        this._isDragging = false;
    }

    close(): void {
        this.active = false;
        this.mouseDownButton = -1;
        this._isDragging = false;
    }

    setConfirmAction(fn: () => unknown): void {
        this._confirmAction = fn;
    }

    emitConfirm(): unknown {
        return this._confirmAction ? this._confirmAction() : undefined;
    }

    protected closeWithConfirm(): PopupInputResult {
        const command = this.emitConfirm();
        this.close();
        return { action: 'close', confirm: true, command };
    }

    handleMouseDown(row: number, col: number): PopupInputResult {
        const fbRow = row - this.screenRow;
        const fbCol = col - this.screenCol;
        if (fbRow < 0 || fbRow >= this.fbHeight || fbCol < 0 || fbCol >= this.fbWidth) {
            this.close();
            return { action: 'close', confirm: false };
        }
        const result = this.onMouseDown(fbRow, fbCol);
        if (result) return result;
        this._isDragging = true;
        this.dragAnchorRow = row;
        this.dragAnchorCol = col;
        this.dragStartOffsetRow = this.dragOffsetRow;
        this.dragStartOffsetCol = this.dragOffsetCol;
        return { action: 'consumed' };
    }

    handleMouseMotion(row: number, col: number): boolean {
        if (!this._isDragging) return false;
        this.dragOffsetRow = this.dragStartOffsetRow + (row - this.dragAnchorRow);
        this.dragOffsetCol = this.dragStartOffsetCol + (col - this.dragAnchorCol);
        return true;
    }

    handleMouseUp(row: number, col: number): PopupInputResult {
        if (this._isDragging) {
            this._isDragging = false;
            return { action: 'consumed' };
        }
        const pressedBtn = this.mouseDownButton;
        this.mouseDownButton = -1;
        if (pressedBtn < 0) return { action: 'consumed' };
        const fbRow = row - this.screenRow;
        const fbCol = col - this.screenCol;
        const releasedBtn = this.hitTestButton(fbRow, fbCol);
        if (releasedBtn >= 0 && releasedBtn === pressedBtn) {
            return this.onButtonConfirm(releasedBtn);
        }
        return { action: 'consumed' };
    }

    handleMouseScroll(_up: boolean): PopupInputResult {
        return { action: 'consumed' };
    }

    protected onMouseDown(_fbRow: number, _fbCol: number): PopupInputResult | null {
        return null;
    }

    protected hitTestButton(_fbRow: number, _fbCol: number): number {
        return -1;
    }

    protected onButtonConfirm(_buttonIndex: number): PopupInputResult {
        return { action: 'consumed' };
    }

    protected setScreenPosition(row: number, col: number, width: number, height: number): void {
        let sr = row + this.dragOffsetRow;
        let sc = col + this.dragOffsetCol;
        if (this.termRows > 0 && this.termCols > 0) {
            sr = Math.max(1, Math.min(sr, this.termRows - height + 1));
            sc = Math.max(1, Math.min(sc, this.termCols - width + 1));
            this.dragOffsetRow = sr - row;
            this.dragOffsetCol = sc - col;
        }
        this.screenRow = sr;
        this.screenCol = sc;
        this.fbWidth = width;
        this.fbHeight = height;
    }

    renderShadow(getCellAt: (row: number, col: number) => { ch: string; style: TextStyle }): string {
        if (!this.active || this.fbWidth === 0 || this.fbHeight === 0) return '';
        const sr = this.screenRow;
        const sc = this.screenCol;
        const w = this.fbWidth;
        const h = this.fbHeight;
        const maxRow = this.termRows > 0 ? this.termRows : 9999;
        const maxCol = this.termCols > 0 ? this.termCols : 9999;
        const out: string[] = [];

        for (let r = 1; r < h + 1; r++) {
            const row = sr + r;
            if (row > maxRow) break;
            for (let d = 0; d < 2; d++) {
                const col = sc + w + d;
                if (col > maxCol) break;
                const cell = getCellAt(row, col);
                out.push(moveTo(row, col) + applyStyle(dimStyle(cell.style)) + cell.ch);
            }
        }

        const bottomRow = sr + h;
        if (bottomRow <= maxRow) {
            for (let c = 2; c < w + 2; c++) {
                const col = sc + c;
                if (col > maxCol) break;
                const cell = getCellAt(bottomRow, col);
                out.push(moveTo(bottomRow, col) + applyStyle(dimStyle(cell.style)) + cell.ch);
            }
        }

        if (out.length > 0) out.push(resetStyle());
        return out.join('');
    }

    abstract render(anchorRow: number, anchorCol: number, theme: Theme, ...extra: unknown[]): string;

    renderToBuffer(_theme: Theme): FrameBuffer {
        return new FrameBuffer(0, 0);
    }

    get hasBlink(): boolean {
        return false;
    }

    renderBlink(_anchorRow: number, _anchorCol: number, _theme: Theme): string {
        return '';
    }
}
