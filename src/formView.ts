import { hideCursor, DBOX, BOX, MBOX } from './draw';
import { KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_TAB, KEY_SHIFT_TAB, KEY_UP, KEY_DOWN, KEY_ENTER, KEY_LEFT, KEY_RIGHT } from './keys';
import { RenderStyle, Theme } from './settings';
import { InputControl } from './inputControl';
import { ButtonGroup } from './buttonGroup';
import { CheckboxControl } from './checkboxControl';
import { DropdownControl, DropdownOption } from './dropdownControl';
import { FrameBuffer, BoxChars } from './frameBuffer';
import { PopupInputResult } from './popup';

// --- FormTheme: abstract theme mapping for popup components ---

export interface FormTheme {
    body: RenderStyle;
    label: RenderStyle;
    input: RenderStyle;
    inputCursor: RenderStyle;
    button: RenderStyle;
    hotkey: RenderStyle;
    dropdown: RenderStyle;
    border?: RenderStyle;
}

export type ThemeResolver = (theme: Theme) => FormTheme;

export function infoFormTheme(theme: Theme): FormTheme {
    return {
        body: theme.popupInfoBody,
        label: theme.popupInfoLabel,
        input: theme.popupInfoInput,
        inputCursor: theme.popupInfoInputCursor,
        button: theme.popupInfoButton,
        hotkey: theme.popupInfoHotkey,
        dropdown: theme.popupInfoDropdown,
    };
}

export function warningFormTheme(theme: Theme): FormTheme {
    return {
        body: theme.popupWarningBody,
        label: { idle: theme.popupWarningBody.idle, selected: theme.popupWarningBody.idle },
        input: theme.popupInfoInput,
        inputCursor: theme.popupInfoInputCursor,
        button: theme.popupWarningButton,
        hotkey: { idle: theme.popupWarningBody.idle, selected: theme.popupWarningBody.idle },
        dropdown: theme.popupInfoDropdown,
    };
}

export function searchFormTheme(theme: Theme): FormTheme {
    return {
        body: theme.searchBody,
        label: theme.searchBody,
        input: theme.searchInput,
        inputCursor: theme.searchCursor,
        button: theme.searchBody,
        hotkey: theme.searchBody,
        dropdown: theme.searchBody,
    };
}

export function actionFormTheme(theme: Theme): FormTheme {
    return {
        body: theme.popupActionBody,
        label: theme.popupActionLabel,
        input: theme.popupInfoInput,
        inputCursor: theme.popupInfoInputCursor,
        button: theme.popupInfoButton,
        hotkey: theme.popupActionNumber,
        dropdown: theme.popupInfoDropdown,
    };
}

export function helpFormTheme(theme: Theme): FormTheme {
    return {
        body: theme.helpBody,
        label: theme.helpBold,
        input: theme.popupInfoInput,
        inputCursor: theme.popupInfoInputCursor,
        button: theme.popupInfoButton,
        hotkey: theme.helpBold,
        border: theme.popupActionBody,
        dropdown: theme.popupInfoDropdown,
    };
}

export function menuFormTheme(theme: Theme): FormTheme {
    return {
        body: { idle: theme.menuItem.idle, selected: theme.menuItem.selected },
        label: { idle: theme.menuItem.idle, selected: theme.menuItem.selected },
        input: theme.menuItem,
        inputCursor: theme.menuItem,
        button: theme.menuItem,
        hotkey: theme.menuItemHotkey,
        dropdown: theme.menuItem,
    };
}

// --- FormElement interface ---

export interface FormElement {
    readonly type: string;
    readonly height: number;
    readonly focusable: boolean;
    readonly contentWidth?: number;
    id?: string;
    hotkeyChar?: string;

    render(fb: FrameBuffer, row: number, col: number,
           innerWidth: number, focused: boolean, ft: FormTheme, theme: Theme): void;
    handleInput?(data: string): boolean;
    hasBlink?: boolean;
    renderBlink?(absRow: number, absCol: number, ft: FormTheme): string;
    hitTest?(relRow: number, relCol: number, innerWidth: number): boolean;
    renderOverlay?(fb: FrameBuffer, row: number, col: number, innerWidth: number, ft: FormTheme): void;
}

export interface LabelOpts {
    hotkey?: string;
    centered?: boolean;
}

export interface InputOpts {
    label?: string;
    labelWidth?: number;
    hotkey?: string;
}

