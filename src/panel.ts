import * as os from 'os';
import * as path from 'path';
import {
    enterAltScreen, leaveAltScreen, clearScreen, showCursor, hideCursor,
    resetStyle, moveTo, bgRgb, BOX, DBOX, MBOX, enableMouse, disableMouse
} from './draw';
import { MouseEvent, parseMouseEvent } from './mouse';
import { PanelSettings, TextStyle, KeyBindings, matchesKeyBinding, getFKeyNumber } from './settings';
import { Layout, PaneGeometry } from './types';
import { applyStyle, computeLayout, entryRenderStyle } from './helpers';
import { Pane } from './pane';
import { Popup, PopupInputResult } from './popup';
import { SearchPopup } from './searchPopup';
import { DrivePopup } from './drivePopup';
import { ConfirmPopup } from './confirmPopup';
import { MkdirPopup } from './mkdirPopup';
import { MenuPopup, MenuCommand } from './menuPopup';
import { CopyMovePopup, CopyMoveMode, CopyMoveResult } from './copyMovePopup';
import { TerminalBuffer } from './terminalBuffer';

export type PanelInputResult =
    | { action: 'quit' }
    | { action: 'close' }
    | { action: 'redraw'; data: string; chdir?: string }
    | { action: 'input'; data: string; redraw: string }
    | { action: 'executeCommand'; data: string }
    | { action: 'settingsChanged' }
    | { action: 'openSettings' }
    | { action: 'toggleDetach' }
    | { action: 'openFile'; filePath: string }
    | { action: 'viewFile'; filePath: string }
    | { action: 'deleteFile'; filePath: string; toTrash: boolean }
    | { action: 'mkdir'; cwd: string; folderName: string; linkType: 'none' | 'symbolic' | 'junction'; linkTarget: string; multipleNames: boolean }
    | { action: 'copyMove'; result: CopyMoveResult }
    | { action: 'none' };

export class Panel {
    visible = false;
    cols: number;
    rows: number;
    left: Pane;
    right: Pane;
    activePane: 'left' | 'right' = 'left';
    shellInputLen = 0;
    settings: PanelSettings;
    searchPopup: SearchPopup;
    drivePopup: DrivePopup;
    confirmPopup: ConfirmPopup;
    mkdirPopup: MkdirPopup;
    menuPopup: MenuPopup;
    copyMovePopup: CopyMovePopup;
    termBuffer: TerminalBuffer;
    inactivePaneHidden = false;
    cmdCursorVisible = true;
    splitOffset = 0;
    waitingMode = false;
    spinnerFrame = 0;
    private lastClickTime = 0;
    private lastClickEntry = -1;
    private lastClickPane: 'left' | 'right' = 'left';

    constructor(cols: number, rows: number, cwd: string, settings: PanelSettings) {
        this.cols = cols;
        this.rows = rows;
        this.settings = settings;
        this.left = new Pane(cwd, settings);
        this.right = new Pane(cwd, settings);
        this.searchPopup = new SearchPopup();
        this.drivePopup = new DrivePopup();
        this.confirmPopup = new ConfirmPopup();
        this.mkdirPopup = new MkdirPopup();
        this.menuPopup = new MenuPopup();
        this.copyMovePopup = new CopyMovePopup();
        this.termBuffer = new TerminalBuffer(cols, rows);
        this.syncPopupBounds();
    }

    show(): string {
        this.visible = true;
        this.left.refresh(this.settings);
        this.right.refresh(this.settings);
        return enterAltScreen() + enableMouse() + this.render();
    }

    hide(): string {
        this.visible = false;
        this.waitingMode = false;
        return disableMouse() + showCursor() + leaveAltScreen();
    }

    renderSpinnerUpdate(): string {
        if (!this.visible || !this.waitingMode) return '';
        this.spinnerFrame++;
        const layout = this.getLayout();
        return this.renderCommandLine(layout) + hideCursor();
    }

    resize(cols: number, rows: number): string {
        this.cols = cols;
        this.rows = rows;
        this.termBuffer.resize(cols, rows);
        this.syncPopupBounds();
        if (this.visible) {
            return leaveAltScreen() + enterAltScreen() + enableMouse() + this.render();
        }
        return '';
    }

    private syncPopupBounds(): void {
        for (const p of [this.searchPopup, this.drivePopup, this.confirmPopup, this.mkdirPopup, this.menuPopup, this.copyMovePopup]) {
            p.termRows = this.rows;
            p.termCols = this.cols;
        }
    }

    private get leftWidth(): number {
        const base = Math.floor(this.cols / 2);
        const minWidth = 10;
        return Math.max(minWidth, Math.min(this.cols - minWidth, base + this.splitOffset));
    }

    private getLayout(): Layout {
        return computeLayout(this.rows, this.cols, this.settings.panelColumns, this.leftWidth, this.left.colCount, this.right.colCount);
    }

    get hasActivePopup(): boolean {
        return this.searchPopup.active || this.drivePopup.active
            || this.confirmPopup.active || this.mkdirPopup.active
            || this.menuPopup.active || this.copyMovePopup.active;
    }

    private get activePopupObj(): Popup | null {
        if (this.confirmPopup.active) return this.confirmPopup;
        if (this.copyMovePopup.active) return this.copyMovePopup;
        if (this.mkdirPopup.active) return this.mkdirPopup;
        if (this.drivePopup.active) return this.drivePopup;
        if (this.menuPopup.active) return this.menuPopup;
        if (this.searchPopup.active) return this.searchPopup;
        return null;
    }

    get activePaneObj(): Pane {
        return this.activePane === 'left' ? this.left : this.right;
    }

    get isSearchActive(): boolean {
        return this.searchPopup.active;
    }

