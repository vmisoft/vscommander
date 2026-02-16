import * as path from 'path';
import * as fs from 'fs';
import {
    resetStyle, moveTo, DBOX, MBOX, BOX, bgColor
} from './draw';
import { PanelSettings, Theme } from './settings';
import { DirEntry, PaneGeometry, Layout, PaneRenderContext, SortMode } from './types';
import {
    applyStyle, entryRenderStyle, truncatePath, formatClock,
    centerText, formatSizeComma, formatDate, computeStats,
} from './helpers';
import { SYMLINK_ARROW } from './visualPrimitives';

export class Pane {
    cwd: string;
    entries: DirEntry[];
    cursor = 0;
    scroll = 0;
    sortMode: SortMode = 'name';
    colCount: number;
    selected: Set<string> = new Set();

    constructor(cwd: string, settings: PanelSettings) {
        this.cwd = cwd;
        this.colCount = settings.panelColumns;
        this.entries = Pane.readDir(cwd, settings, this.sortMode);
    }

    toggleSelection(idx: number): void {
        const entry = this.entries[idx];
        if (!entry || entry.name === '..') return;
        if (this.selected.has(entry.name)) {
            this.selected.delete(entry.name);
        } else {
            this.selected.add(entry.name);
        }
    }

    clearSelection(): void {
        this.selected.clear();
    }

    invertSelection(): void {
        for (const entry of this.entries) {
            if (entry.name === '..') continue;
            if (this.selected.has(entry.name)) {
                this.selected.delete(entry.name);
            } else {
                this.selected.add(entry.name);
            }
        }
    }

    selectByPattern(pattern: string, select: boolean): void {
        const regex = this.patternToRegex(pattern);
        for (const entry of this.entries) {
            if (entry.name === '..' || entry.isDir) continue;
            if (regex.test(entry.name)) {
                if (select) {
                    this.selected.add(entry.name);
                } else {
                    this.selected.delete(entry.name);
                }
            }
        }
    }

    private patternToRegex(pattern: string): RegExp {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        const withWildcards = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp('^' + withWildcards + '$', 'i');
    }

    get selectionStats(): { count: number; bytes: number } {
        let count = 0;
        let bytes = 0;
        for (const entry of this.entries) {
            if (this.selected.has(entry.name)) {
                count++;
                if (!entry.isDir) bytes += entry.size;
            }
        }
        return { count, bytes };
    }

    refresh(settings: PanelSettings): void {
        this.entries = Pane.readDir(this.cwd, settings, this.sortMode);
        this.cursor = Math.min(this.cursor, Math.max(0, this.entries.length - 1));
    }

    navigateInto(entry: DirEntry, settings: PanelSettings): void {
        this.cwd = path.join(this.cwd, entry.name);
        this.entries = Pane.readDir(this.cwd, settings, this.sortMode);
        this.cursor = 0;
        this.scroll = 0;
        this.selected.clear();
    }

    navigateUp(settings: PanelSettings, pageCapacity: number): void {
        const oldDirName = path.basename(this.cwd);
        this.cwd = path.dirname(this.cwd);
        this.entries = Pane.readDir(this.cwd, settings, this.sortMode);
        const idx = this.entries.findIndex(e => e.name === oldDirName);
        this.cursor = idx >= 0 ? idx : 0;
        this.ensureCursorVisible(pageCapacity);
        this.selected.clear();
    }

    ensureCursorVisible(pageCapacity: number): void {
        if (this.cursor < this.scroll) {
            this.scroll = this.cursor;
        } else if (this.cursor >= this.scroll + pageCapacity) {
            this.scroll = this.cursor - pageCapacity + 1;
        }
    }

    render(ctx: PaneRenderContext): string {
        const out: string[] = [];
        out.push(this.renderTopBorder(ctx));
        out.push(this.renderColumnHeaders(ctx));
        out.push(this.renderVerticalBorders(ctx));
        out.push(this.renderFileList(ctx));
        out.push(this.renderSeparator(ctx));
        out.push(this.renderInfoBar(ctx));
        out.push(this.renderBottomBorder(ctx));
        return out.join('');
    }

