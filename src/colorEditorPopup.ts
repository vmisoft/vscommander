import { hideCursor, BOX, MBOX } from './draw';
import { Theme, TextStyle, RenderStyle, ColorOverride } from './settings';
import { PopupInputResult } from './popup';
import { ComposedPopup } from './composedPopup';
import { FormTheme } from './formView';
import { InputControl } from './inputControl';
import { CheckboxControl } from './checkboxControl';
import { ButtonGroup } from './buttonGroup';
import { FrameBuffer } from './frameBuffer';
import {
    KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_HOME, KEY_HOME_ALT,
    KEY_END, KEY_END_ALT, KEY_PAGE_UP, KEY_PAGE_DOWN, KEY_TAB, KEY_SHIFT_TAB,
    KEY_ENTER, KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_SPACE,
} from './keys';

interface ElementDef {
    key: string;
    label: string;
    isGroup: boolean;
}

const ELEMENT_DEFS: ElementDef[] = [
    { key: '', label: 'Panel', isGroup: true },
    { key: 'border', label: 'Border', isGroup: false },
    { key: 'directory', label: 'Directory', isGroup: false },
    { key: 'file', label: 'File', isGroup: false },
    { key: 'hiddenDir', label: 'Hidden dir', isGroup: false },
    { key: 'hiddenFile', label: 'Hidden file', isGroup: false },
    { key: 'activePath', label: 'Active path', isGroup: false },
    { key: 'inactivePath', label: 'Inactive path', isGroup: false },
    { key: 'header', label: 'Header', isGroup: false },
    { key: 'info', label: 'Info', isGroup: false },
    { key: 'status', label: 'Status', isGroup: false },
    { key: 'selectedFile', label: 'Selected file', isGroup: false },
    { key: 'selectedDir', label: 'Selected dir', isGroup: false },
    { key: 'symlink', label: 'Symlink arrow', isGroup: false },
    { key: '', label: 'Command line', isGroup: true },
    { key: 'commandLine', label: 'Command line', isGroup: false },
    { key: 'commandLineBusy', label: 'Busy', isGroup: false },
    { key: 'clock', label: 'Clock', isGroup: false },
    { key: 'fkeyNum', label: 'FKey number', isGroup: false },
    { key: 'fkeyLabel', label: 'FKey label', isGroup: false },
    { key: 'fkeyLabelInactive', label: 'FKey inactive', isGroup: false },
    { key: '', label: 'Search', isGroup: true },
    { key: 'searchBody', label: 'Body', isGroup: false },
    { key: 'searchInput', label: 'Input', isGroup: false },
    { key: 'searchCursor', label: 'Cursor', isGroup: false },
    { key: '', label: 'Drive popup', isGroup: true },
    { key: 'driveBody', label: 'Body', isGroup: false },
    { key: 'driveLabel', label: 'Label', isGroup: false },
    { key: 'driveText', label: 'Text', isGroup: false },
    { key: 'driveNumber', label: 'Number', isGroup: false },
    { key: '', label: 'Dialogs', isGroup: true },
    { key: 'confirmBody', label: 'Confirm body', isGroup: false },
    { key: 'confirmButton', label: 'Confirm button', isGroup: false },
    { key: 'dialogBody', label: 'Dialog body', isGroup: false },
    { key: 'dialogInput', label: 'Dialog input', isGroup: false },
    { key: 'dialogInputCursor', label: 'Input cursor', isGroup: false },
    { key: 'dialogLabel', label: 'Dialog label', isGroup: false },
    { key: 'dialogButton', label: 'Dialog button', isGroup: false },
    { key: 'dialogDropdown', label: 'Dropdown', isGroup: false },
    { key: 'dialogHotkey', label: 'Hotkey', isGroup: false },
    { key: '', label: 'Menu', isGroup: true },
    { key: 'menuBar', label: 'Menu bar', isGroup: false },
    { key: 'menuBarHotkey', label: 'Bar hotkey', isGroup: false },
    { key: 'menuItem', label: 'Menu item', isGroup: false },
    { key: 'menuItemHotkey', label: 'Item hotkey', isGroup: false },
    { key: 'menuItemDisabled', label: 'Disabled item', isGroup: false },
    { key: 'menuBorder', label: 'Menu border', isGroup: false },
];

