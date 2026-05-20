import { moveTo, resetStyle } from '../../draw';
import { Theme } from '../../settings';
import { Layout } from '../../types';
import { applyStyle, computePaneGeometry } from '../../helpers';
import { Pane } from '../../pane';
import { ConfirmPopup } from '../confirm';
import { CopyMovePopup } from '../copy-move';

export interface ThemePreviewGeometry {
    popupTop: number;
    popupLeft: number;
    popupWidth: number;
    previewStartCol: number;
    sepRow: number;
}

// The live theme preview pane: a mock file panel, command line, function-key
// bar and sample dialogs rendered with the candidate theme.
export class ThemePreview {
    render(geo: ThemePreviewGeometry, previewTheme: Theme,
           mockPane: Pane, mockConfirm: ConfirmPopup, mockCopy: CopyMovePopup | null): string {
        const out: string[] = [];
        const previewScreenLeft = geo.popupLeft + geo.previewStartCol;
        const previewScreenRight = geo.popupLeft + geo.popupWidth - 2;
        const previewCols = previewScreenRight - previewScreenLeft + 1;
        const previewScreenTop = geo.popupTop + 1;
        const previewScreenBottom = geo.popupTop + geo.sepRow - 1;

        if (previewCols < 10 || previewScreenBottom - previewScreenTop + 1 < 8) return '';

        const fkeyRow = previewScreenBottom;
        const cmdRow = fkeyRow - 1;
        const paneBottomRow = cmdRow - 1;
        const paneTopRow = previewScreenTop;
        const paneRows = paneBottomRow - paneTopRow + 1;

        if (paneRows < 6) return '';

        const listHeight = Math.max(1, paneRows - 5);
        const paneGeo = computePaneGeometry(previewScreenLeft, previewCols, 2);

        const layout: Layout = {
            topRow: paneTopRow,
            headerRow: paneTopRow + 1,
            listStart: paneTopRow + 2,
            listHeight,
            separatorRow: paneTopRow + 2 + listHeight,
            infoRow: paneTopRow + 3 + listHeight,
            bottomRow: paneTopRow + 4 + listHeight,
            cmdRow,
            fkeyRow,
            leftPane: paneGeo,
            rightPane: paneGeo,
        };

        const pageCapacity = listHeight * paneGeo.numCols;
        mockPane.cursor = Math.min(15, mockPane.entries.length - 1);
        mockPane.ensureCursorVisible(pageCapacity);

        const selected = new Set<string>();
        selected.add('README.md');
        selected.add('CHANGELOG.md');

        out.push(mockPane.render({
            geo: layout.leftPane,
            layout,
            theme: previewTheme,
            isActive: true,
            showClock: true,
            selected,
        }));

        const cmdText = '$ ls -la';
        out.push(applyStyle(previewTheme.commandLine.idle) + moveTo(cmdRow, previewScreenLeft));
        out.push(cmdText + ' '.repeat(Math.max(0, previewCols - cmdText.length)));
        out.push(resetStyle());

        out.push(this.renderMockFKeyBar(fkeyRow, previewScreenLeft, previewCols, previewTheme));

        if (mockCopy) {
            const copyFb = mockCopy.renderToBuffer(previewTheme);
            if (copyFb.width > 0 && copyFb.height > 0 && copyFb.width <= previewCols) {
                const copyRow = Math.max(paneTopRow + 2,
                    Math.floor((paneTopRow + paneBottomRow - copyFb.height) / 2) + 1);
                const copyCol = previewScreenLeft +
                    Math.max(0, Math.floor((previewCols - copyFb.width) / 2));
                out.push(copyFb.toAnsi(copyRow, copyCol));
            }
        }

        const confirmFb = mockConfirm.renderToBuffer(previewTheme);
        if (confirmFb.width > 0 && confirmFb.height > 0 && confirmFb.width <= previewCols) {
            const confirmRow = Math.max(paneTopRow,
                Math.floor((paneTopRow + paneBottomRow - confirmFb.height) / 2) - 2);
            const confirmCol = previewScreenLeft +
                Math.max(0, Math.floor((previewCols - confirmFb.width) / 2));
            out.push(confirmFb.toAnsi(confirmRow, confirmCol));
        }

        return out.join('');
    }

    private renderMockFKeyBar(fkeyRow: number, startCol: number, width: number, theme: Theme): string {
        const out: string[] = [];
        const keys = [
            { num: '1', label: 'Help' }, { num: '2', label: 'Menu' },
            { num: '3', label: 'View' }, { num: '4', label: 'Edit' },
            { num: '5', label: 'Copy' }, { num: '6', label: 'Move' },
            { num: '7', label: 'Mkdir' }, { num: '8', label: 'Del' },
            { num: '9', label: 'Conf' }, { num: '10', label: 'Quit' },
        ];

        const totalKeys = keys.length;
        const slotWidth = Math.floor(width / totalKeys);
        let col = startCol;

        for (let i = 0; i < totalKeys; i++) {
            const k = keys[i];
            const isLast = i === totalKeys - 1;
            const w = isLast ? width - (col - startCol) : slotWidth;
            if (w <= 0) break;

            out.push(moveTo(fkeyRow, col));
            const numText = ' ' + k.num;
            out.push(applyStyle(theme.fkeyNum.idle) + numText);
            const remaining = Math.max(0, w - numText.length);
            const label = k.label.slice(0, remaining);
            const pad = ' '.repeat(Math.max(0, remaining - label.length));
            out.push(applyStyle(theme.fkeyLabel.idle) + label + pad);

            col += w;
        }

        return out.join('');
    }
}
