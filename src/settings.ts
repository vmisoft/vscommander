export interface TextStyle {
    fg: string;
    bg: string;
    bold: boolean;
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
    confirmButton: rs(s(PURE_WHITE, DARK_RED), s(BLACK, LIGHT_GRAY)),
};

export interface PanelSettings {
    showDotfiles: boolean;
    clockEnabled: boolean;
    sortDirsFirst: boolean;
    panelColumns: number;
    theme: Theme;
    workspaceFolders: string[];
}

export const DEFAULT_SETTINGS: PanelSettings = {
    showDotfiles: true,
    clockEnabled: true,
    sortDirsFirst: true,
    panelColumns: 2,
    theme: DEFAULT_THEME,
    workspaceFolders: [],
};

export function mergeSettings(overrides: Partial<PanelSettings>): PanelSettings {
    return { ...DEFAULT_SETTINGS, ...overrides };
}
