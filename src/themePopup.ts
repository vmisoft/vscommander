import { DBOX, BOX, MBOX, moveTo, resetStyle } from './draw';
import { Theme, ThemeName, PanelSettings, DEFAULT_SETTINGS, resolveTheme, ColorOverride, applyColorOverrides } from './settings';
import { DirEntry, Layout } from './types';
import { Popup, PopupInputResult } from './popup';
import { ButtonGroup } from './buttonGroup';
import { FrameBuffer } from './frameBuffer';
import { Pane } from './pane';
import { ConfirmPopup } from './confirmPopup';
import { CopyMovePopup } from './copyMovePopup';
import { applyStyle, computePaneGeometry } from './helpers';

interface ThemeEntry {
    displayName: string;
    themeName: ThemeName;
}

const THEME_LIST: ThemeEntry[] = [
    { displayName: 'Far', themeName: 'far' },
    { displayName: 'VS Code', themeName: 'vscode' },
];

const MOCK_ENTRIES: DirEntry[] = [
    { name: '..', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date(0) },
    { name: '.git', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date('2025-01-10') },
    { name: '.github', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date('2025-01-09') },
    { name: 'build', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date('2025-01-12') },
    { name: 'dist', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date('2025-01-14') },
    { name: 'docs', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date('2025-01-08') },
    { name: 'node_modules', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date('2025-01-02') },
    { name: 'src', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date('2025-01-15') },
    { name: 'tests', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date('2025-01-11') },
    { name: '.eslintrc.json', isDir: false, isSymlink: false, linkTarget: '', size: 128, mtime: new Date('2025-01-04') },
    { name: '.gitignore', isDir: false, isSymlink: false, linkTarget: '', size: 234, mtime: new Date('2025-01-05') },
    { name: 'CHANGELOG.md', isDir: false, isSymlink: false, linkTarget: '', size: 5678, mtime: new Date('2025-01-13') },
    { name: 'LICENSE', isDir: false, isSymlink: false, linkTarget: '', size: 1089, mtime: new Date('2025-01-01') },
    { name: 'Makefile', isDir: false, isSymlink: false, linkTarget: '', size: 456, mtime: new Date('2025-01-06') },
    { name: 'README.md', isDir: false, isSymlink: false, linkTarget: '', size: 2345, mtime: new Date('2025-01-13') },
    { name: 'index.ts', isDir: false, isSymlink: false, linkTarget: '', size: 1234, mtime: new Date('2025-01-15') },
    { name: 'package-lock.json', isDir: false, isSymlink: false, linkTarget: '', size: 98765, mtime: new Date('2025-01-14') },
    { name: 'package.json', isDir: false, isSymlink: false, linkTarget: '', size: 567, mtime: new Date('2025-01-14') },
    { name: 'tsconfig.json', isDir: false, isSymlink: false, linkTarget: '', size: 456, mtime: new Date('2025-01-11') },
    { name: 'webpack.config.js', isDir: false, isSymlink: false, linkTarget: '', size: 789, mtime: new Date('2025-01-09') },
];

export type ThemeResultAction = 'ok' | 'edit' | 'reset';

export class ThemePopup extends Popup {
    private themes: ThemeEntry[] = [];
    private cursor = 0;
    private focusArea: 0 | 1 = 0;
    private buttonGroup = new ButtonGroup(['OK', 'Edit', 'Reset', 'Cancel']);
    private vscodeThemeKind = 2;
    private colorOverrides: Record<string, ColorOverride> = {};
    private selectedThemeName: ThemeName = 'far';
    private resultAction: ThemeResultAction = 'ok';
    private mockPane: Pane | null = null;
    private mockConfirm: ConfirmPopup | null = null;
    private mockCopy: CopyMovePopup | null = null;
    override padding = 0;

    constructor() {
        super();
    }

    openWith(currentThemeName: ThemeName, vscodeThemeKind: number, colorOverrides: Record<string, ColorOverride> = {}): void {
        super.open();
        this.vscodeThemeKind = vscodeThemeKind;
        this.colorOverrides = colorOverrides;
        this.themes = [...THEME_LIST];
        this.cursor = Math.max(0, this.themes.findIndex(t => t.themeName === currentThemeName));
        this.selectedThemeName = currentThemeName;
        this.resultAction = 'ok';
        this.focusArea = 0;
        this.buttonGroup.selectedIndex = 0;

        const mockSettings: PanelSettings = { ...DEFAULT_SETTINGS, showDotfiles: true };
        this.mockPane = new Pane('/nonexistent-vscommander-preview', mockSettings);
        this.mockPane.entries = [...MOCK_ENTRIES];
        this.mockPane.cwd = '/home/user/project';
        this.mockPane.cursor = 15;
        this.mockPane.colCount = 2;

        this.mockConfirm = new ConfirmPopup();
        this.mockConfirm.openWith({
            title: 'Quit',
            bodyLines: ['Quit panel?'],
            buttons: ['Yes', 'No'],
            warning: true,
            onConfirm: () => undefined,
        });

        this.mockCopy = new CopyMovePopup();
        this.mockCopy.openWith('copy', '/home/user/backup', ['package.json'], '/home/user/project', 60);
    }

