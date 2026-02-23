import { BOX } from './draw';
import { TextStyle } from './settings';
import { FrameBuffer } from './frameBuffer';
import { KEY_UP, KEY_DOWN, KEY_ENTER, KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_SPACE, KEY_CTRL_DOWN, KEY_ALT_DOWN } from './keys';

export interface DropdownOption {
    label: string;
    value: string;
}

export class DropdownControl {
    options: DropdownOption[];
    selectedIndex = 0;
    width: number;
    isOpen = false;
    highlightIndex = 0;

    constructor(options: DropdownOption[], width: number) {
        this.options = options;
        this.width = width;
    }

    handleInput(data: string): boolean {
        if (this.isOpen) {
            if (data === KEY_UP) {
                this.highlightIndex = (this.highlightIndex - 1 + this.options.length) % this.options.length;
                return true;
            }
            if (data === KEY_DOWN) {
                this.highlightIndex = (this.highlightIndex + 1) % this.options.length;
                return true;
            }
            if (data === KEY_ENTER || data === KEY_SPACE) {
                this.selectedIndex = this.highlightIndex;
                this.isOpen = false;
                return true;
            }
            if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
                this.isOpen = false;
                return true;
            }
            return true;
        }

        if (data === KEY_SPACE) {
            this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
            return true;
        }

        if (data === KEY_CTRL_DOWN || data === KEY_ALT_DOWN) {
            this.highlightIndex = this.selectedIndex;
            this.isOpen = true;
            return true;
        }

        return false;
    }

    get selected(): DropdownOption {
        return this.options[this.selectedIndex];
    }

    renderToBuffer(style: TextStyle, focusedStyle: TextStyle, focused: boolean): FrameBuffer {
        const fb = new FrameBuffer(this.width, 1);
        const label = this.selected.label;
        const display = label.slice(0, this.width);
        const pad = ' '.repeat(Math.max(0, this.width - display.length));
        fb.write(0, 0, display + pad, focused ? focusedStyle : style);
        return fb;
    }

    renderPopupToBuffer(borderStyle: TextStyle, itemStyle: TextStyle, selectedItemStyle: TextStyle): FrameBuffer {
        if (!this.isOpen) return new FrameBuffer(0, 0);
        const popupWidth = this.width + 2;
        const popupHeight = this.options.length + 2;
        const fb = new FrameBuffer(popupWidth, popupHeight);
        fb.drawBox(0, 0, popupWidth, popupHeight, borderStyle, BOX);
        for (let i = 0; i < this.options.length; i++) {
            const isHighlighted = i === this.highlightIndex;
            const s = isHighlighted ? selectedItemStyle : itemStyle;
            const label = this.options[i].label.slice(0, this.width);
            const pad = ' '.repeat(Math.max(0, this.width - label.length));
            fb.write(1 + i, 1, label + pad, s);
        }
        return fb;
    }

}
