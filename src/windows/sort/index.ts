import * as os from 'os';
import { DBOX } from '../../draw';
import { Theme } from '../../settings';
import { SortMode } from '../../types';
import { PopupInputResult } from '../../components/popup';
import { ComposedPopup } from '../../components/composedPopup';
import { menuFormTheme, FormTheme } from '../../components/formView';
import {
    KEY_ENTER, KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_SPACE,
} from '../../keys';
import { SortItem, SortModeList } from './sortModeList';

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

// Sort-modes window (Ctrl+F12): a single SortModeList component.
export class SortPopup extends ComposedPopup {
    private list!: SortModeList;
    private pane: 'left' | 'right' = 'left';

    get targetPane(): 'left' | 'right' {
        return this.pane;
    }

    get selectedItem(): number {
        return this.list ? this.list.selected : 0;
    }

    openSort(pane: 'left' | 'right', sortMode: SortMode, reversed: boolean,
             useSortGroups: boolean, selectedFirst: boolean, dirsFirst: boolean): void {
        this.pane = pane;
        this.list = new SortModeList(SortPopup.buildItems());
        this.list.sortMode = sortMode;
        this.list.sortReversed = reversed;
        this.list.useSortGroups = useSortGroups;
        this.list.selectedFirst = selectedFirst;
        this.list.dirsFirst = dirsFirst;
        this.list.selectCurrentMode();

        const view = this.createView('Sort modes', DBOX, sortMenuTheme);
        view.minWidth = this.computeBoxWidth();
        view.addComponent(this.list, 'list');
        view.onInput = (data) => this.handleSortInput(data);
        view.onScroll = (up) => this.list.moveSelection(up ? -1 : 1);

        this.setActiveView(view);
        super.open();
    }

    private static buildItems(): SortItem[] {
        const items: SortItem[] = [
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
            items.push(
                { type: 'item', label: 'Streams count', hotkeyIndex: 1, mode: 'streams' },
                { type: 'item', label: 'Streams size', hotkeyIndex: 8, mode: 'streamSize' },
            );
        }
        items.push(
            { type: 'separator' },
            { type: 'item', label: 'Use sort groups', hotkeyIndex: 4, shortcut: 'Shift+F11', toggle: 'sortGroups' },
            { type: 'item', label: 'Show selected first', hotkeyIndex: 5, shortcut: 'Shift+F12', toggle: 'selectedFirst' },
            { type: 'item', label: 'Show directories first', hotkeyIndex: 5, toggle: 'dirsFirst' },
        );
        return items;
    }

    private computeBoxWidth(): number {
        let maxLabel = 0;
        let maxShortcut = 0;
        for (const item of this.list.sortItems) {
            if (item.type !== 'item') continue;
            if ((item.label ?? '').length > maxLabel) maxLabel = (item.label ?? '').length;
            if ((item.shortcut ?? '').length > maxShortcut) maxShortcut = (item.shortcut ?? '').length;
        }
        const labelStart = 4;
        const gap = maxShortcut > 0 ? 2 : 0;
        return labelStart + maxLabel + gap + maxShortcut + 1 + 2;
    }

    private handleSortInput(data: string): PopupInputResult | null {
        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            this.close();
            return { action: 'close', confirm: false };
        }
        if (this.list.handleInput(data)) {
            return { action: 'consumed' };
        }
        if (data === KEY_ENTER) {
            return this.activateCurrentItem();
        }
        if (data === KEY_SPACE) {
            if (this.list.current()?.toggle === 'dirsFirst') {
                return this.activateCurrentItem();
            }
            return { action: 'consumed' };
        }
        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            if (this.list.selectByHotkey(data)) {
                return this.activateCurrentItem();
            }
        }
        return { action: 'consumed' };
    }

    private activateCurrentItem(): PopupInputResult {
        const item = this.list.current();
        if (!item || item.type !== 'item') return { action: 'consumed' };

        if (item.toggle === 'dirsFirst') {
            this.list.dirsFirst = !this.list.dirsFirst;
            return { action: 'close', confirm: true, command: { type: 'toggleDirsFirst' } as SortPopupResult };
        }
        if (item.toggle === 'sortGroups') {
            this.list.useSortGroups = !this.list.useSortGroups;
            return { action: 'close', confirm: true, command: { type: 'toggleSortGroups' } as SortPopupResult };
        }
        if (item.toggle === 'selectedFirst') {
            this.list.selectedFirst = !this.list.selectedFirst;
            return { action: 'close', confirm: true, command: { type: 'toggleSelectedFirst' } as SortPopupResult };
        }
        if (item.mode) {
            const reversed = item.mode === this.list.sortMode ? !this.list.sortReversed : false;
            const result: SortPopupResult = { type: 'sort', mode: item.mode, reversed };
            this.close();
            return { action: 'close', confirm: true, command: result };
        }
        return { action: 'consumed' };
    }

    override handleMouseScroll(up: boolean): PopupInputResult {
        this.list.moveSelection(up ? -1 : 1);
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, _fbCol: number): PopupInputResult | null {
        const itemIdx = this.list.itemAtRow(fbRow - this.padV - 1);
        if (itemIdx >= 0) {
            this.list.selected = itemIdx;
            this.mouseDownButton = itemIdx;
            return { action: 'consumed' };
        }
        return null;
    }

    protected override hitTestButton(fbRow: number, _fbCol: number): number {
        return this.list.itemAtRow(fbRow - this.padV - 1);
    }

    protected override onButtonConfirm(buttonIndex: number): PopupInputResult {
        if (buttonIndex >= 0 && buttonIndex < this.list.sortItems.length) {
            this.list.selected = buttonIndex;
            return this.activateCurrentItem();
        }
        return { action: 'consumed' };
    }

    render(paneStartCol: number, paneWidth: number, theme: Theme,
           listStart?: number, listHeight?: number): string {
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
