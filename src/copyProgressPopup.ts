import { DBOX, BOX, MBOX } from './draw';
import { Theme, TextStyle } from './settings';
import { Popup, PopupInputResult } from './popup';
import { FrameBuffer } from './frameBuffer';
import { PROGRESS_FILLED, PROGRESS_EMPTY } from './visualPrimitives';

export interface CopyProgressState {
    mode: 'copy' | 'move';
    srcName: string;
    dstName: string;
    filesCopied: number;
    filesTotal: number;
    bytesCopied: number;
    bytesTotal: number;
    currentPercent: number;
    totalPercent: number;
}

export class ScanProgressPopup extends Popup {
    private mode: 'copy' | 'move' = 'copy';
    private currentPath = '';
    private dirs = 0;
    private files = 0;
    private bytes = 0;
    cancelled = false;

    private static readonly BOX_WIDTH = 70;
    private static readonly TEXT_WIDTH = 66;

    constructor() {
        super();
    }

    openWith(mode: 'copy' | 'move'): void {
        this.mode = mode;
        this.currentPath = '';
        this.dirs = 0;
        this.files = 0;
        this.bytes = 0;
        this.cancelled = false;
        super.open();
    }

    updateScan(currentPath: string, dirs: number, files: number, bytes: number): void {
        this.currentPath = currentPath;
        this.dirs = dirs;
        this.files = files;
        this.bytes = bytes;
    }

    handleInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.cancelled = true;
            this.close();
            return { action: 'close', confirm: false };
        }
        return { action: 'consumed' };
    }

    override handleMouseDown(_row: number, _col: number): PopupInputResult {
        return { action: 'consumed' };
    }

    override handleMouseUp(_row: number, _col: number): PopupInputResult {
        return { action: 'consumed' };
    }

    override handleMouseScroll(_up: boolean): PopupInputResult {
        return { action: 'consumed' };
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        const bodyStyle = theme.dialogBody.idle;

        const boxWidth = ScanProgressPopup.BOX_WIDTH;
        const textWidth = ScanProgressPopup.TEXT_WIDTH;

        const title = this.mode === 'move' ? 'Move' : 'Copy';

        //  Row 0: top border with title
        //  Row 1: "Scanning the folder" label
        //  Row 2: current path
        //  Row 3: separator
        //  Row 4: folders counter
        //  Row 5: files counter
        //  Row 6: bytes counter
        //  Row 7: bottom border
        const boxHeight = 8;
        const totalWidth = boxWidth + this.padH * 2;
        const totalHeight = boxHeight + this.padV * 2;

        const fb = new FrameBuffer(totalWidth, totalHeight);
        fb.fill(0, 0, totalWidth, totalHeight, ' ', bodyStyle);
        fb.drawBox(this.padV, this.padH, boxWidth, boxHeight, bodyStyle, DBOX, title);

        const textCol = this.padH + 2;

        fb.write(this.padV + 1, textCol, 'Scanning the folder', bodyStyle);

        const pathDisplay = truncatePath(this.currentPath, textWidth);
        fb.write(this.padV + 2, textCol, pathDisplay, bodyStyle);

        drawSingleSeparator(fb, this.padV + 3, this.padH, boxWidth, bodyStyle);

        const longestLabel = 'Folders';
        const counterWidth = textWidth - 5;
        const foldersStr = formatCounter('Folders', longestLabel,
            this.dirs, 0, false, counterWidth);
        fb.write(this.padV + 4, textCol, foldersStr, bodyStyle);

        const filesStr = formatCounter('Files', longestLabel,
            this.files, 0, false, counterWidth);
        fb.write(this.padV + 5, textCol, filesStr, bodyStyle);

        const bytesStr = formatCounter('Bytes', longestLabel,
            this.bytes, 0, false, counterWidth);
        fb.write(this.padV + 6, textCol, bytesStr, bodyStyle);

        return fb;
    }

    render(rows: number, cols: number, theme: Theme): string {
        if (!this.active) return '';
        const fb = this.renderToBuffer(theme);
        const baseRow = Math.floor((rows - fb.height) / 2) + 1;
        const baseCol = Math.floor((cols - fb.width) / 2) + 1;
        this.setScreenPosition(baseRow, baseCol, fb.width, fb.height);
        return fb.toAnsi(this.screenRow, this.screenCol);
    }
}

