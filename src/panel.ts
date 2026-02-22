import * as os from 'os';
import * as path from 'path';
import {
    enterAltScreen, leaveAltScreen, clearScreen, showCursor, hideCursor,
    resetStyle, bgColor, enableMouse, disableMouse
} from './draw';
import { MouseEvent, parseMouseEvent } from './mouse';
import { PanelSettings, TextStyle, matchesKeyBinding, resolveTheme } from './settings';
import { Layout, PaneGeometry, SortMode } from './types';
import { computeLayout, describeFileError } from './helpers';
import { Pane } from './pane';
import { Popup, PopupInputResult } from './popup';
import { SearchPopup } from './searchPopup';
import { DrivePopup } from './drivePopup';
import { ConfirmPopup } from './confirmPopup';
import { MkdirPopup } from './mkdirPopup';
import { MenuPopup, MenuCommand } from './menuPopup';
import { CopyMovePopup, CopyMoveMode, CopyMoveResult } from './copyMovePopup';
import { CopyProgressPopup, ScanProgressPopup, DeleteProgressPopup } from './copyProgressPopup';
import { OverwritePopup } from './overwritePopup';
import { ColorEditorPopup } from './colorEditorPopup';
import { ThemePopup } from './themePopup';
import { SortPopup, SortPopupResult } from './sortPopup';
import { HelpPopup } from './helpPopup';
import { ColorOverride, ThemeName, applyColorOverrides, themeToOverrides, DEFAULT_SETTINGS, DEFAULT_KEY_BINDINGS } from './settings';
import { TerminalBuffer } from './terminalBuffer';
import { getCellAt } from './cellQuery';
import { TerminalArea } from './terminalArea';
import { FKeyBar } from './fkeyBar';
import { CommandLine } from './commandLine';
import { isArchiveFile } from './archiveFs';

export type PanelInputResult =
    | { action: 'quit'; data?: string }
    | { action: 'close'; data?: string }
    | { action: 'redraw'; data: string; chdir?: string }
    | { action: 'input'; data: string; redraw: string }
    | { action: 'executeCommand'; data: string }
    | { action: 'settingsChanged'; data?: string }
    | { action: 'openSettings'; data?: string }
    | { action: 'toggleDetach'; data?: string }
    | { action: 'openFile'; filePath: string; data?: string }
    | { action: 'viewFile'; filePath: string; data?: string }
    | { action: 'deleteFile'; filePath: string; toTrash: boolean; data?: string }
    | { action: 'mkdir'; cwd: string; dirName: string; linkType: 'none' | 'symbolic' | 'junction'; linkTarget: string; multipleNames: boolean; data?: string }
    | { action: 'copyMove'; result: CopyMoveResult; data?: string }
    | { action: 'quickView'; data: string; filePath: string; targetType: 'file' | 'dir'; side: 'left' | 'right' }
    | { action: 'quickViewClose'; data: string; chdir?: string }
    | { action: 'changeTheme'; themeName: ThemeName; data?: string }
    | { action: 'saveSettings'; scope: 'user' | 'workspace'; data?: string }
    | { action: 'deleteSettings'; scope: 'user' | 'workspace'; data?: string }
    | { action: 'enterArchive'; filePath: string; data?: string }
    | { action: 'openArchiveFile'; archivePath: string; entryPath: string; data?: string }
    | { action: 'viewArchiveFile'; archivePath: string; entryPath: string; data?: string }
    | { action: 'extractFromArchive'; targetPath: string; entryPaths: string[]; archiveDir: string; data?: string }
    | { action: 'addToArchive'; sourcePaths: string[]; archiveDir: string; data?: string }
    | { action: 'deleteFromArchive'; entryPaths: string[]; data?: string }
    | { action: 'mkdirInArchive'; dirPath: string; data?: string }
    | { action: 'moveFromArchive'; targetPath: string; entryPaths: string[]; archiveDir: string; data?: string }
    | { action: 'moveToArchive'; sourcePaths: string[]; archiveDir: string; data?: string }
    | { action: 'interceptF1Changed'; data: string; interceptF1: boolean }
    | { action: 'openPrivacySettings'; data?: string }
    | { action: 'none'; data?: string };

export class Panel {
    visible = false;
    cols: number;
    rows: number;
    left: Pane;
    right: Pane;
    activePane: 'left' | 'right' = 'left';
    settings: PanelSettings;
    searchPopup: SearchPopup;
    drivePopup: DrivePopup;
    confirmPopup: ConfirmPopup;
    mkdirPopup: MkdirPopup;
    menuPopup: MenuPopup;
    copyMovePopup: CopyMovePopup;
    copyProgressPopup: CopyProgressPopup;
    scanProgressPopup: ScanProgressPopup;
    deleteProgressPopup: DeleteProgressPopup;
    overwritePopup: OverwritePopup;
    colorEditorPopup: ColorEditorPopup;
    themePopup: ThemePopup;
    sortPopup: SortPopup;
    helpPopup: HelpPopup;
    docsDir = '';
    termBuffer: TerminalBuffer;
    private terminalArea = new TerminalArea();
    private fkeyBar = new FKeyBar();
    commandLine = new CommandLine();
    inactivePaneHidden = false;
    quickViewMode = false;
    splitOffset = 0;

