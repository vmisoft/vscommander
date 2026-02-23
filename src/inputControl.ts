import { moveTo, resetStyle } from './draw';
import { TextStyle } from './settings';
import { applyStyle } from './helpers';
import { FrameBuffer } from './frameBuffer';
import {
    KEY_LEFT, KEY_RIGHT, KEY_HOME, KEY_HOME_ALT, KEY_END, KEY_END_ALT,
    KEY_DELETE, KEY_BACKSPACE, KEY_BACKSPACE_ALT,
} from './keys';

export class InputControl {
    buffer = '';
    cursorPos = 0;
    scrollOffset = 0;
    cursorVisible = true;
    width: number;

    constructor(width: number) {
        this.width = width;
    }

    reset(initial: string = ''): void {
        this.buffer = initial;
        this.cursorPos = initial.length;
        this.scrollOffset = 0;
        this.cursorVisible = true;
        this.adjustScroll();
    }

    handleInput(data: string): boolean {
        if (data === KEY_LEFT) {
            if (this.cursorPos > 0) {
                this.cursorPos--;
                this.adjustScroll();
            }
            return true;
        }

        if (data === KEY_RIGHT) {
            if (this.cursorPos < this.buffer.length) {
                this.cursorPos++;
                this.adjustScroll();
            }
            return true;
        }

        if (data === KEY_HOME || data === KEY_HOME_ALT) {
            this.cursorPos = 0;
            this.scrollOffset = 0;
            return true;
        }

        if (data === KEY_END || data === KEY_END_ALT) {
            this.cursorPos = this.buffer.length;
            this.adjustScroll();
            return true;
        }

        if (data === KEY_BACKSPACE || data === KEY_BACKSPACE_ALT) {
            if (this.cursorPos > 0) {
                this.buffer = this.buffer.slice(0, this.cursorPos - 1) + this.buffer.slice(this.cursorPos);
                this.cursorPos--;
                this.adjustScroll();
            }
            return true;
        }

        if (data === KEY_DELETE) {
            if (this.cursorPos < this.buffer.length) {
                this.buffer = this.buffer.slice(0, this.cursorPos) + this.buffer.slice(this.cursorPos + 1);
                this.adjustScroll();
            }
            return true;
        }

        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            this.insert(data);
            return true;
        }

        return false;
    }

    insert(ch: string): void {
        this.buffer = this.buffer.slice(0, this.cursorPos) + ch + this.buffer.slice(this.cursorPos);
        this.cursorPos += ch.length;
        this.adjustScroll();
    }

    private adjustScroll(): void {
        if (this.cursorPos < this.scrollOffset) {
            this.scrollOffset = this.cursorPos;
        }
        if (this.cursorPos > this.scrollOffset + this.width - 1) {
            this.scrollOffset = this.cursorPos - this.width + 1;
        }
        if (this.scrollOffset < 0) {
            this.scrollOffset = 0;
        }
    }

    renderToBuffer(inputStyle: TextStyle, cursorStyle: TextStyle, focused: boolean = true): FrameBuffer {
        const fb = new FrameBuffer(this.width, 1);
        const visible = this.buffer.slice(this.scrollOffset, this.scrollOffset + this.width);
        const pad = ' '.repeat(Math.max(0, this.width - visible.length));
        fb.write(0, 0, visible + pad, inputStyle);

        if (focused) {
            const cursorCol = this.cursorPos - this.scrollOffset;
            if (this.cursorVisible) {
                fb.write(0, cursorCol, '|', cursorStyle);
            } else {
                const charAtCursor = this.buffer[this.cursorPos] || ' ';
                fb.write(0, cursorCol, charAtCursor, inputStyle);
            }
        }

        return fb;
    }

    renderBlink(row: number, col: number, inputStyle: TextStyle, cursorStyle: TextStyle): string {
        this.cursorVisible = !this.cursorVisible;
        const cursorCol = col + (this.cursorPos - this.scrollOffset);
        let out = moveTo(row, cursorCol);
        if (this.cursorVisible) {
            out += applyStyle(cursorStyle) + '|';
        } else {
            const charAtCursor = this.buffer[this.cursorPos] || ' ';
            out += applyStyle(inputStyle) + charAtCursor;
        }
        out += resetStyle();
        return out;
    }

    toggleBlink(): void {
        this.cursorVisible = !this.cursorVisible;
    }

    resetBlink(): void {
        this.cursorVisible = true;
    }
}
