import { Theme } from '../../settings';
import { PopupInputResult } from '../../components/popup';
import { ComposedPopup } from '../../components/composedPopup';
import { FormView, warningFormTheme, infoFormTheme } from '../../components/formView';
import { TextBlock } from '../../components/textBlock';
import { ButtonGrid } from '../../components/buttonGrid';
import {
    KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_TAB, KEY_SHIFT_TAB,
    KEY_ENTER, KEY_ESCAPE, KEY_DOUBLE_ESCAPE, KEY_SPACE,
} from '../../keys';

export type OverwriteChoice = 'overwrite' | 'skip' | 'rename' | 'rename_n' | 'append' | 'keep_largest' | 'keep_newest' | 'cancel';

export interface OverwriteInfo {
    name: string;
    isDir: boolean;
    srcSize: number;
    srcDate: Date;
    dstSize: number;
    dstDate: Date;
    renameN: number;
    renameNName: string;
}

export interface OverwritePopupResult {
    choice: OverwriteChoice;
    remember: boolean;
    renameName?: string;
}

type ResolveCallback = (result: OverwritePopupResult) => void;

const BOX_WIDTH = 70;
const TEXT_WIDTH = 66;

// Overwrite-confirmation window: two informational text blocks, a Remember
// checkbox and an 8-button grid. Assembled from generic components.
export class OverwritePopup extends ComposedPopup {
    private info: OverwriteInfo | null = null;
    private resolveCallback: ResolveCallback | null = null;
    private focusArea = 1; // 0 = checkbox, 1 = buttons
    private grid!: ButtonGrid;
    private renameMode = false;

    openWith(info: OverwriteInfo, resolve: ResolveCallback): void {
        this.info = info;
        this.resolveCallback = resolve;
        this.focusArea = 1;
        this.renameMode = false;
        this.buildOverwriteView(info);
        super.open();
    }

    private buildOverwriteView(info: OverwriteInfo): void {
        const kind = info.isDir ? 'Directory' : 'File';
        const truncName = info.name.length > TEXT_WIDTH
            ? '...' + info.name.slice(info.name.length - TEXT_WIDTH + 3) : info.name;
        const newLine = formatFileStat('New:', info.srcSize, info.srcDate, TEXT_WIDTH);
        const existLine = formatFileStat('Existing:', info.dstSize, info.dstDate, TEXT_WIDTH);

        this.grid = new ButtonGrid([
            [
                { label: 'Overwrite', primary: true }, { label: 'Skip' },
                { label: 'Rename' }, { label: `Rename (${info.renameN})` },
            ],
            [
                { label: 'Append' }, { label: 'Keep Largest' },
                { label: 'Keep Newest' }, { label: 'Cancel' },
            ],
        ]);
        if (info.isDir) {
            this.grid.disabled.add(4); // Append disabled for directories
        }

        const view = this.createView('Warning', undefined, warningFormTheme);
        view.minWidth = BOX_WIDTH;

        view.addComponent(new TextBlock([
            { text: kind + ' already exists' },
            { text: truncName, bold: true },
        ]));
        view.addSeparator();
        view.addComponent(new TextBlock([{ text: newLine }, { text: existLine }]));
        view.addSeparator();
        view.addCheckbox('remember', 'Remember choice', false);
        view.addSeparator();
        view.addComponent(this.grid, 'buttons');

        view.onInput = (data) => this.handleOverwriteInput(data, view);
        this.setActiveView(view);
        view.setFocusById('buttons');
    }

    private get selectedButton(): number {
        return this.grid.selected;
    }
    private set selectedButton(v: number) {
        this.grid.selected = v;
    }

    private handleOverwriteInput(data: string, view: FormView): PopupInputResult | null {
        if (data === KEY_ESCAPE || data === KEY_DOUBLE_ESCAPE) {
            this.doResolve({ choice: 'cancel', remember: false });
            return { action: 'consumed' };
        }

        if (data === KEY_TAB || data === KEY_SHIFT_TAB) {
            this.focusArea = this.focusArea === 0 ? 1 : 0;
            view.setFocusById(this.focusArea === 0 ? 'remember' : 'buttons');
            return { action: 'consumed' };
        }

        if (this.focusArea === 0) {
            if (data === KEY_SPACE) {
                view.checkbox('remember').toggle();
                return { action: 'consumed' };
            }
            if (data === KEY_DOWN || data === KEY_ENTER) {
                this.focusArea = 1;
                view.setFocusById('buttons');
                return { action: 'consumed' };
            }
            return { action: 'consumed' };
        }

        // Buttons focused
        if (data === KEY_LEFT) {
            this.moveButton(-1);
            return { action: 'consumed' };
        }
        if (data === KEY_RIGHT) {
            this.moveButton(1);
            return { action: 'consumed' };
        }
        if (data === KEY_UP) {
            if (this.selectedButton >= 4) {
                this.selectedButton = this.selectedButton - 4;
            } else {
                this.focusArea = 0;
                view.setFocusById('remember');
            }
            return { action: 'consumed' };
        }
        if (data === KEY_DOWN) {
            if (this.selectedButton < 4) {
                const target = this.selectedButton + 4;
                if (!this.grid.disabled.has(target)) {
                    this.selectedButton = target;
                } else {
                    for (let i = 4; i < 8; i++) {
                        if (!this.grid.disabled.has(i)) {
                            this.selectedButton = i;
                            break;
                        }
                    }
                }
            }
            return { action: 'consumed' };
        }
        if (data === KEY_ENTER) {
            this.confirmButton();
            return { action: 'consumed' };
        }

        return { action: 'consumed' };
    }

