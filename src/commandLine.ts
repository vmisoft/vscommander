import { moveTo, resetStyle, hideCursor } from './draw';
import { PanelSettings } from './settings';
import { Layout } from './types';
import { applyStyle } from './helpers';
import { TerminalBuffer } from './terminalBuffer';
import { PanelInputResult } from './panel';

export interface CommandLineContext {
    cols: number;
    layout: Layout;
    settings: PanelSettings;
    termBuffer: TerminalBuffer;
    hasActivePopup: boolean;
    visible: boolean;
    inactivePaneHidden: boolean;
    activePane: 'left' | 'right';
}

export class CommandLine {
    shellInputLen = 0;
    cmdCursorVisible = true;
    waitingMode = false;
    spinnerFrame = 0;

    render(ctx: CommandLineContext): string {
        const { cols, layout, settings, termBuffer } = ctx;
        const { cmdRow } = layout;
        const t = settings.theme;
        const out: string[] = [];

        if (this.waitingMode) {
            const spinnerFrames = [
                '\u28ff\u28f7', '\u28ff\u28ef', '\u28ff\u28df', '\u28ff\u287f', '\u28ff\u28bf', '\u287f\u28ff',
                '\u28bf\u28ff', '\u28fb\u28ff', '\u28fd\u28ff', '\u28fe\u28ff', '\u28f7\u28ff', '\u28ff\u28fe',
            ];
            const spinner = spinnerFrames[this.spinnerFrame % spinnerFrames.length];
            const display = (' ' + spinner + ' Running... ' + settings.toggleKey + ' for details').slice(0, cols);
            out.push(applyStyle(t.commandLineBusy.idle));
            out.push(moveTo(cmdRow, 1));
            out.push(display);
            if (display.length < cols) {
                out.push(' '.repeat(cols - display.length));
            }
            out.push(resetStyle());
            return out.join('');
        }

        const termRow = termBuffer.getCursorRow();
        const content = termBuffer.getRow(termRow);
        const display = content.slice(0, cols);

        out.push(applyStyle(t.commandLine.idle));
        out.push(moveTo(cmdRow, 1));
        out.push(display);
        if (display.length < cols) {
            out.push(' '.repeat(cols - display.length));
        }
        out.push(resetStyle());

        return out.join('');
    }

    renderCursor(ctx: CommandLineContext): string {
        const { layout, settings, termBuffer } = ctx;
        const t = settings.theme;
        const cursorCol = termBuffer.getCursorCol() + 1;
        let out = moveTo(layout.cmdRow, cursorCol);
        if (this.cmdCursorVisible) {
            out += applyStyle(t.commandLine.idle) + '\u2582' + resetStyle();
        } else {
            const termRow = termBuffer.getCursorRow();
            const content = termBuffer.getRow(termRow);
            const charAtCursor = content[termBuffer.getCursorCol()] || ' ';
            out += applyStyle(t.commandLine.idle) + charAtCursor + resetStyle();
        }
        out += hideCursor();
        return out;
    }

    renderCursorBlink(ctx: CommandLineContext): string {
        if (!ctx.visible || this.waitingMode || ctx.hasActivePopup) return '';
        this.cmdCursorVisible = !this.cmdCursorVisible;
        return this.renderCursor(ctx);
    }

    renderSpinnerUpdate(ctx: CommandLineContext): string {
        if (!ctx.visible || !this.waitingMode) return '';
        this.spinnerFrame++;
        return this.render(ctx) + hideCursor();
    }

    renderShellUpdate(ctx: CommandLineContext, renderTerminalArea: () => string): string {
        if (!ctx.visible || this.waitingMode || ctx.hasActivePopup) return '';
        const out: string[] = [];
        if (ctx.inactivePaneHidden) {
            out.push(renderTerminalArea());
        }
        out.push(this.render(ctx));
        out.push(this.renderCursor(ctx));
        return out.join('');
    }

    resetBlink(): void {
        this.cmdCursorVisible = true;
    }

    handleInput(data: string): PanelInputResult | null {
        if (data === '\x7f') {
            if (this.shellInputLen > 0) {
                this.shellInputLen = Math.max(0, this.shellInputLen - 1);
                return { action: 'input', data: '\x7f', redraw: '' };
            }
            return null;
        }

        if (data === '\x03') {
            if (this.shellInputLen > 0) {
                this.shellInputLen = 0;
                return { action: 'input', data: '\x03', redraw: '' };
            }
            return null;
        }

        if (data === '\x15') {
            if (this.shellInputLen > 0) {
                this.shellInputLen = 0;
                return { action: 'input', data: '\x15', redraw: '' };
            }
            return null;
        }

        if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            this.shellInputLen++;
            return { action: 'input', data, redraw: '' };
        }

        return null;
    }
}
