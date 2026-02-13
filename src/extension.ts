import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { spawnShell, ShellProxy } from './shell';
import { Panel } from './panel';
import { PanelSettings, DEFAULT_SETTINGS, DEFAULT_KEY_BINDINGS, mergeSettings } from './settings';
import { CopyMoveResult, OverwriteMode } from './copyMovePopup';
import { DirectoryInfoProvider } from './directoryInfo';

function readSettings(): PanelSettings {
    const cfg = vscode.workspace.getConfiguration('vscommander');
    const toggleKey = os.platform() === 'darwin' ? '\u2303O' : 'Ctrl+O';
    return mergeSettings({
        showDotfiles: cfg.get<boolean>('showDotfiles', DEFAULT_SETTINGS.showDotfiles),
        clockEnabled: cfg.get<boolean>('clock', DEFAULT_SETTINGS.clockEnabled),
        panelColumns: cfg.get<number>('panelColumns', DEFAULT_SETTINGS.panelColumns),
        workspaceFolders: (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath),
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
    private shellOutputBuffer: string[] = [];
    private cols = 80;
    private rows = 24;
    private cwd: string;
    private clockTimer: ReturnType<typeof setInterval> | undefined;
    private blinkTimer: ReturnType<typeof setInterval> | undefined;
    private cmdBlinkTimer: ReturnType<typeof setInterval> | undefined;
    private mkdirBlinkTimer: ReturnType<typeof setInterval> | undefined;
    private copyMoveBlinkTimer: ReturnType<typeof setInterval> | undefined;
    private isDetached = false;
    private quickViewActive = false;
    private quickViewSide: 'left' | 'right' = 'right';
    private lastQuickViewFile: string | undefined;
    private lastQuickViewType: 'file' | 'dir' | 'none' = 'none';
    private cdSuppressUntil = 0;
    private commandRunning = false;
    private commandPollTimer: ReturnType<typeof setTimeout> | undefined;
    private commandIdleCount = 0;
    private spinnerTimer: ReturnType<typeof setInterval> | undefined;

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
                    if (Date.now() >= this.cdSuppressUntil) {
                        this.panel.termBuffer.feed(data);
                    }
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
        this.stopMkdirBlinkTimer();
        this.stopSpinnerTimer();
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
                    if (this.quickViewActive) {
                        this.panel.quickViewMode = false;
                        this.closeQuickView();
                    }
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
                    if (this.quickViewActive) {
                        if (this.panel.quickViewMode) {
                            this.updateQuickViewFromCursor();
                        } else {
                            this.closeQuickView();
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
                        this.stopBlinkTimer();
                        this.stopCmdBlinkTimer();
                        this.writeEmitter.fire(this.panel.hide());
                        this.flushShellOutputBuffer();
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
                    if (this.quickViewActive) {
                        this.panel.quickViewMode = false;
                        this.closeQuickView();
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
                    this.makeDirectory(result.cwd, result.folderName, result.linkType, result.linkTarget, result.multipleNames);
                    break;
                case 'copyMove':
                    this.executeCopyMove(result.result);
                    break;
                case 'quickView':
                    this.writeEmitter.fire(result.data);
                    this.openQuickView(result.filePath, result.targetType, result.side);
                    break;
                case 'quickViewClose':
                    this.closeQuickView();
                    this.writeEmitter.fire(result.data);
                    if (result.chdir) {
                        this.changeShellDir(result.chdir);
                    }
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
            this.syncMkdirBlinkTimer();
            this.syncCopyMoveBlinkTimer();
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

    private syncMkdirBlinkTimer(): void {
        if (this.panel?.isMkdirBlinkActive && !this.mkdirBlinkTimer) {
            this.panel.resetMkdirBlink();
            this.mkdirBlinkTimer = setInterval(() => {
                if (this.panel?.isMkdirBlinkActive) {
                    const update = this.panel.renderMkdirCursorBlink();
                    if (update) {
                        this.writeEmitter.fire(update);
                    }
                } else {
                    this.stopMkdirBlinkTimer();
                }
            }, 500);
        } else if (!this.panel?.isMkdirBlinkActive && this.mkdirBlinkTimer) {
            this.stopMkdirBlinkTimer();
        }
    }

    private stopMkdirBlinkTimer(): void {
        if (this.mkdirBlinkTimer) {
            clearInterval(this.mkdirBlinkTimer);
            this.mkdirBlinkTimer = undefined;
        }
    }

    private syncCopyMoveBlinkTimer(): void {
        if (this.panel?.isCopyMoveBlinkActive && !this.copyMoveBlinkTimer) {
            this.panel.resetCopyMoveBlink();
            this.copyMoveBlinkTimer = setInterval(() => {
                if (this.panel?.isCopyMoveBlinkActive) {
                    const update = this.panel.renderCopyMoveCursorBlink();
                    if (update) {
                        this.writeEmitter.fire(update);
                    }
                } else {
                    this.stopCopyMoveBlinkTimer();
                }
            }, 500);
        } else if (!this.panel?.isCopyMoveBlinkActive && this.copyMoveBlinkTimer) {
            this.stopCopyMoveBlinkTimer();
        }
    }

    private stopCopyMoveBlinkTimer(): void {
        if (this.copyMoveBlinkTimer) {
            clearInterval(this.copyMoveBlinkTimer);
            this.copyMoveBlinkTimer = undefined;
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
        this.commandPollTimer = setTimeout(() => {
            if (!this.commandRunning || !this.shell) return;
            if (this.shell.pty.process === this.shell.shellProcess) {
                this.commandIdleCount++;
                if (this.commandIdleCount >= 2) {
                    this.commandRunning = false;
                    this.commandPollTimer = undefined;
                    if (this.panel && this.panel.visible && this.panel.waitingMode) {
                        this.stopSpinnerTimer();
                        this.syncPaneCwd();
                        this.panel.settings = readSettings();
                        this.panel.waitingMode = false;
                        this.panel.left.refresh(this.panel.settings);
                        this.panel.right.refresh(this.panel.settings);
                        this.writeEmitter.fire(this.panel.redraw());
                        this.startCmdBlinkTimer();
                    } else if (this.panel && this.panel.visible && !this.panel.waitingMode) {
                        this.syncPaneCwd();
                        this.panel.settings = readSettings();
                        this.panel.left.refresh(this.panel.settings);
                        this.panel.right.refresh(this.panel.settings);
                        this.writeEmitter.fire(this.panel.redraw());
                        this.startCmdBlinkTimer();
                    } else if (this.panel && !this.panel.visible) {
                        this.syncPaneCwd();
                        this.panel.settings = readSettings();
                        this.writeEmitter.fire(this.panel.show());
                        this.startCmdBlinkTimer();
                        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', true);
                    }
                    return;
                }
            } else {
                this.commandIdleCount = 0;
            }
            this.pollCommandDone();
        }, 100);
    }

    private stopCommandPoll(): void {
        this.commandRunning = false;
        if (this.commandPollTimer) {
            clearTimeout(this.commandPollTimer);
            this.commandPollTimer = undefined;
        }
    }

    private startSpinnerTimer(): void {
        this.stopSpinnerTimer();
        this.spinnerTimer = setInterval(() => {
            if (this.panel?.waitingMode) {
                const update = this.panel.renderSpinnerUpdate();
                if (update) {
                    this.writeEmitter.fire(update);
                }
            }
        }, 150);
    }

    private stopSpinnerTimer(): void {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = undefined;
        }
    }

    toggle(): void {
        if (!this.panel) return;
        if (this.commandRunning) {
            if (this.panel.visible) {
                if (this.quickViewActive) {
                    this.panel.quickViewMode = false;
                    this.closeQuickView();
                }
                this.stopSpinnerTimer();
                this.writeEmitter.fire(this.panel.hide());
                this.flushShellOutputBuffer();
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
                if (this.quickViewActive) {
                    this.panel.quickViewMode = false;
                    this.closeQuickView();
                }
                this.stopCmdBlinkTimer();
                this.writeEmitter.fire(this.panel.hide());
                this.flushShellOutputBuffer();
                this.refreshShellPrompt();
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
                    this.startCmdBlinkTimer();
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
        const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (wsFolder) {
            vscode.commands.executeCommand('revealInExplorer', uri);
            blinkDecoration.blink(uri, 24);
        } else {
            vscode.commands.executeCommand('revealFileInOS', uri);
        }
    }

    private openQuickView(filePath: string, targetType: 'file' | 'dir' | 'none', side: 'left' | 'right'): void {
        this.quickViewActive = true;
        this.quickViewSide = side;
        this.lastQuickViewFile = filePath || undefined;
        this.lastQuickViewType = targetType;

        let uri: vscode.Uri;
        if (targetType === 'dir' && filePath) {
            uri = vscode.Uri.parse('vscommander-dirinfo:directory-info');
            dirInfoProvider.scan(filePath);
        } else if (targetType === 'file' && filePath) {
            uri = vscode.Uri.file(filePath);
        } else {
            uri = vscode.Uri.parse('vscommander-dirinfo:directory-info');
        }

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
    }

    private updateQuickViewFromCursor(): void {
        if (!this.panel || !this.quickViewActive) return;
        const target = this.panel.getQuickViewTarget();
        if (target.type === 'none') return;
        if (target.path === this.lastQuickViewFile && target.type === this.lastQuickViewType) return;
        this.lastQuickViewFile = target.path;
        this.lastQuickViewType = target.type;

        let uri: vscode.Uri;
        if (target.type === 'dir') {
            uri = vscode.Uri.parse('vscommander-dirinfo:directory-info');
            dirInfoProvider.scan(target.path);
        } else {
            dirInfoProvider.cancel();
            uri = vscode.Uri.file(target.path);
        }

        const viewColumn = this.quickViewSide === 'right'
            ? vscode.ViewColumn.Two
            : vscode.ViewColumn.One;
        vscode.commands.executeCommand('vscode.open', uri, {
            viewColumn,
            preview: true,
            preserveFocus: true,
        });
    }

    private closeQuickView(): void {
        if (!this.quickViewActive) return;
        this.quickViewActive = false;
        this.lastQuickViewFile = undefined;
        this.lastQuickViewType = 'none';
        dirInfoProvider.cancel();
        const targetGroup = this.quickViewSide === 'right'
            ? vscode.ViewColumn.Two
            : vscode.ViewColumn.One;
        const groups = vscode.window.tabGroups.all;
        const group = groups.find(g => g.viewColumn === targetGroup);
        if (group) {
            vscode.window.tabGroups.close(group);
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

    private makeDirectory(cwd: string, folderName: string, linkType: 'none' | 'symbolic' | 'junction', linkTarget: string, multipleNames: boolean): void {
        const names = multipleNames
            ? folderName.split(';').map(n => n.trim()).filter(n => n.length > 0)
            : [folderName.trim()];
        let lastName = '';
        for (const name of names) {
            if (!name) continue;
            const fullPath = path.join(cwd, name);
            try {
                if (linkType === 'none') {
                    fs.mkdirSync(fullPath, { recursive: true });
                } else {
                    const resolvedTarget = path.resolve(cwd, linkTarget);
                    const type = linkType === 'junction' ? 'junction' : 'dir';
                    fs.symlinkSync(resolvedTarget, fullPath, type);
                }
                lastName = name;
            } catch {
                // ignore per-name errors
            }
        }
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
                let completed = 0;
                for (const fileName of sourceFiles) {
                    if (token.isCancellationRequested) break;
                    const src = path.join(sourceCwd, fileName);
                    const dst = sourceFiles.length === 1 && !targetPath.endsWith(path.sep)
                        ? targetDir
                        : path.join(targetDir, fileName);
                    progress.report({ message: fileName, increment: 100 / total });
                    try {
                        await this.copyMoveOne(src, dst, isMove, overwrite);
                    } catch {
                        // skip individual file errors
                    }
                    completed++;
                }
                if (this.panel) {
                    this.panel.activePaneObj.clearSelection();
                }
                this.refreshPanels();
            }
        );
    }

    private async copyMoveOne(src: string, dst: string, isMove: boolean, overwrite: OverwriteMode): Promise<void> {
        const srcStat = await fs.promises.stat(src);
        let dstPath = dst;

        try {
            const dstStat = await fs.promises.stat(dst);
            if (dstStat.isDirectory()) {
                dstPath = path.join(dst, path.basename(src));
            }
        } catch {
            // dst doesn't exist — use as-is
        }

        const exists = await fs.promises.access(dstPath).then(() => true, () => false);
        if (exists) {
            if (overwrite === 'skip') return;
            if (overwrite === 'ask') {
                const action = await vscode.window.showWarningMessage(
                    '"' + path.basename(dstPath) + '" already exists. Overwrite?',
                    { modal: true },
                    'Overwrite', 'Skip'
                );
                if (action !== 'Overwrite') return;
            }
        }

        if (isMove) {
            try {
                await fs.promises.rename(src, dstPath);
                return;
            } catch {
                // cross-device — fall through to copy+delete
            }
        }

        if (srcStat.isDirectory()) {
            await this.copyDirRecursive(src, dstPath);
            if (isMove) {
                await fs.promises.rm(src, { recursive: true, force: true });
            }
        } else {
            const dstDir = path.dirname(dstPath);
            await fs.promises.mkdir(dstDir, { recursive: true });
            await fs.promises.copyFile(src, dstPath);
            if (isMove) {
                await fs.promises.unlink(src);
            }
        }
    }

    private async copyDirRecursive(src: string, dst: string): Promise<void> {
        await fs.promises.mkdir(dst, { recursive: true });
        const entries = await fs.promises.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const dstPath = path.join(dst, entry.name);
            if (entry.isDirectory()) {
                await this.copyDirRecursive(srcPath, dstPath);
            } else {
                await fs.promises.copyFile(srcPath, dstPath);
            }
        }
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
    activeTerminal = undefined;
}