    get shellInputLen(): number { return this.commandLine.shellInputLen; }
    set shellInputLen(v: number) { this.commandLine.shellInputLen = v; }
    get cmdCursorVisible(): boolean { return this.commandLine.cmdCursorVisible; }
    set cmdCursorVisible(v: boolean) { this.commandLine.cmdCursorVisible = v; }
    get waitingMode(): boolean { return this.commandLine.waitingMode; }
    set waitingMode(v: boolean) { this.commandLine.waitingMode = v; }
    get spinnerFrame(): number { return this.commandLine.spinnerFrame; }
    set spinnerFrame(v: number) { this.commandLine.spinnerFrame = v; }
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
        this.copyProgressPopup = new CopyProgressPopup();
        this.scanProgressPopup = new ScanProgressPopup();
        this.deleteProgressPopup = new DeleteProgressPopup();
        this.overwritePopup = new OverwritePopup();
        this.colorEditorPopup = new ColorEditorPopup();
        this.themePopup = new ThemePopup();
        this.sortPopup = new SortPopup();
        this.helpPopup = new HelpPopup();
        this.termBuffer = new TerminalBuffer(cols, rows);
        this.syncPopupBounds();
    }

    show(): string {
        this.visible = true;
        this.left.refresh(this.settings);
        this.right.refresh(this.settings);
        this.showReadErrorPopup(this.activePaneObj);
        return enterAltScreen() + enableMouse() + this.render();
    }

    hide(): string {
        this.visible = false;
        this.waitingMode = false;
        this.quickViewMode = false;
        return disableMouse() + showCursor() + leaveAltScreen();
    }

    renderSpinnerUpdate(): string {
        const layout = this.getLayout();
        return this.commandLine.renderSpinnerUpdate(this.cmdContext(layout));
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
        for (const p of [this.searchPopup, this.drivePopup, this.confirmPopup, this.mkdirPopup, this.menuPopup, this.copyMovePopup, this.copyProgressPopup, this.scanProgressPopup, this.deleteProgressPopup, this.overwritePopup, this.colorEditorPopup, this.themePopup, this.sortPopup, this.helpPopup]) {
            p.termRows = this.rows;
            p.termCols = this.cols;
        }
    }

    private cmdContext(layout: Layout) {
        return {
            cols: this.cols, layout, settings: this.settings,
            termBuffer: this.termBuffer, hasActivePopup: this.hasActivePopup,
            visible: this.visible, inactivePaneHidden: this.inactivePaneHidden,
            activePane: this.activePane,
        };
    }

    private get leftWidth(): number {
        const base = Math.floor(this.cols / 2);
        const minWidth = 10;
        return Math.max(minWidth, Math.min(this.cols - minWidth, base + this.splitOffset));
    }

    private getLayout(): Layout {
        if (this.quickViewMode) {
            const pane = this.activePaneObj;
            return computeLayout(this.rows, this.cols, this.settings.panelColumns, this.cols, pane.colCount, pane.colCount);
        }
        return computeLayout(this.rows, this.cols, this.settings.panelColumns, this.leftWidth, this.left.colCount, this.right.colCount);
    }

    get hasActivePopup(): boolean {
        return this.searchPopup.active || this.drivePopup.active
            || this.confirmPopup.active || this.mkdirPopup.active
            || this.menuPopup.active || this.copyMovePopup.active
            || this.copyProgressPopup.active || this.scanProgressPopup.active
            || this.deleteProgressPopup.active || this.overwritePopup.active
            || this.colorEditorPopup.active || this.themePopup.active
            || this.sortPopup.active || this.helpPopup.active;
    }

    private get activePopupObj(): Popup | null {
        if (this.overwritePopup.active) return this.overwritePopup;
        if (this.confirmPopup.active) return this.confirmPopup;
        if (this.copyProgressPopup.active) return this.copyProgressPopup;
        if (this.scanProgressPopup.active) return this.scanProgressPopup;
        if (this.deleteProgressPopup.active) return this.deleteProgressPopup;
        if (this.helpPopup.active) return this.helpPopup;
        if (this.themePopup.active) return this.themePopup;
        if (this.colorEditorPopup.active) return this.colorEditorPopup;
        if (this.sortPopup.active) return this.sortPopup;
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

    getActivePaneRatio(): number {
        const lw = this.leftWidth;
        const activeCols = this.activePane === 'left' ? lw : this.cols - lw;
        return (activeCols + 1) / this.cols;
    }

    getQuickViewTarget(): { type: 'file' | 'dir'; path: string } {
        const pane = this.activePaneObj;
        const entry = pane.entries[pane.cursor];
        if (!entry || entry.name === '..') return { type: 'dir', path: pane.cwd };
        const fullPath = path.join(pane.cwd, entry.name);
        return { type: entry.isDir ? 'dir' : 'file', path: fullPath };
    }

    get isSearchActive(): boolean {
        return this.searchPopup.active;
    }

    resetSearchBlink(): void {
        this.searchPopup.cursorVisible = true;
    }

    resetCmdBlink(): void {
        this.commandLine.resetBlink();
    }

    renderCmdCursorBlink(): string {
        const layout = this.getLayout();
        return this.commandLine.renderCursorBlink(this.cmdContext(layout));
    }

    renderClockUpdate(): string {
        if (!this.visible || !this.settings.clockEnabled || this.hasActivePopup || this.quickViewMode) return '';
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

    get isColorEditorBlinkActive(): boolean {
        return this.colorEditorPopup.active && this.colorEditorPopup.hasBlink;
    }

    resetColorEditorBlink(): void {
        this.colorEditorPopup.resetColorEditorBlink();
    }

    renderColorEditorCursorBlink(): string {
        if (!this.visible || !this.colorEditorPopup.active) return '';
        return this.colorEditorPopup.renderColorEditorBlink(this.rows, this.cols, this.settings.theme);
    }

    get isOverwriteBlinkActive(): boolean {
        return this.overwritePopup.active && this.overwritePopup.isRenameBlink;
    }

    resetOverwriteBlink(): void {
        this.overwritePopup.resetOverwriteBlink();
    }

    renderOverwriteCursorBlink(): string {
        if (!this.visible || !this.overwritePopup.active) return '';
        return this.overwritePopup.renderOverwriteBlink(this.rows, this.cols, this.settings.theme);
    }

    renderSearchCursorBlink(): string {
        if (!this.visible || !this.searchPopup.active) return '';
        const layout = this.getLayout();
        const activePaneGeo = this.quickViewMode
            ? layout.leftPane
            : (this.activePane === 'left' ? layout.leftPane : layout.rightPane);
        return this.searchPopup.renderBlink(layout.bottomRow, activePaneGeo.startCol, this.settings.theme);
    }

    renderShellUpdate(): string {
        const layout = this.getLayout();
        return this.commandLine.renderShellUpdate(
            this.cmdContext(layout),
            () => this.renderTerminalArea(layout),
        );
    }

    handleInput(data: string): PanelInputResult {
        if (!this.visible) return { action: 'none' };

        const pane = this.activePaneObj;
        const layout = this.getLayout();
        const listHeight = layout.listHeight;
        const activePaneGeo = this.quickViewMode
            ? layout.leftPane
            : (this.activePane === 'left' ? layout.leftPane : layout.rightPane);
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

        if (this.overwritePopup.active) {
            return this.resolvePopupResult(this.overwritePopup.handleInput(data));
        }

        if (this.overwritePopup.active) {
            this.overwritePopup.handleInput(data);
            return { action: 'redraw', data: this.render() };
        }

        if (this.confirmPopup.active) {
            return this.resolvePopupResult(this.confirmPopup.handleInput(data));
        }

        if (this.copyProgressPopup.active) {
            this.copyProgressPopup.handleInput(data);
            return { action: 'redraw', data: this.render() };
        }

        if (this.scanProgressPopup.active) {
            this.scanProgressPopup.handleInput(data);
            return { action: 'redraw', data: this.render() };
        }

        if (this.deleteProgressPopup.active) {
            this.deleteProgressPopup.handleInput(data);
            return { action: 'redraw', data: this.render() };
        }

        if (this.themePopup.active) {
            return this.resolveThemePopupResult(this.themePopup.handleInput(data));
        }

        if (this.colorEditorPopup.active) {
            return this.resolveColorEditorResult(this.colorEditorPopup.handleInput(data));
        }

        if (this.sortPopup.active) {
            return this.resolveSortResult(this.sortPopup.handleInput(data));
        }

        if (this.helpPopup.active) {
            const helpResult = this.helpPopup.handleInput(data);
            if (helpResult.action === 'close') this.helpPopup.close();
            if (this.helpPopup.interceptF1Changed) {
                this.settings.interceptF1 = this.helpPopup.interceptF1;
                this.helpPopup.interceptF1Changed = false;
                return { action: 'interceptF1Changed', data: this.render(), interceptF1: this.helpPopup.interceptF1 };
            }
            return { action: 'redraw', data: this.render() };
        }

        if (this.menuPopup.active) {
            return this.resolveMenuResult(this.menuPopup.handleInput(data));
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

        if (matchesKeyBinding(data, this.settings.keys.help)) {
            this.helpPopup.openHelp(this.docsDir, this.settings.interceptF1);
            return { action: 'redraw', data: this.render() };
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
            const hasOverrides = Object.keys(this.settings.colorOverrides).length > 0;
            this.menuPopup.openMenu(
                this.settings, this.activePane,
                this.left.sortMode, this.right.sortMode,
                this.left.colCount, this.right.colCount,
                hasOverrides,
            );
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, this.settings.keys.view)) {
            const entry = pane.entries[pane.cursor];
            if (pane.isInArchive && entry && entry.name !== '..' && !entry.isDir) {
                return {
                    action: 'viewArchiveFile',
                    archivePath: pane.archiveHandle!.archivePath,
                    entryPath: pane.getArchiveEntryPath(entry.name),
                };
            }
            if (entry && entry.name !== '..') {
                return { action: 'viewFile', filePath: path.join(pane.cwd, entry.name) };
            }
            return { action: 'none' };
        }

        if (matchesKeyBinding(data, this.settings.keys.edit)) {
            const entry = pane.entries[pane.cursor];
            if (pane.isInArchive && entry && !entry.isDir) {
                return {
                    action: 'openArchiveFile',
                    archivePath: pane.archiveHandle!.archivePath,
                    entryPath: pane.getArchiveEntryPath(entry.name),
                };
            }
            if (entry && !entry.isDir) {
                return { action: 'openFile', filePath: path.join(pane.cwd, entry.name) };
            }
            return { action: 'none' };
        }

        if (matchesKeyBinding(data, this.settings.keys.copy)) {
            if (pane.isInArchive) {
                return this.openArchiveExtractPopup();
            }
            const otherPane = this.activePane === 'left' ? this.right : this.left;
            if (otherPane.isInArchive) {
                return this.openAddToArchivePopup();
            }
            return this.openCopyMovePopup('copy');
        }

        if (matchesKeyBinding(data, this.settings.keys.move)) {
            if (pane.isInArchive) {
                return this.openArchiveMoveFromPopup();
            }
            const otherPane = this.activePane === 'left' ? this.right : this.left;
            if (otherPane.isInArchive) {
                return this.openArchiveMoveToPopup();
            }
            return this.openCopyMovePopup('move');
        }

        if (matchesKeyBinding(data, this.settings.keys.mkdir)) {
            if (pane.isInArchive) {
                return this.openArchiveMkdirPopup();
            }
            this.openMkdirPopup('');
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, this.settings.keys.delete)) {
            if (pane.isInArchive) {
                return this.openArchiveDeletePopup();
            }
            const platform = os.platform();
            const hasTrash = platform === 'win32' || platform === 'darwin';
            return this.openDeletePopup(pane, hasTrash);
        }

        if (matchesKeyBinding(data, this.settings.keys.forceDelete)) {
            if (pane.isInArchive) {
                return this.openArchiveDeletePopup();
            }
            return this.openDeletePopup(pane, false);
        }

        if (matchesKeyBinding(data, this.settings.keys.toggleDotfiles)) {
            this.settings.showDotfiles = !this.settings.showDotfiles;
            this.left.refresh(this.settings);
            this.right.refresh(this.settings);
            return { action: 'settingsChanged' };
        }

        if (matchesKeyBinding(data, this.settings.keys.quickView)) {
            if (this.quickViewMode) {
                this.quickViewMode = false;
                return { action: 'quickViewClose', data: this.render() };
            } else {
                this.quickViewMode = true;
                this.inactivePaneHidden = false;
                const side: 'left' | 'right' = this.activePane === 'left' ? 'right' : 'left';
                const target = this.getQuickViewTarget();
                return { action: 'quickView', data: this.render(), filePath: target.path, targetType: target.type, side };
            }
        }

        if (this.quickViewMode) {
            if (matchesKeyBinding(data, this.settings.keys.togglePane)) {
                this.quickViewMode = false;
                this.inactivePaneHidden = !this.inactivePaneHidden;
                return { action: 'quickViewClose', data: this.render() };
            }
            if (matchesKeyBinding(data, this.settings.keys.resizeLeft)
                || matchesKeyBinding(data, this.settings.keys.resizeRight)) {
                return { action: 'none' };
            }
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
            this.showReadErrorPopup(pane);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Ctrl+U')) {
            if (this.quickViewMode) {
                this.quickViewMode = false;
            }
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

        const ctrlFSortMap: [string, SortMode][] = [
            ['Ctrl+F3', 'name'], ['Ctrl+F4', 'extension'], ['Ctrl+F5', 'date'],
            ['Ctrl+F6', 'size'], ['Ctrl+F7', 'unsorted'], ['Ctrl+F8', 'creationTime'],
            ['Ctrl+F9', 'accessTime'], ['Ctrl+F10', 'description'], ['Ctrl+F11', 'owner'],
        ];
        for (const [key, mode] of ctrlFSortMap) {
            if (matchesKeyBinding(data, key)) {
                if (pane.sortMode === mode) {
                    pane.sortReversed = !pane.sortReversed;
                } else {
                    pane.sortMode = mode;
                    pane.sortReversed = false;
                }
                pane.refresh(this.settings);
                return { action: 'redraw', data: this.render() };
            }
        }

        if (matchesKeyBinding(data, 'Ctrl+F12')) {
            this.openSortPopup(this.activePane);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Shift+F11')) {
            this.settings.useSortGroups = !this.settings.useSortGroups;
            this.left.refresh(this.settings);
            this.right.refresh(this.settings);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Shift+F12')) {
            pane.moveSelectedToTop(this.settings);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Ctrl+PageUp')) {
            if (pane.isInArchive) {
                if (!pane.navigateArchiveUp(this.settings, pageCapacity)) {
                    pane.exitArchive(this.settings);
                    this.showReadErrorPopup(pane);
                }
                return { action: 'redraw', data: clearScreen() + this.render(), chdir: pane.cwd };
            }
            pane.navigateUp(this.settings, pageCapacity);
            this.showReadErrorPopup(pane);
            return { action: 'redraw', data: clearScreen() + this.render(), chdir: pane.cwd };
        }

        if (matchesKeyBinding(data, 'Ctrl+PageDown')) {
            const entry = pane.entries[pane.cursor];
            if (pane.isInArchive) {
                if (entry && entry.isDir) {
                    if (entry.name === '..') {
                        if (!pane.navigateArchiveUp(this.settings, pageCapacity)) {
                            pane.exitArchive(this.settings);
                        }
                    } else {
                        pane.navigateArchiveDir(entry.name);
                    }
                    return { action: 'redraw', data: clearScreen() + this.render() };
                }
                return { action: 'none' };
            }
            if (entry && entry.isDir) {
                if (entry.name === '..') {
                    pane.navigateUp(this.settings, pageCapacity);
                } else {
                    pane.navigateInto(entry, this.settings);
                }
                this.showReadErrorPopup(pane);
                return { action: 'redraw', data: clearScreen() + this.render(), chdir: pane.cwd };
            }
            if (entry && !entry.isDir && isArchiveFile(entry.name)) {
                return { action: 'enterArchive', filePath: path.join(pane.cwd, entry.name) };
            }
            return { action: 'none' };
        }

        if (matchesKeyBinding(data, 'Ctrl+Enter')) {
            const entry = pane.entries[pane.cursor];
            if (entry && entry.name !== '..') {
                this.shellInputLen += entry.name.length;
                return { action: 'input', data: entry.name, redraw: '' };
            }
            return { action: 'none' };
        }

        if (matchesKeyBinding(data, 'Ctrl+[')) {
            const dir = this.left.cwd + path.sep;
            this.shellInputLen += dir.length;
            return { action: 'input', data: dir, redraw: '' };
        }

        if (matchesKeyBinding(data, 'Ctrl+]')) {
            const dir = this.right.cwd + path.sep;
            this.shellInputLen += dir.length;
            return { action: 'input', data: dir, redraw: '' };
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

        // Shift+navigation: select/deselect range from old cursor to new cursor
        if (matchesKeyBinding(data, 'Shift+Up')) {
            if (pane.cursor > 0) {
                const oldCursor = pane.cursor;
                pane.cursor--;
                pane.toggleSelectionRange(oldCursor, pane.cursor);
                if (pane.cursor < pane.scroll) {
                    pane.scroll = pane.cursor;
                }
            }
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Shift+Down')) {
            if (pane.cursor < pane.entries.length - 1) {
                const oldCursor = pane.cursor;
                pane.cursor++;
                pane.toggleSelectionRange(oldCursor, pane.cursor);
                if (pane.cursor >= pane.scroll + pageCapacity) {
                    pane.scroll = pane.cursor - pageCapacity + 1;
                }
            }
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Shift+Right')) {
            const oldCursor = pane.cursor;
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
            pane.toggleSelectionRange(oldCursor, pane.cursor);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Shift+Left')) {
            const oldCursor = pane.cursor;
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
            pane.toggleSelectionRange(oldCursor, pane.cursor);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Shift+PageUp')) {
            const oldCursor = pane.cursor;
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
            pane.toggleSelectionRange(oldCursor, pane.cursor);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Shift+PageDown')) {
            const oldCursor = pane.cursor;
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
            pane.toggleSelectionRange(oldCursor, pane.cursor);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Shift+Home')) {
            const oldCursor = pane.cursor;
            pane.cursor = 0;
            pane.scroll = 0;
            pane.toggleSelectionRange(oldCursor, pane.cursor);
            return { action: 'redraw', data: this.render() };
        }

        if (matchesKeyBinding(data, 'Shift+End')) {
            const oldCursor = pane.cursor;
            pane.cursor = Math.max(0, pane.entries.length - 1);
            if (pane.cursor >= pane.scroll + pageCapacity) {
                pane.scroll = pane.cursor - pageCapacity + 1;
            }
            pane.toggleSelectionRange(oldCursor, pane.cursor);
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
            if (this.quickViewMode) {
                this.quickViewMode = false;
                this.activePane = this.activePane === 'left' ? 'right' : 'left';
                return { action: 'quickViewClose', data: this.render(), chdir: this.activePaneObj.cwd };
            }
            this.activePane = this.activePane === 'left' ? 'right' : 'left';
            return { action: 'redraw', data: this.render(), chdir: this.activePaneObj.cwd };
        }

        if (data === '\r') {
            if (this.shellInputLen > 0) {
                this.shellInputLen = 0;
                return { action: 'executeCommand', data: '\r' };
            }
            const entry = pane.entries[pane.cursor];

            if (pane.isInArchive) {
                if (entry && entry.isDir) {
                    if (entry.name === '..') {
                        if (!pane.navigateArchiveUp(this.settings, pageCapacity)) {
                            pane.exitArchive(this.settings);
                        }
                    } else {
                        pane.navigateArchiveDir(entry.name);
                    }
                    return { action: 'redraw', data: clearScreen() + this.render() };
                }
                if (entry && !entry.isDir) {
                    return {
                        action: 'openArchiveFile',
                        archivePath: pane.archiveHandle!.archivePath,
                        entryPath: pane.getArchiveEntryPath(entry.name),
                    };
                }
                return { action: 'none' };
            }

            if (entry && entry.isDir) {
                if (entry.name === '..') {
                    pane.navigateUp(this.settings, pageCapacity);
                } else {
                    pane.navigateInto(entry, this.settings);
                }
                this.showReadErrorPopup(pane);
                return { action: 'redraw', data: clearScreen() + this.render(), chdir: pane.cwd };
            }
            if (entry && !entry.isDir && isArchiveFile(entry.name)) {
                return { action: 'enterArchive', filePath: path.join(pane.cwd, entry.name) };
            }
            if (entry && !entry.isDir) {
                return { action: 'openFile', filePath: path.join(pane.cwd, entry.name) };
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

        const cmdResult = this.commandLine.handleInput(data);
        if (cmdResult) return cmdResult;

        return { action: 'none' };
    }

    private handleMouse(mouse: MouseEvent, layout: Layout, activePaneGeo: PaneGeometry): PanelInputResult {
        const popup = this.activePopupObj;

        const resolvePopup = (result: PopupInputResult): PanelInputResult => {
            if (popup === this.themePopup) return this.resolveThemePopupResult(result);
            if (popup === this.colorEditorPopup) return this.resolveColorEditorResult(result);
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
            return { ...cmd, data: this.render() };
        }
        return { action: 'redraw', data: this.render() };
    }

    private resolveSortResult(result: PopupInputResult): PanelInputResult {
        if (result.action === 'close' && result.confirm && result.command) {
            const cmd = result.command as SortPopupResult;
            const pane = this.sortPopup.targetPane === 'left' ? this.left : this.right;
            if (cmd.type === 'sort' && cmd.mode) {
                pane.sortMode = cmd.mode;
                pane.sortReversed = cmd.reversed ?? false;
                pane.refresh(this.settings);
            } else if (cmd.type === 'toggleDirsFirst') {
                pane.sortDirsFirst = !pane.sortDirsFirst;
                pane.refresh(this.settings);
            } else if (cmd.type === 'toggleSortGroups') {
                this.settings.useSortGroups = !this.settings.useSortGroups;
                this.left.refresh(this.settings);
                this.right.refresh(this.settings);
            } else if (cmd.type === 'toggleSelectedFirst') {
                pane.moveSelectedToTop(this.settings);
            }
        }
        return { action: 'redraw', data: this.render() };
    }

    private resolveMenuResult(result: PopupInputResult): PanelInputResult {
        if (result.action === 'close' && result.confirm && result.command) {
            return this.handleMenuCommand(result.command as MenuCommand);
        }
        return { action: 'redraw', data: this.render() };
    }

    private resolveColorEditorResult(result: PopupInputResult): PanelInputResult {
        if (result.action === 'close' && result.confirm) {
            const overrides = this.colorEditorPopup.getOverrides();
            this.settings.colorOverrides = overrides;
            this.settings.theme = applyColorOverrides(this.settings.baseTheme, overrides);
            this.left.refresh(this.settings);
            this.right.refresh(this.settings);
            return { action: 'redraw', data: this.render() };
        }
        return { action: 'redraw', data: this.render() };
    }

    private resolveThemePopupResult(result: PopupInputResult): PanelInputResult {
        if (result.action === 'close' && result.confirm) {
            const themeName = this.themePopup.getSelectedThemeName();
            const resultAction = this.themePopup.getResultAction();
            if (resultAction === 'edit') {
                const baseTheme = resolveTheme(themeName, this.settings.vscodeThemeKind);
                this.colorEditorPopup.openWith(baseTheme, this.settings.colorOverrides);
                this.colorEditorPopup.setConfirmAction(() => {
                    const overrides = this.colorEditorPopup.getOverrides();
                    this.settings.colorOverrides = overrides;
                    this.settings.theme = applyColorOverrides(this.settings.baseTheme, overrides);
                    this.left.refresh(this.settings);
                    this.right.refresh(this.settings);
                    return { action: 'redraw' };
                });
                return { action: 'changeTheme', themeName };
            }
            if (resultAction === 'reset') {
                this.confirmPopup.openWith({
                    title: 'Reset colors',
                    bodyLines: ['Reset all color overrides to defaults?'],
                    buttons: ['Reset', 'Cancel'],
                    warning: true,
                    onConfirm: (btnIdx) => {
                        if (btnIdx === 0) {
                            this.settings.colorOverrides = {};
                            this.settings.theme = this.settings.baseTheme;
                            this.left.refresh(this.settings);
                            this.right.refresh(this.settings);
                            return { action: 'redraw' };
                        }
                    },
                });
                return { action: 'changeTheme', themeName };
            }
            return { action: 'changeTheme', themeName };
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
            case 'openSortMenu': {
                this.openSortPopup(cmd.pane);
                return { action: 'redraw', data: this.render() };
            }
            case 'reread': {
                const pane = cmd.pane === 'left' ? this.left : this.right;
                pane.refresh(this.settings);
                this.showReadErrorPopup(pane);
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
                if (this.activePaneObj.isInArchive) {
                    return this.openArchiveExtractPopup();
                }
                const otherCopy = this.activePane === 'left' ? this.right : this.left;
                if (otherCopy.isInArchive) {
                    return this.openAddToArchivePopup();
                }
                return this.openCopyMovePopup('copy');
            }
            case 'move': {
                if (this.activePaneObj.isInArchive) {
                    return this.openArchiveMoveFromPopup();
                }
                const otherMove = this.activePane === 'left' ? this.right : this.left;
                if (otherMove.isInArchive) {
                    return this.openArchiveMoveToPopup();
                }
                return this.openCopyMovePopup('move');
            }
            case 'mkdir': {
                if (this.activePaneObj.isInArchive) {
                    return this.openArchiveMkdirPopup();
                }
                this.openMkdirPopup('');
                return { action: 'redraw', data: this.render() };
            }
            case 'delete': {
                if (this.activePaneObj.isInArchive) {
                    return this.openArchiveDeletePopup();
                }
                const pane = this.activePaneObj;
                const platform = os.platform();
                const hasTrash = platform === 'win32' || platform === 'darwin';
                return this.openDeletePopup(pane, hasTrash);
            }
            case 'swapPanels': {
                const tmp = this.left.getState();
                this.left.setState(this.right.getState());
                this.right.setState(tmp);
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
            case 'changeTheme': {
                this.themePopup.openWith(this.settings.themeName, this.settings.vscodeThemeKind, this.settings.colorOverrides);
                return { action: 'redraw', data: this.render() };
            }
            case 'editColors': {
                this.colorEditorPopup.openWith(this.settings.baseTheme, this.settings.colorOverrides);
                this.colorEditorPopup.setConfirmAction(() => {
                    const overrides = this.colorEditorPopup.getOverrides();
                    this.settings.colorOverrides = overrides;
                    this.settings.theme = applyColorOverrides(this.settings.baseTheme, overrides);
                    this.left.refresh(this.settings);
                    this.right.refresh(this.settings);
                    return { action: 'redraw' };
                });
                return { action: 'redraw', data: this.render() };
            }
            case 'copyThemeColors': {
                this.settings.colorOverrides = themeToOverrides(this.settings.theme);
                return { action: 'redraw', data: this.render() };
            }
            case 'resetColors': {
                this.settings.colorOverrides = {};
                this.settings.theme = this.settings.baseTheme;
                this.left.refresh(this.settings);
                this.right.refresh(this.settings);
                return { action: 'redraw', data: this.render() };
            }
            case 'saveSettings': {
                return this.openSaveSettingsPopup();
            }
            case 'deleteSettings': {
                return this.openDeleteSettingsPopup();
            }
            case 'resetAllSettings': {
                return this.openResetAllSettingsPopup();
            }
            default:
                return { action: 'redraw', data: this.render() };
        }
    }

    private openSaveSettingsPopup(): PanelInputResult {
        let userLabel = this.settings.remoteName
            ? 'Remote: ' + this.settings.remoteName
            : 'User';
        let wsLabel = 'Workspace';
        if (!this.settings.settingsInScopes.user) userLabel += ' (new)';
        if (!this.settings.settingsInScopes.workspace) wsLabel += ' (new)';
        const buttons = [userLabel, wsLabel, 'Cancel'];
        this.confirmPopup.openWith({
            title: 'Save settings',
            bodyLines: ['Save all current settings to:'],
            buttons,
            warning: false,
            onConfirm: (btnIdx) => {
                if (btnIdx === 0) return { action: 'saveSettings', scope: 'user' };
                if (btnIdx === 1) return { action: 'saveSettings', scope: 'workspace' };
                return undefined;
            },
        });
        return { action: 'redraw', data: this.render() };
    }

    private openDeleteSettingsPopup(): PanelInputResult {
        const userLabel = this.settings.remoteName
            ? 'Remote: ' + this.settings.remoteName
            : 'User';
        const buttons = [userLabel, 'Workspace', 'Cancel'];
        const disabledButtons: number[] = [];
        if (!this.settings.settingsInScopes.user) disabledButtons.push(0);
        if (!this.settings.settingsInScopes.workspace) disabledButtons.push(1);
        this.confirmPopup.openWith({
            title: 'Delete settings',
            bodyLines: ['Delete persisted settings from:'],
            buttons,
            disabledButtons,
            warning: false,
            onConfirm: (btnIdx) => {
                if (btnIdx === 0) return { action: 'deleteSettings', scope: 'user' };
                if (btnIdx === 1) return { action: 'deleteSettings', scope: 'workspace' };
                return undefined;
            },
        });
        return { action: 'redraw', data: this.render() };
    }

    private openResetAllSettingsPopup(): PanelInputResult {
        this.confirmPopup.openWith({
            title: 'Reset settings',
            bodyLines: [
                'Reset all settings to defaults?',
                'This affects the current session only.',
                'Use *Save settings* to persist.',
            ],
            buttons: ['Reset', 'Cancel'],
            warning: true,
            onConfirm: (btnIdx) => {
                if (btnIdx === 0) {
                    const baseTheme = resolveTheme(DEFAULT_SETTINGS.themeName, this.settings.vscodeThemeKind);
                    this.settings.themeName = DEFAULT_SETTINGS.themeName;
                    this.settings.baseTheme = baseTheme;
                    this.settings.theme = baseTheme;
                    this.settings.colorOverrides = {};
                    this.settings.showDotfiles = DEFAULT_SETTINGS.showDotfiles;
                    this.settings.clockEnabled = DEFAULT_SETTINGS.clockEnabled;
                    this.settings.panelColumns = DEFAULT_SETTINGS.panelColumns;
                    this.settings.keys = { ...DEFAULT_KEY_BINDINGS };
                    this.left.refresh(this.settings);
                    this.right.refresh(this.settings);
                    return { action: 'redraw' };
                }
            },
        });
        return { action: 'redraw', data: this.render() };
    }

    private openSortPopup(pane: 'left' | 'right'): void {
        const targetPane = pane === 'left' ? this.left : this.right;
        this.sortPopup.openSort(pane, targetPane.sortMode, targetPane.sortReversed,
            this.settings.useSortGroups, targetPane.selectedToTop, targetPane.sortDirsFirst);
    }

    private openDrivePopup(target: 'left' | 'right'): void {
        const otherPane = target === 'left' ? this.right : this.left;
        this.drivePopup.open(target, this.settings, otherPane.cwd);
        this.drivePopup.setConfirmAction(() => {
            const selected = this.drivePopup.selectedEntry;
            if (!selected) return undefined;
            const pane = this.drivePopup.targetPane === 'left' ? this.left : this.right;
            if (selected.path) {
                let targetPath = selected.path;
                // On Windows, if the selected drive matches the other pane's drive,
                // navigate to the other pane's cwd instead of the drive root
                if (process.platform === 'win32' && selected.group === 'drive') {
                    const otherCwd = otherPane.cwd;
                    const selectedRoot = path.parse(path.resolve(selected.path)).root.toLowerCase();
                    const otherRoot = path.parse(path.resolve(otherCwd)).root.toLowerCase();
                    if (selectedRoot === otherRoot) {
                        targetPath = otherCwd;
                    }
                }
                pane.isVirtual = false;
                pane.cwd = targetPath;
                const dirResult = Pane.readDir(targetPath, this.settings);
                pane.entries = dirResult.entries;
                pane.readError = dirResult.error ?? null;
                this.showReadErrorPopup(pane);
            } else {
                pane.isVirtual = true;
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
                dirName: r.dirName,
                linkType: r.linkType,
                linkTarget: r.linkTarget,
                multipleNames: r.multipleNames,
            };
        });
    }

    private openArchiveDeletePopup(): PanelInputResult {
        const pane = this.activePaneObj;
        const entry = pane.entries[pane.cursor];
        if (!entry || entry.name === '..') return { action: 'none' };
        if (!pane.archiveHandle) return { action: 'none' };

        if (!pane.archiveHandle.deleteEntries) {
            this.confirmPopup.openWith({
                title: 'Error',
                bodyLines: [
                    pane.archiveHandle.format + ' archives are read-only.',
                    'Cannot delete from this archive format.',
                ],
                buttons: ['OK'],
                warning: true,
                onConfirm: () => undefined,
            });
            return { action: 'redraw', data: this.render() };
        }

        const names: string[] = [];
        if (pane.selected.size > 0) {
            for (const e of pane.entries) {
                if (pane.selected.has(e.name)) names.push(e.name);
            }
        } else {
            names.push(entry.name);
        }

        const archiveDir = pane.archiveDir;
        const entryPaths = names.map(n => archiveDir ? archiveDir + '/' + n : n);
        const kind = names.length === 1 ? (entry.isDir ? 'directory' : 'file') : names.length + ' items';
        const bodyLines = names.length === 1
            ? ['Do you wish to delete the ' + kind + ' from the archive?', names[0]]
            : ['Do you wish to delete ' + kind + ' from the archive?', ...names.slice(0, 5), ...(names.length > 5 ? ['...'] : [])];

        this.confirmPopup.openWith({
            title: 'Delete',
            bodyLines,
            buttons: ['Delete', 'Cancel'],
            warning: false,
            onConfirm: (btnIdx) => {
                if (btnIdx === 0) {
                    return { action: 'deleteFromArchive', entryPaths };
                }
            },
        });
        return { action: 'redraw', data: this.render() };
    }

    private openArchiveMkdirPopup(): PanelInputResult {
        const pane = this.activePaneObj;
        if (!pane.archiveHandle) return { action: 'none' };

        if (!pane.archiveHandle.mkdirEntry) {
            this.confirmPopup.openWith({
                title: 'Error',
                bodyLines: [
                    pane.archiveHandle.format + ' archives are read-only.',
                    'Cannot create directories in this archive format.',
                ],
                buttons: ['OK'],
                warning: true,
                onConfirm: () => undefined,
            });
            return { action: 'redraw', data: this.render() };
        }

        const archiveDir = pane.archiveDir;
        this.mkdirPopup.openWith('', this.cols);
        this.mkdirPopup.setConfirmAction(() => {
            const r = this.mkdirPopup.result;
            const dirPath = archiveDir ? archiveDir + '/' + r.dirName : r.dirName;
            return { action: 'mkdirInArchive', dirPath };
        });
        return { action: 'redraw', data: this.render() };
    }

    private openArchiveMoveFromPopup(): PanelInputResult {
        const pane = this.activePaneObj;
        const entry = pane.entries[pane.cursor];
        if (!entry || (entry.name === '..' && pane.selected.size === 0)) {
            return { action: 'none' };
        }
        if (!pane.archiveHandle) return { action: 'none' };

        if (!pane.archiveHandle.deleteEntries) {
            this.confirmPopup.openWith({
                title: 'Error',
                bodyLines: [
                    pane.archiveHandle.format + ' archives are read-only.',
                    'Cannot move from this archive format.',
                ],
                buttons: ['OK'],
                warning: true,
                onConfirm: () => undefined,
            });
            return { action: 'redraw', data: this.render() };
        }

        const sourceNames: string[] = [];
        if (pane.selected.size > 0) {
            for (const e of pane.entries) {
                if (pane.selected.has(e.name)) sourceNames.push(e.name);
            }
        } else {
            sourceNames.push(entry.name);
        }

        const otherPane = this.activePane === 'left' ? this.right : this.left;
        const targetDir = otherPane.cwd;
        const archiveDir = pane.archiveDir;

        this.copyMovePopup.openWith('move', targetDir, sourceNames, path.basename(pane.archiveHandle.archivePath), this.cols);
        this.copyMovePopup.setConfirmAction(() => {
            const r = this.copyMovePopup.result;
            const entryPaths = sourceNames.map(n => archiveDir ? archiveDir + '/' + n : n);
            return {
                action: 'moveFromArchive',
                targetPath: r.targetPath,
                entryPaths,
                archiveDir,
            };
        });
        return { action: 'redraw', data: this.render() };
    }

    private openArchiveMoveToPopup(): PanelInputResult {
        const pane = this.activePaneObj;
        const entry = pane.entries[pane.cursor];
        if (!entry || (entry.name === '..' && pane.selected.size === 0)) {
            return { action: 'none' };
        }

        const otherPane = this.activePane === 'left' ? this.right : this.left;
        if (!otherPane.archiveHandle) return { action: 'none' };

        if (!otherPane.archiveHandle.addEntries) {
            this.confirmPopup.openWith({
                title: 'Error',
                bodyLines: [
                    otherPane.archiveHandle.format + ' archives are read-only.',
                    'Cannot move files into this archive format.',
                ],
                buttons: ['OK'],
                warning: true,
                onConfirm: () => undefined,
            });
            return { action: 'redraw', data: this.render() };
        }

        const sourceNames: string[] = [];
        if (pane.selected.size > 0) {
            for (const e of pane.entries) {
                if (pane.selected.has(e.name)) sourceNames.push(e.name);
            }
        } else {
            sourceNames.push(entry.name);
        }

        const archiveName = path.basename(otherPane.archiveHandle.archivePath);
        const archiveDir = otherPane.archiveDir;
        const targetLabel = archiveName + ':' + (archiveDir ? archiveDir + '/' : '');

        this.copyMovePopup.openWith('move', targetLabel, sourceNames, pane.cwd, this.cols);
        this.copyMovePopup.setConfirmAction(() => {
            const sourcePaths = sourceNames.map(n => path.join(pane.cwd, n));
            return {
                action: 'moveToArchive',
                sourcePaths,
                archiveDir,
            };
        });
        return { action: 'redraw', data: this.render() };
    }

    private openArchiveExtractPopup(): PanelInputResult {
        const pane = this.activePaneObj;
        const entry = pane.entries[pane.cursor];
        if (!entry || (entry.name === '..' && pane.selected.size === 0)) {
            return { action: 'none' };
        }

        const sourceNames: string[] = [];
        if (pane.selected.size > 0) {
            for (const e of pane.entries) {
                if (pane.selected.has(e.name)) sourceNames.push(e.name);
            }
        } else {
            sourceNames.push(entry.name);
        }

        const otherPane = this.activePane === 'left' ? this.right : this.left;
        const targetDir = otherPane.cwd;
        const archiveDir = pane.archiveDir;

        this.copyMovePopup.openWith('copy', targetDir, sourceNames, path.basename(pane.archiveHandle!.archivePath), this.cols);
        this.copyMovePopup.setConfirmAction(() => {
            const r = this.copyMovePopup.result;
            const entryPaths = sourceNames.map(n => archiveDir ? archiveDir + '/' + n : n);
            return {
                action: 'extractFromArchive',
                targetPath: r.targetPath,
                entryPaths,
                archiveDir,
            };
        });
        return { action: 'redraw', data: this.render() };
    }

    private openAddToArchivePopup(): PanelInputResult {
        const pane = this.activePaneObj;
        const entry = pane.entries[pane.cursor];
        if (!entry || (entry.name === '..' && pane.selected.size === 0)) {
            return { action: 'none' };
        }

        const otherPane = this.activePane === 'left' ? this.right : this.left;
        if (!otherPane.archiveHandle) return { action: 'none' };

        if (!otherPane.archiveHandle.addEntries) {
            this.confirmPopup.openWith({
                title: 'Error',
                bodyLines: [
                    otherPane.archiveHandle.format + ' archives are read-only.',
                    'Cannot add files to this archive format.',
                ],
                buttons: ['OK'],
                warning: true,
                onConfirm: () => undefined,
            });
            return { action: 'redraw', data: this.render() };
        }

        const sourceNames: string[] = [];
        if (pane.selected.size > 0) {
            for (const e of pane.entries) {
                if (pane.selected.has(e.name)) sourceNames.push(e.name);
            }
        } else {
            sourceNames.push(entry.name);
        }

        const archiveName = path.basename(otherPane.archiveHandle.archivePath);
        const archiveDir = otherPane.archiveDir;
        const targetLabel = archiveName + ':' + (archiveDir ? archiveDir + '/' : '');

        this.copyMovePopup.openWith('copy', targetLabel, sourceNames, pane.cwd, this.cols);
        this.copyMovePopup.setConfirmAction(() => {
            const sourcePaths = sourceNames.map(n => path.join(pane.cwd, n));
            return {
                action: 'addToArchive',
                sourcePaths,
                archiveDir,
            };
        });
        return { action: 'redraw', data: this.render() };
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
            return { ...cmd, data: this.render() };
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
        let targetPane: 'left' | 'right';
        let geo: PaneGeometry;

        if (this.quickViewMode) {
            targetPane = this.activePane;
            geo = layout.leftPane;
            if (col < geo.startCol || col >= geo.startCol + geo.width) {
                return { action: 'none' };
            }
        } else {
            const leftGeo = layout.leftPane;
            const rightGeo = layout.rightPane;

            if (col >= leftGeo.startCol && col < leftGeo.startCol + leftGeo.width) {
                targetPane = 'left';
                geo = leftGeo;
            } else if (col >= rightGeo.startCol && col < rightGeo.startCol + rightGeo.width) {
                targetPane = 'right';
                geo = rightGeo;
            } else {
                return { action: 'none' };
            }
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
        const seq = this.fkeyBar.handleMouseClick(col, this.cols);
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

        out.push(resetStyle() + bgColor(t.border.idle.bg));
        out.push(clearScreen());

        if (this.quickViewMode) {
            const pane = this.activePaneObj;
            out.push(pane.render({
                geo: layout.leftPane, layout, theme: t,
                isActive: true, showClock: this.settings.clockEnabled,
                selected: pane.selected,
            }));
        } else {
            const leftHidden = this.inactivePaneHidden && leftIsActive === false;
            const rightHidden = this.inactivePaneHidden && leftIsActive === true;

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
        }

        out.push(this.renderCommandLine(layout));
        out.push(this.renderFKeyBar(layout));

        const cellAt = (r: number, c: number) => this.getCellAt(r, c, layout);

        if (this.overwritePopup.active) {
            if (this.copyProgressPopup.active) {
                out.push(this.copyProgressPopup.render(this.rows, this.cols, t));
                out.push(this.copyProgressPopup.renderShadow(cellAt));
            }
            out.push(this.overwritePopup.render(this.rows, this.cols, t));
            out.push(this.overwritePopup.renderShadow(cellAt));
        } else if (this.confirmPopup.active) {
            if (this.copyProgressPopup.active) {
                out.push(this.copyProgressPopup.render(this.rows, this.cols, t));
                out.push(this.copyProgressPopup.renderShadow(cellAt));
            }
            out.push(this.confirmPopup.render(this.rows, this.cols, t));
            out.push(this.confirmPopup.renderShadow(cellAt));
        } else if (this.copyProgressPopup.active) {
            out.push(this.copyProgressPopup.render(this.rows, this.cols, t));
            out.push(this.copyProgressPopup.renderShadow(cellAt));
        } else if (this.scanProgressPopup.active) {
            out.push(this.scanProgressPopup.render(this.rows, this.cols, t));
            out.push(this.scanProgressPopup.renderShadow(cellAt));
        } else if (this.deleteProgressPopup.active) {
            out.push(this.deleteProgressPopup.render(this.rows, this.cols, t));
            out.push(this.deleteProgressPopup.renderShadow(cellAt));
        } else if (this.themePopup.active) {
            out.push(this.themePopup.render(this.rows, this.cols, t));
        } else if (this.colorEditorPopup.active) {
            out.push(this.colorEditorPopup.render(this.rows, this.cols, t));
            out.push(this.colorEditorPopup.renderShadow(cellAt));
        } else if (this.helpPopup.active) {
            out.push(this.helpPopup.render(this.rows, this.cols, t));
            out.push(this.helpPopup.renderShadow(cellAt));
        } else if (this.sortPopup.active) {
            const sortGeo = this.sortPopup.targetPane === 'left' ? layout.leftPane : layout.rightPane;
            out.push(this.sortPopup.render(sortGeo.startCol, sortGeo.width, t, layout.listStart, layout.listHeight));
            out.push(this.sortPopup.renderShadow(cellAt));
        } else if (this.menuPopup.active) {
            out.push(this.menuPopup.render(layout.topRow, 1, t, this.cols));
        } else if (this.searchPopup.active) {
            const activePaneGeo = this.quickViewMode
                ? layout.leftPane
                : (this.activePane === 'left' ? layout.leftPane : layout.rightPane);
            out.push(this.searchPopup.render(layout.bottomRow, activePaneGeo.startCol, t));
            out.push(this.searchPopup.renderShadow(cellAt));
        } else if (this.copyMovePopup.active) {
            out.push(this.copyMovePopup.render(this.rows, this.cols, t));
            out.push(this.copyMovePopup.renderShadow(cellAt));
        } else if (this.mkdirPopup.active) {
            out.push(this.mkdirPopup.render(this.rows, this.cols, t));
            out.push(this.mkdirPopup.renderShadow(cellAt));
        } else if (this.drivePopup.active) {
            const targetGeo = this.drivePopup.targetPane === 'left' ? layout.leftPane : layout.rightPane;
            out.push(this.drivePopup.render(layout.listStart, targetGeo.startCol, t, targetGeo.width, layout.listHeight));
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

    private showReadErrorPopup(pane: Pane): void {
        const err = pane.readError;
        if (!err) return;
        pane.readError = null;

        if (os.platform() === 'darwin' && (err.code === 'EPERM' || err.code === 'EACCES')) {
            this.confirmPopup.openWith({
                title: 'Privacy',
                bodyLines: [
                    'macOS has denied access to this directory.',
                    'Open Privacy settings to grant access?',
                ],
                buttons: ['Manage privacy', 'OK'],
                onConfirm: (btnIdx) => {
                    if (btnIdx === 0) {
                        return { action: 'openPrivacySettings' };
                    }
                },
            });
            return;
        }

        const syntheticErr = new Error(err.message) as NodeJS.ErrnoException;
        syntheticErr.code = err.code;
        const info = describeFileError(syntheticErr);
        this.confirmPopup.openWith({
            title: info.title,
            bodyLines: [info.message],
            buttons: ['OK'],
            onConfirm: () => {},
        });
    }

    private openDeletePopup(pane: Pane, toTrash: boolean): PanelInputResult {
        const entry = pane.entries[pane.cursor];
        if (!entry || entry.name === '..') return { action: 'none' };

        const fullPath = path.join(pane.cwd, entry.name);
        const kind = entry.isDir ? 'directory' : 'file';

        if (toTrash) {
            const trashName = os.platform() === 'win32' ? 'Recycle Bin' : 'Trash';
            this.confirmPopup.openWith({
                title: 'Delete',
                bodyLines: [
                    'Do you wish to *move* the ' + kind + ' to the *' + trashName + '*?',
                    entry.name,
                ],
                buttons: ['Move', 'Delete permanently', 'Cancel'],
                onConfirm: (btnIdx) => {
                    if (btnIdx === 0) {
                        return { action: 'deleteFile', filePath: fullPath, toTrash: true };
                    }
                    if (btnIdx === 1) {
                        return { action: 'deleteFile', filePath: fullPath, toTrash: false };
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
        return getCellAt(row, col, layout, {
            theme: this.settings.theme,
            activePane: this.activePane,
            inactivePaneHidden: this.inactivePaneHidden,
            quickViewMode: this.quickViewMode,
            left: this.left,
            right: this.right,
            activePaneObj: this.activePaneObj,
        });
    }

    private renderCmdCursor(layout: Layout): string {
        return this.commandLine.renderCursor(this.cmdContext(layout));
    }

    private renderCommandLine(layout: Layout): string {
        return this.commandLine.render(this.cmdContext(layout));
    }

    private renderTerminalArea(layout: Layout): string {
        return this.terminalArea.render(layout, this.activePane, this.termBuffer, this.settings.theme);
    }

    private renderTerminalAreaAt(layout: Layout, geo: PaneGeometry): string {
        return this.terminalArea.renderAt(layout, geo, this.termBuffer, this.settings.theme);
    }

    private renderFKeyBar(layout: Layout): string {
        return this.fkeyBar.render(layout, this.cols, this.settings);
    }
}
