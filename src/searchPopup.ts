import { hideCursor, DBOX } from './draw';
import { Theme } from './settings';
import { DirEntry } from './types';
import { Popup, PopupInputResult } from './popup';
import { InputControl } from './inputControl';
import { FrameBuffer } from './frameBuffer';

const POPUP_WIDTH = 20;
const INPUT_WIDTH = POPUP_WIDTH - 4;
const POPUP_COL_OFFSET = 8;

export class SearchPopup extends Popup {
    input: InputControl;
    lastMatchIndex = -1;

    constructor() {
        super();
        this.padding = 0;
        this.input = new InputControl(INPUT_WIDTH);
    }

    get buffer(): string {
        return this.input.buffer;
    }

    get cursorVisible(): boolean {
        return this.input.cursorVisible;
    }

    set cursorVisible(v: boolean) {
        this.input.cursorVisible = v;
    }

    override open(): void {
        super.open();
        this.input.reset('');
        this.lastMatchIndex = -1;
    }

    openWithChar(initialChar: string): void {
        this.open();
        this.input.reset(initialChar);
    }

    close(): void {
        super.close();
        this.input.reset('');
    }

    handleInput(data: string, entries: DirEntry[]): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === '\r') {
            this.close();
            return { action: 'close', confirm: true };
        }

        if (data === '\x7f') {
            if (this.input.buffer.length > 0) {
                this.input.buffer = this.input.buffer.slice(0, -1);
                this.input.cursorPos = this.input.buffer.length;
                this.lastMatchIndex = this.input.buffer.length > 0
                    ? SearchPopup.findPrefixMatch(entries, this.input.buffer)
                    : -1;
            }
            return { action: 'consumed' };
        }

        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            const candidate = this.input.buffer + data;
            const matchIdx = SearchPopup.findPrefixMatch(entries, candidate);
            if (matchIdx >= 0) {
                this.input.insert(data);
                this.lastMatchIndex = matchIdx;
                return { action: 'consumed' };
            }
            this.lastMatchIndex = -1;
            return { action: 'consumed' };
        }

        this.close();
        return { action: 'passthrough' };
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        const t = theme;
        const bodyStyle = t.searchBody.idle;
        const fb = new FrameBuffer(POPUP_WIDTH, 3);
        fb.drawBox(0, 0, POPUP_WIDTH, 3, bodyStyle, DBOX, 'Search');
        fb.blit(1, 2, this.input.renderToBuffer(t.searchInput.idle, t.searchCursor.idle, true));
        return fb;
    }

    render(anchorRow: number, anchorCol: number, theme: Theme): string {
        if (!this.active) return '';
        return this.renderToBuffer(theme).toAnsi(anchorRow, anchorCol + POPUP_COL_OFFSET);
    }

    get hasBlink(): boolean {
        return true;
    }

    renderBlink(anchorRow: number, anchorCol: number, theme: Theme): string {
        if (!this.active) return '';

        const t = theme;
        const popupCol = anchorCol + POPUP_COL_OFFSET;
        const popupRow = anchorRow;

        let out = this.input.renderBlink(
            popupRow + 1, popupCol + 2,
            t.searchInput.idle, t.searchCursor.idle,
        );

        out += hideCursor();
        return out;
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
