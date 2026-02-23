// Shell proxy: spawn a real PTY via node-pty and pipe data

import * as pty from 'node-pty';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

export interface ShellProxy {
    pty: pty.IPty;
    shellProcess: string;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    onData(handler: (data: string) => void): void;
    onExit(handler: (exitCode: number) => void): void;
    getCwd(): string | undefined;
    isShellForeground(): boolean;
    kill(): void;
}

function safeEnv(): { [key: string]: string } {
    const out: { [key: string]: string } = {};
    for (const [k, v] of Object.entries(process.env)) {
        if (v !== undefined) out[k] = v;
    }
    return out;
}

export type WindowsBackend = 'winpty' | 'conpty';

export function spawnShell(cols: number, rows: number, cwd?: string, windowsBackend?: WindowsBackend): ShellProxy {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
    let safeCwd = cwd || os.homedir();
    if (os.platform() === 'win32' && safeCwd.startsWith('\\\\')) {
        safeCwd = os.homedir();
    }

    const spawnOpts: pty.IPtyForkOptions = {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: safeCwd,
        env: safeEnv(),
    };
    if (os.platform() === 'win32') {
        (spawnOpts as any).useConpty = (windowsBackend ?? 'winpty') === 'conpty';
    }
    const ptyProcess = pty.spawn(shell, [], spawnOpts);

    return {
        pty: ptyProcess,
        shellProcess: ptyProcess.process,
        write(data: string) {
            ptyProcess.write(data);
        },
        resize(cols: number, rows: number) {
            ptyProcess.resize(cols, rows);
        },
        onData(handler: (data: string) => void) {
            ptyProcess.onData(handler);
        },
        onExit(handler: (exitCode: number) => void) {
            ptyProcess.onExit(({ exitCode }) => handler(exitCode));
        },
        getCwd() {
            const pid = ptyProcess.pid;
            try {
                return fs.readlinkSync('/proc/' + pid + '/cwd');
            } catch {
                // /proc not available (macOS, FreeBSD without procfs)
            }
            try {
                const out = child_process.execSync(
                    'lsof -a -p ' + pid + ' -d cwd -Fn 2>/dev/null',
                    { encoding: 'utf8', timeout: 1000 }
                );
                const match = out.match(/\nn(.*)/);
                if (match) return match[1];
            } catch {
                // lsof not available (Windows)
            }
            return undefined;
        },
        isShellForeground(): boolean {
            const procName = path.basename(ptyProcess.process);
            const shellBase = path.basename(shell);
            if (procName !== shellBase) {
                return false;
            }
            const platform = os.platform();
            if (platform === 'linux' || platform === 'darwin' || platform === 'win32') {
                return true;
            }
            // FreeBSD, OpenBSD, etc: node-pty's pty.process always returns the
            // shell name because /proc is not mounted. Fall back to checking
            // whether the shell has child processes.
            try {
                child_process.execSync('pgrep -P ' + ptyProcess.pid, {
                    timeout: 1000,
                    stdio: 'ignore',
                });
                return false;
            } catch {
                return true;
            }
        },
        kill() {
            ptyProcess.kill();
        },
    };
}
