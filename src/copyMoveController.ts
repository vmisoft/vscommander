import * as path from 'path';
import * as fs from 'fs';
import { Panel } from './panel';
import { CopyMoveResult } from './copyMovePopup';
import { copyMoveOne, scanFiles, CopyErrorAction, CopyActionError, CopySpeedTracker, ByteProgressCallback, SymlinkPolicy, SymlinkAskCallback, OverwriteResult } from './fileOps';
import { describeFileError } from './helpers';
import { OverwriteChoice, OverwriteInfo, OverwritePopupResult } from './overwritePopup';

export interface CopyMoveHost {
    fire(data: string): void;
    refreshPanels(): void;
}

export class CopyMoveController {
    private copyErrorResolve: ((action: CopyErrorAction) => void) | null = null;
    private symlinkResolve: ((value: SymlinkPolicy | 'cancel') => void) | null = null;
    private overwriteResolve: ((result: OverwriteResult) => void) | null = null;
    private rememberedChoice: OverwriteChoice | null = null;

    handleErrorDismiss(confirmPopupActive: boolean): void {
        if (this.symlinkResolve && !confirmPopupActive) {
            const resolve = this.symlinkResolve;
            this.symlinkResolve = null;
            resolve('cancel');
            return;
        }
        if (this.copyErrorResolve && !confirmPopupActive) {
            const resolve = this.copyErrorResolve;
            this.copyErrorResolve = null;
            resolve('cancel');
        }
    }

    handleOverwriteDismiss(overwritePopupActive: boolean): void {
        if (this.overwriteResolve && !overwritePopupActive) {
            const resolve = this.overwriteResolve;
            this.overwriteResolve = null;
            resolve({ action: 'cancel' });
        }
    }

