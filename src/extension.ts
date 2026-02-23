// Disable Electron's ASAR archive interception so .asar files are treated
// as regular files by Node's fs module. Without this, copying directories
// containing .asar files fails with "Invalid package" errors.
(process as any).noAsar = true;

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { spawnShell, ShellProxy, WindowsBackend } from './shell';
import { Panel } from './panel';
import { PanelSettings, DEFAULT_SETTINGS, DEFAULT_KEY_BINDINGS, mergeSettings, resolveTheme, ThemeName, ColorOverride, applyColorOverrides, THEME_KEYS } from './settings';
import { BlinkTimer, PollTimer } from './timerManager';
import { makeDirectories, deleteRecursive, DeleteErrorAction, DeleteErrorCallback, MkdirErrorAction, MkdirErrorCallback } from './fileOps';
import { describeFileError } from './helpers';
import { KEY_F1 } from './keys';
import { ShellRouter } from './shellRouter';
import { CopyMoveController } from './copyMoveController';
import { UserMenuItem, normalizeMenuItem, MenuScope } from './userMenu';
import { openArchive } from './archiveFs';
import { log } from './logger';
import './archiveZip';
import './archiveTar';
import './archive7z';
import './archiveRar';

const ALL_VSCOMMANDER_KEYS = [
    'theme', 'showDotfiles', 'clock', 'panelColumns', 'interceptF1',
    'sortMode', 'sortReversed', 'sortDirsFirst', 'useSortGroups',
    'userMenu',
    'keyHelp', 'keyUserMenu', 'keyView', 'keyEdit', 'keyCopy', 'keyMove', 'keyMkdir', 'keyDelete',
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

function readUserMenuItems(scope: 'user' | 'workspace'): UserMenuItem[] {
    const cfg = vscode.workspace.getConfiguration('vscommander');
    const inspected = cfg.inspect<unknown[]>('userMenu');
    const raw = scope === 'user' ? inspected?.globalValue : inspected?.workspaceValue;
    if (!Array.isArray(raw)) return [];
    return raw.map(item => normalizeMenuItem(item as Record<string, unknown>));
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
        interceptF1: cfg.get<boolean>('interceptF1', DEFAULT_SETTINGS.interceptF1),
        sortMode: cfg.get<string>('sortMode', DEFAULT_SETTINGS.sortMode),
        sortReversed: cfg.get<boolean>('sortReversed', DEFAULT_SETTINGS.sortReversed),
        sortDirsFirst: cfg.get<boolean>('sortDirsFirst', DEFAULT_SETTINGS.sortDirsFirst),
        useSortGroups: cfg.get<boolean>('useSortGroups', DEFAULT_SETTINGS.useSortGroups),
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
            help: cfg.get<string>('keyHelp', DEFAULT_KEY_BINDINGS.help),
            userMenu: cfg.get<string>('keyUserMenu', DEFAULT_KEY_BINDINGS.userMenu),
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
    private overwriteBlinkTimer = new BlinkTimer(500);
    private userMenuBlinkTimer = new BlinkTimer(500);
    private isDetached = false;
    private lastViewedFile: string | undefined;
    private qvRedrawTimer = new BlinkTimer(50);
    private commandRunning = false;
    private commandPollTimer = new PollTimer();
    private commandIdleCount = 0;
    private spinnerTimer = new BlinkTimer(150);
    private copyMoveController = new CopyMoveController();
    private themeListener: vscode.Disposable | undefined;
    private configListener: vscode.Disposable | undefined;
    private suppressConfigReload = false;
    private extensionPath: string;
    private deleteErrorResolve: ((action: DeleteErrorAction) => void) | null = null;
    private mkdirErrorResolve: ((action: MkdirErrorAction) => void) | null = null;

    constructor(cwd: string, extensionPath: string) {
        this.cwd = cwd;
        this.extensionPath = extensionPath;

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
        this.panel.docsDir = path.join(this.extensionPath, 'docs');
        this.panel.userMenuItems = readUserMenuItems('user');
        this.panel.workspaceMenuItems = readUserMenuItems('workspace');

        this.startClockTimer();
        this.restartCmdBlinkTimer();

        this.writeEmitter.fire(this.panel.show());
        log.info('show', 'interceptF1=' + settings.interceptF1 + ' panelVisible=true');
        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', true);
        vscode.commands.executeCommand('setContext', 'vscommander.interceptF1', settings.interceptF1);

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
        } catch (e1) {
            try {
                this.shell = spawnShell(this.cols, this.rows, os.homedir(), backend);
            } catch (e2) {
                console.error('[VSCommander] Failed to spawn shell:', e1, e2);
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
        this.panel.userMenuItems = readUserMenuItems('user');
        this.panel.workspaceMenuItems = readUserMenuItems('workspace');
        if (this.panel.visible) {
            this.panel.left.refresh(this.panel.settings);
            this.panel.right.refresh(this.panel.settings);
            this.writeEmitter.fire(this.panel.redraw());
        }
    }

    close(): void {
        this.themeListener?.dispose();
        this.configListener?.dispose();
        this.clockTimer.stop();
        this.blinkTimer.stop();
        this.cmdBlinkTimer.stop();
        this.mkdirBlinkTimer.stop();
        this.copyMoveBlinkTimer.stop();
        this.colorEditorBlinkTimer.stop();
        this.overwriteBlinkTimer.stop();
        this.userMenuBlinkTimer.stop();
        this.spinnerTimer.stop();
        this.qvRedrawTimer.stop();
        this.stopCommandPoll();
        this.shell?.kill();
        vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
    }

    handleInput(data: string): void {
        if (data === KEY_F1) {
            log.debug('input', 'F1 received, interceptF1=' + this.panel?.settings.interceptF1);
        }
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
                    this.qvRedrawTimer.stop();
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
                case 'enterArchive':
                    this.enterArchive(result.filePath);
                    break;
                case 'openArchiveFile':
                    this.openArchiveFile(result.archivePath, result.entryPath);
                    break;
                case 'viewArchiveFile':
                    this.openArchiveFile(result.archivePath, result.entryPath);
                    break;
                case 'extractFromArchive':
                    this.writeEmitter.fire(this.panel.redraw());
                    this.extractFromArchive(result.targetPath, result.entryPaths, result.archiveDir);
                    break;
                case 'addToArchive':
                    this.writeEmitter.fire(this.panel.redraw());
                    this.addToArchive(result.sourcePaths, result.archiveDir);
                    break;
                case 'deleteFromArchive':
                    this.writeEmitter.fire(this.panel.redraw());
                    this.deleteFromArchive(result.entryPaths);
                    break;
                case 'mkdirInArchive':
                    this.mkdirInArchive(result.dirPath);
                    break;
                case 'moveFromArchive':
                    this.writeEmitter.fire(this.panel.redraw());
                    this.moveFromArchive(result.targetPath, result.entryPaths, result.archiveDir);
                    break;
                case 'moveToArchive':
                    this.writeEmitter.fire(this.panel.redraw());
                    this.moveToArchive(result.sourcePaths, result.archiveDir);
                    break;
                case 'saveUserMenu':
                    this.saveUserMenu(result.scope, result.items);
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
                case 'mkdir':
                    this.makeDirectory(result.cwd, result.dirName, result.linkType, result.linkTarget, result.multipleNames);
                    break;
                case 'copyMove':
                    this.copyMoveController.execute(this.panel, result.result, {
                        fire: s => this.writeEmitter.fire(s),
                        refreshPanels: () => this.refreshPanels(),
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
                case 'interceptF1Changed':
                    log.info('interceptF1', 'changed to ' + result.interceptF1);
                    this.writeEmitter.fire(result.data);
                    vscode.commands.executeCommand('setContext', 'vscommander.interceptF1', result.interceptF1);
                    break;
                case 'commandPalette':
                    vscode.commands.executeCommand('workbench.action.showCommands');
                    break;
                case 'saveSettings':
                    this.saveAllSettings(result.scope);
                    break;
                case 'deleteSettings':
                    this.deleteAllSettings(result.scope);
                    break;
                case 'openPrivacySettings':
                    vscode.env.openExternal(vscode.Uri.parse(
                        'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders'
                    ));
                    break;
                case 'none':
                    break;
            }
            if (result.data && result.action !== 'redraw' && result.action !== 'close'
                && result.action !== 'interceptF1Changed'
                && result.action !== 'input' && result.action !== 'executeCommand'
                && result.action !== 'saveUserMenu') {
                this.writeEmitter.fire(result.data);
            }
            this.copyMoveController.handleErrorDismiss(this.panel.confirmPopup.active);
            this.copyMoveController.handleOverwriteDismiss(this.panel.overwritePopup.active);
            if (this.deleteErrorResolve && !this.panel.confirmPopup.active) {
                const resolve = this.deleteErrorResolve;
                this.deleteErrorResolve = null;
                resolve('cancel');
            }
            if (this.mkdirErrorResolve && !this.panel.confirmPopup.active) {
                const resolve = this.mkdirErrorResolve;
                this.mkdirErrorResolve = null;
                resolve('cancel');
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
            this.colorEditorBlinkTimer.sync(
                () => !!this.panel?.isColorEditorBlinkActive,
                () => this.panel!.resetColorEditorBlink(),
                () => {
                    if (this.panel?.isColorEditorBlinkActive) return this.panel.renderColorEditorCursorBlink();
                    this.colorEditorBlinkTimer.stop();
                },
                s => this.writeEmitter.fire(s),
            );
            this.overwriteBlinkTimer.sync(
                () => !!this.panel?.isOverwriteBlinkActive,
                () => this.panel!.resetOverwriteBlink(),
                () => {
                    if (this.panel?.isOverwriteBlinkActive) return this.panel.renderOverwriteCursorBlink();
                    this.overwriteBlinkTimer.stop();
                },
                s => this.writeEmitter.fire(s),
            );
            this.userMenuBlinkTimer.sync(
                () => !!this.panel?.isUserMenuBlinkActive,
                () => this.panel!.resetUserMenuBlink(),
                () => {
                    if (this.panel?.isUserMenuBlinkActive) return this.panel.renderUserMenuCursorBlink();
                    this.userMenuBlinkTimer.stop();
                },
                s => this.writeEmitter.fire(s),
            );
            this.qvRedrawTimer.sync(
                () => !!this.panel?.isQuickViewScanning,
                () => {},
                () => {
                    if (this.panel?.isQuickViewScanning) {
                        this.panel.tickQuickViewRedraw();
                        return this.panel.renderQuickViewUpdate();
                    }
                    this.qvRedrawTimer.stop();
                    return this.panel?.renderQuickViewUpdate();
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
        const pane = this.panel.activePaneObj;
        if (pane.isVirtual) return;
        const shellCwd = this.shell.getCwd();
        if (shellCwd && shellCwd !== pane.cwd) {
            pane.cwd = shellCwd;
            pane.cursor = 0;
            pane.scroll = 0;
        }
    }

    private pollCommandDone(): void {
        if (!this.commandRunning || !this.shell) return;
        this.commandPollTimer.start(100, () => {
            if (!this.commandRunning || !this.shell) return false;
            if (path.basename(this.shell.pty.process) === path.basename(this.shell.shellProcess)) {
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
                this.qvRedrawTimer.stop();
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
                this.qvRedrawTimer.stop();
                this.cmdBlinkTimer.stop();
                this.writeEmitter.fire(this.panel.hide());
                this.shellRouter.flush(s => this.writeEmitter.fire(s));
                if (this.shell) this.shellRouter.refreshPrompt(this.shell);
                vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);
            } else {
                const shellBusy = this.shell !== undefined && path.basename(this.shell.pty.process) !== path.basename(this.shell.shellProcess);
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

    private async enterArchive(filePath: string): Promise<void> {
        if (!this.panel) return;
        const handle = await openArchive(filePath);
        if (!handle) {
            this.openFile(filePath);
            return;
        }
        const pane = this.panel.activePaneObj;
        pane.enterArchive(handle);
        this.writeEmitter.fire(this.panel.redraw());
    }

    private async openArchiveFile(archivePath: string, entryPath: string): Promise<void> {
        if (!this.panel) return;
        const pane = this.panel.activePaneObj;
        if (!pane.archiveHandle) return;
        const archiveHash = path.basename(archivePath).replace(/[^a-zA-Z0-9._-]/g, '_');
        const tmpDir = path.join(os.tmpdir(), 'vscommander-archive', archiveHash);
        const entryDir = entryPath.includes('/') ? entryPath.slice(0, entryPath.lastIndexOf('/')) : '';
        const destDir = entryDir ? path.join(tmpDir, ...entryDir.split('/')) : tmpDir;
        const destPath = path.join(destDir, path.basename(entryPath));
        try {
            await pane.archiveHandle.extractToFile(entryPath, destPath);
            this.openFile(destPath);
        } catch {
            // extraction failed — ignore
        }
    }

    private async extractFromArchive(targetPath: string, entryPaths: string[], archiveDir: string): Promise<void> {
        if (!this.panel) return;
        const pane = this.panel.activePaneObj;
        if (!pane.archiveHandle) return;

        const handle = pane.archiveHandle;
        const allEntries = handle.entries;

        const filesToExtract: { archivePath: string; relativePath: string }[] = [];
        let totalBytes = 0;

        for (const ep of entryPaths) {
            const matchedEntry = allEntries.find(e => {
                const normalized = e.path.endsWith('/') ? e.path.slice(0, -1) : e.path;
                return normalized === ep;
            });

            if (matchedEntry && !matchedEntry.isDir) {
                const baseName = ep.lastIndexOf('/') >= 0 ? ep.slice(ep.lastIndexOf('/') + 1) : ep;
                filesToExtract.push({ archivePath: ep, relativePath: baseName });
                totalBytes += matchedEntry.size;
            } else {
                const prefix = ep + '/';
                for (const e of allEntries) {
                    const normalized = e.path.endsWith('/') ? e.path.slice(0, -1) : e.path;
                    if (normalized === ep && e.isDir) continue;
                    if (normalized.startsWith(prefix) && !e.isDir) {
                        const baseName = ep.lastIndexOf('/') >= 0 ? ep.slice(ep.lastIndexOf('/') + 1) : ep;
                        const relativePath = baseName + '/' + normalized.slice(prefix.length);
                        filesToExtract.push({ archivePath: normalized, relativePath });
                        totalBytes += e.size;
                    }
                }
            }
        }

        if (filesToExtract.length === 0) {
            this.refreshPanels();
            return;
        }

        const resolvedTarget = path.isAbsolute(targetPath)
            ? targetPath
            : path.resolve(pane.cwd, targetPath);

        this.panel.copyProgressPopup.openWith('copy', filesToExtract.length, totalBytes);
        this.writeEmitter.fire(this.panel.redraw());

        let filesDone = 0;
        let bytesDone = 0;
        let lastRedraw = 0;
        let cancelled = false;

        for (const file of filesToExtract) {
            if (cancelled || this.panel.copyProgressPopup.cancelled) break;

            const destPath = path.join(resolvedTarget, file.relativePath);

            const srcDisplay = path.basename(handle.archivePath) + ':' + file.archivePath;
            const totalPct = totalBytes > 0 ? Math.min(100, Math.floor(bytesDone * 100 / totalBytes)) : 0;
            this.panel.copyProgressPopup.updateProgress(
                srcDisplay, destPath, filesDone, filesToExtract.length,
                bytesDone, totalBytes, 0, totalPct,
            );

            const now = Date.now();
            if (now - lastRedraw >= 50) {
                lastRedraw = now;
                this.writeEmitter.fire(this.panel.redraw());
                await new Promise<void>(r => setTimeout(r, 0));
            }

            try {
                await handle.extractToFile(file.archivePath, destPath);
            } catch {
                // skip failed extractions
            }

            const entry = allEntries.find(e => {
                const normalized = e.path.endsWith('/') ? e.path.slice(0, -1) : e.path;
                return normalized === file.archivePath;
            });
            bytesDone += entry ? entry.size : 0;
            filesDone++;
        }

        this.panel.copyProgressPopup.close();
        pane.clearSelection();
        this.refreshPanels();
    }

    private async addToArchive(sourcePaths: string[], archiveDir: string): Promise<void> {
        if (!this.panel) return;
        const otherPane = this.panel.activePane === 'left' ? this.panel.right : this.panel.left;
        if (!otherPane.archiveHandle || !otherPane.archiveHandle.addEntries) return;

        const handle = otherPane.archiveHandle;
        try {
            await handle.addEntries!(sourcePaths, archiveDir);
        } catch {
            // add failed
        }

        const reopened = await openArchive(handle.archivePath);
        if (reopened) {
            otherPane.archiveHandle = reopened;
            otherPane.refreshArchiveView();
        }
        this.panel.activePaneObj.clearSelection();
        this.refreshPanels();
    }

    private async deleteFromArchive(entryPaths: string[]): Promise<void> {
        if (!this.panel) return;
        const pane = this.panel.activePaneObj;
        if (!pane.archiveHandle || !pane.archiveHandle.deleteEntries) return;

        const handle = pane.archiveHandle;
        try {
            await handle.deleteEntries!(entryPaths);
        } catch {
            // delete failed
        }

        const reopened = await openArchive(handle.archivePath);
        if (reopened) {
            pane.archiveHandle = reopened;
            pane.refreshArchiveView();
        }
        pane.clearSelection();
        this.refreshPanels();
    }

    private async mkdirInArchive(dirPath: string): Promise<void> {
        if (!this.panel) return;
        const pane = this.panel.activePaneObj;
        if (!pane.archiveHandle || !pane.archiveHandle.mkdirEntry) return;

        const handle = pane.archiveHandle;
        try {
            await handle.mkdirEntry!(dirPath);
        } catch {
            // mkdir failed
        }

        const reopened = await openArchive(handle.archivePath);
        if (reopened) {
            pane.archiveHandle = reopened;
            pane.refreshArchiveView();
        }
        const dirName = dirPath.includes('/') ? dirPath.slice(dirPath.lastIndexOf('/') + 1) : dirPath;
        const idx = pane.entries.findIndex(e => e.name === dirName);
        if (idx >= 0) pane.cursor = idx;
        this.refreshPanels();
    }

    private async moveFromArchive(targetPath: string, entryPaths: string[], archiveDir: string): Promise<void> {
        if (!this.panel) return;
        const pane = this.panel.activePaneObj;
        if (!pane.archiveHandle || !pane.archiveHandle.deleteEntries) return;

        await this.extractFromArchive(targetPath, entryPaths, archiveDir);

        const handle = pane.archiveHandle;
        if (!handle) return;
        try {
            await handle.deleteEntries!(entryPaths);
        } catch {
            // delete failed after extract
        }

        const reopened = await openArchive(handle.archivePath);
        if (reopened) {
            pane.archiveHandle = reopened;
            pane.refreshArchiveView();
        }
        this.refreshPanels();
    }

    private async moveToArchive(sourcePaths: string[], archiveDir: string): Promise<void> {
        if (!this.panel) return;
        const otherPane = this.panel.activePane === 'left' ? this.panel.right : this.panel.left;
        if (!otherPane.archiveHandle || !otherPane.archiveHandle.addEntries) return;

        const handle = otherPane.archiveHandle;
        try {
            await handle.addEntries!(sourcePaths, archiveDir);
        } catch {
            // add failed — don't delete sources
            this.refreshPanels();
            return;
        }

        const fs = await import('fs');
        for (const src of sourcePaths) {
            try {
                fs.rmSync(src, { recursive: true, force: true });
            } catch {
                // skip failed deletions
            }
        }

        const reopened = await openArchive(handle.archivePath);
        if (reopened) {
            otherPane.archiveHandle = reopened;
            otherPane.refreshArchiveView();
        }
        this.panel.activePaneObj.clearSelection();
        this.refreshPanels();
    }

    private async deleteFile(filePath: string, toTrash: boolean): Promise<void> {
        if (!this.panel) return;

        let isDir = false;
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            isDir = (stat.type & vscode.FileType.Directory) !== 0;
        } catch {
            this.refreshPanels();
            return;
        }

        const mode = isDir ? 'directory' : 'file';
        this.panel.deleteProgressPopup.openWith(mode, filePath);
        this.writeEmitter.fire(this.panel.redraw());

        const showDeleteError = (errorFilePath: string, error: Error): Promise<DeleteErrorAction> => {
            return new Promise<DeleteErrorAction>((resolve) => {
                if (!this.panel) { resolve('cancel'); return; }
                this.deleteErrorResolve = resolve;
                const info = describeFileError(error);
                const code = (error as NodeJS.ErrnoException).code;
                const isMacPrivacy = os.platform() === 'darwin' && (code === 'EPERM' || code === 'EACCES');
                const buttons = isMacPrivacy
                    ? ['Manage privacy', 'Retry', 'Skip', 'Cancel']
                    : ['Retry', 'Skip', 'Cancel'];
                this.panel.confirmPopup.openWith({
                    title: info.title,
                    bodyLines: [info.message, errorFilePath],
                    buttons,
                    warning: true,
                    onConfirm: (btnIdx) => {
                        this.deleteErrorResolve = null;
                        if (isMacPrivacy) {
                            if (btnIdx === 0) {
                                vscode.env.openExternal(vscode.Uri.parse(
                                    'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders'
                                ));
                                resolve('retry');
                            } else if (btnIdx === 1) resolve('retry');
                            else if (btnIdx === 2) resolve('skip');
                            else resolve('cancel');
                        } else {
                            if (btnIdx === 0) resolve('retry');
                            else if (btnIdx === 1) resolve('skip');
                            else resolve('cancel');
                        }
                    },
                });
                this.writeEmitter.fire(this.panel.redraw());
            });
        };

        if (toTrash) {
            for (;;) {
                try {
                    await vscode.workspace.fs.delete(vscode.Uri.file(filePath), { recursive: true, useTrash: true });
                    break;
                } catch (e) {
                    const err = e instanceof Error ? e : new Error(String(e));
                    const action = await showDeleteError(filePath, err);
                    if (action === 'retry') continue;
                    break;
                }
            }
        } else {
            let lastRedraw = 0;
            const onProgress = async (currentPath: string, files: number, dirs: number): Promise<void> => {
                if (this.panel?.deleteProgressPopup.cancelled) {
                    throw new Error('delete_cancelled');
                }
                this.panel?.deleteProgressPopup.updateProgress(currentPath, files, dirs);
                const now = Date.now();
                if (now - lastRedraw >= 50) {
                    lastRedraw = now;
                    this.writeEmitter.fire(this.panel!.redraw());
                    await new Promise<void>(r => setTimeout(r, 0));
                }
            };
            const onError: DeleteErrorCallback = async (errorFilePath, error) => {
                return showDeleteError(errorFilePath, error);
            };
            try {
                await deleteRecursive(filePath, onProgress, onError);
            } catch {
                // cancelled or error — stop and refresh
            }
        }

        this.panel.deleteProgressPopup.close();
        this.refreshPanels();
    }

    private async makeDirectory(cwd: string, dirName: string, linkType: 'none' | 'symbolic' | 'junction', linkTarget: string, multipleNames: boolean): Promise<void> {
        const onError: MkdirErrorCallback = async (dirPath, error) => {
            return new Promise<MkdirErrorAction>((resolve) => {
                if (!this.panel) { resolve('cancel'); return; }
                this.mkdirErrorResolve = resolve;
                const info = describeFileError(error);
                const code = (error as NodeJS.ErrnoException).code;
                const isMacPrivacy = os.platform() === 'darwin' && (code === 'EPERM' || code === 'EACCES');
                const buttons = isMacPrivacy
                    ? ['Manage privacy', 'Retry', 'Skip', 'Cancel']
                    : ['Retry', 'Skip', 'Cancel'];
                this.panel.confirmPopup.openWith({
                    title: info.title,
                    bodyLines: [info.message, dirPath],
                    buttons,
                    warning: true,
                    onConfirm: (btnIdx) => {
                        this.mkdirErrorResolve = null;
                        if (isMacPrivacy) {
                            if (btnIdx === 0) {
                                vscode.env.openExternal(vscode.Uri.parse(
                                    'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders'
                                ));
                                resolve('retry');
                            } else if (btnIdx === 1) resolve('retry');
                            else if (btnIdx === 2) resolve('skip');
                            else resolve('cancel');
                        } else {
                            if (btnIdx === 0) resolve('retry');
                            else if (btnIdx === 1) resolve('skip');
                            else resolve('cancel');
                        }
                    },
                });
                this.writeEmitter.fire(this.panel.redraw());
            });
        };

        let lastName: string | undefined;
        try {
            lastName = await makeDirectories(cwd, dirName, linkType, linkTarget, multipleNames, onError);
        } catch {
            // mkdir_cancelled — stop and refresh
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
        await cfg.update('interceptF1', s.interceptF1, target);
        await cfg.update('panelColumns', s.panelColumns, target);
        const activePane = this.panel.activePaneObj;
        await cfg.update('sortMode', activePane.sortMode, target);
        await cfg.update('sortReversed', activePane.sortReversed, target);
        await cfg.update('sortDirsFirst', activePane.sortDirsFirst, target);
        await cfg.update('useSortGroups', s.useSortGroups, target);
        await cfg.update('keyHelp', s.keys.help, target);
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

    private async saveUserMenu(scope: MenuScope, items: UserMenuItem[]): Promise<void> {
        if (!this.panel) return;
        this.suppressConfigReload = true;
        const target = scope === 'user'
            ? vscode.ConfigurationTarget.Global
            : vscode.ConfigurationTarget.Workspace;
        const cfg = vscode.workspace.getConfiguration('vscommander');
        await cfg.update('userMenu', items.length > 0 ? items : undefined, target);
        if (scope === 'user') {
            this.panel.userMenuItems = items;
        } else {
            this.panel.workspaceMenuItems = items;
        }
        setTimeout(() => { this.suppressConfigReload = false; }, 100);
        this.writeEmitter.fire(this.panel.redraw());
    }

    private refreshPanels(): void {
        if (this.panel?.visible) {
            this.panel.left.refresh(this.panel.settings);
            this.panel.right.refresh(this.panel.settings);
            this.writeEmitter.fire(this.panel.redraw());
        }
    }
}

let activeTerminal: VSCommanderTerminal | undefined;
let activeVscodeTerminal: vscode.Terminal | undefined;

export function activate(context: vscode.ExtensionContext) {
    log.init();
    const initSettings = readSettings();
    log.info('activate', 'interceptF1=' + initSettings.interceptF1);
    vscode.commands.executeCommand('setContext', 'vscommander.interceptF1', initSettings.interceptF1);
    vscode.commands.executeCommand('setContext', 'vscommander.panelVisible', false);

    const openCmd = vscode.commands.registerCommand('vscommander.open', () => {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            || os.homedir();

        const pty = new VSCommanderTerminal(cwd, context.extensionPath);
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
                vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
            }
        });
        // Fallback if the event already fired before the listener was set up
        if (vscode.window.activeTerminal === terminal) {
            listener.dispose();
            vscode.commands.executeCommand('workbench.action.unlockEditorGroup');
            vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
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

    const terminalFocusListener = vscode.window.onDidChangeActiveTerminal((t) => {
        if (t && t === activeVscodeTerminal) {
            t.show(false);
        }
    });

    context.subscriptions.push(openCmd, toggleCmd, quickViewCmd, togglePaneCmd, sidebarTree, sidebarVisibility, terminalFocusListener);
}

export function deactivate() {
    activeTerminal = undefined;
    activeVscodeTerminal = undefined;
}
