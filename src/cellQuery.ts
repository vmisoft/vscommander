import { BOX, DBOX, MBOX } from './draw';
import { TextStyle, Theme } from './settings';
import { Layout, PaneGeometry } from './types';
import { entryRenderStyle } from './helpers';
import { Pane } from './pane';

export interface CellQueryContext {
    theme: Theme;
    activePane: 'left' | 'right';
    inactivePaneHidden: boolean;
    quickViewMode: boolean;
    left: Pane;
    right: Pane;
    activePaneObj: Pane;
}

export function getCellAt(
    row: number, col: number, layout: Layout,
    ctx: CellQueryContext,
): { ch: string; style: TextStyle } {
    const t = ctx.theme;
    const border: TextStyle = t.border.idle;

    if (row === layout.fkeyRow) {
        return { ch: ' ', style: t.fkeyLabel.idle };
    }
    if (row === layout.cmdRow) {
        return { ch: ' ', style: t.commandLine.idle };
    }

    const leftIsActive = ctx.activePane === 'left';

    if (ctx.inactivePaneHidden && !ctx.quickViewMode) {
        const hiddenGeo = leftIsActive ? layout.leftPane : layout.rightPane;
        if (col >= hiddenGeo.startCol && col < hiddenGeo.startCol + hiddenGeo.width) {
            return { ch: ' ', style: t.commandLine.idle };
        }
    }

    if (ctx.quickViewMode) {
        const qvGeo = leftIsActive ? layout.rightPane : layout.leftPane;
        if (col >= qvGeo.startCol && col < qvGeo.startCol + qvGeo.width) {
            return getQuickViewCellAt(row, col, layout, qvGeo, t);
        }
    }

    let pane: Pane;
    let geo: PaneGeometry;
    let isActive: boolean;
    if (col <= layout.leftPane.startCol + layout.leftPane.width - 1) {
        pane = ctx.left;
        geo = layout.leftPane;
        isActive = leftIsActive;
    } else {
        pane = ctx.right;
        geo = layout.rightPane;
        isActive = !leftIsActive;
    }

    return getPaneCellAt(row, col, layout, geo, pane, isActive, t);
}

function getQuickViewCellAt(
    row: number, col: number, layout: Layout,
    geo: PaneGeometry, t: Theme,
): { ch: string; style: TextStyle } {
    const border: TextStyle = t.border.idle;
    const leftEdge = geo.startCol;
    const rightEdge = geo.startCol + geo.width - 1;

    if (row === layout.topRow) {
        if (col === leftEdge) return { ch: DBOX.topLeft, style: border };
        if (col === rightEdge) return { ch: DBOX.topRight, style: border };
        return { ch: DBOX.horizontal, style: border };
    }

    if (row === layout.bottomRow) {
        if (col === leftEdge) return { ch: DBOX.bottomLeft, style: border };
        if (col === rightEdge) return { ch: DBOX.bottomRight, style: border };
        return { ch: DBOX.horizontal, style: border };
    }

    if (row === layout.separatorRow) {
        if (col === leftEdge) return { ch: MBOX.vertDoubleRight, style: border };
        if (col === rightEdge) return { ch: MBOX.vertDoubleLeft, style: border };
        return { ch: BOX.horizontal, style: border };
    }

    if (col === leftEdge || col === rightEdge) {
        return { ch: DBOX.vertical, style: border };
    }

    if (row === layout.infoRow) {
        return { ch: ' ', style: t.info.idle };
    }

    return { ch: ' ', style: border };
}

function getPaneCellAt(
    row: number, col: number, layout: Layout,
    geo: PaneGeometry, pane: Pane, isActive: boolean, t: Theme,
): { ch: string; style: TextStyle } {
    const border: TextStyle = t.border.idle;
    const leftEdge = geo.startCol;
    const rightEdge = geo.startCol + geo.width - 1;

    if (row === layout.topRow) {
        if (col === leftEdge) return { ch: DBOX.topLeft, style: border };
        if (col === rightEdge) return { ch: DBOX.topRight, style: border };
        return { ch: DBOX.horizontal, style: border };
    }

    if (row === layout.bottomRow) {
        if (col === leftEdge) return { ch: DBOX.bottomLeft, style: border };
        if (col === rightEdge) return { ch: DBOX.bottomRight, style: border };
        return { ch: DBOX.horizontal, style: border };
    }

    if (row === layout.separatorRow) {
        if (col === leftEdge) return { ch: MBOX.vertDoubleRight, style: border };
        if (col === rightEdge) return { ch: MBOX.vertDoubleLeft, style: border };
        for (const dc of geo.dividerCols) {
            if (col === dc) return { ch: BOX.teeUp, style: border };
        }
        return { ch: BOX.horizontal, style: border };
    }

    if (col === leftEdge || col === rightEdge) {
        return { ch: DBOX.vertical, style: border };
    }

    if (row === layout.headerRow) {
        for (const dc of geo.dividerCols) {
            if (col === dc) return { ch: BOX.vertical, style: border };
        }
        return { ch: ' ', style: t.header.idle };
    }

    if (row === layout.infoRow) {
        return { ch: ' ', style: t.info.idle };
    }

    if (row >= layout.listStart && row < layout.separatorRow) {
        for (const dc of geo.dividerCols) {
            if (col === dc) return { ch: BOX.vertical, style: border };
        }
        let fileCol = -1;
        for (let i = 0; i < geo.numCols; i++) {
            if (col >= geo.colStarts[i] && col < geo.colStarts[i] + geo.colWidths[i]) {
                fileCol = i;
                break;
            }
        }
        if (fileCol >= 0) {
            const fileRow = row - layout.listStart;
            const idx = pane.scroll + fileCol * layout.listHeight + fileRow;
            if (idx < pane.entries.length) {
                const entry = pane.entries[idx];
                const isCursor = isActive && idx === pane.cursor;
                const rs = entryRenderStyle(entry, t);
                const style = isCursor ? rs.selected : rs.idle;
                const charPos = col - geo.colStarts[fileCol];
                const ch = charPos < entry.name.length ? entry.name[charPos] : ' ';
                return { ch, style };
            }
            return { ch: ' ', style: border };
        }
    }

    return { ch: ' ', style: border };
}
