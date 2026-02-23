import { Theme } from './settings';
import { DirEntry } from './types';
import { PopupInputResult } from './popup';
import { ComposedPopup } from './composedPopup';
import { searchFormTheme } from './formView';
import { InputControl } from './inputControl';
import { KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_ENTER, KEY_BACKSPACE } from './keys';

const POPUP_WIDTH = 20;
const INPUT_WIDTH = POPUP_WIDTH - 4;
const POPUP_COL_OFFSET = 8;

export class SearchPopup extends ComposedPopup {
    lastMatchIndex = -1;
    override padding = 0;
    private entries: DirEntry[] = [];

    constructor() {
        super();
    }

    get buffer(): string {
        if (!this.activeView) return '';
        return this.activeView.input('search').buffer;
    }

    get cursorVisible(): boolean {
        if (!this.activeView) return false;
        return this.activeView.input('search').cursorVisible;
    }

    set cursorVisible(v: boolean) {
        if (this.activeView) this.activeView.input('search').cursorVisible = v;
    }

    private get inputCtrl(): InputControl | null {
        if (!this.activeView) return null;
        return this.activeView.input('search');
    }

    override open(): void {
        this.lastMatchIndex = -1;

        const view = this.createView('Search', undefined, searchFormTheme);
        view.minWidth = POPUP_WIDTH;
        view.addInput('search', INPUT_WIDTH);

        view.onInput = (data) => this.handleSearchInput(data);

        this.setActiveView(view);
        super.open();
    }

    openWithChar(initialChar: string): void {
        this.open();
        if (this.inputCtrl) this.inputCtrl.reset(initialChar);
    }

    close(): void {
        if (this.inputCtrl) this.inputCtrl.reset('');
        super.close();
    }

    handleInput(data: string, entries?: DirEntry[]): PopupInputResult {
        if (entries) this.entries = entries;
        if (!this.activeView) return { action: 'consumed' };
        return this.activeView.handleInput(data);
    }

    private handleSearchInput(data: string): PopupInputResult {
        const input = this.inputCtrl;
        if (!input) return { action: 'consumed' };

        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === KEY_ENTER) {
            this.close();
            return { action: 'close', confirm: true };
        }

        if (data === KEY_BACKSPACE) {
            if (input.buffer.length > 0) {
                input.buffer = input.buffer.slice(0, -1);
                input.cursorPos = input.buffer.length;
                this.lastMatchIndex = input.buffer.length > 0
                    ? SearchPopup.findPrefixMatch(this.entries, input.buffer)
                    : -1;
            }
            return { action: 'consumed' };
        }

        let ch = '';
        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            ch = data;
        } else if (data.length === 2 && data.charCodeAt(0) === 0x1b && data.charCodeAt(1) >= 0x20) {
            ch = data[1];
        }
        if (ch) {
            const candidate = input.buffer + ch;
            const matchIdx = SearchPopup.findPrefixMatch(this.entries, candidate);
            if (matchIdx >= 0) {
                input.insert(ch);
                this.lastMatchIndex = matchIdx;
                return { action: 'consumed' };
            }
            this.lastMatchIndex = -1;
            return { action: 'consumed' };
        }

        this.close();
        return { action: 'passthrough' };
    }

    protected override onMouseDown(_fbRow: number, _fbCol: number): PopupInputResult | null {
        return null;
    }

    override render(anchorRow: number, anchorCol: number, theme: Theme): string {
        if (!this.active) return '';
        const fb = this.renderToBuffer(theme);
        if (fb.width === 0 || fb.height === 0) return '';
        const baseCol = anchorCol + POPUP_COL_OFFSET;
        this.setScreenPosition(anchorRow, baseCol, fb.width, fb.height);
        return fb.toAnsi(this.screenRow, this.screenCol);
    }

    get hasBlink(): boolean {
        return true;
    }

    renderBlink(anchorRow: number, anchorCol: number, theme: Theme): string {
        if (!this.active || !this.activeView) return '';
        return this.activeView.renderBlink(
            this.screenRow, this.screenCol,
            this.padH, this.padV, theme,
        );
    }

    static findPrefixMatch(entries: DirEntry[], prefix: string): number {
        const lower = prefix.toLowerCase();
        for (let i = 0; i < entries.length; i++) {
            if (entries[i].name.toLowerCase().startsWith(lower)) {
                return i;
            }
        }
        return -1;
    }
}
