// Low-level ANSI drawing primitives

export const ESC = '\x1b[';

export function moveTo(row: number, col: number): string {
    return `${ESC}${row};${col}H`;
}

export function clearScreen(): string {
    return `${ESC}2J`;
}

export function hideCursor(): string {
    return `${ESC}?25l`;
}

export function showCursor(): string {
    return `${ESC}?25h`;
}

export function enterAltScreen(): string {
    return ESC + '?1049h';
}

export function leaveAltScreen(): string {
    return ESC + '?1049l';
}

export function enableMouse(): string {
    return ESC + '?1002h' + ESC + '?1006h';
}

export function disableMouse(): string {
    return ESC + '?1006l' + ESC + '?1002l';
}

export function sgr(code: number): string {
    return `${ESC}${code}m`;
}

export function resetStyle(): string {
    return sgr(0);
}

export function bold(): string {
    return sgr(1);
}

export function fg(color: number): string {
    return sgr(color);
}

export function bg(color: number): string {
    return sgr(color);
}

// 256-color foreground/background
export function fg256(n: number): string {
    return `${ESC}38;5;${n}m`;
}

export function bg256(n: number): string {
    return `${ESC}48;5;${n}m`;
}

export function dim(): string {
    return sgr(2);
}

export function fgRgb(hex: string): string {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${ESC}38;2;${r};${g};${b}m`;
}

export function bgRgb(hex: string): string {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${ESC}48;2;${r};${g};${b}m`;
}

// Color string that supports both hex ('ff0000') and ANSI index ('@0'-'@15', '@d' for default)
export function fgColor(c: string): string {
    if (c.charCodeAt(0) !== 0x40) return fgRgb(c); // not '@'
    const idx = c.slice(1);
    if (idx === 'd') return `${ESC}39m`;
    const n = parseInt(idx, 10);
    return n < 8 ? `${ESC}${30 + n}m` : `${ESC}${90 + n - 8}m`;
}

export function bgColor(c: string): string {
    if (c.charCodeAt(0) !== 0x40) return bgRgb(c); // not '@'
    const idx = c.slice(1);
    if (idx === 'd') return `${ESC}49m`;
    const n = parseInt(idx, 10);
    return n < 8 ? `${ESC}${40 + n}m` : `${ESC}${100 + n - 8}m`;
}

// Box-drawing characters — single line (Unicode)
export const BOX = {
    topLeft: '\u250c',
    topRight: '\u2510',
    bottomLeft: '\u2514',
    bottomRight: '\u2518',
    horizontal: '\u2500',
    vertical: '\u2502',
    teeLeft: '\u2524',
    teeRight: '\u251c',
    teeUp: '\u2534',
};

// Box-drawing characters — double line
export const DBOX = {
    topLeft: '\u2554',     // ╔
    topRight: '\u2557',    // ╗
    bottomLeft: '\u255a',  // ╚
    bottomRight: '\u255d', // ╝
    horizontal: '\u2550',  // ═
    vertical: '\u2551',    // ║
    teeDown: '\u2566',     // ╦
    teeUp: '\u2569',       // ╩
};

// Mixed junction characters (double-to-single transitions)
export const MBOX = {
    vertDoubleRight: '\u255f',  // ╟ (double vertical, single right)
    vertDoubleLeft: '\u2562',   // ╢ (double vertical, single left)
    horizDoubleDown: '\u2568',  // ╨ (double vertical down from single horizontal)
};

export function drawBox(top: number, left: number, width: number, height: number): string {
    const lines: string[] = [];

    // Top border
    lines.push(
        moveTo(top, left) +
        BOX.topLeft +
        BOX.horizontal.repeat(width - 2) +
        BOX.topRight
    );

    // Side borders
    for (let r = 1; r < height - 1; r++) {
        lines.push(
            moveTo(top + r, left) +
            BOX.vertical +
            ' '.repeat(width - 2) +
            BOX.vertical
        );
    }

    // Bottom border
    lines.push(
        moveTo(top + height - 1, left) +
        BOX.bottomLeft +
        BOX.horizontal.repeat(width - 2) +
        BOX.bottomRight
    );

    return lines.join('');
}

export function drawText(row: number, col: number, text: string, maxWidth?: number): string {
    const truncated = maxWidth ? text.slice(0, maxWidth) : text;
    return moveTo(row, col) + truncated;
}

export function drawHLine(row: number, col: number, width: number): string {
    return moveTo(row, col) + BOX.horizontal.repeat(width);
}

export function fillRect(top: number, left: number, width: number, height: number, ch: string = ' '): string {
    const lines: string[] = [];
    const fill = ch.repeat(width);
    for (let r = 0; r < height; r++) {
        lines.push(moveTo(top + r, left) + fill);
    }
    return lines.join('');
}

// Byte-to-Unicode mapping for binary file display, matching Far Manager.
// 0x00-0x1F: CP437 symbol glyphs (safe Unicode equivalents of control chars)
// 0x20-0x7E: standard ASCII
// 0x7F: CP437 house character
// 0x80-0xFF: Windows-1252 (system ANSI code page)
const BINARY_LOW: string[] = [
    // 0x00-0x0F: CP437 control character symbols
    ' ', '\u263A', '\u263B', '\u2665', '\u2666', '\u2663', '\u2660', '\u2022',
    '\u25D8', '\u25CB', '\u25D9', '\u2642', '\u2640', '\u266A', '\u266B', '\u263C',
    // 0x10-0x1F: CP437 control character symbols
    '\u25BA', '\u25C4', '\u2195', '\u203C', '\u00B6', '\u00A7', '\u25AC', '\u21A8',
    '\u2191', '\u2193', '\u2192', '\u2190', '\u221F', '\u2194', '\u25B2', '\u25BC',
];

// Windows-1252 mapping for 0x80-0x9F (differs from Latin-1 which has
// control characters here; 0xA0-0xFF are identical to Unicode U+00A0-U+00FF)
const W1252_80_9F: string[] = [
    // 0x80-0x8F
    '\u20AC', '\u00B7', '\u201A', '\u0192', '\u201E', '\u2026', '\u2020', '\u2021',
    '\u02C6', '\u2030', '\u0160', '\u2039', '\u0152', '\u00B7', '\u017D', '\u00B7',
    // 0x90-0x9F
    '\u00B7', '\u2018', '\u2019', '\u201C', '\u201D', '\u2022', '\u2013', '\u2014',
    '\u02DC', '\u2122', '\u0161', '\u203A', '\u0153', '\u00B7', '\u017E', '\u0178',
];

export function byteToChar(byte: number): string {
    if (byte < 0x20) return BINARY_LOW[byte];
    if (byte === 0x7f) return '\u2302';
    if (byte >= 0x80 && byte <= 0x9f) return W1252_80_9F[byte - 0x80];
    if (byte >= 0xa0) return String.fromCharCode(byte); // Latin-1 = Unicode
    return String.fromCharCode(byte); // 0x20-0x7E ASCII
}