    static readDir(dirPath: string, settings: PanelSettings, sortMode: SortMode = 'name'): DirEntry[] {
        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            const entries: DirEntry[] = [];
            if (path.dirname(dirPath) !== dirPath) {
                entries.push({ name: '..', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date(0) });
            }
            for (const item of items) {
                if (!settings.showDotfiles && item.name.startsWith('.')) continue;
                if (item.name.startsWith('.') && item.name === '..') continue;
                const fullPath = path.join(dirPath, item.name);
                let size = 0;
                let mtime = new Date(0);
                let isDir = item.isDirectory();
                const isSymlink = item.isSymbolicLink();
                let linkTarget = '';
                try {
                    const stat = fs.statSync(fullPath);
                    size = stat.size;
                    mtime = stat.mtime;
                    if (isSymlink) {
                        isDir = stat.isDirectory();
                        linkTarget = fs.readlinkSync(fullPath);
                    }
                } catch {
                    if (isSymlink) {
                        try { linkTarget = fs.readlinkSync(fullPath); } catch { /* broken link */ }
                    }
                }
                entries.push({
                    name: item.name,
                    isDir,
                    isSymlink,
                    linkTarget,
                    size,
                    mtime,
                });
            }
            Pane.sortEntries(entries, sortMode, settings.sortDirsFirst);
            return entries;
        } catch {
            const fallback: DirEntry[] = [];
            if (path.dirname(dirPath) !== dirPath) {
                fallback.push({ name: '..', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date(0) });
            }
            return fallback;
        }
    }

    private static getExtension(name: string): string {
        const dot = name.lastIndexOf('.');
        return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
    }

    private static sortEntries(entries: DirEntry[], sortMode: SortMode, dirsFirst: boolean): void {
        entries.sort((a, b) => {
            if (a.name === '..') return -1;
            if (b.name === '..') return 1;
            if (dirsFirst && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            switch (sortMode) {
                case 'extension': {
                    const extA = Pane.getExtension(a.name);
                    const extB = Pane.getExtension(b.name);
                    const cmp = extA.localeCompare(extB);
                    return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
                }
                case 'size':
                    return a.size !== b.size ? a.size - b.size : a.name.localeCompare(b.name);
                case 'date':
                    return b.mtime.getTime() - a.mtime.getTime() || a.name.localeCompare(b.name);
                case 'unsorted':
                    return 0;
                case 'name':
                default:
                    return a.name.localeCompare(b.name);
            }
        });
    }

    private renderTopBorder(ctx: PaneRenderContext): string {
        const { geo, layout, theme: t, isActive, showClock } = ctx;
        const border = applyStyle(t.border.idle);
        const pathStyle = applyStyle(isActive ? t.activePath.idle : t.inactivePath.idle);

        let clock = '';
        if (showClock) {
            clock = ' ' + formatClock() + ' ';
        }
        const clockStyle = applyStyle(t.clock.idle);

        const pathMaxLen = Math.max(1, geo.width - 4 - clock.length);
        const pathStr = ' ' + truncatePath(this.cwd, pathMaxLen) + ' ';

        const fill = geo.width - 2 - pathStr.length - clock.length;
        const fillLeft = Math.max(0, Math.floor(fill / 2));
        const fillRight = Math.max(0, fill - fillLeft);

        let out = border + moveTo(layout.topRow, geo.startCol);
        out += DBOX.topLeft;
        out += DBOX.horizontal.repeat(fillLeft);
        out += pathStyle + pathStr;
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

    private renderColumnHeaders(ctx: PaneRenderContext): string {
        const { geo, layout, theme: t, isActive } = ctx;
        const border = applyStyle(t.border.idle);
        const header = applyStyle(t.header.idle);
        const out: string[] = [];

        out.push(border + moveTo(layout.headerRow, geo.startCol) + DBOX.vertical);
        for (let i = 0; i < geo.numCols; i++) {
            out.push(header + centerText('Name', geo.colWidths[i]));
            out.push(resetStyle());
            if (i < geo.numCols - 1) {
                out.push(border + BOX.vertical);
            }
        }
        out.push(border + DBOX.vertical);
        out.push(resetStyle());
        return out.join('');
    }

    private renderFileList(ctx: PaneRenderContext): string {
        const { geo, layout, theme: t, isActive, selected } = ctx;
        const out: string[] = [];
        const { listStart, listHeight } = layout;
        const emptyBg = bgColor(t.border.idle.bg);

        for (let col = 0; col < geo.numCols; col++) {
            for (let row = 0; row < listHeight; row++) {
                const idx = this.scroll + col * listHeight + row;
                const screenRow = listStart + row;
                const colStart = geo.colStarts[col];
                const colWidth = geo.colWidths[col];

                if (idx < this.entries.length) {
                    const entry = this.entries[idx];
                    const isCursor = isActive && idx === this.cursor;
                    const isSel = selected !== undefined && selected.has(entry.name);
                    const rs = entryRenderStyle(entry, t, isSel);
                    const style = isCursor ? rs.selected : rs.idle;
                    out.push(applyStyle(style));

                    if (entry.isSymlink && colWidth >= 3) {
                        const arrowStr = ' ' + SYMLINK_ARROW;
                        const maxName = colWidth - arrowStr.length;
                        const displayName = entry.name.slice(0, maxName);
                        const pad = ' '.repeat(Math.max(0, colWidth - displayName.length - arrowStr.length));
                        const symlinkStyle = isCursor ? t.symlink.selected : t.symlink.idle;
                        out.push(moveTo(screenRow, colStart) + displayName);
                        out.push(applyStyle(symlinkStyle) + arrowStr + applyStyle(style) + pad);
                    } else {
                        const displayName = entry.name.slice(0, colWidth);
                        const pad = ' '.repeat(Math.max(0, colWidth - displayName.length));
                        out.push(moveTo(screenRow, colStart) + displayName + pad);
                    }
                    out.push(resetStyle());
                } else {
                    out.push(emptyBg + moveTo(screenRow, colStart) + ' '.repeat(colWidth));
                }
            }
        }
        out.push(resetStyle());
        return out.join('');
    }

    private renderVerticalBorders(ctx: PaneRenderContext): string {
        const { geo, layout, theme: t } = ctx;
        const out: string[] = [];
        const { listStart, listHeight } = layout;
        const border = applyStyle(t.border.idle);

        for (let i = 0; i < listHeight; i++) {
            const row = listStart + i;
            out.push(border + moveTo(row, geo.startCol) + DBOX.vertical);
            out.push(border + moveTo(row, geo.startCol + geo.width - 1) + DBOX.vertical);
            for (const dc of geo.dividerCols) {
                out.push(border + moveTo(row, dc) + BOX.vertical);
            }
        }
        out.push(resetStyle());
        return out.join('');
    }

    private renderSeparator(ctx: PaneRenderContext): string {
        const { geo, layout, theme: t } = ctx;
        const border = applyStyle(t.border.idle);
        let out = border + moveTo(layout.separatorRow, geo.startCol);
        out += MBOX.vertDoubleRight;

        for (let i = 0; i < geo.numCols; i++) {
            out += BOX.horizontal.repeat(geo.colWidths[i]);
            if (i < geo.numCols - 1) {
                out += BOX.teeUp;
            }
        }

        out += MBOX.vertDoubleLeft;
        out += resetStyle();
        return out;
    }

    private renderInfoBar(ctx: PaneRenderContext): string {
        const { geo, layout, theme: t } = ctx;
        const border = applyStyle(t.border.idle);
        const content = applyStyle(t.info.idle);
        const innerWidth = geo.width - 2;
        const entry = this.entries[this.cursor];

        if (!entry) {
            return border + moveTo(layout.infoRow, geo.startCol) + DBOX.vertical
                + content + ' '.repeat(innerWidth)
                + border + DBOX.vertical + resetStyle();
        }

        const name = entry.name;
        const sizeStr = entry.isDir ? '<DIR>' : formatSizeComma(entry.size);
        const dateStr = entry.name === '..' ? '' : formatDate(entry.mtime);
        const right = sizeStr + '  ' + dateStr;

        if (entry.isSymlink) {
            const arrow = ' ' + SYMLINK_ARROW + ' ';
            const target = entry.linkTarget;
            const linkPart = arrow + target;
            const availForName = innerWidth - right.length - 2;
            const nameAndLink = name + linkPart;
            let displayLeft: string;
            if (nameAndLink.length > availForName) {
                const minTarget = 3;
                if (name.length + arrow.length + minTarget > availForName) {
                    const truncName = name.slice(0, Math.max(1, availForName - arrow.length - minTarget - 1)) + '~';
                    displayLeft = truncName + arrow + '...';
                } else {
                    const targetSpace = availForName - name.length - arrow.length;
                    displayLeft = name + arrow + '...' + target.slice(target.length - targetSpace + 3);
                }
            } else {
                displayLeft = nameAndLink;
            }
            const gap = ' '.repeat(Math.max(1, innerWidth - displayLeft.length - right.length));
            const arrowIdx = displayLeft.indexOf(SYMLINK_ARROW);
            const beforeArrow = displayLeft.slice(0, arrowIdx);
            const afterArrow = displayLeft.slice(arrowIdx + 1);
            return border + moveTo(layout.infoRow, geo.startCol) + DBOX.vertical
                + content
                + beforeArrow + applyStyle(t.symlink.idle) + SYMLINK_ARROW + content + afterArrow
                + gap + right
                + border + moveTo(layout.infoRow, geo.startCol + geo.width - 1) + DBOX.vertical
                + resetStyle();
        }

        const availForName = innerWidth - right.length - 2;
        const displayName = name.length > availForName ? name.slice(0, Math.max(1, availForName - 1)) + '~' : name;
        const gap = ' '.repeat(Math.max(1, innerWidth - displayName.length - right.length));

        return border + moveTo(layout.infoRow, geo.startCol) + DBOX.vertical
            + content
            + displayName + gap + right
            + border + moveTo(layout.infoRow, geo.startCol + geo.width - 1) + DBOX.vertical
            + resetStyle();
    }

    private renderBottomBorder(ctx: PaneRenderContext): string {
        const { geo, layout, theme: t, selected } = ctx;
        const border = applyStyle(t.border.idle);
        const stats = computeStats(this.entries);
        const sel = this.selectionStats;
        let statsText: string;
        if (sel.count > 0) {
            statsText = ' ' + formatSizeComma(sel.bytes) + ' in ' + sel.count + ' file' + (sel.count > 1 ? 's' : '') + ' ';
        } else {
            statsText = ' Bytes: ' + formatSizeComma(stats.totalBytes)
                + ', files: ' + stats.fileCount
                + ', dirs: ' + stats.dirCount + ' ';
        }

        const innerWidth = geo.width - 2;
        const fill = innerWidth - statsText.length;
        const fillLeft = Math.max(0, Math.floor(fill / 2));
        const fillRight = Math.max(0, fill - fillLeft);

        return border
            + moveTo(layout.bottomRow, geo.startCol)
            + DBOX.bottomLeft
            + DBOX.horizontal.repeat(fillLeft)
            + applyStyle(t.status.idle)
            + statsText
            + border
            + DBOX.horizontal.repeat(fillRight)
            + DBOX.bottomRight
            + resetStyle();
    }
}
