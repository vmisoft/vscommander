import * as path from 'path';
import * as fs from 'fs';

export function makeDirectories(
    cwd: string, dirName: string,
    linkType: 'none' | 'symbolic' | 'junction',
    linkTarget: string, multipleNames: boolean,
): string | undefined {
    const names = multipleNames
        ? dirName.split(';').map(n => n.trim()).filter(n => n.length > 0)
        : [dirName.trim()];
    let lastName: string | undefined;
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
    return lastName;
}

export type FileProgressCallback = (src: string, dst: string) => Promise<void>;
export type ByteProgressCallback = (bytesCopied: number, bytesTotal: number) => Promise<void>;
export type CopyErrorAction = 'retry' | 'skip' | 'cancel' | 'navigate';
export type CopyErrorCallback = (src: string, dst: string, error: Error) => Promise<CopyErrorAction>;

export type SymlinkPolicy = 'target' | 'no_change' | 'source' | 'ask';
export type SymlinkAskCallback = (symlinkPath: string, linkTarget: string) => Promise<SymlinkPolicy | 'cancel'>;

export interface ScanResult {
    files: number;
    dirs: number;
    bytes: number;
    internalSymlinks: number;
}

function isInsidePath(candidate: string, container: string): boolean {
    const resolvedCandidate = path.resolve(candidate);
    const resolvedContainer = path.resolve(container);
    if (process.platform === 'win32') {
        const lc = resolvedCandidate.toLowerCase();
        const lr = resolvedContainer.toLowerCase();
        return lc === lr || lc.startsWith(lr + path.sep);
    }
    return resolvedCandidate === resolvedContainer || resolvedCandidate.startsWith(resolvedContainer + path.sep);
}

function sameDrive(a: string, b: string): boolean {
    const rootA = path.parse(path.resolve(a)).root;
    const rootB = path.parse(path.resolve(b)).root;
    if (process.platform === 'win32') {
        return rootA.toLowerCase() === rootB.toLowerCase();
    }
    return rootA === rootB;
}

async function getSymlinkType(targetPath: string): Promise<'dir' | 'file'> {
    try {
        const st = await fs.promises.stat(targetPath);
        return st.isDirectory() ? 'dir' : 'file';
    } catch {
        return 'file';
    }
}

export type ScanProgressCallback = (
    currentPath: string, dirs: number, files: number, bytes: number,
) => Promise<void>;

export async function scanFiles(
    filePath: string,
    onProgress?: ScanProgressCallback,
): Promise<ScanResult> {
    const result: ScanResult = { files: 0, dirs: 0, bytes: 0, internalSymlinks: 0 };
    const lstat = await fs.promises.lstat(filePath);
    if (lstat.isSymbolicLink()) {
        result.files = 1;
        try {
            const target = await fs.promises.readlink(filePath);
            const resolved = path.resolve(path.dirname(filePath), target);
            if (isInsidePath(resolved, filePath)) {
                result.internalSymlinks = 1;
            }
        } catch {
            // can't read link — count as file
        }
        return result;
    }
    if (!lstat.isDirectory()) {
        result.files = 1;
        result.bytes = lstat.size;
        return result;
    }
    await scanDirRecursive(filePath, filePath, result, onProgress);
    return result;
}

async function scanDirRecursive(
    dirPath: string, rootSrc: string, result: ScanResult,
    onProgress?: ScanProgressCallback,
): Promise<void> {
    result.dirs++;
    if (onProgress) await onProgress(dirPath, result.dirs, result.files, result.bytes);
    let entries: fs.Dirent[];
    try {
        entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isSymbolicLink()) {
            result.files++;
            try {
                const target = await fs.promises.readlink(fullPath);
                const resolved = path.resolve(dirPath, target);
                if (isInsidePath(resolved, rootSrc)) {
                    result.internalSymlinks++;
                }
            } catch {
                // can't read link — count as file with 0 bytes
            }
        } else if (entry.isDirectory()) {
            await scanDirRecursive(fullPath, rootSrc, result, onProgress);
        } else if (entry.isFile()) {
            try {
                const st = await fs.promises.stat(fullPath);
                result.bytes += st.size;
            } catch {
                // skip files we can't stat
            }
            result.files++;
        }
        // skip special files (sockets, FIFOs, device nodes)
    }
}

