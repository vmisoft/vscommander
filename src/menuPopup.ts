import { DBOX, MBOX, BOX } from './draw';
import { Theme, PanelSettings } from './settings';
import { SortMode } from './types';
import { Popup, PopupInputResult } from './popup';
import { FrameBuffer } from './frameBuffer';
import { CHECK_MARK } from './visualPrimitives';

export interface DropdownItem {
    type: 'item' | 'separator';
    label?: string;
    hotkeyIndex?: number;
    shortcut?: string;
    checked?: boolean;
    disabled?: boolean;
    command?: string;
}

interface MenuBarEntry {
    label: string;
    hotkeyIndex: number;
    col: number;
    width: number;
}

const MENU_GAP = 4;
const MENU_INDENT = 4;

export type MenuCommand =
    | { type: 'columns'; pane: 'left' | 'right'; columns: number }
    | { type: 'sort'; pane: 'left' | 'right'; mode: SortMode }
    | { type: 'openSortMenu'; pane: 'left' | 'right' }
    | { type: 'reread'; pane: 'left' | 'right' }
    | { type: 'changeDrive'; pane: 'left' | 'right' }
    | { type: 'toggleDotfiles' }
    | { type: 'view' }
    | { type: 'edit' }
    | { type: 'copy' }
    | { type: 'move' }
    | { type: 'mkdir' }
    | { type: 'delete' }
    | { type: 'swapPanels' }
    | { type: 'panelsOnOff' }
    | { type: 'openSettings' }
    | { type: 'changeTheme' }
    | { type: 'editColors' }
    | { type: 'copyThemeColors' }
    | { type: 'resetColors' }
    | { type: 'saveSettings' }
    | { type: 'deleteSettings' }
    | { type: 'resetAllSettings' };

export class MenuPopup extends Popup {
    private menus: MenuBarEntry[] = [];
    private dropdowns: DropdownItem[][] = [];
    selectedMenu = 0;
    selectedItem = 0;
    dropdownOpen = false;
    override padding = 0;

    constructor() {
        super();
    }

    openMenu(settings: PanelSettings, activePane: 'left' | 'right',
             leftSort: SortMode, rightSort: SortMode,
             leftCols: number, rightCols: number,
             hasOverrides: boolean = false): void {
        super.open();
        this.dropdownOpen = false;
        this.selectedMenu = 0;
        this.selectedItem = 0;
        this.buildMenus(settings, activePane, leftSort, rightSort, leftCols, rightCols, hasOverrides);
    }

    close(): void {
        this.dropdownOpen = false;
        super.close();
    }

    private buildMenus(settings: PanelSettings, _activePane: 'left' | 'right',
                        leftSort: SortMode, rightSort: SortMode,
                        leftCols: number, rightCols: number,
                        hasOverrides: boolean = false): void {
        this.menus = [];
        this.dropdowns = [];

        const labels = ['Left', 'Files', 'Commands', 'Options', 'Right'];
        const hotkeyIndices = [0, 0, 0, 0, 0];
        let col = MENU_INDENT + 1;
        for (let i = 0; i < labels.length; i++) {
            const w = labels[i].length;
            this.menus.push({ label: labels[i], hotkeyIndex: hotkeyIndices[i], col, width: w });
            col += w + MENU_GAP;
        }

        this.dropdowns.push(this.buildPaneMenu('left', leftSort, leftCols, settings));
        this.dropdowns.push(this.buildFilesMenu());
        this.dropdowns.push(this.buildCommandsMenu());
        this.dropdowns.push(this.buildOptionsMenu(hasOverrides));
        this.dropdowns.push(this.buildPaneMenu('right', rightSort, rightCols, settings));
    }

    private buildPaneMenu(pane: 'left' | 'right', sortMode: SortMode, cols: number, settings: PanelSettings): DropdownItem[] {
        return [
            { type: 'item', label: 'Brief', shortcut: 'Ctrl+1', checked: cols === 1, command: `${pane}-columns-1` },
            { type: 'item', label: 'Medium', shortcut: 'Ctrl+2', checked: cols === 2, command: `${pane}-columns-2` },
            { type: 'item', label: 'Full', shortcut: 'Ctrl+3', checked: cols === 3, command: `${pane}-columns-3` },
            { type: 'separator' },
            { type: 'item', label: 'Sort modes', hotkeyIndex: 0, shortcut: 'Ctrl+F12', command: `${pane}-sort-menu` },
            { type: 'separator' },
            { type: 'item', label: 'Show dotfiles', shortcut: 'Ctrl+H', checked: settings.showDotfiles, command: 'toggle-dotfiles' },
            { type: 'item', label: 'Re-read', shortcut: 'Ctrl+R', command: `${pane}-reread` },
            { type: 'item', label: 'Change drive', shortcut: pane === 'left' ? 'Alt+F1' : 'Alt+F2', command: `${pane}-drive` },
        ];
    }

