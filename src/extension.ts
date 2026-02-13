import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { spawnShell, ShellProxy } from './shell';
import { Panel } from './panel';
import { PanelSettings, DEFAULT_SETTINGS, DEFAULT_KEY_BINDINGS, mergeSettings } from './settings';
import { CopyMoveResult } from './copyMovePopup';
import { DirectoryInfoProvider } from './directoryInfo';
import { BlinkTimer, PollTimer } from './timerManager';
import { makeDirectories, copyMoveOne } from './fileOps';
import { ShellRouter } from './shellRouter';
import { QuickViewController, QuickViewHost } from './quickView';

function readSettings(): PanelSettings {
    const cfg = vscode.workspace.getConfiguration('vscommander');
    const toggleKey = os.platform() === 'darwin' ? '\u2303O' : 'Ctrl+O';
    return mergeSettings({
        showDotfiles: cfg.get<boolean>('showDotfiles', DEFAULT_SETTINGS.showDotfiles),
        clockEnabled: cfg.get<boolean>('clock', DEFAULT_SETTINGS.clockEnabled),
        panelColumns: cfg.get<number>('panelColumns', DEFAULT_SETTINGS.panelColumns),
        workspaceDirs: (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath),
        toggleKey,
        keys: {
            view: cfg.get<string>('keyView', DEFAULT_KEY_BINDINGS.view),
            edit: cfg.get<string>('keyEdit', DEFAULT_KEY_BINDINGS.edit),
            copy: cfg.get<string>('keyCopy', DEFAULT_KEY_BINDINGS.copy),
            move: cfg.get<string>('keyMove', DEFAULT_KEY_BINDINGS.move),
            mkdir: cfg.get<string>('keyMkdir', DEFAULT_KEY_BINDINGS.mkdir),
            delete: cfg.get<string>('keyDelete', DEFAULT_KEY_BINDINGS.delete),
            forceDelete: cfg.get<string>('keyForceDelete', DEFAULT_KEY_BINDINGS.forceDelete),
            quit: cfg.get<string>('keyQuit', DEFAULT_KEY_BINDINGS.quit),
            menu: cfg.get<string>('keyMenu', DEFAULT_KEY_BINDINGS.menu),
            driveLeft: cfg.get<string>('keyDriveLeft', DEFAULT_KEY_BINDINGS.driveLeft),
            driveRight: cfg.get<string>('keyDriveRight', DEFAULT_KEY_BINDINGS.driveRight),
            toggleDotfiles: cfg.get<string>('keyToggleDotfiles', DEFAULT_KEY_BINDINGS.toggleDotfiles),
            togglePane: cfg.get<string>('keyTogglePane', DEFAULT_KEY_BINDINGS.togglePane),
            detach: cfg.get<string>('keyDetach', DEFAULT_KEY_BINDINGS.detach),
            resizeLeft: cfg.get<string>('keyResizeLeft', DEFAULT_KEY_BINDINGS.resizeLeft),
            resizeRight: cfg.get<string>('keyResizeRight', DEFAULT_KEY_BINDINGS.resizeRight),
            quickView: cfg.get<string>('keyQuickView', DEFAULT_KEY_BINDINGS.quickView),
        },
    });
}

class VSCommanderTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    private closeEmitter = new vscode.EventEmitter<number | void>();

    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    onDidClose: vscode.Event<number | void> = this.closeEmitter.event;

    private shell: ShellProxy | undefined;
    private panel: Panel | undefined;
    private shellRouter = new ShellRouter();
    private cols = 80;
    private rows = 24;
    private cwd: string;
    private clockTimer = new BlinkTimer(30000);
    private blinkTimer = new BlinkTimer(500);
    private cmdBlinkTimer = new BlinkTimer(500);
    private mkdirBlinkTimer = new BlinkTimer(500);
    private copyMoveBlinkTimer = new BlinkTimer(500);
    private isDetached = false;
    private quickView: QuickViewController;
    private commandRunning = false;
    private commandPollTimer = new PollTimer();
    private commandIdleCount = 0;
    private spinnerTimer = new BlinkTimer(150);

    constructor(cwd: string) {
        this.cwd = cwd;
        const host: QuickViewHost = {
            openSplit: (filePath, targetType, side) => {
                const uri = targetType === 'dir'
                    ? vscode.Uri.parse('vscommander-dirinfo:directory-info')
                    : vscode.Uri.file(filePath);
                if (side === 'right') {
                    vscode.commands.executeCommand('vscode.open', uri, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: true,
                        preserveFocus: true,
                    });
                } else {
                    vscode.commands.executeCommand('vscode.open', uri, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: true,
                        preserveFocus: false,
                    }).then(() => {
                        vscode.commands.executeCommand('workbench.action.moveActiveEditorGroupLeft').then(() => {
                            vscode.commands.executeCommand('workbench.action.focusNextGroup');
                        });
                    });
                }
            },
            updateSplit: (filePath, targetType, side) => {
                const uri = targetType === 'dir'
                    ? vscode.Uri.parse('vscommander-dirinfo:directory-info')
                    : vscode.Uri.file(filePath);
                const viewColumn = side === 'right'
                    ? vscode.ViewColumn.Two
                    : vscode.ViewColumn.One;
                vscode.commands.executeCommand('vscode.open', uri, {
                    viewColumn,
                    preview: true,
                    preserveFocus: true,
                });
            },
            closeSplit: (side) => {
                const targetGroup = side === 'right'
                    ? vscode.ViewColumn.Two
                    : vscode.ViewColumn.One;
                const groups = vscode.window.tabGroups.all;
                const group = groups.find(g => g.viewColumn === targetGroup);
                if (group) {
                    vscode.window.tabGroups.close(group);
                }
            },
            cancelDirScan: () => dirInfoProvider.cancel(),
            scanDir: (dirPath) => dirInfoProvider.scan(dirPath),
        };
        this.quickView = new QuickViewController(host);
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
                if (this.panel && !this.shellRouter.isSuppressed()) {
                    this.panel.termBuffer.feed(data);
                }

                if (!this.panel?.visible) {
                    this.writeEmitter.fire(data);
                } else {
                    if (!this.shellRouter.isSuppressed()) {
                        this.shellRouter.shellOutputBuffer.push(data);
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
        this.restartCmdBlinkTimer();

        this.writeEmitter.fire(this.panel.show());
        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', true);
    }

    close(): void {
        if (this.quickView.active) {
            this.quickView.close();
        }
        this.clockTimer.stop();
        this.blinkTimer.stop();
        this.cmdBlinkTimer.stop();
        this.mkdirBlinkTimer.stop();
        this.copyMoveBlinkTimer.stop();
        this.spinnerTimer.stop();
        this.stopCommandPoll();
        this.shell?.kill();
        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
    }

    handleInput(data: string): void {
        if (this.panel?.visible) {
            const wasSearchActive = this.panel.isSearchActive;
            const result = this.panel.handleInput(data);
            switch (result.action) {
                case 'quit':
                    this.shell?.kill();
                    this.closeEmitter.fire();
                    return;
                case 'close':
                    if (this.quickView.active) {
                        this.panel.quickViewMode = false;
                        this.quickView.close();
                    }
                    this.blinkTimer.stop();
                    this.cmdBlinkTimer.stop();
                    this.writeEmitter.fire(this.panel.hide());
                    this.shellRouter.flush(s => this.writeEmitter.fire(s));
                    if (this.shell) this.shellRouter.refreshPrompt(this.shell);
                    vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
                    break;
                case 'redraw':
                    this.writeEmitter.fire(result.data);
                    if (result.chdir) {
                        if (this.shell && this.panel) this.shellRouter.changeDir(result.chdir, this.shell, this.panel);
                    }
                    if (this.quickView.active) {
                        if (this.panel.quickViewMode) {
                            const t = this.panel.getQuickViewTarget();
                            this.quickView.updateFromCursor(t.path, t.type);
                        } else {
                            this.quickView.close();
                        }
                    }
                    break;
                case 'input':
                    this.shell?.write(result.data);
                    if (result.redraw) {
                        this.writeEmitter.fire(result.redraw);
                    }
                    break;
                case 'executeCommand':
                    this.shell?.write(result.data);
                    if (this.panel.inactivePaneHidden) {
                        this.panel.shellInputLen = 0;
                        this.commandRunning = true;
                        this.commandIdleCount = 0;
                        this.pollCommandDone();
                    } else {
                        this.blinkTimer.stop();
                        this.cmdBlinkTimer.stop();
                        this.writeEmitter.fire(this.panel.hide());
                        this.shellRouter.flush(s => this.writeEmitter.fire(s));
                        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
                        this.commandRunning = true;
                        this.commandIdleCount = 0;
                        this.pollCommandDone();
                    }
                    break;
                case 'settingsChanged':
                    this.writeEmitter.fire(this.panel.show());
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'vscommander');
                    this.writeEmitter.fire(this.panel.redraw());
                    break;
                case 'toggleDetach':
                    this.toggleDetach();
                    break;
                case 'openFile':
                    if (this.quickView.active) {
                        this.panel.quickViewMode = false;
                        this.quickView.close();
                    }
                    this.openFile(result.filePath);
                    break;
                case 'viewFile':
                    this.viewFile(result.filePath);
                    break;
                case 'deleteFile':
                    this.writeEmitter.fire(this.panel.redraw());
                    this.deleteFile(result.filePath, result.toTrash);
                    break;
                case 'mkdir':
                    this.makeDirectory(result.cwd, result.dirName, result.linkType, result.linkTarget, result.multipleNames);
                    break;
                case 'copyMove':
                    this.executeCopyMove(result.result);
                    break;
                case 'quickView':
                    this.writeEmitter.fire(result.data);
                    this.quickView.open(result.filePath, result.targetType, result.side);
                    break;
                case 'quickViewClose':
                    this.quickView.close();
                    this.writeEmitter.fire(result.data);
                    if (result.chdir) {
                        if (this.shell && this.panel) this.shellRouter.changeDir(result.chdir, this.shell, this.panel);
                    }
                    break;
                case 'none':
                    break;
            }
            if (this.panel.isSearchActive) {
                this.blinkTimer.restart(
                    () => this.panel!.resetSearchBlink(),
                    () => this.panel?.isSearchActive ? this.panel.renderSearchCursorBlink() : (this.blinkTimer.stop(), ''),
                    s => this.writeEmitter.fire(s),
                );
            }
            if (wasSearchActive !== this.panel.isSearchActive) {
                this.blinkTimer.sync(
                    () => !!this.panel?.isSearchActive,
                    () => this.panel!.resetSearchBlink(),
                    () => {
                        if (this.panel?.isSearchActive) return this.panel.renderSearchCursorBlink();
                        this.blinkTimer.stop();
                    },
                    s => this.writeEmitter.fire(s),
                );
            }
            this.mkdirBlinkTimer.sync(
                () => !!this.panel?.isMkdirBlinkActive,
                () => this.panel!.resetMkdirBlink(),
                () => {
                    if (this.panel?.isMkdirBlinkActive) return this.panel.renderMkdirCursorBlink();
                    this.mkdirBlinkTimer.stop();
                },
                s => this.writeEmitter.fire(s),
            );
            this.copyMoveBlinkTimer.sync(
                () => !!this.panel?.isCopyMoveBlinkActive,
                () => this.panel!.resetCopyMoveBlink(),
                () => {
                    if (this.panel?.isCopyMoveBlinkActive) return this.panel.renderCopyMoveCursorBlink();
                    this.copyMoveBlinkTimer.stop();
                },
                s => this.writeEmitter.fire(s),
            );
            this.restartCmdBlinkTimer();
        } else {
            this.shell?.write(data);
            if (this.panel) this.shellRouter.trackInputLen(data, this.panel);
        }
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

    private startClockTimer(): void {
        this.clockTimer.start(
            () => this.panel?.visible && this.panel.settings.clockEnabled
                ? this.panel.renderClockUpdate() : undefined,
            s => this.writeEmitter.fire(s),
        );
    }

    private restartCmdBlinkTimer(): void {
        this.cmdBlinkTimer.restart(
            () => { if (this.panel) this.panel.resetCmdBlink(); },
            () => this.panel?.visible ? this.panel.renderCmdCursorBlink() : undefined,
            s => this.writeEmitter.fire(s),
        );
    }

    private syncPaneCwd(): void {
        if (!this.panel || !this.shell) return;
        const shellCwd = this.shell.getCwd();
        if (shellCwd && shellCwd !== this.panel.activePaneObj.cwd) {
            this.panel.activePaneObj.cwd = shellCwd;
            this.panel.activePaneObj.cursor = 0;
            this.panel.activePaneObj.scroll = 0;
        }
    }

    private pollCommandDone(): void {
        if (!this.commandRunning || !this.shell) return;
        this.commandPollTimer.start(100, () => {
            if (!this.commandRunning || !this.shell) return false;
            if (this.shell.pty.process === this.shell.shellProcess) {
                this.commandIdleCount++;
                if (this.commandIdleCount >= 2) {
                    this.commandRunning = false;
                    if (this.panel && this.panel.visible && this.panel.waitingMode) {
                        this.spinnerTimer.stop();
                        this.syncPaneCwd();
                        this.panel.settings = readSettings();
                        this.panel.waitingMode = false;
                        this.panel.left.refresh(this.panel.settings);
                        this.panel.right.refresh(this.panel.settings);
                        this.writeEmitter.fire(this.panel.redraw());
                        this.restartCmdBlinkTimer();
                    } else if (this.panel && this.panel.visible && !this.panel.waitingMode) {
                        this.syncPaneCwd();
                        this.panel.settings = readSettings();
                        this.panel.left.refresh(this.panel.settings);
                        this.panel.right.refresh(this.panel.settings);
                        this.writeEmitter.fire(this.panel.redraw());
                        this.restartCmdBlinkTimer();
                    } else if (this.panel && !this.panel.visible) {
                        this.syncPaneCwd();
                        this.panel.settings = readSettings();
                        this.writeEmitter.fire(this.panel.show());
                        this.restartCmdBlinkTimer();
                        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', true);
                    }
                    return false;
                }
            } else {
                this.commandIdleCount = 0;
            }
            return true;
        });
    }

    private stopCommandPoll(): void {
        this.commandRunning = false;
        this.commandPollTimer.stop();
    }

    private startSpinnerTimer(): void {
        this.spinnerTimer.start(
            () => this.panel?.waitingMode ? this.panel.renderSpinnerUpdate() : undefined,
            s => this.writeEmitter.fire(s),
        );
    }

    toggle(): void {
        if (!this.panel) return;
        if (this.commandRunning) {
            if (this.panel.visible) {
                if (this.quickView.active) {
                    this.panel.quickViewMode = false;
                    this.quickView.close();
                }
                this.spinnerTimer.stop();
                this.writeEmitter.fire(this.panel.hide());
                this.shellRouter.flush(s => this.writeEmitter.fire(s));
                vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
            } else {
                this.panel.settings = readSettings();
                this.panel.waitingMode = true;
                this.panel.spinnerFrame = 0;
                this.writeEmitter.fire(this.panel.show());
                this.startSpinnerTimer();
                vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', true);
            }
        } else {
            this.stopCommandPoll();
            if (this.panel.visible) {
                if (this.quickView.active) {
                    this.panel.quickViewMode = false;
                    this.quickView.close();
                }
                this.cmdBlinkTimer.stop();
                this.writeEmitter.fire(this.panel.hide());
                this.shellRouter.flush(s => this.writeEmitter.fire(s));
                if (this.shell) this.shellRouter.refreshPrompt(this.shell);
                vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
            } else {
                const shellBusy = this.shell !== undefined && this.shell.pty.process !== this.shell.shellProcess;
                this.panel.settings = readSettings();
                if (shellBusy) {
                    this.panel.waitingMode = true;
                    this.panel.spinnerFrame = 0;
                    this.commandRunning = true;
                    this.commandIdleCount = 0;
                    this.writeEmitter.fire(this.panel.show());
                    this.startSpinnerTimer();
                    this.pollCommandDone();
                } else {
                    this.writeEmitter.fire(this.panel.show());
                    this.restartCmdBlinkTimer();
                }
                vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', true);
            }
        }
    }

    toggleQuickView(): void {
        if (!this.panel?.visible) return;
        this.handleInput('\x11');
    }

    togglePane(): void {
        if (!this.panel?.visible) return;
        this.handleInput('\x10');
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
        const wsDir = vscode.workspace.getWorkspaceFolder(uri);
        if (wsDir) {
            vscode.commands.executeCommand('revealInExplorer', uri);
            blinkDecoration.blink(uri, 24);
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

    private makeDirectory(cwd: string, dirName: string, linkType: 'none' | 'symbolic' | 'junction', linkTarget: string, multipleNames: boolean): void {
        const lastName = makeDirectories(cwd, dirName, linkType, linkTarget, multipleNames);
        this.refreshPanels();
        if (lastName && this.panel) {
            const pane = this.panel.activePaneObj;
            const idx = pane.entries.findIndex(e => e.name === lastName);
            if (idx >= 0) {
                pane.cursor = idx;
            }
            this.writeEmitter.fire(this.panel.redraw());
        }
    }

    private executeCopyMove(result: CopyMoveResult): void {
        const { mode, targetPath, overwrite, sourceFiles, sourceCwd } = result;
        const targetDir = path.isAbsolute(targetPath)
            ? targetPath
            : path.resolve(sourceCwd, targetPath);

        const isMove = mode === 'move';
        const label = isMove ? 'Moving' : 'Copying';

        vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: label + ' files...', cancellable: true },
            async (progress, token) => {
                const total = sourceFiles.length;
                for (const fileName of sourceFiles) {
                    if (token.isCancellationRequested) break;
                    const src = path.join(sourceCwd, fileName);
                    const dst = sourceFiles.length === 1 && !targetPath.endsWith(path.sep)
                        ? targetDir
                        : path.join(targetDir, fileName);
                    progress.report({ message: fileName, increment: 100 / total });
                    try {
                        await copyMoveOne(src, dst, isMove, overwrite, async (name) => {
                            const action = await vscode.window.showWarningMessage(
                                '"' + name + '" already exists. Overwrite?',
                                { modal: true },
                                'Overwrite', 'Skip',
                            );
                            return action === 'Overwrite';
                        });
                    } catch {
                        // skip individual file errors
                    }
                }
                if (this.panel) {
                    this.panel.activePaneObj.clearSelection();
                }
                this.refreshPanels();
            }
        );
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
            }, 25);
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
const dirInfoProvider = new DirectoryInfoProvider();
let activeTerminal: VSCommanderTerminal | undefined;