    async execute(panel: Panel, result: CopyMoveResult, host: CopyMoveHost): Promise<void> {
        const { mode, targetPath, overwrite, sourceFiles, sourceCwd } = result;
        const targetDir = path.isAbsolute(targetPath)
            ? targetPath
            : path.resolve(sourceCwd, targetPath);

        const isMove = mode === 'move';
        const modeLabel = isMove ? 'move' : 'copy';

        this.rememberedChoice = null;

        panel.scanProgressPopup.openWith(modeLabel);
        host.fire(panel.redraw());

        let totalFiles = 0;
        let totalDirs = 0;
        let totalBytes = 0;
        let totalInternalSymlinks = 0;
        let scanLastRedraw = 0;
        let scanCancelled = false;
        for (const fileName of sourceFiles) {
            if (scanCancelled) break;
            const scanResult = await scanFiles(path.join(sourceCwd, fileName), async (currentPath, dirs, files, bytes) => {
                if (panel.scanProgressPopup.cancelled) {
                    scanCancelled = true;
                    throw new Error('scan_cancelled');
                }
                const now = Date.now();
                if (now - scanLastRedraw < 50) return;
                scanLastRedraw = now;
                panel.scanProgressPopup.updateScan(
                    currentPath, totalDirs + dirs, totalFiles + files, totalBytes + bytes);
                host.fire(panel.redraw());
                await new Promise<void>(r => setImmediate(r));
            }).catch(e => {
                if (e instanceof Error && e.message === 'scan_cancelled') return null;
                throw e;
            });
            if (!scanResult) break;
            totalFiles += scanResult.files;
            totalDirs += scanResult.dirs;
            totalBytes += scanResult.bytes;
            totalInternalSymlinks += scanResult.internalSymlinks;
        }

        panel.scanProgressPopup.close();

        if (scanCancelled) {
            host.refreshPanels();
            return;
        }

        let symlinkPolicy: SymlinkPolicy = 'target';
        if (totalInternalSymlinks > 0) {
            const policyResult = await new Promise<SymlinkPolicy | 'cancel'>((resolve) => {
                this.symlinkResolve = resolve;
                panel.confirmPopup.openWith({
                    title: 'Softlinks',
                    bodyLines: [
                        'How should the softlinks resolving',
                        'to the source location be processed?',
                    ],
                    buttons: ['Target', 'No change', 'Source', 'Ask'],
                    warning: false,
                    onConfirm: (btnIdx) => {
                        this.symlinkResolve = null;
                        const policies: SymlinkPolicy[] = ['target', 'no_change', 'source', 'ask'];
                        resolve(policies[btnIdx]);
                    },
                });
                host.fire(panel.redraw());
            });
            if (policyResult === 'cancel') {
                host.refreshPanels();
                return;
            }
            symlinkPolicy = policyResult;
        }

        let onSymlinkAsk: SymlinkAskCallback | undefined;
        if (symlinkPolicy === 'ask') {
            onSymlinkAsk = async (symlinkPath: string, linkTarget: string): Promise<SymlinkPolicy | 'cancel'> => {
                return new Promise<SymlinkPolicy | 'cancel'>((resolve) => {
                    this.symlinkResolve = resolve;
                    panel.confirmPopup.openWith({
                        title: 'Softlink',
                        bodyLines: [
                            symlinkPath,
                            '-> ' + linkTarget,
                        ],
                        buttons: ['Target', 'No change', 'Source', 'Cancel'],
                        warning: false,
                        onConfirm: (btnIdx) => {
                            this.symlinkResolve = null;
                            const policies: (SymlinkPolicy | 'cancel')[] = ['target', 'no_change', 'source', 'cancel'];
                            resolve(policies[btnIdx]);
                        },
                    });
                    host.fire(panel.redraw());
                });
            };
        }

        panel.copyProgressPopup.openWith(modeLabel, totalFiles, totalBytes);
        host.fire(panel.redraw());

        let filesDone = 0;
        let bytesDone = 0;
        let currentFileBytes = 0;
        let currentSrc = '';
        let currentDst = '';
        let lastRedraw = 0;

        const redrawIfNeeded = async (force: boolean): Promise<void> => {
            const now = Date.now();
            if (!force && now - lastRedraw < 50) return;
            lastRedraw = now;
            host.fire(panel.redraw());
            await new Promise<void>(r => setImmediate(r));
        };

        const onFileProgress = async (fileSrc: string, fileDst: string): Promise<void> => {
            const pauseAction = await panel.copyProgressPopup.checkPause();
            if (pauseAction) {
                if (pauseAction === 'skip') {
                    throw new Error('copy_interrupted_skip');
                } else if (pauseAction === 'navigate') {
                    const e = new Error('copy_navigate');
                    (e as CopyActionError).navigatePath = fileSrc;
                    throw e;
                } else if (pauseAction === 'cancel') {
                    throw new Error('copy_cancelled');
                }
                // 'continue' or 'retry' — continue normally
            }
            if (panel.copyProgressPopup.cancelled) {
                throw new Error('copy_cancelled');
            }
            bytesDone += currentFileBytes;
            currentFileBytes = 0;
            filesDone++;
            currentSrc = fileSrc;
            currentDst = fileDst;
            const totalPct = totalBytes > 0 ? Math.min(100, Math.floor(bytesDone * 100 / totalBytes)) : 0;
            panel.copyProgressPopup.updateProgress(fileSrc, fileDst, filesDone, totalFiles, bytesDone, totalBytes, 0, totalPct);
            await redrawIfNeeded(false);
        };

        const onByteProgress: ByteProgressCallback = async (bytesCopied: number, bytesFileTotal: number): Promise<void> => {
            const pauseAction = await panel.copyProgressPopup.checkPause();
            if (pauseAction) {
                if (pauseAction === 'continue') {
                    // resume copying the current file in place
                } else if (pauseAction === 'retry') {
                    throw new Error('copy_interrupted_retry');
                } else if (pauseAction === 'skip') {
                    throw new Error('copy_interrupted_skip');
                } else if (pauseAction === 'navigate') {
                    const e = new Error('copy_navigate');
                    (e as CopyActionError).navigatePath = currentSrc;
                    throw e;
                } else {
                    throw new Error('copy_cancelled');
                }
            }
            if (panel.copyProgressPopup.cancelled) {
                throw new Error('copy_cancelled');
            }
            currentFileBytes = bytesCopied;
            const currentPct = bytesFileTotal > 0 ? Math.min(100, Math.floor(bytesCopied * 100 / bytesFileTotal)) : 0;
            const totalPct = totalBytes > 0 ? Math.min(100, Math.floor((bytesDone + bytesCopied) * 100 / totalBytes)) : 0;
            panel.copyProgressPopup.updateProgress(currentSrc, currentDst, filesDone, totalFiles, bytesDone + bytesCopied, totalBytes, currentPct, totalPct);
            await redrawIfNeeded(false);
        };

        const onError = async (src: string, _dst: string, error: Error): Promise<CopyErrorAction> => {
            return new Promise<CopyErrorAction>((resolve) => {
                this.copyErrorResolve = resolve;
                const info = describeFileError(error);
                panel.confirmPopup.openWith({
                    title: info.title,
                    bodyLines: [
                        info.message,
                        src,
                    ],
                    buttons: ['Retry', 'Skip', 'Navigate', 'Cancel'],
                    warning: true,
                    onConfirm: (btnIdx) => {
                        this.copyErrorResolve = null;
                        if (btnIdx === 0) resolve('retry');
                        else if (btnIdx === 1) resolve('skip');
                        else if (btnIdx === 2) resolve('navigate');
                        else resolve('cancel');
                    },
                });
                host.fire(panel.redraw());
            });
        };

        const askOverwrite = async (srcPath: string, dstPath: string): Promise<OverwriteResult> => {
            // Stat both files
            let srcSize = 0, srcMtime = new Date(0);
            let dstSize = 0, dstMtime = new Date(0);
            let isDir = false;
            try {
                const srcStat = await fs.promises.stat(srcPath);
                srcSize = srcStat.size;
                srcMtime = srcStat.mtime;
                isDir = srcStat.isDirectory();
            } catch { /* use defaults */ }
            try {
                const dstStat = await fs.promises.stat(dstPath);
                dstSize = dstStat.size;
                dstMtime = dstStat.mtime;
                if (dstStat.isDirectory()) isDir = true;
            } catch { /* use defaults */ }

            // Handle remembered choice
            if (this.rememberedChoice) {
                return this.resolveChoice(this.rememberedChoice, srcPath, dstPath, srcSize, srcMtime, dstSize, dstMtime);
            }

            // Compute Rename (N)
            const { n: renameNValue, name: renameNName } = await computeRenameN(dstPath);

            const info: OverwriteInfo = {
                name: path.basename(dstPath),
                isDir,
                srcSize,
                srcDate: srcMtime,
                dstSize,
                dstDate: dstMtime,
                renameN: renameNValue,
                renameNName,
            };

            return new Promise<OverwriteResult>((resolve) => {
                this.overwriteResolve = resolve;
                panel.overwritePopup.openWith(info, (popupResult: OverwritePopupResult) => {
                    this.overwriteResolve = null;

                    if (popupResult.remember && popupResult.choice !== 'rename' && popupResult.choice !== 'cancel') {
                        this.rememberedChoice = popupResult.choice;
                    }

                    resolve(this.resolvePopupResult(popupResult, srcPath, dstPath, srcSize, srcMtime, dstSize, dstMtime, renameNName));
                });
                host.fire(panel.redraw());
            });
        };

        panel.copyProgressPopup.updateProgress('', '', 0, totalFiles, 0, totalBytes, 0, 0);
        host.fire(panel.redraw());

        const speedTracker = new CopySpeedTracker();

        for (const fileName of sourceFiles) {
            if (panel.copyProgressPopup.cancelled) break;
            const src = path.join(sourceCwd, fileName);
            const dst = sourceFiles.length === 1 && !targetPath.endsWith(path.sep)
                ? targetDir
                : path.join(targetDir, fileName);
            try {
                await copyMoveOne(src, dst, isMove, overwrite, askOverwrite, speedTracker, onFileProgress, onByteProgress, onError, symlinkPolicy, onSymlinkAsk);
            } catch (e) {
                if (e instanceof Error && e.message === 'copy_navigate') {
                    const navPath = (e as CopyActionError).navigatePath;
                    if (navPath) {
                        panel.copyProgressPopup.close();
                        const dir = path.dirname(navPath);
                        const name = path.basename(navPath);
                        const pane = panel.activePaneObj;
                        pane.cwd = dir;
                        pane.refresh(panel.settings);
                        const idx = pane.entries.findIndex(entry => entry.name === name);
                        if (idx >= 0) pane.cursor = idx;
                    }
                    host.refreshPanels();
                    return;
                }
                if (e instanceof Error && e.message === 'copy_cancelled') break;
            }
        }

        panel.copyProgressPopup.close();
        panel.activePaneObj.clearSelection();
        host.refreshPanels();
    }

