import * as os from 'os';
import { Theme } from './settings';
import { PopupInputResult } from './popup';
import { ComposedPopup } from './composedPopup';
import { DropdownOption } from './dropdownControl';

export interface MkdirResult {
    dirName: string;
    linkType: 'none' | 'symbolic' | 'junction';
    linkTarget: string;
    multipleNames: boolean;
}

const LABEL_WIDTH = 15;

export class MkdirPopup extends ComposedPopup {
    private dialogWidth = 68;

    constructor() {
        super();
    }

    private buildOptions(): DropdownOption[] {
        const options: DropdownOption[] = [
            { label: 'none', value: 'none' },
            { label: 'symbolic', value: 'symbolic' },
        ];
        if (os.platform() === 'win32') {
            options.push({ label: 'junction', value: 'junction' });
        }
        return options;
    }

    openWith(initial: string, cols: number): void {
        this.dialogWidth = Math.min(68, cols - 4);
        const innerW = this.dialogWidth - 2;
        const nameWidth = innerW - 2;
        const fieldWidth = innerW - LABEL_WIDTH - 1;

        const view = this.createView('Make directory');
        view.minWidth = this.dialogWidth;

        view.addLabel('Create the directory:', { hotkey: 'd' });
        view.addInput('name', nameWidth, initial);
        view.addSeparator();
        view.addDropdown('linkType', this.buildOptions(), fieldWidth, 0, 'Link type:', LABEL_WIDTH, 'L');
        view.addInput('target', fieldWidth, '', { label: 'Target:', labelWidth: LABEL_WIDTH, hotkey: 'T' });
        view.addCheckbox('multiple', 'Process multiple names', false, 'm');
        view.addSeparator();
        view.addButtons('buttons', ['OK', 'Cancel']);

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

    get result(): MkdirResult {
        const view = this.activeView!;
        return {
            dirName: view.input('name').buffer,
            linkType: view.dropdown('linkType').selected.value as 'none' | 'symbolic' | 'junction',
            linkTarget: view.input('target').buffer,
            multipleNames: view.checkbox('multiple').checked,
        };
    }

    renderMkdirBlink(rows: number, cols: number, theme: Theme): string {
        return this.renderBlink(rows, cols, theme);
    }

    resetMkdirBlink(): void {
        if (this.activeView) this.activeView.resetBlinks();
    }
}
