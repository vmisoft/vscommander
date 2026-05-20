import { FrameBuffer } from '../frameBuffer';
import { TextStyle } from '../settings';

// A one-cell scrollbar thumb drawn over the right border of a scrolling area.
// Renders nothing when all content fits.
export class ScrollIndicator {
    render(fb: FrameBuffer, startRow: number, col: number, innerWidth: number,
           viewportHeight: number, totalLines: number, scrollPos: number,
           style: TextStyle): void {
        if (totalLines <= viewportHeight || viewportHeight <= 0) return;
        const thumbPos = Math.floor(
            scrollPos * (viewportHeight - 1) / Math.max(1, totalLines - viewportHeight));
        const thumbRow = startRow + Math.min(thumbPos, viewportHeight - 1);
        fb.write(thumbRow, col + innerWidth, '█', style);
    }
}
