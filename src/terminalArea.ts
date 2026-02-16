import { moveTo, resetStyle, bgColor } from './draw';
import { Theme } from './settings';
import { Layout, PaneGeometry } from './types';
import { TerminalBuffer } from './terminalBuffer';

export class TerminalArea {
    render(layout: Layout, activePane: 'left' | 'right', termBuffer: TerminalBuffer, theme: Theme): string {
        const leftIsActive = activePane === 'left';
        const geo = leftIsActive ? layout.rightPane : layout.leftPane;
        return this.renderAt(layout, geo, termBuffer, theme);
    }

    renderAt(layout: Layout, geo: PaneGeometry, termBuffer: TerminalBuffer, theme: Theme): string {
        const out: string[] = [];
        const termBg = bgColor(theme.commandLine.idle.bg);

        const top = layout.topRow;
        const bottom = layout.cmdRow - 1;
        const areaHeight = bottom - top + 1;
        const areaWidth = geo.width;
        const bufStartCol = geo.startCol - 1;

        for (let i = 0; i < areaHeight; i++) {
            const termRow = top - 1 + i;
            const screenRow = top + i;
            out.push(moveTo(screenRow, geo.startCol));
            out.push(termBg);
            out.push(termBuffer.getStyledRowSlice(termRow, bufStartCol, areaWidth));
        }
        out.push(resetStyle());
        return out.join('');
    }
}
