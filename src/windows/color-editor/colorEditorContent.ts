import { hideCursor } from '../../draw';
import { BOX } from '../../draw';
import { Theme, TextStyle } from '../../settings';
import { FrameBuffer } from '../../frameBuffer';
import { FormTheme, FormComponent } from '../../components/formView';
import { InputControl } from '../../components/inputControl';
import { CheckboxControl } from '../../components/checkboxControl';
import { ColorGrid } from '../../components/colorGrid';
import {
    ElementDef, ANSI_PREVIEW_COLORS, LIST_WIDTH, LIST_HEIGHT, CONTENT_HEIGHT,
    FOCUS_STATE, FOCUS_FG_GRID, FOCUS_FG_HEX, FOCUS_BG_GRID, FOCUS_BG_HEX, FOCUS_BOLD,
} from './model';

export interface VisibleElement {
    elem: ElementDef;
    isCurrent: boolean;
    displayIdx: number;
}

export interface ColorEditorContentState {
    visibleElements: VisibleElement[];
    scroll: number;
    editState: 'idle' | 'selected';
    focusArea: number;
    fgGridIndex: number;
    bgGridIndex: number;
    fgHexInput: InputControl;
    bgHexInput: InputControl;
    boldCheckbox: CheckboxControl;
    fgColor: string;
    bgColor: string;
}

// The main two-pane content area of the color editor: the element list on the
// left, and the state radio, foreground/background color grids, hex inputs,
// bold checkbox and sample on the right.
export class ColorEditorContent implements FormComponent {
    readonly focusStops = 1;
    readonly height = CONTENT_HEIGHT;
    private provider: () => ColorEditorContentState;
    private colorGrid = new ColorGrid();

    constructor(provider: () => ColorEditorContentState) {
        this.provider = provider;
    }

    handleInput(): boolean {
        return false;
    }

    resetBlink(): void {
        const st = this.provider();
        st.fgHexInput.resetBlink();
        st.bgHexInput.resetBlink();
    }

    render(fb: FrameBuffer, row: number, col: number, _innerWidth: number,
           _focused: boolean, _subFocus: number, ft: FormTheme, theme: Theme): void {
        const st = this.provider();
        const bodyStyle = ft.body.idle;
        const inputStyle = ft.input.idle;
        const cursorStyle = ft.inputCursor.idle;
        const labelStyle = ft.label.idle;
        const gridBodyStyle = theme.popupInfoBody.idle;

        const rightLeft = col + LIST_WIDTH + 1;

        for (let r = 0; r < LIST_HEIGHT; r++) {
            fb.write(row + r, col + LIST_WIDTH, BOX.vertical, bodyStyle);
        }

        for (let r = 0; r < LIST_HEIGHT; r++) {
            const v = st.visibleElements.find(ve => ve.displayIdx - st.scroll === r);
            if (!v) {
                fb.fill(row + r, col, LIST_WIDTH, 1, ' ', bodyStyle);
                continue;
            }
            const highlightStyle = v.isCurrent ? inputStyle : bodyStyle;
            fb.fill(row + r, col, LIST_WIDTH, 1, ' ', highlightStyle);
            if (v.elem.isGroup) {
                fb.write(row + r, col, v.elem.label.slice(0, LIST_WIDTH), labelStyle);
            } else {
                const prefix = v.isCurrent ? '> ' : '  ';
                const text = (prefix + v.elem.label).slice(0, LIST_WIDTH);
                fb.write(row + r, col, text, highlightStyle);
            }
        }

        const stateLabel = 'State: ';
        fb.write(row, rightLeft + 1, stateLabel, bodyStyle);
        const idleRadio = st.editState === 'idle' ? '(o)' : '( )';
        const selRadio = st.editState === 'selected' ? '(o)' : '( )';
        const stateStyle = st.focusArea === FOCUS_STATE ? inputStyle : bodyStyle;
        fb.write(row, rightLeft + 1 + stateLabel.length, idleRadio + 'Idle ', stateStyle);
        fb.write(row, rightLeft + 1 + stateLabel.length + idleRadio.length + 5, selRadio + 'Selected', stateStyle);

        fb.write(row + 2, rightLeft + 1, 'Foreground:', bodyStyle);
        this.colorGrid.render(fb, row + 3, rightLeft + 1, ANSI_PREVIEW_COLORS, 8,
            st.fgGridIndex, st.focusArea === FOCUS_FG_GRID, gridBodyStyle);

        const dfFg = st.fgGridIndex === 16 ? '<Df>' : ' Df ';
        const dfFgStyle = st.focusArea === FOCUS_FG_GRID && st.fgGridIndex === 16 ? inputStyle : bodyStyle;
        fb.write(row + 5, rightLeft + 1, dfFg, dfFgStyle);
        fb.write(row + 5, rightLeft + 6, 'Hex: ', bodyStyle);
        fb.blit(row + 5, rightLeft + 11, st.fgHexInput.renderToBuffer(
            inputStyle, cursorStyle, st.focusArea === FOCUS_FG_HEX));

        fb.write(row + 7, rightLeft + 1, 'Background:', bodyStyle);
        this.colorGrid.render(fb, row + 8, rightLeft + 1, ANSI_PREVIEW_COLORS, 8,
            st.bgGridIndex, st.focusArea === FOCUS_BG_GRID, gridBodyStyle);

        const dfBg = st.bgGridIndex === 16 ? '<Df>' : ' Df ';
        const dfBgStyle = st.focusArea === FOCUS_BG_GRID && st.bgGridIndex === 16 ? inputStyle : bodyStyle;
        fb.write(row + 10, rightLeft + 1, dfBg, dfBgStyle);
        fb.write(row + 10, rightLeft + 6, 'Hex: ', bodyStyle);
        fb.blit(row + 10, rightLeft + 11, st.bgHexInput.renderToBuffer(
            inputStyle, cursorStyle, st.focusArea === FOCUS_BG_HEX));

        const cbFocused = st.focusArea === FOCUS_BOLD;
        const cbStyle = cbFocused ? inputStyle : bodyStyle;
        fb.blit(row + 12, rightLeft + 1, st.boldCheckbox.renderToBuffer(bodyStyle, cbStyle, cbFocused));

        fb.write(row + 14, rightLeft + 1, 'Sample: ', bodyStyle);
        const sampleStyle: TextStyle = { fg: st.fgColor, bg: st.bgColor, bold: st.boldCheckbox.checked };
        fb.write(row + 14, rightLeft + 9, 'Sample text', sampleStyle);
    }

    renderBlink(absRow: number, absCol: number, _subFocus: number, ft: FormTheme): string {
        const st = this.provider();
        const inputStyle = ft.input.idle;
        const cursorStyle = ft.inputCursor.idle;
        const rightLeft = absCol + LIST_WIDTH + 1;

        let out = '';
        if (st.focusArea === FOCUS_FG_HEX) {
            out += st.fgHexInput.renderBlink(absRow + 5, rightLeft + 11, inputStyle, cursorStyle);
        } else if (st.focusArea === FOCUS_BG_HEX) {
            out += st.bgHexInput.renderBlink(absRow + 10, rightLeft + 11, inputStyle, cursorStyle);
        }
        out += hideCursor();
        return out;
    }
}
