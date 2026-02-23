import * as vscode from 'vscode';

export type LogLevel = 'off' | 'error' | 'info' | 'debug';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    off: 0,
    error: 1,
    info: 2,
    debug: 3,
};

class Logger {
    private channel: vscode.OutputChannel | null = null;
    private level: LogLevel = 'off';

    init(): void {
        const cfg = vscode.workspace.getConfiguration('vscommander');
        this.level = cfg.get<LogLevel>('logLevel', 'off');
        if (this.level !== 'off') {
            this.channel = vscode.window.createOutputChannel('VSCommander');
            this.channel.show(true);
        }
    }

    setLevel(level: LogLevel): void {
        this.level = level;
        if (level !== 'off' && !this.channel) {
            this.channel = vscode.window.createOutputChannel('VSCommander');
            this.channel.show(true);
        }
    }

    private shouldLog(level: LogLevel): boolean {
        return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[this.level];
    }

    private write(level: string, tag: string, message: string): void {
        if (!this.channel) return;
        const ts = new Date().toISOString().slice(11, 23);
        this.channel.appendLine(`${ts} [${level}] [${tag}] ${message}`);
    }

    error(tag: string, message: string): void {
        if (this.shouldLog('error')) this.write('ERR', tag, message);
    }

    info(tag: string, message: string): void {
        if (this.shouldLog('info')) this.write('INF', tag, message);
    }

    debug(tag: string, message: string): void {
        if (this.shouldLog('debug')) this.write('DBG', tag, message);
    }

    dispose(): void {
        this.channel?.dispose();
        this.channel = null;
    }
}

export const log = new Logger();
