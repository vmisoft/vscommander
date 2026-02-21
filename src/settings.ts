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
    'F1': ['\x1bOP'],
    'F2': ['\x1bOQ'],
    'F3': ['\x1bOR'],
    'F4': ['\x1bOS'],
    'F5': ['\x1b[15~'],
    'F6': ['\x1b[17~'],
    'F7': ['\x1b[18~'],
    'F8': ['\x1b[19~'],
    'F9': ['\x1b[20~'],
    'F10': ['\x1b[21~'],
    'Shift+F1': ['\x1b[1;2P'],
    'Shift+F2': ['\x1b[1;2Q'],
    'Shift+F3': ['\x1b[1;2R'],
    'Shift+F4': ['\x1b[1;2S'],
    'Shift+F5': ['\x1b[15;2~'],
    'Shift+F6': ['\x1b[17;2~'],
    'Shift+F7': ['\x1b[18;2~'],
    'Shift+F8': ['\x1b[19;2~'],
    'Shift+F9': ['\x1b[20;2~'],
    'Shift+F10': ['\x1b[21;2~'],
    'Shift+Delete': ['\x1b[3;2~'],
    'Shift+F11': ['\x1b[23;2~'],
    'Shift+F12': ['\x1b[24;2~'],
    'Alt+F1': ['\x1b[1;3P', '\x1b\x1bOP'],
    'Alt+F2': ['\x1b[1;3Q', '\x1b\x1bOQ'],
    'Alt+F3': ['\x1b[1;3R', '\x1b\x1bOR'],
    'Alt+F4': ['\x1b[1;3S', '\x1b\x1bOS'],
    'Alt+F5': ['\x1b[15;3~'],
    'Alt+F6': ['\x1b[17;3~'],
    'Alt+F7': ['\x1b[18;3~'],
    'Alt+F8': ['\x1b[19;3~'],
    'Alt+F9': ['\x1b[20;3~'],
    'Alt+F10': ['\x1b[21;3~'],
    'Ctrl+H': ['\x08'],
    'Ctrl+P': ['\x10'],
    'Alt+Enter': ['\x1b\r'],
    'Ctrl+Left': ['\x1b[1;5D'],
    'Ctrl+Right': ['\x1b[1;5C'],
    'Ctrl+R': ['\x12'],
    'Ctrl+U': ['\x15'],
    'Ctrl+1': ['\x1b[49;5u'],
    'Ctrl+2': ['\x1b[50;5u'],
    'Ctrl+3': ['\x1b[51;5u'],
    'Insert': ['\x1b[2~'],
    'Numpad*': ['\x1bOj'],
    'Numpad+': ['\x1bOk'],
    'Numpad-': ['\x1bOm'],
    'Ctrl+Q': ['\x11'],
    'Ctrl+F12': ['\x1b[24;5~'],
    'Shift+Up': ['\x1b[1;2A'],
    'Shift+Down': ['\x1b[1;2B'],
    'Shift+Right': ['\x1b[1;2C'],
    'Shift+Left': ['\x1b[1;2D'],
    'Shift+PageUp': ['\x1b[5;2~'],
    'Shift+PageDown': ['\x1b[6;2~'],
    'Shift+Home': ['\x1b[1;2H'],
    'Shift+End': ['\x1b[1;2F'],
    'Ctrl+PageUp': ['\x1b[5;5~'],
    'Ctrl+PageDown': ['\x1b[6;5~'],
    'Ctrl+Enter': ['\x1b[13;5u'],
    'Ctrl+[': ['\x1b[91;5u'],
    'Ctrl+]': ['\x1d', '\x1b[93;5u'],
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
    interceptF1: true,
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
    'helpLink',
    'selectedFile', 'selectedDir', 'symlink',
];
