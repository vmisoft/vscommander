import * as vscode from 'vscode';
import * as os from 'os';
import { spawnShell, ShellProxy } from './shell';
import { Panel } from './panel';
import { PanelSettings, DEFAULT_SETTINGS, mergeSettings } from './settings';

function readSettings(): PanelSettings {
    const cfg = vscode.workspace.getConfiguration('vscommander');
    return mergeSettings({
        showDotfiles: cfg.get<boolean>('showDotfiles', DEFAULT_SETTINGS.showDotfiles),
        clockEnabled: cfg.get<boolean>('clock', DEFAULT_SETTINGS.clockEnabled),
        panelColumns: cfg.get<number>('panelColumns', DEFAULT_SETTINGS.panelColumns),
        workspaceFolders: (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath),
    });
}

class VSCommanderTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    private closeEmitter = new vscode.EventEmitter<number | void>();

    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    onDidClose: vscode.Event<number | void> = this.closeEmitter.event;

    private shell: ShellProxy | undefined;
    private panel: Panel | undefined;
    private shellOutputBuffer: string[] = [];
    private cols = 80;
    private rows = 24;
    private cwd: string;
    private clockTimer: ReturnType<typeof setInterval> | undefined;
    private blinkTimer: ReturnType<typeof setInterval> | undefined;
    private cmdBlinkTimer: ReturnType<typeof setInterval> | undefined;
    private isDetached = false;
    private cdSuppressUntil = 0;

    constructor(cwd: string) {
        this.cwd = cwd;
    }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        if (initialDimensions) {
            this.cols = initialDimensions.columns;
            this.rows = initialDimensions.rows;
        }

        const settings = readSettings();
        this.panel = new Panel(this.cols, this.rows, this.cwd, settings);

        try {
            this.shell = spawnShell(this.cols, this.rows, this.cwd);
        } catch {
            try {
                this.shell = spawnShell(this.cols, this.rows, os.homedir());
            } catch {
                // shell completely unavailable — panel still works
            }
        }

        if (this.shell) {
            this.shell.onData((data: string) => {
                if (this.panel) {
                    this.panel.termBuffer.feed(data);
                }

                if (!this.panel?.visible) {
                    this.writeEmitter.fire(data);
                } else {
                    if (Date.now() >= this.cdSuppressUntil) {
                        this.shellOutputBuffer.push(data);
                    }
                    if (this.panel) {
                        const update = this.panel.renderShellUpdate();
                        if (update) {
                            this.writeEmitter.fire(update);
                        }
                    }
                }
            });

            this.shell.onExit(() => {
                this.closeEmitter.fire();
            });
        }

        this.startClockTimer();
        this.startCmdBlinkTimer();

        this.writeEmitter.fire(this.panel.show());
        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', true);
    }

    close(): void {
        this.stopClockTimer();
        this.stopBlinkTimer();
        this.stopCmdBlinkTimer();
        this.shell?.kill();
        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
    }

    handleInput(data: string): void {
        if (this.panel?.visible) {
            const wasSearchActive = this.panel.isSearchActive;
            const result = this.panel.handleInput(data);
            switch (result.action) {
                case 'close':
                    this.stopBlinkTimer();
                    this.stopCmdBlinkTimer();
                    this.writeEmitter.fire(this.panel.hide());
                    this.flushShellOutputBuffer();
                    this.refreshShellPrompt();
                    vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
                    break;
                case 'redraw':
                    this.writeEmitter.fire(result.data);
                    if (result.chdir) {
                        this.changeShellDir(result.chdir);
                    }
                    break;
                case 'input':
                    this.shell?.write(result.data);
                    if (result.redraw) {
                        this.writeEmitter.fire(result.redraw);
                    }
                    break;
                case 'settingsChanged':
                    this.writeEmitter.fire(this.panel.show());
                    break;
                case 'toggleDetach':
                    this.toggleDetach();
                    break;
                case 'openFile':
                    this.openFile(result.filePath);
                    break;
                case 'viewFile':
                    this.viewFile(result.filePath);
                    break;
                case 'deleteFile':
                    this.writeEmitter.fire(this.panel.redraw());
                    this.deleteFile(result.filePath, result.toTrash);
                    break;
                case 'none':
                    break;
            }
            if (this.panel.isSearchActive) {
                this.resetBlinkCursor();
            }
            if (wasSearchActive !== this.panel.isSearchActive) {
                this.syncBlinkTimer();
            }
            this.resetCmdBlink();
        } else {
            this.shell?.write(data);
            this.trackShellInputLen(data);
        }
    }

    private trackShellInputLen(data: string): void {
        if (!this.panel) return;
        if (data === '\r') {
            this.panel.shellInputLen = 0;
        } else if (data === '\x7f') {
            this.panel.shellInputLen = Math.max(0, this.panel.shellInputLen - 1);
        } else if (data === '\x03' || data === '\x15') {
            this.panel.shellInputLen = 0;
        } else if (data.length === 1 && data.charCodeAt(0) >= 0x20) {
            this.panel.shellInputLen++;
        }
    }

    private refreshShellPrompt(): void {
        if (!this.shell || !this.cdSuppressUntil) return;
        this.cdSuppressUntil = 0;
        this.shell.write('\x15\r');
    }

    private changeShellDir(dir: string): void {
        if (!this.shell) return;
        this.shell.write('\x15');
        if (this.panel) {
            this.panel.shellInputLen = 0;
        }
        this.cdSuppressUntil = Date.now() + 200;
        const cmd = os.platform() === 'win32'
            ? 'cd "' + dir.replace(/"/g, '`"') + '"\r'
            : "cd '" + dir.replace(/'/g, "'\\''") + "'\r";
        this.shell.write(cmd);
    }

    setDimensions(dimensions: vscode.TerminalDimensions): void {
        this.cols = dimensions.columns;
        this.rows = dimensions.rows;
        this.shell?.resize(this.cols, this.rows);
        if (this.panel) {
            const redraw = this.panel.resize(this.cols, this.rows);
            if (redraw) {
                this.writeEmitter.fire(redraw);
            }
        }
    }

    private flushShellOutputBuffer(): void {
        if (this.shellOutputBuffer.length > 0) {
            this.writeEmitter.fire(this.shellOutputBuffer.join(''));
            this.shellOutputBuffer = [];
        }
    }

    private startClockTimer(): void {
        this.clockTimer = setInterval(() => {
            if (this.panel?.visible && this.panel.settings.clockEnabled) {
                const update = this.panel.renderClockUpdate();
                if (update) {
                    this.writeEmitter.fire(update);
                }
            }
        }, 30000);
    }

    private stopClockTimer(): void {
        if (this.clockTimer) {
            clearInterval(this.clockTimer);
            this.clockTimer = undefined;
        }
    }

    private syncBlinkTimer(): void {
        if (this.panel?.isSearchActive && !this.blinkTimer) {
            this.panel.resetSearchBlink();
            this.blinkTimer = setInterval(() => {
                if (this.panel?.isSearchActive) {
                    const update = this.panel.renderSearchCursorBlink();
                    if (update) {
                        this.writeEmitter.fire(update);
                    }
                } else {
                    this.stopBlinkTimer();
                }
            }, 500);
        } else if (!this.panel?.isSearchActive && this.blinkTimer) {
            this.stopBlinkTimer();
        }
    }

    private resetBlinkCursor(): void {
        if (!this.panel) return;
        this.panel.resetSearchBlink();
        if (this.blinkTimer) {
            clearInterval(this.blinkTimer);
            this.blinkTimer = undefined;
        }
        this.syncBlinkTimer();
    }

    private stopBlinkTimer(): void {
        if (this.blinkTimer) {
            clearInterval(this.blinkTimer);
            this.blinkTimer = undefined;
        }
    }

    private startCmdBlinkTimer(): void {
        this.stopCmdBlinkTimer();
        if (this.panel) {
            this.panel.resetCmdBlink();
        }
        this.cmdBlinkTimer = setInterval(() => {
            if (this.panel?.visible) {
                const update = this.panel.renderCmdCursorBlink();
                if (update) {
                    this.writeEmitter.fire(update);
                }
            }
        }, 500);
    }

    private resetCmdBlink(): void {
        if (!this.panel) return;
        this.panel.resetCmdBlink();
        if (this.cmdBlinkTimer) {
            clearInterval(this.cmdBlinkTimer);
            this.cmdBlinkTimer = undefined;
        }
        this.startCmdBlinkTimer();
    }

    private stopCmdBlinkTimer(): void {
        if (this.cmdBlinkTimer) {
            clearInterval(this.cmdBlinkTimer);
            this.cmdBlinkTimer = undefined;
        }
    }

    toggle(): void {
        if (!this.panel) return;
        if (this.panel.visible) {
            this.stopCmdBlinkTimer();
            this.writeEmitter.fire(this.panel.hide());
            this.flushShellOutputBuffer();
            this.refreshShellPrompt();
            vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
        } else {
            this.panel.settings = readSettings();
            this.writeEmitter.fire(this.panel.show());
            this.changeShellDir(this.panel.activePaneObj.cwd);
            this.startCmdBlinkTimer();
            vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', true);
        }
    }

    private toggleDetach(): void {
        if (this.isDetached) {
            vscode.commands.executeCommand('workbench.action.toggleFullScreen').then(() => {
                setTimeout(() => {
                    vscode.commands.executeCommand('workbench.action.moveEditorToMainWindow');
                    this.isDetached = false;
                }, 300);
            });
        } else {
            vscode.commands.executeCommand('workbench.action.moveActiveEditorToNewWindow').then(() => {
                setTimeout(() => {
                    vscode.commands.executeCommand('workbench.action.toggleFullScreen');
                    this.isDetached = true;
                }, 500);
            });
        }
    }

    private openFile(filePath: string): void {
        const uri = vscode.Uri.file(filePath);
        vscode.commands.executeCommand('vscode.open', uri);
    }

    private viewFile(filePath: string): void {
        const uri = vscode.Uri.file(filePath);
        const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (wsFolder) {
            vscode.commands.executeCommand('revealInExplorer', uri);
            blinkDecoration.blink(uri, 3);
        } else {
            vscode.commands.executeCommand('revealFileInOS', uri);
        }
    }

    private deleteFile(filePath: string, toTrash: boolean): void {
        const uri = vscode.Uri.file(filePath);
        vscode.workspace.fs.delete(uri, { recursive: true, useTrash: toTrash }).then(() => {
            this.refreshPanels();
        }, () => {
            this.refreshPanels();
        });
    }

    private refreshPanels(): void {
        if (this.panel?.visible) {
            this.panel.left.refresh(this.panel.settings);
            this.panel.right.refresh(this.panel.settings);
            this.writeEmitter.fire(this.panel.redraw());
        }
    }
}

class BlinkDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
    onDidChangeFileDecorations = this._onDidChange.event;
    private blinkUri: string | undefined;
    private blinkOn = false;
    private blinkTimer: ReturnType<typeof setTimeout> | undefined;

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (this.blinkUri && uri.toString() === this.blinkUri && this.blinkOn) {
            return { badge: '\u25cf' };
        }
        return undefined;
    }

    blink(uri: vscode.Uri, times: number): void {
        this.stop();
        this.blinkUri = uri.toString();
        this.blinkOn = true;
        this._onDidChange.fire(uri);
        let count = 1;
        const total = times * 2;
        const step = () => {
            this.blinkTimer = setTimeout(() => {
                count++;
                this.blinkOn = !this.blinkOn;
                this._onDidChange.fire(uri);
                if (count < total) {
                    step();
                } else {
                    this.blinkTimer = setTimeout(() => {
                        this.blinkUri = undefined;
                        this.blinkOn = false;
                        this._onDidChange.fire(uri);
                        this.blinkTimer = undefined;
                    }, 100);
                }
            }, 100);
        };
        step();
    }

    private stop(): void {
        if (this.blinkTimer) {
            clearTimeout(this.blinkTimer);
            this.blinkTimer = undefined;
        }
    }
}

