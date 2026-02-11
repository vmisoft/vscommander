// Shell proxy: spawn a real PTY via node-pty and pipe data

import * as pty from 'node-pty';
import * as os from 'os';

export interface ShellProxy {
    pty: pty.IPty;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    onData(handler: (data: string) => void): void;
    onExit(handler: (exitCode: number) => void): void;
    kill(): void;
}

function safeEnv(): { [key: string]: string } {
    const out: { [key: string]: string } = {};
    for (const [k, v] of Object.entries(process.env)) {
        if (v !== undefined) out[k] = v;
    }
    return out;
}

export function spawnShell(cols: number, rows: number, cwd?: string): ShellProxy {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
    let safeCwd = cwd || os.homedir();
    if (os.platform() === 'win32' && safeCwd.startsWith('\\\\')) {
        safeCwd = os.homedir();
    }

    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: safeCwd,
        env: safeEnv(),
    });

    return {
        pty: ptyProcess,
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
        kill() {
            ptyProcess.kill();
        },
    };
}
