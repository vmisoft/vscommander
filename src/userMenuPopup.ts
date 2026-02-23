import { DBOX } from './draw';
import { Theme, matchesKeyBinding } from './settings';
import { PopupInputResult } from './popup';
import { FrameBuffer } from './frameBuffer';
import { ComposedPopup } from './composedPopup';
import { infoFormTheme } from './formView';
import {
    KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_UP, KEY_DOWN, KEY_HOME, KEY_HOME_ALT,
    KEY_END, KEY_END_ALT, KEY_RIGHT, KEY_LEFT, KEY_ENTER, KEY_DELETE,
} from './keys';
import {
    UserMenuItem, ScopedMenuItem, SubstContext, PromptRequest,
    MenuScope, MenuViewMode, mergeMenuItems, substituteVariables,
    isCommentLine, formatHotkeyDisplay,
} from './userMenu';

export type UserMenuCommand =
    | { type: 'execute'; commands: string[] }
    | { type: 'promptAndExecute'; commands: string[]; prompts: PromptRequest[] }
    | { type: 'saveMenu'; scope: MenuScope; items: UserMenuItem[] }
    | { type: 'deleteItem'; scope: MenuScope; items: UserMenuItem[]; itemLabel: string };

type SubState = 'browse' | 'typeChoice' | 'editForm' | 'prompt';

const MIN_WIDTH = 44;
const MAX_WIDTH = 72;
const EDIT_COMMAND_LINES = 6;

export class UserMenuPopup extends ComposedPopup {
    private items: ScopedMenuItem[] = [];
    private userItems: UserMenuItem[] = [];
    private workspaceItems: UserMenuItem[] = [];
    private substContext: SubstContext = {
        activeCwd: '', activeFile: '', activeFileName: '',
        activeExtension: '', passiveCwd: '', passiveFile: '',
        selectedFiles: [], passiveSelectedFiles: [],
    };
    private cursor = 0;
    private scroll = 0;
    private viewMode: MenuViewMode = 'all';
    private filteredItems: ScopedMenuItem[] = [];
    private menuStack: { items: ScopedMenuItem[]; cursor: number; scroll: number }[] = [];
    private subState: SubState = 'browse';

    private typeChoiceCursor = 0;

    private editIsSubmenu = false;
    private editingIndex = -1;

    private promptTitle = '';
    private promptInitValue = '';
    private promptQueue: PromptRequest[] = [];
    private promptValues = new Map<string, string>();
    private promptCommands: string[] = [];

    constructor() {
        super();
    }

    openUserMenu(
        userItems: UserMenuItem[],
        workspaceItems: UserMenuItem[],
        context: SubstContext,
    ): void {
        this.userItems = userItems;
        this.workspaceItems = workspaceItems;
        this.substContext = context;
        this.items = mergeMenuItems(userItems, workspaceItems);
        this.viewMode = 'all';
        this.menuStack = [];
        this.applyFilter();
        this.cursor = 0;
        this.scroll = 0;
        this.subState = 'browse';
        this.setActiveView(null);
        super.open();
    }

    private applyFilter(): void {
        if (this.viewMode === 'all') {
            this.filteredItems = this.items;
        } else {
            this.filteredItems = this.items.filter(i => i.scope === this.viewMode);
        }
    }

    private get visibleHeight(): number {
        return Math.min(this.filteredItems.length, Math.max(0, this.termRows - 8));
    }