export interface ListConfig {
    getCount(): number;
    getHeight(): number;
    renderItems(fb: FrameBuffer, row: number, col: number,
                width: number, ft: FormTheme, theme: Theme): void;
}

export type CustomRenderer = (fb: FrameBuffer, row: number, col: number,
                               innerWidth: number, focused: boolean, ft: FormTheme, theme: Theme) => void;

export type CustomBlinkRenderer = (absRow: number, absCol: number, ft: FormTheme) => string;

// --- Element implementations ---

class LabelElement implements FormElement {
    readonly type = 'label';
    readonly height = 1;
    readonly focusable = false;
    hotkeyChar?: string;
    centered: boolean;

    constructor(private text: string, opts?: LabelOpts) {
        this.hotkeyChar = opts?.hotkey;
        this.centered = opts?.centered ?? false;
    }

    get contentWidth(): number {
        return this.text.length + 1;
    }

    render(fb: FrameBuffer, row: number, col: number,
           innerWidth: number, _focused: boolean, ft: FormTheme, _theme: Theme): void {
        const bodyStyle = ft.body.idle;
        const labelStyle = ft.label.idle;
        const hotkeyStyle = ft.hotkey.idle;

        if (this.centered) {
            const pad = Math.max(0, Math.floor((innerWidth - this.text.length) / 2));
            fb.write(row, col, ' '.repeat(innerWidth), bodyStyle);
            fb.write(row, col + pad, this.text, labelStyle);
        } else {
            const padded = ' ' + this.text + ' '.repeat(Math.max(0, innerWidth - this.text.length - 1));
            fb.write(row, col, padded, labelStyle);
            if (this.hotkeyChar) {
                const idx = this.text.indexOf(this.hotkeyChar);
                if (idx >= 0) {
                    fb.write(row, col + 1 + idx, this.hotkeyChar, hotkeyStyle);
                }
            }
        }
    }
}

class InputElement implements FormElement {
    readonly type = 'input';
    readonly height = 1;
    readonly focusable = true;
    readonly hasBlink = true;
    id?: string;
    hotkeyChar?: string;
    readonly control: InputControl;
    private _label?: string;
    private _labelWidth: number;

    constructor(id: string, width: number, initial?: string, opts?: InputOpts) {
        this.id = id;
        this._label = opts?.label;
        this._labelWidth = opts?.labelWidth ?? 0;
        this.hotkeyChar = opts?.hotkey;
        this.control = new InputControl(width);
        if (initial !== undefined) {
            this.control.reset(initial);
        }
    }

    get labelWidth(): number { return this._labelWidth; }
    get label(): string | undefined { return this._label; }

    get contentWidth(): number {
        return (this._label ? this._labelWidth : 1) + this.control.width;
    }

    render(fb: FrameBuffer, row: number, col: number,
           _innerWidth: number, focused: boolean, ft: FormTheme, _theme: Theme): void {
        const inputStyle = ft.input.idle;
        const cursorStyle = ft.inputCursor.idle;

        let inputCol = col + 1;
        if (this._label) {
            fb.write(row, col, ' ' + this._label + ' '.repeat(Math.max(0, this._labelWidth - this._label.length - 1)), ft.body.idle);
            if (this.hotkeyChar) {
                const idx = this._label.indexOf(this.hotkeyChar);
                if (idx >= 0) {
                    fb.write(row, col + 1 + idx, this.hotkeyChar, ft.hotkey.idle);
                }
            }
            inputCol = col + this._labelWidth;
        }

        fb.blit(row, inputCol, this.control.renderToBuffer(inputStyle, cursorStyle, focused));
    }

    handleInput(data: string): boolean {
        const consumed = this.control.handleInput(data);
        if (consumed) this.control.resetBlink();
        return consumed;
    }

    renderBlink(absRow: number, absCol: number, ft: FormTheme): string {
        const inputStyle = ft.input.idle;
        const cursorStyle = ft.inputCursor.idle;
        let blinkCol = absCol + 1;
        if (this._label) {
            blinkCol = absCol + this._labelWidth;
        }
        return this.control.renderBlink(absRow, blinkCol, inputStyle, cursorStyle);
    }

    hitTest(_relRow: number, _relCol: number, _innerWidth: number): boolean {
        return true;
    }
}

