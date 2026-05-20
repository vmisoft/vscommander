import { FrameBuffer } from '../../frameBuffer';
import { Theme } from '../../settings';
import { FormTheme, FormComponent } from '../../components/formView';
import { ButtonGroup } from '../../components/buttonGroup';

// A non-focusable row that renders a ButtonGroup whose selection and focus
// state are driven externally by the owning window.
export class ButtonsRow implements FormComponent {
    readonly focusStops = 0;
    readonly height = 1;

    constructor(private group: ButtonGroup, private focused: () => boolean) {}

    handleInput(): boolean {
        return false;
    }

    render(fb: FrameBuffer, row: number, col: number, innerWidth: number,
           _focused: boolean, _subFocus: number, ft: FormTheme, _theme: Theme): void {
        fb.blit(row, col, this.group.renderToBuffer(
            innerWidth, ft.body.idle, ft.button.idle, ft.button.selected, this.focused()));
    }
}