async function isSameFile(a: string, b: string): Promise<boolean> {
    try {
        const realA = await fs.promises.realpath(a);
        const realB = await fs.promises.realpath(b);
        if (process.platform === 'win32') {
            if (realA.toLowerCase() === realB.toLowerCase()) return true;
        } else {
            if (realA === realB) return true;
        }
        const statA = await fs.promises.stat(a);
        const statB = await fs.promises.stat(b);
        return statA.dev === statB.dev && statA.ino === statB.ino;
    } catch {
        return false;
    }
}

async function deleteSourceWithRetry(
    src: string, isDir: boolean,
    onError?: CopyErrorCallback,
): Promise<void> {
    for (;;) {
        try {
            if (isDir) {
                await fs.promises.rm(src, { recursive: true, force: true });
            } else {
                await fs.promises.unlink(src);
            }
            return;
        } catch (e) {
            if (!onError) throw e;
            const err = e instanceof Error ? e : new Error(String(e));
            const action = await onError(src, src, err);
            if (action === 'retry') continue;
            if (action === 'skip') return;
            throwCopyAction(action, src);
        }
    }
}

export async function copyMoveOne(
    src: string, dst: string, isMove: boolean,
    overwrite: 'overwrite' | 'skip' | 'ask',
    askOverwrite: (name: string) => Promise<boolean>,
    speedTracker: CopySpeedTracker,
    onFileProgress?: FileProgressCallback,
    onByteProgress?: ByteProgressCallback,
    onError?: CopyErrorCallback,
    symlinkPolicy?: SymlinkPolicy,
    onSymlinkAsk?: SymlinkAskCallback,
): Promise<void> {
    let srcStat: fs.Stats;
    try {
        srcStat = await fs.promises.lstat(src);
    } catch (e) {
        if (!onError) throw e;
        const err = e instanceof Error ? e : new Error(String(e));
        const action = await onError(src, dst, err);
        if (action === 'retry') return copyMoveOne(src, dst, isMove, overwrite, askOverwrite, speedTracker, onFileProgress, onByteProgress, onError, symlinkPolicy, onSymlinkAsk);
        if (action === 'skip') return;
        throwCopyAction(action, src);
    }

    let dstPath = dst;

    try {
        const dstStat = await fs.promises.stat(dst);
        if (dstStat.isDirectory()) {
            dstPath = path.join(dst, path.basename(src));
        }
    } catch {
        // dst doesn't exist — use as-is
    }

    if (await isSameFile(src, dstPath)) {
        if (!onError) throw new Error('Cannot copy a file onto itself');
        const err = new Error('Cannot copy/move onto itself: ' + path.basename(src));
        const action = await onError(src, dstPath, err);
        if (action === 'retry') return copyMoveOne(src, dst, isMove, overwrite, askOverwrite, speedTracker, onFileProgress, onByteProgress, onError, symlinkPolicy, onSymlinkAsk);
        if (action === 'skip') return;
        throwCopyAction(action, src);
    }

    if (srcStat.isDirectory() && !srcStat.isSymbolicLink() && isInsidePath(path.resolve(dstPath), path.resolve(src))) {
        if (!onError) throw new Error('Cannot copy a directory into itself');
        const err = new Error('Cannot copy a directory into itself');
        const action = await onError(src, dstPath, err);
        if (action === 'retry') return copyMoveOne(src, dst, isMove, overwrite, askOverwrite, speedTracker, onFileProgress, onByteProgress, onError, symlinkPolicy, onSymlinkAsk);
        if (action === 'skip') return;
        throwCopyAction(action, src);
    }

    const exists = await fs.promises.access(dstPath).then(() => true, () => false);
    if (exists) {
        if (overwrite === 'skip') return;
        if (overwrite === 'ask') {
            const proceed = await askOverwrite(path.basename(dstPath));
            if (!proceed) return;
        }
    }

    if (isMove) {
        try {
            await fs.promises.rename(src, dstPath);
            return;
        } catch (e) {
            const code = (e as NodeJS.ErrnoException).code;
            if (code !== 'EXDEV') {
                if (!onError) throw e;
                const err = e instanceof Error ? e : new Error(String(e));
                const action = await onError(src, dstPath, err);
                if (action === 'retry') return copyMoveOne(src, dst, isMove, overwrite, askOverwrite, speedTracker, onFileProgress, onByteProgress, onError, symlinkPolicy, onSymlinkAsk);
                if (action === 'skip') return;
                throwCopyAction(action, src);
            }
            // EXDEV — fall through to copy+delete
        }
    }

    const policy = symlinkPolicy ?? 'target';

    if (srcStat.isSymbolicLink()) {
        const dstDir = path.dirname(dstPath);
        await fs.promises.mkdir(dstDir, { recursive: true });
        if (onFileProgress) await onFileProgress(src, dstPath);
        let effectivePolicy = policy;
        if (effectivePolicy === 'ask' && onSymlinkAsk) {
            let linkTarget = '';
            try { linkTarget = await fs.promises.readlink(src); } catch { /* use empty */ }
            const answer = await onSymlinkAsk(src, linkTarget);
            if (answer === 'cancel') throwCopyAction('cancel', src);
            effectivePolicy = answer;
        }
        await copySymlinkWithPolicy(src, dstPath, path.dirname(src), path.dirname(dstPath), effectivePolicy, onError);
        if (isMove) {
            await deleteSourceWithRetry(src, false, onError);
        }
    } else if (srcStat.isDirectory()) {
        await copyDirRecursive(src, dstPath, speedTracker, onFileProgress, onByteProgress, onError, src, dstPath, policy, onSymlinkAsk, overwrite, askOverwrite);
        if (isMove) {
            await deleteSourceWithRetry(src, true, onError);
        }
    } else {
        const dstDir = path.dirname(dstPath);
        await fs.promises.mkdir(dstDir, { recursive: true });
        if (onFileProgress) await onFileProgress(src, dstPath);
        await copyFileWithRetry(src, dstPath, srcStat.size, speedTracker, onByteProgress, onError);
        if (isMove) {
            await deleteSourceWithRetry(src, false, onError);
        }
    }
}

