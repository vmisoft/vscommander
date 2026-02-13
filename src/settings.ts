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
    searchBody: RenderStyle;
    searchInput: RenderStyle;
    searchCursor: RenderStyle;
    driveBody: RenderStyle;
    driveLabel: RenderStyle;
    driveText: RenderStyle;
    driveNumber: RenderStyle;
    confirmBody: RenderStyle;
    confirmButton: RenderStyle;
    dialogBody: RenderStyle;
    dialogInput: RenderStyle;
    dialogInputCursor: RenderStyle;
    dialogLabel: RenderStyle;
    dialogButton: RenderStyle;
    dialogDropdown: RenderStyle;
    dialogHotkey: RenderStyle;
    menuBar: RenderStyle;
    menuBarHotkey: RenderStyle;
    menuItem: RenderStyle;
    menuItemHotkey: RenderStyle;
    menuItemDisabled: RenderStyle;
    menuBorder: RenderStyle;
    selectedFile: RenderStyle;
    selectedDir: RenderStyle;
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
    searchBody: rs(s(BLACK, LIGHT_GRAY)),
    searchInput: rs(s(BLACK, DARK_TEAL)),
    searchCursor: rs(s(ROSE, DARK_TEAL)),
    driveBody: rs(s(AQUA, DARK_TEAL)),
    driveLabel: rs(s(BRIGHT_YELLOW, DARK_TEAL, true), s(BRIGHT_YELLOW, TEAL, true)),
    driveText: rs(s(PURE_WHITE, DARK_TEAL), s(PURE_WHITE, TEAL)),
    driveNumber: rs(s(BRIGHT_YELLOW, DARK_TEAL, true), s(BRIGHT_YELLOW, TEAL, true)),
    confirmBody: rs(s(PURE_WHITE, DARK_RED)),
    confirmButton: rs(s(PURE_WHITE, DARK_RED, true), s(BLACK, LIGHT_GRAY, true)),
    dialogBody: rs(s(BLACK, LIGHT_GRAY, true)),
    dialogInput: rs(s(BLACK, DARK_TEAL, true)),
    dialogInputCursor: rs(s(ROSE, DARK_TEAL, true)),
    dialogLabel: rs(s(BLACK, LIGHT_GRAY, true)),
    dialogButton: rs(s(BLACK, LIGHT_GRAY, true), s(BLACK, DARK_TEAL, true)),
    dialogDropdown: rs(s(PURE_WHITE, BLACK, true), s(BLACK, LIGHT_GRAY, true)),
    dialogHotkey: rs(s(BRIGHT_YELLOW, LIGHT_GRAY, true), s(BRIGHT_YELLOW, DARK_TEAL, true)),
    menuBar: rs(s(BLACK, DARK_TEAL), s(BLACK, LIGHT_GRAY)),
    menuBarHotkey: rs(s(BRIGHT_YELLOW, DARK_TEAL), s(BRIGHT_YELLOW, LIGHT_GRAY)),
    menuItem: rs(s(BLACK, LIGHT_GRAY), s(BLACK, DARK_TEAL)),
    menuItemHotkey: rs(s(BRIGHT_YELLOW, LIGHT_GRAY), s(BRIGHT_YELLOW, DARK_TEAL)),
    menuItemDisabled: rs(s(GREY, LIGHT_GRAY)),
    menuBorder: rs(s(BLACK, LIGHT_GRAY)),
    selectedFile: rs(s(BRIGHT_YELLOW, DARK_BLUE, true), s(BRIGHT_YELLOW, DARK_TEAL, true)),
    selectedDir: rs(s(BRIGHT_YELLOW, DARK_BLUE, true), s(BRIGHT_YELLOW, DARK_TEAL, true)),
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
    searchBody: rs(s(A0, A7)),
    searchInput: rs(s(D, A7)),
    searchCursor: rs(s(A1, A7)),
    driveBody: rs(s(A0, A7)),
    driveLabel: rs(s(A11, A7, true), s(A11, A6, true)),
    driveText: rs(s(A0, A7), s(A0, A6)),
    driveNumber: rs(s(A11, A7, true), s(A11, A6, true)),
    confirmBody: rs(s(A15, A1)),
    confirmButton: rs(s(A15, A1, true), s(A0, A7, true)),
    dialogBody: rs(s(A0, A7, true)),
    dialogInput: rs(s(A0, A6, true)),
    dialogInputCursor: rs(s(A1, A6, true)),
    dialogLabel: rs(s(A0, A7, true)),
    dialogButton: rs(s(A0, A7, true), s(A0, A6, true)),
    dialogDropdown: rs(s(A15, A0, true), s(A0, A7, true)),
    dialogHotkey: rs(s(A3, A7, true), s(A3, A6, true)),
    menuBar: rs(s(A0, A6), s(A0, A7)),
    menuBarHotkey: rs(s(A3, A6), s(A3, A7)),
    menuItem: rs(s(A0, A7), s(A0, A6)),
    menuItemHotkey: rs(s(A3, A7), s(A3, A6)),
    menuItemDisabled: rs(s(A8, A7)),
    menuBorder: rs(s(A0, A7)),
    selectedFile: rs(s(A3, D, true), s(A3, A7, true)),
    selectedDir: rs(s(A3, D, true), s(A3, A7, true)),
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
    searchBody: rs(s(A0, A15)),
    searchInput: rs(s(A0, A7)),
    searchCursor: rs(s(A1, A7)),
    driveBody: rs(s(A0, A7)),
    driveLabel: rs(s(A3, A7, true), s(A3, A14, true)),
    driveText: rs(s(A0, A7), s(A0, A14)),
    driveNumber: rs(s(A3, A7, true), s(A3, A14, true)),
    confirmBody: rs(s(A15, A1)),
    confirmButton: rs(s(A15, A1, true), s(A0, A15, true)),
    dialogBody: rs(s(A0, A15, true)),
    dialogInput: rs(s(A0, A14, true)),
    dialogInputCursor: rs(s(A1, A14, true)),
    dialogLabel: rs(s(A0, A15, true)),
    dialogButton: rs(s(A0, A15, true), s(A0, A14, true)),
    dialogDropdown: rs(s(A0, A15, true), s(A15, A0, true)),
    dialogHotkey: rs(s(A3, A15, true), s(A3, A14, true)),
    menuBar: rs(s(A0, A14), s(A0, A15)),
    menuBarHotkey: rs(s(A3, A14), s(A3, A15)),
    menuItem: rs(s(A0, A15), s(A0, A14)),
    menuItemHotkey: rs(s(A3, A15), s(A3, A14)),
    menuItemDisabled: rs(s(A8, A15)),
    menuBorder: rs(s(A0, A15)),
    selectedFile: rs(s(A3, D, true), s(A3, A7, true)),
    selectedDir: rs(s(A3, D, true), s(A3, A7, true)),
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
    sortDirsFirst: boolean;
    panelColumns: number;
    theme: Theme;
    baseTheme: Theme;
    themeName: ThemeName;
    colorOverrides: Record<string, ColorOverride>;
    workspaceDirs: string[];
    toggleKey: string;
    keys: KeyBindings;
}

export const DEFAULT_SETTINGS: PanelSettings = {
    showDotfiles: true,
    clockEnabled: true,
    sortDirsFirst: true,
    panelColumns: 2,
    theme: DEFAULT_THEME,
    baseTheme: DEFAULT_THEME,
    themeName: 'far',
    colorOverrides: {},
    workspaceDirs: [],
    toggleKey: 'Ctrl+O',
    keys: DEFAULT_KEY_BINDINGS,
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
    'fkeyNum', 'fkeyLabel',
    'searchBody', 'searchInput', 'searchCursor',
    'driveBody', 'driveLabel', 'driveText', 'driveNumber',
    'confirmBody', 'confirmButton',
    'dialogBody', 'dialogInput', 'dialogInputCursor', 'dialogLabel',
    'dialogButton', 'dialogDropdown', 'dialogHotkey',
    'menuBar', 'menuBarHotkey', 'menuItem', 'menuItemHotkey',
    'menuItemDisabled', 'menuBorder',
    'selectedFile', 'selectedDir',
];
