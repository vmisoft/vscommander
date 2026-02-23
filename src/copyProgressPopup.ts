import { PopupInputResult } from './popup';
import { ComposedPopup } from './composedPopup';
import { warningFormTheme, FormView } from './formView';
import { PROGRESS_FILLED, PROGRESS_EMPTY } from './visualPrimitives';
import { KEY_ESCAPE, KEY_DOUBLE_ESCAPE } from './keys';

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

export class ScanProgressPopup extends ComposedPopup {
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
        this.currentPath = '';
        this.dirs = 0;
        this.files = 0;
        this.bytes = 0;
        this.cancelled = false;

        const title = mode === 'move' ? 'Move' : 'Copy';
        const textWidth = ScanProgressPopup.TEXT_WIDTH;
        const counterWidth = textWidth - 5;
        const longestLabel = 'Folders';

        const view = this.createView(title);
        view.minWidth = ScanProgressPopup.BOX_WIDTH;

        view.addLabel('Scanning the folder');
        view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
            fb.write(row, col + 1, truncatePath(this.currentPath, textWidth), ft.body.idle);
        });
        view.addSeparator();
        view.addCustom(3, false, (fb, row, col, _w, _focused, ft) => {
            const s = ft.body.idle;
            fb.write(row, col + 1, formatCounter('Folders', longestLabel, this.dirs, 0, false, counterWidth), s);
            fb.write(row + 1, col + 1, formatCounter('Files', longestLabel, this.files, 0, false, counterWidth), s);
            fb.write(row + 2, col + 1, formatCounter('Bytes', longestLabel, this.bytes, 0, false, counterWidth), s);
        });

        view.onInput = (data) => {
            if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
                this.cancelled = true;
                this.close();
                return { action: 'close', confirm: false };
            }
            return { action: 'consumed' };
        };

        this.setActiveView(view);
        super.open();
    }

    updateScan(currentPath: string, dirs: number, files: number, bytes: number): void {
        this.currentPath = currentPath;
        this.dirs = dirs;
        this.files = files;
        this.bytes = bytes;
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
}

export type PauseAction = 'continue' | 'retry' | 'skip' | 'navigate' | 'cancel';

