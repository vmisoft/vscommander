import * as vscode from 'vscode';
import * as os from 'os';
import { spawnShell, ShellProxy, WindowsBackend } from './shell';
import { Panel } from './panel';
import { PanelSettings, DEFAULT_SETTINGS, DEFAULT_KEY_BINDINGS, mergeSettings, resolveTheme, ThemeName, ColorOverride, applyColorOverrides, THEME_KEYS } from './settings';
import { DirectoryInfoProvider } from './directoryInfo';
import { BlinkTimer, PollTimer } from './timerManager';
import { makeDirectories } from './fileOps';
import { ShellRouter } from './shellRouter';
import { QuickViewController, QuickViewHost } from './quickView';
import { CopyMoveController } from './copyMoveController';

const ALL_VSCOMMANDER_KEYS = [
    'theme', 'showDotfiles', 'clock', 'panelColumns',
    'keyView', 'keyEdit', 'keyCopy', 'keyMove', 'keyMkdir', 'keyDelete',
    'keyForceDelete', 'keyQuit', 'keyMenu', 'keyDriveLeft', 'keyDriveRight',
    'keyToggleDotfiles', 'keyTogglePane', 'keyDetach', 'keyResizeLeft',
    'keyResizeRight', 'keyQuickView',
];

function hasSettingsInScope(scope: 'user' | 'workspace'): boolean {
    const cfg = vscode.workspace.getConfiguration('vscommander');
    const colorsCfg = vscode.workspace.getConfiguration('vscommander.colors');
    for (const key of ALL_VSCOMMANDER_KEYS) {
        const val = cfg.inspect(key);
        if (scope === 'user' && val?.globalValue !== undefined) return true;
        if (scope === 'workspace' && val?.workspaceValue !== undefined) return true;
    }
    for (const key of THEME_KEYS) {
        const val = colorsCfg.inspect(key);
        if (scope === 'user' && val?.globalValue !== undefined) return true;
        if (scope === 'workspace' && val?.workspaceValue !== undefined) return true;
    }
    return false;
}

