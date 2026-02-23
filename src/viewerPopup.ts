import * as fs from 'fs';
import * as path from 'path';
import {
    resetStyle, moveTo, hideCursor, bgColor,
} from './draw';
import { Theme, matchesKeyBinding } from './settings';
import {
    KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_HOME, KEY_HOME_ALT,
    KEY_END, KEY_END_ALT, KEY_PAGE_UP, KEY_PAGE_DOWN,
    KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_F2, KEY_F3, KEY_F4, KEY_F6,
    KEY_F7, KEY_F8, KEY_F10,
} from './keys';
import { applyStyle, formatSizeComma, truncatePath } from './helpers';

export type ViewerInputResult =
    | { action: 'consumed' }
    | { action: 'close' }
    | { action: 'openInEditor'; filePath: string }
    | { action: 'openSearch' }
    | { action: 'searchNext' }
    | { action: 'searchPrev' };

export interface ViewerSearchParams {
    text: string;
    caseSensitive: boolean;
    wholeWords: boolean;
    regex: boolean;
    hexSearch: boolean;
}

const MAX_BYTES = 256 * 1024;

type ViewerEncoding = 'utf8' | 'latin1' | 'utf16le';

export class ViewerPopup {
    active = false;
    private filePath = '';
    private fileName = '';
    private fileSize = 0;
    private fileLines: string[] = [];
    private fileBinary = false;
    private hexBytes: Buffer | null = null;
    private scrollTop = 0;
    private scrollLeft = 0;
    private wrapMode = false;
    private hexMode = false;
    private encoding: ViewerEncoding = 'utf8';
    private totalBytesRead = 0;
    private lastNewlineOffset = 0;
    private startByteOffset = 0;
    private searchMatch: { line: number; col: number; length: number } | null = null;
    private lastSearch: ViewerSearchParams | null = null;
    private wrappedLines: string[] | null = null;
    private wrappedMap: number[] | null = null;
    private lastWrapWidth = 0;

    open(filePath: string): void {
        this.active = true;
        this.filePath = filePath;
        this.fileName = path.basename(filePath);
        this.fileSize = 0;
        this.fileLines = [];
        this.fileBinary = false;
        this.hexBytes = null;
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.wrapMode = false;
        this.hexMode = false;
        this.encoding = 'utf8';
        this.totalBytesRead = 0;
        this.lastNewlineOffset = 0;
        this.startByteOffset = 0;
        this.searchMatch = null;
        this.lastSearch = null;
        this.wrappedLines = null;
        this.wrappedMap = null;
        this.lastWrapWidth = 0;
        this.readFile(0);
    }

    close(): void {
        this.active = false;
    }

