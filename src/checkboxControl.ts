import { TextStyle } from './settings';
import { FrameBuffer } from './frameBuffer';

export class CheckboxControl {
    checked: boolean;
    changed = false;
    label: string;

    constructor(label: string, checked: boolean = false) {
        this.label = label;
        this.checked = checked;
    }

    toggle(): void {
        this.checked = !this.checked;
        this.changed = true;
    }

    handleInput(data: string): boolean {
        if (data === ' ') {
            this.toggle();
            return true;
        }
        return false;
    }

    handleClick(clickRow: number, renderRow: number): boolean {
        if (clickRow === renderRow) {
            this.toggle();
            return true;
        }
        return false;
    }

    render(fb: FrameBuffer, row: number, col: number, width: number,
        bodyStyle: TextStyle, selectedStyle: TextStyle, isSelected: boolean): void {
        const style = isSelected ? selectedStyle : bodyStyle;
        const check = this.checked ? 'x' : ' ';
        const text = ' [' + check + '] ' + this.label;
        const padded = text.length < width ? text + ' '.repeat(width - text.length) : text.slice(0, width);
        fb.write(row, col, padded, style);
    }

    renderToBuffer(style: TextStyle, focusedStyle: TextStyle, focused: boolean): FrameBuffer {
        const check = this.checked ? 'x' : ' ';
        const box = '[' + check + ']';
        const totalWidth = box.length + 1 + this.label.length;
        const fb = new FrameBuffer(totalWidth, 1);
        fb.write(0, 0, box, focused ? focusedStyle : style);
        fb.write(0, box.length, ' ' + this.label, style);
        return fb;
    }
}