    resetSearchBlink(): void {
        this.searchPopup.cursorVisible = true;
    }

    resetCmdBlink(): void {
        this.cmdCursorVisible = true;
    }

    renderCmdCursorBlink(): string {
        if (!this.visible || this.waitingMode || this.hasActivePopup) return '';
        this.cmdCursorVisible = !this.cmdCursorVisible;
        const layout = this.getLayout();
        return this.renderCmdCursor(layout);
    }

    renderClockUpdate(): string {
        if (!this.visible || !this.settings.clockEnabled || this.hasActivePopup) return '';
        const layout = this.getLayout();
        const t = this.settings.theme;
        const leftIsActive = this.activePane === 'left';
        if (this.inactivePaneHidden && leftIsActive) return '';
        return this.right.render({
            geo: layout.rightPane, layout, theme: t,
            isActive: !leftIsActive, showClock: true,
            selected: this.right.selected,
        });
    }

    get isMkdirBlinkActive(): boolean {
        return this.mkdirPopup.active && this.mkdirPopup.hasBlink;
    }

    resetMkdirBlink(): void {
        this.mkdirPopup.resetMkdirBlink();
    }

    renderMkdirCursorBlink(): string {
        if (!this.visible || !this.mkdirPopup.active) return '';
        return this.mkdirPopup.renderMkdirBlink(this.rows, this.cols, this.settings.theme);
    }

    get isCopyMoveBlinkActive(): boolean {
        return this.copyMovePopup.active && this.copyMovePopup.hasBlink;
    }

    resetCopyMoveBlink(): void {
        this.copyMovePopup.resetCopyMoveBlink();
    }

    renderCopyMoveCursorBlink(): string {
        if (!this.visible || !this.copyMovePopup.active) return '';
        return this.copyMovePopup.renderCopyMoveBlink(this.rows, this.cols, this.settings.theme);
    }

    renderSearchCursorBlink(): string {
        if (!this.visible || !this.searchPopup.active) return '';
        const layout = this.getLayout();
        const activePaneGeo = this.activePane === 'left' ? layout.leftPane : layout.rightPane;
        return this.searchPopup.renderBlink(layout.bottomRow, activePaneGeo.startCol, this.settings.theme);
    }

    renderShellUpdate(): string {
        if (!this.visible || this.waitingMode || this.hasActivePopup) return '';
        const layout = this.getLayout();
        const out: string[] = [];
        out.push(this.renderCommandLine(layout));
        if (this.inactivePaneHidden) {
            out.push(this.renderTerminalArea(layout));
        }
        out.push(this.renderCmdCursor(layout));
        return out.join('');
    }

    handleInput(data: string): PanelInputResult {
        if (!this.visible) return { action: 'none' };

        const pane = this.activePaneObj;
        const layout = this.getLayout();
        const listHeight = layout.listHeight;
        const activePaneGeo = this.activePane === 'left' ? layout.leftPane : layout.rightPane;
        const pageCapacity = listHeight * activePaneGeo.numCols;

        if (data.startsWith('\x1b[M')) {
            return { action: 'none' };
        }

        if (data.startsWith('\x1b[<')) {
            const mouse = parseMouseEvent(data);
            if (mouse) {
                return this.handleMouse(mouse, layout, activePaneGeo);
            }
            return { action: 'none' };
        }

        if (this.menuPopup.active) {
            return this.resolveMenuResult(this.menuPopup.handleInput(data));
        }

        if (this.confirmPopup.active) {
            return this.resolvePopupResult(this.confirmPopup.handleInput(data));
        }

        if (this.copyMovePopup.active) {
            return this.resolveCopyMoveResult(this.copyMovePopup.handleInput(data));
        }

        if (this.mkdirPopup.active) {
            return this.resolvePopupResult(this.mkdirPopup.handleInput(data));
        }

        if (this.drivePopup.active) {
            return this.resolvePopupResult(this.drivePopup.handleInput(data));
        }

        if (this.searchPopup.active) {
            const result = this.searchPopup.handleInput(data, pane.entries);
            switch (result.action) {
                case 'consumed':
                    if (this.searchPopup.lastMatchIndex >= 0) {
                        pane.cursor = this.searchPopup.lastMatchIndex;
                        pane.ensureCursorVisible(pageCapacity);
                    }
                    return { action: 'redraw', data: this.render() };
                case 'close':
                    if (result.confirm) {
                        break;
                    }
                    return { action: 'redraw', data: this.render() };
                case 'passthrough':
                    break;
            }
        }

        if (matchesKeyBinding(data, this.settings.keys.driveLeft)) {
            this.openDrivePopup('left');
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, this.settings.keys.driveRight)) {
            this.openDrivePopup('right');
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b' || data === '\x1b\x1b') {
            return { action: 'none' };
        }

        if (matchesKeyBinding(data, this.settings.keys.detach)) {
            return { action: 'toggleDetach' };
        }