const ANSI_PALETTE: string[] = [
    '@0', '@1', '@2', '@3', '@4', '@5', '@6', '@7',
    '@8', '@9', '@10', '@11', '@12', '@13', '@14', '@15',
];

const ANSI_PREVIEW_COLORS: string[] = [
    '000000', '800000', '008000', '808000', '000080', '800080', '008080', 'c0c0c0',
    '808080', 'ff0000', '00ff00', 'ffff00', '0000ff', 'ff00ff', '00ffff', 'ffffff',
];

const POPUP_WIDTH = 60;
const LIST_WIDTH = 17;
const LIST_HEIGHT = 15;
const CONTENT_HEIGHT = 18;

const FOCUS_LIST = 0;
const FOCUS_STATE = 1;
const FOCUS_FG_GRID = 2;
const FOCUS_FG_HEX = 3;
const FOCUS_BG_GRID = 4;
const FOCUS_BG_HEX = 5;
const FOCUS_BOLD = 6;
const FOCUS_BUTTONS = 7;
const FOCUS_COUNT = 8;

function isAnsiColor(c: string): boolean {
    return c.charCodeAt(0) === 0x40;
}

function ansiIndex(c: string): number {
    if (!isAnsiColor(c)) return -1;
    const idx = c.slice(1);
    if (idx === 'd') return 16;
    return parseInt(idx, 10);
}

function colorFromAnsiIndex(idx: number): string {
    if (idx === 16) return '@d';
    if (idx >= 0 && idx < 16) return ANSI_PALETTE[idx];
    return '@d';
}

function hexFromColor(c: string): string {
    if (isAnsiColor(c)) return '';
    return c;
}

export class ColorEditorPopup extends ComposedPopup {
    private elements = ELEMENT_DEFS;
    private selectableIndices: number[] = [];
    private cursor = 0;
    private scroll = 0;

    private editState: 'idle' | 'selected' = 'idle';
    private fgGridIndex = -1;
    private bgGridIndex = -1;
    private fgHexInput: InputControl;
    private bgHexInput: InputControl;
    private boldCheckbox: CheckboxControl;
    private buttons: ButtonGroup;
    private focusArea = FOCUS_LIST;

    private baseTheme!: Theme;
    private overrides: Record<string, ColorOverride> = {};

    constructor() {
        super();
        this.fgHexInput = new InputControl(6);
        this.bgHexInput = new InputControl(6);
        this.boldCheckbox = new CheckboxControl('Bold');
        this.buttons = new ButtonGroup(['OK', 'Cancel']);
        this.buildSelectableIndices();
    }

    private buildSelectableIndices(): void {
        this.selectableIndices = [];
        for (let i = 0; i < this.elements.length; i++) {
            if (!this.elements[i].isGroup) {
                this.selectableIndices.push(i);
            }
        }
    }

    openWith(baseTheme: Theme, colorOverrides: Record<string, ColorOverride>): void {
        this.baseTheme = baseTheme;
        this.overrides = {};
        for (const key of Object.keys(colorOverrides)) {
            this.overrides[key] = { ...colorOverrides[key] };
        }
        this.cursor = 0;
        this.scroll = 0;
        this.editState = 'idle';
        this.focusArea = FOCUS_LIST;
        this.buttons = new ButtonGroup(['OK', 'Cancel']);
        this.buildSelectableIndices();
        this.loadCurrentElement();
        this.buildView();
        super.open();
    }

    getOverrides(): Record<string, ColorOverride> {
        return this.overrides;
    }

