import { FrameBuffer } from '../../frameBuffer';
import { Theme } from '../../settings';
import { FormTheme, FormComponent } from '../../components/formView';
import { CheckboxControl } from '../../components/checkboxControl';
import { ScrollIndicator } from '../../components/scrollIndicator';
import { HelpTopic } from '../../helpParser';

export interface ContentsAreaState {
    topics: HelpTopic[];
    cursor: number;
    contentsScroll: number;
    viewportHeight: number;
    checkbox: CheckboxControl;
}

// The Help "contents" pane: a scrollable list of topic links plus the
// Intercept-F1 checkbox, with a scrollbar thumb.
export class HelpContentsArea implements FormComponent {
    readonly focusStops = 1;
    private provider: () => ContentsAreaState;
    private scrollbar = new ScrollIndicator();

    constructor(provider: () => ContentsAreaState) {
        this.provider = provider;
    }

    get height(): number {
        return this.provider().viewportHeight;
    }

    handleInput(): boolean {
        return false;
    }

    render(fb: FrameBuffer, startRow: number, col: number, innerWidth: number,
           _focused: boolean, _subFocus: number, ft: FormTheme, theme: Theme): void {
        const st = this.provider();
        const bodyStyle = ft.body.idle;
        const linkStyle = theme.helpLink.idle;
        const linkSelectedStyle = theme.helpLink.selected;
        const itemCount = st.topics.length + 2;
        const checkboxIdx = st.topics.length + 1;
        const end = Math.min(itemCount, st.contentsScroll + st.viewportHeight);
        const cx = col + 1;
        const cw = innerWidth - 2;

        for (let i = st.contentsScroll; i < end; i++) {
            const row = startRow + (i - st.contentsScroll);
            if (i < st.topics.length) {
                const topic = st.topics[i];
                const isSelected = i === st.cursor;
                const style = isSelected ? linkSelectedStyle : linkStyle;
                const prefix = isSelected ? ' > ' : '   ';
                const label = prefix + topic.title;
                const padded = label.length < cw
                    ? label + ' '.repeat(cw - label.length) : label.slice(0, cw);
                fb.write(row, cx, padded, style);
            } else if (i === checkboxIdx) {
                st.checkbox.render(fb, row, cx, cw, linkStyle, linkSelectedStyle,
                    st.cursor === checkboxIdx);
            }
        }

        this.scrollbar.render(fb, startRow, col, innerWidth, st.viewportHeight,
            itemCount, st.contentsScroll, bodyStyle);
    }
}