class SeparatorElement implements FormElement {
    readonly type = 'separator';
    readonly height = 1;
    readonly focusable = false;
    private boxChars: BoxChars;
    private _label?: string;

    constructor(boxChars: BoxChars, label?: string) {
        this.boxChars = boxChars;
        this._label = label;
    }

    render(fb: FrameBuffer, row: number, col: number,
           innerWidth: number, _focused: boolean, ft: FormTheme, _theme: Theme): void {
        const sepStyle = ft.border ? ft.border.idle : ft.body.idle;
        const leftChar = this.boxChars === DBOX ? MBOX.vertDoubleRight : BOX.teeRight;
        const rightChar = this.boxChars === DBOX ? MBOX.vertDoubleLeft : BOX.teeLeft;

        if (this._label) {
            const text = ' ' + this._label + ' ';
            const fillArea = innerWidth;
            const fillLeft = Math.floor((fillArea - text.length) / 2);
            const fillRight = fillArea - text.length - fillLeft;
            const line = leftChar + BOX.horizontal.repeat(fillLeft) + text + BOX.horizontal.repeat(fillRight) + rightChar;
            fb.write(row, col - 1, line, sepStyle);
        } else {
            fb.drawSeparator(row, col - 1, innerWidth + 2, sepStyle, leftChar, BOX.horizontal, rightChar);
        }
    }
}

class ButtonsElement implements FormElement {
    readonly type = 'buttons';
    readonly height = 1;
    readonly focusable = true;
    id?: string;
    readonly group: ButtonGroup;

    constructor(id: string, labels: string[]) {
        this.id = id;
        this.group = new ButtonGroup(labels);
    }

    get contentWidth(): number {
        return this.group.totalWidth + 2;
    }

    render(fb: FrameBuffer, row: number, col: number,
           innerWidth: number, focused: boolean, ft: FormTheme, _theme: Theme): void {
        const bodyStyle = ft.body.idle;
        const buttonStyle = ft.button.idle;
        const selectedStyle = ft.button.selected;
        fb.blit(row, col, this.group.renderToBuffer(innerWidth, bodyStyle, buttonStyle, selectedStyle, focused));
    }

    handleInput(data: string): boolean {
        const result = this.group.handleInput(data);
        return result.consumed;
    }

    hitTest(_relRow: number, relCol: number, innerWidth: number): boolean {
        const idx = this.group.hitTestCol(relCol, innerWidth);
        if (idx >= 0) {
            this.group.selectedIndex = idx;
            return true;
        }
        return false;
    }
}

class RadioElement implements FormElement {
    readonly type = 'radio';
    readonly height = 1;
    readonly focusable = true;
    id?: string;
    label: string;
    options: string[];
    selected: number;

    constructor(id: string, label: string, options: string[], selected: number = 0) {
        this.id = id;
        this.label = label;
        this.options = options;
        this.selected = selected;
    }

    get contentWidth(): number {
        let w = 1 + this.label.length + 1;
        for (let i = 0; i < this.options.length; i++) {
            if (i > 0) w += 5;
            w += this.options[i].length;
        }
        return w;
    }

    render(fb: FrameBuffer, row: number, col: number,
           innerWidth: number, focused: boolean, ft: FormTheme, _theme: Theme): void {
        const bodyStyle = ft.body.idle;
        const labelStyle = ft.label.idle;
        const hotkeyStyle = ft.hotkey.idle;
        const selectedStyle = ft.button.selected;

        fb.write(row, col, ' '.repeat(innerWidth), bodyStyle);
        fb.write(row, col, ' ' + this.label + ' ', labelStyle);

        let x = col + this.label.length + 2;
        for (let i = 0; i < this.options.length; i++) {
            if (i > 0) {
                fb.write(row, x, '  /  ', bodyStyle);
                x += 5;
            }
            const isActive = i === this.selected;
            const style = isActive
                ? (focused ? selectedStyle : hotkeyStyle)
                : bodyStyle;
            fb.write(row, x, this.options[i], style);
            x += this.options[i].length;
        }
    }

    handleInput(data: string): boolean {
        if (data === KEY_LEFT || data === KEY_RIGHT) {
            this.selected = this.selected === 0 ? this.options.length - 1 :
                (this.selected - 1 + this.options.length) % this.options.length;
            if (data === KEY_RIGHT) {
                this.selected = (this.selected + 2) % this.options.length;
            }
            return true;
        }
        return false;
    }

