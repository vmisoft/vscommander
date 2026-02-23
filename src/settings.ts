import {
    KEY_F1, KEY_F2, KEY_F3, KEY_F4, KEY_F5, KEY_F6, KEY_F7, KEY_F8, KEY_F9, KEY_F10,
    KEY_SHIFT_F1, KEY_SHIFT_F2, KEY_SHIFT_F3, KEY_SHIFT_F4, KEY_SHIFT_F5,
    KEY_SHIFT_F6, KEY_SHIFT_F7, KEY_SHIFT_F8, KEY_SHIFT_F9, KEY_SHIFT_F10,
    KEY_SHIFT_F11, KEY_SHIFT_F12,
    KEY_ALT_F1, KEY_ALT_F1_ESC, KEY_ALT_F2, KEY_ALT_F2_ESC,
    KEY_ALT_F3, KEY_ALT_F3_ESC, KEY_ALT_F4, KEY_ALT_F4_ESC,
    KEY_ALT_F5, KEY_ALT_F6, KEY_ALT_F7, KEY_ALT_F8, KEY_ALT_F9, KEY_ALT_F10,
    KEY_CTRL_H, KEY_CTRL_P, KEY_CTRL_Q, KEY_CTRL_R, KEY_CTRL_U,
    KEY_ALT_ENTER, KEY_ENTER,
    KEY_CTRL_LEFT, KEY_CTRL_RIGHT, KEY_CTRL_UP, KEY_CTRL_DOWN,
    KEY_CTRL_1, KEY_CTRL_2, KEY_CTRL_3,
    KEY_INSERT, KEY_NUMPAD_STAR, KEY_NUMPAD_PLUS, KEY_NUMPAD_MINUS,
    KEY_CTRL_F12,
    KEY_SHIFT_UP, KEY_SHIFT_DOWN, KEY_SHIFT_RIGHT, KEY_SHIFT_LEFT,
    KEY_SHIFT_DELETE, KEY_SHIFT_PAGE_UP, KEY_SHIFT_PAGE_DOWN,
    KEY_SHIFT_HOME, KEY_SHIFT_END,
    KEY_CTRL_PAGE_UP, KEY_CTRL_PAGE_DOWN, KEY_CTRL_ENTER, KEY_CTRL_HOME, KEY_CTRL_END,
    KEY_CTRL_BRACKET_LEFT, KEY_CTRL_BRACKET_RIGHT, KEY_CTRL_BRACKET_RIGHT_ALT,
    KEY_DELETE,
} from './keys';

export interface TextStyle {
    fg: string;
    bg: string;
    bold: boolean;
    dim?: boolean;
}

export interface RenderStyle {
    idle: TextStyle;
    selected: TextStyle;
}

function s(fg: string, bg: string, bold: boolean = false): TextStyle {
    return { fg, bg, bold };
}

function rs(idle: TextStyle, selected?: TextStyle): RenderStyle {
    return { idle, selected: selected ?? idle };
}

export interface Theme {
    border: RenderStyle;
    directory: RenderStyle;
    file: RenderStyle;
    hiddenDir: RenderStyle;
    hiddenFile: RenderStyle;
    activePath: RenderStyle;
    inactivePath: RenderStyle;
    header: RenderStyle;
    info: RenderStyle;
    status: RenderStyle;
    commandLine: RenderStyle;
    commandLineBusy: RenderStyle;
    clock: RenderStyle;
    fkeyNum: RenderStyle;
    fkeyLabel: RenderStyle;
    fkeyLabelInactive: RenderStyle;
    searchBody: RenderStyle;
    searchInput: RenderStyle;
    searchCursor: RenderStyle;
    popupInfoBody: RenderStyle;
    popupInfoInput: RenderStyle;
    popupInfoInputCursor: RenderStyle;
    popupInfoLabel: RenderStyle;
    popupInfoButton: RenderStyle;
    popupInfoDropdown: RenderStyle;
    popupInfoHotkey: RenderStyle;
    popupWarningBody: RenderStyle;
    popupWarningButton: RenderStyle;
    popupActionBody: RenderStyle;
    popupActionLabel: RenderStyle;
    popupActionText: RenderStyle;
    popupActionNumber: RenderStyle;
    menuBar: RenderStyle;
    menuBarHotkey: RenderStyle;
    menuItem: RenderStyle;
    menuItemHotkey: RenderStyle;
    menuItemDisabled: RenderStyle;
    menuBorder: RenderStyle;
    helpBody: RenderStyle;
    helpBold: RenderStyle;
    helpLink: RenderStyle;
    selectedFile: RenderStyle;
    selectedDir: RenderStyle;
    symlink: RenderStyle;
}