    private resolvePopupResult(
        popupResult: OverwritePopupResult,
        srcPath: string, dstPath: string,
        srcSize: number, srcMtime: Date,
        dstSize: number, dstMtime: Date,
        renameNName: string,
    ): OverwriteResult {
        switch (popupResult.choice) {
            case 'overwrite':
                return { action: 'overwrite' };
            case 'skip':
                return { action: 'skip' };
            case 'cancel':
                return { action: 'cancel' };
            case 'rename':
                return { action: 'rename', newName: popupResult.renameName };
            case 'rename_n':
                return { action: 'rename', newName: popupResult.renameName || renameNName };
            case 'append':
                return { action: 'append' };
            case 'keep_largest':
                return { action: srcSize >= dstSize ? 'overwrite' : 'skip' };
            case 'keep_newest':
                return { action: srcMtime >= dstMtime ? 'overwrite' : 'skip' };
        }
    }

    private async resolveChoice(
        choice: OverwriteChoice,
        srcPath: string, dstPath: string,
        srcSize: number, srcMtime: Date,
        dstSize: number, dstMtime: Date,
    ): Promise<OverwriteResult> {
        switch (choice) {
            case 'overwrite':
                return { action: 'overwrite' };
            case 'skip':
                return { action: 'skip' };
            case 'append':
                return { action: 'append' };
            case 'keep_largest':
                return { action: srcSize >= dstSize ? 'overwrite' : 'skip' };
            case 'keep_newest':
                return { action: srcMtime >= dstMtime ? 'overwrite' : 'skip' };
            case 'rename_n': {
                const { n: _, name: nName } = await computeRenameN(dstPath);
                return { action: 'rename', newName: nName };
            }
            default:
                return { action: 'cancel' };
        }
    }
}

async function computeRenameN(dstPath: string): Promise<{ n: number; name: string }> {
    const dir = path.dirname(dstPath);
    const ext = path.extname(dstPath);
    const base = path.basename(dstPath, ext);

    for (let n = 1; ; n++) {
        const newName = base + ' (' + n + ')' + ext;
        const newPath = path.join(dir, newName);
        const exists = await fs.promises.access(newPath).then(() => true, () => false);
        if (!exists) return { n, name: newName };
    }
}