    hitTest(_relRow: number, _relCol: number, _innerWidth: number): boolean {
        this.selected = (this.selected + 1) % this.options.length;
        return true;
    }
}

class CheckboxElement implements FormElement {
    readonly type = 'checkbox';
    readonly height = 1;
    readonly focusable = true;
    id?: string;
    hotkeyChar?: string;
    readonly control: CheckboxControl;

    constructor(id: string, label: string, checked: boolean, hotkey?: string) {
        this.id = id;
        this.hotkeyChar = hotkey;
        this.control = new CheckboxControl(label, checked);
    }

    get contentWidth(): number {
        return 1 + 4 + this.control.label.length;
    }

    render(fb: FrameBuffer, row: number, col: number,
           _innerWidth: number, focused: boolean, ft: FormTheme, _theme: Theme): void {
        const bodyStyle = ft.body.idle;
        const focusedStyle = ft.input.idle;
        fb.blit(row, col + 1, this.control.renderToBuffer(bodyStyle, focusedStyle, focused));
        if (this.hotkeyChar) {
            const label = this.control.label;
            const idx = label.indexOf(this.hotkeyChar);
            if (idx >= 0) {
                fb.write(row, col + 1 + 4 + idx, this.hotkeyChar, ft.hotkey.idle);
            }
        }
    }

    handleInput(data: string): boolean {
        return this.control.handleInput(data);
    }

    hitTest(_relRow: number, _relCol: number, _innerWidth: number): boolean {
        this.control.toggle();
        return true;
    }
}

class DropdownElement implements FormElement {
    readonly type = 'dropdown';
    readonly height = 1;
    readonly focusable = true;
    id?: string;
    hotkeyChar?: string;
    readonly control: DropdownControl;
    private _label?: string;
    private _labelWidth: number;

    constructor(id: string, options: DropdownOption[], width: number, selected: number,
                label?: string, labelWidth?: number, hotkey?: string) {
        this.id = id;
        this._label = label;
        this._labelWidth = labelWidth ?? 0;
        this.hotkeyChar = hotkey;
        this.control = new DropdownControl(options, width);
        this.control.selectedIndex = selected;
    }

    get contentWidth(): number {
        return (this._label ? this._labelWidth : 1) + this.control.width;
    }

    render(fb: FrameBuffer, row: number, col: number,
           _innerWidth: number, focused: boolean, ft: FormTheme, _theme: Theme): void {
        let dropCol = col + 1;
        if (this._label) {
            fb.write(row, col, ' ' + this._label + ' '.repeat(Math.max(0, this._labelWidth - this._label.length - 1)), ft.body.idle);
            if (this.hotkeyChar) {
                const idx = this._label.indexOf(this.hotkeyChar);
                if (idx >= 0) {
                    fb.write(row, col + 1 + idx, this.hotkeyChar, ft.hotkey.idle);
                }
            }
            dropCol = col + this._labelWidth;
        }

        const dropFieldStyle = focused ? ft.dropdown.idle : ft.input.idle;
        fb.blit(row, dropCol, this.control.renderToBuffer(ft.input.idle, dropFieldStyle, focused));
    }

    handleInput(data: string): boolean {
        return this.control.handleInput(data);
    }

    hitTest(_relRow: number, _relCol: number, _innerWidth: number): boolean {
        return true;
    }

    renderOverlay(fb: FrameBuffer, row: number, col: number, _innerWidth: number, ft: FormTheme): void {
        if (!this.control.isOpen) return;
        let dropCol = col + 1;
        if (this._label) {
            dropCol = col + this._labelWidth;
        }
        fb.blit(row + 1, dropCol - 1, this.control.renderPopupToBuffer(
            ft.body.idle, ft.input.idle, ft.dropdown.selected
        ));
    }
}

export class BodyTextElement implements FormElement {
    readonly type = 'bodyText';
    readonly focusable = false;
    id?: string;
    private lines: string[];
    private autoTruncate: boolean;

    constructor(lines: string[], autoTruncate: boolean = false, id?: string) {
        this.lines = lines;
        this.autoTruncate = autoTruncate;
        this.id = id;
    }

    get height(): number {
        return this.lines.length;
    }

    get contentWidth(): number {
        let max = 0;
        for (const line of this.lines) {
            const w = BodyTextElement.displayLen(line);
            if (w > max) max = w;
        }
        return max;
    }

    setLines(newLines: string[]): void {
        this.lines = newLines;
    }

