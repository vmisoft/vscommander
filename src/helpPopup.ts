import { BOX } from './draw';
import { Theme } from './settings';
import { PopupInputResult } from './popup';
import { ComposedPopup } from './composedPopup';
import { FormTheme, helpFormTheme } from './formView';
import { FrameBuffer } from './frameBuffer';
import { CheckboxControl } from './checkboxControl';
import { HelpLine, HelpTopic, loadHelpTopics, loadHelpFile, parseHelpFile } from './helpParser';
import {
    KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT,
    KEY_HOME, KEY_HOME_ALT, KEY_END, KEY_END_ALT,
    KEY_PAGE_UP, KEY_PAGE_DOWN, KEY_TAB, KEY_SHIFT_TAB, KEY_ENTER,
    KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_BACKSPACE, KEY_BACKSPACE_ALT,
} from './keys';

interface HistoryEntry {
    topic: string;
    scrollTop: number;
    activeLinkIdx: number;
}

export class HelpPopup extends ComposedPopup {
    private mode: 'contents' | 'viewer' = 'contents';
    private topics: HelpTopic[] = [];
    private cursor = 0;
    private scrollTop = 0;
    private lines: HelpLine[] = [];
    private currentTopic = '';
    private history: HistoryEntry[] = [];
    private docsDir = '';
    private linkPositions: { line: number; startSpan: number; endSpan: number; target: string }[] = [];
    private activeLinkIdx = -1;
    private contentsScroll = 0;
    private interceptF1Cb = new CheckboxControl('Intercept F1 key to show this window', false);

    get interceptF1(): boolean { return this.interceptF1Cb.checked; }
    get interceptF1Changed(): boolean { return this.interceptF1Cb.changed; }
    set interceptF1Changed(v: boolean) { this.interceptF1Cb.changed = v; }

