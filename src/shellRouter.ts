import * as os from 'os';
import { ShellProxy } from './shell';
import { KEY_ENTER, KEY_BACKSPACE, KEY_CTRL_C, KEY_CTRL_U } from './keys';

export class ShellRouter {
    shellOutputBuffer: string[] = [];
    cdSuppressUntil = 0;

    trackInputLen(data: string, panel: { shellInputLen: number }): void {
        if (data === KEY_ENTER) {
            panel.shellInputLen = 0;
        } else if (data === KEY_BACKSPACE) {
            panel.shellInputLen = Math.max(0, panel.shellInputLen - 1);
        } else if (data === KEY_CTRL_C || data === KEY_CTRL_U) {
            panel.shellInputLen = 0;
        } else if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            panel.shellInputLen++;
        }
    }

    changeDir(dir: string, shell: ShellProxy, panel: { shellInputLen: number }): void {
        shell.write('\x15');
        panel.shellInputLen = 0;
        this.cdSuppressUntil = Date.now() + 200;
        const cmd = os.platform() === 'win32'
            ? 'cd "' + dir.replace(/"/g, '`"') + '"\r'
            : "cd '" + dir.replace(/'/g, "'\\''") + "'\r";
        shell.write(cmd);
    }

    refreshPrompt(shell: ShellProxy): void {
        if (!this.cdSuppressUntil) return;
        this.cdSuppressUntil = 0;
        shell.write('\x15\r');
    }

    flush(emit: (data: string) => void): void {
        if (this.shellOutputBuffer.length > 0) {
            emit(this.shellOutputBuffer.join(''));
            this.shellOutputBuffer = [];
        }
    }

    isSuppressed(): boolean {
        return Date.now() < this.cdSuppressUntil;
    }
}
