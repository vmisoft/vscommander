import { fgColor, bgColor, bold, dim } from './draw';
import { TextStyle, RenderStyle, Theme } from './settings';
import { DirEntry, PaneGeometry, Layout, PaneStats } from './types';

export function applyStyle(s: TextStyle): string {
    let out = fgColor(s.fg) + bgColor(s.bg) + '\x1b[22m';
    if (s.bold) out += bold();
    if (s.dim) out += dim();
    return out;
}

export function entryRenderStyle(entry: DirEntry, t: Theme, isSelected?: boolean): RenderStyle {
    if (isSelected) {
        return entry.isDir ? t.selectedDir : t.selectedFile;
    }
    const isHidden = entry.name.startsWith('.') && entry.name !== '..';
    if (isHidden) {
        return entry.isDir ? t.hiddenDir : t.hiddenFile;
    }
    return entry.isDir ? t.directory : t.file;
}

export function computePaneGeometry(startCol: number, width: number, numCols: number): PaneGeometry {
    const innerStart = startCol + 1;
    const innerWidth = width - 2;
    let effectiveCols = numCols;
    let contentWidth = innerWidth - (effectiveCols - 1);
    while (effectiveCols > 1 && contentWidth < effectiveCols) {
        effectiveCols--;
        contentWidth = innerWidth - (effectiveCols - 1);
    }

    const baseColWidth = Math.floor(contentWidth / effectiveCols);
    const colWidths: number[] = [];
    const colStarts: number[] = [];
    const dividerCols: number[] = [];

    let pos = innerStart;
    for (let i = 0; i < effectiveCols; i++) {
        colStarts.push(pos);
        const w = i === effectiveCols - 1
            ? contentWidth - baseColWidth * (effectiveCols - 1)
            : baseColWidth;
        colWidths.push(w);
        pos += w;
        if (i < effectiveCols - 1) {
            dividerCols.push(pos);
            pos += 1;
        }
    }

    return { startCol, width, innerStart, innerWidth, numCols: effectiveCols, colStarts, colWidths, dividerCols };
}

export function computeLayout(rows: number, cols: number, numCols: number, leftWidth?: number, leftCols?: number, rightCols?: number): Layout {
    const listHeight = Math.max(1, rows - 7);
    const lCols = Math.max(1, Math.min(3, leftCols ?? numCols));
    const rCols = Math.max(1, Math.min(3, rightCols ?? numCols));
    const lw = leftWidth ?? Math.floor(cols / 2);
    const rightWidth = cols - lw;

    return {
        topRow: 1,
        headerRow: 2,
        listStart: 3,
        listHeight,
        separatorRow: 3 + listHeight,
        infoRow: 4 + listHeight,
        bottomRow: 5 + listHeight,
        cmdRow: rows - 1,
        fkeyRow: rows,
        leftPane: computePaneGeometry(1, lw, lCols),
        rightPane: computePaneGeometry(lw + 1, rightWidth, rCols),
    };
}

export function truncatePath(p: string, maxLen: number): string {
    if (maxLen <= 0) return '';
    if (p.length <= maxLen) return p;
    return '~' + p.slice(p.length - maxLen + 1);
}

export function formatClock(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return h + ':' + m;
}

export function centerText(text: string, width: number): string {
    if (width <= 0) return '';
    if (text.length >= width) return text.slice(0, width);
    const left = Math.floor((width - text.length) / 2);
    const right = width - text.length - left;
    return ' '.repeat(left) + text + ' '.repeat(right);
}

export function formatSizeComma(bytes: number): string {
    const s = String(bytes);
    const parts: string[] = [];
    for (let i = s.length; i > 0; i -= 3) {
        parts.unshift(s.slice(Math.max(0, i - 3), i));
    }
    return parts.join(',');
}

export function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

export function computeStats(entries: DirEntry[]): PaneStats {
    let totalBytes = 0;
    let fileCount = 0;
    let dirCount = 0;
    for (const e of entries) {
        if (e.name === '..') continue;
        if (e.isDir) {
            dirCount++;
        } else {
            fileCount++;
            totalBytes += e.size;
        }
    }
    return { totalBytes, fileCount, dirCount };
}

export function formatSizeHuman(bytes: number): string {
    if (bytes <= 0) return '';
    const T = 1024 * 1024 * 1024 * 1024;
    const G = 1024 * 1024 * 1024;
    const M = 1024 * 1024;
    const K = 1024;
    if (bytes >= T) return (bytes / T).toFixed(2) + ' T';
    if (bytes >= G) return (bytes / G).toFixed(2) + ' G';
    if (bytes >= M) return Math.round(bytes / M) + ' M';
    if (bytes >= K) return Math.round(bytes / K) + ' K';
    return String(bytes);
}

export function stripAnsi(str: string): string {
    return str.replace(/\x1b\[[?>=!]*[0-9;]*[A-Za-z~@`]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()#%][A-Za-z0-9]|\x1b.|[\x00-\x08\x0e-\x1f\x7f]/g, '');
}

export function displayWidth(str: string): number {
    return stripAnsi(str).length;
}

export function dimHex(hex: string): string {
    if (hex.charCodeAt(0) === 0x40) return hex; // ANSI indexed — can't halve
    const r = Math.floor(parseInt(hex.slice(0, 2), 16) / 2);
    const g = Math.floor(parseInt(hex.slice(2, 4), 16) / 2);
    const b = Math.floor(parseInt(hex.slice(4, 6), 16) / 2);
    return r.toString(16).padStart(2, '0')
         + g.toString(16).padStart(2, '0')
         + b.toString(16).padStart(2, '0');
}

export function dimStyle(s: TextStyle): TextStyle {
    if (s.fg.charCodeAt(0) === 0x40 || s.bg.charCodeAt(0) === 0x40) {
        return { fg: s.fg, bg: s.bg, bold: false, dim: true };
    }
    return { fg: dimHex(s.fg), bg: dimHex(s.bg), bold: false };
}
