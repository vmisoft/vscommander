import * as os from 'os';
import { DBOX, BOX, MBOX } from './draw';
import { Theme } from './settings';
import { SortMode } from './types';
import { PopupInputResult } from './popup';
import { ComposedPopup } from './composedPopup';
import { menuFormTheme, FormTheme } from './formView';
import { FrameBuffer } from './frameBuffer';
import { CHECK_MARK, SORT_ASC, SORT_DESC } from './visualPrimitives';
import {
    KEY_UP, KEY_DOWN, KEY_HOME, KEY_HOME_ALT, KEY_END, KEY_END_ALT,
    KEY_ENTER, KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_SPACE,
} from './keys';

interface SortItem {
    type: 'item' | 'separator';
    label?: string;
    hotkeyIndex?: number;
    shortcut?: string;
    mode?: SortMode;
    toggle?: 'dirsFirst' | 'sortGroups' | 'selectedFirst';
}

export interface SortPopupResult {
    type: 'sort' | 'toggleDirsFirst' | 'toggleSortGroups' | 'toggleSelectedFirst';
    mode?: SortMode;
    reversed?: boolean;
}

function sortMenuTheme(theme: Theme): FormTheme {
    const base = menuFormTheme(theme);
    base.border = theme.menuBorder;
    return base;
}

export class SortPopup extends ComposedPopup {
    private items: SortItem[] = [];
    selectedItem = 0;
    private pane: 'left' | 'right' = 'left';
    private sortMode: SortMode = 'name';
    private sortReversed = false;
    private useSortGroups = false;
    private selectedFirst = false;
    private dirsFirst = true;

    constructor() {
        super();
    }

    get targetPane(): 'left' | 'right' {
        return this.pane;
    }

    openSort(pane: 'left' | 'right', sortMode: SortMode, reversed: boolean,
             useSortGroups: boolean, selectedFirst: boolean, dirsFirst: boolean): void {
        this.pane = pane;
        this.sortMode = sortMode;
        this.sortReversed = reversed;
        this.useSortGroups = useSortGroups;
        this.selectedFirst = selectedFirst;
        this.dirsFirst = dirsFirst;
        this.buildItems();
        this.selectedItem = this.findCurrentSortItem();

        const view = this.createView('Sort modes', DBOX, sortMenuTheme);
        view.minWidth = this.computeBoxWidth();

        view.addCustom(this.items.length, true, (fb, row, col, innerWidth, _focused, ft, theme) => {
            this.renderItems(fb, row, col, innerWidth, ft, theme);
        });

        view.onInput = (data) => this.handleSortInput(data);
        view.onScroll = (up) => {
            this.selectedItem = this.nextSelectableItem(up ? -1 : 1);
        };

        this.setActiveView(view);
        super.open();
    }