    private buildView(): void {
        const view = this.createView('Colors');
        view.minWidth = POPUP_WIDTH;

        view.addCustom(CONTENT_HEIGHT, true, (fb, row, col, innerWidth, _focused, ft, theme) => {
            this.renderMainContent(fb, row, col, innerWidth, ft, theme);
        }, (absRow, absCol, ft) => {
            return this.renderBlinkContent(absRow, absCol, ft);
        });
        view.addSeparator();
        view.addCustom(1, true, (fb, row, col, innerWidth, _focused, ft) => {
            fb.blit(row, col, this.buttons.renderToBuffer(
                innerWidth, ft.body.idle, ft.button.idle, ft.button.selected,
                this.focusArea === FOCUS_BUTTONS));
        });

        view.onInput = (data) => this.handleColorInput(data);
        view.onScroll = (up) => {
            if (this.focusArea === FOCUS_LIST) {
                this.saveCurrentElement();
                if (up && this.cursor > 0) {
                    this.cursor--;
                } else if (!up && this.cursor < this.selectableIndices.length - 1) {
                    this.cursor++;
                }
                this.ensureVisible();
                this.loadCurrentElement();
            }
        };

        this.setActiveView(view);
    }

    get hasBlink(): boolean {
        return this.focusArea === FOCUS_FG_HEX || this.focusArea === FOCUS_BG_HEX;
    }

    // --- Main content rendering ---

    private renderMainContent(fb: FrameBuffer, row: number, col: number,
                              _innerWidth: number, ft: FormTheme, theme: Theme): void {
        const bodyStyle = ft.body.idle;
        const inputStyle = ft.input.idle;
        const cursorStyle = ft.inputCursor.idle;
        const labelStyle = ft.label.idle;

        const rightLeft = col + LIST_WIDTH + 1;

        for (let r = 0; r < LIST_HEIGHT; r++) {
            fb.write(row + r, col + LIST_WIDTH, BOX.vertical, bodyStyle);
        }

        const visible = this.visibleElements();
        for (let r = 0; r < LIST_HEIGHT; r++) {
            const v = visible.find(ve => ve.displayIdx - this.scroll === r);
            if (!v) {
                fb.fill(row + r, col, LIST_WIDTH, 1, ' ', bodyStyle);
                continue;
            }
            const highlightStyle = v.isCurrent ? inputStyle : bodyStyle;
            fb.fill(row + r, col, LIST_WIDTH, 1, ' ', v.isCurrent ? highlightStyle : bodyStyle);
            if (v.elem.isGroup) {
                fb.write(row + r, col, v.elem.label.slice(0, LIST_WIDTH), labelStyle);
            } else {
                const prefix = v.isCurrent ? '> ' : '  ';
                const text = (prefix + v.elem.label).slice(0, LIST_WIDTH);
                fb.write(row + r, col, text, v.isCurrent ? highlightStyle : bodyStyle);
            }
        }

        const stateLabel = 'State: ';
        fb.write(row, rightLeft + 1, stateLabel, bodyStyle);
        const idleRadio = this.editState === 'idle' ? '(o)' : '( )';
        const selRadio = this.editState === 'selected' ? '(o)' : '( )';
        const stateStyle = this.focusArea === FOCUS_STATE ? inputStyle : bodyStyle;
        fb.write(row, rightLeft + 1 + stateLabel.length, idleRadio + 'Idle ', stateStyle);
        fb.write(row, rightLeft + 1 + stateLabel.length + idleRadio.length + 5, selRadio + 'Selected', stateStyle);

        fb.write(row + 2, rightLeft + 1, 'Foreground:', bodyStyle);
        this.renderGrid(fb, row + 3, rightLeft + 1, this.fgGridIndex, this.focusArea === FOCUS_FG_GRID, theme);

        const dfFg = this.fgGridIndex === 16 ? '<Df>' : ' Df ';
        const dfFgStyle = this.focusArea === FOCUS_FG_GRID && this.fgGridIndex === 16 ? inputStyle : bodyStyle;
        fb.write(row + 5, rightLeft + 1, dfFg, dfFgStyle);
        fb.write(row + 5, rightLeft + 6, 'Hex: ', bodyStyle);
        fb.blit(row + 5, rightLeft + 11, this.fgHexInput.renderToBuffer(inputStyle, cursorStyle, this.focusArea === FOCUS_FG_HEX));

        fb.write(row + 7, rightLeft + 1, 'Background:', bodyStyle);
        this.renderGrid(fb, row + 8, rightLeft + 1, this.bgGridIndex, this.focusArea === FOCUS_BG_GRID, theme);

        const dfBg = this.bgGridIndex === 16 ? '<Df>' : ' Df ';
        const dfBgStyle = this.focusArea === FOCUS_BG_GRID && this.bgGridIndex === 16 ? inputStyle : bodyStyle;
        fb.write(row + 10, rightLeft + 1, dfBg, dfBgStyle);
        fb.write(row + 10, rightLeft + 6, 'Hex: ', bodyStyle);
        fb.blit(row + 10, rightLeft + 11, this.bgHexInput.renderToBuffer(inputStyle, cursorStyle, this.focusArea === FOCUS_BG_HEX));

        const cbFocused = this.focusArea === FOCUS_BOLD;
        const cbStyle = cbFocused ? inputStyle : bodyStyle;
        fb.blit(row + 12, rightLeft + 1, this.boldCheckbox.renderToBuffer(bodyStyle, cbStyle, cbFocused));

        fb.write(row + 14, rightLeft + 1, 'Sample: ', bodyStyle);
        const sampleFg = this.getFgColor();
        const sampleBg = this.getBgColor();
        const sampleStyle: TextStyle = { fg: sampleFg, bg: sampleBg, bold: this.boldCheckbox.checked };
        fb.write(row + 14, rightLeft + 9, 'Sample text', sampleStyle);
    }

