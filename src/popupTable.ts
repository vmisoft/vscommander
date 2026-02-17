import { DBOX, MBOX, BOX } from './draw';
import { RenderStyle } from './settings';
import { FrameBuffer } from './frameBuffer';

export interface TableColumn {
    width: number;
    align: 'left' | 'right';
}

export interface TableRow {
    label: string;
    detail: string;
    fixedCols?: string[];
    spanAll?: boolean;
    numberLabel?: string;
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

    renderToBuffer(styles: PopupTableStyles, maxWidth?: number): FrameBuffer {
        if (this.rowCount === 0) return new FrameBuffer(0, 0);

        const pad = 2;
        const pfx = this.numbered ? 2 : 0;
        const bodyStyle = styles.body.idle;
        const fixedPart = this.computeFixedPart();
        let primaryWidth = this.computePrimaryWidth(fixedPart, pfx);

        const computeContentRowWidth = (pw: number) => fixedPart > 0
            ? 1 + pfx + pw + fixedPart + 1
            : 1 + pfx + pw + 1;

        let borderInner = computeContentRowWidth(primaryWidth);
        let popupWidth = 2 * pad + borderInner + 2;

        if (maxWidth && popupWidth > maxWidth) {
            const excess = popupWidth - maxWidth;
            primaryWidth = Math.max(6, primaryWidth - excess);
            borderInner = computeContentRowWidth(primaryWidth);
            popupWidth = 2 * pad + borderInner + 2;
        }

        const contentRowWidth = computeContentRowWidth(primaryWidth);

        let numSeparators = 0;
        for (let si = 1; si < this.sections.length; si++) {
            if (this.sections[si - 1].rows.length > 0 && this.sections[si].rows.length > 0) {
                numSeparators++;
            }
        }
        const totalHeight = 4 + this.rowCount + numSeparators;

        const fb = new FrameBuffer(popupWidth, totalHeight);

        fb.fill(0, 0, popupWidth, 1, ' ', bodyStyle);

        const title = this.title ? ' ' + this.title + ' ' : '';
        const displayTitle = borderInner >= title.length ? title : title.slice(0, Math.max(0, borderInner));
        const titleFillTotal = borderInner - displayTitle.length;
        const titleFillLeft = Math.max(0, Math.floor(titleFillTotal / 2));
        const titleFillRight = Math.max(0, titleFillTotal - titleFillLeft);
        fb.write(1, 0,
            ' '.repeat(pad) + DBOX.topLeft
            + DBOX.horizontal.repeat(titleFillLeft) + displayTitle + DBOX.horizontal.repeat(titleFillRight)
            + DBOX.topRight + ' '.repeat(pad),
            bodyStyle);

        let row = 2;
        let entryIdx = 0;
        let prefixIdx = 0;

        for (let si = 0; si < this.sections.length; si++) {
            const section = this.sections[si];
            if (section.startIndex !== undefined) {
                prefixIdx = section.startIndex;
            }

            if (si > 0 && this.sections[si - 1].rows.length > 0 && section.rows.length > 0) {
                const prevAllSpan = this.sections[si - 1].rows.every(r => r.spanAll);
                fb.write(row, 0,
                    ' '.repeat(pad) + this.buildSeparator(borderInner, pfx, primaryWidth, prevAllSpan) + ' '.repeat(pad),
                    bodyStyle);
                row++;
            }

            for (const tableRow of section.rows) {
                const isSelected = entryIdx === this.cursor;

                if (tableRow.spanAll) {
                    this.writeSpanRow(fb, row, tableRow, prefixIdx, isSelected, styles, pad, pfx, contentRowWidth);
                } else {
                    this.writeNormalRow(fb, row, tableRow, prefixIdx, isSelected, styles, pad, pfx, primaryWidth);
                }

                row++;
                entryIdx++;
                prefixIdx++;
            }
        }

        fb.write(row, 0,
            ' '.repeat(pad) + DBOX.bottomLeft + DBOX.horizontal.repeat(borderInner) + DBOX.bottomRight + ' '.repeat(pad),
            bodyStyle);
        row++;

        fb.fill(row, 0, popupWidth, 1, ' ', bodyStyle);

        return fb;
    }

    render(anchorRow: number, anchorCol: number, styles: PopupTableStyles, maxWidth?: number): string {
        if (this.rowCount === 0) return '';

        const popupOffset = 2;
        const rightEdge = maxWidth ? anchorCol + maxWidth - 1 : 999;
        let popupCol = anchorCol + popupOffset;
        let availableWidth: number | undefined;

        if (popupCol + this.estimateWidth(styles) - 1 > rightEdge) {
            const naturalWidth = this.estimateWidth(styles);
            popupCol = rightEdge - naturalWidth + 1;
            if (popupCol < 1) {
                popupCol = 1;
                availableWidth = rightEdge;
            }
        }

        const fb = this.renderToBuffer(styles, availableWidth);
        if (fb.width === 0) return '';
        return fb.toAnsi(anchorRow, popupCol);
    }