function readSettings(): PanelSettings {
    const cfg = vscode.workspace.getConfiguration('vscommander');
    const toggleKey = os.platform() === 'darwin' ? '\u2303O' : 'Ctrl+O';
    const themeName = (cfg.get<string>('theme', 'far') || 'far') as ThemeName;
    let theme = resolveTheme(themeName, vscode.window.activeColorTheme.kind);
    const baseTheme = theme;
    const colorsCfg = vscode.workspace.getConfiguration('vscommander.colors');
    const overrides: Record<string, ColorOverride> = {};
    for (const key of THEME_KEYS) {
        const val = colorsCfg.inspect<ColorOverride>(key);
        const ov = val?.globalValue ?? val?.workspaceValue ?? val?.workspaceFolderValue;
        if (ov && Object.keys(ov).length > 0) {
            overrides[key] = ov;
        }
    }
    if (Object.keys(overrides).length > 0) {
        theme = applyColorOverrides(theme, overrides);
    }
    return mergeSettings({
        showDotfiles: cfg.get<boolean>('showDotfiles', DEFAULT_SETTINGS.showDotfiles),
        clockEnabled: cfg.get<boolean>('clock', DEFAULT_SETTINGS.clockEnabled),
        panelColumns: cfg.get<number>('panelColumns', DEFAULT_SETTINGS.panelColumns),
        workspaceDirs: (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath),
        toggleKey,
        theme,
        baseTheme,
        themeName,
        colorOverrides: overrides,
        vscodeThemeKind: vscode.window.activeColorTheme.kind,
        remoteName: vscode.env.remoteName || '',
        settingsInScopes: {
            user: hasSettingsInScope('user'),
            workspace: hasSettingsInScope('workspace'),
        },
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
    private colorEditorBlinkTimer = new BlinkTimer(500);
    private isDetached = false;
    private lastViewedFile: string | undefined;
    private quickView: QuickViewController;
    private commandRunning = false;
    private commandPollTimer = new PollTimer();
    private commandIdleCount = 0;
    private spinnerTimer = new BlinkTimer(150);
    private copyMoveController = new CopyMoveController();
    private pendingRedrawAfterResize = false;
    private pendingChdir: string | undefined;
    private themeListener: vscode.Disposable | undefined;
    private configListener: vscode.Disposable | undefined;
    private suppressConfigReload = false;

    constructor(cwd: string) {
        this.cwd = cwd;
        const host: QuickViewHost = {
            openSplit: (filePath, targetType, side) => {
                const uri = targetType === 'dir'
                    ? vscode.Uri.parse('vscommander-dirinfo:directory-info')
                    : vscode.Uri.file(filePath);
                const ratio = this.panel ? this.panel.getActivePaneRatio() : 0.5;
                const termSize = Math.ceil(ratio * 1000);
                const previewSize = 1000 - termSize;
                const setLayout = () => {
                    const groups = side === 'right'
                        ? [{ size: termSize }, { size: previewSize }]
                        : [{ size: previewSize }, { size: termSize }];
                    vscode.commands.executeCommand('vscode.setEditorLayout', {
                        orientation: 0,
                        groups,
                    });
                };
                if (side === 'right') {
                    vscode.commands.executeCommand('vscode.setEditorLayout', {
                        orientation: 0,
                        groups: [{ size: termSize }, { size: previewSize }],
                    }).then(() => {
                        vscode.commands.executeCommand('vscode.open', uri, {
                            viewColumn: vscode.ViewColumn.Two,
                            preview: true,
                            preserveFocus: true,
                        });
                    });
                } else {
                    vscode.commands.executeCommand('vscode.open', uri, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: true,
                        preserveFocus: false,
                    }).then(() => {
                        vscode.commands.executeCommand('workbench.action.moveActiveEditorGroupLeft').then(() => {
                            vscode.commands.executeCommand('workbench.action.focusNextGroup').then(setLayout);
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

        vscode.window.tabGroups.onDidChangeTabGroups((e) => {
            if (!this.quickView.active || !this.panel?.visible) return;
            if (e.closed.length > 0) {
                const side = this.quickView.side;
                const targetCol = side === 'right'
                    ? vscode.ViewColumn.Two
                    : vscode.ViewColumn.One;
                const wasTarget = e.closed.some(g => g.viewColumn === targetCol);
                if (wasTarget) {
                    this.panel.quickViewMode = false;
                    this.quickView.active = false;
                    this.quickView.lastFile = undefined;
                    this.pendingRedrawAfterResize = true;
                }
            }
        });

        this.themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
            if (!this.panel) return;
            this.panel.settings.vscodeThemeKind = vscode.window.activeColorTheme.kind;
            if (this.panel.settings.themeName === 'vscode') {
                const base = resolveTheme('vscode', vscode.window.activeColorTheme.kind);
                this.panel.settings.baseTheme = base;
                let theme = base;
                const ov = this.panel.settings.colorOverrides;
                if (Object.keys(ov).length > 0) {
                    theme = applyColorOverrides(base, ov);
                }
                this.panel.settings.theme = theme;
                if (this.panel.visible) {
                    this.panel.left.refresh(this.panel.settings);
                    this.panel.right.refresh(this.panel.settings);
                    this.writeEmitter.fire(this.panel.redraw());
                }
            }
        });

        this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
            if (this.suppressConfigReload) return;
            if (e.affectsConfiguration('vscommander')) {
                this.reloadSettingsAndRedraw();
            }
        });
    }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        if (initialDimensions) {
            this.cols = initialDimensions.columns;
            this.rows = initialDimensions.rows;
        }

        const settings = readSettings();
        this.panel = new Panel(this.cols, this.rows, this.cwd, settings);

        this.startClockTimer();
        this.restartCmdBlinkTimer();

        this.writeEmitter.fire(this.panel.show());
        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', true);

        // Spawn shell asynchronously — pty.spawn() with ConPTY can block
        // the event loop on Windows; deferring ensures the panel renders first.
        setTimeout(() => {
            this.setupShell();
        }, 0);
    }

    private setupShell(): void {
        const backend = os.platform() === 'win32'
            ? vscode.workspace.getConfiguration('vscommander').get<WindowsBackend>('windowsBackend', 'winpty')
            : undefined;
        try {
            this.shell = spawnShell(this.cols, this.rows, this.cwd, backend);
        } catch {
            try {
                this.shell = spawnShell(this.cols, this.rows, os.homedir(), backend);
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
    }

    private reloadSettingsAndRedraw(): void {
        if (!this.panel) return;
        this.panel.settings = readSettings();
        if (this.panel.visible) {
            this.panel.left.refresh(this.panel.settings);
            this.panel.right.refresh(this.panel.settings);
            this.writeEmitter.fire(this.panel.redraw());
        }
    }

    close(): void {
        if (this.quickView.active) {
            this.quickView.close();
        }
        this.themeListener?.dispose();
        this.configListener?.dispose();
        this.clockTimer.stop();
        this.blinkTimer.stop();
        this.cmdBlinkTimer.stop();
        this.mkdirBlinkTimer.stop();
        this.copyMoveBlinkTimer.stop();
        this.colorEditorBlinkTimer.stop();
        this.spinnerTimer.stop();
        this.stopCommandPoll();
        this.shell?.kill();
        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
    }

    handleInput(data: string): void {
        if (this.panel?.visible) {
            const wasSearchActive = this.panel.isSearchActive;
            const result = this.panel.handleInput(data);
            if (result.action !== 'viewFile') {
                this.lastViewedFile = undefined;
            }
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
                        this.panel.waitingMode = true;
                        this.panel.spinnerFrame = 0;
                        this.writeEmitter.fire(this.panel.redraw());
                        this.startSpinnerTimer();
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
                        this.pendingRedrawAfterResize = true;
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
                    this.copyMoveController.execute(this.panel, result.result, {
                        fire: s => this.writeEmitter.fire(s),
                        refreshPanels: () => this.refreshPanels(),
                        askOverwrite: async (name) => {
                            const action = await vscode.window.showWarningMessage(
                                '"' + name + '" already exists. Overwrite?',
                                { modal: true },
                                'Overwrite', 'Skip',
                            );
                            return action === 'Overwrite';
                        },
                    });
                    break;
                case 'changeTheme': {
                    const newBase = resolveTheme(result.themeName, vscode.window.activeColorTheme.kind);
                    let newTheme = newBase;
                    const ov = this.panel.settings.colorOverrides;
                    if (Object.keys(ov).length > 0) {
                        newTheme = applyColorOverrides(newBase, ov);
                    }
                    this.panel.settings.themeName = result.themeName;
                    this.panel.settings.baseTheme = newBase;
                    this.panel.settings.theme = newTheme;
                    this.panel.left.refresh(this.panel.settings);
                    this.panel.right.refresh(this.panel.settings);
                    this.writeEmitter.fire(this.panel.redraw());
                    break;
                }
                case 'saveSettings':
                    this.saveAllSettings(result.scope);
                    break;
                case 'deleteSettings':
                    this.deleteAllSettings(result.scope);
                    break;
                case 'quickView':
                    this.writeEmitter.fire(result.data);
                    this.quickView.open(result.filePath, result.targetType, result.side);
                    break;
                case 'quickViewClose':
                    this.quickView.close();
                    this.pendingRedrawAfterResize = true;
                    if (result.chdir) {
                        this.pendingChdir = result.chdir;
                    }
                    break;
                case 'none':
                    break;
            }
            this.copyMoveController.handleErrorDismiss(this.panel.confirmPopup.active);
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
            this.colorEditorBlinkTimer.sync(
                () => !!this.panel?.isColorEditorBlinkActive,
                () => this.panel!.resetColorEditorBlink(),
                () => {
                    if (this.panel?.isColorEditorBlinkActive) return this.panel.renderColorEditorCursorBlink();
                    this.colorEditorBlinkTimer.stop();
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
            if (this.pendingRedrawAfterResize) {
                this.pendingRedrawAfterResize = false;
                if (this.pendingChdir) {
                    if (this.shell) this.shellRouter.changeDir(this.pendingChdir, this.shell, this.panel);
                    this.pendingChdir = undefined;
                }
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
                        this.panel.waitingMode = false;
                        this.panel.left.refresh(this.panel.settings);
                        this.panel.right.refresh(this.panel.settings);
                        this.writeEmitter.fire(this.panel.redraw());
                        this.restartCmdBlinkTimer();
                    } else if (this.panel && this.panel.visible && !this.panel.waitingMode) {
                        this.syncPaneCwd();
                        this.panel.left.refresh(this.panel.settings);
                        this.panel.right.refresh(this.panel.settings);
                        this.writeEmitter.fire(this.panel.redraw());
                        this.restartCmdBlinkTimer();
                    } else if (this.panel && !this.panel.visible) {
                        this.syncPaneCwd();
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
            if (this.lastViewedFile === filePath) {
                this.lastViewedFile = undefined;
                vscode.commands.executeCommand('workbench.action.closeSidebar');
                return;
            }
            this.lastViewedFile = filePath;
            vscode.commands.executeCommand('revealInExplorer', uri).then(() => {
                setTimeout(() => {
                    vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
                }, 100);
            });
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

    private async saveAllSettings(scope: 'user' | 'workspace'): Promise<void> {
        if (!this.panel) return;
        const target = scope === 'user'
            ? vscode.ConfigurationTarget.Global
            : vscode.ConfigurationTarget.Workspace;
        const s = this.panel.settings;
        const cfg = vscode.workspace.getConfiguration('vscommander');
        await cfg.update('theme', s.themeName, target);
        await cfg.update('showDotfiles', s.showDotfiles, target);
        await cfg.update('clock', s.clockEnabled, target);
        await cfg.update('panelColumns', s.panelColumns, target);
        await cfg.update('keyView', s.keys.view, target);
        await cfg.update('keyEdit', s.keys.edit, target);
        await cfg.update('keyCopy', s.keys.copy, target);
        await cfg.update('keyMove', s.keys.move, target);
        await cfg.update('keyMkdir', s.keys.mkdir, target);
        await cfg.update('keyDelete', s.keys.delete, target);
        await cfg.update('keyForceDelete', s.keys.forceDelete, target);
        await cfg.update('keyQuit', s.keys.quit, target);
        await cfg.update('keyMenu', s.keys.menu, target);
        await cfg.update('keyDriveLeft', s.keys.driveLeft, target);
        await cfg.update('keyDriveRight', s.keys.driveRight, target);
        await cfg.update('keyToggleDotfiles', s.keys.toggleDotfiles, target);
        await cfg.update('keyTogglePane', s.keys.togglePane, target);
        await cfg.update('keyDetach', s.keys.detach, target);
        await cfg.update('keyResizeLeft', s.keys.resizeLeft, target);
        await cfg.update('keyResizeRight', s.keys.resizeRight, target);
        await cfg.update('keyQuickView', s.keys.quickView, target);
        const colorsCfg = vscode.workspace.getConfiguration('vscommander.colors');
        for (const key of THEME_KEYS) {
            const value = s.colorOverrides[key];
            if (value && Object.keys(value).length > 0) {
                await colorsCfg.update(key, value, target);
            } else {
                await colorsCfg.update(key, undefined, target);
            }
        }
        this.panel.settings.settingsInScopes = {
            user: hasSettingsInScope('user'),
            workspace: hasSettingsInScope('workspace'),
        };
    }

    private async deleteAllSettings(scope: 'user' | 'workspace'): Promise<void> {
        if (!this.panel) return;
        this.suppressConfigReload = true;
        const target = scope === 'user'
            ? vscode.ConfigurationTarget.Global
            : vscode.ConfigurationTarget.Workspace;
        const cfg = vscode.workspace.getConfiguration('vscommander');
        for (const key of ALL_VSCOMMANDER_KEYS) {
            await cfg.update(key, undefined, target);
        }
        const colorsCfg = vscode.workspace.getConfiguration('vscommander.colors');
        for (const key of THEME_KEYS) {
            await colorsCfg.update(key, undefined, target);
        }
        this.panel.settings.settingsInScopes = {
            user: hasSettingsInScope('user'),
            workspace: hasSettingsInScope('workspace'),
        };
        setTimeout(() => { this.suppressConfigReload = false; }, 100);
    }

    private refreshPanels(): void {
        if (this.panel?.visible) {
            this.panel.left.refresh(this.panel.settings);
            this.panel.right.refresh(this.panel.settings);
            this.writeEmitter.fire(this.panel.redraw());
        }
    }
}

const dirInfoProvider = new DirectoryInfoProvider();
let activeTerminal: VSCommanderTerminal | undefined;
let activeVscodeTerminal: vscode.Terminal | undefined;

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
        activeVscodeTerminal = terminal;
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

    const dirInfoDisposable = vscode.workspace.registerTextDocumentContentProvider('vscommander-dirinfo', dirInfoProvider);

    const terminalFocusListener = vscode.window.onDidChangeActiveTerminal((t) => {
        if (t && t === activeVscodeTerminal) {
            t.show(false);
        }
    });

    context.subscriptions.push(openCmd, toggleCmd, quickViewCmd, togglePaneCmd, sidebarTree, sidebarVisibility, dirInfoDisposable, terminalFocusListener);
}

export function deactivate() {
    dirInfoProvider.dispose();
    activeTerminal = undefined;
    activeVscodeTerminal = undefined;
}
