import { FrameBuffer } from '../frameBuffer';
import { Theme } from '../settings';
import { FormTheme, FormComponent } from './formView';
import { InputControl } from './inputControl';
import { KEY_UP, KEY_DOWN } from '../keys';

// A single ASCII character used as the dropdown indicator (rendered yellow
// via the form theme's hotkey style).
export const DROPDOWN_ARROW = 'v';

// A generic input box with an optional dropdown. Constructed with a list of
// options it shows one yellow ASCII arrow on the right and Up/Down cycle the
// value; with no options it is a plain input box and shows no arrow.
//
// Wired into a FormView via addComponent(); derive specialized selectors from
// it (see UserDropdown / GroupDropdown in windows/file-attributes).
export class ComboBox implements FormComponent {
    readonly input: InputControl;
    readonly height = 1;
    readonly focusStops = 1;
    private label: string;
    private labelWidth: number;
    private options: string[];
    private optIdx = -1;

    constructor(label: string, labelWidth: number, width: number,
                initial: string, options: string[] = []) {
        this.label = label;
        this.labelWidth = labelWidth;
        this.input = new InputControl(width);
        this.input.reset(initial);
        this.options = options;
        this.optIdx = options.indexOf(initial);
    }

    get hasDropdown(): boolean {
        return this.options.length > 0;
    }

    get value(): string {
        return this.input.buffer;
    }

    handleInput(data: string): boolean {
        if (this.hasDropdown && (data === KEY_UP || data === KEY_DOWN)) {
            this.optIdx = data === KEY_DOWN
                ? (this.optIdx + 1) % this.options.length
                : (this.optIdx - 1 + this.options.length) % this.options.length;
            this.input.reset(this.options[this.optIdx]);
            return true;
        }
        return this.input.handleInput(data);
    }

    resetBlink(): void {
        this.input.resetBlink();
    }

    // Blink the input caret.
    renderBlink(absRow: number, absCol: number, _subFocus: number, ft: FormTheme): string {
        return this.input.renderBlink(absRow, absCol + this.labelWidth,
            ft.input.idle, ft.inputCursor.idle);
    }

    render(fb: FrameBuffer, row: number, col: number, innerWidth: number,
           focused: boolean, _subFocus: number, ft: FormTheme, _theme: Theme): void {
        fb.write(row, col, ' '.repeat(innerWidth), ft.body.idle);
        if (this.label) {
            fb.write(row, col + 2, this.label, ft.label.idle);
        }
        const inputCol = col + this.labelWidth;
        fb.blit(row, inputCol,
            this.input.renderToBuffer(ft.input.idle, ft.inputCursor.idle, focused));
        if (this.hasDropdown) {
            fb.write(row, inputCol + this.input.width + 1, DROPDOWN_ARROW, ft.hotkey.idle);
        }
    }
}
