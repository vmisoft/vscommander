import { DBOX, BOX, MBOX, hideCursor } from './draw';
import { Theme } from './settings';
import { Popup, PopupInputResult } from './popup';
import { InputControl } from './inputControl';
import { DropdownControl, DropdownOption } from './dropdownControl';
import { ButtonGroup } from './buttonGroup';
import { FrameBuffer } from './frameBuffer';

export type CopyMoveMode = 'copy' | 'move';
export type OverwriteMode = 'ask' | 'overwrite' | 'skip';

export interface CopyMoveResult {
    mode: CopyMoveMode;
    targetPath: string;
    overwrite: OverwriteMode;
    sourceFiles: string[];
    sourceCwd: string;
}

const DIALOG_HEIGHT = 8;
const LABEL_WIDTH = 18;

export class CopyMovePopup extends Popup {
    private targetInput: InputControl;
    private overwriteDropdown: DropdownControl;
    private buttons: ButtonGroup;
    private focusIndex = 0;
    private dialogWidth = 68;
    mode: CopyMoveMode = 'copy';
    sourceFiles: string[] = [];
    sourceCwd = '';

    constructor() {
        super();
        this.targetInput = new InputControl(10);
        this.overwriteDropdown = new DropdownControl(this.buildOverwriteOptions(), 10);
        this.buttons = new ButtonGroup(['Copy', 'Cancel']);
    }

    private buildOverwriteOptions(): DropdownOption[] {
        return [
            { label: 'Ask', value: 'ask' },
            { label: 'Overwrite', value: 'overwrite' },
            { label: 'Skip', value: 'skip' },
        ];
    }

    openWith(mode: CopyMoveMode, targetDir: string, sourceFiles: string[], sourceCwd: string, cols: number): void {
        this.mode = mode;
        this.sourceFiles = sourceFiles;
        this.sourceCwd = sourceCwd;
        this.dialogWidth = Math.min(68, cols - 4);
        const innerW = this.dialogWidth - 2;
        const nameWidth = innerW - 2;
        const fieldWidth = innerW - LABEL_WIDTH - 1;
        this.targetInput = new InputControl(nameWidth);
        this.targetInput.reset(targetDir);
        this.overwriteDropdown = new DropdownControl(this.buildOverwriteOptions(), fieldWidth);
        this.buttons = new ButtonGroup([mode === 'copy' ? 'Copy' : 'Move', 'Cancel']);
        this.focusIndex = 0;
        super.open();
    }

    close(): void {
        this.overwriteDropdown.isOpen = false;
        super.close();
    }

