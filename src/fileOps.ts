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

export async function copyMoveOne(
    src: string, dst: string, isMove: boolean,
    overwrite: 'overwrite' | 'skip' | 'ask',
    askOverwrite: (name: string) => Promise<boolean>,
): Promise<void> {
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
            const proceed = await askOverwrite(path.basename(dstPath));
            if (!proceed) return;
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
        await copyDirRecursive(src, dstPath);
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

export async function copyDirRecursive(src: string, dst: string): Promise<void> {
    await fs.promises.mkdir(dst, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const dstPath = path.join(dst, entry.name);
        if (entry.isDirectory()) {
            await copyDirRecursive(srcPath, dstPath);
        } else {
            await fs.promises.copyFile(srcPath, dstPath);
        }
    }
}