    private estimateWidth(styles: PopupTableStyles): number {
        const pad = 2;
        const pfx = this.numbered ? 2 : 0;
        const fixedPart = this.computeFixedPart();
        const primaryWidth = this.computePrimaryWidth(fixedPart, pfx);
        const contentRowWidth = fixedPart > 0
            ? 1 + pfx + primaryWidth + fixedPart + 1
            : 1 + pfx + primaryWidth + 1;
        return 2 * pad + contentRowWidth + 2;
    }

    private writeNormalRow(
        fb: FrameBuffer, row: number,
        tableRow: TableRow, entryIdx: number, isSelected: boolean,
        styles: PopupTableStyles, pad: number, pfx: number, primaryWidth: number,
    ): void {
        const bodyStyle = styles.body.idle;
        const labelStyle = isSelected ? styles.label.selected : styles.label.idle;
        const textStyle = isSelected ? styles.text.selected : styles.text.idle;
        const numStyle = isSelected ? styles.number.selected : styles.number.idle;
        const bgStyle = isSelected ? styles.text.selected : styles.text.idle;

        let col = 0;
        fb.write(row, col, ' '.repeat(pad) + DBOX.vertical, bodyStyle);
        col = pad + 1;

        fb.write(row, col, ' ', textStyle);
        col += 1;

        if (this.numbered) {
            const prefix = tableRow.numberLabel ?? PopupTable.indexToPrefix(entryIdx);
            fb.write(row, col, prefix, numStyle);
            col += 1;
            fb.write(row, col, ' ', textStyle);
            col += 1;
        }

        const maxLabelLen = Math.max(0, primaryWidth - 1 - tableRow.detail.length);
        const labelText = PopupTable.truncateMiddle(tableRow.label, maxLabelLen);
        fb.write(row, col, labelText, labelStyle);
        col += labelText.length;

        fb.write(row, col, ' ' + tableRow.detail, textStyle);
        col += 1 + tableRow.detail.length;

        const used = 1 + pfx + labelText.length + 1 + tableRow.detail.length;
        const target = 1 + pfx + primaryWidth;
        if (used < target) {
            fb.write(row, col, ' '.repeat(target - used), textStyle);
            col += target - used;
        }

        if (tableRow.fixedCols && this.fixedColumns.length > 0) {
            for (let i = 0; i < this.fixedColumns.length; i++) {
                const fcol = this.fixedColumns[i];
                const val = (tableRow.fixedCols[i] ?? '');
                fb.write(row, col, BOX.vertical, bodyStyle);
                col += 1;
                if (fcol.align === 'right') {
                    fb.write(row, col, val.padStart(fcol.width), bgStyle);
                } else {
                    fb.write(row, col, val.padEnd(fcol.width), bgStyle);
                }
                col += fcol.width;
            }
        }

        fb.write(row, col, ' ', textStyle);
        col += 1;
        fb.write(row, col, DBOX.vertical + ' '.repeat(pad), bodyStyle);
    }

    private writeSpanRow(
        fb: FrameBuffer, row: number,
        tableRow: TableRow, entryIdx: number, isSelected: boolean,
        styles: PopupTableStyles, pad: number, pfx: number, contentRowWidth: number,
    ): void {
        const bodyStyle = styles.body.idle;
        const labelStyle = isSelected ? styles.label.selected : styles.label.idle;
        const textStyle = isSelected ? styles.text.selected : styles.text.idle;
        const numStyle = isSelected ? styles.number.selected : styles.number.idle;

        let col = 0;
        fb.write(row, col, ' '.repeat(pad) + DBOX.vertical, bodyStyle);
        col = pad + 1;

        const fixedChars = 1 + pfx + 1 + tableRow.detail.length + 1;
        const availLabel = Math.max(0, contentRowWidth - fixedChars);
        const label = PopupTable.truncateMiddle(tableRow.label, availLabel);
        const gap = contentRowWidth - (1 + pfx + label.length + 1 + tableRow.detail.length + 1);

        if (gap >= 0) {
            fb.write(row, col, ' ', textStyle);
            col += 1;
            if (this.numbered) {
                const prefix = tableRow.numberLabel ?? PopupTable.indexToPrefix(entryIdx);
                fb.write(row, col, prefix, numStyle);
                col += 1;
                fb.write(row, col, ' ', textStyle);
                col += 1;
            }
            fb.write(row, col, label, labelStyle);
            col += label.length;
            if (gap > 0) {
                fb.write(row, col, ' '.repeat(gap), textStyle);
                col += gap;
            }
            fb.write(row, col, ' ' + tableRow.detail + ' ', textStyle);
            col += 1 + tableRow.detail.length + 1;
        } else {
            let text = ' ';
            if (this.numbered) {
                text += (tableRow.numberLabel ?? PopupTable.indexToPrefix(entryIdx)) + ' ';
            }
            text += label;
            text = text.slice(0, contentRowWidth);
            fb.write(row, col, text, textStyle);
            col += text.length;
            if (text.length < contentRowWidth) {
                fb.write(row, col, ' '.repeat(contentRowWidth - text.length), textStyle);
                col += contentRowWidth - text.length;
            }
        }

        fb.write(row, col, DBOX.vertical + ' '.repeat(pad), bodyStyle);
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

    private buildSeparator(borderInner: number, pfx: number, primaryWidth: number, plain = false): string {
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