    handleInput(data: string): PopupInputResult {
        if (this.overwriteDropdown.isOpen) {
            this.overwriteDropdown.handleInput(data);
            return { action: 'consumed' };
        }

        if (data === '\x1b' || data === '\x1b\x1b') {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === '\t') {
            this.focusIndex = (this.focusIndex + 1) % 3;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }

        if (data === '\x1b[Z') {
            this.focusIndex = (this.focusIndex - 1 + 3) % 3;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }

        switch (this.focusIndex) {
            case 0:
                if (this.targetInput.handleInput(data)) {
                    this.targetInput.resetBlink();
                    return { action: 'consumed' };
                }
                break;
            case 1:
                if (this.overwriteDropdown.handleInput(data)) {
                    return { action: 'consumed' };
                }
                break;
            case 2: {
                const result = this.buttons.handleInput(data);
                if (result.confirmed) {
                    if (this.buttons.selectedIndex === 1) {
                        this.close();
                        return { action: 'close', confirm: false };
                    }
                    return this.closeWithConfirm();
                }
                if (result.consumed) {
                    return { action: 'consumed' };
                }
                break;
            }
        }

        if (data === '\r' && this.focusIndex !== 2) {
            return this.closeWithConfirm();
        }

        if (data === '\x1b[A') {
            if (this.focusIndex > 0) {
                this.focusIndex--;
                this.resetActiveBlink();
            }
            return { action: 'consumed' };
        }

        if (data === '\x1b[B') {
            if (this.focusIndex < 2) {
                this.focusIndex++;
                this.resetActiveBlink();
            }
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    private resetActiveBlink(): void {
        this.targetInput.resetBlink();
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        const boxRow = this.padV;
        const relRow = fbRow - boxRow;

        if (relRow === 2) {
            this.focusIndex = 0;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }
        if (relRow === 4) {
            this.focusIndex = 1;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }
        if (relRow === 6) {
            this.focusIndex = 2;
            const idx = this.hitTestButton(fbRow, fbCol);
            if (idx >= 0) {
                this.buttons.selectedIndex = idx;
                this.mouseDownButton = idx;
            }
            return { action: 'consumed' };
        }
        return null;
    }

    protected override hitTestButton(fbRow: number, fbCol: number): number {
        const boxRow = this.padV;
        const relRow = fbRow - boxRow;
        if (relRow === 6) {
            const localCol = fbCol - this.padH - 1;
            if (localCol >= 0) {
                const innerW = this.dialogWidth - 2;
                return this.buttons.hitTestCol(localCol, innerW);
            }
        }
        return -1;
    }

    protected override onButtonConfirm(buttonIndex: number): PopupInputResult {
        this.buttons.selectedIndex = buttonIndex;
        if (buttonIndex === 1) {
            this.close();
            return { action: 'close', confirm: false };
        }
        return this.closeWithConfirm();
    }

    get result(): CopyMoveResult {
        return {
            mode: this.mode,
            targetPath: this.targetInput.buffer,
            overwrite: this.overwriteDropdown.selected.value as OverwriteMode,
            sourceFiles: this.sourceFiles,
            sourceCwd: this.sourceCwd,
        };
    }

    get hasBlink(): boolean {
        return this.focusIndex === 0;
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        const t = theme;
        const w = this.dialogWidth;
        const innerW = w - 2;
        const totalW = w + 2 * this.padH;
        const totalH = DIALOG_HEIGHT + 2 * this.padV;
        const boxRow = this.padV;
        const boxCol = this.padH;
        const bodyStyle = t.popupInfoBody.idle;
        const inputStyle = t.popupInfoInput.idle;
        const cursorStyle = t.popupInfoInputCursor.idle;
        const fieldCol = boxCol + 1 + LABEL_WIDTH;

        const title = this.mode === 'copy' ? 'Copy' : 'Rename or move';

        const fb = new FrameBuffer(totalW, totalH);
        fb.fill(0, 0, totalW, totalH, ' ', bodyStyle);
        fb.drawBox(boxRow, boxCol, w, DIALOG_HEIGHT, bodyStyle, DBOX, title);

        let desc: string;
        if (this.sourceFiles.length === 1) {
            const name = this.sourceFiles[0];
            const maxName = innerW - (this.mode === 'copy' ? 14 : 24);
            const displayName = name.length > maxName ? name.slice(0, maxName - 1) + '~' : name;
            desc = this.mode === 'copy'
                ? ' Copy "' + displayName + '" to:'
                : ' Rename or move "' + displayName + '" to:';
        } else {
            desc = this.mode === 'copy'
                ? ' Copy ' + this.sourceFiles.length + ' files to:'
                : ' Move ' + this.sourceFiles.length + ' files to:';
        }
        fb.write(boxRow + 1, boxCol + 1, desc + ' '.repeat(Math.max(0, innerW - desc.length)), t.popupInfoLabel.idle);

        fb.blit(boxRow + 2, boxCol + 2, this.targetInput.renderToBuffer(inputStyle, cursorStyle, this.focusIndex === 0));

        fb.drawSeparator(boxRow + 3, boxCol, w, bodyStyle, MBOX.vertDoubleRight, BOX.horizontal, MBOX.vertDoubleLeft);

        fb.write(boxRow + 4, boxCol + 1, ' If file exists: ', bodyStyle);
        const dropFocused = this.focusIndex === 1;
        const dropFieldStyle = dropFocused ? t.popupInfoDropdown.idle : inputStyle;
        fb.blit(boxRow + 4, fieldCol, this.overwriteDropdown.renderToBuffer(inputStyle, dropFieldStyle, dropFocused));

        fb.drawSeparator(boxRow + 5, boxCol, w, bodyStyle, MBOX.vertDoubleRight, BOX.horizontal, MBOX.vertDoubleLeft);

        const btnFocused = this.focusIndex === 2;
        fb.blit(boxRow + 6, boxCol + 1, this.buttons.renderToBuffer(innerW, t.popupInfoBody.idle, t.popupInfoButton.idle, t.popupInfoButton.selected, btnFocused));

        if (this.overwriteDropdown.isOpen) {
            fb.blit(boxRow + 5, fieldCol - 1, this.overwriteDropdown.renderPopupToBuffer(
                t.popupInfoBody.idle, t.popupInfoInput.idle, t.popupInfoDropdown.selected
            ));
        }

        return fb;
    }

    render(rows: number, cols: number, theme: Theme): string {
        if (!this.active) return '';
        const fb = this.renderToBuffer(theme);
        const baseRow = Math.floor((rows - fb.height) / 2) + 1;
        const baseCol = Math.floor((cols - fb.width) / 2) + 1;
        this.setScreenPosition(baseRow, baseCol, fb.width, fb.height);
        return fb.toAnsi(this.screenRow, this.screenCol);
    }

    renderCopyMoveBlink(rows: number, cols: number, theme: Theme): string {
        if (!this.active || this.focusIndex !== 0) return '';
        const t = theme;
        const boxStartRow = this.screenRow + this.padV;
        const boxStartCol = this.screenCol + this.padH;
        const nameCol = boxStartCol + 2;
        const inputStyle = t.popupInfoInput.idle;
        const cursorStyle = t.popupInfoInputCursor.idle;
        let out = this.targetInput.renderBlink(boxStartRow + 2, nameCol, inputStyle, cursorStyle);
        out += hideCursor();
        return out;
    }

    resetCopyMoveBlink(): void {
        this.targetInput.resetBlink();
    }
}
