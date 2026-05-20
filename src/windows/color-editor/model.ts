// Data model and layout constants for the color editor window, shared by
// index.ts and its component files.

export interface ElementDef {
    key: string;
    label: string;
    isGroup: boolean;
}

export const ELEMENT_DEFS: ElementDef[] = [
    { key: '', label: 'Panel', isGroup: true },
    { key: 'border', label: 'Border', isGroup: false },
    { key: 'directory', label: 'Directory', isGroup: false },
    { key: 'file', label: 'File', isGroup: false },
    { key: 'hiddenDir', label: 'Hidden dir', isGroup: false },
    { key: 'hiddenFile', label: 'Hidden file', isGroup: false },
    { key: 'activePath', label: 'Active path', isGroup: false },
    { key: 'inactivePath', label: 'Inactive path', isGroup: false },
    { key: 'header', label: 'Header', isGroup: false },
    { key: 'info', label: 'Info', isGroup: false },
    { key: 'status', label: 'Status', isGroup: false },
    { key: 'selectedFile', label: 'Selected file', isGroup: false },
    { key: 'selectedDir', label: 'Selected dir', isGroup: false },
    { key: 'symlink', label: 'Symlink arrow', isGroup: false },
    { key: '', label: 'Command line', isGroup: true },
    { key: 'commandLine', label: 'Command line', isGroup: false },
    { key: 'commandLineBusy', label: 'Busy', isGroup: false },
    { key: 'clock', label: 'Clock', isGroup: false },
    { key: 'fkeyNum', label: 'FKey number', isGroup: false },
    { key: 'fkeyLabel', label: 'FKey label', isGroup: false },
    { key: 'fkeyLabelInactive', label: 'FKey inactive', isGroup: false },
    { key: '', label: 'Search', isGroup: true },
    { key: 'searchBody', label: 'Body', isGroup: false },
    { key: 'searchInput', label: 'Input', isGroup: false },
    { key: 'searchCursor', label: 'Cursor', isGroup: false },
    { key: '', label: 'Drive popup', isGroup: true },
    { key: 'driveBody', label: 'Body', isGroup: false },
    { key: 'driveLabel', label: 'Label', isGroup: false },
    { key: 'driveText', label: 'Text', isGroup: false },
    { key: 'driveNumber', label: 'Number', isGroup: false },
    { key: '', label: 'Dialogs', isGroup: true },
    { key: 'confirmBody', label: 'Confirm body', isGroup: false },
    { key: 'confirmButton', label: 'Confirm button', isGroup: false },
    { key: 'dialogBody', label: 'Dialog body', isGroup: false },
    { key: 'dialogInput', label: 'Dialog input', isGroup: false },
    { key: 'dialogInputCursor', label: 'Input cursor', isGroup: false },
    { key: 'dialogLabel', label: 'Dialog label', isGroup: false },
    { key: 'dialogButton', label: 'Dialog button', isGroup: false },
    { key: 'dialogDropdown', label: 'Dropdown', isGroup: false },
    { key: 'dialogHotkey', label: 'Hotkey', isGroup: false },
    { key: '', label: 'Menu', isGroup: true },
    { key: 'menuBar', label: 'Menu bar', isGroup: false },
    { key: 'menuBarHotkey', label: 'Bar hotkey', isGroup: false },
    { key: 'menuItem', label: 'Menu item', isGroup: false },
    { key: 'menuItemHotkey', label: 'Item hotkey', isGroup: false },
    { key: 'menuItemDisabled', label: 'Disabled item', isGroup: false },
    { key: 'menuBorder', label: 'Menu border', isGroup: false },
];

export const ANSI_PALETTE: string[] = [
    '@0', '@1', '@2', '@3', '@4', '@5', '@6', '@7',
    '@8', '@9', '@10', '@11', '@12', '@13', '@14', '@15',
];

export const ANSI_PREVIEW_COLORS: string[] = [
    '000000', '800000', '008000', '808000', '000080', '800080', '008080', 'c0c0c0',
    '808080', 'ff0000', '00ff00', 'ffff00', '0000ff', 'ff00ff', '00ffff', 'ffffff',
];

export const POPUP_WIDTH = 60;
export const LIST_WIDTH = 17;
export const LIST_HEIGHT = 15;
export const CONTENT_HEIGHT = 18;

export const FOCUS_LIST = 0;
export const FOCUS_STATE = 1;
export const FOCUS_FG_GRID = 2;
export const FOCUS_FG_HEX = 3;
export const FOCUS_BG_GRID = 4;
export const FOCUS_BG_HEX = 5;
export const FOCUS_BOLD = 6;
export const FOCUS_BUTTONS = 7;
export const FOCUS_COUNT = 8;

export function isAnsiColor(c: string): boolean {
    return c.charCodeAt(0) === 0x40;
}

export function ansiIndex(c: string): number {
    if (!isAnsiColor(c)) return -1;
    const idx = c.slice(1);
    if (idx === 'd') return 16;
    return parseInt(idx, 10);
}

export function colorFromAnsiIndex(idx: number): string {
    if (idx === 16) return '@d';
    if (idx >= 0 && idx < 16) return ANSI_PALETTE[idx];
    return '@d';
}

export function hexFromColor(c: string): string {
    if (isAnsiColor(c)) return '';
    return c;
}
