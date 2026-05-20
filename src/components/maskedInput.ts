import { FrameBuffer } from '../frameBuffer';
import { Theme } from '../settings';
import { moveTo, resetStyle } from '../draw';
import { applyStyle } from '../helpers';
import { KEY_SPACE, KEY_BACKSPACE } from '../keys';
import { FormTheme, FormComponent } from './formView';

// A generic opt-in masked digit field: a leading enable checkbox plus a
// fixed-template field that only accepts digits into its placeholder slots.
// In the template, every letter marks a digit slot and every other character
// is a fixed separator (e.g. 'YYYY-MM-DD hh:mm:ss', 'NNN-NNN-NNNN').
// Specialized fields derive from this and override validate() / read the
// typed digits via rawDigits().
export class MaskedInput implements FormComponent {
    enabled = false;
    protected digits = '';
    protected label: string;
    protected template: string;
    protected digitPos: number[];
    protected fieldOffset: number;
    private blinkOn = true;
    readonly height = 1;
    readonly focusStops = 1;

    constructor(label: string, template: string, fieldOffset = 30) {
        this.label = label;
        this.template = template;
        this.fieldOffset = fieldOffset;
        this.digitPos = [];
        for (let i = 0; i < template.length; i++) {
            if (/[A-Za-z]/.test(template[i])) {
                this.digitPos.push(i);
            }
        }
    }

    rawDigits(): string {
        return this.digits;
    }

    get complete(): boolean {
        return this.digits.length === this.digitPos.length;
    }

    // Whether a fully-typed value is acceptable. Overridden by subclasses to
    // add range/parse checks; the default accepts any complete value.
    protected validate(): boolean {
        return true;
    }

    resetBlink(): void {
        this.blinkOn = true;
    }

    handleInput(data: string, _subFocus: number): boolean {
        if (data === KEY_SPACE) {
            this.enabled = !this.enabled;
            return true;
        }
        if (!this.enabled) {
            return false;
        }
        if (data.length === 1 && data >= '0' && data <= '9') {
            if (this.digits.length < this.digitPos.length) {
                this.digits += data;
            }
            return true;
        }
        if (data === KEY_BACKSPACE) {
            this.digits = this.digits.slice(0, -1);
            return true;
        }
        return false;
    }

    // Blink a cursor: on the enable checkbox when disabled, otherwise on the
    // next empty digit slot.
    renderBlink(absRow: number, absCol: number, _subFocus: number, ft: FormTheme): string {
        this.blinkOn = !this.blinkOn;
        let col: number;
        let offChar: string;
        let offStyle = ft.input.idle;
        if (!this.enabled) {
            col = absCol + 3;
            offChar = ' ';
            offStyle = ft.button.selected;
        } else {
            const idx = Math.min(this.digits.length, this.digitPos.length - 1);
            col = absCol + this.fieldOffset + this.digitPos[idx];
            if (idx < this.digits.length) {
                offChar = this.digits[idx];
            } else {
                offChar = this.template[this.digitPos[idx]];
                offStyle = ft.body.idle;
            }
        }
        const ch = this.blinkOn ? '|' : offChar;
        const style = this.blinkOn ? ft.inputCursor.idle : offStyle;
        return moveTo(absRow, col) + applyStyle(style) + ch + resetStyle();
    }

    render(fb: FrameBuffer, row: number, col: number, innerWidth: number,
           focused: boolean, _subFocus: number, ft: FormTheme, _theme: Theme): void {
        const body = ft.body.idle;
        const label = ft.label.idle;
        const value = ft.input.idle;
        const placeholder = ft.body.idle;
        const accent = ft.hotkey.idle;

        fb.write(row, col, ' '.repeat(innerWidth), body);
        const box = '[' + (this.enabled ? 'x' : ' ') + ']';
        fb.write(row, col + 2, box, focused ? ft.button.selected : value);
        fb.write(row, col + 6, this.label, label);

        const fc = col + this.fieldOffset;
        if (!this.enabled) {
            fb.write(row, fc, 'leave unchanged', placeholder);
            return;
        }
        const chars = this.template.split('');
        let di = 0;
        for (const p of this.digitPos) {
            if (di < this.digits.length) {
                chars[p] = this.digits[di];
                di++;
            }
        }
        for (let i = 0; i < chars.length; i++) {
            const isSep = !/[A-Za-z]/.test(this.template[i]);
            const typed = this.digitPos.indexOf(i) >= 0
                && this.digitPos.indexOf(i) < this.digits.length;
            const style = isSep ? label : (typed ? value : placeholder);
            fb.write(row, fc + i, chars[i], style);
        }
        if (this.complete && !this.validate()) {
            fb.write(row, fc + chars.length + 1, '(invalid)', accent);
        }
    }
}
