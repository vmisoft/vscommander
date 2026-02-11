import * as os from 'os';
import * as path from 'path';
import {
    enterAltScreen, leaveAltScreen, clearScreen, showCursor, hideCursor,
    resetStyle, moveTo, bgRgb, DBOX
} from './draw';
import { PanelSettings } from './settings';
import { Layout, PaneGeometry } from './types';
import { applyStyle, computeLayout } from './helpers';
import { Pane } from './pane';
import { SearchPopup } from './searchPopup';
import { DrivePopup } from './drivePopup';
import { ConfirmPopup } from './confirmPopup';
import { TerminalBuffer } from './terminalBuffer';

export type PanelInputResult =
    | { action: 'close' }
    | { action: 'redraw'; data: string; chdir?: string }
    | { action: 'input'; data: string; redraw: string }
    | { action: 'settingsChanged' }
    | { action: 'toggleDetach' }
    | { action: 'openFile'; filePath: string }
    | { action: 'viewFile'; filePath: string }
    | { action: 'deleteFile'; filePath: string; toTrash: boolean }
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
    termBuffer: TerminalBuffer;
    inactivePaneHidden = false;
    cmdCursorVisible = true;
    splitOffset = 0;

    constructor(cols: number, rows: number, cwd: string, settings: PanelSettings) {
        this.cols = cols;
        this.rows = rows;
        this.settings = settings;
        this.left = new Pane(cwd, settings);
        this.right = new Pane(cwd, settings);
        this.searchPopup = new SearchPopup();
        this.drivePopup = new DrivePopup();
        this.confirmPopup = new ConfirmPopup();
        this.termBuffer = new TerminalBuffer(cols, rows);
    }

    show(): string {
        this.visible = true;
        this.left.refresh(this.settings);
        this.right.refresh(this.settings);
        return enterAltScreen() + this.render();
    }

    hide(): string {
        this.visible = false;
        return showCursor() + leaveAltScreen();
    }

    resize(cols: number, rows: number): string {
        this.cols = cols;
        this.rows = rows;
        this.termBuffer.resize(cols, rows);
        if (this.visible) {
            return leaveAltScreen() + enterAltScreen() + this.render();
        }
        return '';
    }

    private get leftWidth(): number {
        const base = Math.floor(this.cols / 2);
        const minWidth = 10;
        return Math.max(minWidth, Math.min(this.cols - minWidth, base + this.splitOffset));
    }

    private getLayout(): Layout {
        return computeLayout(this.rows, this.cols, this.settings.panelColumns, this.leftWidth);
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
        if (!this.visible || this.searchPopup.active || this.drivePopup.active || this.confirmPopup.active) return '';
        this.cmdCursorVisible = !this.cmdCursorVisible;
        const layout = this.getLayout();
        return this.renderCmdCursor(layout);
    }

    renderClockUpdate(): string {
        if (!this.visible || !this.settings.clockEnabled) return '';
        const layout = this.getLayout();
        const t = this.settings.theme;
        const leftIsActive = this.activePane === 'left';
        if (this.inactivePaneHidden && leftIsActive) return '';
        return this.right.render({
            geo: layout.rightPane, layout, theme: t,
            isActive: !leftIsActive, showClock: true,
        });
    }

    renderSearchCursorBlink(): string {
        if (!this.visible || !this.searchPopup.active) return '';
        const layout = this.getLayout();
        const activePaneGeo = this.activePane === 'left' ? layout.leftPane : layout.rightPane;
        return this.searchPopup.renderBlink(layout.bottomRow, activePaneGeo.startCol, this.settings.theme);
    }

    renderShellUpdate(): string {
        if (!this.visible) return '';
        const layout = this.getLayout();
        const out: string[] = [];
        out.push(this.renderCommandLine(layout));
        if (this.inactivePaneHidden) {
            out.push(this.renderTerminalArea(layout));
        }
        if (!this.searchPopup.active && !this.drivePopup.active && !this.confirmPopup.active) {
            out.push(this.renderCmdCursor(layout));
        }
        return out.join('');
    }

    handleInput(data: string): PanelInputResult {
        if (!this.visible) return { action: 'none' };

        const pane = this.activePaneObj;
        const layout = this.getLayout();
        const listHeight = layout.listHeight;
        const activePaneGeo = this.activePane === 'left' ? layout.leftPane : layout.rightPane;
        const pageCapacity = listHeight * activePaneGeo.numCols;

        if (data.startsWith('\x1b[M') || data.startsWith('\x1b[<')) {
            return { action: 'none' };
        }

        if (this.confirmPopup.active) {
            const result = this.confirmPopup.handleInput(data);
            if (result.action === 'close' && result.confirm) {
                const action = this.confirmPopup.invokeConfirm() as PanelInputResult | undefined;
                if (action) return action;
            }
            return { action: 'redraw', data: this.render() };
        }

        if (this.drivePopup.active) {
            const result = this.drivePopup.handleInput(data);
            if (result.action === 'consumed') {
                return { action: 'redraw', data: this.render() };
            }
            if (result.action === 'close') {
                let chdir: string | undefined;
                if (result.confirm) {
                    const selected = this.drivePopup.selectedEntry;
                    if (selected) {
                        const target = this.drivePopup.targetPane === 'left' ? this.left : this.right;
                        if (selected.path) {
                            target.cwd = selected.path;
                            target.entries = Pane.readDir(selected.path, this.settings);
                        } else {
                            target.cwd = selected.label;
                            target.entries = [];
                        }
                        target.cursor = 0;
                        target.scroll = 0;
                        if (this.drivePopup.targetPane === this.activePane && selected.path) {
                            chdir = selected.path;
                        }
                    }
                }
                return { action: 'redraw', data: this.render(), chdir };
            }
            return { action: 'redraw', data: this.render() };
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

        if (data === '\x1b[1;3P' || data === '\x1b\x1bOP') {
            this.drivePopup.open('left', this.settings);
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[1;3Q' || data === '\x1b\x1bOQ') {
            this.drivePopup.open('right', this.settings);
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b' || data === '\x1b\x1b') {
            return { action: 'none' };
        }

        if (data === '\x1b\r') {
            return { action: 'toggleDetach' };
        }

        if (data === '\x1b[21~') {
            return { action: 'close' };
        }

        if (data === '\x1bOR') {
            const entry = pane.entries[pane.cursor];
            if (entry && entry.name !== '..') {
                return { action: 'viewFile', filePath: path.join(pane.cwd, entry.name) };
            }
            return { action: 'none' };
        }

        if (data === '\x1bOS') {
            const entry = pane.entries[pane.cursor];
            if (entry && !entry.isDir) {
                return { action: 'openFile', filePath: path.join(pane.cwd, entry.name) };
            }
            return { action: 'none' };
        }

        if (data === '\x1b[19~') {
            const platform = os.platform();
            const hasTrash = platform === 'win32' || platform === 'darwin';
            return this.openDeletePopup(pane, hasTrash);
        }

        if (data === '\x1b[19;2~' || data === '\x1b[3;2~') {
            return this.openDeletePopup(pane, false);
        }

        if (data === '\x08') {
            this.settings.showDotfiles = !this.settings.showDotfiles;
            this.left.refresh(this.settings);
            this.right.refresh(this.settings);
            return { action: 'settingsChanged' };
        }

        if (data === '\x10') {
            this.inactivePaneHidden = !this.inactivePaneHidden;
            return { action: 'redraw', data: this.render() };
        }

        if (data === '\x1b[1;5D') {
            const minWidth = 10;
            if (this.leftWidth > minWidth) {
                this.splitOffset--;
                return { action: 'redraw', data: this.render() };
            }
            return { action: 'none' };
        }

        if (data === '\x1b[1;5C') {
            const minWidth = 10;
            if (this.cols - this.leftWidth > minWidth) {
                this.splitOffset++;
                return { action: 'redraw', data: this.render() };
            }
            return { action: 'none' };
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
                return { action: 'input', data: '\r', redraw: '' };
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
            }));
        }

        if (rightHidden) {
            out.push(this.renderTerminalAreaAt(layout, layout.rightPane));
        } else {
            out.push(this.right.render({
                geo: layout.rightPane, layout, theme: t,
                isActive: !leftIsActive, showClock: this.settings.clockEnabled,
            }));
        }

        out.push(this.renderCommandLine(layout));
        out.push(this.renderFKeyBar(layout));

        if (this.searchPopup.active) {
            const activePaneGeo = this.activePane === 'left' ? layout.leftPane : layout.rightPane;
            out.push(this.searchPopup.render(layout.bottomRow, activePaneGeo.startCol, t));
        } else if (this.confirmPopup.active) {
            out.push(this.confirmPopup.render(this.rows, this.cols, t));
        } else if (this.drivePopup.active) {
            const targetGeo = this.drivePopup.targetPane === 'left' ? layout.leftPane : layout.rightPane;
            out.push(this.drivePopup.render(layout.listStart, targetGeo.startCol, t, targetGeo.width));
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

        const keys = [
            { num: '1', label: 'Help' },
            { num: '2', label: 'Menu' },
            { num: '3', label: 'View' },
            { num: '4', label: 'Edit' },
            { num: '5', label: 'Copy' },
            { num: '6', label: 'Move' },
            { num: '7', label: 'Mkdir' },
            { num: '8', label: 'Del' },
            { num: '9', label: 'Conf' },
            { num: '10', label: 'Quit' },
        ];

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
