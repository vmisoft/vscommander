import * as os from 'os';
import { hideCursor, DBOX, BOX, MBOX } from './draw';
import { Theme } from './settings';
import { Popup, PopupInputResult } from './popup';
import { InputControl } from './inputControl';
import { DropdownControl, DropdownOption } from './dropdownControl';
import { CheckboxControl } from './checkboxControl';
import { ButtonGroup } from './buttonGroup';
import { FrameBuffer } from './frameBuffer';
import { ARROW_DOWN } from './visualPrimitives';

export interface MkdirResult {
    dirName: string;
    linkType: 'none' | 'symbolic' | 'junction';
    linkTarget: string;
    multipleNames: boolean;
}

const DIALOG_HEIGHT = 10;
const LABEL_WIDTH = 15;

export class MkdirPopup extends Popup {
    private nameInput: InputControl;
    private linkTypeDropdown: DropdownControl;
    private targetInput: InputControl;
    private multipleCheckbox: CheckboxControl;
    private buttons: ButtonGroup;
    private focusIndex = 0;
    private dialogWidth = 68;

    constructor() {
        super();
        this.nameInput = new InputControl(10);
        this.linkTypeDropdown = new DropdownControl(this.buildOptions(), 10);
        this.targetInput = new InputControl(10);
        this.multipleCheckbox = new CheckboxControl('Process multiple names');
        this.buttons = new ButtonGroup(['OK', 'Cancel']);
    }

    private buildOptions(): DropdownOption[] {
        const options: DropdownOption[] = [
            { label: 'none', value: 'none' },
            { label: 'symbolic', value: 'symbolic' },
        ];
        if (os.platform() === 'win32') {
            options.push({ label: 'junction', value: 'junction' });
        }
        return options;
    }

    openWith(initial: string, cols: number): void {
        this.dialogWidth = Math.min(68, cols - 4);
        const innerW = this.dialogWidth - 2;
        const nameWidth = innerW - 2;
        const fieldWidth = innerW - LABEL_WIDTH - 1;
        this.nameInput = new InputControl(nameWidth);
        this.nameInput.reset(initial);
        this.linkTypeDropdown = new DropdownControl(this.buildOptions(), fieldWidth);
        this.targetInput = new InputControl(fieldWidth);
        this.targetInput.reset('');
        this.multipleCheckbox = new CheckboxControl('Process multiple names');
        this.buttons = new ButtonGroup(['OK', 'Cancel']);
        this.focusIndex = 0;
        super.open();
    }

    close(): void {
        this.linkTypeDropdown.isOpen = false;
        super.close();
    }

