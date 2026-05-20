import { Theme, PanelSettings } from '../../settings';
import { SortMode } from '../../types';
import { PopupInputResult } from '../../components/popup';
import { ComposedPopup } from '../../components/composedPopup';
import { FrameBuffer } from '../../frameBuffer';
import {
    KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_HOME, KEY_HOME_ALT,
    KEY_END, KEY_END_ALT, KEY_ENTER, KEY_ESCAPE, KEY_DOUBLE_ESCAPE,
} from '../../keys';
import { MenuBar } from './menuBar';
import { DropdownItem, DropdownMenu } from './dropdownMenu';

export { DropdownItem } from './dropdownMenu';

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

// The F9 menu window: a MenuBar plus one DropdownMenu component per menu.
export class MenuPopup extends ComposedPopup {
    private bar = new MenuBar([], [], MENU_INDENT, MENU_GAP);
    private dropdowns: DropdownMenu[] = [];
    dropdownOpen = false;
    override padding = 0;
    private ddFb: FrameBuffer | null = null;

    get selectedMenu(): number {
        return this.bar.selected;
    }

    get selectedItem(): number {
        return this.dropdowns.length ? this.currentDropdown().selected : 0;
    }

    openMenu(settings: PanelSettings, activePane: 'left' | 'right',
             leftSort: SortMode, rightSort: SortMode,
             leftCols: number, rightCols: number,
             hasOverrides: boolean = false): void {
        super.open();
        this.dropdownOpen = false;
        this.buildMenus(settings, activePane, leftSort, rightSort, leftCols, rightCols, hasOverrides);
    }

    close(): void {
        this.dropdownOpen = false;
        super.close();
    }

    private currentDropdown(): DropdownMenu {
        return this.dropdowns[this.bar.selected];
    }

    private buildMenus(settings: PanelSettings, _activePane: 'left' | 'right',
                        leftSort: SortMode, rightSort: SortMode,
                        leftCols: number, rightCols: number,
                        hasOverrides: boolean = false): void {
        this.bar = new MenuBar(
            ['Left', 'Files', 'Commands', 'Options', 'Right'],
            [0, 0, 0, 0, 0], MENU_INDENT, MENU_GAP);
        this.dropdowns = [
            new DropdownMenu(this.buildPaneMenu('left', leftSort, leftCols, settings)),
            new DropdownMenu(this.buildFilesMenu()),
            new DropdownMenu(this.buildCommandsMenu()),
            new DropdownMenu(this.buildOptionsMenu(hasOverrides)),
            new DropdownMenu(this.buildPaneMenu('right', rightSort, rightCols, settings)),
        ];
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
        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            if (this.dropdownOpen) {
                this.dropdownOpen = false;
                return { action: 'consumed' };
            }
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === KEY_LEFT) {
            this.bar.selected = (this.bar.selected - 1 + this.bar.count) % this.bar.count;
            this.currentDropdown().selected = this.currentDropdown().firstSelectable();
            return { action: 'consumed' };
        }

        if (data === KEY_RIGHT) {
            this.bar.selected = (this.bar.selected + 1) % this.bar.count;
            this.currentDropdown().selected = this.currentDropdown().firstSelectable();
            return { action: 'consumed' };
        }

        if (data === KEY_DOWN || data === KEY_ENTER) {
            if (!this.dropdownOpen) {
                this.dropdownOpen = true;
                this.currentDropdown().selected = this.currentDropdown().firstSelectable();
                return { action: 'consumed' };
            }
            if (data === KEY_DOWN) {
                this.currentDropdown().moveSelection(1);
                return { action: 'consumed' };
            }
            return this.activateCurrentItem();
        }

        if (data === KEY_UP) {
            if (this.dropdownOpen) {
                this.currentDropdown().moveSelection(-1);
            }
            return { action: 'consumed' };
        }