    private buildFilesMenu(): DropdownItem[] {
        return [
            { type: 'item', label: 'View', shortcut: 'F3', command: 'view' },
            { type: 'item', label: 'Edit', shortcut: 'F4', command: 'edit' },
            { type: 'item', label: 'Copy', shortcut: 'F5', command: 'copy' },
            { type: 'item', label: 'Rename or move', shortcut: 'F6', command: 'move' },
            { type: 'item', label: 'Make directory', shortcut: 'F7', command: 'mkdir' },
            { type: 'item', label: 'Delete', shortcut: 'F8', command: 'delete' },
        ];
    }

    private buildCommandsMenu(): DropdownItem[] {
        return [
            { type: 'item', label: 'Swap panels', shortcut: 'Ctrl+U', command: 'swap-panels' },
            { type: 'item', label: 'Panels On/Off', shortcut: 'Ctrl+O', command: 'panels-onoff' },
        ];
    }

    private buildOptionsMenu(hasOverrides: boolean): DropdownItem[] {
        return [
            { type: 'item', label: 'All settings', hotkeyIndex: 0, command: 'open-settings' },
            { type: 'item', label: 'Save settings', hotkeyIndex: 0, command: 'save-settings' },
            { type: 'item', label: 'Delete settings', hotkeyIndex: 0, command: 'delete-settings' },
            { type: 'item', label: 'Reset settings', hotkeyIndex: 0, command: 'reset-all-settings' },
            { type: 'separator' },
            { type: 'item', label: 'Change theme', hotkeyIndex: 7, command: 'change-theme' },
            { type: 'item', label: 'Edit colors', hotkeyIndex: 5, command: 'edit-colors' },
            { type: 'item', label: 'Copy theme colors', hotkeyIndex: 0, command: 'copy-theme-colors' },
            { type: 'item', label: 'Reset colors', hotkeyIndex: 0, command: 'reset-colors', disabled: !hasOverrides },
        ];
    }

    handleInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            if (this.dropdownOpen) {
                this.dropdownOpen = false;
                return { action: 'consumed' };
            }
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === '\x1b[D') {
            this.selectedMenu = (this.selectedMenu - 1 + this.menus.length) % this.menus.length;
            this.selectedItem = 0;
            return { action: 'consumed' };
        }

        if (data === '\x1b[C') {
            this.selectedMenu = (this.selectedMenu + 1) % this.menus.length;
            this.selectedItem = 0;
            return { action: 'consumed' };
        }

        if (data === '\x1b[B' || data === '\r') {
            if (!this.dropdownOpen) {
                this.dropdownOpen = true;
                this.selectedItem = this.firstSelectableItem();
                return { action: 'consumed' };
            }
            if (data === '\x1b[B') {
                this.selectedItem = this.nextSelectableItem(1);
                return { action: 'consumed' };
            }
            return this.activateCurrentItem();
        }

        if (data === '\x1b[A') {
            if (this.dropdownOpen) {
                this.selectedItem = this.nextSelectableItem(-1);
                return { action: 'consumed' };
            }
            return { action: 'consumed' };
        }

        if (data === '\x1b[H' || data === '\x1b[1~') {
            if (this.dropdownOpen) {
                this.selectedItem = this.firstSelectableItem();
            } else {
                this.selectedMenu = 0;
            }
            return { action: 'consumed' };
        }

        if (data === '\x1b[F' || data === '\x1b[4~') {
            if (this.dropdownOpen) {
                this.selectedItem = this.lastSelectableItem();
            } else {
                this.selectedMenu = this.menus.length - 1;
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

        if (!this.dropdownOpen) {
            for (let i = 0; i < this.menus.length; i++) {
                const m = this.menus[i];
                if (m.label[m.hotkeyIndex].toLowerCase() === lower) {
                    this.selectedMenu = i;
                    this.dropdownOpen = true;
                    this.selectedItem = this.firstSelectableItem();
                    return { action: 'consumed' };
                }
            }
            return { action: 'consumed' };
        }

        const items = this.dropdowns[this.selectedMenu];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type !== 'item' || !item.label || item.disabled) continue;
            const hi = item.hotkeyIndex ?? 0;
            if (item.label[hi]?.toLowerCase() === lower) {
                this.selectedItem = i;
                return this.activateCurrentItem();
            }
        }
        return { action: 'consumed' };
    }

    private activateCurrentItem(): PopupInputResult {
        const items = this.dropdowns[this.selectedMenu];
        const item = items[this.selectedItem];
        if (!item || item.type !== 'item' || item.disabled || !item.command) {
            return { action: 'consumed' };
        }
        const command = this.parseCommand(item.command);
        this.close();
        return { action: 'close', confirm: true, command };
    }

    parseCommand(cmd: string): MenuCommand | undefined {
        const parts = cmd.split('-');
        if (parts.length === 3 && parts[1] === 'columns') {
            const pane = parts[0] as 'left' | 'right';
            return { type: 'columns', pane, columns: parseInt(parts[2], 10) };
        }
        if (parts.length === 3 && parts[1] === 'sort' && parts[2] === 'menu') {
            return { type: 'openSortMenu', pane: parts[0] as 'left' | 'right' };
        }
        if (parts.length === 3 && parts[1] === 'sort') {
            const pane = parts[0] as 'left' | 'right';
            return { type: 'sort', pane, mode: parts[2] as SortMode };
        }
        if (parts.length === 2 && parts[1] === 'reread') {
            return { type: 'reread', pane: parts[0] as 'left' | 'right' };
        }
        if (parts.length === 2 && parts[1] === 'drive') {
            return { type: 'changeDrive', pane: parts[0] as 'left' | 'right' };
        }
        switch (cmd) {
            case 'toggle-dotfiles': return { type: 'toggleDotfiles' };
            case 'view': return { type: 'view' };
            case 'edit': return { type: 'edit' };
            case 'copy': return { type: 'copy' };
            case 'move': return { type: 'move' };
            case 'mkdir': return { type: 'mkdir' };
            case 'delete': return { type: 'delete' };
            case 'swap-panels': return { type: 'swapPanels' };
            case 'panels-onoff': return { type: 'panelsOnOff' };
            case 'open-settings': return { type: 'openSettings' };
            case 'change-theme': return { type: 'changeTheme' };
            case 'edit-colors': return { type: 'editColors' };
            case 'copy-theme-colors': return { type: 'copyThemeColors' };
            case 'reset-colors': return { type: 'resetColors' };
            case 'save-settings': return { type: 'saveSettings' };
            case 'delete-settings': return { type: 'deleteSettings' };
            case 'reset-all-settings': return { type: 'resetAllSettings' };
        }
        return undefined;
    }

    private firstSelectableItem(): number {
        const items = this.dropdowns[this.selectedMenu];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type === 'item' && !items[i].disabled) return i;
        }
        return 0;
    }

    private lastSelectableItem(): number {
        const items = this.dropdowns[this.selectedMenu];
        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].type === 'item' && !items[i].disabled) return i;
        }
        return 0;
    }

    private nextSelectableItem(dir: number): number {
        const items = this.dropdowns[this.selectedMenu];
        let idx = this.selectedItem;
        for (let step = 0; step < items.length; step++) {
            idx = (idx + dir + items.length) % items.length;
            if (items[idx].type === 'item' && !items[idx].disabled) return idx;
        }
        return this.selectedItem;
    }

    override handleMouseScroll(up: boolean): PopupInputResult {
        if (this.dropdownOpen) {
            this.selectedItem = this.nextSelectableItem(up ? -1 : 1);
        }
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        if (fbRow === 0) {
            for (let i = 0; i < this.menus.length; i++) {
                const m = this.menus[i];
                const relCol = fbCol - (m.col - 1);
                if (relCol >= 0 && relCol < m.width) {
                    if (this.selectedMenu === i && this.dropdownOpen) {
                        this.dropdownOpen = false;
                    } else {
                        this.selectedMenu = i;
                        this.dropdownOpen = true;
                        this.selectedItem = this.firstSelectableItem();
                    }
                    return { action: 'consumed' };
                }
            }
            return { action: 'consumed' };
        }

        if (this.dropdownOpen && this.ddFb) {
            const ddScreenRow = 2;
            const ddScreenCol = this.menus[this.selectedMenu].col - 1;
            const ddRow = fbRow - (ddScreenRow - this.screenRow);
            const ddCol = fbCol - (ddScreenCol - this.screenCol);
            if (ddRow >= 0 && ddRow < this.ddFb.height && ddCol >= 0 && ddCol < this.ddFb.width) {
                const itemIdx = this.dropdownRowToItem(ddRow);
                if (itemIdx >= 0) {
                    this.selectedItem = itemIdx;
                    this.mouseDownButton = itemIdx;
                }
                return { action: 'consumed' };
            }
        }

        return null;
    }

    protected override hitTestButton(fbRow: number, fbCol: number): number {
        if (!this.dropdownOpen || !this.ddFb) return -1;
        const ddScreenRow = 2;
        const ddScreenCol = this.menus[this.selectedMenu].col - 1;
        const ddRow = fbRow - (ddScreenRow - this.screenRow);
        const ddCol = fbCol - (ddScreenCol - this.screenCol);
        if (ddRow >= 0 && ddRow < this.ddFb.height && ddCol >= 0 && ddCol < this.ddFb.width) {
            return this.dropdownRowToItem(ddRow);
        }
        return -1;
    }

    protected override onButtonConfirm(buttonIndex: number): PopupInputResult {
        const items = this.dropdowns[this.selectedMenu];
        if (buttonIndex >= 0 && buttonIndex < items.length) {
            this.selectedItem = buttonIndex;
            return this.activateCurrentItem();
        }
        return { action: 'consumed' };
    }

    private dropdownRowToItem(ddRow: number): number {
        const items = this.dropdowns[this.selectedMenu];
        let row = 1;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type === 'separator') {
                row++;
                continue;
            }
            if (row === ddRow && !items[i].disabled) {
                return i;
            }
            row++;
        }
        return -1;
    }

    private ddFb: FrameBuffer | null = null;

    private renderDropdownBuffer(theme: Theme): FrameBuffer {
        const items = this.dropdowns[this.selectedMenu];
        const t = theme;
        const borderStyle = t.menuBorder.idle;

        let maxLabel = 0;
        let maxShortcut = 0;
        for (const item of items) {
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
        const boxWidth = innerWidth + 2;

        let contentRows = 0;
        for (const item of items) {
            contentRows++;
        }
        const boxHeight = contentRows + 2;

        const fb = new FrameBuffer(boxWidth, boxHeight);
        fb.fill(0, 0, boxWidth, boxHeight, ' ', borderStyle);
        fb.write(0, 0, DBOX.topLeft + DBOX.horizontal.repeat(innerWidth) + DBOX.topRight, borderStyle);
        fb.write(boxHeight - 1, 0, DBOX.bottomLeft + DBOX.horizontal.repeat(innerWidth) + DBOX.bottomRight, borderStyle);

        let row = 1;
        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
            const item = items[itemIdx];
            if (item.type === 'separator') {
                fb.write(row, 0, MBOX.vertDoubleRight + BOX.horizontal.repeat(innerWidth) + MBOX.vertDoubleLeft, borderStyle);
                row++;
                continue;
            }

            const isSelected = this.selectedItem === itemIdx;
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

            const checkMark = item.checked ? CHECK_MARK : ' ';
            fb.write(row, checkCol, checkMark, itemStyle);

            fb.write(row, labelStart, label, itemStyle);
            if (!isDisabled && hotkeyIdx < label.length) {
                fb.write(row, labelStart + hotkeyIdx, label[hotkeyIdx], hotkeyStyle);
            }

            if (shortcut.length > 0) {
                const scCol = 1 + innerWidth - 1 - shortcut.length;
                fb.write(row, scCol, shortcut, itemStyle);
            }

            row++;
        }

        return fb;
    }

    override renderToBuffer(_theme: Theme): FrameBuffer {
        return new FrameBuffer(0, 0);
    }

    render(anchorRow: number, anchorCol: number, theme: Theme, cols?: number): string {
        if (!this.active) return '';
        const t = theme;
        const totalCols = cols ?? this.termCols;
        const out: string[] = [];

        const barFb = new FrameBuffer(totalCols, 1);
        barFb.fill(0, 0, totalCols, 1, ' ', t.menuBar.idle);

        for (let i = 0; i < this.menus.length; i++) {
            const m = this.menus[i];
            const isSelected = i === this.selectedMenu;
            const style = isSelected ? t.menuBar.selected : t.menuBar.idle;
            const hotkeyStyle = isSelected ? t.menuBarHotkey.selected : t.menuBarHotkey.idle;

            barFb.write(0, m.col - 1, m.label, style);
            barFb.write(0, m.col - 1 + m.hotkeyIndex, m.label[m.hotkeyIndex], hotkeyStyle);
        }

        out.push(barFb.toAnsi(anchorRow, anchorCol));

        if (this.dropdownOpen && this.selectedMenu < this.dropdowns.length) {
            this.ddFb = this.renderDropdownBuffer(theme);
            const ddCol = this.menus[this.selectedMenu].col - 1;
            const ddRow = anchorRow + 1;

            let screenCol = anchorCol + ddCol;
            if (screenCol + this.ddFb.width - 1 > totalCols) {
                screenCol = totalCols - this.ddFb.width + 1;
            }
            if (screenCol < 1) screenCol = 1;

            this.setScreenPosition(anchorRow, anchorCol, totalCols, 1);
            this.fbWidth = totalCols;
            this.fbHeight = this.ddFb.height + 1;
            this.screenRow = anchorRow;
            this.screenCol = anchorCol;

            out.push(this.ddFb.toAnsi(ddRow, screenCol));
        } else {
            this.ddFb = null;
            this.screenRow = anchorRow;
            this.screenCol = anchorCol;
            this.fbWidth = totalCols;
            this.fbHeight = 1;
        }

        return out.join('');
    }
}
