import { resetStyle, moveTo, bgColor } from '../../draw';
import { Theme } from '../../settings';
import { applyStyle } from '../../helpers';

export interface ViewerSearchMatch {
    line: number;
    col: number;
    length: number;
}

// Read-only view of the viewer's state needed to render its content.
export interface ViewerContentModel {
    hexMode: boolean;
    wrapMode: boolean;
    scrollTop: number;
    scrollLeft: number;
    fileLines: string[];
    hexBytes: Buffer | null;
    startByteOffset: number;
    searchMatch: ViewerSearchMatch | null;
    expandTabs(line: string): string;
    wrappedLinesFor(cols: number): string[] | null;
}

// The viewer's scrolling content area: dispatches each visible row to the
// text, word-wrapped or hex-dump renderer.
export class ViewerContentArea {
    render(rows: number, cols: number, theme: Theme, model: ViewerContentModel): string {
        const out: string[] = [];
        const contentHeight = rows - 2;
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

            if (model.hexMode) {
                this.renderHexLine(out, model, i, textStyle, hexStyle);
            } else if (model.wrapMode) {
                this.renderWrappedLine(out, model, i, cols, textStyle);
            } else {
                this.renderTextLine(out, model, i, cols, textStyle, arrowStyle, selectedStyle, bgStr);
            }
        }

        out.push(resetStyle());
        return out.join('');
    }

    private renderTextLine(out: string[], model: ViewerContentModel, viewIdx: number,
                           cols: number, textStyle: string, arrowStyle: string,
                           selectedStyle: string, _bgStr: string): void {
        const lineIdx = model.scrollTop + viewIdx;
        if (lineIdx >= model.fileLines.length) return;

        const rawLine = model.expandTabs(model.fileLines[lineIdx]);
        const visibleStart = model.scrollLeft;
        const visibleLen = cols;
        const segment = rawLine.slice(visibleStart, visibleStart + visibleLen);

        const hasLeftOverflow = visibleStart > 0 && rawLine.length > 0;
        const hasRightOverflow = rawLine.length > visibleStart + visibleLen;

        if (model.searchMatch && model.searchMatch.line === lineIdx) {
            const matchCol = model.searchMatch.col;
            const matchEnd = matchCol + model.searchMatch.length;
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
            out.push(arrowStyle + moveTo(viewIdx + 2, 1) + '«');
        }
        if (hasRightOverflow) {
            out.push(arrowStyle + moveTo(viewIdx + 2, cols) + '»');
        }
    }

    private renderWrappedLine(out: string[], model: ViewerContentModel, viewIdx: number,
                              cols: number, textStyle: string): void {
        const wrapped = model.wrappedLinesFor(cols);
        if (!wrapped) return;
        const lineIdx = model.scrollTop + viewIdx;
        if (lineIdx >= wrapped.length) return;
        out.push(textStyle + wrapped[lineIdx]);
    }

    private renderHexLine(out: string[], model: ViewerContentModel, viewIdx: number,
                          textStyle: string, hexStyle: string): void {
        if (!model.hexBytes) return;

        const lineIdx = model.scrollTop + viewIdx;
        const offset = lineIdx * 16;
        if (offset >= model.hexBytes.length) return;

        const endPos = Math.min(offset + 16, model.hexBytes.length);
        const addrStr = (model.startByteOffset + offset).toString(16).toUpperCase().padStart(10, '0');

        let hexPart = '';
        let textPart = '';
        for (let i = offset; i < offset + 16; i++) {
            if (i === offset + 8) hexPart += '│ ';
            if (i < endPos) {
                const b = model.hexBytes[i];
                hexPart += b.toString(16).toUpperCase().padStart(2, '0') + ' ';
                textPart += (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.';
            } else {
                hexPart += '   ';
                textPart += ' ';
            }
        }

        out.push(hexStyle + addrStr + ': ');
        out.push(textStyle + hexPart);
        out.push(hexStyle + '│ ');
        out.push(textStyle + textPart);
    }
}
