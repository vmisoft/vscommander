import { moveTo, resetStyle, DBOX, MBOX, BOX, hideCursor } from './draw';
import { RenderStyle } from './settings';
import { applyStyle } from './helpers';

export interface TableColumn {
    width: number;
    align: 'left' | 'right';
}

export interface TableRow {
    label: string;
    detail: string;
    fixedCols?: string[];
    spanAll?: boolean;
}

export interface TableSection {
    rows: TableRow[];
    startIndex?: number;
}

export interface PopupTableStyles {
    body: RenderStyle;
    label: RenderStyle;
    text: RenderStyle;
    number: RenderStyle;
}

export class PopupTable {
    title = '';
    sections: TableSection[] = [];
    fixedColumns: TableColumn[] = [];
    cursor = -1;
    numbered = false;

    get rowCount(): number {
        let count = 0;
        for (const section of this.sections) {
            count += section.rows.length;
        }
        return count;
    }

    static indexToPrefix(idx: number): string {
        if (idx < 9) return String(idx + 1);
        if (idx === 9) return '0';
        return String.fromCharCode(97 + idx - 10);
    }

    static truncateMiddle(text: string, maxLen: number): string {
        if (text.length <= maxLen) return text;
        if (maxLen <= 3) return text.slice(0, maxLen);
        const left = Math.ceil((maxLen - 3) / 2);
        const right = maxLen - 3 - left;
        return text.slice(0, left) + '...' + text.slice(text.length - right);
    }

    render(anchorRow: number, anchorCol: number, styles: PopupTableStyles, maxWidth?: number): string {
        if (this.rowCount === 0) return '';

        const border = applyStyle(styles.body.idle);
        const pad = 1;
        const pfx = this.numbered ? 2 : 0;

        const fixedPart = this.computeFixedPart();
        let primaryWidth = this.computePrimaryWidth(fixedPart, pfx);

        const computeContentRowWidth = (pw: number) => fixedPart > 0
            ? 1 + pfx + pw + fixedPart + 1
            : 1 + pfx + pw + 1;

        let borderInner = computeContentRowWidth(primaryWidth);
        let popupWidth = 2 * pad + borderInner + 2;

        const popupOffset = 2;
        const rightEdge = maxWidth ? anchorCol + maxWidth - 1 : 999;
        let popupCol = anchorCol + popupOffset;

        if (popupCol + popupWidth - 1 > rightEdge) {
            popupCol = rightEdge - popupWidth + 1;
            if (popupCol < 1) {
                popupCol = 1;
                const available = rightEdge;
                if (popupWidth > available) {
                    const excess = popupWidth - available;
                    primaryWidth = Math.max(6, primaryWidth - excess);
                    borderInner = computeContentRowWidth(primaryWidth);
                    popupWidth = 2 * pad + borderInner + 2;
                }
            }
        }

        const contentRowWidth = computeContentRowWidth(primaryWidth);
        const title = this.title ? ' ' + this.title + ' ' : '';
        const popupRow = anchorRow;
        const out: string[] = [];

        // Outline row above border
        out.push(border + moveTo(popupRow, popupCol));
        out.push(' '.repeat(popupWidth));

        let row = popupRow + 1;

        // Top border with title
        const displayTitle = borderInner >= title.length ? title : title.slice(0, Math.max(0, borderInner));
        const titleFillTotal = borderInner - displayTitle.length;
        const titleFillLeft = Math.max(0, Math.floor(titleFillTotal / 2));
        const titleFillRight = Math.max(0, titleFillTotal - titleFillLeft);
        out.push(border + moveTo(row, popupCol));
        out.push(' '.repeat(pad));
        out.push(DBOX.topLeft);
        out.push(DBOX.horizontal.repeat(titleFillLeft));
        out.push(displayTitle);
        out.push(DBOX.horizontal.repeat(titleFillRight));
        out.push(DBOX.topRight);
        out.push(' '.repeat(pad));
        row++;

        let entryIdx = 0;
        let prefixIdx = 0;

        for (let si = 0; si < this.sections.length; si++) {
            const section = this.sections[si];
            if (section.startIndex !== undefined) {
                prefixIdx = section.startIndex;
            }

            if (si > 0 && this.sections[si - 1].rows.length > 0 && section.rows.length > 0) {
                const prevAllSpan = this.sections[si - 1].rows.every(r => r.spanAll);
                out.push(border + moveTo(row, popupCol));
                out.push(' '.repeat(pad));
                out.push(this.renderSeparator(borderInner, pfx, primaryWidth, prevAllSpan));
                out.push(' '.repeat(pad));
                row++;
            }

            for (const tableRow of section.rows) {
                const isSelected = entryIdx === this.cursor;

                if (tableRow.spanAll) {
                    out.push(this.renderSpanRow(
                        row, popupCol, tableRow, prefixIdx, isSelected,
                        styles, border, pad, pfx, contentRowWidth,
                    ));
                } else {
                    out.push(this.renderNormalRow(
                        row, popupCol, tableRow, prefixIdx, isSelected,
                        styles, border, pad, pfx, primaryWidth,
                    ));
                }

                row++;
                entryIdx++;
                prefixIdx++;
            }
        }

        // Bottom border
        out.push(border + moveTo(row, popupCol));
        out.push(' '.repeat(pad));
        out.push(DBOX.bottomLeft + DBOX.horizontal.repeat(borderInner) + DBOX.bottomRight);
        out.push(' '.repeat(pad));
        row++;

        // Outline row below border
        out.push(border + moveTo(row, popupCol));
        out.push(' '.repeat(popupWidth));

        out.push(resetStyle());
        out.push(hideCursor());
        return out.join('');
    }

