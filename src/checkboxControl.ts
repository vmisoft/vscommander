import { TextStyle } from './settings';
import { FrameBuffer } from './frameBuffer';

export class CheckboxControl {
    checked = false;
    label: string;

    constructor(label: string) {
        this.label = label;
    }

    handleInput(data: string): boolean {
        if (data === ' ') {
            this.checked = !this.checked;
            return true;
        }
        return false;
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
