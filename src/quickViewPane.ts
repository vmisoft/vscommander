import * as fs from 'fs';
import * as path from 'path';
import {
    resetStyle, moveTo, DBOX, MBOX, BOX, bgColor, byteToChar
} from './draw';
import { Theme } from './settings';
import { PaneGeometry, Layout } from './types';
import {
    applyStyle, formatClock, formatSizeComma, formatSizeHuman, truncatePath,
} from './helpers';
import { SPINNER_FRAMES } from './visualPrimitives';

export class QuickViewPane {
    private dirs = 0;
    private files = 0;
    private size = 0;
    private scanning = false;
    private scanComplete = false;
    private scanAbort: AbortController | undefined;
    private spinnerFrame = 0;
    private spinnerTick = 0;
    private mode: 'none' | 'dir' | 'file' = 'none';
    private dirPath = '';
    private linkTarget = '';
    private fileLines: string[] = [];
    private fileBinary = false;
    private lastPath = '';
    private scrollTop = 0;
    private scrollLeft = 0;
    private fileSize = 0;
    private startByteOffset = 0;
    private totalBytesRead = 0;
    private lastNewlineOffset = 0;
    private storedMaxWidth = 0;
    focused = false;

    get isScanning(): boolean {
        return this.scanning;
    }

    get isTextFile(): boolean {
        return this.mode === 'file' && !this.fileBinary;
    }

    tickRedraw(): void {
        this.spinnerTick++;
        if (this.spinnerTick % 3 === 0) {
            this.spinnerFrame++;
        }
    }

    get hasMoreData(): boolean {
        return this.mode === 'file' && this.totalBytesRead < this.fileSize;
    }

    scrollBy(delta: number, contentHeight: number): boolean {
        if (this.mode !== 'file') return false;
        if (delta === Infinity && this.totalBytesRead < this.fileSize && !this.scanning) {
            this.seekEnd(contentHeight);
            return true;
        }
        if (delta === -Infinity && this.startByteOffset > 0 && !this.scanning) {
            this.seekStart();
            return true;
        }
        const maxScroll = Math.max(0, this.fileLines.length - contentHeight);
        const prev = this.scrollTop;
        this.scrollTop = Math.max(0, Math.min(maxScroll, this.scrollTop + delta));
        if (this.scrollTop + contentHeight >= this.fileLines.length && this.hasMoreData && !this.scanning) {
            this.loadMore();
        }
        return this.scrollTop !== prev;
    }

    scrollHorizontalBy(delta: number): boolean {
        const prev = this.scrollLeft;
        this.scrollLeft = Math.max(0, this.scrollLeft + delta);
        return this.scrollLeft !== prev;
    }

    resetHorizontalScroll(): void {
        this.scrollLeft = 0;
    }