export class CopyProgressPopup extends ComposedPopup {
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
    private startTime = 0;
    private speedSamples: { time: number; bytes: number }[] = [];
    private lastSampleTime = 0;
    private normalView: FormView | null = null;

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
        this.startTime = Date.now();
        this.speedSamples = [];
        this.lastSampleTime = 0;
        this.buildNormalView();
        this.setActiveView(this.normalView);
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
        if (action === 'cancel') {
            this.cancelled = true;
            this.close();
        } else {
            this.setActiveView(this.normalView);
        }
        if (resolve) resolve(action);
    }

    private buildNormalView(): void {
        const title = this.state.mode === 'move' ? 'Move' : 'Copy';
        const actionLabel = this.state.mode === 'move' ? 'Moving' : 'Copying';
        const textWidth = CopyProgressPopup.TEXT_WIDTH;
        const canvasWidth = CopyProgressPopup.CANVAS_WIDTH;
        const counterWidth = textWidth - 5;

        const view = this.createView(title);
        view.minWidth = CopyProgressPopup.BOX_WIDTH;

        view.addLabel(actionLabel);
        view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
            fb.write(row, col + 1, truncatePath(this.state.srcName, textWidth), ft.body.idle);
        });
        view.addLabel('To');
        view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
            fb.write(row, col + 1, truncatePath(this.state.dstName, textWidth), ft.body.idle);
        });
        view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
            fb.write(row, col + 1, makeProgressBar(canvasWidth, this.state.currentPercent, true), ft.body.idle);
        });
        view.addSeparator('Total');
        view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
            fb.write(row, col + 1, formatCounter('Files', 'Bytes',
                this.state.filesCopied, this.state.filesTotal, true, counterWidth), ft.body.idle);
        });
        view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
            fb.write(row, col + 1, formatCounter('Bytes', 'Files',
                this.state.bytesCopied, this.state.bytesTotal, true, counterWidth), ft.body.idle);
        });
        view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
            fb.write(row, col + 1, makeProgressBar(canvasWidth, this.state.totalPercent, true), ft.body.idle);
        });
        view.addSeparator();
        view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
            const statsLine = formatStatsLine(
                this.startTime, this.state.bytesCopied, this.state.bytesTotal,
                this.getRecentSpeed(), textWidth);
            fb.write(row, col + 1, statsLine, ft.body.idle);
        });

        view.onInput = (data) => {
            if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
                this.paused = true;
                this.buildPausedView();
                return { action: 'consumed' };
            }
            return { action: 'consumed' };
        };

        this.normalView = view;
    }

    private buildPausedView(): void {
        const title = this.state.mode === 'move' ? 'Move' : 'Copy';
        const textWidth = CopyProgressPopup.TEXT_WIDTH;

        const view = this.createView(title, undefined, warningFormTheme);
        view.minWidth = CopyProgressPopup.BOX_WIDTH;

        view.addCustom(6, false, (fb, row, col, _w, _focused, ft) => {
            const s = ft.body.idle;
            fb.write(row, col + 1, 'Operation has been interrupted', s);
            fb.write(row + 2, col + 1, 'Currently processing:', s);
            const pathDisplay = truncatePath(this.state.srcName, textWidth);
            fb.write(row + 3, col + 1, pathDisplay, { ...s, bold: true });
            fb.write(row + 5, col + 1, 'Do you really want to cancel it?', s);
        });
        view.addSeparator();
        view.addButtons('buttons', ['Continue', 'Retry', 'Skip', 'Show', 'Cancel']);

        view.onConfirm = () => {
            const btnIdx = view.buttons('buttons').selectedIndex;
            this.resolvePause(CopyProgressPopup.PAUSE_BUTTONS[btnIdx]);
            return { action: 'consumed' };
        };
        view.onCancel = () => {
            this.resolvePause('cancel');
            return { action: 'consumed' };
        };

        this.setActiveView(view);
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
}

export class DeleteProgressPopup extends ComposedPopup {
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
        this.currentPath = initialPath;
        this.files = 0;
        this.dirs = 0;
        this.cancelled = false;

        const showDirs = mode !== 'file';
        const kindLabel = mode === 'directory' ? 'folder'
            : mode === 'items' ? 'items' : 'file';
        const textWidth = DeleteProgressPopup.TEXT_WIDTH;
        const longestLabel = showDirs ? 'Directories' : 'Files';
        const counterWidth = textWidth - 5;

        const view = this.createView('Delete');
        view.minWidth = DeleteProgressPopup.BOX_WIDTH;

        view.addLabel('Deleting the ' + kindLabel);
        view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
            fb.write(row, col + 1, truncatePath(this.currentPath, textWidth), ft.body.idle);
        });
        view.addSeparator();

        if (showDirs) {
            view.addCustom(2, false, (fb, row, col, _w, _focused, ft) => {
                const s = ft.body.idle;
                fb.write(row, col + 1, formatCounter('Files', longestLabel, this.files, 0, false, counterWidth), s);
                fb.write(row + 1, col + 1, formatCounter('Directories', longestLabel, this.dirs, 0, false, counterWidth), s);
            });
        } else {
            view.addCustom(1, false, (fb, row, col, _w, _focused, ft) => {
                fb.write(row, col + 1, formatCounter('Files', longestLabel, this.files, 0, false, counterWidth), ft.body.idle);
            });
        }

        view.onInput = (data) => {
            if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
                this.cancelled = true;
            }
            return { action: 'consumed' };
        };

        this.setActiveView(view);
        super.open();
    }

    updateProgress(currentPath: string, files: number, dirs: number): void {
        this.currentPath = currentPath;
        this.files = files;
        this.dirs = dirs;
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
}

// --- Helper functions ---

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