export class CopyProgressPopup extends Popup {
    private state: CopyProgressState = {
        mode: 'copy',
        srcName: '',
        dstName: '',
        filesCopied: 0,
        filesTotal: 0,
        bytesCopied: 0,
        bytesTotal: 0,
        currentPercent: 0,
        totalPercent: 0,
    };
    cancelled = false;

    private static readonly BOX_WIDTH = 70;
    private static readonly TEXT_WIDTH = 66;
    private static readonly CANVAS_WIDTH = 66;

    constructor() {
        super();
    }

    openWith(mode: 'copy' | 'move', filesTotal: number, bytesTotal: number): void {
        this.state = {
            mode,
            srcName: '',
            dstName: '',
            filesCopied: 0,
            filesTotal,
            bytesCopied: 0,
            bytesTotal,
            currentPercent: 0,
            totalPercent: 0,
        };
        this.cancelled = false;
        super.open();
    }

    updateProgress(srcName: string, dstName: string, filesCopied: number,
                   filesTotal: number, bytesCopied: number, bytesTotal: number,
                   currentPercent: number, totalPercent: number): void {
        this.state.srcName = srcName;
        this.state.dstName = dstName;
        this.state.filesCopied = filesCopied;
        this.state.filesTotal = filesTotal;
        this.state.bytesCopied = bytesCopied;
        this.state.bytesTotal = bytesTotal;
        this.state.currentPercent = currentPercent;
        this.state.totalPercent = totalPercent;
    }

    handleInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.cancelled = true;
            this.close();
            return { action: 'close', confirm: false };
        }
        return { action: 'consumed' };
    }

    override handleMouseDown(_row: number, _col: number): PopupInputResult {
        return { action: 'consumed' };
    }

    override handleMouseUp(_row: number, _col: number): PopupInputResult {
        return { action: 'consumed' };
    }

    override handleMouseScroll(_up: boolean): PopupInputResult {
        return { action: 'consumed' };
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        const bodyStyle = theme.dialogBody.idle;

        const boxWidth = CopyProgressPopup.BOX_WIDTH;
        const textWidth = CopyProgressPopup.TEXT_WIDTH;
        const canvasWidth = CopyProgressPopup.CANVAS_WIDTH;

        const title = this.state.mode === 'move' ? 'Move' : 'Copy';
        const actionLabel = this.state.mode === 'move' ? 'Moving' : 'Copying';

        // Layout (Time=false):
        //  Row 0: top border with title
        //  Row 1: action label
        //  Row 2: source file path
        //  Row 3: "To"
        //  Row 4: destination path
        //  Row 5: current file progress bar
        //  Row 6: separator "Total"
        //  Row 7: files counter
        //  Row 8: bytes counter
        //  Row 9: total progress bar
        //  Row 10: bottom border
        const boxHeight = 11;
        const totalWidth = boxWidth + this.padH * 2;
        const totalHeight = boxHeight + this.padV * 2;

        const fb = new FrameBuffer(totalWidth, totalHeight);
        fb.fill(0, 0, totalWidth, totalHeight, ' ', bodyStyle);
        fb.drawBox(this.padV, this.padH, boxWidth, boxHeight, bodyStyle, DBOX, title);

        const textCol = this.padH + 2;

        fb.write(this.padV + 1, textCol, actionLabel, bodyStyle);

        const srcDisplay = truncatePath(this.state.srcName, textWidth);
        fb.write(this.padV + 2, textCol, srcDisplay, bodyStyle);

        fb.write(this.padV + 3, textCol, 'To', bodyStyle);

        const dstDisplay = truncatePath(this.state.dstName, textWidth);
        fb.write(this.padV + 4, textCol, dstDisplay, bodyStyle);

        const currentBar = makeProgressBar(canvasWidth, this.state.currentPercent, true);
        fb.write(this.padV + 5, textCol, currentBar, bodyStyle);

        drawLabeledSeparator(fb, this.padV + 6, this.padH, boxWidth, bodyStyle, 'Total');

        const counterWidth = textWidth - 5;
        const filesStr = formatCounter('Files', 'Bytes',
            this.state.filesCopied, this.state.filesTotal, true, counterWidth);
        fb.write(this.padV + 7, textCol, filesStr, bodyStyle);

        const bytesStr = formatCounter('Bytes', 'Files',
            this.state.bytesCopied, this.state.bytesTotal, true, counterWidth);
        fb.write(this.padV + 8, textCol, bytesStr, bodyStyle);

        const totalBar = makeProgressBar(canvasWidth, this.state.totalPercent, true);
        fb.write(this.padV + 9, textCol, totalBar, bodyStyle);

        return fb;
    }

    render(rows: number, cols: number, theme: Theme): string {
        if (!this.active) return '';
        const fb = this.renderToBuffer(theme);
        const baseRow = Math.floor((rows - fb.height) / 2) + 1;
        const baseCol = Math.floor((cols - fb.width) / 2) + 1;
        this.setScreenPosition(baseRow, baseCol, fb.width, fb.height);
        return fb.toAnsi(this.screenRow, this.screenCol);
    }
}