    render(fb: FrameBuffer, row: number, col: number,
           innerWidth: number, _focused: boolean, ft: FormTheme, _theme: Theme): void {
        const bodyStyle = ft.body.idle;
        for (let i = 0; i < this.lines.length; i++) {
            let line = this.lines[i];
            if (this.autoTruncate) {
                line = BodyTextElement.truncateMarkup(line, innerWidth);
            }
            const displayLen = BodyTextElement.displayLen(line);
            const padTotal = innerWidth - displayLen;
            const padLeft = Math.max(0, Math.floor(padTotal / 2));
            const rowIdx = row + i;

            fb.write(rowIdx, col, ' '.repeat(innerWidth), bodyStyle);

            const parts = line.split('*');
            let x = col + padLeft;
            for (let j = 0; j < parts.length; j++) {
                if (parts[j].length === 0) continue;
                const isBold = j % 2 === 1;
                const segStyle = isBold ? { ...bodyStyle, bold: true } : bodyStyle;
                fb.write(rowIdx, x, parts[j], segStyle);
                x += parts[j].length;
            }
        }
    }

    static displayLen(text: string): number {
        return text.replace(/\*/g, '').length;
    }

    static truncateMarkup(text: string, maxWidth: number): string {
        const displayLen = BodyTextElement.displayLen(text);
        if (displayLen <= maxWidth) return text;
        if (maxWidth <= 3) return text.replace(/\*/g, '').slice(0, maxWidth);
        const plain = text.replace(/\*/g, '');
        return '...' + plain.slice(plain.length - maxWidth + 3);
    }
}

class ListElement implements FormElement {
    readonly type = 'list';
    readonly focusable = true;
    id?: string;
    private config: ListConfig;

    constructor(id: string, config: ListConfig) {
        this.id = id;
        this.config = config;
    }

    get height(): number {
        return this.config.getHeight();
    }

    render(fb: FrameBuffer, row: number, col: number,
           innerWidth: number, _focused: boolean, ft: FormTheme, theme: Theme): void {
        this.config.renderItems(fb, row, col, innerWidth, ft, theme);
    }
}

class CustomElement implements FormElement {
    readonly type = 'custom';
    readonly focusable: boolean;
    readonly hasBlink?: boolean;
    id?: string;
    private _height: number | (() => number);
    private renderer: CustomRenderer;
    private blinkRenderer?: CustomBlinkRenderer;

    constructor(height: number | (() => number), focusable: boolean, renderer: CustomRenderer,
                blinkRenderer?: CustomBlinkRenderer, id?: string) {
        this._height = height;
        this.focusable = focusable;
        this.renderer = renderer;
        this.blinkRenderer = blinkRenderer;
        if (blinkRenderer) this.hasBlink = true;
        this.id = id;
    }

    get height(): number {
        return typeof this._height === 'function' ? this._height() : this._height;
    }

    render(fb: FrameBuffer, row: number, col: number,
           innerWidth: number, focused: boolean, ft: FormTheme, theme: Theme): void {
        this.renderer(fb, row, col, innerWidth, focused, ft, theme);
    }

    renderBlink(absRow: number, absCol: number, ft: FormTheme): string {
        if (this.blinkRenderer) {
            return this.blinkRenderer(absRow, absCol, ft);
        }
        return '';
    }
}

// --- FormView ---

export class FormView {
    title: string;
    elements: FormElement[] = [];
    focusIndex = 0;
    boxChars: BoxChars;
    minWidth = 0;
    resolveTheme: ThemeResolver;

    onInput?: (data: string) => PopupInputResult | null;
    onConfirm?: () => PopupInputResult;
    onCancel?: () => PopupInputResult;
    onScroll?: (up: boolean) => void;

    constructor(title: string, boxChars?: BoxChars, themeResolver?: ThemeResolver) {
        this.title = title;
        this.boxChars = boxChars ?? DBOX;
        this.resolveTheme = themeResolver ?? infoFormTheme;
    }

    // --- Builder methods ---

    addLabel(text: string, opts?: LabelOpts): this {
        this.elements.push(new LabelElement(text, opts));
        return this;
    }

    addInput(id: string, width: number, initial?: string, opts?: InputOpts): this {
        const el = new InputElement(id, width, initial, opts);
        this.elements.push(el);
        return this;
    }

