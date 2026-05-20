import { DBOX, BOX, MBOX } from '../../draw';
import { Theme } from '../../settings';
import { FrameBuffer } from '../../frameBuffer';
import { ButtonGroup } from '../../components/buttonGroup';

export const THEME_LIST_WIDTH = 16;

// The frame of the Change-theme window: the box, the list/preview divider,
// the bottom separator, the theme-name list and the button row.
export class ThemeChrome {
    render(theme: Theme, popupWidth: number, popupHeight: number,
           displayNames: string[], cursor: number, focusArea: number,
           buttonGroup: ButtonGroup): FrameBuffer {
        const bodyStyle = theme.popupInfoBody.idle;
        const listWidth = THEME_LIST_WIDTH;
        const dividerCol = listWidth + 1;
        const sepRow = popupHeight - 3;

        const fb = new FrameBuffer(popupWidth, popupHeight);
        fb.fill(0, 0, popupWidth, popupHeight, ' ', bodyStyle);
        fb.drawBox(0, 0, popupWidth, popupHeight, bodyStyle, DBOX, 'Change theme');

        for (let r = 1; r < sepRow; r++) {
            fb.write(r, dividerCol, BOX.vertical, bodyStyle);
        }

        fb.write(sepRow, 0, MBOX.vertDoubleRight, bodyStyle);
        for (let c = 1; c < popupWidth - 1; c++) {
            fb.write(sepRow, c, c === dividerCol ? BOX.teeUp : BOX.horizontal, bodyStyle);
        }
        fb.write(sepRow, popupWidth - 1, MBOX.vertDoubleLeft, bodyStyle);

        const btnRow = popupHeight - 2;
        fb.blit(btnRow, 1, buttonGroup.renderToBuffer(
            popupWidth - 2, bodyStyle,
            theme.popupInfoButton.idle, theme.popupInfoButton.selected,
            focusArea === 1));

        const listStyle = theme.menuItem.idle;
        const listSelStyle = theme.menuItem.selected;
        for (let i = 0; i < displayNames.length; i++) {
            const row = 1 + i;
            if (row >= sepRow) break;
            const isCursor = i === cursor && focusArea === 0;
            const style = isCursor ? listSelStyle : listStyle;
            const name = (isCursor ? '>' : ' ') + ' ' + displayNames[i];
            fb.write(row, 1, name.slice(0, listWidth).padEnd(listWidth, ' '), style);
        }
        for (let r = 1 + displayNames.length; r < sepRow; r++) {
            fb.write(r, 1, ' '.repeat(listWidth), listStyle);
        }

        return fb;
    }
}
