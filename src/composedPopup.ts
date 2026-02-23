import { Theme } from './settings';
import { Popup, PopupInputResult } from './popup';
import { FormView, ThemeResolver } from './formView';
import { FrameBuffer } from './frameBuffer';
import { BoxChars } from './frameBuffer';
import { DBOX } from './draw';

export abstract class ComposedPopup extends Popup {
    private _activeView: FormView | null = null;

    protected get activeView(): FormView | null {
        return this._activeView;
    }

    protected createView(title: string, boxChars?: BoxChars, themeResolver?: ThemeResolver): FormView {
        return new FormView(title, boxChars ?? DBOX, themeResolver);
    }

    protected setActiveView(view: FormView | null): void {
        this._activeView = view;
        if (view) {
            view.focusIndex = 0;
            view.resetBlinks();
        }
    }

    handleInput(data: string): PopupInputResult {
        if (!this._activeView) return { action: 'consumed' };
        return this._activeView.handleInput(data);
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        if (!this._activeView) return new FrameBuffer(0, 0);
        return this._activeView.render(theme, this.padH, this.padV, this.termCols);
    }

    render(rows: number, cols: number, theme: Theme): string {
        if (!this.active) return '';
        const fb = this.renderToBuffer(theme);
        if (fb.width === 0 || fb.height === 0) return '';
        const baseRow = Math.floor((rows - fb.height) / 2) + 1;
        const baseCol = Math.floor((cols - fb.width) / 2) + 1;
        this.setScreenPosition(baseRow, baseCol, fb.width, fb.height);
        return fb.toAnsi(this.screenRow, this.screenCol);
    }

    get hasBlink(): boolean {
        if (!this._activeView) return false;
        return this._activeView.hasBlink;
    }

    renderBlink(_rows: number, _cols: number, theme: Theme): string {
        if (!this.active || !this._activeView || !this._activeView.hasBlink) return '';
        return this._activeView.renderBlink(
            this.screenRow, this.screenCol,
            this.padH, this.padV, theme,
        );
    }

    protected override onMouseDown(fbRow: number, fbCol: number): PopupInputResult | null {
        if (!this._activeView) return null;
        return this._activeView.hitTest(fbRow, fbCol, this.padH, this.padV);
    }

    override handleMouseScroll(up: boolean): PopupInputResult {
        if (this._activeView && this._activeView.onScroll) {
            this._activeView.onScroll(up);
        }
        return { action: 'consumed' };
    }
}
