import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { formatSizeComma, formatSizeHuman } from './helpers';
import { SPINNER_FRAMES } from './visualPrimitives';

export class DirectoryInfoProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this._onDidChange.event;

    private content = '';
    private scanAbort: AbortController | undefined;
    private spinnerTimer: ReturnType<typeof setInterval> | undefined;
    private spinnerFrame = 0;
    private scanning = false;
    private scanDirName = '';
    private scanCurrentDir = '';
    private scanDirs = 0;
    private scanFiles = 0;
    private scanSize = 0;

    private labelRanges: vscode.Range[] = [];
    private valueRanges: vscode.Range[] = [];
    private labelDecoration: vscode.TextEditorDecorationType;
    private valueDecoration: vscode.TextEditorDecorationType;
    private editorListener: vscode.Disposable | undefined;
    private pendingDecorations = false;

    constructor() {
        this.labelDecoration = vscode.window.createTextEditorDecorationType({
            color: new vscode.ThemeColor('descriptionForeground'),
        });
        this.valueDecoration = vscode.window.createTextEditorDecorationType({
            color: new vscode.ThemeColor('textLink.activeForeground'),
        });
        this.editorListener = vscode.window.onDidChangeVisibleTextEditors(() => {
            if (this.pendingDecorations) {
                this.applyDecorations();
            }
        });
    }

    provideTextDocumentContent(_uri: vscode.Uri): string {
        return this.content;
    }

    async scan(dirPath: string): Promise<void> {
        if (this.scanAbort) {
            this.scanAbort.abort();
        }
        this.stopSpinner();

        this.scanDirName = dirPath;
        this.scanDirs = 0;
        this.scanFiles = 0;
        this.scanSize = 0;
        this.scanning = true;
        this.spinnerFrame = 0;
        this.rebuildContent();
        this.startSpinner();

        const abort = new AbortController();
        this.scanAbort = abort;

        try {
            await this.scanDir(dirPath, abort.signal);
        } catch {
            if (abort.signal.aborted) return;
        }

        if (abort.signal.aborted) return;

        this.scanning = false;
        this.stopSpinner();
        this.rebuildContent();
        this.scanAbort = undefined;
    }

    private async scanDir(dirPath: string, signal: AbortSignal): Promise<void> {
        this.scanCurrentDir = dirPath;
        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (signal.aborted) return;

            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                this.scanDirs++;
                await this.scanDir(fullPath, signal);
            } else {
                this.scanFiles++;
                try {
                    const stat = await fs.promises.stat(fullPath);
                    this.scanSize += stat.size;
                } catch {
                    // skip files we can't stat
                }
            }
        }
    }

    private spinnerTick = 0;

    private startSpinner(): void {
        this.spinnerTick = 0;
        this.spinnerTimer = setInterval(() => {
            if (this.scanning) {
                this.spinnerTick++;
                if (this.spinnerTick % 3 === 0) {
                    this.spinnerFrame++;
                }
                this.rebuildContent();
            }
        }, 50);
    }

    private stopSpinner(): void {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = undefined;
        }
    }

    private rebuildContent(): void {
        this.labelRanges = [];
        this.valueRanges = [];

        const lines: string[] = [];
        lines.push('');

        const titleLabel = '    Directory ';
        const titlePath = this.scanDirName;
        lines.push(titleLabel + titlePath);
        this.labelRanges.push(new vscode.Range(1, 4, 1, titleLabel.length));
        this.valueRanges.push(new vscode.Range(1, titleLabel.length, 1, titleLabel.length + titlePath.length));

        lines.push('');

        const labelWidth = 20;

        const dirsValue = formatSizeComma(this.scanDirs);
        lines.push('    Directories:'.padEnd(labelWidth) + dirsValue);
        let ln = lines.length - 1;
        this.labelRanges.push(new vscode.Range(ln, 4, ln, 4 + 'Directories:'.length));
        this.valueRanges.push(new vscode.Range(ln, labelWidth, ln, labelWidth + dirsValue.length));

        const filesValue = formatSizeComma(this.scanFiles);
        lines.push('    Files:'.padEnd(labelWidth) + filesValue);
        ln = lines.length - 1;
        this.labelRanges.push(new vscode.Range(ln, 4, ln, 4 + 'Files:'.length));
        this.valueRanges.push(new vscode.Range(ln, labelWidth, ln, labelWidth + filesValue.length));

        let sizeValue: string;
        if (this.scanSize > 0) {
            sizeValue = formatSizeHuman(this.scanSize) + ' (' + formatSizeComma(this.scanSize) + ' bytes)';
        } else {
            sizeValue = '0';
        }
        lines.push('    Files size:'.padEnd(labelWidth) + sizeValue);
        ln = lines.length - 1;
        this.labelRanges.push(new vscode.Range(ln, 4, ln, 4 + 'Files size:'.length));
        this.valueRanges.push(new vscode.Range(ln, labelWidth, ln, labelWidth + sizeValue.length));

        if (this.scanning) {
            lines.push('');
            const spinner = SPINNER_FRAMES[this.spinnerFrame % SPINNER_FRAMES.length];
            const scanLine = '    ' + spinner + ' Scanning...';
            lines.push(scanLine);
            const currentDir = '    (' + this.scanCurrentDir + ')';
            lines.push(currentDir);
            ln = lines.length - 1;
            this.valueRanges.push(new vscode.Range(ln, 4, ln, 4 + currentDir.length - 4));
        }

        lines.push('');
        this.content = lines.join('\n');
        this.fireChange();
        this.pendingDecorations = true;
        setTimeout(() => this.applyDecorations(), 50);
    }

    private applyDecorations(): void {
        const uriStr = 'vscommander-dirinfo:directory-info';
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.toString() === uriStr) {
                editor.setDecorations(this.labelDecoration, this.labelRanges);
                editor.setDecorations(this.valueDecoration, this.valueRanges);
                this.pendingDecorations = false;
                return;
            }
        }
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
        this.stopSpinner();
    }

    dispose(): void {
        this.cancel();
        this.editorListener?.dispose();
        this.labelDecoration.dispose();
        this.valueDecoration.dispose();
        this._onDidChange.dispose();
    }
}