const BLACK = '000000';
const DARK_BLUE = '000080';
const DARK_TEAL = '008080';
const TEAL = '00a0a0';
const AQUA = '00ffff';
const PURE_WHITE = 'ffffff';
const LIGHT_GREY = 'cccccc';
const GREY = '7a8080';
const LIGHT_GRAY = 'c0c0c0';
const YELLOW = 'c8c81c';
const BRIGHT_YELLOW = 'ffff00';
const ROSE = 'ff7f7f';
const DARK_RED = '800000';

export const DEFAULT_THEME: Theme = {
    border: rs(s(AQUA, DARK_BLUE)),
    directory: rs(s(PURE_WHITE, DARK_BLUE, true), s(PURE_WHITE, DARK_TEAL, true)),
    file: rs(s(AQUA, DARK_BLUE), s(BLACK, DARK_TEAL)),
    hiddenDir: rs(s(DARK_TEAL, DARK_BLUE, true), s(GREY, DARK_TEAL, true)),
    hiddenFile: rs(s(DARK_TEAL, DARK_BLUE), s(GREY, DARK_TEAL)),
    activePath: rs(s(BLACK, DARK_TEAL, true)),
    inactivePath: rs(s(AQUA, DARK_BLUE)),
    header: rs(s(YELLOW, DARK_BLUE, true)),
    info: rs(s(AQUA, DARK_BLUE)),
    status: rs(s(AQUA, DARK_BLUE)),
    commandLine: rs(s(LIGHT_GREY, BLACK)),
    commandLineBusy: rs(s(YELLOW, BLACK)),
    clock: rs(s(BLACK, DARK_TEAL)),
    fkeyNum: rs(s(PURE_WHITE, BLACK)),
    fkeyLabel: rs(s(BLACK, DARK_TEAL)),
    fkeyLabelInactive: rs(s(GREY, DARK_TEAL)),
    searchBody: rs(s(BLACK, LIGHT_GRAY)),
    searchInput: rs(s(BLACK, DARK_TEAL)),
    searchCursor: rs(s(ROSE, DARK_TEAL)),
    popupInfoBody: rs(s(BLACK, LIGHT_GRAY, true)),
    popupInfoInput: rs(s(BLACK, DARK_TEAL, true)),
    popupInfoInputCursor: rs(s(ROSE, DARK_TEAL, true)),
    popupInfoLabel: rs(s(BLACK, LIGHT_GRAY, true)),
    popupInfoButton: rs(s(BLACK, LIGHT_GRAY, true), s(BLACK, DARK_TEAL, true)),
    popupInfoDropdown: rs(s(PURE_WHITE, BLACK, true), s(BLACK, LIGHT_GRAY, true)),
    popupInfoHotkey: rs(s(BRIGHT_YELLOW, LIGHT_GRAY, true), s(BRIGHT_YELLOW, DARK_TEAL, true)),
    popupWarningBody: rs(s(PURE_WHITE, DARK_RED)),
    popupWarningButton: rs(s(PURE_WHITE, DARK_RED, true), s(BLACK, LIGHT_GRAY, true)),
    popupActionBody: rs(s(PURE_WHITE, DARK_TEAL)),
    popupActionLabel: rs(s(BRIGHT_YELLOW, DARK_TEAL, true), s(BRIGHT_YELLOW, TEAL, true)),
    popupActionText: rs(s(PURE_WHITE, DARK_TEAL), s(PURE_WHITE, TEAL)),
    popupActionNumber: rs(s(BRIGHT_YELLOW, DARK_TEAL, true), s(BRIGHT_YELLOW, TEAL, true)),
    menuBar: rs(s(BLACK, DARK_TEAL), s(BLACK, LIGHT_GRAY)),
    menuBarHotkey: rs(s(BRIGHT_YELLOW, DARK_TEAL), s(BRIGHT_YELLOW, LIGHT_GRAY)),
    menuItem: rs(s(PURE_WHITE, DARK_TEAL), s(PURE_WHITE, TEAL)),
    menuItemHotkey: rs(s(BRIGHT_YELLOW, DARK_TEAL, true), s(BRIGHT_YELLOW, TEAL, true)),
    menuItemDisabled: rs(s(GREY, DARK_TEAL)),
    menuBorder: rs(s(PURE_WHITE, DARK_TEAL)),
    helpBody: rs(s(BLACK, DARK_TEAL)),
    helpBold: rs(s(PURE_WHITE, DARK_TEAL, true)),
    helpLink: rs(s(BRIGHT_YELLOW, DARK_TEAL), s(PURE_WHITE, BLACK)),
    selectedFile: rs(s(BRIGHT_YELLOW, DARK_BLUE, true), s(BRIGHT_YELLOW, DARK_TEAL, true)),
    selectedDir: rs(s(BRIGHT_YELLOW, DARK_BLUE, true), s(BRIGHT_YELLOW, DARK_TEAL, true)),
    symlink: rs(s(BRIGHT_YELLOW, DARK_BLUE), s(BRIGHT_YELLOW, DARK_TEAL)),
};