function throwCopyAction(action: CopyErrorAction, src: string): never {
    const e = new Error(action === 'navigate' ? 'copy_navigate' : 'copy_cancelled');
    (e as CopyActionError).navigatePath = action === 'navigate' ? src : undefined;
    throw e;
}

export interface CopyActionError extends Error {
    navigatePath?: string;
}

const COPY_BUF_SIZE = 64 * 1024;
const STREAMING_TIME_THRESHOLD_MS = 500;

export class CopySpeedTracker {
    private totalBytes = 0;
    private totalMs = 0;

    shouldStream(fileSize: number): boolean {
        if (this.totalMs === 0) return true;
        const estimatedMs = fileSize / (this.totalBytes / this.totalMs);
        return estimatedMs > STREAMING_TIME_THRESHOLD_MS;
    }

    record(bytes: number, ms: number): void {
        this.totalBytes += bytes;
        this.totalMs += ms;
    }
}

async function copyFileNative(src: string, dst: string): Promise<void> {
    await fs.promises.copyFile(src, dst);
    try {
        const stat = await fs.promises.stat(src);
        await fs.promises.utimes(dst, stat.atime, stat.mtime);
    } catch {
        // best-effort timestamp preservation
    }
}

async function copyFileStreaming(
    src: string, dst: string,
    onByteProgress?: ByteProgressCallback,
): Promise<void> {
    const srcHandle = await fs.promises.open(src, 'r');
    try {
        const stat = await srcHandle.stat();
        const total = stat.size;
        const dstHandle = await fs.promises.open(dst, 'w');
        try {
            const buf = Buffer.alloc(COPY_BUF_SIZE);
            let copied = 0;
            let lastReport = 0;
            for (;;) {
                const { bytesRead } = await srcHandle.read(buf, 0, COPY_BUF_SIZE);
                if (bytesRead === 0) break;
                await dstHandle.write(buf, 0, bytesRead);
                copied += bytesRead;
                if (onByteProgress) {
                    const now = Date.now();
                    if (now - lastReport >= 50 || copied >= total) {
                        lastReport = now;
                        await onByteProgress(copied, total);
                    }
                }
            }
            await dstHandle.close();
        } catch (e) {
            await dstHandle.close();
            throw e;
        }
        try {
            await fs.promises.chmod(dst, stat.mode);
        } catch {
            // best-effort permission preservation (FAT/exFAT/NTFS may not support)
        }
        try {
            await fs.promises.utimes(dst, stat.atime, stat.mtime);
        } catch {
            // best-effort timestamp preservation
        }
    } finally {
        await srcHandle.close();
    }
}