    private get dialogWidth(): number {
        let maxLabel = 20;
        for (const item of this.filteredItems) {
            const w = formatHotkeyDisplay(item.hotkey).length + item.label.length + 8;
            if (w > maxLabel) maxLabel = w;
        }
        return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, maxLabel + 4));
    }

    // --- Input routing ---

    handleInput(data: string): PopupInputResult {
        switch (this.subState) {
            case 'browse': return this.handleBrowseInput(data);
            case 'typeChoice': return this.handleTypeChoiceInput(data);
            default: return super.handleInput(data);
        }
    }

    // --- Rendering ---

    override renderToBuffer(theme: Theme): FrameBuffer {
        switch (this.subState) {
            case 'browse': return this.renderBrowseBuffer(theme);
            case 'typeChoice': return this.renderTypeChoiceBuffer(theme);
            default: return super.renderToBuffer(theme);
        }
    }

    get hasBlink(): boolean {
        if (this.subState === 'browse' || this.subState === 'typeChoice') return false;
        return super.hasBlink;
    }

    resetUserMenuBlink(): void {
        if (this.activeView) this.activeView.resetBlinks();
    }

    renderUserMenuBlink(rows: number, cols: number, theme: Theme): string {
        if (!this.active) return '';
        if (this.subState === 'browse' || this.subState === 'typeChoice') return '';
        return this.renderBlink(rows, cols, theme);
    }

    // --- Mouse ---

    override handleMouseScroll(up: boolean): PopupInputResult {
        if (this.subState !== 'browse') return { action: 'consumed' };
        const len = this.filteredItems.length;
        if (len === 0) return { action: 'consumed' };
        if (up) {
            this.cursor = Math.max(0, this.cursor - 3);
        } else {
            this.cursor = Math.min(len - 1, this.cursor + 3);
        }
        this.ensureVisible();
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        if (this.subState === 'browse') {
            const boxRow = this.padV;
            const relRow = fbRow - boxRow - 1;
            const vh = this.visibleHeight;
            if (relRow >= 0 && relRow < vh) {
                const idx = this.scroll + relRow;
                if (idx < this.filteredItems.length) {
                    this.cursor = idx;
                    return this.executeCurrentItem();
                }
            }
            return null;
        }
        return super.onMouseDown(fbRow, fbCol);
    }

    // --- Browse state ---

    private handleBrowseInput(data: string): PopupInputResult {
        const len = this.filteredItems.length;

        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            if (this.menuStack.length > 0) {
                this.popSubmenu();
                return { action: 'consumed' };
            }
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === KEY_UP) {
            if (len === 0) return { action: 'consumed' };
            this.cursor = (this.cursor - 1 + len) % len;
            this.ensureVisible();
            return { action: 'consumed' };
        }

        if (data === KEY_DOWN) {
            if (len === 0) return { action: 'consumed' };
            this.cursor = (this.cursor + 1) % len;
            this.ensureVisible();
            return { action: 'consumed' };
        }

        if (data === KEY_HOME || data === KEY_HOME_ALT) {
            this.cursor = 0;
            this.scroll = 0;
            return { action: 'consumed' };
        }

        if (data === KEY_END || data === KEY_END_ALT) {
            this.cursor = Math.max(0, len - 1);
            this.ensureVisible();
            return { action: 'consumed' };
        }

        if (data === KEY_ENTER) {
            return this.executeCurrentItem();
        }

        if (data === KEY_RIGHT) {
            if (len > 0 && this.filteredItems[this.cursor].submenu) {
                return this.enterSubmenu();
            }
            return { action: 'consumed' };
        }

        if (data === KEY_LEFT) {
            if (this.menuStack.length > 0) {
                this.popSubmenu();
                return { action: 'consumed' };
            }
            return { action: 'consumed' };
        }

        if (matchesKeyBinding(data, 'Insert')) {
            this.subState = 'typeChoice';
            this.typeChoiceCursor = 0;
            return { action: 'consumed' };
        }

        if (matchesKeyBinding(data, 'F4')) {
            if (len > 0) {
                this.openEditForm(this.cursor);
            }
            return { action: 'consumed' };
        }

        if (data === KEY_DELETE) {
            if (len > 0) {
                const item = this.filteredItems[this.cursor];
                const scope = item.scope;
                const sourceItems = scope === 'user' ? this.userItems : this.workspaceItems;
                const newItems = removeItem(sourceItems, item);
                const cmd: UserMenuCommand = {
                    type: 'deleteItem', scope, items: newItems, itemLabel: item.label,
                };
                this.close();
                return { action: 'close', confirm: true, command: cmd };
            }
            return { action: 'consumed' };
        }

        if (matchesKeyBinding(data, 'Ctrl+Up')) {
            if (len > 0 && this.cursor > 0) {
                this.reorderItem(-1);
            }
            return { action: 'consumed' };
        }

        if (matchesKeyBinding(data, 'Ctrl+Down')) {
            if (len > 0 && this.cursor < len - 1) {
                this.reorderItem(1);
            }
            return { action: 'consumed' };
        }

        if (matchesKeyBinding(data, 'Shift+F2')) {
            if (this.viewMode === 'all') this.viewMode = 'user';
            else if (this.viewMode === 'user') this.viewMode = 'workspace';
            else this.viewMode = 'all';
            this.applyFilter();
            if (this.cursor >= this.filteredItems.length) {
                this.cursor = Math.max(0, this.filteredItems.length - 1);
            }
            this.ensureVisible();
            return { action: 'consumed' };
        }

        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            const ch = data.toLowerCase();
            for (let i = 0; i < len; i++) {
                const item = this.filteredItems[i];
                if (item.hotkey.toLowerCase() === ch) {
                    this.cursor = i;
                    this.ensureVisible();
                    return this.executeCurrentItem();
                }
            }
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    private executeCurrentItem(): PopupInputResult {
        const len = this.filteredItems.length;
        if (len === 0) return { action: 'consumed' };
        const item = this.filteredItems[this.cursor];

        if (item.submenu) {
            return this.enterSubmenu();
        }

        const commands = item.commands.filter(c => !isCommentLine(c) && c.trim() !== '');
        if (commands.length === 0) return { action: 'consumed' };

        const allPrompts: PromptRequest[] = [];
        const substituted: string[] = [];
        for (const cmd of commands) {
            const { result, prompts } = substituteVariables(cmd, this.substContext);
            substituted.push(result);
            allPrompts.push(...prompts);
        }

        if (allPrompts.length > 0) {
            this.promptCommands = commands;
            this.promptQueue = allPrompts;
            this.promptValues.clear();
            this.startNextPrompt();
            return { action: 'consumed' };
        }

        const executeCmd: UserMenuCommand = { type: 'execute', commands: substituted };
        this.close();
        return { action: 'close', confirm: true, command: executeCmd };
    }

    private enterSubmenu(): PopupInputResult {
        const item = this.filteredItems[this.cursor];
        if (!item.submenu) return { action: 'consumed' };
        this.menuStack.push({
            items: this.filteredItems,
            cursor: this.cursor,
            scroll: this.scroll,
        });
        this.filteredItems = item.children as ScopedMenuItem[];
        this.cursor = 0;
        this.scroll = 0;
        return { action: 'consumed' };
    }

    private popSubmenu(): void {
        const prev = this.menuStack.pop()!;
        this.filteredItems = prev.items;
        this.cursor = prev.cursor;
        this.scroll = prev.scroll;
    }

    private ensureVisible(): void {
        const vh = this.visibleHeight;
        if (this.cursor < this.scroll) this.scroll = this.cursor;
        if (this.cursor >= this.scroll + vh) this.scroll = this.cursor - vh + 1;
    }

    private reorderItem(dir: number): void {
        const item = this.filteredItems[this.cursor];
        const scope = item.scope;
        const sourceItems = scope === 'user' ? this.userItems : this.workspaceItems;
        const idx = findItemIndex(sourceItems, item);
        if (idx < 0) return;

        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= sourceItems.length) return;

        const newItems = [...sourceItems];
        [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];

        if (scope === 'user') this.userItems = newItems;
        else this.workspaceItems = newItems;
        this.items = mergeMenuItems(this.userItems, this.workspaceItems);
        this.applyFilter();

        this.cursor += dir;
        this.ensureVisible();
    }

    private renderBrowseBuffer(theme: Theme): FrameBuffer {
        const t = theme;
        const w = this.dialogWidth;
        const vh = this.visibleHeight;
        const innerW = w - 2;
        const boxH = vh + 2;
        const totalW = w + 2 * this.padH;
        const totalH = boxH + 2 * this.padV;
        const boxRow = this.padV;
        const boxCol = this.padH;
        const bodyStyle = t.popupActionBody.idle;
        const selectedStyle = t.popupActionText.selected;
        const hotkeyStyle = t.popupActionNumber.idle;
        const hotkeySelStyle = t.popupActionNumber.selected;

        let title = 'User Menu';
        if (this.viewMode === 'user') title = 'User Menu (User)';
        else if (this.viewMode === 'workspace') title = 'User Menu (Workspace)';

        const fb = new FrameBuffer(totalW, totalH);
        fb.fill(0, 0, totalW, totalH, ' ', bodyStyle);
        fb.drawBox(boxRow, boxCol, w, boxH, bodyStyle, DBOX, title);

        for (let i = 0; i < vh; i++) {
            const idx = this.scroll + i;
            if (idx >= this.filteredItems.length) break;
            const item = this.filteredItems[idx];
            const isCursor = idx === this.cursor;
            const rowStyle = isCursor ? selectedStyle : bodyStyle;
            const hkStyle = isCursor ? hotkeySelStyle : hotkeyStyle;

            const hk = formatHotkeyDisplay(item.hotkey);
            const submenuMark = item.submenu ? ' >>' : '   ';
            const scopeMark = ' (' + item.scope[0] + ')';
            const labelSpace = innerW - hk.length - 2 - submenuMark.length - scopeMark.length;
            const displayLabel = item.label.length > labelSpace
                ? item.label.slice(0, labelSpace)
                : item.label + ' '.repeat(Math.max(0, labelSpace - item.label.length));

            const line = ' ' + hk + displayLabel + submenuMark + scopeMark + ' ';
            fb.write(boxRow + 1 + i, boxCol + 1, ' '.repeat(innerW), rowStyle);
            fb.write(boxRow + 1 + i, boxCol + 1, line.slice(0, innerW), rowStyle);
            fb.write(boxRow + 1 + i, boxCol + 2, hk, hkStyle);
        }

        if (this.scroll > 0) {
            fb.write(boxRow, boxCol + w - 3, '^', bodyStyle);
        }
        if (this.scroll + vh < this.filteredItems.length) {
            fb.write(boxRow + boxH - 1, boxCol + w - 3, 'v', bodyStyle);
        }

        const hint = 'Ins Del F4 Ctrl+Up/Dn Shift+F2';
        const hintPad = Math.max(0, Math.floor((innerW - hint.length) / 2));
        fb.write(boxRow + boxH - 1, boxCol + 1 + hintPad, hint, bodyStyle);

        return fb;
    }

    // --- Type Choice state ---

    private handleTypeChoiceInput(data: string): PopupInputResult {
        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            this.subState = 'browse';
            return { action: 'consumed' };
        }

        if (data === KEY_UP || data === KEY_DOWN) {
            this.typeChoiceCursor = this.typeChoiceCursor === 0 ? 1 : 0;
            return { action: 'consumed' };
        }

        if (data === KEY_ENTER) {
            this.openNewEditForm(this.typeChoiceCursor === 1);
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    private renderTypeChoiceBuffer(theme: Theme): FrameBuffer {
        const t = theme;
        const w = 30;
        const boxH = 5;
        const totalW = w + 2 * this.padH;
        const totalH = boxH + 2 * this.padV;
        const boxRow = this.padV;
        const boxCol = this.padH;
        const bodyStyle = t.popupActionBody.idle;
        const selectedStyle = t.popupActionText.selected;

        const fb = new FrameBuffer(totalW, totalH);
        fb.fill(0, 0, totalW, totalH, ' ', bodyStyle);
        fb.drawBox(boxRow, boxCol, w, boxH, bodyStyle, DBOX, 'New item');

        const options = ['Command', 'Submenu'];
        for (let i = 0; i < options.length; i++) {
            const style = i === this.typeChoiceCursor ? selectedStyle : bodyStyle;
            const text = '  ' + options[i] + ' '.repeat(w - 4 - options[i].length);
            fb.write(boxRow + 1 + i, boxCol + 1, text, style);
        }

        return fb;
    }

    // --- Edit Form state (FormView) ---

    private openEditForm(index: number): void {
        const item = index >= 0 ? this.filteredItems[index] : null;
        this.editingIndex = index;
        this.editIsSubmenu = item ? item.submenu : false;
        this.buildEditFormView(item);
    }

    private openNewEditForm(isSubmenu: boolean): void {
        this.editingIndex = -1;
        this.editIsSubmenu = isSubmenu;
        this.buildEditFormView(null);
    }

    private buildEditFormView(item: ScopedMenuItem | null): void {
        const w = Math.max(40, Math.min(MAX_WIDTH, this.termCols - 8));
        const fieldW = w - 6;
        const title = this.editIsSubmenu ? 'Edit submenu' : 'Edit menu command';

        const view = this.createView(title, undefined, infoFormTheme);
        view.minWidth = w;

        view.addLabel('Hot key:', { hotkey: 'H' });
        view.addInput('hotkey', 6, item ? item.hotkey : '');
        view.addLabel('Label:', { hotkey: 'L' });
        view.addInput('label', fieldW, item ? item.label : '');

        if (!this.editIsSubmenu) {
            view.addSeparator();
            view.addLabel('Commands:', { hotkey: 'C' });
            const existingCmds = item ? item.commands : [];
            for (let i = 0; i < EDIT_COMMAND_LINES; i++) {
                view.addInput('cmd' + i, fieldW,
                    i < existingCmds.length ? existingCmds[i] : '');
            }
        }

        view.addSeparator();
        view.addRadio('scope', 'Scope:',
            ['(u) User', '(w) Workspace'],
            item ? (item.scope === 'workspace' ? 1 : 0) : 0);
        view.addSeparator();
        view.addButtons('buttons', ['OK', 'Cancel']);

        view.onConfirm = () => this.saveEditForm();
        view.onCancel = () => {
            this.subState = 'browse';
            this.setActiveView(null);
            return { action: 'consumed' } as PopupInputResult;
        };

        this.subState = 'editForm';
        this.setActiveView(view);
    }

    private saveEditForm(): PopupInputResult {
        const view = this.activeView!;
        const hotkey = view.input('hotkey').buffer.trim();
        const label = view.input('label').buffer.trim();
        if (!hotkey || !label) {
            this.subState = 'browse';
            this.setActiveView(null);
            return { action: 'consumed' };
        }

        const commands: string[] = [];
        if (!this.editIsSubmenu) {
            for (let i = 0; i < EDIT_COMMAND_LINES; i++) {
                commands.push(view.input('cmd' + i).buffer);
            }
            while (commands.length > 0 && commands[commands.length - 1].trim() === '') {
                commands.pop();
            }
        }

        const newItem: UserMenuItem = {
            hotkey,
            label,
            commands,
            submenu: this.editIsSubmenu,
            children: this.editIsSubmenu
                ? (this.editingIndex >= 0 ? this.filteredItems[this.editingIndex].children : [])
                : [],
        };

        const scope: MenuScope = view.radioValue('scope') === 0 ? 'user' : 'workspace';
        const sourceItems = scope === 'user' ? [...this.userItems] : [...this.workspaceItems];

        if (this.editingIndex >= 0) {
            const existing = this.filteredItems[this.editingIndex];
            if (existing.scope === scope) {
                const idx = findItemIndex(sourceItems, existing);
                if (idx >= 0) {
                    sourceItems[idx] = newItem;
                } else {
                    sourceItems.push(newItem);
                }
            } else {
                const oldScope = existing.scope;
                const oldItems = oldScope === 'user' ? [...this.userItems] : [...this.workspaceItems];
                const oldIdx = findItemIndex(oldItems, existing);
                if (oldIdx >= 0) {
                    oldItems.splice(oldIdx, 1);
                    if (oldScope === 'user') this.userItems = oldItems;
                    else this.workspaceItems = oldItems;
                }
                sourceItems.push(newItem);
            }
        } else {
            sourceItems.push(newItem);
        }

        const cmd: UserMenuCommand = { type: 'saveMenu', scope, items: sourceItems };
        this.close();
        return { action: 'close', confirm: true, command: cmd };
    }

    // --- Prompt state (FormView) ---

    private startNextPrompt(): void {
        if (this.promptQueue.length === 0) {
            this.subState = 'browse';
            this.setActiveView(null);
            return;
        }

        const prompt = this.promptQueue.shift()!;
        this.promptTitle = prompt.title;
        this.promptInitValue = prompt.initialValue;
        this.openPromptView(prompt.title, prompt.initialValue);
    }

    private openPromptView(title: string, initial: string): void {
        const w = Math.max(30, Math.min(MAX_WIDTH, this.termCols - 8));
        const fieldW = w - 6;

        const view = this.createView(title || 'Input', undefined, infoFormTheme);
        view.minWidth = w;

        view.addLabel('Enter value:');
        view.addInput('value', fieldW, initial);
        view.addSeparator();
        view.addButtons('buttons', ['OK', 'Cancel']);

        view.onConfirm = () => this.handlePromptConfirm();
        view.onCancel = () => {
            this.subState = 'browse';
            this.setActiveView(null);
            return { action: 'consumed' } as PopupInputResult;
        };

        this.subState = 'prompt';
        this.setActiveView(view);
    }

    private handlePromptConfirm(): PopupInputResult {
        const view = this.activeView!;
        const value = view.input('value').buffer;
        const key = this.promptTitle + '?' + this.promptInitValue;
        this.promptValues.set(key, value);

        this.startNextPrompt();
        if (this.subState === 'prompt') {
            return { action: 'consumed' };
        }

        const substituted: string[] = [];
        for (const cmd of this.promptCommands) {
            const { result: r } = substituteVariables(cmd, this.substContext, this.promptValues);
            substituted.push(r);
        }
        const executeCmd: UserMenuCommand = { type: 'execute', commands: substituted };
        this.close();
        return { action: 'close', confirm: true, command: executeCmd };
    }
}

function findItemIndex(items: UserMenuItem[], target: ScopedMenuItem): number {
    for (let i = 0; i < items.length; i++) {
        if (items[i].hotkey === target.hotkey && items[i].label === target.label) {
            return i;
        }
    }
    return -1;
}

function removeItem(items: UserMenuItem[], target: ScopedMenuItem): UserMenuItem[] {
    const idx = findItemIndex(items, target);
    if (idx < 0) return items;
    const result = [...items];
    result.splice(idx, 1);
    return result;
}