export type ThemeName = 'far' | 'vscode';

// ANSI color indices — resolved by VS Code terminal to the active theme's terminal.ansi* tokens
// @0=Black @1=Red @2=Green @3=Yellow @4=Blue @5=Magenta @6=Cyan @7=White
// @8=BrightBlack @9=BrightRed @10=BrightGreen @11=BrightYellow @12=BrightBlue
// @13=BrightMagenta @14=BrightCyan @15=BrightWhite @d=terminal default fg/bg
const D = '@d';   // terminal default (editor.background / editor.foreground)
const A0 = '@0';   // terminal.ansiBlack
const A1 = '@1';   // terminal.ansiRed
const A3 = '@3';   // terminal.ansiYellow
const A4 = '@4';   // terminal.ansiBlue
const A6 = '@6';   // terminal.ansiCyan
const A7 = '@7';   // terminal.ansiWhite
const A8 = '@8';   // terminal.ansiBrightBlack
const A11 = '@11'; // terminal.ansiBrightYellow
const A12 = '@12'; // terminal.ansiBrightBlue
const A14 = '@14'; // terminal.ansiBrightCyan
const A15 = '@15'; // terminal.ansiBrightWhite

export const VSCODE_DARK_THEME: Theme = {
    border: rs(s(A8, D)),
    directory: rs(s(A12, D, true), s(A12, A7, true)),
    file: rs(s(D, D), s(D, A7)),
    hiddenDir: rs(s(A8, D, true), s(A8, A7, true)),
    hiddenFile: rs(s(A8, D), s(A8, A7)),
    activePath: rs(s(A0, A7, true)),
    inactivePath: rs(s(D, D)),
    header: rs(s(A14, D, true)),
    info: rs(s(D, D)),
    status: rs(s(D, D)),
    commandLine: rs(s(D, D)),
    commandLineBusy: rs(s(A3, D)),
    clock: rs(s(A0, A7)),
    fkeyNum: rs(s(A15, D)),
    fkeyLabel: rs(s(A0, A8)),
    fkeyLabelInactive: rs({ fg: A0, bg: A8, bold: false, dim: true }),
    searchBody: rs(s(A0, A7)),
    searchInput: rs(s(D, A7)),
    searchCursor: rs(s(A1, A7)),
    popupInfoBody: rs(s(A0, A7, true)),
    popupInfoInput: rs(s(A0, A6, true)),
    popupInfoInputCursor: rs(s(A1, A6, true)),
    popupInfoLabel: rs(s(A0, A7, true)),
    popupInfoButton: rs(s(A0, A7, true), s(A0, A6, true)),
    popupInfoDropdown: rs(s(A15, A0, true), s(A0, A7, true)),
    popupInfoHotkey: rs(s(A3, A7, true), s(A3, A6, true)),
    popupWarningBody: rs(s(A15, A1)),
    popupWarningButton: rs(s(A15, A1, true), s(A0, A7, true)),
    popupActionBody: rs(s(A0, A7)),
    popupActionLabel: rs(s(A11, A7, true), s(A11, A6, true)),
    popupActionText: rs(s(A0, A7), s(A0, A6)),
    popupActionNumber: rs(s(A11, A7, true), s(A11, A6, true)),
    menuBar: rs(s(A0, A6), s(A0, A7)),
    menuBarHotkey: rs(s(A3, A6), s(A3, A7)),
    menuItem: rs(s(A0, A6), s(A0, A7)),
    menuItemHotkey: rs(s(A11, A6, true), s(A11, A7, true)),
    menuItemDisabled: rs(s(A8, A6)),
    menuBorder: rs(s(A0, A6)),
    helpBody: rs(s(A0, A7)),
    helpBold: rs(s(A11, A7, true)),
    helpLink: rs(s(D, D), s(D, D, true)),
    selectedFile: rs(s(A3, D, true), s(A3, A7, true)),
    selectedDir: rs(s(A3, D, true), s(A3, A7, true)),
    symlink: rs(s(A11, D), s(A11, A7)),
};