    close(): void {
        this.mockPane = null;
        this.mockConfirm = null;
        this.mockCopy = null;
        super.close();
    }

    getSelectedThemeName(): ThemeName {
        return this.selectedThemeName;
    }

    getResultAction(): ThemeResultAction {
        return this.resultAction;
    }

    handleInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (this.focusArea === 0) {
            if (data === '\x1b[A') {
                if (this.cursor > 0) {
                    this.cursor--;
                    this.selectedThemeName = this.themes[this.cursor].themeName;
                }
                return { action: 'consumed' };
            }
            if (data === '\x1b[B') {
                if (this.cursor < this.themes.length - 1) {
                    this.cursor++;
                    this.selectedThemeName = this.themes[this.cursor].themeName;
                }
                return { action: 'consumed' };
            }
            if (data === '\x1b[H' || data === '\x1b[1~') {
                this.cursor = 0;
                this.selectedThemeName = this.themes[this.cursor].themeName;
                return { action: 'consumed' };
            }
            if (data === '\x1b[F' || data === '\x1b[4~') {
                this.cursor = this.themes.length - 1;
                this.selectedThemeName = this.themes[this.cursor].themeName;
                return { action: 'consumed' };
            }
            if (data === '\t') {
                this.focusArea = 1;
                return { action: 'consumed' };
            }
            if (data === '\r') {
                this.resultAction = 'ok';
                this.selectedThemeName = this.themes[this.cursor].themeName;
                this.close();
                return { action: 'close', confirm: true };
            }
            return { action: 'consumed' };
        }

        if (data === '\x1b[Z') {
            this.focusArea = 0;
            return { action: 'consumed' };
        }
        if (data === '\x1b[A' || data === '\x1b[B') {
            this.focusArea = 0;
            return this.handleInput(data);
        }
        if (data === '\t') {
            if (this.buttonGroup.selectedIndex < this.buttonGroup.labels.length - 1) {
                this.buttonGroup.selectedIndex++;
            } else {
                this.focusArea = 0;
                this.buttonGroup.selectedIndex = 0;
            }
            return { action: 'consumed' };
        }
        const result = this.buttonGroup.handleInput(data);
        if (result.confirmed) {
            return this.confirmButton(this.buttonGroup.selectedIndex);
        }
        if (result.consumed) return { action: 'consumed' };