    private moveButton(dir: number): void {
        let next = this.selectedButton + dir;
        if (next < 0) next = 7;
        if (next > 7) next = 0;
        let tries = 8;
        while (this.grid.disabled.has(next) && tries > 0) {
            next += dir;
            if (next < 0) next = 7;
            if (next > 7) next = 0;
            tries--;
        }
        this.selectedButton = next;
    }

    private confirmButton(): void {
        if (this.grid.disabled.has(this.selectedButton)) return;
        const choices: OverwriteChoice[] = ['overwrite', 'skip', 'rename', 'rename_n', 'append', 'keep_largest', 'keep_newest', 'cancel'];
        const choice = choices[this.selectedButton];

        if (choice === 'rename') {
            this.openRenameView();
            return;
        }

        this.doResolve({
            choice,
            remember: this.activeView ? this.activeView.checkbox('remember').checked : false,
            renameName: choice === 'rename_n' ? this.info?.renameNName : undefined,
        });
    }

    // --- Rename mode ---

    private openRenameView(): void {
        this.renameMode = true;

        const view = this.createView('Rename', undefined, infoFormTheme);
        view.minWidth = BOX_WIDTH;

        view.addLabel('New name:');
        view.addInput('name', TEXT_WIDTH - 2, this.info?.name || '');
        view.addSeparator();
        view.addButtons('buttons', ['Ok', 'Cancel']);

        view.onConfirm = () => {
            const newName = view.input('name').buffer.trim();
            if (!newName) return { action: 'consumed' };
            this.doResolve({ choice: 'rename', remember: false, renameName: newName });
            return { action: 'consumed' };
        };
        view.onCancel = () => {
            this.renameMode = false;
            if (this.info) this.buildOverwriteView(this.info);
            return { action: 'consumed' };
        };

        this.setActiveView(view);
    }

    // --- Resolve ---

    private doResolve(result: OverwritePopupResult): void {
        const cb = this.resolveCallback;
        this.resolveCallback = null;
        this.close();
        if (cb) cb(result);
    }

    cancelResolve(): void {
        if (this.resolveCallback) {
            this.doResolve({ choice: 'cancel', remember: false });
        }
    }

    // --- Mouse: don't close on outside click ---

    override handleMouseDown(row: number, col: number): PopupInputResult {
        const fbRow = row - this.screenRow;
        const fbCol = col - this.screenCol;
        if (fbRow < 0 || fbRow >= this.fbHeight || fbCol < 0 || fbCol >= this.fbWidth) {
            return { action: 'consumed' };
        }
        const result = this.onMouseDown(fbRow, fbCol);
        if (result) return result;
        return { action: 'consumed' };
    }

    override handleMouseUp(row: number, col: number): PopupInputResult {
        const pressedBtn = this.mouseDownButton;
        this.mouseDownButton = -1;
        if (pressedBtn < 0) return { action: 'consumed' };
        const fbRow = row - this.screenRow;
        const fbCol = col - this.screenCol;
        if (this.renameMode) {
            return { action: 'consumed' };
        }
        const releasedBtn = this.hitTestOverwriteButton(fbRow, fbCol);
        if (releasedBtn >= 0 && releasedBtn === pressedBtn) {
            this.selectedButton = releasedBtn;
            this.focusArea = 1;
            this.confirmButton();
        }
        return { action: 'consumed' };
    }

    override handleMouseScroll(_up: boolean): PopupInputResult {
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        if (this.renameMode) {
            return super.onMouseDown(fbRow, fbCol);
        }

        const checkboxRow = this.padV + 7;
        if (fbRow === checkboxRow && this.activeView) {
            this.activeView.checkbox('remember').toggle();
            this.focusArea = 0;
            this.activeView.setFocusById('remember');
            return { action: 'consumed' };
        }

        const btnRow1 = this.padV + 9;
        const btnRow2 = this.padV + 10;
        if (fbRow === btnRow1 || fbRow === btnRow2) {
            const idx = this.hitTestOverwriteButton(fbRow, fbCol);
            if (idx >= 0) {
                this.focusArea = 1;
                this.selectedButton = idx;
                this.mouseDownButton = idx;
                return { action: 'consumed' };
            }
        }

        return null;
    }

    private hitTestOverwriteButton(fbRow: number, fbCol: number): number {
        const innerWidth = BOX_WIDTH - 2;
        const localCol = fbCol - this.padH - 1;
        const idx = this.grid.hitTest(fbRow - (this.padV + 9), localCol, innerWidth);
        if (idx >= 0 && !this.grid.disabled.has(idx)) return idx;
        return -1;
    }

    // --- Blink ---

    get isRenameBlink(): boolean {
        return this.active && this.renameMode && this.hasBlink;
    }

    renderOverwriteBlink(rows: number, cols: number, theme: Theme): string {
        if (!this.isRenameBlink) return '';
        return this.renderBlink(rows, cols, theme);
    }

    resetOverwriteBlink(): void {
        if (this.activeView) this.activeView.resetBlinks();
    }
}

// --- Data formatting helpers ---

function groupDigits(n: number): string {
    const s = String(n);
    const parts: string[] = [];
    for (let i = s.length; i > 0; i -= 3) {
        parts.unshift(s.slice(Math.max(0, i - 3), i));
    }
    return parts.join(',');
}

function formatDateStr(d: Date): string {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function formatFileStat(label: string, size: number, date: Date, width: number): string {
    const dateStr = formatDateStr(date);
    const sizeStr = groupDigits(size);
    const rightPart = sizeStr + '  ' + dateStr;
    const gapSize = Math.max(1, width - label.length - rightPart.length);
    return label + ' '.repeat(gapSize) + rightPart;
}