    handleInput(data: string): PopupInputResult {
        const hotkey = this.handleHotkey(data);
        if (hotkey) {
            this.linkTypeDropdown.isOpen = false;
            return hotkey;
        }

        if (this.linkTypeDropdown.isOpen) {
            this.linkTypeDropdown.handleInput(data);
            return { action: 'consumed' };
        }

        if (data === '\x1b' || data === '\x1b\x1b') {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === '\t') {
            this.focusIndex = (this.focusIndex + 1) % 5;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }

        if (data === '\x1b[Z') {
            this.focusIndex = (this.focusIndex - 1 + 5) % 5;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }

        switch (this.focusIndex) {
            case 0:
                if (this.nameInput.handleInput(data)) {
                    this.nameInput.resetBlink();
                    return { action: 'consumed' };
                }
                break;
            case 1:
                if (this.linkTypeDropdown.handleInput(data)) {
                    return { action: 'consumed' };
                }
                break;
            case 2:
                if (this.targetInput.handleInput(data)) {
                    this.targetInput.resetBlink();
                    return { action: 'consumed' };
                }
                break;
            case 3:
                if (this.multipleCheckbox.handleInput(data)) {
                    return { action: 'consumed' };
                }
                break;
            case 4: {
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

        if (data === '\r' && this.focusIndex !== 4) {
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
            if (this.focusIndex < 4) {
                this.focusIndex++;
                this.resetActiveBlink();
            }
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    private handleHotkey(data: string): PopupInputResult | null {
        if (data === '\x1bf' || data === '\x1bF') {
            this.focusIndex = 0;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }
        if (data === '\x1bl' || data === '\x1bL') {
            this.focusIndex = 1;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }
        if (data === '\x1bt' || data === '\x1bT') {
            this.focusIndex = 2;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }
        if (data === '\x1bm' || data === '\x1bM') {
            this.focusIndex = 3;
            this.multipleCheckbox.toggle();
            this.resetActiveBlink();
            return { action: 'consumed' };
        }
        return null;
    }

    private resetActiveBlink(): void {
        this.nameInput.resetBlink();
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
        if (relRow === 5) {
            this.focusIndex = 2;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }
        if (this.multipleCheckbox.handleClick(relRow, 6)) {
            this.focusIndex = 3;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }
        if (relRow === 8) {
            this.focusIndex = 4;
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
        if (relRow === 8) {
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

    get result(): MkdirResult {
        return {
            dirName: this.nameInput.buffer,
            linkType: this.linkTypeDropdown.selected.value as 'none' | 'symbolic' | 'junction',
            linkTarget: this.targetInput.buffer,
            multipleNames: this.multipleCheckbox.checked,
        };
    }

    get hasBlink(): boolean {
        return this.focusIndex === 0 || this.focusIndex === 2;
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
        const hotkeyStyle = t.popupInfoHotkey.idle;
        const fieldCol = boxCol + 1 + LABEL_WIDTH;
        const arrowCol = boxCol + innerW - 1;

        const fb = new FrameBuffer(totalW, totalH);
        fb.fill(0, 0, totalW, totalH, ' ', bodyStyle);
        fb.drawBox(boxRow, boxCol, w, DIALOG_HEIGHT, bodyStyle, DBOX, 'Make directory');

        // Row 1: label
        fb.write(boxRow + 1, boxCol + 1, ' Create the directory:' + ' '.repeat(Math.max(0, innerW - 21)), t.popupInfoLabel.idle);
        fb.write(boxRow + 1, boxCol + 13, 'd', hotkeyStyle);

        // Row 2: name input
        fb.blit(boxRow + 2, boxCol + 2, this.nameInput.renderToBuffer(inputStyle, cursorStyle, this.focusIndex === 0));
        fb.write(boxRow + 2, arrowCol, ARROW_DOWN, bodyStyle);

        // Row 3: separator
        fb.drawSeparator(boxRow + 3, boxCol, w, bodyStyle, MBOX.vertDoubleRight, BOX.horizontal, MBOX.vertDoubleLeft);

        // Row 4: link type
        fb.write(boxRow + 4, boxCol + 1, ' Link type:   ', bodyStyle);
        fb.write(boxRow + 4, boxCol + 2, 'L', hotkeyStyle);
        const dropFocused = this.focusIndex === 1;
        const dropFieldStyle = dropFocused ? t.popupInfoDropdown.idle : inputStyle;
        fb.blit(boxRow + 4, fieldCol, this.linkTypeDropdown.renderToBuffer(inputStyle, dropFieldStyle, dropFocused));
        fb.write(boxRow + 4, arrowCol, ARROW_DOWN, bodyStyle);

        // Row 5: target input
        fb.write(boxRow + 5, boxCol + 1, ' Target:      ', bodyStyle);
        fb.write(boxRow + 5, boxCol + 2, 'T', hotkeyStyle);
        fb.blit(boxRow + 5, fieldCol, this.targetInput.renderToBuffer(inputStyle, cursorStyle, this.focusIndex === 2));
        fb.write(boxRow + 5, arrowCol, ARROW_DOWN, bodyStyle);

        // Row 6: checkbox
        const cbFocused = this.focusIndex === 3;
        const cbStyle = cbFocused ? t.popupInfoInput.idle : t.popupInfoBody.idle;
        fb.blit(boxRow + 6, boxCol + 2, this.multipleCheckbox.renderToBuffer(t.popupInfoBody.idle, cbStyle, cbFocused));
        fb.write(boxRow + 6, boxCol + 14, 'm', t.popupInfoHotkey.idle);

        // Row 7: separator
        fb.drawSeparator(boxRow + 7, boxCol, w, bodyStyle, MBOX.vertDoubleRight, BOX.horizontal, MBOX.vertDoubleLeft);

        // Row 8: buttons
        const btnFocused = this.focusIndex === 4;
        fb.blit(boxRow + 8, boxCol + 1, this.buttons.renderToBuffer(innerW, t.popupInfoBody.idle, t.popupInfoButton.idle, t.popupInfoButton.selected, btnFocused));

        // Dropdown popup overlay (if open)
        if (this.linkTypeDropdown.isOpen) {
            fb.blit(boxRow + 5, fieldCol - 1, this.linkTypeDropdown.renderPopupToBuffer(
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

    renderMkdirBlink(rows: number, cols: number, theme: Theme): string {
        if (!this.active) return '';
        const t = theme;
        const boxStartRow = this.screenRow + this.padV;
        const boxStartCol = this.screenCol + this.padH;
        const nameCol = boxStartCol + 2;
        const fieldCol = boxStartCol + 1 + LABEL_WIDTH;
        const inputStyle = t.popupInfoInput.idle;
        const cursorStyle = t.popupInfoInputCursor.idle;

        let out = '';
        if (this.focusIndex === 0) {
            out += this.nameInput.renderBlink(boxStartRow + 2, nameCol, inputStyle, cursorStyle);
        } else if (this.focusIndex === 2) {
            out += this.targetInput.renderBlink(boxStartRow + 5, fieldCol, inputStyle, cursorStyle);
        }
        out += hideCursor();
        return out;
    }

    resetMkdirBlink(): void {
        this.nameInput.resetBlink();
        this.targetInput.resetBlink();
    }
}