        if (data === KEY_HOME || data === KEY_HOME_ALT) {
            if (this.dropdownOpen) {
                this.currentDropdown().selected = this.currentDropdown().firstSelectable();
            } else {
                this.bar.selected = 0;
            }
            return { action: 'consumed' };
        }

        if (data === KEY_END || data === KEY_END_ALT) {
            if (this.dropdownOpen) {
                this.currentDropdown().selected = this.currentDropdown().lastSelectable();
            } else {
                this.bar.selected = this.bar.count - 1;
            }
            return { action: 'consumed' };
        }

        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            return this.handleHotkey(data);
        }

        return { action: 'consumed' };
    }

    private handleHotkey(ch: string): PopupInputResult {
        if (!this.dropdownOpen) {
            if (this.bar.selectByHotkey(ch)) {
                this.dropdownOpen = true;
                this.currentDropdown().selected = this.currentDropdown().firstSelectable();
            }
            return { action: 'consumed' };
        }
        if (this.currentDropdown().selectByHotkey(ch)) {
            return this.activateCurrentItem();
        }
        return { action: 'consumed' };
    }

    private activateCurrentItem(): PopupInputResult {
        const item = this.currentDropdown().current();
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

    override handleMouseScroll(up: boolean): PopupInputResult {
        if (this.dropdownOpen) {
            this.currentDropdown().moveSelection(up ? -1 : 1);
        }
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        if (fbRow === 0) {
            const i = this.bar.hitTest(fbCol);
            if (i >= 0) {
                if (this.bar.selected === i && this.dropdownOpen) {
                    this.dropdownOpen = false;
                } else {
                    this.bar.selected = i;
                    this.dropdownOpen = true;
                    this.currentDropdown().selected = this.currentDropdown().firstSelectable();
                }
            }
            return { action: 'consumed' };
        }

        if (this.dropdownOpen && this.ddFb) {
            const ddRow = fbRow - (2 - this.screenRow);
            const ddCol = fbCol - (this.bar.entries[this.bar.selected].col - 1 - this.screenCol);
            if (ddRow >= 0 && ddRow < this.ddFb.height && ddCol >= 0 && ddCol < this.ddFb.width) {
                const itemIdx = this.currentDropdown().rowToItem(ddRow);
                if (itemIdx >= 0) {
                    this.currentDropdown().selected = itemIdx;
                    this.mouseDownButton = itemIdx;
                }
                return { action: 'consumed' };
            }
        }

        return null;
    }

    protected override hitTestButton(fbRow: number, fbCol: number): number {
        if (!this.dropdownOpen || !this.ddFb) return -1;
        const ddRow = fbRow - (2 - this.screenRow);
        const ddCol = fbCol - (this.bar.entries[this.bar.selected].col - 1 - this.screenCol);
        if (ddRow >= 0 && ddRow < this.ddFb.height && ddCol >= 0 && ddCol < this.ddFb.width) {
            return this.currentDropdown().rowToItem(ddRow);
        }
        return -1;
    }

    protected override onButtonConfirm(buttonIndex: number): PopupInputResult {
        const items = this.currentDropdown().items;
        if (buttonIndex >= 0 && buttonIndex < items.length) {
            this.currentDropdown().selected = buttonIndex;
            return this.activateCurrentItem();
        }
        return { action: 'consumed' };
    }

    override renderToBuffer(_theme: Theme): FrameBuffer {
        return new FrameBuffer(0, 0);
    }

    render(anchorRow: number, anchorCol: number, theme: Theme, cols?: number): string {
        if (!this.active) return '';
        const totalCols = cols ?? this.termCols;
        const out: string[] = [];

        out.push(this.bar.render(totalCols, theme).toAnsi(anchorRow, anchorCol));

        if (this.dropdownOpen && this.bar.selected < this.dropdowns.length) {
            this.ddFb = this.currentDropdown().render(theme);
            const ddCol = this.bar.entries[this.bar.selected].col - 1;
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
