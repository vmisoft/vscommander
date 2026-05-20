import { BOX } from '../../draw';
import { FrameBuffer } from '../../frameBuffer';
import { Theme } from '../../settings';
import { FormTheme, FormComponent } from '../../components/formView';
import { ScrollIndicator } from '../../components/scrollIndicator';
import { HelpLine } from '../../helpParser';

export interface HelpLink {
    line: number;
    startSpan: number;
    endSpan: number;
    target: string;
}

export interface ViewerAreaState {
    lines: HelpLine[];
    scrollTop: number;
    viewportHeight: number;
    linkPositions: HelpLink[];
    activeLinkIdx: number;
}

// The Help "viewer" pane: rendered help text with header/hotkey/link span
// styling, separators and a scrollbar thumb.
export class HelpViewerArea implements FormComponent {
    readonly focusStops = 1;
    private provider: () => ViewerAreaState;
    private scrollbar = new ScrollIndicator();

    constructor(provider: () => ViewerAreaState) {
        this.provider = provider;
    }

    get height(): number {
        return this.provider().viewportHeight;
    }

    handleInput(): boolean {
        return false;
    }

    private isActiveLink(st: ViewerAreaState, lineIdx: number, spanIdx: number): boolean {
        if (st.activeLinkIdx < 0 || st.activeLinkIdx >= st.linkPositions.length) return false;
        const lp = st.linkPositions[st.activeLinkIdx];
        return lp.line === lineIdx && spanIdx >= lp.startSpan && spanIdx <= lp.endSpan;
    }

    render(fb: FrameBuffer, startRow: number, col: number, innerWidth: number,
           _focused: boolean, _subFocus: number, ft: FormTheme, theme: Theme): void {
        const st = this.provider();
        const bodyStyle = ft.body.idle;
        const headerStyle = ft.label.idle;
        const hotkeyStyle = ft.hotkey.idle;
        const linkStyle = theme.helpLink.idle;
        const linkSelectedStyle = theme.helpLink.selected;
        const end = Math.min(st.lines.length, st.scrollTop + st.viewportHeight);
        const cx = col + 1;
        const cw = innerWidth - 2;

        for (let i = st.scrollTop; i < end; i++) {
            const row = startRow + (i - st.scrollTop);
            const line = st.lines[i];

            if (line.isSeparator) {
                fb.write(row, cx, BOX.horizontal.repeat(cw), bodyStyle);
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
                    style = this.isActiveLink(st, i, j) ? linkSelectedStyle : linkStyle;
                }

                fb.write(row, x, text, style);
                x += text.length;
            }
        }

        this.scrollbar.render(fb, startRow, col, innerWidth, st.viewportHeight,
            st.lines.length, st.scrollTop, bodyStyle);
    }
}