    addSeparator(label?: string): this {
        this.elements.push(new SeparatorElement(this.boxChars, label));
        return this;
    }

    addButtons(id: string, labels: string[]): this {
        const el = new ButtonsElement(id, labels);
        this.elements.push(el);
        return this;
    }

    addRadio(id: string, label: string, options: string[], selected?: number): this {
        const el = new RadioElement(id, label, options, selected);
        this.elements.push(el);
        return this;
    }

    addCheckbox(id: string, label: string, checked?: boolean, hotkey?: string): this {
        const el = new CheckboxElement(id, label, checked ?? false, hotkey);
        this.elements.push(el);
        return this;
    }

    addDropdown(id: string, options: DropdownOption[], width: number, selected?: number,
                label?: string, labelWidth?: number, hotkey?: string): this {
        const el = new DropdownElement(id, options, width, selected ?? 0, label, labelWidth, hotkey);
        this.elements.push(el);
        return this;
    }

    addBodyText(lines: string[], autoTruncate?: boolean, id?: string): this {
        this.elements.push(new BodyTextElement(lines, autoTruncate, id));
        return this;
    }

    addList(id: string, config: ListConfig): this {
        const el = new ListElement(id, config);
        this.elements.push(el);
        return this;
    }

    addCustom(height: number | (() => number), focusable: boolean, renderer: CustomRenderer,
              blinkRenderer?: CustomBlinkRenderer, id?: string): this {
        this.elements.push(new CustomElement(height, focusable, renderer, blinkRenderer, id));
        return this;
    }

    // --- Value access ---

    input(id: string): InputControl {
        for (const el of this.elements) {
            if (el.id === id && el.type === 'input') {
                return (el as InputElement).control;
            }
        }
        throw new Error('Input not found: ' + id);
    }

    buttons(id: string): ButtonGroup {
        for (const el of this.elements) {
            if (el.id === id && el.type === 'buttons') {
                return (el as ButtonsElement).group;
            }
        }
        throw new Error('Buttons not found: ' + id);
    }

    radioValue(id: string): number {
        for (const el of this.elements) {
            if (el.id === id && el.type === 'radio') {
                return (el as RadioElement).selected;
            }
        }
        return 0;
    }

    setRadioValue(id: string, value: number): void {
        for (const el of this.elements) {
            if (el.id === id && el.type === 'radio') {
                (el as RadioElement).selected = value;
                return;
            }
        }
    }

    checkbox(id: string): CheckboxControl {
        for (const el of this.elements) {
            if (el.id === id && el.type === 'checkbox') {
                return (el as CheckboxElement).control;
            }
        }
        throw new Error('Checkbox not found: ' + id);
    }

    dropdown(id: string): DropdownControl {
        for (const el of this.elements) {
            if (el.id === id && el.type === 'dropdown') {
                return (el as DropdownElement).control;
            }
        }
        throw new Error('Dropdown not found: ' + id);
    }

    // --- Layout ---

    get contentHeight(): number {
        let h = 0;
        for (const el of this.elements) {
            h += el.height;
        }
        return h;
    }

    get boxHeight(): number {
        return this.contentHeight + 2;
    }

    // --- Rendering ---

    render(theme: Theme, padH: number, padV: number, termCols: number): FrameBuffer {
        const ft = this.resolveTheme(theme);
        const titleW = this.title.length + 4;
        let maxElementW = 0;
        for (const el of this.elements) {
            if (el.contentWidth !== undefined && el.contentWidth > maxElementW) {
                maxElementW = el.contentWidth;
            }
        }
        let boxW = Math.max(titleW, this.minWidth, maxElementW + 2);
        const maxW = Math.max(20, termCols - 2 * padH);
        if (boxW > maxW) boxW = maxW;

        const innerW = boxW - 2;
        const totalW = boxW + 2 * padH;
        const bh = this.boxHeight;
        const totalH = bh + 2 * padV;
        const boxRow = padV;
        const boxCol = padH;
        const bodyStyle = ft.body.idle;
        const borderStyle = ft.border ? ft.border.idle : bodyStyle;

        const fb = new FrameBuffer(totalW, totalH);
        fb.fill(0, 0, totalW, totalH, ' ', bodyStyle);
        fb.drawBox(boxRow, boxCol, boxW, bh, borderStyle, this.boxChars, this.title);

        let currentRow = boxRow + 1;
        for (let i = 0; i < this.elements.length; i++) {
            const el = this.elements[i];
            const isFocused = this.isFocusable(i) && this.focusIndex === this.focusableIndex(i);
            el.render(fb, currentRow, boxCol + 1, innerW, isFocused, ft, theme);
            currentRow += el.height;
        }

        // Render overlays (e.g. open dropdowns) after all elements
        currentRow = boxRow + 1;
        for (const el of this.elements) {
            if (el.renderOverlay) {
                el.renderOverlay(fb, currentRow, boxCol + 1, innerW, ft);
            }
            currentRow += el.height;
        }

        return fb;
    }

