import { Theme, TextStyle, RenderStyle, ColorOverride } from '../../settings';
import { PopupInputResult } from '../../components/popup';
import { ComposedPopup } from '../../components/composedPopup';
import { InputControl } from '../../components/inputControl';
import { CheckboxControl } from '../../components/checkboxControl';
import { ButtonGroup } from '../../components/buttonGroup';
import {
    KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_HOME, KEY_HOME_ALT,
    KEY_END, KEY_END_ALT, KEY_PAGE_UP, KEY_PAGE_DOWN, KEY_TAB, KEY_SHIFT_TAB,
    KEY_ENTER, KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_SPACE,
} from '../../keys';
import {
    ElementDef, ELEMENT_DEFS, POPUP_WIDTH, LIST_HEIGHT, CONTENT_HEIGHT,
    FOCUS_LIST, FOCUS_STATE, FOCUS_FG_GRID, FOCUS_FG_HEX, FOCUS_BG_GRID,
    FOCUS_BG_HEX, FOCUS_BOLD, FOCUS_BUTTONS, FOCUS_COUNT, LIST_WIDTH,
    ansiIndex, colorFromAnsiIndex, hexFromColor,
} from './model';
import { ColorEditorContent } from './colorEditorContent';
import { ButtonsRow } from './buttonsRow';

// Color editor window (F9 > Options > Edit colors): a ColorEditorContent
// component (element list + color controls) plus a ButtonsRow.
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

        const content = new ColorEditorContent(() => ({
            visibleElements: this.visibleElements(),
            scroll: this.scroll,
            editState: this.editState,
            focusArea: this.focusArea,
            fgGridIndex: this.fgGridIndex,
            bgGridIndex: this.bgGridIndex,
            fgHexInput: this.fgHexInput,
            bgHexInput: this.bgHexInput,
            boldCheckbox: this.boldCheckbox,
            fgColor: this.getFgColor(),
            bgColor: this.getBgColor(),
        }));
        view.addComponent(content);
        view.addSeparator();
        view.addComponent(new ButtonsRow(this.buttons, () => this.focusArea === FOCUS_BUTTONS));

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