        return { action: 'consumed' };
    }

    private confirmButton(idx: number): PopupInputResult {
        if (idx === 3) {
            this.close();
            return { action: 'close', confirm: false };
        }
        this.resultAction = idx === 0 ? 'ok' : idx === 1 ? 'edit' : 'reset';
        this.selectedThemeName = this.themes[this.cursor].themeName;
        this.close();
        return { action: 'close', confirm: true };
    }

    override renderToBuffer(_theme: Theme): FrameBuffer {
        return new FrameBuffer(0, 0);
    }

    render(rows: number, cols: number, theme: Theme): string {
        if (!this.active) return '';

        const out: string[] = [];
        const popupWidth = Math.max(40, cols - 2);
        const popupHeight = Math.max(12, rows - 2);
        const popupTop = Math.floor((rows - popupHeight) / 2) + 1;
        const popupLeft = Math.floor((cols - popupWidth) / 2) + 1;

        this.setScreenPosition(popupTop, popupLeft, popupWidth, popupHeight);

        const bodyStyle = theme.popupInfoBody.idle;
        const listWidth = 16;
        const dividerCol = listWidth + 1;
        const previewStartCol = dividerCol + 1;
        const sepRow = popupHeight - 3;

        const fb = new FrameBuffer(popupWidth, popupHeight);
        fb.fill(0, 0, popupWidth, popupHeight, ' ', bodyStyle);
        fb.drawBox(0, 0, popupWidth, popupHeight, bodyStyle, DBOX, 'Change theme');

        for (let r = 1; r < sepRow; r++) {
            fb.write(r, dividerCol, BOX.vertical, bodyStyle);
        }

        fb.write(sepRow, 0, MBOX.vertDoubleRight, bodyStyle);
        for (let c = 1; c < popupWidth - 1; c++) {
            fb.write(sepRow, c, c === dividerCol ? BOX.teeUp : BOX.horizontal, bodyStyle);
        }
        fb.write(sepRow, popupWidth - 1, MBOX.vertDoubleLeft, bodyStyle);

        const btnRow = popupHeight - 2;
        fb.blit(btnRow, 1, this.buttonGroup.renderToBuffer(
            popupWidth - 2, bodyStyle,
            theme.popupInfoButton.idle, theme.popupInfoButton.selected,
            this.focusArea === 1));

        const listStyle = theme.menuItem.idle;
        const listSelStyle = theme.menuItem.selected;
        for (let i = 0; i < this.themes.length; i++) {
            const isCursor = i === this.cursor;
            const style = isCursor && this.focusArea === 0 ? listSelStyle : listStyle;
            const row = 1 + i;
            if (row >= sepRow) break;
            const prefix = isCursor && this.focusArea === 0 ? '>' : ' ';
            const name = prefix + ' ' + this.themes[i].displayName;
            fb.write(row, 1, name.slice(0, listWidth).padEnd(listWidth, ' '), style);
        }
        for (let r = 1 + this.themes.length; r < sepRow; r++) {
            fb.write(r, 1, ' '.repeat(listWidth), listStyle);
        }

        out.push(fb.toAnsi(this.screenRow, this.screenCol));

        let previewTheme = resolveTheme(this.themes[this.cursor].themeName, this.vscodeThemeKind);
        if (Object.keys(this.colorOverrides).length > 0) {
            previewTheme = applyColorOverrides(previewTheme, this.colorOverrides);
        }
        out.push(this.renderPreview(
            popupTop, popupLeft, popupWidth, popupHeight,
            previewStartCol, sepRow, previewTheme));

        return out.join('');
    }

    private renderPreview(
        popupTop: number, popupLeft: number, popupWidth: number, _popupHeight: number,
        previewStartCol: number, sepRow: number, previewTheme: Theme,
    ): string {
        if (!this.mockPane || !this.mockConfirm) return '';

        const out: string[] = [];
        const previewScreenLeft = popupLeft + previewStartCol;
        const previewScreenRight = popupLeft + popupWidth - 2;
        const previewCols = previewScreenRight - previewScreenLeft + 1;
        const previewScreenTop = popupTop + 1;
        const previewScreenBottom = popupTop + sepRow - 1;

        if (previewCols < 10 || previewScreenBottom - previewScreenTop + 1 < 8) return '';

        const fkeyRow = previewScreenBottom;
        const cmdRow = fkeyRow - 1;
        const paneBottomRow = cmdRow - 1;
        const paneTopRow = previewScreenTop;
        const paneRows = paneBottomRow - paneTopRow + 1;

        if (paneRows < 6) return '';

        const listHeight = Math.max(1, paneRows - 5);
        const paneGeo = computePaneGeometry(previewScreenLeft, previewCols, 2);

        const layout: Layout = {
            topRow: paneTopRow,
            headerRow: paneTopRow + 1,
            listStart: paneTopRow + 2,
            listHeight,
            separatorRow: paneTopRow + 2 + listHeight,
            infoRow: paneTopRow + 3 + listHeight,
            bottomRow: paneTopRow + 4 + listHeight,
            cmdRow,
            fkeyRow,
            leftPane: paneGeo,
            rightPane: paneGeo,
        };

        const pageCapacity = listHeight * paneGeo.numCols;
        this.mockPane.cursor = Math.min(15, this.mockPane.entries.length - 1);
        this.mockPane.ensureCursorVisible(pageCapacity);

        const selected = new Set<string>();
        selected.add('README.md');
        selected.add('CHANGELOG.md');

        out.push(this.mockPane.render({
            geo: layout.leftPane,
            layout,
            theme: previewTheme,
            isActive: true,
            showClock: true,
            selected,
        }));

        const cmdText = '$ ls -la';
        out.push(applyStyle(previewTheme.commandLine.idle) + moveTo(cmdRow, previewScreenLeft));
        out.push(cmdText + ' '.repeat(Math.max(0, previewCols - cmdText.length)));
        out.push(resetStyle());

        out.push(this.renderMockFKeyBar(fkeyRow, previewScreenLeft, previewCols, previewTheme));

        if (this.mockCopy) {
            const copyFb = this.mockCopy.renderToBuffer(previewTheme);
            if (copyFb.width > 0 && copyFb.height > 0 && copyFb.width <= previewCols) {
                const copyRow = Math.max(paneTopRow + 2,
                    Math.floor((paneTopRow + paneBottomRow - copyFb.height) / 2) + 1);
                const copyCol = previewScreenLeft +
                    Math.max(0, Math.floor((previewCols - copyFb.width) / 2));
                out.push(copyFb.toAnsi(copyRow, copyCol));
            }
        }

        const confirmFb = this.mockConfirm.renderToBuffer(previewTheme);
        if (confirmFb.width > 0 && confirmFb.height > 0 && confirmFb.width <= previewCols) {
            const confirmRow = Math.max(paneTopRow,
                Math.floor((paneTopRow + paneBottomRow - confirmFb.height) / 2) - 2);
            const confirmCol = previewScreenLeft +
                Math.max(0, Math.floor((previewCols - confirmFb.width) / 2));
            out.push(confirmFb.toAnsi(confirmRow, confirmCol));
        }

        return out.join('');
    }

    private renderMockFKeyBar(fkeyRow: number, startCol: number, width: number, theme: Theme): string {
        const out: string[] = [];
        const keys = [
            { num: '1', label: 'Help' }, { num: '2', label: 'Menu' },
            { num: '3', label: 'View' }, { num: '4', label: 'Edit' },
            { num: '5', label: 'Copy' }, { num: '6', label: 'Move' },
            { num: '7', label: 'Mkdir' }, { num: '8', label: 'Del' },
            { num: '9', label: 'Conf' }, { num: '10', label: 'Quit' },
        ];

        const totalKeys = keys.length;
        const slotWidth = Math.floor(width / totalKeys);
        let col = startCol;

        for (let i = 0; i < totalKeys; i++) {
            const k = keys[i];
            const isLast = i === totalKeys - 1;
            const w = isLast ? width - (col - startCol) : slotWidth;
            if (w <= 0) break;

            out.push(moveTo(fkeyRow, col));
            const numText = ' ' + k.num;
            out.push(applyStyle(theme.fkeyNum.idle) + numText);
            const remaining = Math.max(0, w - numText.length);
            const label = k.label.slice(0, remaining);
            const pad = ' '.repeat(Math.max(0, remaining - label.length));
            out.push(applyStyle(theme.fkeyLabel.idle) + label + pad);

            col += w;
        }

        return out.join('');
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        const listWidth = 16;
        if (fbCol >= 1 && fbCol <= listWidth && fbRow >= 1) {
            const themeIdx = fbRow - 1;
            if (themeIdx >= 0 && themeIdx < this.themes.length) {
                this.cursor = themeIdx;
                this.selectedThemeName = this.themes[this.cursor].themeName;
                this.focusArea = 0;
                this.mouseDownButton = themeIdx;
                return { action: 'consumed' };
            }
        }

        if (fbRow === this.fbHeight - 2) {
            const localCol = fbCol - 1;
            if (localCol >= 0) {
                const idx = this.buttonGroup.hitTestCol(localCol, this.fbWidth - 2);
                if (idx >= 0) {
                    this.buttonGroup.selectedIndex = idx;
                    this.focusArea = 1;
                    this.mouseDownButton = 100 + idx;
                    return { action: 'consumed' };
                }
            }
        }

        return null;
    }

    protected override hitTestButton(fbRow: number, fbCol: number): number {
        const listWidth = 16;
        if (fbCol >= 1 && fbCol <= listWidth && fbRow >= 1) {
            const themeIdx = fbRow - 1;
            if (themeIdx >= 0 && themeIdx < this.themes.length) return themeIdx;
        }
        if (fbRow === this.fbHeight - 2) {
            const localCol = fbCol - 1;
            if (localCol >= 0) {
                const idx = this.buttonGroup.hitTestCol(localCol, this.fbWidth - 2);
                if (idx >= 0) return 100 + idx;
            }
        }
        return -1;
    }

    protected override onButtonConfirm(buttonIndex: number): PopupInputResult {
        if (buttonIndex < 100) {
            this.cursor = buttonIndex;
            this.resultAction = 'ok';
            this.selectedThemeName = this.themes[this.cursor].themeName;
            this.close();
            return { action: 'close', confirm: true };
        }
        return this.confirmButton(buttonIndex - 100);
    }

    override handleMouseScroll(up: boolean): PopupInputResult {
        if (this.focusArea === 0) {
            if (up && this.cursor > 0) {
                this.cursor--;
                this.selectedThemeName = this.themes[this.cursor].themeName;
            } else if (!up && this.cursor < this.themes.length - 1) {
                this.cursor++;
                this.selectedThemeName = this.themes[this.cursor].themeName;
            }
        }
        return { action: 'consumed' };
    }
}
