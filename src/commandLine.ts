import { moveTo, resetStyle, hideCursor } from './draw';
import { PanelSettings } from './settings';
import { Layout } from './types';
import { applyStyle } from './helpers';
import { TerminalBuffer } from './terminalBuffer';
import { PanelInputResult } from './panel';
import { SPINNER_FRAMES, CURSOR_BLOCK } from './visualPrimitives';
import { KEY_BACKSPACE, KEY_CTRL_C, KEY_CTRL_U } from './keys';

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
            const spinner = SPINNER_FRAMES[this.spinnerFrame % SPINNER_FRAMES.length];
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
            out += applyStyle(t.commandLine.idle) + CURSOR_BLOCK + resetStyle();
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
        if (data === KEY_BACKSPACE) {
            if (this.shellInputLen > 0) {
                this.shellInputLen = Math.max(0, this.shellInputLen - 1);
                return { action: 'input', data: KEY_BACKSPACE, redraw: '' };
            }
            return null;
        }

        if (data === KEY_CTRL_C) {
            if (this.shellInputLen > 0) {
                this.shellInputLen = 0;
                return { action: 'input', data: KEY_CTRL_C, redraw: '' };
            }
            return null;
        }

        if (data === KEY_CTRL_U) {
            if (this.shellInputLen > 0) {
                this.shellInputLen = 0;
                return { action: 'input', data: KEY_CTRL_U, redraw: '' };
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
