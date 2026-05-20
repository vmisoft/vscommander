import { DBOX } from '../../draw';
import { Theme } from '../../settings';
import { FrameBuffer } from '../../frameBuffer';
import { ScopedMenuItem, MenuViewMode, formatHotkeyDisplay } from '../../userMenu';

export interface BrowseListLayout {
    padH: number;
    padV: number;
    width: number;
    visibleHeight: number;
}

// The User Menu browse view: a bordered, scrollable list of menu items with
// hotkey, submenu and scope markers, scroll arrows and a hotkey hint line.
export class BrowseList {
    render(theme: Theme, viewMode: MenuViewMode, items: ScopedMenuItem[],
           cursor: number, scroll: number, layout: BrowseListLayout): FrameBuffer {
        const t = theme;
        const { padH, padV, width: w, visibleHeight: vh } = layout;
        const innerW = w - 2;
        const boxH = vh + 2;
        const totalW = w + 2 * padH;
        const totalH = boxH + 2 * padV;
        const boxRow = padV;
        const boxCol = padH;
        const bodyStyle = t.popupActionBody.idle;
        const selectedStyle = t.popupActionText.selected;
        const hotkeyStyle = t.popupActionNumber.idle;
        const hotkeySelStyle = t.popupActionNumber.selected;

        let title = 'User Menu';
        if (viewMode === 'user') title = 'User Menu (User)';
        else if (viewMode === 'workspace') title = 'User Menu (Workspace)';

        const fb = new FrameBuffer(totalW, totalH);
        fb.fill(0, 0, totalW, totalH, ' ', bodyStyle);
        fb.drawBox(boxRow, boxCol, w, boxH, bodyStyle, DBOX, title);

        for (let i = 0; i < vh; i++) {
            const idx = scroll + i;
            if (idx >= items.length) break;
            const item = items[idx];
            const isCursor = idx === cursor;
            const rowStyle = isCursor ? selectedStyle : bodyStyle;
            const hkStyle = isCursor ? hotkeySelStyle : hotkeyStyle;

            const hk = formatHotkeyDisplay(item.hotkey);
            const submenuMark = item.submenu ? ' >>' : '   ';
            const scopeMark = ' (' + item.scope[0] + ')';
            const labelSpace = innerW - hk.length - 2 - submenuMark.length - scopeMark.length;
            const displayLabel = item.label.length > labelSpace
                ? item.label.slice(0, labelSpace)
                : item.label + ' '.repeat(Math.max(0, labelSpace - item.label.length));

            const line = ' ' + hk + displayLabel + submenuMark + scopeMark + ' ';
            fb.write(boxRow + 1 + i, boxCol + 1, ' '.repeat(innerW), rowStyle);
            fb.write(boxRow + 1 + i, boxCol + 1, line.slice(0, innerW), rowStyle);
            fb.write(boxRow + 1 + i, boxCol + 2, hk, hkStyle);
        }

        if (scroll > 0) {
            fb.write(boxRow, boxCol + w - 3, '^', bodyStyle);
        }
        if (scroll + vh < items.length) {
            fb.write(boxRow + boxH - 1, boxCol + w - 3, 'v', bodyStyle);
        }

        const hint = 'Ins Del F4 Ctrl+Up/Dn Shift+F2';
        const hintPad = Math.max(0, Math.floor((innerW - hint.length) / 2));
        fb.write(boxRow + boxH - 1, boxCol + 1 + hintPad, hint, bodyStyle);

        return fb;
    }
}