export const VSCODE_LIGHT_THEME: Theme = {
    border: rs(s(A7, D)),
    directory: rs(s(A4, D, true), s(A4, A7, true)),
    file: rs(s(D, D), s(D, A7)),
    hiddenDir: rs(s(A7, D, true), s(A7, A7, true)),
    hiddenFile: rs(s(A7, D), s(A7, A7)),
    activePath: rs(s(A0, A7, true)),
    inactivePath: rs(s(D, D)),
    header: rs(s(A4, D, true)),
    info: rs(s(D, D)),
    status: rs(s(D, D)),
    commandLine: rs(s(D, D)),
    commandLineBusy: rs(s(A3, D)),
    clock: rs(s(A15, A7)),
    fkeyNum: rs(s(D, D)),
    fkeyLabel: rs(s(D, A7)),
    fkeyLabelInactive: rs(s(A8, A7)),
    searchBody: rs(s(A0, A15)),
    searchInput: rs(s(A0, A7)),
    searchCursor: rs(s(A1, A7)),
    popupInfoBody: rs(s(A0, A15, true)),
    popupInfoInput: rs(s(A0, A14, true)),
    popupInfoInputCursor: rs(s(A1, A14, true)),
    popupInfoLabel: rs(s(A0, A15, true)),
    popupInfoButton: rs(s(A0, A15, true), s(A0, A14, true)),
    popupInfoDropdown: rs(s(A0, A15, true), s(A15, A0, true)),
    popupInfoHotkey: rs(s(A3, A15, true), s(A3, A14, true)),
    popupWarningBody: rs(s(A15, A1)),
    popupWarningButton: rs(s(A15, A1, true), s(A0, A15, true)),
    popupActionBody: rs(s(A0, A7)),
    popupActionLabel: rs(s(A3, A7, true), s(A3, A14, true)),
    popupActionText: rs(s(A0, A7), s(A0, A14)),
    popupActionNumber: rs(s(A3, A7, true), s(A3, A14, true)),
    menuBar: rs(s(A0, A14), s(A0, A15)),
    menuBarHotkey: rs(s(A3, A14), s(A3, A15)),
    menuItem: rs(s(A0, A14), s(A0, A15)),
    menuItemHotkey: rs(s(A3, A14, true), s(A3, A15, true)),
    menuItemDisabled: rs(s(A8, A14)),
    menuBorder: rs(s(A0, A14)),
    helpBody: rs(s(A0, A7)),
    helpBold: rs(s(A3, A7, true)),
    helpLink: rs(s(D, D), s(D, D, true)),
    selectedFile: rs(s(A3, D, true), s(A3, A7, true)),
    selectedDir: rs(s(A3, D, true), s(A3, A7, true)),
    symlink: rs(s(A3, D), s(A3, A7)),
};

// vscodeThemeKind: 1=Light, 2=Dark, 3=HighContrast, 4=HighContrastLight
export function resolveTheme(name: ThemeName, vscodeThemeKind: number): Theme {
    if (name === 'far') return DEFAULT_THEME;
    return (vscodeThemeKind === 1 || vscodeThemeKind === 4)
        ? VSCODE_LIGHT_THEME : VSCODE_DARK_THEME;
}

export interface ColorOverride {
    fg?: string;
    bg?: string;
    bold?: boolean;
    selectedFg?: string;
    selectedBg?: string;
    selectedBold?: boolean;
}

export function applyColorOverrides(base: Theme, overrides: Record<string, ColorOverride>): Theme {
    const result: Record<string, RenderStyle> = {};
    for (const key of Object.keys(base) as (keyof Theme)[]) {
        const bs = base[key];
        const o = overrides[key];
        if (!o || Object.keys(o).length === 0) {
            result[key] = bs;
            continue;
        }
        result[key] = {
            idle: {
                fg: o.fg ?? bs.idle.fg,
                bg: o.bg ?? bs.idle.bg,
                bold: o.bold ?? bs.idle.bold,
            },
            selected: {
                fg: o.selectedFg ?? o.fg ?? bs.selected.fg,
                bg: o.selectedBg ?? o.bg ?? bs.selected.bg,
                bold: o.selectedBold ?? o.bold ?? bs.selected.bold,
            },
        };
    }
    return result as unknown as Theme;
}

