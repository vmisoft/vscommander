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
    return '\x1b[?1049h';
}

export function leaveAltScreen(): string {
    return '\x1b[?1049l';
}

export function enableMouse(): string {
    return '\x1b[?1002h\x1b[?1006h';
}

export function disableMouse(): string {
    return '\x1b[?1006l\x1b[?1002l';
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
