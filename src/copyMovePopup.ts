import { Theme } from './settings';
import { PopupInputResult } from './popup';
import { ComposedPopup } from './composedPopup';
import { DropdownOption } from './dropdownControl';

export type CopyMoveMode = 'copy' | 'move';
export type OverwriteMode = 'ask' | 'overwrite' | 'skip';

export interface CopyMoveResult {
    mode: CopyMoveMode;
    targetPath: string;
    overwrite: OverwriteMode;
    sourceFiles: string[];
    sourceCwd: string;
}

const LABEL_WIDTH = 18;

export class CopyMovePopup extends ComposedPopup {
    private dialogWidth = 68;
    mode: CopyMoveMode = 'copy';
    sourceFiles: string[] = [];
    sourceCwd = '';

    constructor() {
        super();
    }

    private buildOverwriteOptions(): DropdownOption[] {
        return [
            { label: 'Ask', value: 'ask' },
            { label: 'Overwrite', value: 'overwrite' },
            { label: 'Skip', value: 'skip' },
        ];
    }

    openWith(mode: CopyMoveMode, targetDir: string, sourceFiles: string[], sourceCwd: string, cols: number): void {
        this.mode = mode;
        this.sourceFiles = sourceFiles;
        this.sourceCwd = sourceCwd;
        this.dialogWidth = Math.min(68, cols - 4);
        const innerW = this.dialogWidth - 2;
        const nameWidth = innerW - 2;
        const fieldWidth = innerW - LABEL_WIDTH - 1;

        const title = mode === 'copy' ? 'Copy' : 'Rename or move';

        let desc: string;
        if (sourceFiles.length === 1) {
            const name = sourceFiles[0];
            const maxName = innerW - (mode === 'copy' ? 14 : 24);
            const displayName = name.length > maxName ? name.slice(0, maxName - 1) + '~' : name;
            desc = mode === 'copy'
                ? 'Copy "' + displayName + '" to:'
                : 'Rename or move "' + displayName + '" to:';
        } else {
            desc = mode === 'copy'
                ? 'Copy ' + sourceFiles.length + ' files to:'
                : 'Move ' + sourceFiles.length + ' files to:';
        }

        const view = this.createView(title);
        view.minWidth = this.dialogWidth;

        view.addLabel(desc);
        view.addInput('target', nameWidth, targetDir);
        view.addSeparator();
        view.addDropdown('overwrite', this.buildOverwriteOptions(), fieldWidth, 0,
            'If file exists:', LABEL_WIDTH);
        view.addSeparator();
        view.addButtons('buttons', [mode === 'copy' ? 'Copy' : 'Move', 'Cancel']);

        view.onConfirm = () => this.closeWithConfirm();
        view.onCancel = () => {
            this.close();
            return { action: 'close', confirm: false };
        };

        this.setActiveView(view);
        super.open();
    }

    override close(): void {
        if (this.activeView) {
            this.activeView.closeDropdowns();
        }
        super.close();
    }

    get result(): CopyMoveResult {
        const view = this.activeView!;
        return {
            mode: this.mode,
            targetPath: view.input('target').buffer,
            overwrite: view.dropdown('overwrite').selected.value as OverwriteMode,
            sourceFiles: this.sourceFiles,
            sourceCwd: this.sourceCwd,
        };
    }

    renderCopyMoveBlink(rows: number, cols: number, theme: Theme): string {
        return this.renderBlink(rows, cols, theme);
    }

    resetCopyMoveBlink(): void {
        if (this.activeView) this.activeView.resetBlinks();
    }
}