    private findCurrentSortItem(): number {
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].mode === this.sortMode) return i;
        }
        return this.firstSelectableItem();
    }

    private buildItems(): void {
        this.items = [
            { type: 'item', label: 'Name', hotkeyIndex: 0, shortcut: 'Ctrl+F3', mode: 'name' },
            { type: 'item', label: 'Extension', hotkeyIndex: 0, shortcut: 'Ctrl+F4', mode: 'extension' },
            { type: 'item', label: 'Write time', hotkeyIndex: 0, shortcut: 'Ctrl+F5', mode: 'date' },
            { type: 'item', label: 'Size', hotkeyIndex: 0, shortcut: 'Ctrl+F6', mode: 'size' },
            { type: 'item', label: 'Unsorted', hotkeyIndex: 0, shortcut: 'Ctrl+F7', mode: 'unsorted' },
            { type: 'item', label: 'Creation time', hotkeyIndex: 0, shortcut: 'Ctrl+F8', mode: 'creationTime' },
            { type: 'item', label: 'Access time', hotkeyIndex: 0, shortcut: 'Ctrl+F9', mode: 'accessTime' },
            { type: 'item', label: 'Change time', hotkeyIndex: 4, mode: 'changeTime' },
            { type: 'item', label: 'Description', hotkeyIndex: 0, shortcut: 'Ctrl+F10', mode: 'description' },
            { type: 'item', label: 'Owner', hotkeyIndex: 0, shortcut: 'Ctrl+F11', mode: 'owner' },
            { type: 'item', label: 'Allocated size', hotkeyIndex: 1, mode: 'allocatedSize' },
            { type: 'item', label: 'Hard links', hotkeyIndex: 0, mode: 'hardLinks' },
        ];
        if (os.platform() === 'win32') {
            this.items.push(
                { type: 'item', label: 'Streams count', hotkeyIndex: 1, mode: 'streams' },
                { type: 'item', label: 'Streams size', hotkeyIndex: 8, mode: 'streamSize' },
            );
        }
        this.items.push(
            { type: 'separator' },
            { type: 'item', label: 'Use sort groups', hotkeyIndex: 4, shortcut: 'Shift+F11', toggle: 'sortGroups' },
            { type: 'item', label: 'Show selected first', hotkeyIndex: 5, shortcut: 'Shift+F12', toggle: 'selectedFirst' },
            { type: 'item', label: 'Show directories first', hotkeyIndex: 5, toggle: 'dirsFirst' },
        );
    }

    private computeBoxWidth(): number {
        let maxLabel = 0;
        let maxShortcut = 0;
        for (const item of this.items) {
            if (item.type !== 'item') continue;
            const label = item.label ?? '';
            if (label.length > maxLabel) maxLabel = label.length;
            const sc = item.shortcut ?? '';
            if (sc.length > maxShortcut) maxShortcut = sc.length;
        }
        const checkCol = 2;
        const labelStart = checkCol + 2;
        const gap = maxShortcut > 0 ? 2 : 0;
        const innerWidth = labelStart + maxLabel + gap + maxShortcut + 1;
        return innerWidth + 2;
    }

    private renderItems(fb: FrameBuffer, row: number, col: number,
                        innerWidth: number, ft: FormTheme, _theme: Theme): void {
        const borderStyle = ft.border ? ft.border.idle : ft.body.idle;
        const boxChars = DBOX;

        let maxLabel = 0;
        let maxShortcut = 0;
        for (const item of this.items) {
            if (item.type !== 'item') continue;
            if ((item.label ?? '').length > maxLabel) maxLabel = (item.label ?? '').length;
            if ((item.shortcut ?? '').length > maxShortcut) maxShortcut = (item.shortcut ?? '').length;
        }
        const checkCol = 2;
        const labelStart = checkCol + 2;

        let r = row;
        for (let itemIdx = 0; itemIdx < this.items.length; itemIdx++) {
            const item = this.items[itemIdx];
            if (item.type === 'separator') {
                fb.drawSeparator(r, col - 1, innerWidth + 2, borderStyle,
                    MBOX.vertDoubleRight, BOX.horizontal, MBOX.vertDoubleLeft);
                r++;
                continue;
            }

            const isSelected = this.selectedItem === itemIdx;
            const label = item.label ?? '';
            const shortcut = item.shortcut ?? '';
            const hotkeyIdx = item.hotkeyIndex ?? 0;

            const itemStyle = isSelected ? ft.body.selected : ft.body.idle;
            const hotkeyStyle = isSelected ? ft.hotkey.selected : ft.hotkey.idle;

            fb.write(r, col - 1, boxChars.vertical, borderStyle);
            fb.fill(r, col, innerWidth, 1, ' ', itemStyle);
            fb.write(r, col + innerWidth, boxChars.vertical, borderStyle);

            let mark = ' ';
            if (item.mode && item.mode === this.sortMode) {
                mark = this.sortReversed ? SORT_DESC : SORT_ASC;
            } else if (item.toggle === 'dirsFirst' && this.dirsFirst) {
                mark = CHECK_MARK;
            } else if (item.toggle === 'sortGroups' && this.useSortGroups) {
                mark = CHECK_MARK;
            } else if (item.toggle === 'selectedFirst' && this.selectedFirst) {
                mark = CHECK_MARK;
            }
            fb.write(r, col + checkCol - 1, mark, itemStyle);

            fb.write(r, col + labelStart - 1, label, itemStyle);
            if (hotkeyIdx < label.length) {
                fb.write(r, col + labelStart - 1 + hotkeyIdx, label[hotkeyIdx], hotkeyStyle);
            }

            if (shortcut.length > 0) {
                const scCol = col + innerWidth - shortcut.length;
                fb.write(r, scCol, shortcut, itemStyle);
            }

            r++;
        }
    }

    private handleSortInput(data: string): PopupInputResult | null {
        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === KEY_DOWN) {
            this.selectedItem = this.nextSelectableItem(1);
            return { action: 'consumed' };
        }

        if (data === KEY_UP) {
            this.selectedItem = this.nextSelectableItem(-1);
            return { action: 'consumed' };
        }

        if (data === KEY_HOME || data === KEY_HOME_ALT) {
            this.selectedItem = this.firstSelectableItem();
            return { action: 'consumed' };
        }

        if (data === KEY_END || data === KEY_END_ALT) {
            this.selectedItem = this.lastSelectableItem();
            return { action: 'consumed' };
        }

        if (data === KEY_ENTER) {
            return this.activateCurrentItem();
        }

        if (data === KEY_SPACE) {
            const item = this.items[this.selectedItem];
            if (item && item.toggle === 'dirsFirst') {
                return this.activateCurrentItem();
            }
            return { action: 'consumed' };
        }

        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            return this.handleHotkey(data);
        }

        return { action: 'consumed' };
    }

    private handleHotkey(ch: string): PopupInputResult {
        const lower = ch.toLowerCase();
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (item.type !== 'item' || !item.label) continue;
            const hi = item.hotkeyIndex ?? 0;
            if (item.label[hi]?.toLowerCase() === lower) {
                this.selectedItem = i;
                return this.activateCurrentItem();
            }
        }
        return { action: 'consumed' };
    }

    private activateCurrentItem(): PopupInputResult {
        const item = this.items[this.selectedItem];
        if (!item || item.type !== 'item') return { action: 'consumed' };

        if (item.toggle === 'dirsFirst') {
            this.dirsFirst = !this.dirsFirst;
            const result: SortPopupResult = { type: 'toggleDirsFirst' };
            return { action: 'close', confirm: true, command: result };
        }

        if (item.toggle === 'sortGroups') {
            this.useSortGroups = !this.useSortGroups;
            const result: SortPopupResult = { type: 'toggleSortGroups' };
            return { action: 'close', confirm: true, command: result };
        }

        if (item.toggle === 'selectedFirst') {
            this.selectedFirst = !this.selectedFirst;
            const result: SortPopupResult = { type: 'toggleSelectedFirst' };
            return { action: 'close', confirm: true, command: result };
        }

        if (item.mode) {
            let reversed = false;
            if (item.mode === this.sortMode) {
                reversed = !this.sortReversed;
            }
            const result: SortPopupResult = { type: 'sort', mode: item.mode, reversed };
            this.close();
            return { action: 'close', confirm: true, command: result };
        }

        return { action: 'consumed' };
    }

    override handleMouseScroll(up: boolean): PopupInputResult {
        this.selectedItem = this.nextSelectableItem(up ? -1 : 1);
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, _fbCol: number): PopupInputResult | null {
        const itemIdx = this.rowToItem(fbRow - this.padV);
        if (itemIdx >= 0) {
            this.selectedItem = itemIdx;
            this.mouseDownButton = itemIdx;
            return { action: 'consumed' };
        }
        return null;
    }

    protected override hitTestButton(fbRow: number, _fbCol: number): number {
        return this.rowToItem(fbRow - this.padV);
    }

    protected override onButtonConfirm(buttonIndex: number): PopupInputResult {
        if (buttonIndex >= 0 && buttonIndex < this.items.length) {
            this.selectedItem = buttonIndex;
            return this.activateCurrentItem();
        }
        return { action: 'consumed' };
    }

    private rowToItem(boxRow: number): number {
        let row = 1;
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].type === 'separator') {
                row++;
                continue;
            }
            if (row === boxRow) return i;
            row++;
        }
        return -1;
    }

    private firstSelectableItem(): number {
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].type === 'item') return i;
        }
        return 0;
    }

    private lastSelectableItem(): number {
        for (let i = this.items.length - 1; i >= 0; i--) {
            if (this.items[i].type === 'item') return i;
        }
        return 0;
    }

    private nextSelectableItem(dir: number): number {
        let idx = this.selectedItem;
        for (let step = 0; step < this.items.length; step++) {
            idx = (idx + dir + this.items.length) % this.items.length;
            if (this.items[idx].type === 'item') return idx;
        }
        return this.selectedItem;
    }

    render(paneStartCol: number, paneWidth: number, theme: Theme, listStart?: number, listHeight?: number): string {
        if (!this.active) return '';
        const fb = this.renderToBuffer(theme);
        if (fb.width === 0 || fb.height === 0) return '';
        const lStart = typeof listStart === 'number' ? listStart : 1;
        const lHeight = typeof listHeight === 'number' ? listHeight : 20;
        const areaHeight = lHeight + 2;
        const baseRow = lStart + Math.max(0, Math.floor((areaHeight - fb.height) / 2));
        const baseCol = paneStartCol + 2;
        this.setScreenPosition(baseRow, baseCol, fb.width, fb.height);
        return fb.toAnsi(this.screenRow, this.screenCol);
    }
}