const blinkDecoration = new BlinkDecorationProvider();
let activeTerminal: VSCommanderTerminal | undefined;

export function activate(context: vscode.ExtensionContext) {
    const openCmd = vscode.commands.registerCommand('vscommander.open', () => {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            || os.homedir();

        const pty = new VSCommanderTerminal(cwd);
        activeTerminal = pty;

        vscode.window.createTerminal({
            name: 'VSCommander',
            pty,
            location: vscode.TerminalLocation.Editor,
            iconPath: new vscode.ThemeIcon('preview'),
        });
    });

    const toggleCmd = vscode.commands.registerCommand('vscommander.toggle', () => {
        if (activeTerminal) {
            activeTerminal.toggle();
        } else {
            vscode.commands.executeCommand('vscommander.open');
        }
    });

    const sidebarTree = vscode.window.createTreeView('vscommander.sidebar', {
        treeDataProvider: {
            getTreeItem: () => new vscode.TreeItem(''),
            getChildren: () => [],
        },
    });

    const sidebarVisibility = sidebarTree.onDidChangeVisibility(async (e) => {
        if (e.visible) {
            await vscode.commands.executeCommand('workbench.action.closeSidebar');
            vscode.commands.executeCommand('vscommander.open');
        }
    });

    const blinkDisposable = vscode.window.registerFileDecorationProvider(blinkDecoration);

    context.subscriptions.push(openCmd, toggleCmd, sidebarTree, sidebarVisibility, blinkDisposable);
}

export function deactivate() {
    activeTerminal = undefined;
}
