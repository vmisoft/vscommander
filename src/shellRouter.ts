import * as os from 'os';
import { ShellProxy } from './shell';

export class ShellRouter {
    shellOutputBuffer: string[] = [];
    cdSuppressUntil = 0;

    trackInputLen(data: string, panel: { shellInputLen: number }): void {
        if (data === '\r') {
            panel.shellInputLen = 0;
        } else if (data === '\x7f') {
            panel.shellInputLen = Math.max(0, panel.shellInputLen - 1);
        } else if (data === '\x03' || data === '\x15') {
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