    // --- Input handling ---

    handleInput(data: string): PopupInputResult {
        if (this.onInput) {
            const result = this.onInput(data);
            if (result) return result;
        }

        // Alt+letter hotkeys (close dropdowns first)
        if (data.length === 2 && data[0] === KEY_ESCAPE) {
            const letter = data[1].toLowerCase();
            // Check labels for hotkey -> focus next focusable after label
            let afterLabel = false;
            for (let i = 0; i < this.elements.length; i++) {
                const el = this.elements[i];
                if (el.type === 'label') {
                    const lbl = el as LabelElement;
                    if (lbl.hotkeyChar && lbl.hotkeyChar.toLowerCase() === letter) {
                        afterLabel = true;
                        continue;
                    }
                }
                if (afterLabel && el.focusable) {
                    this.closeDropdowns();
                    this.setFocusToElement(i);
                    this.resetBlinks();
                    if (el.type === 'checkbox') {
                        (el as CheckboxElement).control.toggle();
                    }
                    return { action: 'consumed' };
                }
                if (afterLabel) afterLabel = false;
            }
            // Check focusable elements with hotkeyChar
            for (let i = 0; i < this.elements.length; i++) {
                const el = this.elements[i];
                if (el.focusable && el.hotkeyChar && el.hotkeyChar.toLowerCase() === letter) {
                    this.closeDropdowns();
                    this.setFocusToElement(i);
                    this.resetBlinks();
                    if (el.type === 'checkbox') {
                        (el as CheckboxElement).control.toggle();
                    }
                    return { action: 'consumed' };
                }
            }
        }

        // Route to open dropdown first (it consumes all keys while open)
        const openDrop = this.findOpenDropdown();
        if (openDrop) {
            openDrop.control.handleInput(data);
            return { action: 'consumed' };
        }

        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            if (this.onCancel) return this.onCancel();
            return { action: 'close', confirm: false };
        }

        if (data === KEY_TAB) {
            this.advanceFocus(1);
            this.resetBlinks();
            return { action: 'consumed' };
        }

        if (data === KEY_SHIFT_TAB) {
            this.advanceFocus(-1);
            this.resetBlinks();
            return { action: 'consumed' };
        }

        const focused = this.focusedElement();
        if (focused) {
            if (focused.type === 'buttons') {
                const btnEl = focused as ButtonsElement;
                const result = btnEl.group.handleInput(data);
                if (result.confirmed) {
                    if (btnEl.group.selectedIndex === btnEl.group.labels.indexOf('Cancel')) {
                        if (this.onCancel) return this.onCancel();
                        return { action: 'close', confirm: false };
                    }
                    if (this.onConfirm) return this.onConfirm();
                    return { action: 'close', confirm: true };
                }
                if (result.consumed) return { action: 'consumed' };
            } else if (focused.handleInput) {
                if (focused.handleInput(data)) return { action: 'consumed' };
            }
        }

        if (data === KEY_ENTER && (!focused || focused.type !== 'buttons')) {
            if (this.onConfirm) return this.onConfirm();
            return { action: 'close', confirm: true };
        }

        if (data === KEY_UP) {
            if (this.focusIndex > 0) {
                this.focusIndex--;
                this.resetBlinks();
            }
            return { action: 'consumed' };
        }

