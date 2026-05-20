import { Theme, ThemeName, PanelSettings, DEFAULT_SETTINGS, resolveTheme, ColorOverride, applyColorOverrides } from '../../settings';
import { DirEntry } from '../../types';
import { PopupInputResult } from '../../components/popup';
import { ComposedPopup } from '../../components/composedPopup';
import { ButtonGroup } from '../../components/buttonGroup';
import { FrameBuffer } from '../../frameBuffer';
import { Pane } from '../../pane';
import { ConfirmPopup } from '../confirm';
import { CopyMovePopup } from '../copy-move';
import { ThemeChrome, THEME_LIST_WIDTH } from './themeChrome';
import { ThemePreview } from './themePreview';
import {
    KEY_UP, KEY_DOWN, KEY_HOME, KEY_HOME_ALT, KEY_END, KEY_END_ALT,
    KEY_TAB, KEY_SHIFT_TAB, KEY_ENTER, KEY_ESCAPE, KEY_DOUBLE_ESCAPE,
} from '../../keys';

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

export class ThemePopup extends ComposedPopup {
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
    private readonly chrome = new ThemeChrome();
    private readonly preview = new ThemePreview();
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
        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (this.focusArea === 0) {
            if (data === KEY_UP) {
                if (this.cursor > 0) {
                    this.cursor--;
                    this.selectedThemeName = this.themes[this.cursor].themeName;
                }
                return { action: 'consumed' };
            }
            if (data === KEY_DOWN) {
                if (this.cursor < this.themes.length - 1) {
                    this.cursor++;
                    this.selectedThemeName = this.themes[this.cursor].themeName;
                }
                return { action: 'consumed' };
            }
            if (data === KEY_HOME || data === KEY_HOME_ALT) {
                this.cursor = 0;
                this.selectedThemeName = this.themes[this.cursor].themeName;
                return { action: 'consumed' };
            }
            if (data === KEY_END || data === KEY_END_ALT) {
                this.cursor = this.themes.length - 1;
                this.selectedThemeName = this.themes[this.cursor].themeName;
                return { action: 'consumed' };
            }
            if (data === KEY_TAB) {
                this.focusArea = 1;
                return { action: 'consumed' };
            }
            if (data === KEY_ENTER) {
                this.resultAction = 'ok';
                this.selectedThemeName = this.themes[this.cursor].themeName;
                this.close();
                return { action: 'close', confirm: true };
            }
            return { action: 'consumed' };
        }

        if (data === KEY_SHIFT_TAB) {
            this.focusArea = 0;
            return { action: 'consumed' };
        }
        if (data === KEY_UP || data === KEY_DOWN) {
            this.focusArea = 0;
            return this.handleInput(data);
        }
        if (data === KEY_TAB) {
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

        const previewStartCol = THEME_LIST_WIDTH + 2;
        const sepRow = popupHeight - 3;

        const fb = this.chrome.render(theme, popupWidth, popupHeight,
            this.themes.map(t => t.displayName), this.cursor, this.focusArea, this.buttonGroup);
        out.push(fb.toAnsi(this.screenRow, this.screenCol));

        let previewTheme = resolveTheme(this.themes[this.cursor].themeName, this.vscodeThemeKind);
        if (Object.keys(this.colorOverrides).length > 0) {
            previewTheme = applyColorOverrides(previewTheme, this.colorOverrides);
        }
        if (this.mockPane && this.mockConfirm) {
            out.push(this.preview.render(
                { popupTop, popupLeft, popupWidth, previewStartCol, sepRow },
                previewTheme, this.mockPane, this.mockConfirm, this.mockCopy));
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