async function copyFileWithRetry(
    src: string, dst: string,
    srcSize: number,
    speedTracker: CopySpeedTracker,
    onByteProgress?: ByteProgressCallback,
    onError?: CopyErrorCallback,
): Promise<void> {
    for (;;) {
        try {
            const useStreaming = onByteProgress && speedTracker.shouldStream(srcSize);
            const start = Date.now();
            if (useStreaming) {
                await copyFileStreaming(src, dst, onByteProgress);
            } else {
                await copyFileNative(src, dst);
                if (onByteProgress) await onByteProgress(srcSize, srcSize);
            }
            speedTracker.record(srcSize, Math.max(1, Date.now() - start));
            return;
        } catch (e) {
            if (!onError) throw e;
            const err = e instanceof Error ? e : new Error(String(e));
            const action = await onError(src, dst, err);
            if (action === 'retry') continue;
            try { await fs.promises.unlink(dst); } catch { /* best-effort cleanup */ }
            if (action === 'skip') return;
            throwCopyAction(action, src);
        }
    }
}

async function copySymlinkWithPolicy(
    src: string, dst: string,
    rootSrc: string, rootDst: string,
    policy: SymlinkPolicy,
    onError?: CopyErrorCallback,
): Promise<void> {
    for (;;) {
        try {
            const linkValue = await fs.promises.readlink(src);
            const resolvedTarget = path.resolve(path.dirname(src), linkValue);
            const internal = isInsidePath(resolvedTarget, rootSrc);

            let newLinkValue: string;
            if (policy === 'no_change') {
                newLinkValue = linkValue;
            } else if (policy === 'source') {
                newLinkValue = internal ? resolvedTarget : linkValue;
            } else {
                // 'target' policy (default)
                if (internal) {
                    const relInTree = path.relative(rootSrc, resolvedTarget);
                    const remappedAbs = path.join(rootDst, relInTree);
                    if (path.isAbsolute(linkValue)) {
                        newLinkValue = remappedAbs;
                    } else {
                        newLinkValue = path.relative(path.dirname(dst), remappedAbs);
                    }
                } else {
                    if (path.isAbsolute(linkValue)) {
                        newLinkValue = linkValue;
                    } else if (sameDrive(src, dst)) {
                        newLinkValue = path.relative(path.dirname(dst), resolvedTarget);
                    } else {
                        newLinkValue = resolvedTarget;
                    }
                }
            }

            const type = await getSymlinkType(resolvedTarget);
            await fs.promises.symlink(newLinkValue, dst, type);
            return;
        } catch (e) {
            if (!onError) throw e;
            const err = e instanceof Error ? e : new Error(String(e));
            const action = await onError(src, dst, err);
            if (action === 'retry') continue;
            if (action === 'skip') return;
            throwCopyAction(action, src);
        }
    }
}