export function activate(context: vscode.ExtensionContext) {
    const openCmd = vscode.commands.registerCommand('vscommander.open', () => {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            || os.homedir();

        const pty = new VSCommanderTerminal(cwd);
        activeTerminal = pty;

        const terminal = vscode.window.createTerminal({
            name: 'VSCommander',
            pty,
            location: vscode.TerminalLocation.Editor,
            iconPath: new vscode.ThemeIcon('preview'),
        });
        terminal.show();
        const listener = vscode.window.onDidChangeActiveTerminal((t) => {
            if (t === terminal) {
                listener.dispose();
                vscode.commands.executeCommand('workbench.action.unlockEditorGroup');
            }
        });
        // Fallback if the event already fired before the listener was set up
        if (vscode.window.activeTerminal === terminal) {
            listener.dispose();
            vscode.commands.executeCommand('workbench.action.unlockEditorGroup');
        }
    });

    const toggleCmd = vscode.commands.registerCommand('vscommander.toggle', () => {
        if (activeTerminal) {
            activeTerminal.toggle();
        } else {
            vscode.commands.executeCommand('vscommander.open');
        }
    });

    const quickViewCmd = vscode.commands.registerCommand('vscommander.quickView', () => {
        if (activeTerminal) {
            activeTerminal.toggleQuickView();
        }
    });

    const togglePaneCmd = vscode.commands.registerCommand('vscommander.togglePane', () => {
        if (activeTerminal) {
            activeTerminal.togglePane();
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
    const dirInfoDisposable = vscode.workspace.registerTextDocumentContentProvider('vscommander-dirinfo', dirInfoProvider);

    context.subscriptions.push(openCmd, toggleCmd, quickViewCmd, togglePaneCmd, sidebarTree, sidebarVisibility, blinkDisposable, dirInfoDisposable);
}

export function deactivate() {
    dirInfoProvider.dispose();
    activeTerminal = undefined;
}
