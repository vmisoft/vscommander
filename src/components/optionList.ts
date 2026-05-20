import { FrameBuffer } from '../frameBuffer';
import { Theme } from '../settings';
import { DBOX, BOX, MBOX } from '../draw';
import {
    KEY_UP, KEY_DOWN, KEY_HOME, KEY_HOME_ALT, KEY_END, KEY_END_ALT,
} from '../keys';
import { FormTheme, FormComponent } from './formView';

export interface OptionListItem {
    separator?: boolean;
    label?: string;
    hotkeyIndex?: number;
    shortcut?: string;
}

// A generic vertical menu list: selectable rows — each with an optional
// left-column mark cell, a hotkey-highlighted label and an optional
// right-aligned shortcut — interspersed with separators. Up/Down/Home/End
// move the selection over selectable rows. Specialized lists derive from this
// and override markFor() to supply per-row indicators.
export class OptionList implements FormComponent {
    readonly items: OptionListItem[];
    selected: number;
    readonly focusStops = 1;

    constructor(items: OptionListItem[]) {
        this.items = items;
        this.selected = this.firstSelectable();
    }

    get height(): number {
        return this.items.length;
    }

    // Left-column indicator for a row; overridden by subclasses.
    protected markFor(_index: number): string {
        return ' ';
    }

    firstSelectable(): number {
        for (let i = 0; i < this.items.length; i++) {
            if (!this.items[i].separator) return i;
        }
        return 0;
    }

    lastSelectable(): number {
        for (let i = this.items.length - 1; i >= 0; i--) {
            if (!this.items[i].separator) return i;
        }
        return 0;
    }

    nextSelectable(dir: number): number {
        let idx = this.selected;
        for (let step = 0; step < this.items.length; step++) {
            idx = (idx + dir + this.items.length) % this.items.length;
            if (!this.items[idx].separator) return idx;
        }
        return this.selected;
    }

    moveSelection(dir: number): void {
        this.selected = this.nextSelectable(dir);
    }

    selectByHotkey(ch: string): boolean {
        const lower = ch.toLowerCase();
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (item.separator || !item.label) continue;
            const hi = item.hotkeyIndex ?? 0;
            if (item.label[hi]?.toLowerCase() === lower) {
                this.selected = i;
                return true;
            }
        }
        return false;
    }

    // Map a 0-based render row (from the list's top) to an item index, or -1
    // for a separator row / out of range.
    itemAtRow(rowFromTop: number): number {
        if (rowFromTop < 0 || rowFromTop >= this.items.length) return -1;
        return this.items[rowFromTop].separator ? -1 : rowFromTop;
    }

    handleInput(data: string): boolean {
        if (data === KEY_DOWN) { this.moveSelection(1); return true; }
        if (data === KEY_UP) { this.moveSelection(-1); return true; }
        if (data === KEY_HOME || data === KEY_HOME_ALT) {
            this.selected = this.firstSelectable();
            return true;
        }
        if (data === KEY_END || data === KEY_END_ALT) {
            this.selected = this.lastSelectable();
            return true;
        }
        return false;
    }

    render(fb: FrameBuffer, row: number, col: number, innerWidth: number,
           _focused: boolean, _subFocus: number, ft: FormTheme, _theme: Theme): void {
        const borderStyle = ft.border ? ft.border.idle : ft.body.idle;
        const boxChars = DBOX;

        let maxLabel = 0;
        let maxShortcut = 0;
        for (const item of this.items) {
            if (item.separator) continue;
            if ((item.label ?? '').length > maxLabel) maxLabel = (item.label ?? '').length;
            if ((item.shortcut ?? '').length > maxShortcut) maxShortcut = (item.shortcut ?? '').length;
        }
        const checkCol = 2;
        const labelStart = checkCol + 2;

        let r = row;
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (item.separator) {
                fb.drawSeparator(r, col - 1, innerWidth + 2, borderStyle,
                    MBOX.vertDoubleRight, BOX.horizontal, MBOX.vertDoubleLeft);
                r++;
                continue;
            }

            const isSelected = this.selected === i;
            const label = item.label ?? '';
            const shortcut = item.shortcut ?? '';
            const hotkeyIdx = item.hotkeyIndex ?? 0;

            const itemStyle = isSelected ? ft.body.selected : ft.body.idle;
            const hotkeyStyle = isSelected ? ft.hotkey.selected : ft.hotkey.idle;

            fb.write(r, col - 1, boxChars.vertical, borderStyle);
            fb.fill(r, col, innerWidth, 1, ' ', itemStyle);
            fb.write(r, col + innerWidth, boxChars.vertical, borderStyle);

            fb.write(r, col + checkCol - 1, this.markFor(i), itemStyle);

            fb.write(r, col + labelStart - 1, label, itemStyle);
            if (hotkeyIdx < label.length) {
                fb.write(r, col + labelStart - 1 + hotkeyIdx, label[hotkeyIdx], hotkeyStyle);
            }

            if (shortcut.length > 0) {
                fb.write(r, col + innerWidth - shortcut.length, shortcut, itemStyle);
            }

            r++;
        }
    }
}