export async function copyDirRecursive(
    src: string, dst: string,
    speedTracker: CopySpeedTracker,
    onFileProgress?: FileProgressCallback,
    onByteProgress?: ByteProgressCallback,
    onError?: CopyErrorCallback,
    rootSrc?: string, rootDst?: string,
    symlinkPolicy?: SymlinkPolicy,
    onSymlinkAsk?: SymlinkAskCallback,
    overwrite?: 'overwrite' | 'skip' | 'ask',
    askOverwrite?: (name: string) => Promise<boolean>,
): Promise<void> {
    const effectiveRootSrc = rootSrc ?? src;
    const effectiveRootDst = rootDst ?? dst;
    const effectivePolicy = symlinkPolicy ?? 'target';
    const effectiveOverwrite = overwrite ?? 'overwrite';

    try {
        await fs.promises.mkdir(dst, { recursive: true });
    } catch (e) {
        if (!onError) throw e;
        const err = e instanceof Error ? e : new Error(String(e));
        const action = await onError(src, dst, err);
        if (action === 'retry') return copyDirRecursive(src, dst, speedTracker, onFileProgress, onByteProgress, onError, rootSrc, rootDst, symlinkPolicy, onSymlinkAsk, overwrite, askOverwrite);
        if (action === 'skip') return;
        throwCopyAction(action, src);
    }

    let entries: fs.Dirent[];
    try {
        entries = await fs.promises.readdir(src, { withFileTypes: true });
    } catch (e) {
        if (!onError) throw e;
        const err = e instanceof Error ? e : new Error(String(e));
        const action = await onError(src, dst, err);
        if (action === 'retry') return copyDirRecursive(src, dst, speedTracker, onFileProgress, onByteProgress, onError, rootSrc, rootDst, symlinkPolicy, onSymlinkAsk, overwrite, askOverwrite);
        if (action === 'skip') return;
        throwCopyAction(action, src);
    }

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const dstPath = path.join(dst, entry.name);
        if (entry.isSymbolicLink()) {
            const dstExists = await fs.promises.lstat(dstPath).then(() => true, () => false);
            if (dstExists) {
                if (effectiveOverwrite === 'skip') continue;
                if (effectiveOverwrite === 'ask' && askOverwrite) {
                    const proceed = await askOverwrite(entry.name);
                    if (!proceed) continue;
                }
                try { await fs.promises.unlink(dstPath); } catch { /* will fail in symlink creation */ }
            }
            if (onFileProgress) await onFileProgress(srcPath, dstPath);
            let policy = effectivePolicy;
            if (policy === 'ask' && onSymlinkAsk) {
                let linkTarget = '';
                try { linkTarget = await fs.promises.readlink(srcPath); } catch { /* use empty */ }
                const answer = await onSymlinkAsk(srcPath, linkTarget);
                if (answer === 'cancel') throwCopyAction('cancel', srcPath);
                policy = answer;
            }
            await copySymlinkWithPolicy(srcPath, dstPath, effectiveRootSrc, effectiveRootDst, policy, onError);
        } else if (entry.isDirectory()) {
            await copyDirRecursive(srcPath, dstPath, speedTracker, onFileProgress, onByteProgress, onError, effectiveRootSrc, effectiveRootDst, effectivePolicy, onSymlinkAsk, effectiveOverwrite, askOverwrite);
        } else if (!entry.isFile()) {
            // skip special files (sockets, FIFOs, device nodes)
            continue;
        } else {
            const dstExists = await fs.promises.access(dstPath).then(() => true, () => false);
            if (dstExists) {
                if (effectiveOverwrite === 'skip') continue;
                if (effectiveOverwrite === 'ask' && askOverwrite) {
                    const proceed = await askOverwrite(entry.name);
                    if (!proceed) continue;
                }
            }
            if (onFileProgress) await onFileProgress(srcPath, dstPath);
            let fileSize = 0;
            try {
                const st = await fs.promises.stat(srcPath);
                fileSize = st.size;
            } catch {
                // will fail in copyFileWithRetry and be handled there
            }
            await copyFileWithRetry(srcPath, dstPath, fileSize, speedTracker, onByteProgress, onError);
        }
    }
}
