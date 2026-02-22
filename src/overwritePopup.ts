import * as path from 'path';
import { DBOX, BOX, MBOX, hideCursor } from './draw';
import { Theme, TextStyle } from './settings';
import { Popup, PopupInputResult } from './popup';
import { FrameBuffer } from './frameBuffer';
import { CheckboxControl } from './checkboxControl';
import { InputControl } from './inputControl';

export type OverwriteChoice = 'overwrite' | 'skip' | 'rename' | 'rename_n' | 'append' | 'keep_largest' | 'keep_newest' | 'cancel';

export interface OverwriteInfo {
    name: string;
    isDir: boolean;
    srcSize: number;
    srcDate: Date;
    dstSize: number;
    dstDate: Date;
    renameN: number;
    renameNName: string;
}

export interface OverwritePopupResult {
    choice: OverwriteChoice;
    remember: boolean;
    renameName?: string;
}

type ResolveCallback = (result: OverwritePopupResult) => void;

const BOX_WIDTH = 70;
const TEXT_WIDTH = 66;

const ROW2_LABELS = ['Append', 'Keep Largest', 'Keep Newest', 'Cancel'];

export class OverwritePopup extends Popup {
    private info: OverwriteInfo | null = null;
    private resolveCallback: ResolveCallback | null = null;
    private checkbox = new CheckboxControl('Remember choice');
    private focusIndex = 1; // 0 = checkbox, 1 = buttons
    private selectedButton = 0; // 0-7
    private row1Labels: string[] = [];
    private renameMode = false;
    private renameInput: InputControl;
    private renameFocusIndex = 0; // 0 = input, 1 = buttons
    private renameButtonGroup = new ButtonGroupSimple(['Ok', 'Cancel']);
    private disabledButtons = new Set<number>();

    constructor() {
        super();
        this.renameInput = new InputControl(TEXT_WIDTH - 2);
    }

    openWith(info: OverwriteInfo, resolve: ResolveCallback): void {
        this.info = info;
        this.resolveCallback = resolve;
        this.row1Labels = ['Overwrite', 'Skip', 'Rename', `Rename (${info.renameN})`];
        this.checkbox = new CheckboxControl('Remember choice');
        this.focusIndex = 1;
        this.selectedButton = 0;
        this.renameMode = false;
        this.renameFocusIndex = 0;
        this.renameButtonGroup = new ButtonGroupSimple(['Ok', 'Cancel']);
        this.disabledButtons = new Set();
        if (info.isDir) {
            this.disabledButtons.add(4); // Append disabled for directories
        }
        super.open();
    }

    private doResolve(result: OverwritePopupResult): void {
        const cb = this.resolveCallback;
        this.resolveCallback = null;
        this.close();
        if (cb) cb(result);
    }

    cancelResolve(): void {
        if (this.resolveCallback) {
            this.doResolve({ choice: 'cancel', remember: false });
        }
    }

    handleInput(data: string): PopupInputResult {
        if (this.renameMode) {
            return this.handleRenameInput(data);
        }
        return this.handleOverwriteInput(data);
    }

