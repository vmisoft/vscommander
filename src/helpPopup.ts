import { DBOX, BOX, MBOX } from './draw';
import { Theme } from './settings';
import { Popup, PopupInputResult } from './popup';
import { FrameBuffer } from './frameBuffer';
import { CheckboxControl } from './checkboxControl';
import { HelpLine, HelpSpan, HelpTopic, loadHelpTopics, loadHelpFile, parseHelpFile } from './helpParser';

interface HistoryEntry {
    topic: string;
    scrollTop: number;
    activeLinkIdx: number;
}

export class HelpPopup extends Popup {
    private mode: 'contents' | 'viewer' = 'contents';
    private topics: HelpTopic[] = [];
    private cursor = 0;
    private scrollTop = 0;
    private lines: HelpLine[] = [];
    private currentTopic = '';
    private history: HistoryEntry[] = [];
    private docsDir = '';
    private linkPositions: { line: number; spanIdx: number; target: string }[] = [];
    private activeLinkIdx = -1;
    private contentsScroll = 0;
    private interceptF1Cb = new CheckboxControl('Intercept F1 key to show this window', true);
    override padding = 0;

    get interceptF1(): boolean { return this.interceptF1Cb.checked; }
    get interceptF1Changed(): boolean { return this.interceptF1Cb.changed; }
    set interceptF1Changed(v: boolean) { this.interceptF1Cb.changed = v; }

    constructor() {
        super();
    }

    openHelp(docsDir: string, interceptF1: boolean): void {
        this.docsDir = docsDir;
        this.topics = loadHelpTopics(docsDir);
        this.mode = 'contents';
        this.cursor = 0;
        this.contentsScroll = 0;
        this.history = [];
        this.scrollTop = 0;
        this.lines = [];
        this.linkPositions = [];
        this.activeLinkIdx = -1;
        this.currentTopic = '';
        this.interceptF1Cb.checked = interceptF1;
        this.interceptF1Cb.changed = false;
        super.open();
    }

    private get contentsItemCount(): number {
        return this.topics.length + 2;
    }

    close(): void {
        super.close();
        this.history = [];
    }

    private get popupWidth(): number {
        return Math.min(78, this.termCols - 8);
    }

    private get popupHeight(): number {
        return Math.min(this.termRows - 4, 40);
    }

    private get innerWidth(): number {
        return this.popupWidth - 2;
    }

    private get viewportHeight(): number {
        return this.popupHeight - 2;
    }

    private openTopic(filename: string): void {
        this.mode = 'viewer';
        this.currentTopic = filename;
        this.scrollTop = 0;
        this.activeLinkIdx = -1;
        const content = loadHelpFile(this.docsDir, filename);
        this.lines = parseHelpFile(content, this.innerWidth - 2);
        this.buildLinkPositions();
    }

