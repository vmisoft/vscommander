import { DBOX, MBOX, BOX } from '../../draw';
import { Theme } from '../../settings';
import { FrameBuffer } from '../../frameBuffer';
import { CHECK_MARK } from '../../visualPrimitives';

export interface DropdownItem {
    type: 'item' | 'separator';
    label?: string;
    hotkeyIndex?: number;
    shortcut?: string;
    checked?: boolean;
    disabled?: boolean;
    command?: string;
}

// A single pull-down menu panel: a bordered list of items (with check marks,
// shortcuts, hotkey highlighting, disabled rows and separators) rendered to a
// standalone FrameBuffer. Owns its own selection and navigation.
export class DropdownMenu {
    readonly items: DropdownItem[];
    selected = 0;

    constructor(items: DropdownItem[]) {
        this.items = items;
        this.selected = this.firstSelectable();
    }

    current(): DropdownItem | undefined {
        return this.items[this.selected];
    }

    firstSelectable(): number {
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].type === 'item' && !this.items[i].disabled) return i;
        }
        return 0;
    }

    lastSelectable(): number {
        for (let i = this.items.length - 1; i >= 0; i--) {
            if (this.items[i].type === 'item' && !this.items[i].disabled) return i;
        }
        return 0;
    }

    moveSelection(dir: number): void {
        let idx = this.selected;
        for (let step = 0; step < this.items.length; step++) {
            idx = (idx + dir + this.items.length) % this.items.length;
            if (this.items[idx].type === 'item' && !this.items[idx].disabled) {
                this.selected = idx;
                return;
            }
        }
    }

    selectByHotkey(ch: string): boolean {
        const lower = ch.toLowerCase();
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (item.type !== 'item' || !item.label || item.disabled) continue;
            const hi = item.hotkeyIndex ?? 0;
            if (item.label[hi]?.toLowerCase() === lower) {
                this.selected = i;
                return true;
            }
        }
        return false;
    }

    // Map a 0-based row inside the panel's box (1 = first content row) to an
    // item index, or -1.
    rowToItem(ddRow: number): number {
        let row = 1;
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].type === 'separator') { row++; continue; }
            if (row === ddRow && !this.items[i].disabled) return i;
            row++;
        }
        return -1;
    }

    render(theme: Theme): FrameBuffer {
        const t = theme;
        const borderStyle = t.menuBorder.idle;

        let maxLabel = 0;
        let maxShortcut = 0;
        for (const item of this.items) {
            if (item.type !== 'item') continue;
            if ((item.label ?? '').length > maxLabel) maxLabel = (item.label ?? '').length;
            if ((item.shortcut ?? '').length > maxShortcut) maxShortcut = (item.shortcut ?? '').length;
        }

        const checkCol = 2;
        const labelStart = checkCol + 2;
        const gap = maxShortcut > 0 ? 2 : 0;
        const innerWidth = labelStart + maxLabel + gap + maxShortcut + 1;
        const boxWidth = innerWidth + 2;
        const boxHeight = this.items.length + 2;

        const fb = new FrameBuffer(boxWidth, boxHeight);
        fb.fill(0, 0, boxWidth, boxHeight, ' ', borderStyle);
        fb.write(0, 0, DBOX.topLeft + DBOX.horizontal.repeat(innerWidth) + DBOX.topRight, borderStyle);
        fb.write(boxHeight - 1, 0, DBOX.bottomLeft + DBOX.horizontal.repeat(innerWidth) + DBOX.bottomRight, borderStyle);

        let row = 1;
        for (let itemIdx = 0; itemIdx < this.items.length; itemIdx++) {
            const item = this.items[itemIdx];
            if (item.type === 'separator') {
                fb.write(row, 0, MBOX.vertDoubleRight + BOX.horizontal.repeat(innerWidth) + MBOX.vertDoubleLeft, borderStyle);
                row++;
                continue;
            }

            const isSelected = this.selected === itemIdx;
            const isDisabled = item.disabled === true;
            const label = item.label ?? '';
            const shortcut = item.shortcut ?? '';
            const hotkeyIdx = item.hotkeyIndex ?? 0;

            let itemStyle = isSelected ? t.menuItem.selected : t.menuItem.idle;
            if (isDisabled) itemStyle = t.menuItemDisabled.idle;
            const hotkeyStyle = isSelected ? t.menuItemHotkey.selected : t.menuItemHotkey.idle;

            fb.write(row, 0, DBOX.vertical, borderStyle);
            fb.fill(row, 1, innerWidth, 1, ' ', itemStyle);
            fb.write(row, innerWidth + 1, DBOX.vertical, borderStyle);

            fb.write(row, checkCol, item.checked ? CHECK_MARK : ' ', itemStyle);

            fb.write(row, labelStart, label, itemStyle);
            if (!isDisabled && hotkeyIdx < label.length) {
                fb.write(row, labelStart + hotkeyIdx, label[hotkeyIdx], hotkeyStyle);
            }

            if (shortcut.length > 0) {
                fb.write(row, innerWidth - shortcut.length, shortcut, itemStyle);
            }

            row++;
        }

        return fb;
    }
}