    handleInput(data: string): ViewerInputResult {
        if (!this.active) return { action: 'consumed' };

        if (data === KEY_F3 || data === KEY_F10 || data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            return { action: 'close' };
        }

        if (data === KEY_F6) {
            return { action: 'openInEditor', filePath: this.filePath };
        }

        if (data === KEY_F7) {
            return { action: 'openSearch' };
        }

        if (matchesKeyBinding(data, 'Shift+F7')) {
            return { action: 'searchNext' };
        }

        if (matchesKeyBinding(data, 'Alt+F7')) {
            return { action: 'searchPrev' };
        }

        if (data === KEY_F2) {
            this.wrapMode = !this.wrapMode;
            this.invalidateWrap();
            this.scrollTop = 0;
            return { action: 'consumed' };
        }

        if (data === KEY_F4) {
            this.hexMode = !this.hexMode;
            this.scrollTop = 0;
            this.scrollLeft = 0;
            return { action: 'consumed' };
        }

        if (data === KEY_F8) {
            this.cycleEncoding();
            return { action: 'consumed' };
        }

        if (data === KEY_UP) {
            this.scroll(-1);
            return { action: 'consumed' };
        }

        if (data === KEY_DOWN) {
            this.scroll(1);
            return { action: 'consumed' };
        }

        if (data === KEY_PAGE_UP) {
            this.scroll(-this.lastPageHeight());
            return { action: 'consumed' };
        }

        if (data === KEY_PAGE_DOWN) {
            this.scroll(this.lastPageHeight());
            return { action: 'consumed' };
        }

        if (matchesKeyBinding(data, 'Ctrl+Home')) {
            this.seekStart();
            return { action: 'consumed' };
        }

        if (matchesKeyBinding(data, 'Ctrl+End')) {
            this.seekEnd();
            return { action: 'consumed' };
        }

        if (data === KEY_HOME || data === KEY_HOME_ALT) {
            this.scrollLeft = 0;
            return { action: 'consumed' };
        }

        if (data === KEY_END || data === KEY_END_ALT) {
            this.scrollToEndOfLine();
            return { action: 'consumed' };
        }

        if (data === KEY_LEFT) {
            if (!this.hexMode && !this.wrapMode) {
                this.scrollLeft = Math.max(0, this.scrollLeft - 1);
            }
            return { action: 'consumed' };
        }

        if (data === KEY_RIGHT) {
            if (!this.hexMode && !this.wrapMode) {
                this.scrollLeft++;
            }
            return { action: 'consumed' };
        }

        if (matchesKeyBinding(data, 'Ctrl+Left')) {
            if (!this.hexMode && !this.wrapMode) {
                this.scrollLeft = Math.max(0, this.scrollLeft - 20);
            }
            return { action: 'consumed' };
        }

        if (matchesKeyBinding(data, 'Ctrl+Right')) {
            if (!this.hexMode && !this.wrapMode) {
                this.scrollLeft += 20;
            }
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    handleMouseScroll(up: boolean, contentHeight: number): void {
        this.scroll(up ? -3 : 3);
        this.ensureMoreData(contentHeight);
    }

    search(params: ViewerSearchParams, direction: 'forward' | 'backward'): void {
        this.lastSearch = params;
        if (params.hexSearch) {
            this.searchHex(params, direction);
        } else {
            this.searchText(params, direction);
        }
    }

    searchNext(): void {
        if (this.lastSearch) this.search(this.lastSearch, 'forward');
    }

    searchPrev(): void {
        if (this.lastSearch) this.search(this.lastSearch, 'backward');
    }

    render(rows: number, cols: number, theme: Theme): string {
        const out: string[] = [];
        const contentHeight = rows - 2;

        out.push(hideCursor());
        out.push(this.renderTitleBar(rows, cols, theme, contentHeight));
        out.push(this.renderContent(rows, cols, theme, contentHeight));
        out.push(this.renderFKeyBar(rows, cols, theme));

        return out.join('');
    }

    private renderTitleBar(rows: number, cols: number, theme: Theme, contentHeight: number): string {
        const statusStyle = applyStyle(theme.viewerStatus.idle);

        const mode = this.hexMode ? 'h' : 't';
        const enc = this.encodingLabel();
        const sizeStr = formatSizeComma(this.fileSize);
        const colStr = 'Col ' + String(this.scrollLeft).padStart(3, ' ');
        const pct = this.calcPercent(contentHeight);
        const pctStr = String(pct) + '%';

        const statusPart = '\u2502' + mode + '\u2502' + enc + '\u2502'
            + sizeStr.padStart(10, ' ') + '\u2502' + colStr + '\u2502'
            + pctStr.padStart(4, ' ');
        const statusLen = statusPart.length;

        const maxNameLen = cols - statusLen - 1;
        let nameStr = this.fileName;
        if (nameStr.length > maxNameLen) {
            nameStr = truncatePath(nameStr, maxNameLen);
        }
        const nameLen = nameStr.length;
        const gap = Math.max(0, cols - nameLen - statusLen);

        let out = statusStyle + moveTo(1, 1);
        out += nameStr;
        out += ' '.repeat(gap);
        out += statusPart;
        out += resetStyle();
        return out;
    }

    private renderContent(rows: number, cols: number, theme: Theme, contentHeight: number): string {
        const out: string[] = [];
        const textStyle = applyStyle(theme.viewerText.idle);
        const bgStr = bgColor(theme.viewerText.idle.bg);
        const arrowStyle = applyStyle(theme.viewerArrows.idle);
        const hexStyle = applyStyle(theme.viewerHex.idle);
        const selectedStyle = applyStyle(theme.viewerSelected.idle);

        for (let i = 0; i < contentHeight; i++) {
            const row = i + 2;
            out.push(textStyle + moveTo(row, 1));
            out.push(' '.repeat(cols));
            out.push(moveTo(row, 1));

            if (this.hexMode) {
                this.renderHexLine(out, i, cols, textStyle, hexStyle);
            } else if (this.wrapMode) {
                this.renderWrappedLine(out, i, cols, textStyle, selectedStyle);
            } else {
                this.renderTextLine(out, i, cols, textStyle, arrowStyle, selectedStyle, bgStr);
            }
        }

        this.ensureMoreData(contentHeight);
        out.push(resetStyle());
        return out.join('');
    }

    private renderTextLine(
        out: string[], viewIdx: number, cols: number,
        textStyle: string, arrowStyle: string, selectedStyle: string, _bgStr: string,
    ): void {
        const lineIdx = this.scrollTop + viewIdx;
        if (lineIdx >= this.fileLines.length) return;

        const rawLine = this.expandTabs(this.fileLines[lineIdx]);
        const visibleStart = this.scrollLeft;
        const visibleLen = cols;
        const segment = rawLine.slice(visibleStart, visibleStart + visibleLen);

        const hasLeftOverflow = visibleStart > 0 && rawLine.length > 0;
        const hasRightOverflow = rawLine.length > visibleStart + visibleLen;

        if (this.searchMatch && this.searchMatch.line === lineIdx) {
            const matchCol = this.searchMatch.col;
            const matchLen = this.searchMatch.length;
            const matchEnd = matchCol + matchLen;
            const visEnd = visibleStart + visibleLen;

            if (matchEnd > visibleStart && matchCol < visEnd) {
                const hlStart = Math.max(0, matchCol - visibleStart);
                const hlEnd = Math.min(visibleLen, matchEnd - visibleStart);
                const before = segment.slice(0, hlStart);
                const match = segment.slice(hlStart, hlEnd);
                const after = segment.slice(hlEnd);
                out.push(textStyle + before + selectedStyle + match + textStyle + after);
            } else {
                out.push(textStyle + segment);
            }
        } else {
            out.push(textStyle + segment);
        }

        if (hasLeftOverflow) {
            out.push(arrowStyle + moveTo(viewIdx + 2, 1) + '\u00ab');
        }
        if (hasRightOverflow) {
            out.push(arrowStyle + moveTo(viewIdx + 2, cols) + '\u00bb');
        }
    }

    private renderWrappedLine(
        out: string[], viewIdx: number, cols: number,
        textStyle: string, _selectedStyle: string,
    ): void {
        this.ensureWrapped(cols);
        if (!this.wrappedLines) return;

        const lineIdx = this.scrollTop + viewIdx;
        if (lineIdx >= this.wrappedLines.length) return;

        const line = this.wrappedLines[lineIdx];
        out.push(textStyle + line);
    }

    private renderHexLine(
        out: string[], viewIdx: number, _cols: number,
        textStyle: string, hexStyle: string,
    ): void {
        if (!this.hexBytes) return;

        const lineIdx = this.scrollTop + viewIdx;
        const offset = lineIdx * 16;
        if (offset >= this.hexBytes.length) return;

        const endPos = Math.min(offset + 16, this.hexBytes.length);
        const addrStr = (this.startByteOffset + offset).toString(16).toUpperCase().padStart(10, '0');

        let hexPart = '';
        let textPart = '';

        for (let i = offset; i < offset + 16; i++) {
            if (i === offset + 8) {
                hexPart += '\u2502 ';
            }
            if (i < endPos) {
                const b = this.hexBytes[i];
                hexPart += b.toString(16).toUpperCase().padStart(2, '0') + ' ';
                textPart += (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.';
            } else {
                hexPart += '   ';
                textPart += ' ';
            }
        }

        out.push(hexStyle + addrStr + ': ');
        out.push(textStyle + hexPart);
        out.push(hexStyle + '\u2502 ');
        out.push(textStyle + textPart);
    }

    private renderFKeyBar(rows: number, cols: number, theme: Theme): string {
        const numStyle = applyStyle(theme.fkeyNum.idle);
        const labelStyle = applyStyle(theme.fkeyLabel.idle);
        const inactiveStyle = applyStyle(theme.fkeyLabelInactive.idle);

        const labels: { num: string; label: string; inactive: boolean }[] = [
            { num: '1', label: 'Help', inactive: true },
            { num: '2', label: 'Wrap', inactive: false },
            { num: '3', label: 'Quit', inactive: false },
            { num: '4', label: 'Hex', inactive: false },
            { num: '5', label: '', inactive: true },
            { num: '6', label: 'Edit', inactive: false },
            { num: '7', label: 'Search', inactive: false },
            { num: '8', label: this.encodingLabel(), inactive: false },
            { num: '9', label: '', inactive: true },
            { num: '10', label: 'Quit', inactive: false },
        ];

        const out: string[] = [];
        out.push(moveTo(rows, 1) + resetStyle());

        const totalKeys = labels.length;
        const slotWidth = Math.floor(cols / totalKeys);
        let col = 1;

        for (let i = 0; i < totalKeys; i++) {
            const k = labels[i];
            const isLast = i === totalKeys - 1;
            const w = isLast ? cols - col + 1 : slotWidth;

            out.push(moveTo(rows, col));
            out.push(numStyle + ' ' + k.num);
            const remaining = Math.max(0, w - 1 - k.num.length);
            const label = k.label.slice(0, remaining);
            const pad = ' '.repeat(Math.max(0, remaining - label.length));
            const style = k.inactive ? inactiveStyle : labelStyle;
            out.push(style + label + pad);

            col += w;
        }

        return out.join('');
    }

    handleFKeyBarClick(col: number, cols: number): ViewerInputResult {
        const slotWidth = Math.floor(cols / 10);
        const slot = Math.min(9, Math.floor((col - 1) / slotWidth));
        const fkeyNum = slot + 1;

        switch (fkeyNum) {
            case 2: return this.handleInput(KEY_F2);
            case 3: return { action: 'close' };
            case 4: return this.handleInput(KEY_F4);
            case 6: return { action: 'openInEditor', filePath: this.filePath };
            case 7: return { action: 'openSearch' };
            case 8: return this.handleInput(KEY_F8);
            case 10: return { action: 'close' };
            default: return { action: 'consumed' };
        }
    }

    private encodingLabel(): string {
        switch (this.encoding) {
            case 'utf8': return 'UTF-8';
            case 'latin1': return 'Latin1';
            case 'utf16le': return 'UTF16';
        }
    }

    private cycleEncoding(): void {
        const order: ViewerEncoding[] = ['utf8', 'latin1', 'utf16le'];
        const idx = order.indexOf(this.encoding);
        this.encoding = order[(idx + 1) % order.length];
        this.readWindow(this.startByteOffset);
    }

    private calcPercent(contentHeight: number): number {
        if (this.hexMode) {
            if (!this.hexBytes || this.hexBytes.length === 0) return 100;
            const totalHexLines = Math.ceil(this.hexBytes.length / 16);
            const bottom = Math.min(this.scrollTop + contentHeight, totalHexLines);
            const bytesAtBottom = this.startByteOffset + bottom * 16;
            return this.fileSize > 0 ? Math.round((Math.min(bytesAtBottom, this.fileSize) / this.fileSize) * 100) : 100;
        }
        const lines = this.getDisplayLines();
        const total = lines.length;
        if (total === 0) return 100;
        const bottom = Math.min(this.scrollTop + contentHeight, total);
        if (this.totalBytesRead >= this.fileSize) {
            return Math.round((bottom / total) * 100);
        }
        const bytesAtBottom = Math.round((bottom / total) * this.totalBytesRead);
        return Math.round((bytesAtBottom / this.fileSize) * 100);
    }

    private getDisplayLines(): string[] {
        if (this.wrapMode && this.wrappedLines) {
            return this.wrappedLines;
        }
        return this.fileLines;
    }

    private lastPageH = 20;
    private lastPageHeight(): number {
        return this.lastPageH;
    }

    private scroll(delta: number): void {
        if (this.hexMode) {
            const totalHexLines = this.hexBytes ? Math.ceil(this.hexBytes.length / 16) : 0;
            const maxScroll = Math.max(0, totalHexLines - this.lastPageH);
            this.scrollTop = Math.max(0, Math.min(maxScroll, this.scrollTop + delta));
            return;
        }
        const lines = this.wrapMode && this.wrappedLines ? this.wrappedLines : this.fileLines;
        const maxScroll = Math.max(0, lines.length - this.lastPageH);
        this.scrollTop = Math.max(0, Math.min(maxScroll, this.scrollTop + delta));
    }

    private scrollToEndOfLine(): void {
        if (this.hexMode || this.wrapMode) return;
        let maxLen = 0;
        const end = Math.min(this.scrollTop + this.lastPageH, this.fileLines.length);
        for (let i = this.scrollTop; i < end; i++) {
            const expanded = this.expandTabs(this.fileLines[i]);
            if (expanded.length > maxLen) maxLen = expanded.length;
        }
        this.scrollLeft = Math.max(0, maxLen - this.lastPageH);
    }

    private ensureMoreData(contentHeight: number): void {
        this.lastPageH = contentHeight;
        if (this.totalBytesRead >= this.fileSize) return;
        if (this.hexMode) {
            if (!this.hexBytes) return;
            const totalHexLines = Math.ceil(this.hexBytes.length / 16);
            if (this.scrollTop + contentHeight >= totalHexLines) {
                this.readChunk(this.totalBytesRead);
            }
            return;
        }
        const lines = this.wrapMode && this.wrappedLines ? this.wrappedLines : this.fileLines;
        if (this.scrollTop + contentHeight >= lines.length) {
            const readOffset = this.fileBinary ? this.totalBytesRead : this.lastNewlineOffset;
            this.readChunk(readOffset);
        }
    }

    private seekStart(): void {
        if (this.startByteOffset === 0) {
            this.scrollTop = 0;
            return;
        }
        this.readWindow(0);
        this.scrollTop = 0;
    }

    private seekEnd(): void {
        const offset = Math.max(0, this.fileSize - MAX_BYTES);
        this.readWindow(offset);
        this.invalidateWrap();
        if (this.hexMode && this.hexBytes) {
            const totalHexLines = Math.ceil(this.hexBytes.length / 16);
            this.scrollTop = Math.max(0, totalHexLines - this.lastPageH);
        } else {
            const lines = this.wrapMode && this.wrappedLines ? this.wrappedLines : this.fileLines;
            this.scrollTop = Math.max(0, lines.length - this.lastPageH);
        }
    }

    private readFile(offset: number): void {
        try {
            const stat = fs.statSync(this.filePath);
            this.fileSize = stat.size;
            const readSize = Math.min(stat.size, MAX_BYTES);
            if (readSize === 0) return;

            const fd = fs.openSync(this.filePath, 'r');
            const buf = Buffer.alloc(readSize);
            const bytesRead = fs.readSync(fd, buf, 0, readSize, offset);
            fs.closeSync(fd);

            this.startByteOffset = offset;
            this.totalBytesRead = offset + bytesRead;
            const data = buf.subarray(0, bytesRead);

            const checkLen = Math.min(bytesRead, 8192);
            for (let i = 0; i < checkLen; i++) {
                if (data[i] === 0) {
                    this.fileBinary = true;
                    break;
                }
            }

            this.hexBytes = Buffer.from(data);

            if (this.fileBinary) {
                this.hexMode = true;
            }

            this.decodeTextLines(data, bytesRead);
            this.findLastNewline(data, bytesRead, offset);
        } catch {
            // file unreadable
        }
    }

    private readWindow(offset: number): void {
        try {
            const readSize = Math.min(MAX_BYTES, this.fileSize - offset);
            if (readSize <= 0) return;

            const fd = fs.openSync(this.filePath, 'r');
            const buf = Buffer.alloc(readSize);
            const bytesRead = fs.readSync(fd, buf, 0, readSize, offset);
            fs.closeSync(fd);

            this.startByteOffset = offset;
            this.totalBytesRead = offset + bytesRead;
            const data = buf.subarray(0, bytesRead);
            this.hexBytes = Buffer.from(data);
            this.decodeTextLines(data, bytesRead);
            this.findLastNewline(data, bytesRead, offset);
            this.invalidateWrap();
        } catch {
            // file unreadable
        }
    }

    private readChunk(offset: number): void {
        if (this.totalBytesRead >= this.fileSize) return;
        try {
            const readSize = Math.min(MAX_BYTES, this.fileSize - offset);
            if (readSize <= 0) return;

            const fd = fs.openSync(this.filePath, 'r');
            const buf = Buffer.alloc(readSize);
            const bytesRead = fs.readSync(fd, buf, 0, readSize, offset);
            fs.closeSync(fd);

            this.totalBytesRead = offset + bytesRead;
            const data = buf.subarray(0, bytesRead);

            if (this.hexBytes) {
                this.hexBytes = Buffer.concat([this.hexBytes, data]);
            }

            const partial = this.fileLines.pop() || '';
            const text = partial + this.decodeBuffer(data, bytesRead);
            const newLines = text.split(/\r?\n/);
            this.fileLines.push(...newLines);
            this.findLastNewline(data, bytesRead, offset);
            this.invalidateWrap();
        } catch {
            // file unreadable
        }
    }

    private decodeBuffer(data: Buffer, bytesRead: number): string {
        const slice = data.subarray(0, bytesRead);
        if (this.encoding === 'latin1') return slice.toString('latin1');
        if (this.encoding === 'utf16le') return slice.toString('utf16le');
        return slice.toString('utf8');
    }

    private decodeTextLines(data: Buffer, bytesRead: number): void {
        const text = this.decodeBuffer(data, bytesRead);
        this.fileLines = text.split(/\r?\n/);
        this.invalidateWrap();
    }

    private findLastNewline(data: Buffer, bytesRead: number, baseOffset: number): void {
        for (let i = bytesRead - 1; i >= 0; i--) {
            if (data[i] === 0x0a) {
                this.lastNewlineOffset = baseOffset + i + 1;
                return;
            }
        }
    }

    private expandTabs(line: string): string {
        let result = '';
        for (const ch of line) {
            if (ch === '\t') {
                const spaces = 8 - (result.length % 8);
                result += ' '.repeat(spaces);
            } else {
                result += ch;
            }
        }
        return result;
    }

    private invalidateWrap(): void {
        this.wrappedLines = null;
        this.wrappedMap = null;
        this.lastWrapWidth = 0;
    }

    private ensureWrapped(cols: number): void {
        if (this.wrappedLines && this.lastWrapWidth === cols) return;
        this.lastWrapWidth = cols;
        this.wrappedLines = [];
        this.wrappedMap = [];

        for (let i = 0; i < this.fileLines.length; i++) {
            const expanded = this.expandTabs(this.fileLines[i]);
            if (expanded.length === 0) {
                this.wrappedLines.push('');
                this.wrappedMap.push(i);
            } else {
                for (let j = 0; j < expanded.length; j += cols) {
                    this.wrappedLines.push(expanded.slice(j, j + cols));
                    this.wrappedMap.push(i);
                }
            }
        }
    }

    private searchText(params: ViewerSearchParams, direction: 'forward' | 'backward'): void {
        const lines = this.fileLines;
        if (lines.length === 0) return;

        let pattern: RegExp;
        try {
            if (params.regex) {
                const flags = params.caseSensitive ? 'g' : 'gi';
                pattern = new RegExp(params.text, flags);
            } else {
                let escaped = params.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (params.wholeWords) {
                    escaped = '\\b' + escaped + '\\b';
                }
                const flags = params.caseSensitive ? 'g' : 'gi';
                pattern = new RegExp(escaped, flags);
            }
        } catch {
            return;
        }

        const startLine = this.searchMatch ? this.searchMatch.line : this.scrollTop;
        const startCol = this.searchMatch ? this.searchMatch.col + 1 : 0;

        if (direction === 'forward') {
            for (let offset = 0; offset < lines.length; offset++) {
                const lineIdx = (startLine + offset) % lines.length;
                const line = this.expandTabs(lines[lineIdx]);
                pattern.lastIndex = (offset === 0) ? startCol : 0;
                const m = pattern.exec(line);
                if (m) {
                    this.searchMatch = { line: lineIdx, col: m.index, length: m[0].length };
                    this.scrollToMatch();
                    return;
                }
            }
        } else {
            for (let offset = 0; offset < lines.length; offset++) {
                const lineIdx = (startLine - offset + lines.length) % lines.length;
                const line = this.expandTabs(lines[lineIdx]);
                let lastMatch: RegExpExecArray | null = null;
                const maxCol = (offset === 0 && this.searchMatch) ? this.searchMatch.col : line.length;
                pattern.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = pattern.exec(line)) !== null) {
                    if (m.index < maxCol) {
                        lastMatch = m;
                    } else {
                        break;
                    }
                    if (m.index === pattern.lastIndex) pattern.lastIndex++;
                }
                if (lastMatch) {
                    this.searchMatch = { line: lineIdx, col: lastMatch.index, length: lastMatch[0].length };
                    this.scrollToMatch();
                    return;
                }
            }
        }

        this.searchMatch = null;
    }

    private searchHex(params: ViewerSearchParams, direction: 'forward' | 'backward'): void {
        if (!this.hexBytes || params.text.length === 0) return;

        const hexStr = params.text.replace(/\s+/g, '');
        if (hexStr.length % 2 !== 0) return;
        const needle = Buffer.alloc(hexStr.length / 2);
        for (let i = 0; i < needle.length; i++) {
            const byte = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
            if (isNaN(byte)) return;
            needle[i] = byte;
        }

        const haystack = this.hexBytes;
        const startPos = this.searchMatch
            ? this.searchMatch.line * 16 + this.searchMatch.col + 1
            : 0;

        if (direction === 'forward') {
            for (let i = startPos; i <= haystack.length - needle.length; i++) {
                if (this.bufferMatch(haystack, i, needle)) {
                    const line = Math.floor(i / 16);
                    const col = i % 16;
                    this.searchMatch = { line, col, length: needle.length };
                    this.scrollTop = Math.max(0, line - Math.floor(this.lastPageH / 4));
                    return;
                }
            }
            for (let i = 0; i < startPos && i <= haystack.length - needle.length; i++) {
                if (this.bufferMatch(haystack, i, needle)) {
                    const line = Math.floor(i / 16);
                    const col = i % 16;
                    this.searchMatch = { line, col, length: needle.length };
                    this.scrollTop = Math.max(0, line - Math.floor(this.lastPageH / 4));
                    return;
                }
            }
        } else {
            const searchStart = this.searchMatch
                ? this.searchMatch.line * 16 + this.searchMatch.col - 1
                : haystack.length - needle.length;
            for (let i = searchStart; i >= 0; i--) {
                if (this.bufferMatch(haystack, i, needle)) {
                    const line = Math.floor(i / 16);
                    const col = i % 16;
                    this.searchMatch = { line, col, length: needle.length };
                    this.scrollTop = Math.max(0, line - Math.floor(this.lastPageH / 4));
                    return;
                }
            }
            for (let i = haystack.length - needle.length; i > searchStart; i--) {
                if (this.bufferMatch(haystack, i, needle)) {
                    const line = Math.floor(i / 16);
                    const col = i % 16;
                    this.searchMatch = { line, col, length: needle.length };
                    this.scrollTop = Math.max(0, line - Math.floor(this.lastPageH / 4));
                    return;
                }
            }
        }

        this.searchMatch = null;
    }

    private bufferMatch(haystack: Buffer, pos: number, needle: Buffer): boolean {
        for (let i = 0; i < needle.length; i++) {
            if (haystack[pos + i] !== needle[i]) return false;
        }
        return true;
    }

    private scrollToMatch(): void {
        if (!this.searchMatch) return;
        const line = this.searchMatch.line;
        const quarterPage = Math.floor(this.lastPageH / 4);
        this.scrollTop = Math.max(0, line - quarterPage);

        if (!this.hexMode && !this.wrapMode) {
            const col = this.searchMatch.col;
            if (col < this.scrollLeft || col >= this.scrollLeft + this.lastPageH) {
                this.scrollLeft = Math.max(0, col - 5);
            }
        }
    }
}
