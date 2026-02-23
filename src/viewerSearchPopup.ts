import { Theme } from './settings';
import { PopupInputResult } from './popup';
import { ComposedPopup } from './composedPopup';

export interface ViewerSearchResult {
    text: string;
    caseSensitive: boolean;
    wholeWords: boolean;
    regex: boolean;
    hexSearch: boolean;
    direction: 'forward' | 'backward';
}

export class ViewerSearchPopup extends ComposedPopup {
    private dialogWidth = 60;
    private lastText = '';

    constructor() {
        super();
    }

    openSearch(cols: number): void {
        this.dialogWidth = Math.min(60, cols - 4);
        const innerW = this.dialogWidth - 2;
        const fieldWidth = innerW - 2;

        const view = this.createView('Search');
        view.minWidth = this.dialogWidth;

        view.addLabel('Search for:');
        view.addInput('text', fieldWidth, this.lastText);
        view.addSeparator();
        view.addCheckbox('caseSensitive', 'Case sensitive', false, 'C');
        view.addCheckbox('regex', 'Regular expression', false, 'R');
        view.addCheckbox('wholeWords', 'Whole words', false, 'W');
        view.addCheckbox('hexSearch', 'Hex search', false, 'H');
        view.addSeparator();
        view.addButtons('buttons', ['Prev', 'Next', 'Cancel']);

        view.onConfirm = () => this.closeWithResult('forward');
        view.onCancel = () => {
            this.close();
            return { action: 'close', confirm: false };
        };

        this.setActiveView(view);
        super.open();
    }

    private closeWithResult(direction: 'forward' | 'backward'): PopupInputResult {
        const result = this.result;
        if (result) result.direction = direction;
        this.lastText = result?.text || '';
        const command = result;
        this.close();
        return { action: 'close', confirm: true, command };
    }

    override handleInput(data: string): PopupInputResult {
        if (!this.activeView) return { action: 'consumed' };

        const result = this.activeView.handleInput(data);
        if (result.action === 'close' && result.confirm) {
            const btnIdx = this.activeView.buttons('buttons').selectedIndex;
            if (btnIdx === 0) {
                return this.closeWithResult('backward');
            } else if (btnIdx === 1) {
                return this.closeWithResult('forward');
            } else {
                this.close();
                return { action: 'close', confirm: false };
            }
        }
        return result;
    }

    get result(): ViewerSearchResult | null {
        if (!this.activeView) return null;
        return {
            text: this.activeView.input('text').buffer,
            caseSensitive: this.activeView.checkbox('caseSensitive').checked,
            wholeWords: this.activeView.checkbox('wholeWords').checked,
            regex: this.activeView.checkbox('regex').checked,
            hexSearch: this.activeView.checkbox('hexSearch').checked,
            direction: 'forward',
        };
    }

    renderViewerSearchBlink(rows: number, cols: number, theme: Theme): string {
        return this.renderBlink(rows, cols, theme);
    }

    resetViewerSearchBlink(): void {
        if (this.activeView) this.activeView.resetBlinks();
    }
}
