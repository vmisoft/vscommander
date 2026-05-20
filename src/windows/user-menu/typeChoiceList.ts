import { DBOX } from '../../draw';
import { Theme } from '../../settings';
import { FrameBuffer } from '../../frameBuffer';

// The "New item" choice box: a small bordered list offering Command / Submenu.
export class TypeChoiceList {
    static readonly OPTIONS = ['Command', 'Submenu'];

    render(theme: Theme, cursor: number, padH: number, padV: number): FrameBuffer {
        const t = theme;
        const w = 30;
        const boxH = 5;
        const totalW = w + 2 * padH;
        const totalH = boxH + 2 * padV;
        const boxRow = padV;
        const boxCol = padH;
        const bodyStyle = t.popupActionBody.idle;
        const selectedStyle = t.popupActionText.selected;

        const fb = new FrameBuffer(totalW, totalH);
        fb.fill(0, 0, totalW, totalH, ' ', bodyStyle);
        fb.drawBox(boxRow, boxCol, w, boxH, bodyStyle, DBOX, 'New item');

        for (let i = 0; i < TypeChoiceList.OPTIONS.length; i++) {
            const style = i === cursor ? selectedStyle : bodyStyle;
            const text = '  ' + TypeChoiceList.OPTIONS[i]
                + ' '.repeat(w - 4 - TypeChoiceList.OPTIONS[i].length);
            fb.write(boxRow + 1 + i, boxCol + 1, text, style);
        }

        return fb;
    }
}