function makeProgressBar(width: number, percent: number, showPercent: boolean): string {
    let percentStr = '';
    let barWidth = width;
    if (showPercent) {
        percentStr = ' ' + String(Math.min(Math.round(percent), 100)).padStart(3) + '%';
        barWidth = Math.max(0, width - percentStr.length);
    }
    const clamped = Math.min(Math.max(percent, 0), 100);
    const pos = Math.floor(clamped * barWidth / 100);
    return PROGRESS_FILLED.repeat(pos) + PROGRESS_EMPTY.repeat(barWidth - pos) + percentStr;
}

function formatCounter(label: string, otherLabel: string,
                       current: number, total: number,
                       showTotal: boolean, maxWidth: number): string {
    const paddedLabelSize = Math.max(label.length, otherLabel.length) + 1;
    const paddedLabel = label.padEnd(paddedLabelSize);

    const strCurrent = groupDigits(current);
    const strTotal = showTotal ? groupDigits(total) : '';
    let value = showTotal ? strCurrent + ' / ' + strTotal : strCurrent;

    if (maxWidth > paddedLabelSize) {
        const paddedValueSize = maxWidth - paddedLabelSize;
        if (paddedValueSize > value.length) {
            value = ' '.repeat(paddedValueSize - value.length) + value;
        }
    }
    return paddedLabel + value;
}

function groupDigits(n: number): string {
    const s = String(n);
    const parts: string[] = [];
    for (let i = s.length; i > 0; i -= 3) {
        parts.unshift(s.slice(Math.max(0, i - 3), i));
    }
    return parts.join(',');
}

function truncatePath(filePath: string, maxWidth: number): string {
    if (filePath.length <= maxWidth) return filePath;
    if (maxWidth <= 3) return filePath.slice(0, maxWidth);
    return '...' + filePath.slice(filePath.length - maxWidth + 3);
}

function drawSingleSeparator(fb: FrameBuffer, row: number, col: number,
                             width: number, style: TextStyle): void {
    const innerWidth = width - 2;
    const line = MBOX.vertDoubleRight
        + BOX.horizontal.repeat(innerWidth)
        + MBOX.vertDoubleLeft;
    fb.write(row, col, line, style);
}

function drawLabeledSeparator(fb: FrameBuffer, row: number, col: number,
                              width: number, style: TextStyle, label: string): void {
    const text = ' ' + label + ' ';
    const innerWidth = width - 2;
    const fillLeft = Math.floor((innerWidth - text.length) / 2);
    const fillRight = innerWidth - text.length - fillLeft;
    const line = MBOX.vertDoubleRight
        + BOX.horizontal.repeat(fillLeft) + text + BOX.horizontal.repeat(fillRight)
        + MBOX.vertDoubleLeft;
    fb.write(row, col, line, style);
}