        if (data === KEY_DOWN) {
            const focusables = this.focusableElements();
            if (this.focusIndex < focusables.length - 1) {
                this.focusIndex++;
                this.resetBlinks();
            }
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    // --- Blink ---

    get hasBlink(): boolean {
        const focused = this.focusedElement();
        return focused !== null && focused.hasBlink === true;
    }

    renderBlink(screenRow: number, screenCol: number,
                padH: number, padV: number, theme: Theme): string {
        const focused = this.focusedElement();
        if (!focused || !focused.hasBlink || !focused.renderBlink) return '';

        const ft = this.resolveTheme(theme);
        const boxRow = padV;
        const boxCol = padH;
        let row = boxRow + 1;
        for (const el of this.elements) {
            if (el === focused) break;
            row += el.height;
        }

        const absRow = screenRow + row;
        const absCol = screenCol + boxCol + 1;
        return focused.renderBlink(absRow, absCol, ft) + hideCursor();
    }

    // --- Mouse ---

    hitTest(fbRow: number, fbCol: number, padH: number, padV: number): PopupInputResult | null {
        const boxRow = padV;
        const boxCol = padH;
        const relRow = fbRow - boxRow - 1;
        const relCol = fbCol - boxCol - 1;
        if (relRow < 0 || relCol < 0) return null;

        let currentRow = 0;
        for (let i = 0; i < this.elements.length; i++) {
            const el = this.elements[i];
            if (relRow >= currentRow && relRow < currentRow + el.height) {
                if (el.focusable) {
                    this.setFocusToElement(i);
                    if (el.hitTest) {
                        el.hitTest(relRow - currentRow, relCol, 0);
                    }
                    if (el.type === 'buttons') {
                        const btnEl = el as ButtonsElement;
                        const innerW = this.computeInnerWidth();
                        const idx = btnEl.group.hitTestCol(relCol, innerW);
                        if (idx >= 0 && !btnEl.group.disabledIndices.has(idx)) {
                            btnEl.group.selectedIndex = idx;
                            // Trigger button action on click
                            const isCancel = btnEl.group.labels[idx] === 'Cancel';
                            if (isCancel) {
                                if (this.onCancel) return this.onCancel();
                                return { action: 'close', confirm: false };
                            }
                            if (this.onConfirm) return this.onConfirm();
                            return { action: 'close', confirm: true };
                        }
                    }
                    return { action: 'consumed' };
                }
                return null;
            }
            currentRow += el.height;
        }
        return null;
    }

    // --- Utilities ---

    resetBlinks(): void {
        for (const el of this.elements) {
            if (el.type === 'input') {
                (el as InputElement).control.resetBlink();
            }
        }
    }

    setFocusById(id: string): void {
        for (let i = 0; i < this.elements.length; i++) {
            if (this.elements[i].id === id && this.elements[i].focusable) {
                this.setFocusToElement(i);
                return;
            }
        }
    }

    closeDropdowns(): void {
        for (const el of this.elements) {
            if (el.type === 'dropdown') {
                (el as DropdownElement).control.isOpen = false;
            }
        }
    }

    private findOpenDropdown(): DropdownElement | null {
        for (const el of this.elements) {
            if (el.type === 'dropdown' && (el as DropdownElement).control.isOpen) {
                return el as DropdownElement;
            }
        }
        return null;
    }

    private focusableElements(): { index: number; element: FormElement }[] {
        const result: { index: number; element: FormElement }[] = [];
        for (let i = 0; i < this.elements.length; i++) {
            if (this.elements[i].focusable) {
                result.push({ index: i, element: this.elements[i] });
            }
        }
        return result;
    }

    private focusedElement(): FormElement | null {
        const focusables = this.focusableElements();
        if (this.focusIndex >= 0 && this.focusIndex < focusables.length) {
            return focusables[this.focusIndex].element;
        }
        return null;
    }

    private isFocusable(elementIndex: number): boolean {
        return this.elements[elementIndex].focusable;
    }

    private focusableIndex(elementIndex: number): number {
        let count = 0;
        for (let i = 0; i < elementIndex; i++) {
            if (this.elements[i].focusable) count++;
        }
        return count;
    }

    private setFocusToElement(elementIndex: number): void {
        this.focusIndex = this.focusableIndex(elementIndex);
    }

    private advanceFocus(dir: number): void {
        const focusables = this.focusableElements();
        if (focusables.length === 0) return;
        this.focusIndex = (this.focusIndex + dir + focusables.length) % focusables.length;
    }

    private computeInnerWidth(): number {
        const titleW = this.title.length + 4;
        let maxElementW = 0;
        for (const el of this.elements) {
            if (el.contentWidth !== undefined && el.contentWidth > maxElementW) {
                maxElementW = el.contentWidth;
            }
        }
        const boxW = Math.max(titleW, this.minWidth, maxElementW + 2);
        return boxW - 2;
    }
}