    private computeFixedPart(): number {
        let fp = 0;
        for (const col of this.fixedColumns) {
            fp += 1 + col.width;
        }
        return fp;
    }

    private computePrimaryWidth(fixedPart: number, pfx: number): number {
        let max = 10;
        for (const section of this.sections) {
            for (const row of section.rows) {
                if (row.spanAll) {
                    const w = row.label.length + row.detail.length + 1 - fixedPart;
                    if (w > max) max = w;
                } else {
                    const w = row.label.length + 1 + row.detail.length;
                    if (w > max) max = w;
                }
            }
        }
        return max;
    }

    private renderNormalRow(
        row: number, popupCol: number,
        tableRow: TableRow, entryIdx: number, isSelected: boolean,
        styles: PopupTableStyles, border: string,
        pad: number, pfx: number, primaryWidth: number,
    ): string {
        const out: string[] = [];
        const labelStyle = applyStyle(isSelected ? styles.label.selected : styles.label.idle);
        const textStyle = applyStyle(isSelected ? styles.text.selected : styles.text.idle);
        const numStyle = applyStyle(isSelected ? styles.number.selected : styles.number.idle);
        const bgStyle = isSelected ? textStyle : applyStyle(styles.text.idle);

        out.push(border + moveTo(row, popupCol) + ' '.repeat(pad) + DBOX.vertical);

        const maxLabelLen = Math.max(0, primaryWidth - 1 - tableRow.detail.length);
        const labelText = PopupTable.truncateMiddle(tableRow.label, maxLabelLen);

        out.push(textStyle + ' ');
        if (this.numbered) {
            const prefix = PopupTable.indexToPrefix(entryIdx);
            out.push(numStyle + prefix + textStyle + ' ');
        }
        out.push(labelStyle + labelText);
        out.push(textStyle + ' ' + tableRow.detail);
        const used = 1 + pfx + labelText.length + 1 + tableRow.detail.length;
        const target = 1 + pfx + primaryWidth;
        if (used < target) {
            out.push(' '.repeat(target - used));
        }

        if (tableRow.fixedCols && this.fixedColumns.length > 0) {
            for (let i = 0; i < this.fixedColumns.length; i++) {
                const col = this.fixedColumns[i];
                const val = (tableRow.fixedCols[i] ?? '');
                out.push(border + BOX.vertical);
                if (col.align === 'right') {
                    out.push(bgStyle + val.padStart(col.width));
                } else {
                    out.push(bgStyle + val.padEnd(col.width));
                }
            }
        }

        out.push(textStyle + ' ');
        out.push(border + DBOX.vertical + ' '.repeat(pad));
        return out.join('');
    }

    private renderSpanRow(
        row: number, popupCol: number,
        tableRow: TableRow, entryIdx: number, isSelected: boolean,
        styles: PopupTableStyles, border: string,
        pad: number, pfx: number, contentRowWidth: number,
    ): string {
        const out: string[] = [];
        const labelStyle = applyStyle(isSelected ? styles.label.selected : styles.label.idle);
        const textStyle = applyStyle(isSelected ? styles.text.selected : styles.text.idle);
        const numStyle = applyStyle(isSelected ? styles.number.selected : styles.number.idle);

        out.push(border + moveTo(row, popupCol) + ' '.repeat(pad) + DBOX.vertical);

        const fixedChars = 1 + pfx + 1 + tableRow.detail.length + 1;
        const availLabel = Math.max(0, contentRowWidth - fixedChars);
        const label = PopupTable.truncateMiddle(tableRow.label, availLabel);

        const gap = contentRowWidth - (1 + pfx + label.length + 1 + tableRow.detail.length + 1);
        if (gap >= 0) {
            out.push(textStyle + ' ');
            if (this.numbered) {
                const prefix = PopupTable.indexToPrefix(entryIdx);
                out.push(numStyle + prefix + textStyle + ' ');
            }
            out.push(labelStyle + label);
            if (gap > 0) out.push(textStyle + ' '.repeat(gap));
            out.push(textStyle + ' ' + tableRow.detail + ' ');
        } else {
            let text = ' ';
            if (this.numbered) {
                text += PopupTable.indexToPrefix(entryIdx) + ' ';
            }
            text += label;
            text = text.slice(0, contentRowWidth);
            out.push(textStyle + text + ' '.repeat(Math.max(0, contentRowWidth - text.length)));
        }

        out.push(border + DBOX.vertical + ' '.repeat(pad));
        return out.join('');
    }

    private renderSeparator(borderInner: number, pfx: number, primaryWidth: number, plain = false): string {
        const out: string[] = [];
        out.push(MBOX.vertDoubleRight);
        if (!plain && this.fixedColumns.length > 0) {
            out.push(BOX.horizontal.repeat(1 + pfx + primaryWidth));
            for (let i = 0; i < this.fixedColumns.length; i++) {
                out.push(BOX.teeUp);
                const isLast = i === this.fixedColumns.length - 1;
                if (isLast) {
                    out.push(BOX.horizontal.repeat(this.fixedColumns[i].width + 1));
                } else {
                    out.push(BOX.horizontal.repeat(this.fixedColumns[i].width));
                }
            }
        } else {
            out.push(BOX.horizontal.repeat(borderInner));
        }
        out.push(MBOX.vertDoubleLeft);
        return out.join('');
    }
}
