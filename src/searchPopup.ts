import { hideCursor, moveTo, resetStyle, DBOX } from './draw';
import { Theme } from './settings';
import { DirEntry } from './types';
import { Popup, PopupInputResult } from './popup';
import { applyStyle } from './helpers';

const POPUP_WIDTH = 20;
const INPUT_WIDTH = POPUP_WIDTH - 4;
const POPUP_COL_OFFSET = 8;

export class SearchPopup extends Popup {
    buffer = '';
    cursorVisible = true;
    lastMatchIndex = -1;

    override open(): void {
        super.open();
        this.cursorVisible = true;
        this.lastMatchIndex = -1;
    }

    openWithChar(initialChar: string): void {
        this.open();
        this.buffer = initialChar;
    }

    close(): void {
        super.close();
        this.buffer = '';
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
            if (this.buffer.length > 0) {
                this.buffer = this.buffer.slice(0, -1);
                this.lastMatchIndex = this.buffer.length > 0
                    ? SearchPopup.findPrefixMatch(entries, this.buffer)
                    : -1;
            }
            return { action: 'consumed' };
        }

        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            const candidate = this.buffer + data;
            const matchIdx = SearchPopup.findPrefixMatch(entries, candidate);
            if (matchIdx >= 0) {
                this.buffer = candidate;
                this.lastMatchIndex = matchIdx;
                return { action: 'consumed' };
            }
            this.lastMatchIndex = -1;
            return { action: 'consumed' };
        }

        this.close();
        return { action: 'passthrough' };
    }

    render(anchorRow: number, anchorCol: number, theme: Theme): string {
        if (!this.active) return '';

        const t = theme;
        const popupCol = anchorCol + POPUP_COL_OFFSET;
        const popupRow = anchorRow;
        const border = applyStyle(t.searchBody.idle);
        const title = ' Search ';
        const innerW = POPUP_WIDTH - 2;
        const fillLeft = Math.floor((innerW - title.length) / 2);
        const fillRight = innerW - title.length - fillLeft;

        let out = border + moveTo(popupRow, popupCol);
        out += DBOX.topLeft + DBOX.horizontal.repeat(fillLeft) + title + DBOX.horizontal.repeat(fillRight) + DBOX.topRight;

        out += border + moveTo(popupRow + 1, popupCol);
        out += DBOX.vertical + ' '.repeat(innerW) + DBOX.vertical;

        out += Popup.renderInputField(
            popupRow + 1, popupCol + 2, INPUT_WIDTH,
            this.buffer, this.cursorVisible,
            t.searchInput.idle, t.searchCursor.idle,
        );

        out += border + moveTo(popupRow + 2, popupCol);
        out += DBOX.bottomLeft + DBOX.horizontal.repeat(innerW) + DBOX.bottomRight;

        out += resetStyle() + hideCursor();
        return out;
    }

    get hasBlink(): boolean {
        return true;
    }

    renderBlink(anchorRow: number, anchorCol: number, theme: Theme): string {
        if (!this.active) return '';
        this.cursorVisible = !this.cursorVisible;

        const t = theme;
        const popupCol = anchorCol + POPUP_COL_OFFSET;
        const popupRow = anchorRow;

        let out = Popup.renderInputField(
            popupRow + 1, popupCol + 2, INPUT_WIDTH,
            this.buffer, this.cursorVisible,
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