    constructor() {
        super();
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

    private get contentsItemCount(): number {
        return this.topics.length + 2;
    }

    private get isOnCheckbox(): boolean {
        return this.cursor === this.topics.length + 1;
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
        this.buildContentsView();
        super.open();
    }

    close(): void {
        super.close();
        this.history = [];
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        if (this.activeView) {
            this.activeView.minWidth = this.popupWidth;
        }
        return super.renderToBuffer(theme);
    }

    // --- Contents view ---

    private buildContentsView(): void {
        this.mode = 'contents';
        const view = this.createView('Help', undefined, helpFormTheme);
        view.minWidth = this.popupWidth;

        view.addCustom(() => this.viewportHeight, true, (fb, row, col, innerWidth, _focused, ft, theme) => {
            this.renderContentsArea(fb, row, col, innerWidth, ft, theme);
        });

        view.onInput = (data) => this.handleContentsInput(data);
        view.onScroll = (up) => {
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
        };

        this.setActiveView(view);
    }

    private renderContentsArea(fb: FrameBuffer, startRow: number, col: number,
                               innerWidth: number, ft: FormTheme, theme: Theme): void {
        const bodyStyle = ft.body.idle;
        const linkStyle = theme.helpLink.idle;
        const linkSelectedStyle = theme.helpLink.selected;
        const vp = this.viewportHeight;
        const end = Math.min(this.contentsItemCount, this.contentsScroll + vp);
        const cx = col + 1;
        const cw = innerWidth - 2;

        for (let i = this.contentsScroll; i < end; i++) {
            const row = startRow + (i - this.contentsScroll);

            if (i < this.topics.length) {
                const topic = this.topics[i];
                const isSelected = i === this.cursor;
                const style = isSelected ? linkSelectedStyle : linkStyle;
                const prefix = isSelected ? ' > ' : '   ';
                const label = prefix + topic.title;
                const padded = label.length < cw ? label + ' '.repeat(cw - label.length) : label.slice(0, cw);
                fb.write(row, cx, padded, style);
            } else if (i === this.topics.length + 1) {
                this.interceptF1Cb.render(fb, row, cx, cw, linkStyle, linkSelectedStyle, this.isOnCheckbox);
            }
        }

        this.renderScrollIndicator(fb, startRow, col, innerWidth, bodyStyle,
            this.contentsItemCount, this.contentsScroll);
    }

    private handleContentsInput(data: string): PopupInputResult | null {
        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            if (this.mode === 'viewer') {
                return this.goBack();
            }
            this.close();
            return { action: 'close', confirm: false };
        }

        const lastIdx = this.contentsItemCount - 1;
        if (data === KEY_UP) {
            if (this.cursor > 0) {
                this.cursor--;
                if (this.cursor === this.topics.length) this.cursor--;
            }
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === KEY_DOWN) {
            if (this.cursor < lastIdx) {
                this.cursor++;
                if (this.cursor === this.topics.length) this.cursor++;
            }
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === KEY_HOME || data === KEY_HOME_ALT) {
            this.cursor = 0;
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === KEY_END || data === KEY_END_ALT) {
            this.cursor = lastIdx;
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === KEY_PAGE_UP) {
            this.cursor = Math.max(0, this.cursor - this.viewportHeight);
            if (this.cursor === this.topics.length) this.cursor--;
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (data === KEY_PAGE_DOWN) {
            this.cursor = Math.min(lastIdx, this.cursor + this.viewportHeight);
            if (this.cursor === this.topics.length) this.cursor++;
            this.ensureContentsVisible();
            return { action: 'consumed' };
        }
        if (this.isOnCheckbox) {
            if (this.interceptF1Cb.handleInput(data)) return { action: 'consumed' };
            if (data === KEY_ENTER) { this.interceptF1Cb.toggle(); return { action: 'consumed' }; }
        }
        if (data === KEY_ENTER) {
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

    // --- Viewer view ---

    private openTopic(filename: string): void {
        this.mode = 'viewer';
        this.currentTopic = filename;
        this.scrollTop = 0;
        this.activeLinkIdx = -1;
        const content = loadHelpFile(this.docsDir, filename);
        this.lines = parseHelpFile(content, this.innerWidth - 2);
        this.buildLinkPositions();
        this.buildViewerView();
    }

    private buildViewerView(): void {
        const title = this.getTopicTitle();
        const view = this.createView(title, undefined, helpFormTheme);
        view.minWidth = this.popupWidth;

        view.addCustom(() => this.viewportHeight, true, (fb, row, col, innerWidth, _focused, ft, theme) => {
            this.renderViewerArea(fb, row, col, innerWidth, ft, theme);
        });

        view.onInput = (data) => this.handleViewerInput(data);
        view.onScroll = (up) => {
            const maxScroll = Math.max(0, this.lines.length - this.viewportHeight);
            if (up) {
                this.scrollTop = Math.max(0, this.scrollTop - 3);
            } else {
                this.scrollTop = Math.min(maxScroll, this.scrollTop + 3);
            }
        };

        this.setActiveView(view);
    }

    private renderViewerArea(fb: FrameBuffer, startRow: number, col: number,
                             innerWidth: number, ft: FormTheme, theme: Theme): void {
        const bodyStyle = ft.body.idle;
        const headerStyle = ft.label.idle;
        const hotkeyStyle = ft.hotkey.idle;
        const linkStyle = theme.helpLink.idle;
        const linkSelectedStyle = theme.helpLink.selected;
        const vp = this.viewportHeight;
        const end = Math.min(this.lines.length, this.scrollTop + vp);
        const sepChar = BOX.horizontal;
        const cx = col + 1;
        const cw = innerWidth - 2;

        for (let i = this.scrollTop; i < end; i++) {
            const row = startRow + (i - this.scrollTop);
            const line = this.lines[i];

            if (line.isSeparator) {
                fb.write(row, cx, sepChar.repeat(cw), bodyStyle);
                continue;
            }

            if (line.spans.length === 0) continue;

            let x = cx;
            for (let j = 0; j < line.spans.length; j++) {
                const span = line.spans[j];
                if (x >= cx + cw) break;
                const maxLen = cx + cw - x;
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

                fb.write(row, x, text, style);
                x += text.length;
            }
        }

        this.renderScrollIndicator(fb, startRow, col, innerWidth, bodyStyle,
            this.lines.length, this.scrollTop);
    }

    private handleViewerInput(data: string): PopupInputResult | null {
        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            return this.goBack();
        }

        const maxScroll = Math.max(0, this.lines.length - this.viewportHeight);

        if (data === KEY_BACKSPACE || data === KEY_BACKSPACE_ALT) {
            return this.goBack();
        }

        if (data === KEY_UP) {
            if (!this.prevVisibleLink()) {
                if (this.scrollTop > 0) this.scrollTop--;
            }
            return { action: 'consumed' };
        }
        if (data === KEY_DOWN) {
            if (!this.nextVisibleLink()) {
                if (this.scrollTop < maxScroll) this.scrollTop++;
            }
            return { action: 'consumed' };
        }
        if (data === KEY_RIGHT) {
            this.nextLinkOnLine();
            return { action: 'consumed' };
        }
        if (data === KEY_LEFT) {
            this.prevLinkOnLine();
            return { action: 'consumed' };
        }
        if (data === KEY_PAGE_UP) {
            this.scrollTop = Math.max(0, this.scrollTop - this.viewportHeight);
            this.clampActiveLinkToViewport();
            return { action: 'consumed' };
        }
        if (data === KEY_PAGE_DOWN) {
            this.scrollTop = Math.min(maxScroll, this.scrollTop + this.viewportHeight);
            this.clampActiveLinkToViewport();
            return { action: 'consumed' };
        }
        if (data === KEY_HOME || data === KEY_HOME_ALT) {
            this.scrollTop = 0;
            this.clampActiveLinkToViewport();
            return { action: 'consumed' };
        }
        if (data === KEY_END || data === KEY_END_ALT) {
            this.scrollTop = maxScroll;
            this.clampActiveLinkToViewport();
            return { action: 'consumed' };
        }
        if (data === KEY_TAB) {
            this.nextLink();
            return { action: 'consumed' };
        }
        if (data === KEY_SHIFT_TAB) {
            this.prevLink();
            return { action: 'consumed' };
        }
        if (data === KEY_ENTER) {
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

    // --- Navigation helpers ---

    private goBack(): PopupInputResult {
        if (this.history.length > 0) {
            const prev = this.history.pop()!;
            this.openTopic(prev.topic);
            this.scrollTop = prev.scrollTop;
            this.activeLinkIdx = prev.activeLinkIdx;
            return { action: 'consumed' };
        }
        if (this.mode === 'viewer') {
            this.buildContentsView();
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

    private lowerBound(targetLine: number): number {
        let lo = 0, hi = this.linkPositions.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (this.linkPositions[mid].line < targetLine) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    private upperBound(targetLine: number): number {
        let lo = 0, hi = this.linkPositions.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (this.linkPositions[mid].line <= targetLine) lo = mid + 1;
            else hi = mid;
        }
        return lo - 1;
    }

    private nextVisibleLink(): boolean {
        if (this.linkPositions.length === 0) return false;
        const vpEnd = this.scrollTop + this.viewportHeight - 1;
        const currentLine = this.activeLinkIdx >= 0
            ? this.linkPositions[this.activeLinkIdx].line
            : -1;
        const idx = this.lowerBound(currentLine + 1);
        if (idx < this.linkPositions.length && this.linkPositions[idx].line <= vpEnd) {
            this.activeLinkIdx = idx;
            return true;
        }
        return false;
    }

    private prevVisibleLink(): boolean {
        if (this.linkPositions.length === 0) return false;
        const vpStart = this.scrollTop;
        const currentLine = this.activeLinkIdx >= 0
            ? this.linkPositions[this.activeLinkIdx].line
            : this.lines.length;
        const idx = this.upperBound(currentLine - 1);
        if (idx >= 0 && this.linkPositions[idx].line >= vpStart) {
            this.activeLinkIdx = idx;
            return true;
        }
        return false;
    }

    private nextLinkOnLine(): boolean {
        if (this.activeLinkIdx < 0 || this.linkPositions.length === 0) return false;
        const next = this.activeLinkIdx + 1;
        if (next < this.linkPositions.length &&
            this.linkPositions[next].line === this.linkPositions[this.activeLinkIdx].line) {
            this.activeLinkIdx = next;
            return true;
        }
        return false;
    }

    private prevLinkOnLine(): boolean {
        if (this.activeLinkIdx < 0 || this.linkPositions.length === 0) return false;
        const prev = this.activeLinkIdx - 1;
        if (prev >= 0 &&
            this.linkPositions[prev].line === this.linkPositions[this.activeLinkIdx].line) {
            this.activeLinkIdx = prev;
            return true;
        }
        return false;
    }

    private clampActiveLinkToViewport(): void {
        if (this.activeLinkIdx < 0 || this.linkPositions.length === 0) return;
        const vpStart = this.scrollTop;
        const vpEnd = this.scrollTop + this.viewportHeight - 1;
        const linkLine = this.linkPositions[this.activeLinkIdx].line;
        if (linkLine >= vpStart && linkLine <= vpEnd) return;
        if (linkLine < vpStart) {
            const idx = this.lowerBound(vpStart);
            if (idx < this.linkPositions.length && this.linkPositions[idx].line <= vpEnd) {
                this.activeLinkIdx = idx;
            } else {
                this.activeLinkIdx = -1;
            }
        } else {
            const idx = this.upperBound(vpEnd);
            if (idx >= 0 && this.linkPositions[idx].line >= vpStart) {
                this.activeLinkIdx = idx;
            } else {
                this.activeLinkIdx = -1;
            }
        }
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

    private buildLinkPositions(): void {
        this.linkPositions = [];
        for (let i = 0; i < this.lines.length; i++) {
            const spans = this.lines[i].spans;
            let j = 0;
            while (j < spans.length) {
                const s = spans[j];
                if (s.type === 'link' && s.linkTarget) {
                    const target = s.linkTarget;
                    const startSpan = j;
                    while (j + 1 < spans.length &&
                           spans[j + 1].type === 'link' &&
                           spans[j + 1].linkTarget === target) {
                        j++;
                    }
                    this.linkPositions.push({ line: i, startSpan, endSpan: j, target });
                }
                j++;
            }
        }
    }

    private isActiveLink(lineIdx: number, spanIdx: number): boolean {
        if (this.activeLinkIdx < 0 || this.activeLinkIdx >= this.linkPositions.length) return false;
        const lp = this.linkPositions[this.activeLinkIdx];
        return lp.line === lineIdx && spanIdx >= lp.startSpan && spanIdx <= lp.endSpan;
    }

    private getTopicTitle(): string {
        for (const t of this.topics) {
            if (t.file === this.currentTopic) return t.title;
        }
        return this.currentTopic.replace('.md', '');
    }

    // --- Scroll indicator (writes over right border) ---

    private renderScrollIndicator(fb: FrameBuffer, startRow: number, col: number,
                                  innerWidth: number, bodyStyle: import('./settings').TextStyle,
                                  totalLines: number, scrollPos: number): void {
        const vp = this.viewportHeight;
        if (totalLines <= vp) return;

        const trackHeight = vp;
        if (trackHeight <= 0) return;

        const thumbPos = Math.floor(scrollPos * (trackHeight - 1) / Math.max(1, totalLines - vp));
        const thumbRow = startRow + Math.min(thumbPos, trackHeight - 1);
        fb.write(thumbRow, col + innerWidth, '\u2588', bodyStyle);
    }

    // --- Mouse ---

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
        const first = this.lowerBound(lineIdx);
        for (let i = first; i < this.linkPositions.length && this.linkPositions[i].line === lineIdx; i++) {
            const lp = this.linkPositions[i];
            const line = this.lines[lineIdx];
            let col = 2;
            for (let j = 0; j < lp.startSpan; j++) {
                col += line.spans[j].text.length;
            }
            let linkLen = 0;
            for (let j = lp.startSpan; j <= lp.endSpan; j++) {
                linkLen += line.spans[j].text.length;
            }
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

        return null;
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
}
