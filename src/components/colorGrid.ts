import { FrameBuffer } from '../frameBuffer';
import { TextStyle } from '../settings';

// A generic palette grid: a row-major grid of color swatches, three cells
// wide each. The selected swatch is bracketed — angle brackets when focused,
// square brackets otherwise.
export class ColorGrid {
    render(fb: FrameBuffer, row: number, col: number, colors: string[],
           perRow: number, selectedIdx: number, focused: boolean,
           bodyStyle: TextStyle): void {
        const rows = Math.ceil(colors.length / perRow);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < perRow; c++) {
                const idx = r * perRow + c;
                if (idx >= colors.length) break;
                const x = col + c * 3;
                const color = colors[idx];
                const cellStyle: TextStyle = { fg: color, bg: color, bold: false };
                const isSelected = selectedIdx === idx;
                if (isSelected && focused) {
                    fb.write(row + r, x, '<', bodyStyle);
                    fb.write(row + r, x + 1, ' ', cellStyle);
                    fb.write(row + r, x + 2, '>', bodyStyle);
                } else if (isSelected) {
                    fb.write(row + r, x, '[', bodyStyle);
                    fb.write(row + r, x + 1, ' ', cellStyle);
                    fb.write(row + r, x + 2, ']', bodyStyle);
                } else {
                    fb.write(row + r, x, ' ', cellStyle);
                    fb.write(row + r, x + 1, ' ', cellStyle);
                    fb.write(row + r, x + 2, ' ', bodyStyle);
                }
            }
        }
    }
}