    private buildLinkPositions(): void {
        this.linkPositions = [];
        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i];
            for (let j = 0; j < line.spans.length; j++) {
                if (line.spans[j].type === 'link' && line.spans[j].linkTarget) {
                    this.linkPositions.push({ line: i, spanIdx: j, target: line.spans[j].linkTarget! });
                }
            }
        }
    }

    handleInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            if (this.mode === 'viewer') {
                return this.goBack();
            }
            this.close();
            return { action: 'close', confirm: false };
        }

        if (this.mode === 'contents') {
            return this.handleContentsInput(data);
        }
        return this.handleViewerInput(data);
    }

    private get isOnCheckbox(): boolean {
        return this.cursor === this.topics.length + 1;
    }

    private handleContentsInput(data: string): PopupInputResult {
        const lastIdx = this.contentsItemCount - 1;
        if (data === '\x1b[A') {
            if (this.cursor > 0) {
                this.cursor--;
                if (this.cursor === this.topics.length) this.cursor--;
            }
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === '\x1b[B') {
            if (this.cursor < lastIdx) {
                this.cursor++;
                if (this.cursor === this.topics.length) this.cursor++;
            }
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === '\x1b[H' || data === '\x1b[1~') {
            this.cursor = 0;
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === '\x1b[F' || data === '\x1b[4~') {
            this.cursor = lastIdx;
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === '\x1b[5~') {
            this.cursor = Math.max(0, this.cursor - this.viewportHeight);
            if (this.cursor === this.topics.length) this.cursor--;
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === '\x1b[6~') {
            this.cursor = Math.min(lastIdx, this.cursor + this.viewportHeight);
            if (this.cursor === this.topics.length) this.cursor++;
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (this.isOnCheckbox) {
            if (this.interceptF1Cb.handleInput(data)) return { action: 'consumed' };
            if (data === '\r') { this.interceptF1Cb.toggle(); return { action: 'consumed' }; }
        }
        if (data === '\r') {
            if (this.topics.length > 0 && this.cursor < this.topics.length) {
                this.openTopic(this.topics[this.cursor].file);
            }
            return { action: 'consumed' };
        }
        return { action: 'consumed' };
    }

    private ensureContentsVisible(): void {
        if (this.cursor < this.contentsScroll) {
            this.contentsScroll = this.cursor;
        }
        if (this.cursor >= this.contentsScroll + this.viewportHeight) {
            this.contentsScroll = this.cursor - this.viewportHeight + 1;
        }
    }

    private handleViewerInput(data: string): PopupInputResult {
        const maxScroll = Math.max(0, this.lines.length - this.viewportHeight);

        if (data === '\x7f' || data === '\x08') {
            return this.goBack();
        }

        if (data === '\x1b[A') {
            if (this.scrollTop > 0) this.scrollTop--;
            return { action: 'consumed' };
        }
        if (data === '\x1b[B') {
            if (this.scrollTop < maxScroll) this.scrollTop++;
            return { action: 'consumed' };
        }
        if (data === '\x1b[5~') {
            this.scrollTop = Math.max(0, this.scrollTop - this.viewportHeight);
            return { action: 'consumed' };
        }
        if (data === '\x1b[6~') {
            this.scrollTop = Math.min(maxScroll, this.scrollTop + this.viewportHeight);
            return { action: 'consumed' };
        }
        if (data === '\x1b[H' || data === '\x1b[1~') {
            this.scrollTop = 0;
            return { action: 'consumed' };
        }
        if (data === '\x1b[F' || data === '\x1b[4~') {
            this.scrollTop = maxScroll;
            return { action: 'consumed' };
        }
        if (data === '\t') {
            this.nextLink();
            return { action: 'consumed' };
        }
        if (data === '\x1b[Z') {
            this.prevLink();
            return { action: 'consumed' };
        }
        if (data === '\r') {
            if (this.activeLinkIdx >= 0 && this.activeLinkIdx < this.linkPositions.length) {
                const target = this.linkPositions[this.activeLinkIdx].target;
                this.history.push({
                    topic: this.currentTopic,
                    scrollTop: this.scrollTop,
                    activeLinkIdx: this.activeLinkIdx,
                });
                this.openTopic(target);
            }
            return { action: 'consumed' };
        }
        return { action: 'consumed' };
    }

    private goBack(): PopupInputResult {
        if (this.history.length > 0) {
            const prev = this.history.pop()!;
            this.openTopic(prev.topic);
            this.scrollTop = prev.scrollTop;
            this.activeLinkIdx = prev.activeLinkIdx;
            return { action: 'consumed' };
        }
        if (this.mode === 'viewer') {
            this.mode = 'contents';
            return { action: 'consumed' };
        }
        this.close();
        return { action: 'close', confirm: false };
    }

    private nextLink(): void {
        if (this.linkPositions.length === 0) return;
        this.activeLinkIdx++;
        if (this.activeLinkIdx >= this.linkPositions.length) {
            this.activeLinkIdx = 0;
        }
        this.ensureLinkVisible();
    }

    private prevLink(): void {
        if (this.linkPositions.length === 0) return;
        this.activeLinkIdx--;
        if (this.activeLinkIdx < 0) {
            this.activeLinkIdx = this.linkPositions.length - 1;
        }
        this.ensureLinkVisible();
    }

    private ensureLinkVisible(): void {
        if (this.activeLinkIdx < 0 || this.activeLinkIdx >= this.linkPositions.length) return;
        const linkLine = this.linkPositions[this.activeLinkIdx].line;
        if (linkLine < this.scrollTop) {
            this.scrollTop = linkLine;
        }
        if (linkLine >= this.scrollTop + this.viewportHeight) {
            this.scrollTop = linkLine - this.viewportHeight + 1;
        }
    }

    override handleMouseScroll(up: boolean): PopupInputResult {
        if (this.mode === 'contents') {
            const lastIdx = this.contentsItemCount - 1;
            if (up) {
                if (this.cursor > 0) {
                    this.cursor--;
                    if (this.cursor === this.topics.length) this.cursor--;
                }
            } else {
                if (this.cursor < lastIdx) {
                    this.cursor++;
                    if (this.cursor === this.topics.length) this.cursor++;
                }
            }
            this.ensureContentsVisible();
        } else {
            const maxScroll = Math.max(0, this.lines.length - this.viewportHeight);
            if (up) {
                this.scrollTop = Math.max(0, this.scrollTop - 3);
            } else {
                this.scrollTop = Math.min(maxScroll, this.scrollTop + 3);
            }
        }
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        const contentRow = fbRow - 1;
        if (contentRow < 0 || contentRow >= this.viewportHeight) return null;

        if (this.mode === 'contents') {
            const idx = this.contentsScroll + contentRow;
            if (idx >= 0 && idx < this.topics.length) {
                if (idx === this.cursor) {
                    this.openTopic(this.topics[this.cursor].file);
                    return { action: 'consumed' };
                }
                this.cursor = idx;
                return { action: 'consumed' };
            }
            const checkboxIdx = this.topics.length + 1;
            if (this.interceptF1Cb.handleClick(idx, checkboxIdx)) {
                this.cursor = checkboxIdx;
                return { action: 'consumed' };
            }
            return null;
        }

        const lineIdx = this.scrollTop + contentRow;
        for (let i = 0; i < this.linkPositions.length; i++) {
            if (this.linkPositions[i].line === lineIdx) {
                const lp = this.linkPositions[i];
                const line = this.lines[lineIdx];
                let col = 1;
                for (let j = 0; j < lp.spanIdx; j++) {
                    col += line.spans[j].text.length;
                }
                const linkLen = line.spans[lp.spanIdx].text.length;
                if (fbCol >= col && fbCol < col + linkLen) {
                    this.activeLinkIdx = i;
                    this.history.push({
                        topic: this.currentTopic,
                        scrollTop: this.scrollTop,
                        activeLinkIdx: this.activeLinkIdx,
                    });
                    this.openTopic(lp.target);
                    return { action: 'consumed' };
                }
            }
        }

        return null;
    }

    render(rows: number, cols: number, theme: Theme): string {
        if (!this.active) return '';

        const w = this.popupWidth;
        const h = this.popupHeight;
        const t = theme;
        const bodyStyle = t.popupInfoBody.idle;
        const headerStyle = t.popupInfoLabel.idle;
        const hotkeyStyle = t.popupInfoHotkey.idle;
        const linkStyle = t.helpLink.idle;
        const linkSelectedStyle = t.helpLink.selected;

        const fb = new FrameBuffer(w, h);
        fb.fill(0, 0, w, h, ' ', bodyStyle);

        if (this.mode === 'contents') {
            fb.drawBox(0, 0, w, h, bodyStyle, DBOX, 'Help');
            this.renderContents(fb, bodyStyle, headerStyle, linkStyle, linkSelectedStyle);
        } else {
            const title = this.getTopicTitle();
            fb.drawBox(0, 0, w, h, bodyStyle, DBOX, title);
            this.renderViewer(fb, bodyStyle, headerStyle, hotkeyStyle, linkStyle, linkSelectedStyle);
        }

        this.renderScrollIndicator(fb, bodyStyle);

        const baseRow = Math.floor((rows - h) / 2) + 1;
        const baseCol = Math.floor((cols - w) / 2) + 1;
        this.setScreenPosition(baseRow, baseCol, w, h);
        return fb.toAnsi(this.screenRow, this.screenCol);
    }

    private renderContents(fb: FrameBuffer,
        bodyStyle: import('./settings').TextStyle,
        _headerStyle: import('./settings').TextStyle,
        linkStyle: import('./settings').TextStyle,
        linkSelectedStyle: import('./settings').TextStyle): void {

        const vp = this.viewportHeight;
        const iw = this.innerWidth;
        const totalItems = this.contentsItemCount;
        const end = Math.min(totalItems, this.contentsScroll + vp);

        for (let i = this.contentsScroll; i < end; i++) {
            const row = 1 + (i - this.contentsScroll);

            if (i < this.topics.length) {
                const topic = this.topics[i];
                const isSelected = i === this.cursor;
                const style = isSelected ? linkSelectedStyle : linkStyle;
                const prefix = isSelected ? ' > ' : '   ';
                const label = prefix + topic.title;
                const padded = label.length < iw ? label + ' '.repeat(iw - label.length) : label.slice(0, iw);
                fb.write(row, 1, padded, style);
            } else if (i === this.topics.length) {
                // blank separator line
            } else if (i === this.topics.length + 1) {
                this.interceptF1Cb.render(fb, row, 1, iw, bodyStyle, linkSelectedStyle, this.isOnCheckbox);
            }
        }
    }

    private renderViewer(fb: FrameBuffer,
        bodyStyle: import('./settings').TextStyle,
        headerStyle: import('./settings').TextStyle,
        hotkeyStyle: import('./settings').TextStyle,
        linkStyle: import('./settings').TextStyle,
        linkSelectedStyle: import('./settings').TextStyle): void {

        const vp = this.viewportHeight;
        const iw = this.innerWidth;
        const end = Math.min(this.lines.length, this.scrollTop + vp);
        const sepChar = BOX.horizontal;

        for (let i = this.scrollTop; i < end; i++) {
            const row = 1 + (i - this.scrollTop);
            const line = this.lines[i];

            if (line.isSeparator) {
                fb.write(row, 1, sepChar.repeat(iw), bodyStyle);
                continue;
            }

            if (line.spans.length === 0) continue;

            let col = 1;
            for (let j = 0; j < line.spans.length; j++) {
                const span = line.spans[j];
                if (col >= 1 + iw) break;
                const maxLen = 1 + iw - col;
                const text = span.text.length > maxLen ? span.text.slice(0, maxLen) : span.text;

                let style = bodyStyle;
                if (span.type === 'header') {
                    style = headerStyle;
                } else if (span.type === 'hotkey') {
                    style = hotkeyStyle;
                } else if (span.type === 'link') {
                    const isActiveLink = this.isActiveLink(i, j);
                    style = isActiveLink ? linkSelectedStyle : linkStyle;
                }

                fb.write(row, col, text, style);
                col += text.length;
            }
        }
    }

    private isActiveLink(lineIdx: number, spanIdx: number): boolean {
        if (this.activeLinkIdx < 0 || this.activeLinkIdx >= this.linkPositions.length) return false;
        const lp = this.linkPositions[this.activeLinkIdx];
        return lp.line === lineIdx && lp.spanIdx === spanIdx;
    }

    private renderScrollIndicator(fb: FrameBuffer, bodyStyle: import('./settings').TextStyle): void {
        const h = this.popupHeight;
        const totalLines = this.mode === 'contents' ? this.contentsItemCount : this.lines.length;
        const vp = this.viewportHeight;
        if (totalLines <= vp) return;

        const scroll = this.mode === 'contents' ? this.contentsScroll : this.scrollTop;
        const trackHeight = h - 2;
        if (trackHeight <= 0) return;

        const thumbPos = Math.floor(scroll * (trackHeight - 1) / Math.max(1, totalLines - vp));
        const thumbRow = 1 + Math.min(thumbPos, trackHeight - 1);
        fb.write(thumbRow, this.popupWidth - 1, '\u2588', bodyStyle);
    }

    private getTopicTitle(): string {
        for (const t of this.topics) {
            if (t.file === this.currentTopic) return t.title;
        }
        return this.currentTopic.replace('.md', '');
    }
}
