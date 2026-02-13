import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { formatSizeComma, formatSizeHuman } from './helpers';

export class DirectoryInfoProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this._onDidChange.event;

    private content = '';
    private scanAbort: AbortController | undefined;
    private currentPath = '';

    provideTextDocumentContent(_uri: vscode.Uri): string {
        return this.content;
    }

    async scan(dirPath: string): Promise<void> {
        if (this.scanAbort) {
            this.scanAbort.abort();
        }

        this.currentPath = dirPath;
        const dirName = path.basename(dirPath);
        this.content = this.formatContent(dirName, 0, 0, 0, true);
        this.fireChange();

        const abort = new AbortController();
        this.scanAbort = abort;

        let folders = 0;
        let files = 0;
        let totalSize = 0;

        try {
            await this.scanDir(dirPath, abort.signal, (f, fi, s) => {
                folders = f;
                files = fi;
                totalSize = s;
            });
        } catch {
            if (abort.signal.aborted) return;
        }

        if (abort.signal.aborted) return;

        this.content = this.formatContent(dirName, folders, files, totalSize, false);
        this.fireChange();
        this.scanAbort = undefined;
    }

    private async scanDir(
        dirPath: string,
        signal: AbortSignal,
        report: (folders: number, files: number, size: number) => void,
    ): Promise<{ folders: number; files: number; size: number }> {
        let folders = 0;
        let files = 0;
        let size = 0;

        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        } catch {
            return { folders, files, size };
        }

        for (const entry of entries) {
            if (signal.aborted) return { folders, files, size };

            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                folders++;
                const sub = await this.scanDir(fullPath, signal, () => {});
                folders += sub.folders;
                files += sub.files;
                size += sub.size;
                report(folders, files, size);
            } else {
                files++;
                try {
                    const stat = await fs.promises.stat(fullPath);
                    size += stat.size;
                } catch {
                    // skip files we can't stat
                }
                report(folders, files, size);
            }
        }

        return { folders, files, size };
    }

    private formatContent(dirName: string, folders: number, files: number, totalSize: number, scanning: boolean): string {
        const lines: string[] = [];
        lines.push('');
        lines.push('    Folder "' + dirName + '"');
        lines.push('');

        const labelWidth = 16;
        const foldersStr = formatSizeComma(folders);
        const filesStr = formatSizeComma(files);
        const sizeStr = totalSize > 0
            ? formatSizeComma(totalSize) + ' (' + formatSizeHuman(totalSize) + ')'
            : '0';

        lines.push('    Folders:'.padEnd(labelWidth) + foldersStr);
        lines.push('    Files:'.padEnd(labelWidth) + filesStr);
        lines.push('    Files size:'.padEnd(labelWidth) + sizeStr);

        if (scanning) {
            lines.push('');
            lines.push('    Scanning...');
        }

        lines.push('');
        return lines.join('\n');
    }

    private fireChange(): void {
        const uri = vscode.Uri.parse('vscommander-dirinfo:directory-info');
        this._onDidChange.fire(uri);
    }

    cancel(): void {
        if (this.scanAbort) {
            this.scanAbort.abort();
            this.scanAbort = undefined;
        }
    }
}