    scanDir(dirPath: string): void {
        if (dirPath === this.lastPath && this.mode === 'dir') return;
        this.cancelScan();
        this.lastPath = dirPath;
        this.mode = 'dir';
        this.dirPath = dirPath;
        this.dirs = 0;
        this.files = 0;
        this.size = 0;
        this.scanning = true;
        this.scanComplete = false;
        this.spinnerFrame = 0;
        this.spinnerTick = 0;
        this.linkTarget = '';
        this.fileLines = [];
        this.fileBinary = false;

        const abort = new AbortController();
        this.scanAbort = abort;

        this.checkSymlink(dirPath).then(() => {
            if (abort.signal.aborted) return;
            return this.scanDirRecursive(dirPath, abort.signal);
        }).then(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
                this.scanComplete = true;
            }
        }).catch(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
                this.scanComplete = true;
            }
        });
    }

    loadFile(filePath: string, maxWidth: number): void {
        if (filePath === this.lastPath && this.mode === 'file') return;
        this.cancelScan();
        this.lastPath = filePath;
        this.mode = 'file';
        this.fileBinary = false;
        this.fileLines = [];
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.fileSize = 0;
        this.startByteOffset = 0;
        this.totalBytesRead = 0;
        this.lastNewlineOffset = 0;
        this.storedMaxWidth = maxWidth;
        this.scanning = true;
        this.scanComplete = false;
        this.spinnerFrame = 0;
        this.spinnerTick = 0;

        const abort = new AbortController();
        this.scanAbort = abort;

        this.readFileAsync(filePath, maxWidth, abort.signal).then(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
            }
        }).catch(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
            }
        });
    }

    cancelScan(): void {
        if (this.scanAbort) {
            this.scanAbort.abort();
            this.scanAbort = undefined;
        }
        this.scanning = false;
        this.scanComplete = false;
    }

    clear(): void {
        this.cancelScan();
        this.mode = 'none';
        this.lastPath = '';
        this.dirPath = '';
        this.linkTarget = '';
        this.fileLines = [];
        this.fileBinary = false;
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.fileSize = 0;
        this.startByteOffset = 0;
        this.totalBytesRead = 0;
        this.lastNewlineOffset = 0;
        this.storedMaxWidth = 0;
        this.focused = false;
    }

    render(geo: PaneGeometry, layout: Layout, theme: Theme, showClock: boolean, cursorName: string): string {
        const out: string[] = [];
        out.push(this.renderTopBorder(geo, layout, theme, showClock));
        out.push(this.renderContent(geo, layout, theme));
        out.push(this.renderSeparator(geo, layout, theme));
        out.push(this.renderInfoBar(geo, layout, theme, cursorName));
        out.push(this.renderBottomBorder(geo, layout, theme));
        return out.join('');
    }

    private renderTopBorder(geo: PaneGeometry, layout: Layout, theme: Theme, showClock: boolean): string {
        const border = applyStyle(theme.border.idle);
        const titleStyle = applyStyle(this.focused ? theme.activePath.idle : theme.inactivePath.idle);

        let clock = '';
        if (showClock) {
            clock = ' ' + formatClock() + ' ';
        }
        const clockStyle = applyStyle(theme.clock.idle);

        const title = ' Quick view ';
        const fill = geo.width - 2 - title.length - clock.length;
        const fillLeft = Math.max(0, Math.floor(fill / 2));
        const fillRight = Math.max(0, fill - fillLeft);

        let out = border + moveTo(layout.topRow, geo.startCol);
        out += DBOX.topLeft;
        out += DBOX.horizontal.repeat(fillLeft);
        out += titleStyle + title;
        out += border;
        out += DBOX.horizontal.repeat(fillRight);
        if (showClock) {
            out += clockStyle + clock;
            out += border;
        }
        out += DBOX.topRight;
        out += resetStyle();
        return out;
    }

    private renderContent(geo: PaneGeometry, layout: Layout, theme: Theme): string {
        const border = applyStyle(theme.border.idle);
        const contentBg = bgColor(theme.border.idle.bg);
        const innerWidth = geo.width - 2;
        const contentStart = layout.headerRow;
        const contentEnd = layout.separatorRow;
        const contentHeight = contentEnd - contentStart;
        const out: string[] = [];

        for (let i = 0; i < contentHeight; i++) {
            const row = contentStart + i;
            out.push(border + moveTo(row, geo.startCol) + DBOX.vertical);
            out.push(contentBg + ' '.repeat(innerWidth));
            out.push(border + DBOX.vertical);
        }

        if (this.mode === 'dir') {
            this.renderDirContent(out, geo, layout, theme, innerWidth, contentStart);
        } else if (this.mode === 'file') {
            this.renderFileContent(out, geo, layout, theme, innerWidth, contentStart, contentHeight);
        }

        out.push(resetStyle());
        return out.join('');
    }

    private renderDirContent(out: string[], geo: PaneGeometry, layout: Layout, theme: Theme, innerWidth: number, contentStart: number): void {
        const labelStyle = applyStyle(theme.info.idle);
        const valueStyle = applyStyle(theme.header.idle);
        const contentCol = geo.startCol + 2;
        const top = contentStart + 1;

        const maxPathLen = innerWidth - 11;
        const displayPath = truncatePath(this.dirPath, maxPathLen);
        out.push(labelStyle + moveTo(top, contentCol) + 'Folder ');
        out.push(valueStyle + '"' + displayPath.slice(0, innerWidth - 10) + '"');

        let offset = 0;
        if (this.linkTarget) {
            const maxLinkLen = innerWidth - 11;
            const displayLink = truncatePath(this.linkTarget, maxLinkLen);
            out.push(labelStyle + moveTo(top + 1, contentCol) + 'Link to ');
            out.push(valueStyle + '"' + displayLink.slice(0, innerWidth - 10) + '"');
            offset = 1;
        }

        const labelWidth = 16;

        out.push(labelStyle + moveTo(top + 2 + offset, contentCol) + 'Folders:'.padEnd(labelWidth));
        out.push(valueStyle + formatSizeComma(this.dirs));

        out.push(labelStyle + moveTo(top + 3 + offset, contentCol) + 'Files:'.padEnd(labelWidth));
        out.push(valueStyle + formatSizeComma(this.files));

        out.push(labelStyle + moveTo(top + 4 + offset, contentCol) + 'Files size:'.padEnd(labelWidth));
        if (this.size > 0) {
            out.push(valueStyle + formatSizeHuman(this.size) + ' (' + formatSizeComma(this.size) + ' bytes)');
        } else {
            out.push(valueStyle + '0');
        }

        if (this.scanning) {
            const spinner = SPINNER_FRAMES[this.spinnerFrame % SPINNER_FRAMES.length];
            out.push(labelStyle + moveTo(top + 6 + offset, contentCol) + spinner + ' Scanning...');
        } else if (this.scanComplete) {
            out.push(labelStyle + moveTo(top + 6 + offset, contentCol) + 'Scanning complete');
        }
    }

    private renderFileContent(out: string[], geo: PaneGeometry, layout: Layout, theme: Theme, innerWidth: number, contentStart: number, contentHeight: number): void {
        if (this.scanning) {
            const labelStyle = applyStyle(theme.info.idle);
            const contentCol = geo.startCol + 2;
            const spinner = SPINNER_FRAMES[this.spinnerFrame % SPINNER_FRAMES.length];
            out.push(labelStyle + moveTo(contentStart + 1, contentCol) + spinner + ' Reading...');
            return;
        }

        const textStyle = applyStyle(theme.info.idle);
        const contentCol = geo.startCol + 1;

        const maxLines = contentHeight;
        for (let i = 0; i < maxLines && (this.scrollTop + i) < this.fileLines.length; i++) {
            const row = contentStart + i;
            let line = this.expandTabs(this.fileLines[this.scrollTop + i]);
            if (this.scrollLeft > 0 && !this.fileBinary) {
                line = line.slice(this.scrollLeft);
            }
            if (line.length > innerWidth) {
                line = line.slice(0, innerWidth);
            }
            out.push(textStyle + moveTo(row, contentCol) + line);
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

    private renderSeparator(geo: PaneGeometry, layout: Layout, theme: Theme): string {
        const border = applyStyle(theme.border.idle);
        const innerWidth = geo.width - 2;
        let out = border + moveTo(layout.separatorRow, geo.startCol);
        out += MBOX.vertDoubleRight;
        out += BOX.horizontal.repeat(innerWidth);
        out += MBOX.vertDoubleLeft;
        out += resetStyle();
        return out;
    }

    private renderInfoBar(geo: PaneGeometry, layout: Layout, theme: Theme, cursorName: string): string {
        const border = applyStyle(theme.border.idle);
        const content = applyStyle(theme.info.idle);
        const innerWidth = geo.width - 2;

        const displayName = cursorName.length > innerWidth
            ? cursorName.slice(0, innerWidth - 1) + '~'
            : cursorName;
        const pad = ' '.repeat(Math.max(0, innerWidth - displayName.length));

        return border + moveTo(layout.infoRow, geo.startCol) + DBOX.vertical
            + content + displayName + pad
            + border + DBOX.vertical + resetStyle();
    }

    private renderBottomBorder(geo: PaneGeometry, layout: Layout, theme: Theme): string {
        const border = applyStyle(theme.border.idle);
        const innerWidth = geo.width - 2;
        return border
            + moveTo(layout.bottomRow, geo.startCol)
            + DBOX.bottomLeft
            + DBOX.horizontal.repeat(innerWidth)
            + DBOX.bottomRight
            + resetStyle();
    }

    private async checkSymlink(dirPath: string): Promise<void> {
        try {
            const lstat = await fs.promises.lstat(dirPath);
            if (lstat.isSymbolicLink()) {
                this.linkTarget = await fs.promises.readlink(dirPath);
            }
        } catch {
            // ignore
        }
    }

    private seekEnd(contentHeight: number): void {
        if (this.scanning) return;
        this.cancelScan();
        this.scanning = true;
        this.spinnerFrame = 0;
        this.spinnerTick = 0;

        const abort = new AbortController();
        this.scanAbort = abort;
        const MAX_BYTES = 256 * 1024;
        const offset = Math.max(0, this.fileSize - MAX_BYTES);

        this.readWindowAsync(this.lastPath, offset, abort.signal).then(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
                const maxScroll = Math.max(0, this.fileLines.length - contentHeight);
                this.scrollTop = maxScroll;
            }
        }).catch(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
            }
        });
    }

    private seekStart(): void {
        if (this.scanning) return;
        this.cancelScan();
        this.scanning = true;
        this.spinnerFrame = 0;
        this.spinnerTick = 0;

        const abort = new AbortController();
        this.scanAbort = abort;

        this.readWindowAsync(this.lastPath, 0, abort.signal).then(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
                this.scrollTop = 0;
            }
        }).catch(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
            }
        });
    }

    private async readWindowAsync(filePath: string, offset: number, signal: AbortSignal): Promise<void> {
        const MAX_BYTES = 256 * 1024;
        try {
            const readSize = Math.min(MAX_BYTES, this.fileSize - offset);
            if (readSize <= 0) return;
            const buf = Buffer.alloc(readSize);
            const fh = await fs.promises.open(filePath, 'r');
            if (signal.aborted) { await fh.close(); return; }
            const { bytesRead } = await fh.read(buf, 0, readSize, offset);
            await fh.close();
            if (signal.aborted) return;

            this.startByteOffset = offset;
            this.totalBytesRead = offset + bytesRead;
            const data = buf.subarray(0, bytesRead);

            if (this.fileBinary) {
                this.fileLines = [];
                this.appendBinaryLines(data, bytesRead, this.storedMaxWidth);
            } else {
                // For non-zero offsets, the first partial line is kept as-is
                // (we can't know its start without reading backwards)
                const text = data.toString('utf8');
                this.fileLines = text.split(/\r?\n/);
                this.findLastNewline(data, bytesRead, offset);
            }
        } catch {
            // file unreadable
        }
    }

    private loadMore(): void {
        if (this.scanning || this.totalBytesRead >= this.fileSize) return;
        this.scanning = true;
        this.spinnerFrame = 0;
        this.spinnerTick = 0;

        const abort = new AbortController();
        this.scanAbort = abort;

        const readOffset = this.fileBinary ? this.totalBytesRead : this.lastNewlineOffset;
        this.readChunkAsync(this.lastPath, readOffset, abort.signal).then(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
            }
        }).catch(() => {
            if (!abort.signal.aborted) {
                this.scanning = false;
            }
        });
    }

    private async readFileAsync(filePath: string, maxWidth: number, signal: AbortSignal): Promise<void> {
        const MAX_BYTES = 256 * 1024;
        try {
            const stat = await fs.promises.stat(filePath);
            this.fileSize = stat.size;
            const readSize = Math.min(stat.size, MAX_BYTES);
            const buf = Buffer.alloc(readSize);
            const fh = await fs.promises.open(filePath, 'r');
            if (signal.aborted) { await fh.close(); return; }
            const { bytesRead } = await fh.read(buf, 0, readSize, 0);
            await fh.close();
            if (signal.aborted) return;

            this.totalBytesRead = bytesRead;
            const data = buf.subarray(0, bytesRead);
            const checkLen = Math.min(bytesRead, 8192);
            for (let i = 0; i < checkLen; i++) {
                if (data[i] === 0) {
                    this.fileBinary = true;
                    break;
                }
            }

            if (this.fileBinary) {
                this.appendBinaryLines(data, bytesRead, maxWidth);
            } else {
                const text = data.toString('utf8');
                this.fileLines = text.split(/\r?\n/);
                this.findLastNewline(data, bytesRead, 0);
            }
        } catch {
            // file unreadable
        }
    }

    private async readChunkAsync(filePath: string, offset: number, signal: AbortSignal): Promise<void> {
        const MAX_BYTES = 256 * 1024;
        try {
            const readSize = Math.min(MAX_BYTES, this.fileSize - offset);
            if (readSize <= 0) return;
            const buf = Buffer.alloc(readSize);
            const fh = await fs.promises.open(filePath, 'r');
            if (signal.aborted) { await fh.close(); return; }
            const { bytesRead } = await fh.read(buf, 0, readSize, offset);
            await fh.close();
            if (signal.aborted) return;

            this.totalBytesRead = offset + bytesRead;
            const data = buf.subarray(0, bytesRead);

            if (this.fileBinary) {
                this.appendBinaryLines(data, bytesRead, this.storedMaxWidth);
            } else {
                // Pop the last (potentially partial) line and prepend to new chunk
                const partial = this.fileLines.pop() || '';
                const text = partial + data.toString('utf8');
                const newLines = text.split(/\r?\n/);
                this.fileLines.push(...newLines);
                this.findLastNewline(data, bytesRead, offset);
            }
        } catch {
            // file unreadable
        }
    }

    private appendBinaryLines(data: Buffer, bytesRead: number, maxWidth: number): void {
        let line = '';
        for (let i = 0; i < bytesRead; i++) {
            line += byteToChar(data[i]);
            if (line.length >= maxWidth) {
                this.fileLines.push(line);
                line = '';
            }
        }
        if (line.length > 0) this.fileLines.push(line);
    }

    private findLastNewline(data: Buffer, bytesRead: number, baseOffset: number): void {
        for (let i = bytesRead - 1; i >= 0; i--) {
            if (data[i] === 0x0a) {
                this.lastNewlineOffset = baseOffset + i + 1;
                return;
            }
        }
        // No newline found — keep previous offset (or 0 for first chunk)
    }

    private async scanDirRecursive(dirPath: string, signal: AbortSignal): Promise<void> {
        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (signal.aborted) return;

            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                this.dirs++;
                await this.scanDirRecursive(fullPath, signal);
            } else {
                this.files++;
                try {
                    const stat = await fs.promises.stat(fullPath);
                    this.size += stat.size;
                } catch {
                    // skip files we can't stat
                }
            }
        }
    }
}
