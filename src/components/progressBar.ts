import { FrameBuffer } from '../frameBuffer';
import { Theme } from '../settings';
import { PROGRESS_FILLED, PROGRESS_EMPTY } from '../visualPrimitives';
import { FormTheme, FormComponent } from './formView';

// A generic non-focusable progress bar: a fixed-width run of filled/empty
// cells with an optional trailing percentage. The caller updates `percent`.
export class ProgressBar implements FormComponent {
    percent = 0;
    readonly focusStops = 0;
    readonly height = 1;
    private barWidth: number;
    private showPercent: boolean;

    constructor(barWidth: number, showPercent = true) {
        this.barWidth = barWidth;
        this.showPercent = showPercent;
    }

    handleInput(): boolean {
        return false;
    }

    text(): string {
        let percentStr = '';
        let width = this.barWidth;
        if (this.showPercent) {
            percentStr = ' ' + String(Math.min(Math.round(this.percent), 100)).padStart(3) + '%';
            width = Math.max(0, this.barWidth - percentStr.length);
        }
        const clamped = Math.min(Math.max(this.percent, 0), 100);
        const pos = Math.floor(clamped * width / 100);
        return PROGRESS_FILLED.repeat(pos) + PROGRESS_EMPTY.repeat(width - pos) + percentStr;
    }

    render(fb: FrameBuffer, row: number, col: number, innerWidth: number,
           _focused: boolean, _subFocus: number, ft: FormTheme, _theme: Theme): void {
        fb.write(row, col, ' '.repeat(innerWidth), ft.body.idle);
        fb.write(row, col + 1, this.text(), ft.body.idle);
    }
}