export interface KeyBindings {
    help: string;
    userMenu: string;
    view: string;
    edit: string;
    copy: string;
    move: string;
    mkdir: string;
    delete: string;
    forceDelete: string;
    quit: string;
    menu: string;
    driveLeft: string;
    driveRight: string;
    toggleDotfiles: string;
    togglePane: string;
    detach: string;
    resizeLeft: string;
    resizeRight: string;
    quickView: string;
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
    help: 'F1',
    userMenu: 'F2',
    view: 'F3',
    edit: 'F4',
    copy: 'F5',
    move: 'F6',
    mkdir: 'F7',
    delete: 'F8',
    forceDelete: 'Shift+F8',
    quit: 'F10',
    menu: 'F9',
    driveLeft: 'Alt+F1',
    driveRight: 'Alt+F2',
    toggleDotfiles: 'Ctrl+H',
    togglePane: 'Ctrl+P',
    detach: 'Alt+Enter',
    resizeLeft: 'Ctrl+Left',
    resizeRight: 'Ctrl+Right',
    quickView: 'Ctrl+Q',
};

const KEY_SEQUENCES: Record<string, string[]> = {
    'F1': [KEY_F1],
    'F2': [KEY_F2],
    'F3': [KEY_F3],
    'F4': [KEY_F4],
    'F5': [KEY_F5],
    'F6': [KEY_F6],
    'F7': [KEY_F7],
    'F8': [KEY_F8],
    'F9': [KEY_F9],
    'F10': [KEY_F10],
    'Shift+F1': [KEY_SHIFT_F1],
    'Shift+F2': [KEY_SHIFT_F2],
    'Shift+F3': [KEY_SHIFT_F3],
    'Shift+F4': [KEY_SHIFT_F4],
    'Shift+F5': [KEY_SHIFT_F5],
    'Shift+F6': [KEY_SHIFT_F6],
    'Shift+F7': [KEY_SHIFT_F7],
    'Shift+F8': [KEY_SHIFT_F8],
    'Shift+F9': [KEY_SHIFT_F9],
    'Shift+F10': [KEY_SHIFT_F10],
    'Shift+Delete': [KEY_SHIFT_DELETE],
    'Shift+F11': [KEY_SHIFT_F11],
    'Shift+F12': [KEY_SHIFT_F12],
    'Alt+F1': [KEY_ALT_F1, KEY_ALT_F1_ESC],
    'Alt+F2': [KEY_ALT_F2, KEY_ALT_F2_ESC],
    'Alt+F3': [KEY_ALT_F3, KEY_ALT_F3_ESC],
    'Alt+F4': [KEY_ALT_F4, KEY_ALT_F4_ESC],
    'Alt+F5': [KEY_ALT_F5],
    'Alt+F6': [KEY_ALT_F6],
    'Alt+F7': [KEY_ALT_F7],
    'Alt+F8': [KEY_ALT_F8],
    'Alt+F9': [KEY_ALT_F9],
    'Alt+F10': [KEY_ALT_F10],
    'Ctrl+H': [KEY_CTRL_H],
    'Ctrl+P': [KEY_CTRL_P],
    'Alt+Enter': [KEY_ALT_ENTER],
    'Ctrl+Left': [KEY_CTRL_LEFT],
    'Ctrl+Right': [KEY_CTRL_RIGHT],
    'Ctrl+Up': [KEY_CTRL_UP],
    'Ctrl+Down': [KEY_CTRL_DOWN],
    'Ctrl+R': [KEY_CTRL_R],
    'Ctrl+U': [KEY_CTRL_U],
    'Ctrl+1': [KEY_CTRL_1],
    'Ctrl+2': [KEY_CTRL_2],
    'Ctrl+3': [KEY_CTRL_3],
    'Insert': [KEY_INSERT],
    'Numpad*': [KEY_NUMPAD_STAR],
    'Numpad+': [KEY_NUMPAD_PLUS],
    'Numpad-': [KEY_NUMPAD_MINUS],
    'Ctrl+Q': [KEY_CTRL_Q],
    'Ctrl+F12': [KEY_CTRL_F12],
    'Shift+Up': [KEY_SHIFT_UP],
    'Shift+Down': [KEY_SHIFT_DOWN],
    'Shift+Right': [KEY_SHIFT_RIGHT],
    'Shift+Left': [KEY_SHIFT_LEFT],
    'Shift+PageUp': [KEY_SHIFT_PAGE_UP],
    'Shift+PageDown': [KEY_SHIFT_PAGE_DOWN],
    'Shift+Home': [KEY_SHIFT_HOME],
    'Shift+End': [KEY_SHIFT_END],
    'Ctrl+PageUp': [KEY_CTRL_PAGE_UP],
    'Ctrl+PageDown': [KEY_CTRL_PAGE_DOWN],
    'Ctrl+Home': [KEY_CTRL_HOME],
    'Ctrl+End': [KEY_CTRL_END],
    'Ctrl+Enter': [KEY_CTRL_ENTER],
    'Ctrl+[': [KEY_CTRL_BRACKET_LEFT],
    'Ctrl+]': [KEY_CTRL_BRACKET_RIGHT, KEY_CTRL_BRACKET_RIGHT_ALT],
};