    private handleOverwriteInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.doResolve({ choice: 'cancel', remember: false });
            return { action: 'consumed' };
        }

        if (data === '\t') {
            this.focusIndex = this.focusIndex === 0 ? 1 : 0;
            return { action: 'consumed' };
        }
        if (data === '\x1b[Z') {
            this.focusIndex = this.focusIndex === 0 ? 1 : 0;
            return { action: 'consumed' };
        }

        if (this.focusIndex === 0) {
            if (this.checkbox.handleInput(data)) {
                return { action: 'consumed' };
            }
            if (data === '\x1b[B' || data === '\r') {
                this.focusIndex = 1;
                return { action: 'consumed' };
            }
            return { action: 'consumed' };
        }

        // Buttons focused
        if (data === '\x1b[D') {
            this.moveButton(-1);
            return { action: 'consumed' };
        }
        if (data === '\x1b[C') {
            this.moveButton(1);
            return { action: 'consumed' };
        }
        if (data === '\x1b[A') {
            if (this.selectedButton >= 4) {
                this.selectedButton = this.selectedButton - 4;
            } else {
                this.focusIndex = 0;
            }
            return { action: 'consumed' };
        }
        if (data === '\x1b[B') {
            if (this.selectedButton < 4) {
                const target = this.selectedButton + 4;
                if (!this.disabledButtons.has(target)) {
                    this.selectedButton = target;
                } else {
                    for (let i = 4; i < 8; i++) {
                        if (!this.disabledButtons.has(i)) {
                            this.selectedButton = i;
                            break;
                        }
                    }
                }
            }
            return { action: 'consumed' };
        }
        if (data === '\r') {
            this.confirmButton();
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    private moveButton(dir: number): void {
        let next = this.selectedButton + dir;
        if (next < 0) next = 7;
        if (next > 7) next = 0;
        let tries = 8;
        while (this.disabledButtons.has(next) && tries > 0) {
            next += dir;
            if (next < 0) next = 7;
            if (next > 7) next = 0;
            tries--;
        }
        this.selectedButton = next;
    }

    private confirmButton(): void {
        if (this.disabledButtons.has(this.selectedButton)) return;
        const choices: OverwriteChoice[] = ['overwrite', 'skip', 'rename', 'rename_n', 'append', 'keep_largest', 'keep_newest', 'cancel'];
        const choice = choices[this.selectedButton];

        if (choice === 'rename') {
            this.renameMode = true;
            this.renameFocusIndex = 0;
            this.renameInput = new InputControl(TEXT_WIDTH - 2);
            this.renameInput.reset(this.info?.name || '');
            this.renameButtonGroup = new ButtonGroupSimple(['Ok', 'Cancel']);
            return;
        }

        this.doResolve({
            choice,
            remember: this.checkbox.checked,
            renameName: choice === 'rename_n' ? this.info?.renameNName : undefined,
        });
    }

    private handleRenameInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.renameMode = false;
            return { action: 'consumed' };
        }

        if (data === '\t' || data === '\x1b[Z') {
            this.renameFocusIndex = this.renameFocusIndex === 0 ? 1 : 0;
            this.renameInput.resetBlink();
            return { action: 'consumed' };
        }

        if (this.renameFocusIndex === 0) {
            if (data === '\r') {
                this.completeRename();
                return { action: 'consumed' };
            }
            if (this.renameInput.handleInput(data)) {
                this.renameInput.resetBlink();
                return { action: 'consumed' };
            }
            if (data === '\x1b[B') {
                this.renameFocusIndex = 1;
                return { action: 'consumed' };
            }
            return { action: 'consumed' };
        }

        // Buttons focused
        if (data === '\x1b[D' || data === '\x1b[C') {
            this.renameButtonGroup.selectedIndex = this.renameButtonGroup.selectedIndex === 0 ? 1 : 0;
            return { action: 'consumed' };
        }
        if (data === '\r') {
            if (this.renameButtonGroup.selectedIndex === 0) {
                this.completeRename();
            } else {
                this.renameMode = false;
            }
            return { action: 'consumed' };
        }
        if (data === '\x1b[A') {
            this.renameFocusIndex = 0;
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    private completeRename(): void {
        const newName = this.renameInput.buffer.trim();
        if (!newName) return;
        this.doResolve({
            choice: 'rename',
            remember: false,
            renameName: newName,
        });
    }

    // Mouse handling
    override handleMouseDown(row: number, col: number): PopupInputResult {
        const fbRow = row - this.screenRow;
        const fbCol = col - this.screenCol;
        if (fbRow < 0 || fbRow >= this.fbHeight || fbCol < 0 || fbCol >= this.fbWidth) {
            return { action: 'consumed' };
        }
        const result = this.onMouseDown(fbRow, fbCol);
        if (result) return result;
        return { action: 'consumed' };
    }

    override handleMouseUp(row: number, col: number): PopupInputResult {
        const pressedBtn = this.mouseDownButton;
        this.mouseDownButton = -1;
        if (pressedBtn < 0) return { action: 'consumed' };
        const fbRow = row - this.screenRow;
        const fbCol = col - this.screenCol;
        const releasedBtn = this.hitTestButton(fbRow, fbCol);
        if (releasedBtn >= 0 && releasedBtn === pressedBtn) {
            if (this.renameMode) {
                if (releasedBtn === 0) this.completeRename();
                else this.renameMode = false;
                return { action: 'consumed' };
            }
            this.selectedButton = releasedBtn;
            this.focusIndex = 1;
            this.confirmButton();
        }
        return { action: 'consumed' };
    }

    override handleMouseScroll(_up: boolean): PopupInputResult {
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        if (this.renameMode) {
            const btnRow = this.padV + 4;
            if (fbRow === btnRow) {
                const idx = this.hitTestRenameButton(fbRow, fbCol);
                if (idx >= 0) {
                    this.renameFocusIndex = 1;
                    this.renameButtonGroup.selectedIndex = idx;
                    this.mouseDownButton = idx;
                    return { action: 'consumed' };
                }
            }
            if (fbRow === this.padV + 2) {
                this.renameFocusIndex = 0;
                return { action: 'consumed' };
            }
            return null;
        }

        const checkboxRow = this.padV + 7;
        const btnRow1 = this.padV + 9;
        const btnRow2 = this.padV + 10;

        if (this.checkbox.handleClick(fbRow, checkboxRow)) {
            this.focusIndex = 0;
            return { action: 'consumed' };
        }

        if (fbRow === btnRow1 || fbRow === btnRow2) {
            const idx = this.hitTestOverwriteButton(fbRow, fbCol);
            if (idx >= 0) {
                this.focusIndex = 1;
                this.selectedButton = idx;
                this.mouseDownButton = idx;
                return { action: 'consumed' };
            }
        }

        return null;
    }

    protected override hitTestButton(fbRow: number, fbCol: number): number {
        if (this.renameMode) return this.hitTestRenameButton(fbRow, fbCol);
        return this.hitTestOverwriteButton(fbRow, fbCol);
    }

    private hitTestOverwriteButton(fbRow: number, fbCol: number): number {
        const innerWidth = BOX_WIDTH - 2;
        const localCol = fbCol - this.padH - 1;
        if (localCol < 0) return -1;

        if (fbRow === this.padV + 9) {
            const idx = hitTestButtonRow(localCol, innerWidth, this.row1Labels);
            if (idx >= 0 && !this.disabledButtons.has(idx)) return idx;
        }
        if (fbRow === this.padV + 10) {
            const idx = hitTestButtonRow(localCol, innerWidth, ROW2_LABELS);
            if (idx >= 0 && !this.disabledButtons.has(idx + 4)) return idx + 4;
        }
        return -1;
    }

    private hitTestRenameButton(fbRow: number, fbCol: number): number {
        if (fbRow !== this.padV + 4) return -1;
        const innerWidth = BOX_WIDTH - 2;
        const localCol = fbCol - this.padH - 1;
        if (localCol < 0) return -1;
        return this.renameButtonGroup.hitTestCol(localCol, innerWidth);
    }

    // Rendering
    override renderToBuffer(theme: Theme): FrameBuffer {
        if (this.renameMode) return this.renderRenameBuffer(theme);
        return this.renderOverwriteBuffer(theme);
    }

    private renderOverwriteBuffer(theme: Theme): FrameBuffer {
        const bodyStyle = theme.popupWarningBody.idle;
        const boxWidth = BOX_WIDTH;
        const textWidth = TEXT_WIDTH;

        //  Row 0: top border "Warning"
        //  Row 1: "File/Directory already exists"
        //  Row 2: filename (bold)
        //  Row 3: separator
        //  Row 4: New: size date
        //  Row 5: Existing: size date
        //  Row 6: separator
        //  Row 7: checkbox
        //  Row 8: separator
        //  Row 9: button row 1
        //  Row 10: button row 2
        //  Row 11: bottom border
        const boxHeight = 12;
        const totalWidth = boxWidth + this.padH * 2;
        const totalHeight = boxHeight + this.padV * 2;

        const fb = new FrameBuffer(totalWidth, totalHeight);
        fb.fill(0, 0, totalWidth, totalHeight, ' ', bodyStyle);
        fb.drawBox(this.padV, this.padH, boxWidth, boxHeight, bodyStyle, DBOX, 'Warning');

        const textCol = this.padH + 2;
        const innerWidth = boxWidth - 2;

        const kind = this.info?.isDir ? 'Directory' : 'File';
        fb.write(this.padV + 1, textCol, kind + ' already exists', bodyStyle);

        const name = this.info?.name || '';
        const truncName = name.length > textWidth ? '...' + name.slice(name.length - textWidth + 3) : name;
        fb.write(this.padV + 2, textCol, truncName, { ...bodyStyle, bold: true });

        drawSingleSeparator(fb, this.padV + 3, this.padH, boxWidth, bodyStyle);

        if (this.info) {
            const newLine = formatFileStat('New:', this.info.srcSize, this.info.srcDate, textWidth);
            fb.write(this.padV + 4, textCol, newLine, bodyStyle);
            const existLine = formatFileStat('Existing:', this.info.dstSize, this.info.dstDate, textWidth);
            fb.write(this.padV + 5, textCol, existLine, bodyStyle);
        }

        drawSingleSeparator(fb, this.padV + 6, this.padH, boxWidth, bodyStyle);

        const checkFocused = this.focusIndex === 0;
        const checkStyle = checkFocused ? theme.popupWarningButton.selected : bodyStyle;
        fb.blit(this.padV + 7, textCol, this.checkbox.renderToBuffer(bodyStyle, checkStyle, checkFocused));

        drawSingleSeparator(fb, this.padV + 8, this.padH, boxWidth, bodyStyle);

        const btnFocused = this.focusIndex === 1;
        const btnBody = theme.popupWarningBody.idle;
        const btnIdle = theme.popupWarningButton.idle;
        const btnSel = theme.popupWarningButton.selected;

        fb.blit(this.padV + 9, this.padH + 1, renderButtonRow(
            this.row1Labels, innerWidth, btnBody, btnIdle, btnSel,
            btnFocused ? this.selectedButton : -1, 0, this.disabledButtons, true));

        fb.blit(this.padV + 10, this.padH + 1, renderButtonRow(
            ROW2_LABELS, innerWidth, btnBody, btnIdle, btnSel,
            btnFocused ? this.selectedButton : -1, 4, this.disabledButtons, false));

        return fb;
    }

    private renderRenameBuffer(theme: Theme): FrameBuffer {
        const bodyStyle = theme.popupInfoBody.idle;
        const boxWidth = BOX_WIDTH;

        //  Row 0: top border "Rename"
        //  Row 1: "New name:"
        //  Row 2: input
        //  Row 3: separator
        //  Row 4: buttons
        //  Row 5: bottom border
        const boxHeight = 6;
        const totalWidth = boxWidth + this.padH * 2;
        const totalHeight = boxHeight + this.padV * 2;

        const fb = new FrameBuffer(totalWidth, totalHeight);
        fb.fill(0, 0, totalWidth, totalHeight, ' ', bodyStyle);
        fb.drawBox(this.padV, this.padH, boxWidth, boxHeight, bodyStyle, DBOX, 'Rename');

        const textCol = this.padH + 2;
        const innerWidth = boxWidth - 2;

        fb.write(this.padV + 1, textCol, 'New name:', bodyStyle);

        const inputStyle = theme.popupInfoInput.idle;
        const cursorStyle = theme.popupInfoInputCursor.idle;
        fb.blit(this.padV + 2, textCol, this.renameInput.renderToBuffer(
            inputStyle, cursorStyle, this.renameFocusIndex === 0));

        drawSingleSeparator(fb, this.padV + 3, this.padH, boxWidth, bodyStyle);

        fb.blit(this.padV + 4, this.padH + 1, this.renameButtonGroup.renderToBuffer(
            innerWidth, theme.popupInfoBody.idle, theme.popupInfoButton.idle,
            theme.popupInfoButton.selected, this.renameFocusIndex === 1));

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

    // Blink support for rename input
    get isRenameBlink(): boolean {
        return this.active && this.renameMode && this.renameFocusIndex === 0;
    }

    renderOverwriteBlink(rows: number, cols: number, theme: Theme): string {
        if (!this.isRenameBlink) return '';
        const boxStartRow = this.screenRow + this.padV;
        const boxStartCol = this.screenCol + this.padH;
        const nameCol = boxStartCol + 2;
        const inputStyle = theme.popupInfoInput.idle;
        const cursorStyle = theme.popupInfoInputCursor.idle;
        let out = this.renameInput.renderBlink(boxStartRow + 2, nameCol, inputStyle, cursorStyle);
        out += hideCursor();
        return out;
    }

    resetOverwriteBlink(): void {
        this.renameInput.resetBlink();
    }
}

// Simple button group for the rename dialog (reusing ButtonGroup logic inline)
class ButtonGroupSimple {
    labels: string[];
    selectedIndex = 0;

    constructor(labels: string[]) {
        this.labels = labels;
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

    renderToBuffer(width: number, bodyStyle: TextStyle, buttonStyle: TextStyle, selectedStyle: TextStyle, focused: boolean): FrameBuffer {
        const fb = new FrameBuffer(width, 1);
        fb.fill(0, 0, width, 1, ' ', bodyStyle);
        const buttonsW = this.totalWidth;
        const padTotal = width - buttonsW;
        const padLeft = Math.max(0, Math.floor(padTotal / 2));
        let col = padLeft;
        for (let i = 0; i < this.labels.length; i++) {
            if (i > 0) { fb.write(0, col, ' ', bodyStyle); col += 1; }
            const wrap = i === 0 ? ['{ ', ' }'] : ['[ ', ' ]'];
            const style = (focused && i === this.selectedIndex) ? selectedStyle : buttonStyle;
            fb.write(0, col, wrap[0] + this.labels[i] + wrap[1], style);
            col += this.labels[i].length + 4;
        }
        return fb;
    }
}

// Helper functions

function groupDigits(n: number): string {
    const s = String(n);
    const parts: string[] = [];
    for (let i = s.length; i > 0; i -= 3) {
        parts.unshift(s.slice(Math.max(0, i - 3), i));
    }
    return parts.join(',');
}

function formatDateStr(d: Date): string {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function formatFileStat(label: string, size: number, date: Date, width: number): string {
    const dateStr = formatDateStr(date);
    const sizeStr = groupDigits(size);
    const rightPart = sizeStr + '  ' + dateStr;
    const gapSize = Math.max(1, width - label.length - rightPart.length);
    return label + ' '.repeat(gapSize) + rightPart;
}

function drawSingleSeparator(fb: FrameBuffer, row: number, col: number,
                             width: number, style: TextStyle): void {
    const innerWidth = width - 2;
    const line = MBOX.vertDoubleRight
        + BOX.horizontal.repeat(innerWidth)
        + MBOX.vertDoubleLeft;
    fb.write(row, col, line, style);
}

function renderButtonRow(
    labels: string[], width: number,
    bodyStyle: TextStyle, buttonStyle: TextStyle, selectedStyle: TextStyle,
    selectedIndex: number, indexOffset: number,
    disabledIndices: Set<number>, isPrimaryRow: boolean,
): FrameBuffer {
    const fb = new FrameBuffer(width, 1);
    fb.fill(0, 0, width, 1, ' ', bodyStyle);

    let totalBtnWidth = 0;
    for (let i = 0; i < labels.length; i++) {
        if (i > 0) totalBtnWidth += 1;
        totalBtnWidth += labels[i].length + 4;
    }

    const padTotal = width - totalBtnWidth;
    const padLeft = Math.max(0, Math.floor(padTotal / 2));
    let col = padLeft;

    for (let i = 0; i < labels.length; i++) {
        if (i > 0) { fb.write(0, col, ' ', bodyStyle); col += 1; }
        const globalIdx = indexOffset + i;
        const isFirst = isPrimaryRow && i === 0;
        const wrap = isFirst ? ['{ ', ' }'] : ['[ ', ' ]'];
        const isDisabled = disabledIndices.has(globalIdx);
        const isSelected = globalIdx === selectedIndex;
        const style = isDisabled
            ? { ...buttonStyle, dim: true }
            : isSelected ? selectedStyle : buttonStyle;
        const text = wrap[0] + labels[i] + wrap[1];
        fb.write(0, col, text, style);
        col += text.length;
    }

    return fb;
}

function hitTestButtonRow(col: number, width: number, labels: string[]): number {
    let totalBtnWidth = 0;
    for (let i = 0; i < labels.length; i++) {
        if (i > 0) totalBtnWidth += 1;
        totalBtnWidth += labels[i].length + 4;
    }
    const padTotal = width - totalBtnWidth;
    const padLeft = Math.max(0, Math.floor(padTotal / 2));
    let x = padLeft;
    for (let i = 0; i < labels.length; i++) {
        if (i > 0) x += 1;
        const btnWidth = labels[i].length + 4;
        if (col >= x && col < x + btnWidth) return i;
        x += btnWidth;
    }
    return -1;
}