    private renderGrid(fb: FrameBuffer, row: number, col: number,
                       selectedIdx: number, focused: boolean, theme: Theme): void {
        const bodyStyle = theme.popupInfoBody.idle;
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 8; c++) {
                const idx = r * 8 + c;
                const x = col + c * 3;
                const color = ANSI_PREVIEW_COLORS[idx];
                const cellStyle: TextStyle = { fg: color, bg: color, bold: false };
                const isSelected = selectedIdx === idx;
                if (isSelected && focused) {
                    fb.write(row + r, x, '<', bodyStyle);
                    fb.write(row + r, x + 1, ' ', cellStyle);
                    fb.write(row + r, x + 2, '>', bodyStyle);
                } else if (isSelected) {
                    fb.write(row + r, x, '[', bodyStyle);
                    fb.write(row + r, x + 1, ' ', cellStyle);
                    fb.write(row + r, x + 2, ']', bodyStyle);
                } else {
                    fb.write(row + r, x, ' ', cellStyle);
                    fb.write(row + r, x + 1, ' ', cellStyle);
                    fb.write(row + r, x + 2, ' ', bodyStyle);
                }
            }
        }
    }

    private renderBlinkContent(absRow: number, absCol: number, ft: FormTheme): string {
        const inputStyle = ft.input.idle;
        const cursorStyle = ft.inputCursor.idle;
        const rightLeft = absCol + LIST_WIDTH + 1;

        let out = '';
        if (this.focusArea === FOCUS_FG_HEX) {
            out += this.fgHexInput.renderBlink(absRow + 5, rightLeft + 11, inputStyle, cursorStyle);
        } else if (this.focusArea === FOCUS_BG_HEX) {
            out += this.bgHexInput.renderBlink(absRow + 10, rightLeft + 11, inputStyle, cursorStyle);
        }
        out += hideCursor();
        return out;
    }

    renderColorEditorBlink(rows: number, cols: number, theme: Theme): string {
        if (!this.active || !this.hasBlink) return '';
        return this.renderBlink(rows, cols, theme);
    }

    resetColorEditorBlink(): void {
        this.fgHexInput.resetBlink();
        this.bgHexInput.resetBlink();
    }

    // --- Input handling ---

    private handleColorInput(data: string): PopupInputResult | null {
        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === KEY_TAB) {
            this.saveCurrentElement();
            this.focusArea = (this.focusArea + 1) % FOCUS_COUNT;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }

        if (data === KEY_SHIFT_TAB) {
            this.saveCurrentElement();
            this.focusArea = (this.focusArea - 1 + FOCUS_COUNT) % FOCUS_COUNT;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }

        switch (this.focusArea) {
            case FOCUS_LIST:
                return this.handleListInput(data);
            case FOCUS_STATE:
                return this.handleStateInput(data);
            case FOCUS_FG_GRID:
                return this.handleGridInput(data, 'fg');
            case FOCUS_FG_HEX:
                return this.handleHexInput(data, this.fgHexInput, 'fg');
            case FOCUS_BG_GRID:
                return this.handleGridInput(data, 'bg');
            case FOCUS_BG_HEX:
                return this.handleHexInput(data, this.bgHexInput, 'bg');
            case FOCUS_BOLD:
                return this.handleBoldInput(data);
            case FOCUS_BUTTONS:
                return this.handleButtonInput(data);
        }
        return { action: 'consumed' };
    }

    private handleListInput(data: string): PopupInputResult {
        if (data === KEY_UP) {
            if (this.cursor > 0) {
                this.saveCurrentElement();
                this.cursor--;
                this.ensureVisible();
                this.loadCurrentElement();
            }
            return { action: 'consumed' };
        }
        if (data === KEY_DOWN) {
            if (this.cursor < this.selectableIndices.length - 1) {
                this.saveCurrentElement();
                this.cursor++;
                this.ensureVisible();
                this.loadCurrentElement();
            }
            return { action: 'consumed' };
        }
        if (data === KEY_HOME || data === KEY_HOME_ALT) {
            this.saveCurrentElement();
            this.cursor = 0;
            this.scroll = 0;
            this.loadCurrentElement();
            return { action: 'consumed' };
        }
        if (data === KEY_END || data === KEY_END_ALT) {
            this.saveCurrentElement();
            this.cursor = this.selectableIndices.length - 1;
            this.ensureVisible();
            this.loadCurrentElement();
            return { action: 'consumed' };
        }
        if (data === KEY_PAGE_UP) {
            this.saveCurrentElement();
            this.cursor = Math.max(0, this.cursor - LIST_HEIGHT);
            this.ensureVisible();
            this.loadCurrentElement();
            return { action: 'consumed' };
        }
        if (data === KEY_PAGE_DOWN) {
            this.saveCurrentElement();
            this.cursor = Math.min(this.selectableIndices.length - 1, this.cursor + LIST_HEIGHT);
            this.ensureVisible();
            this.loadCurrentElement();
            return { action: 'consumed' };
        }
        if (data === KEY_ENTER) {
            this.saveCurrentElement();
            this.focusArea = FOCUS_FG_GRID;
            return { action: 'consumed' };
        }
        return { action: 'consumed' };
    }

    private handleStateInput(data: string): PopupInputResult {
        if (data === KEY_LEFT || data === KEY_RIGHT || data === KEY_SPACE) {
            this.saveCurrentElement();
            this.editState = this.editState === 'idle' ? 'selected' : 'idle';
            this.loadCurrentElement();
            return { action: 'consumed' };
        }
        return { action: 'consumed' };
    }

    private handleGridInput(data: string, which: 'fg' | 'bg'): PopupInputResult {
        const idx = which === 'fg' ? this.fgGridIndex : this.bgGridIndex;
        let newIdx = idx;

        if (data === KEY_RIGHT) {
            if (idx < 0 || idx === 16) newIdx = 0;
            else if (idx < 15) newIdx = idx + 1;
            else newIdx = 16;
        } else if (data === KEY_LEFT) {
            if (idx <= 0) newIdx = 16;
            else if (idx === 16) newIdx = 15;
            else newIdx = idx - 1;
        } else if (data === KEY_DOWN) {
            if (idx >= 0 && idx < 8) newIdx = idx + 8;
            else if (idx >= 8 && idx < 16) newIdx = 16;
            else if (idx === 16) newIdx = 16;
            else newIdx = 0;
        } else if (data === KEY_UP) {
            if (idx >= 8 && idx < 16) newIdx = idx - 8;
            else if (idx === 16) newIdx = 8;
            else if (idx >= 0 && idx < 8) newIdx = idx;
            else newIdx = 0;
        } else if (data === KEY_SPACE || data === KEY_ENTER) {
            this.saveCurrentElement();
            return { action: 'consumed' };
        } else {
            return { action: 'consumed' };
        }

        if (which === 'fg') {
            this.fgGridIndex = newIdx;
            this.fgHexInput.reset('');
        } else {
            this.bgGridIndex = newIdx;
            this.bgHexInput.reset('');
        }
        this.saveCurrentElement();
        return { action: 'consumed' };
    }

    private handleHexInput(data: string, input: InputControl, which: 'fg' | 'bg'): PopupInputResult {
        if (data === KEY_ENTER) {
            if (input.buffer.length === 6 && /^[0-9a-fA-F]{6}$/.test(input.buffer)) {
                if (which === 'fg') this.fgGridIndex = -1;
                else this.bgGridIndex = -1;
                this.saveCurrentElement();
            }
            return { action: 'consumed' };
        }
        const ch = data.length === 1 ? data : '';
        if (ch && /^[0-9a-fA-F]$/.test(ch) && input.buffer.length < 6) {
            input.handleInput(data);
            input.resetBlink();
            if (input.buffer.length === 6 && /^[0-9a-fA-F]{6}$/.test(input.buffer)) {
                if (which === 'fg') this.fgGridIndex = -1;
                else this.bgGridIndex = -1;
                this.saveCurrentElement();
            }
            return { action: 'consumed' };
        }
        if (input.handleInput(data)) {
            input.resetBlink();
            if (input.buffer.length === 6 && /^[0-9a-fA-F]{6}$/.test(input.buffer)) {
                if (which === 'fg') this.fgGridIndex = -1;
                else this.bgGridIndex = -1;
                this.saveCurrentElement();
            }
            return { action: 'consumed' };
        }
        return { action: 'consumed' };
    }

    private handleBoldInput(data: string): PopupInputResult {
        if (this.boldCheckbox.handleInput(data)) {
            this.saveCurrentElement();
            return { action: 'consumed' };
        }
        return { action: 'consumed' };
    }

    private handleButtonInput(data: string): PopupInputResult {
        const result = this.buttons.handleInput(data);
        if (result.confirmed) {
            if (this.buttons.selectedIndex === 1) {
                this.close();
                return { action: 'close', confirm: false };
            }
            this.saveCurrentElement();
            return this.closeWithConfirm();
        }
        if (result.consumed) {
            return { action: 'consumed' };
        }
        return { action: 'consumed' };
    }

    // --- Element state management ---

    private currentElementKey(): string {
        if (this.selectableIndices.length === 0) return '';
        const idx = this.selectableIndices[this.cursor];
        return this.elements[idx].key;
    }

    private getResolvedStyle(): TextStyle {
        const key = this.currentElementKey();
        if (!key) return { fg: '@d', bg: '@d', bold: false };
        const base = (this.baseTheme as unknown as Record<string, RenderStyle>)[key];
        if (!base) return { fg: '@d', bg: '@d', bold: false };
        const ov = this.overrides[key];
        if (this.editState === 'idle') {
            return {
                fg: ov?.fg ?? base.idle.fg,
                bg: ov?.bg ?? base.idle.bg,
                bold: ov?.bold ?? base.idle.bold,
            };
        } else {
            return {
                fg: ov?.selectedFg ?? ov?.fg ?? base.selected.fg,
                bg: ov?.selectedBg ?? ov?.bg ?? base.selected.bg,
                bold: ov?.selectedBold ?? ov?.bold ?? base.selected.bold,
            };
        }
    }

    private loadCurrentElement(): void {
        const style = this.getResolvedStyle();
        this.fgGridIndex = ansiIndex(style.fg);
        this.bgGridIndex = ansiIndex(style.bg);
        this.fgHexInput.reset(hexFromColor(style.fg));
        this.bgHexInput.reset(hexFromColor(style.bg));
        this.boldCheckbox.checked = style.bold;
    }

    private saveCurrentElement(): void {
        const key = this.currentElementKey();
        if (!key) return;
        if (!this.overrides[key]) this.overrides[key] = {};
        const ov = this.overrides[key];

        let fg: string;
        if (this.fgGridIndex >= 0) {
            fg = colorFromAnsiIndex(this.fgGridIndex);
        } else if (this.fgHexInput.buffer.length === 6 && /^[0-9a-fA-F]{6}$/.test(this.fgHexInput.buffer)) {
            fg = this.fgHexInput.buffer.toLowerCase();
        } else {
            fg = this.getResolvedStyle().fg;
        }

        let bg: string;
        if (this.bgGridIndex >= 0) {
            bg = colorFromAnsiIndex(this.bgGridIndex);
        } else if (this.bgHexInput.buffer.length === 6 && /^[0-9a-fA-F]{6}$/.test(this.bgHexInput.buffer)) {
            bg = this.bgHexInput.buffer.toLowerCase();
        } else {
            bg = this.getResolvedStyle().bg;
        }

        if (this.editState === 'idle') {
            ov.fg = fg;
            ov.bg = bg;
            ov.bold = this.boldCheckbox.checked;
        } else {
            ov.selectedFg = fg;
            ov.selectedBg = bg;
            ov.selectedBold = this.boldCheckbox.checked;
        }
    }

    private getFgColor(): string {
        if (this.fgGridIndex >= 0) return colorFromAnsiIndex(this.fgGridIndex);
        if (this.fgHexInput.buffer.length === 6 && /^[0-9a-fA-F]{6}$/.test(this.fgHexInput.buffer)) {
            return this.fgHexInput.buffer.toLowerCase();
        }
        return this.getResolvedStyle().fg;
    }

    private getBgColor(): string {
        if (this.bgGridIndex >= 0) return colorFromAnsiIndex(this.bgGridIndex);
        if (this.bgHexInput.buffer.length === 6 && /^[0-9a-fA-F]{6}$/.test(this.bgHexInput.buffer)) {
            return this.bgHexInput.buffer.toLowerCase();
        }
        return this.getResolvedStyle().bg;
    }

    // --- Scroll / visibility ---

    private ensureVisible(): void {
        const displayIdx = this.cursorDisplayIndex();
        if (displayIdx < this.scroll) {
            this.scroll = displayIdx;
        }
        if (displayIdx >= this.scroll + LIST_HEIGHT) {
            this.scroll = displayIdx - LIST_HEIGHT + 1;
        }
    }

    private cursorDisplayIndex(): number {
        if (this.selectableIndices.length === 0) return 0;
        const elemIdx = this.selectableIndices[this.cursor];
        let displayIdx = 0;
        for (let i = 0; i < this.elements.length && i <= elemIdx; i++) {
            if (i === elemIdx) return displayIdx;
            displayIdx++;
        }
        return displayIdx;
    }

    private visibleElements(): { elem: ElementDef; isCurrent: boolean; displayIdx: number }[] {
        const result: { elem: ElementDef; isCurrent: boolean; displayIdx: number }[] = [];
        const currentElemIdx = this.selectableIndices.length > 0 ? this.selectableIndices[this.cursor] : -1;
        let displayIdx = 0;
        for (let i = 0; i < this.elements.length; i++) {
            if (displayIdx >= this.scroll && displayIdx < this.scroll + LIST_HEIGHT) {
                result.push({
                    elem: this.elements[i],
                    isCurrent: i === currentElemIdx,
                    displayIdx,
                });
            }
            displayIdx++;
            if (displayIdx >= this.scroll + LIST_HEIGHT) break;
        }
        return result;
    }

    private resetActiveBlink(): void {
        this.fgHexInput.resetBlink();
        this.bgHexInput.resetBlink();
    }

    // --- Mouse ---

    override handleMouseScroll(up: boolean): PopupInputResult {
        if (this.focusArea === FOCUS_LIST) {
            this.saveCurrentElement();
            if (up && this.cursor > 0) {
                this.cursor--;
            } else if (!up && this.cursor < this.selectableIndices.length - 1) {
                this.cursor++;
            }
            this.ensureVisible();
            this.loadCurrentElement();
        }
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        const boxRow = this.padV;
        const boxCol = this.padH;
        const listTop = boxRow + 1;
        const listLeft = boxCol + 1;
        const rightLeft = listLeft + LIST_WIDTH + 1;
        const btnRow = boxRow + CONTENT_HEIGHT + 1 + 1;

        if (fbRow >= listTop && fbRow < listTop + LIST_HEIGHT && fbCol >= listLeft && fbCol < listLeft + LIST_WIDTH) {
            this.focusArea = FOCUS_LIST;
            const displayRow = (fbRow - listTop) + this.scroll;
            let displayIdx = 0;
            for (let i = 0; i < this.elements.length; i++) {
                if (displayIdx === displayRow) {
                    if (!this.elements[i].isGroup) {
                        this.saveCurrentElement();
                        const selIdx = this.selectableIndices.indexOf(i);
                        if (selIdx >= 0) {
                            this.cursor = selIdx;
                            this.loadCurrentElement();
                        }
                    }
                    break;
                }
                displayIdx++;
            }
            return { action: 'consumed' };
        }

        if (fbRow === listTop && fbCol >= rightLeft) {
            this.focusArea = FOCUS_STATE;
            this.saveCurrentElement();
            this.editState = this.editState === 'idle' ? 'selected' : 'idle';
            this.loadCurrentElement();
            return { action: 'consumed' };
        }

        if ((fbRow === listTop + 3 || fbRow === listTop + 4) && fbCol >= rightLeft) {
            this.focusArea = FOCUS_FG_GRID;
            const gridCol = Math.floor((fbCol - rightLeft - 1) / 3);
            const gridRow = fbRow - (listTop + 3);
            if (gridCol >= 0 && gridCol < 8 && gridRow >= 0 && gridRow < 2) {
                const idx = gridRow * 8 + gridCol;
                this.fgGridIndex = idx;
                this.fgHexInput.reset('');
                this.saveCurrentElement();
            }
            return { action: 'consumed' };
        }

        if (fbRow === listTop + 5 && fbCol >= rightLeft && fbCol < rightLeft + 5) {
            this.focusArea = FOCUS_FG_GRID;
            this.fgGridIndex = 16;
            this.fgHexInput.reset('');
            this.saveCurrentElement();
            return { action: 'consumed' };
        }

        if (fbRow === listTop + 5 && fbCol >= rightLeft + 11) {
            this.focusArea = FOCUS_FG_HEX;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }

        if ((fbRow === listTop + 8 || fbRow === listTop + 9) && fbCol >= rightLeft) {
            this.focusArea = FOCUS_BG_GRID;
            const gridCol = Math.floor((fbCol - rightLeft - 1) / 3);
            const gridRow = fbRow - (listTop + 8);
            if (gridCol >= 0 && gridCol < 8 && gridRow >= 0 && gridRow < 2) {
                const idx = gridRow * 8 + gridCol;
                this.bgGridIndex = idx;
                this.bgHexInput.reset('');
                this.saveCurrentElement();
            }
            return { action: 'consumed' };
        }

        if (fbRow === listTop + 10 && fbCol >= rightLeft && fbCol < rightLeft + 5) {
            this.focusArea = FOCUS_BG_GRID;
            this.bgGridIndex = 16;
            this.bgHexInput.reset('');
            this.saveCurrentElement();
            return { action: 'consumed' };
        }

        if (fbRow === listTop + 10 && fbCol >= rightLeft + 11) {
            this.focusArea = FOCUS_BG_HEX;
            this.resetActiveBlink();
            return { action: 'consumed' };
        }

        if (fbRow === listTop + 12 && fbCol >= rightLeft) {
            this.focusArea = FOCUS_BOLD;
            this.boldCheckbox.toggle();
            this.saveCurrentElement();
            return { action: 'consumed' };
        }

        if (fbRow === btnRow) {
            this.focusArea = FOCUS_BUTTONS;
            const localCol = fbCol - boxCol - 1;
            if (localCol >= 0) {
                const innerW = POPUP_WIDTH - 2;
                const idx = this.buttons.hitTestCol(localCol, innerW);
                if (idx >= 0) {
                    this.buttons.selectedIndex = idx;
                    this.mouseDownButton = idx;
                }
            }
            return { action: 'consumed' };
        }

        return null;
    }

    protected override hitTestButton(fbRow: number, fbCol: number): number {
        const boxRow = this.padV;
        const boxCol = this.padH;
        const btnRow = boxRow + CONTENT_HEIGHT + 1 + 1;
        if (fbRow === btnRow) {
            const localCol = fbCol - boxCol - 1;
            if (localCol >= 0) {
                const innerW = POPUP_WIDTH - 2;
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
        this.saveCurrentElement();
        return this.closeWithConfirm();
    }
}