        if (matchesKeyBinding(data, this.settings.keys.quit)) {
            this.confirmPopup.openWith({
                title: 'Quit',
                bodyLines: ['Do you want to quit VSCommander?'],
                buttons: ['Yes', 'No'],
                warning: false,
                onConfirm: (btnIdx) => {
                    if (btnIdx === 0) {
                        return { action: 'quit' };
                    }
                },
            });
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, this.settings.keys.menu)) {
            this.menuPopup.openMenu(
                this.settings, this.activePane,
                this.left.sortMode, this.right.sortMode,
                this.left.colCount, this.right.colCount,
            );
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, this.settings.keys.view)) {
            const entry = pane.entries[pane.cursor];
            if (entry && entry.name !== '..') {
                return { action: 'viewFile', filePath: path.join(pane.cwd, entry.name) };
            }
            return { action: 'none' };
        }

        if (matchesKeyBinding(data, this.settings.keys.edit)) {
            const entry = pane.entries[pane.cursor];
            if (entry && !entry.isDir) {
                return { action: 'openFile', filePath: path.join(pane.cwd, entry.name) };
            }
            return { action: 'none' };
        }

        if (matchesKeyBinding(data, this.settings.keys.copy)) {
            return this.openCopyMovePopup('copy');
        }

        if (matchesKeyBinding(data, this.settings.keys.move)) {
            return this.openCopyMovePopup('move');
        }

        if (matchesKeyBinding(data, this.settings.keys.mkdir)) {
            this.openMkdirPopup('');
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, this.settings.keys.delete)) {
            const platform = os.platform();
            const hasTrash = platform === 'win32' || platform === 'darwin';
            return this.openDeletePopup(pane, hasTrash);
        }

        if (matchesKeyBinding(data, this.settings.keys.forceDelete)) {
            return this.openDeletePopup(pane, false);
        }

        if (matchesKeyBinding(data, this.settings.keys.toggleDotfiles)) {
            this.settings.showDotfiles = !this.settings.showDotfiles;
            this.left.refresh(this.settings);
            this.right.refresh(this.settings);
            return { action: 'settingsChanged' };
        }

        if (matchesKeyBinding(data, this.settings.keys.togglePane)) {
            this.inactivePaneHidden = !this.inactivePaneHidden;
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, this.settings.keys.resizeLeft)) {
            const minWidth = 10;
            if (this.leftWidth > minWidth) {
                this.splitOffset--;
                return { action: 'redraw', data: this.render() };
            }
            return { action: 'none' };
        }

        if (matchesKeyBinding(data, this.settings.keys.resizeRight)) {
            const minWidth = 10;
            if (this.cols - this.leftWidth > minWidth) {
                this.splitOffset++;
                return { action: 'redraw', data: this.render() };
            }
            return { action: 'none' };
        }

        if (matchesKeyBinding(data, 'Ctrl+R')) {
            pane.refresh(this.settings);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Ctrl+U')) {
            return this.handleMenuCommand({ type: 'swapPanels' });
        }

        if (matchesKeyBinding(data, 'Insert')) {
            pane.toggleSelection(pane.cursor);
            if (pane.cursor < pane.entries.length - 1) {
                pane.cursor++;
                if (pane.cursor >= pane.scroll + pageCapacity) {
                    pane.scroll = pane.cursor - pageCapacity + 1;
                }
            }
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Ctrl+F12')) {
            this.menuPopup.openMenu(
                this.settings, this.activePane,
                this.left.sortMode, this.right.sortMode,
                this.left.colCount, this.right.colCount,
            );
            this.menuPopup.selectedMenu = this.activePane === 'left' ? 0 : 4;
            this.menuPopup.dropdownOpen = true;
            this.menuPopup.selectedItem = 4;
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Numpad*')) {
            pane.invertSelection();
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Numpad+')) {
            pane.selectByPattern('*', true);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Numpad-')) {
            pane.selectByPattern('*', false);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Ctrl+1')) {
            pane.colCount = 1;
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Ctrl+2')) {
            pane.colCount = 2;
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Ctrl+3')) {
            pane.colCount = 3;
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[A') {
            if (pane.cursor > 0) {
                pane.cursor--;
                if (pane.cursor < pane.scroll) {
                    pane.scroll = pane.cursor;
                }
            }
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[B') {
            if (pane.cursor < pane.entries.length - 1) {
                pane.cursor++;
                if (pane.cursor >= pane.scroll + pageCapacity) {
                    pane.scroll = pane.cursor - pageCapacity + 1;
                }
            }
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[C') {
            const relPos = pane.cursor - pane.scroll;
            const currentCol = Math.floor(relPos / listHeight);

            if (currentCol >= activePaneGeo.numCols - 1 || activePaneGeo.numCols === 1) {
                const newCursor = Math.min(pane.entries.length - 1, pane.cursor + listHeight);
                if (newCursor !== pane.cursor) {
                    pane.cursor = newCursor;
                    pane.scroll += listHeight;
                    const maxScroll = Math.max(0, pane.entries.length - pageCapacity);
                    if (pane.scroll > maxScroll) {
                        pane.scroll = maxScroll;
                    }
                    if (pane.cursor < pane.scroll) {
                        pane.cursor = pane.scroll;
                    }
                }
            } else {
                const newCursor = pane.cursor + listHeight;
                pane.cursor = newCursor < pane.entries.length ? newCursor : pane.entries.length - 1;
            }
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[D') {
            const relPos = pane.cursor - pane.scroll;
            const currentCol = Math.floor(relPos / listHeight);

            if (currentCol <= 0 || activePaneGeo.numCols === 1) {
                const newCursor = Math.max(0, pane.cursor - listHeight);
                if (newCursor !== pane.cursor) {
                    pane.cursor = newCursor;
                    pane.scroll -= listHeight;
                    if (pane.scroll < 0) {
                        pane.scroll = 0;
                    }
                    if (pane.cursor >= pane.scroll + pageCapacity) {
                        pane.cursor = pane.scroll + pageCapacity - 1;
                    }
                }
            } else {
                const newCursor = pane.cursor - listHeight;
                pane.cursor = newCursor >= 0 ? newCursor : 0;
            }
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[5~') {
            pane.scroll -= pageCapacity;
            pane.cursor -= pageCapacity;
            if (pane.scroll < 0) {
                pane.scroll = 0;
            }
            if (pane.cursor < 0) {
                pane.cursor = 0;
            }
            if (pane.cursor >= pane.scroll + pageCapacity) {
                pane.cursor = pane.scroll + pageCapacity - 1;
            }
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[6~') {
            pane.scroll += pageCapacity;
            pane.cursor += pageCapacity;
            const maxScroll = Math.max(0, pane.entries.length - pageCapacity);
            if (pane.scroll > maxScroll) {
                pane.scroll = maxScroll;
            }
            if (pane.cursor >= pane.entries.length) {
                pane.cursor = pane.entries.length - 1;
            }
            if (pane.cursor < pane.scroll) {
                pane.cursor = pane.scroll;
            }
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[H' || data === '\x1b[1~') {
            pane.cursor = 0;
            pane.scroll = 0;
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[F' || data === '\x1b[4~') {
            pane.cursor = Math.max(0, pane.entries.length - 1);
            if (pane.cursor >= pane.scroll + pageCapacity) {
                pane.scroll = pane.cursor - pageCapacity + 1;
            }
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\t') {
            this.activePane = this.activePane === 'left' ? 'right' : 'left';
            return { action: 'redraw', data: this.render(), chdir: this.activePaneObj.cwd };
        }

        if (data === '\r') {
            if (this.shellInputLen > 0) {
                this.shellInputLen = 0;
                return { action: 'executeCommand', data: '\r' };
            }
            const entry = pane.entries[pane.cursor];
            if (entry && entry.isDir) {
                if (entry.name === '..') {
                    pane.navigateUp(this.settings, pageCapacity);
                } else {
                    pane.navigateInto(entry, this.settings);
                }
                return { action: 'redraw', data: clearScreen() + this.render(), chdir: pane.cwd };
            }
            if (entry && !entry.isDir) {
                return { action: 'openFile', filePath: path.join(pane.cwd, entry.name) };
            }
            return { action: 'none' };
        }

        if (data === '\x7f') {
            if (this.shellInputLen > 0) {
                this.shellInputLen = Math.max(0, this.shellInputLen - 1);
                return { action: 'input', data: '\x7f', redraw: '' };
            }
            return { action: 'none' };
        }

        if (data === '\x03') {
            if (this.shellInputLen > 0) {
                this.shellInputLen = 0;
                return { action: 'input', data: '\x03', redraw: '' };
            }
            return { action: 'none' };
        }

        if (data === '\x15') {
            if (this.shellInputLen > 0) {
                this.shellInputLen = 0;
                return { action: 'input', data: '\x15', redraw: '' };
            }
            return { action: 'none' };
        }

        if (data.length === 2 && data.charCodeAt(0) === 0x1b && data.charCodeAt(1) >= 0x20) {
            const ch = data[1];
            const matchIdx = SearchPopup.findPrefixMatch(pane.entries, ch);
            if (matchIdx >= 0) {
                this.searchPopup.openWithChar(ch);
                pane.cursor = matchIdx;
                pane.ensureCursorVisible(pageCapacity);
            } else {
                this.searchPopup.open();
            }
            return { action: 'redraw', data: this.render() };
        }

        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            this.shellInputLen++;
            return { action: 'input', data, redraw: '' };
        }

        return { action: 'none' };
    }

    private handleMouse(mouse: MouseEvent, layout: Layout, activePaneGeo: PaneGeometry): PanelInputResult {
        const popup = this.activePopupObj;

        const resolvePopup = (result: PopupInputResult): PanelInputResult => {
            if (popup === this.menuPopup) return this.resolveMenuResult(result);
            if (popup === this.copyMovePopup) return this.resolveCopyMoveResult(result);
            return this.resolvePopupResult(result);
        };

        if (mouse.isRelease) {
            if (popup && mouse.button === 0) {
                return resolvePopup(popup.handleMouseUp(mouse.row, mouse.col));
            }
            return { action: 'none' };
        }

        if (popup) {
            if (mouse.isMotion) {
                if (popup.handleMouseMotion(mouse.row, mouse.col)) {
                    return { action: 'redraw', data: this.render() };
                }
                return { action: 'none' };
            }
            if (mouse.button === 64 || mouse.button === 65) {
                popup.handleMouseScroll(mouse.button === 64);
                return { action: 'redraw', data: this.render() };
            }
            if (mouse.button !== 0) return { action: 'none' };
            return resolvePopup(popup.handleMouseDown(mouse.row, mouse.col));
        }

        const pane = this.activePaneObj;
        const listHeight = layout.listHeight;
        const pageCapacity = listHeight * activePaneGeo.numCols;

        if (mouse.isMotion && mouse.button === 0) {
            if (mouse.row >= layout.listStart && mouse.row < layout.listStart + listHeight) {
                return this.handleMouseFileArea(mouse.row, mouse.col, layout, true);
            }
            return { action: 'none' };
        }

        if (mouse.isMotion) return { action: 'none' };

        if (mouse.button === 64 || mouse.button === 65) {
            this.handleScrollWheel(mouse.button, pane, listHeight, pageCapacity);
            return { action: 'redraw', data: this.render() };
        }

        if (mouse.button === 1) {
            return this.handleInput('\r');
        }

        if (mouse.button !== 0) return { action: 'none' };

        if (mouse.row === layout.fkeyRow) {
            return this.handleMouseFKeyBar(mouse.col);
        }

        if (mouse.row >= layout.listStart && mouse.row < layout.listStart + listHeight) {
            return this.handleMouseFileArea(mouse.row, mouse.col, layout, false);
        }

        return { action: 'none' };
    }

    private resolvePopupResult(result: PopupInputResult): PanelInputResult {
        if (result.action === 'close' && result.confirm && result.command) {
            const cmd = result.command as PanelInputResult;
            if (cmd.action === 'redraw') {
                return { ...cmd, data: this.render() };
            }
            return cmd;
        }
        return { action: 'redraw', data: this.render() };
    }

    private resolveMenuResult(result: PopupInputResult): PanelInputResult {
        if (result.action === 'close' && result.confirm && result.command) {
            return this.handleMenuCommand(result.command as MenuCommand);
        }
        return { action: 'redraw', data: this.render() };
    }

    private handleMenuCommand(cmd: MenuCommand): PanelInputResult {
        switch (cmd.type) {
            case 'columns': {
                const targetPane = cmd.pane === 'left' ? this.left : this.right;
                targetPane.colCount = cmd.columns;
                return { action: 'redraw', data: this.render() };
            }
            case 'sort': {
                const pane = cmd.pane === 'left' ? this.left : this.right;
                pane.sortMode = cmd.mode;
                pane.refresh(this.settings);
                return { action: 'redraw', data: this.render() };
            }
            case 'reread': {
                const pane = cmd.pane === 'left' ? this.left : this.right;
                pane.refresh(this.settings);
                return { action: 'redraw', data: this.render() };
            }
            case 'changeDrive': {
                this.openDrivePopup(cmd.pane);
                return { action: 'redraw', data: this.render() };
            }
            case 'toggleDotfiles': {
                this.settings.showDotfiles = !this.settings.showDotfiles;
                this.left.refresh(this.settings);
                this.right.refresh(this.settings);
                return { action: 'settingsChanged' };
            }
            case 'view': {
                const pane = this.activePaneObj;
                const entry = pane.entries[pane.cursor];
                if (entry && entry.name !== '..') {
                    return { action: 'viewFile', filePath: path.join(pane.cwd, entry.name) };
                }
                return { action: 'redraw', data: this.render() };
            }
            case 'edit': {
                const pane = this.activePaneObj;
                const entry = pane.entries[pane.cursor];
                if (entry && !entry.isDir) {
                    return { action: 'openFile', filePath: path.join(pane.cwd, entry.name) };
                }
                return { action: 'redraw', data: this.render() };
            }
            case 'copy': {
                return this.openCopyMovePopup('copy');
            }
            case 'move': {
                return this.openCopyMovePopup('move');
            }
            case 'mkdir': {
                this.openMkdirPopup('');
                return { action: 'redraw', data: this.render() };
            }
            case 'delete': {
                const pane = this.activePaneObj;
                const platform = os.platform();
                const hasTrash = platform === 'win32' || platform === 'darwin';
                return this.openDeletePopup(pane, hasTrash);
            }
            case 'swapPanels': {
                const tmpCwd = this.left.cwd;
                this.left.cwd = this.right.cwd;
                this.right.cwd = tmpCwd;
                const tmpSort = this.left.sortMode;
                this.left.sortMode = this.right.sortMode;
                this.right.sortMode = tmpSort;
                const tmpCols = this.left.colCount;
                this.left.colCount = this.right.colCount;
                this.right.colCount = tmpCols;
                this.left.refresh(this.settings);
                this.right.refresh(this.settings);
                return { action: 'redraw', data: this.render() };
            }
            case 'panelsOnOff': {
                return { action: 'close' };
            }
            case 'openSettings': {
                return { action: 'openSettings' };
            }
            default:
                return { action: 'redraw', data: this.render() };
        }
    }

    private openDrivePopup(target: 'left' | 'right'): void {
        this.drivePopup.open(target, this.settings);
        this.drivePopup.setConfirmAction(() => {
            const selected = this.drivePopup.selectedEntry;
            if (!selected) return undefined;
            const pane = this.drivePopup.targetPane === 'left' ? this.left : this.right;
            if (selected.path) {
                pane.cwd = selected.path;
                pane.entries = Pane.readDir(selected.path, this.settings);
            } else {
                pane.cwd = selected.label;
                pane.entries = [];
            }
            pane.cursor = 0;
            pane.scroll = 0;
            let chdir: string | undefined;
            if (this.drivePopup.targetPane === this.activePane && selected.path) {
                chdir = selected.path;
            }
            return { action: 'redraw', chdir };
        });
    }

    private openMkdirPopup(initial: string): void {
        this.mkdirPopup.openWith(initial, this.cols);
        this.mkdirPopup.setConfirmAction(() => {
            const r = this.mkdirPopup.result;
            return {
                action: 'mkdir',
                cwd: this.activePaneObj.cwd,
                folderName: r.folderName,
                linkType: r.linkType,
                linkTarget: r.linkTarget,
                multipleNames: r.multipleNames,
            };
        });
    }

    private openCopyMovePopup(mode: CopyMoveMode): PanelInputResult {
        const pane = this.activePaneObj;
        const entry = pane.entries[pane.cursor];
        if (!entry || (entry.name === '..' && pane.selected.size === 0)) {
            return { action: 'none' };
        }

        const sourceFiles: string[] = [];
        if (pane.selected.size > 0) {
            for (const e of pane.entries) {
                if (pane.selected.has(e.name)) sourceFiles.push(e.name);
            }
        } else {
            sourceFiles.push(entry.name);
        }

        const otherPane = this.activePane === 'left' ? this.right : this.left;
        const targetDir = otherPane.cwd;

        this.copyMovePopup.openWith(mode, targetDir, sourceFiles, pane.cwd, this.cols);
        this.copyMovePopup.setConfirmAction(() => {
            const r = this.copyMovePopup.result;
            return { action: 'copyMove', result: r };
        });
        return { action: 'redraw', data: this.render() };
    }

    private resolveCopyMoveResult(result: PopupInputResult): PanelInputResult {
        if (result.action === 'close' && result.confirm && result.command) {
            const cmd = result.command as PanelInputResult;
            return cmd;
        }
        return { action: 'redraw', data: this.render() };
    }

    private handleScrollWheel(button: number, pane: Pane, listHeight: number, pageCapacity: number): void {
        const step = 3;
        if (button === 64) {
            pane.cursor = Math.max(0, pane.cursor - step);
            if (pane.cursor < pane.scroll) {
                pane.scroll = pane.cursor;
            }
        } else {
            pane.cursor = Math.min(pane.entries.length - 1, pane.cursor + step);
            if (pane.cursor >= pane.scroll + pageCapacity) {
                pane.scroll = pane.cursor - pageCapacity + 1;
            }
        }
    }

    private handleMouseFileArea(row: number, col: number, layout: Layout, isDrag: boolean): PanelInputResult {
        const leftGeo = layout.leftPane;
        const rightGeo = layout.rightPane;
        let targetPane: 'left' | 'right';
        let geo: PaneGeometry;

        if (col >= leftGeo.startCol && col < leftGeo.startCol + leftGeo.width) {
            targetPane = 'left';
            geo = leftGeo;
        } else if (col >= rightGeo.startCol && col < rightGeo.startCol + rightGeo.width) {
            targetPane = 'right';
            geo = rightGeo;
        } else {
            return { action: 'none' };
        }

        let chdir: string | undefined;
        if (targetPane !== this.activePane) {
            this.activePane = targetPane;
            chdir = this.activePaneObj.cwd;
        }

        const pane = targetPane === 'left' ? this.left : this.right;
        const listHeight = layout.listHeight;
        const fileRow = row - layout.listStart;

        let fileCol = -1;
        for (let c = 0; c < geo.numCols; c++) {
            const start = geo.colStarts[c];
            const end = start + geo.colWidths[c];
            if (col >= start && col < end) {
                fileCol = c;
                break;
            }
        }
        if (fileCol < 0) {
            for (let c = 0; c < geo.dividerCols.length; c++) {
                if (col === geo.dividerCols[c]) {
                    fileCol = c;
                    break;
                }
            }
        }
        if (fileCol < 0) return { action: 'redraw', data: this.render(), chdir };

        const idx = pane.scroll + fileCol * listHeight + fileRow;
        if (idx >= 0 && idx < pane.entries.length) {
            if (!isDrag) {
                const now = Date.now();
                if (idx === this.lastClickEntry && targetPane === this.lastClickPane
                    && now - this.lastClickTime < 400) {
                    this.lastClickTime = 0;
                    this.lastClickEntry = -1;
                    pane.cursor = idx;
                    return this.handleInput('\r');
                }
                this.lastClickTime = now;
                this.lastClickEntry = idx;
                this.lastClickPane = targetPane;
            }
            pane.cursor = idx;
        }

        return { action: 'redraw', data: this.render(), chdir };
    }

    private handleMouseFKeyBar(col: number): PanelInputResult {
        const slotWidth = Math.floor(this.cols / 10);
        const slot = Math.min(9, Math.floor((col - 1) / slotWidth));
        const fkeyNum = slot + 1;
        const fkeySeqs: Record<number, string> = {
            1: '\x1bOP', 2: '\x1bOQ', 3: '\x1bOR', 4: '\x1bOS',
            5: '\x1b[15~', 6: '\x1b[17~', 7: '\x1b[18~', 8: '\x1b[19~',
            9: '\x1b[20~', 10: '\x1b[21~',
        };
        const seq = fkeySeqs[fkeyNum];
        if (seq) {
            return this.handleInput(seq);
        }
        return { action: 'none' };
    }

    private render(): string {
        const layout = this.getLayout();
        const t = this.settings.theme;
        const out: string[] = [];
        const leftIsActive = this.activePane === 'left';
        const leftHidden = this.inactivePaneHidden && leftIsActive === false;
        const rightHidden = this.inactivePaneHidden && leftIsActive === true;

        out.push(resetStyle() + bgRgb(t.border.idle.bg));
        out.push(clearScreen());

        if (leftHidden) {
            out.push(this.renderTerminalAreaAt(layout, layout.leftPane));
        } else {
            out.push(this.left.render({
                geo: layout.leftPane, layout, theme: t,
                isActive: leftIsActive, showClock: false,
                selected: this.left.selected,
            }));
        }

        if (rightHidden) {
            out.push(this.renderTerminalAreaAt(layout, layout.rightPane));
        } else {
            out.push(this.right.render({
                geo: layout.rightPane, layout, theme: t,
                isActive: !leftIsActive, showClock: this.settings.clockEnabled,
                selected: this.right.selected,
            }));
        }

        out.push(this.renderCommandLine(layout));
        out.push(this.renderFKeyBar(layout));

        const cellAt = (r: number, c: number) => this.getCellAt(r, c, layout);

        if (this.menuPopup.active) {
            out.push(this.menuPopup.render(layout.topRow, 1, t, this.cols));
        } else if (this.searchPopup.active) {
            const activePaneGeo = this.activePane === 'left' ? layout.leftPane : layout.rightPane;
            out.push(this.searchPopup.render(layout.bottomRow, activePaneGeo.startCol, t));
            out.push(this.searchPopup.renderShadow(cellAt));
        } else if (this.copyMovePopup.active) {
            out.push(this.copyMovePopup.render(this.rows, this.cols, t));
            out.push(this.copyMovePopup.renderShadow(cellAt));
        } else if (this.mkdirPopup.active) {
            out.push(this.mkdirPopup.render(this.rows, this.cols, t));
            out.push(this.mkdirPopup.renderShadow(cellAt));
        } else if (this.confirmPopup.active) {
            out.push(this.confirmPopup.render(this.rows, this.cols, t));
            out.push(this.confirmPopup.renderShadow(cellAt));
        } else if (this.drivePopup.active) {
            const targetGeo = this.drivePopup.targetPane === 'left' ? layout.leftPane : layout.rightPane;
            out.push(this.drivePopup.render(layout.listStart, targetGeo.startCol, t, targetGeo.width));
            out.push(this.drivePopup.renderShadow(cellAt));
        } else if (this.waitingMode) {
            out.push(hideCursor());
        } else {
            out.push(this.renderCmdCursor(layout));
        }

        return out.join('');
    }

    redraw(): string {
        if (!this.visible) return '';
        return this.render();
    }

    private openDeletePopup(pane: Pane, toTrash: boolean): PanelInputResult {
        const entry = pane.entries[pane.cursor];
        if (!entry || entry.name === '..') return { action: 'none' };

        const fullPath = path.join(pane.cwd, entry.name);
        const kind = entry.isDir ? 'folder' : 'file';

        if (toTrash) {
            const trashName = os.platform() === 'win32' ? 'Recycle Bin' : 'Trash';
            this.confirmPopup.openWith({
                title: 'Delete',
                bodyLines: [
                    'Do you wish to *move* the ' + kind + ' to the *' + trashName + '*?',
                    entry.name,
                ],
                buttons: ['Move', 'Cancel'],
                onConfirm: (btnIdx) => {
                    if (btnIdx === 0) {
                        return { action: 'deleteFile', filePath: fullPath, toTrash: true };
                    }
                },
            });
        } else {
            this.confirmPopup.openWith({
                title: 'Delete',
                bodyLines: [
                    'Do you wish to delete the ' + kind + '?',
                    entry.name,
                ],
                buttons: ['Delete', 'Cancel'],
                onConfirm: (btnIdx) => {
                    if (btnIdx === 0) {
                        return { action: 'deleteFile', filePath: fullPath, toTrash: false };
                    }
                },
            });
        }
        return { action: 'redraw', data: this.render() };
    }

    private getCellAt(row: number, col: number, layout: Layout): { ch: string; style: TextStyle } {
        const t = this.settings.theme;
        const border: TextStyle = t.border.idle;

        if (row === layout.fkeyRow) {
            return { ch: ' ', style: t.fkeyLabel.idle };
        }
        if (row === layout.cmdRow) {
            return { ch: ' ', style: t.commandLine.idle };
        }

        const leftIsActive = this.activePane === 'left';
        let pane: Pane;
        let geo: PaneGeometry;
        let isActive: boolean;
        if (col <= layout.leftPane.startCol + layout.leftPane.width - 1) {
            pane = this.left;
            geo = layout.leftPane;
            isActive = leftIsActive;
        } else {
            pane = this.right;
            geo = layout.rightPane;
            isActive = !leftIsActive;
        }

        const leftEdge = geo.startCol;
        const rightEdge = geo.startCol + geo.width - 1;

        if (row === layout.topRow) {
            if (col === leftEdge) return { ch: DBOX.topLeft, style: border };
            if (col === rightEdge) return { ch: DBOX.topRight, style: border };
            return { ch: DBOX.horizontal, style: border };
        }

        if (row === layout.bottomRow) {
            if (col === leftEdge) return { ch: DBOX.bottomLeft, style: border };
            if (col === rightEdge) return { ch: DBOX.bottomRight, style: border };
            return { ch: DBOX.horizontal, style: border };
        }

        if (row === layout.separatorRow) {
            if (col === leftEdge) return { ch: MBOX.vertDoubleRight, style: border };
            if (col === rightEdge) return { ch: MBOX.vertDoubleLeft, style: border };
            for (const dc of geo.dividerCols) {
                if (col === dc) return { ch: BOX.teeUp, style: border };
            }
            return { ch: BOX.horizontal, style: border };
        }

        if (col === leftEdge || col === rightEdge) {
            return { ch: DBOX.vertical, style: border };
        }

        if (row === layout.headerRow) {
            for (const dc of geo.dividerCols) {
                if (col === dc) return { ch: BOX.vertical, style: border };
            }
            return { ch: ' ', style: t.header.idle };
        }

        if (row === layout.infoRow) {
            return { ch: ' ', style: t.info.idle };
        }

        if (row >= layout.listStart && row < layout.separatorRow) {
            for (const dc of geo.dividerCols) {
                if (col === dc) return { ch: BOX.vertical, style: border };
            }
            let fileCol = -1;
            for (let i = 0; i < geo.numCols; i++) {
                if (col >= geo.colStarts[i] && col < geo.colStarts[i] + geo.colWidths[i]) {
                    fileCol = i;
                    break;
                }
            }
            if (fileCol >= 0) {
                const fileRow = row - layout.listStart;
                const idx = pane.scroll + fileCol * layout.listHeight + fileRow;
                if (idx < pane.entries.length) {
                    const entry = pane.entries[idx];
                    const isCursor = isActive && idx === pane.cursor;
                    const rs = entryRenderStyle(entry, t);
                    const style = isCursor ? rs.selected : rs.idle;
                    const charPos = col - geo.colStarts[fileCol];
                    const ch = charPos < entry.name.length ? entry.name[charPos] : ' ';
                    return { ch, style };
                }
                return { ch: ' ', style: border };
            }
        }

        return { ch: ' ', style: border };
    }

    private renderCmdCursor(layout: Layout): string {
        const t = this.settings.theme;
        const cursorCol = this.termBuffer.getCursorCol() + 1;
        let out = moveTo(layout.cmdRow, cursorCol);
        if (this.cmdCursorVisible) {
            out += applyStyle(t.commandLine.idle) + '\u2582' + resetStyle();
        } else {
            const termRow = this.termBuffer.getCursorRow();
            const content = this.termBuffer.getRow(termRow);
            const charAtCursor = content[this.termBuffer.getCursorCol()] || ' ';
            out += applyStyle(t.commandLine.idle) + charAtCursor + resetStyle();
        }
        out += hideCursor();
        return out;
    }

    private renderCommandLine(layout: Layout): string {
        const { cols } = this;
        const { cmdRow } = layout;
        const t = this.settings.theme;
        const out: string[] = [];

        if (this.waitingMode) {
            const spinnerFrames = [
                '\u28ff\u28f7', '\u28ff\u28ef', '\u28ff\u28df', '\u28ff\u287f', '\u28ff\u28bf', '\u287f\u28ff',
                '\u28bf\u28ff', '\u28fb\u28ff', '\u28fd\u28ff', '\u28fe\u28ff', '\u28f7\u28ff', '\u28ff\u28fe',
            ];
            const spinner = spinnerFrames[this.spinnerFrame % spinnerFrames.length];
            const display = (' ' + spinner + ' Running... ' + this.settings.toggleKey + ' for details').slice(0, cols);
            out.push(applyStyle(t.commandLine.idle));
            out.push(moveTo(cmdRow, 1));
            out.push(display);
            if (display.length < cols) {
                out.push(' '.repeat(cols - display.length));
            }
            out.push(resetStyle());
            return out.join('');
        }

        const termRow = this.termBuffer.getCursorRow();
        const content = this.termBuffer.getRow(termRow);
        const display = content.slice(0, cols);

        out.push(applyStyle(t.commandLine.idle));
        out.push(moveTo(cmdRow, 1));
        out.push(display);
        if (display.length < cols) {
            out.push(' '.repeat(cols - display.length));
        }
        out.push(resetStyle());

        return out.join('');
    }

    private renderTerminalArea(layout: Layout): string {
        const leftIsActive = this.activePane === 'left';
        const geo = leftIsActive ? layout.rightPane : layout.leftPane;
        return this.renderTerminalAreaAt(layout, geo);
    }

    private renderTerminalAreaAt(layout: Layout, geo: PaneGeometry): string {
        const out: string[] = [];
        const t = this.settings.theme;
        const border = applyStyle(t.border.idle);
        const termStyle = applyStyle(t.commandLine.idle);

        const top = layout.topRow;
        const bottom = layout.bottomRow;
        const innerHeight = bottom - top - 1;
        const innerWidth = geo.width - 2;

        const title = ' Terminal ';
        const fillLen = Math.max(0, geo.width - 2 - title.length);
        const fillL = Math.floor(fillLen / 2);
        const fillR = fillLen - fillL;
        out.push(border + moveTo(top, geo.startCol));
        out.push(DBOX.topLeft + DBOX.horizontal.repeat(fillL));
        out.push(applyStyle(t.activePath.idle) + title);
        out.push(border + DBOX.horizontal.repeat(fillR) + DBOX.topRight);

        const cursorRow = this.termBuffer.getCursorRow();
        const startRow = Math.max(0, cursorRow - innerHeight + 1);

        for (let i = 0; i < innerHeight; i++) {
            const termRow = startRow + i;
            const screenRow = top + 1 + i;
            const rowContent = this.termBuffer.getRow(termRow);
            const truncated = rowContent.slice(0, innerWidth);
            const pad = Math.max(0, innerWidth - truncated.length);

            out.push(border + moveTo(screenRow, geo.startCol) + DBOX.vertical);
            out.push(termStyle + truncated);
            if (pad > 0) out.push(' '.repeat(pad));
            out.push(border + DBOX.vertical);
        }

        out.push(border + moveTo(bottom, geo.startCol));
        out.push(DBOX.bottomLeft + DBOX.horizontal.repeat(geo.width - 2) + DBOX.bottomRight);
        out.push(resetStyle());

        return out.join('');
    }

    private renderFKeyBar(layout: Layout): string {
        const { cols } = this;
        const { fkeyRow } = layout;
        const t = this.settings.theme;
        const out: string[] = [];

        const actionSlots: { action: keyof KeyBindings; label: string }[] = [
            { action: 'view', label: 'View' },
            { action: 'edit', label: 'Edit' },
            { action: 'copy', label: 'Copy' },
            { action: 'move', label: 'Move' },
            { action: 'mkdir', label: 'Mkdir' },
            { action: 'delete', label: 'Del' },
            { action: 'menu', label: 'Conf' },
            { action: 'quit', label: 'Quit' },
        ];
        const defaultLabels: Record<number, string> = {
            1: 'Help', 2: 'Menu', 9: 'Conf',
        };
        const keys: { num: string; label: string }[] = [];
        for (let i = 1; i <= 10; i++) {
            let label = '';
            for (const al of actionSlots) {
                if (getFKeyNumber(this.settings.keys[al.action]) === i) {
                    label = al.label;
                    break;
                }
            }
            if (!label) {
                label = defaultLabels[i] || '';
            }
            keys.push({ num: String(i), label });
        }

        out.push(moveTo(fkeyRow, 1) + resetStyle());

        const totalKeys = keys.length;
        const slotWidth = Math.floor(cols / totalKeys);
        let col = 1;

        for (let i = 0; i < totalKeys; i++) {
            const k = keys[i];
            const isLast = i === totalKeys - 1;
            const w = isLast ? cols - col + 1 : slotWidth;

            out.push(moveTo(fkeyRow, col));
            out.push(applyStyle(t.fkeyNum.idle) + ' ' + k.num);
            const remaining = Math.max(0, w - 1 - k.num.length);
            const label = k.label.slice(0, remaining);
            const pad = ' '.repeat(Math.max(0, remaining - label.length));
            out.push(applyStyle(t.fkeyLabel.idle) + label + pad);

            col += w;
        }

        return out.join('');
    }
}
