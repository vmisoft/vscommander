import { DBOX, BOX, MBOX } from './draw';
import { Theme, TextStyle } from './settings';
import { Popup, PopupInputResult } from './popup';
import { FrameBuffer } from './frameBuffer';
import { ButtonGroup } from './buttonGroup';
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
        const bodyStyle = theme.popupInfoBody.idle;

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

export type PauseAction = 'continue' | 'retry' | 'skip' | 'navigate' | 'cancel';

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
    paused = false;
    private pauseResolve: ((action: PauseAction) => void) | null = null;
    private pauseButtonGroup: ButtonGroup | null = null;
    private startTime = 0;
    private speedSamples: { time: number; bytes: number }[] = [];
    private lastSampleTime = 0;

    private static readonly BOX_WIDTH = 70;
    private static readonly TEXT_WIDTH = 66;
    private static readonly CANVAS_WIDTH = 66;
    private static readonly PAUSE_BUTTONS: PauseAction[] = ['continue', 'retry', 'skip', 'navigate', 'cancel'];

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
        this.paused = false;
        this.pauseResolve = null;
        this.pauseButtonGroup = null;
        this.startTime = Date.now();
        this.speedSamples = [];
        this.lastSampleTime = 0;
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

        const now = Date.now();
        if (now - this.lastSampleTime >= 200) {
            this.lastSampleTime = now;
            this.speedSamples.push({ time: now, bytes: bytesCopied });
            if (this.speedSamples.length > 6) {
                this.speedSamples.shift();
            }
        }
    }

    private getRecentSpeed(): number {
        if (this.speedSamples.length < 2) return 0;
        const first = this.speedSamples[0];
        const last = this.speedSamples[this.speedSamples.length - 1];
        const dtSec = (last.time - first.time) / 1000;
        if (dtSec <= 0) return 0;
        return (last.bytes - first.bytes) / dtSec;
    }

    async checkPause(): Promise<PauseAction | null> {
        if (!this.paused) return null;
        return new Promise(resolve => {
            this.pauseResolve = resolve;
        });
    }

    private resolvePause(action: PauseAction): void {
        this.paused = false;
        const resolve = this.pauseResolve;
        this.pauseResolve = null;
        this.pauseButtonGroup = null;
        if (action === 'cancel') {
            this.cancelled = true;
            this.close();
        }
        if (resolve) resolve(action);
    }

    handleInput(data: string): PopupInputResult {
        if (this.paused && this.pauseButtonGroup) {
            if (data === '\x1b' || data === '\x1b\x1b') {
                this.resolvePause('cancel');
                return { action: 'consumed' };
            }
            const result = this.pauseButtonGroup.handleInput(data);
            if (result.confirmed) {
                this.resolvePause(CopyProgressPopup.PAUSE_BUTTONS[this.pauseButtonGroup.selectedIndex]);
            }
            return { action: 'consumed' };
        }
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.paused = true;
            this.pauseButtonGroup = new ButtonGroup(['Continue', 'Retry', 'Skip', 'Show', 'Cancel']);
            return { action: 'consumed' };
        }
        return { action: 'consumed' };
    }

    override handleMouseDown(row: number, col: number): PopupInputResult {
        if (this.paused) return super.handleMouseDown(row, col);
        return { action: 'consumed' };
    }

    override handleMouseUp(row: number, col: number): PopupInputResult {
        if (this.paused) return super.handleMouseUp(row, col);
        return { action: 'consumed' };
    }

    override handleMouseScroll(_up: boolean): PopupInputResult {
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        if (!this.paused || !this.pauseButtonGroup) return null;
        const idx = this.hitTestButton(fbRow, fbCol);
        if (idx >= 0) {
            this.pauseButtonGroup.selectedIndex = idx;
            this.mouseDownButton = idx;
            return { action: 'consumed' };
        }
        return null;
    }

    protected override hitTestButton(fbRow: number, fbCol: number): number {
        if (!this.paused || !this.pauseButtonGroup) return -1;
        const btnWidth = this.pauseButtonGroup.totalWidth + 6;
        const boxWidth = Math.max(CopyProgressPopup.BOX_WIDTH, btnWidth + 2);
        const innerWidth = boxWidth - 2;
        const btnRow = this.padV + 8;
        if (fbRow === btnRow) {
            const localCol = fbCol - this.padH - 1;
            if (localCol >= 0) {
                return this.pauseButtonGroup.hitTestCol(localCol, innerWidth);
            }
        }
        return -1;
    }

    protected override onButtonConfirm(buttonIndex: number): PopupInputResult {
        if (this.pauseButtonGroup) {
            this.pauseButtonGroup.selectedIndex = buttonIndex;
            this.resolvePause(CopyProgressPopup.PAUSE_BUTTONS[buttonIndex]);
        }
        return { action: 'consumed' };
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        if (this.paused) return this.renderPausedBuffer(theme);

        const bodyStyle = theme.popupInfoBody.idle;

        const boxWidth = CopyProgressPopup.BOX_WIDTH;
        const textWidth = CopyProgressPopup.TEXT_WIDTH;
        const canvasWidth = CopyProgressPopup.CANVAS_WIDTH;

        const title = this.state.mode === 'move' ? 'Move' : 'Copy';
        const actionLabel = this.state.mode === 'move' ? 'Moving' : 'Copying';

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
        //  Row 10: separator
        //  Row 11: Time / Remaining / Speed
        //  Row 12: bottom border
        const boxHeight = 13;
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

        drawSingleSeparator(fb, this.padV + 10, this.padH, boxWidth, bodyStyle);

        const statsLine = formatStatsLine(
            this.startTime, this.state.bytesCopied, this.state.bytesTotal,
            this.getRecentSpeed(), textWidth);
        fb.write(this.padV + 11, textCol, statsLine, bodyStyle);

        return fb;
    }

    private renderPausedBuffer(theme: Theme): FrameBuffer {
        const bodyStyle = theme.popupWarningBody.idle;
        const title = this.state.mode === 'move' ? 'Move' : 'Copy';

        const btnWidth = this.pauseButtonGroup ? this.pauseButtonGroup.totalWidth + 6 : 0;
        const boxWidth = Math.max(CopyProgressPopup.BOX_WIDTH, btnWidth + 2);
        const textWidth = boxWidth - 4;

        //  Row 0: top border with title
        //  Row 1: "Operation has been interrupted"
        //  Row 2: blank
        //  Row 3: "Currently processing:"
        //  Row 4: <file path>
        //  Row 5: blank
        //  Row 6: "Do you really want to cancel it?"
        //  Row 7: separator
        //  Row 8: buttons
        //  Row 9: bottom border
        const boxHeight = 10;
        const totalWidth = boxWidth + this.padH * 2;
        const totalHeight = boxHeight + this.padV * 2;

        const fb = new FrameBuffer(totalWidth, totalHeight);
        fb.fill(0, 0, totalWidth, totalHeight, ' ', bodyStyle);
        fb.drawBox(this.padV, this.padH, boxWidth, boxHeight, bodyStyle, DBOX, title);

        const textCol = this.padH + 2;

        fb.write(this.padV + 1, textCol, 'Operation has been interrupted', bodyStyle);

        fb.write(this.padV + 3, textCol, 'Currently processing:', bodyStyle);
        const pathDisplay = truncatePath(this.state.srcName, textWidth);
        fb.write(this.padV + 4, textCol, pathDisplay, { ...bodyStyle, bold: true });

        fb.write(this.padV + 6, textCol, 'Do you really want to cancel it?', bodyStyle);

        drawSingleSeparator(fb, this.padV + 7, this.padH, boxWidth, bodyStyle);

        if (this.pauseButtonGroup) {
            const innerWidth = boxWidth - 2;
            fb.blit(this.padV + 8, this.padH + 1, this.pauseButtonGroup.renderToBuffer(
                innerWidth, theme.popupWarningBody.idle, theme.popupWarningButton.idle,
                theme.popupWarningButton.selected, true));
        }

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

export class DeleteProgressPopup extends Popup {
    private mode: 'file' | 'directory' | 'items' = 'file';
    private currentPath = '';
    private files = 0;
    private dirs = 0;
    cancelled = false;

    private static readonly BOX_WIDTH = 70;
    private static readonly TEXT_WIDTH = 66;

    constructor() {
        super();
    }

    openWith(mode: 'file' | 'directory' | 'items', initialPath: string): void {
        this.mode = mode;
        this.currentPath = initialPath;
        this.files = 0;
        this.dirs = 0;
        this.cancelled = false;
        super.open();
    }

    updateProgress(currentPath: string, files: number, dirs: number): void {
        this.currentPath = currentPath;
        this.files = files;
        this.dirs = dirs;
    }

    handleInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.cancelled = true;
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
        const bodyStyle = theme.popupInfoBody.idle;

        const boxWidth = DeleteProgressPopup.BOX_WIDTH;
        const textWidth = DeleteProgressPopup.TEXT_WIDTH;

        const showDirs = this.mode !== 'file';

        //  Row 0: top border with title
        //  Row 1: "Deleting the file/folder/items"
        //  Row 2: current path
        //  Row 3: separator
        //  Row 4: files counter
        //  Row 5: directories counter (optional)
        //  Row 5/6: bottom border
        const boxHeight = showDirs ? 7 : 6;
        const totalWidth = boxWidth + this.padH * 2;
        const totalHeight = boxHeight + this.padV * 2;

        const fb = new FrameBuffer(totalWidth, totalHeight);
        fb.fill(0, 0, totalWidth, totalHeight, ' ', bodyStyle);
        fb.drawBox(this.padV, this.padH, boxWidth, boxHeight, bodyStyle, DBOX, 'Delete');

        const textCol = this.padH + 2;

        const kindLabel = this.mode === 'directory' ? 'folder'
            : this.mode === 'items' ? 'items' : 'file';
        fb.write(this.padV + 1, textCol, 'Deleting the ' + kindLabel, bodyStyle);

        const pathDisplay = truncatePath(this.currentPath, textWidth);
        fb.write(this.padV + 2, textCol, pathDisplay, bodyStyle);

        drawSingleSeparator(fb, this.padV + 3, this.padH, boxWidth, bodyStyle);

        const longestLabel = showDirs ? 'Directories' : 'Files';
        const counterWidth = textWidth - 5;
        const filesStr = formatCounter('Files', longestLabel,
            this.files, 0, false, counterWidth);
        fb.write(this.padV + 4, textCol, filesStr, bodyStyle);

        if (showDirs) {
            const dirsStr = formatCounter('Directories', longestLabel,
                this.dirs, 0, false, counterWidth);
            fb.write(this.padV + 5, textCol, dirsStr, bodyStyle);
        }

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

function formatDuration(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec < 1024) return Math.round(bytesPerSec) + ' B/s';
    if (bytesPerSec < 1024 * 1024) return Math.round(bytesPerSec / 1024) + ' KB/s';
    if (bytesPerSec < 1024 * 1024 * 1024) return Math.round(bytesPerSec / (1024 * 1024)) + ' MB/s';
    return (bytesPerSec / (1024 * 1024 * 1024)).toFixed(1) + ' GB/s';
}

function formatStatsLine(startTime: number, bytesCopied: number, bytesTotal: number, recentSpeed: number, width: number): string {
    const elapsedMs = Date.now() - startTime;
    const elapsedSec = elapsedMs / 1000;

    const timeStr = 'Time: ' + formatDuration(elapsedSec);

    let remainStr = 'Remaining: --:--:--';
    let speedStr = '-- B/s';
    if (recentSpeed > 0) {
        speedStr = formatSpeed(recentSpeed);
        const bytesLeft = bytesTotal - bytesCopied;
        if (bytesLeft > 0) {
            const speedEstimate = bytesLeft / recentSpeed;
            const pctDone = bytesCopied / bytesTotal;
            const pctEstimate = pctDone > 0 ? elapsedSec * (1 - pctDone) / pctDone : speedEstimate;
            remainStr = 'Remaining: ' + formatDuration((speedEstimate + pctEstimate) / 2);
        } else {
            remainStr = 'Remaining: ' + formatDuration(0);
        }
    }

    const fixedLen = timeStr.length + remainStr.length + speedStr.length;
    const gaps = width - fixedLen;
    const gapLeft = Math.max(1, Math.floor(gaps / 2));
    const gapRight = Math.max(1, gaps - gapLeft);
    return timeStr + ' '.repeat(gapLeft) + remainStr + ' '.repeat(gapRight) + speedStr;
}