export function matchesKeyBinding(data: string, keyName: string): boolean {
    const sequences = KEY_SEQUENCES[keyName];
    return sequences !== undefined && sequences.includes(data);
}

export function getFKeyNumber(keyName: string): number | undefined {
    const match = keyName.match(/^F(\d+)$/);
    return match ? parseInt(match[1], 10) : undefined;
}

export interface PanelSettings {
    showDotfiles: boolean;
    clockEnabled: boolean;
    sortMode: string;
    sortReversed: boolean;
    sortDirsFirst: boolean;
    useSortGroups: boolean;
    panelColumns: number;
    interceptF1: boolean;
    theme: Theme;
    baseTheme: Theme;
    themeName: ThemeName;
    colorOverrides: Record<string, ColorOverride>;
    workspaceDirs: string[];
    toggleKey: string;
    keys: KeyBindings;
    vscodeThemeKind: number;
    remoteName: string;
    settingsInScopes: { user: boolean; workspace: boolean };
}

export const DEFAULT_SETTINGS: PanelSettings = {
    showDotfiles: true,
    clockEnabled: true,
    sortMode: 'name',
    sortReversed: false,
    sortDirsFirst: true,
    useSortGroups: false,
    panelColumns: 2,
    interceptF1: false,
    theme: DEFAULT_THEME,
    baseTheme: DEFAULT_THEME,
    themeName: 'far',
    colorOverrides: {},
    workspaceDirs: [],
    toggleKey: 'Ctrl+O',
    keys: DEFAULT_KEY_BINDINGS,
    vscodeThemeKind: 2,
    remoteName: '',
    settingsInScopes: { user: false, workspace: false },
};

export function mergeSettings(overrides: Partial<PanelSettings>): PanelSettings {
    return {
        ...DEFAULT_SETTINGS,
        ...overrides,
        keys: { ...DEFAULT_KEY_BINDINGS, ...(overrides.keys || {}) },
    };
}

export function themeToOverrides(theme: Theme): Record<string, ColorOverride> {
    const result: Record<string, ColorOverride> = {};
    for (const key of Object.keys(theme) as (keyof Theme)[]) {
        const rs = theme[key];
        result[key] = {
            fg: rs.idle.fg,
            bg: rs.idle.bg,
            bold: rs.idle.bold,
            selectedFg: rs.selected.fg,
            selectedBg: rs.selected.bg,
            selectedBold: rs.selected.bold,
        };
    }
    return result;
}

export const THEME_KEYS: (keyof Theme)[] = [
    'border', 'directory', 'file', 'hiddenDir', 'hiddenFile',
    'activePath', 'inactivePath', 'header', 'info', 'status',
    'commandLine', 'commandLineBusy', 'clock',
    'fkeyNum', 'fkeyLabel', 'fkeyLabelInactive',
    'searchBody', 'searchInput', 'searchCursor',
    'popupInfoBody', 'popupInfoInput', 'popupInfoInputCursor', 'popupInfoLabel',
    'popupInfoButton', 'popupInfoDropdown', 'popupInfoHotkey',
    'popupWarningBody', 'popupWarningButton',
    'popupActionBody', 'popupActionLabel', 'popupActionText', 'popupActionNumber',
    'menuBar', 'menuBarHotkey', 'menuItem', 'menuItemHotkey',
    'menuItemDisabled', 'menuBorder',
    'helpBody', 'helpBold', 'helpLink',
    'selectedFile', 'selectedDir', 'symlink',
];
