import * as path from 'path';
import * as fs from 'fs';
import * as tar from 'tar';
import { ArchivePlugin, ArchiveHandle, ArchiveEntry, registerPlugin } from './archiveFs';

class TarHandle implements ArchiveHandle {
    readonly archivePath: string;
    readonly format = 'TAR';
    readonly entries: ArchiveEntry[];

    constructor(filePath: string) {
        this.archivePath = filePath;
        this.entries = [];
        tar.list({
            file: filePath,
            sync: true,
            onReadEntry: (entry: tar.ReadEntry) => {
                let entryPath = entry.path.replace(/\\/g, '/');
                if (entryPath.endsWith('/')) entryPath = entryPath.slice(0, -1);
                if (!entryPath) return;
                this.entries.push({
                    path: entryPath,
                    isDir: entry.type === 'Directory',
                    size: entry.size ?? 0,
                    mtime: entry.mtime ?? new Date(0),
                });
            },
        });
    }

    async extractToFile(entryPath: string, destPath: string): Promise<void> {
        const destDir = path.dirname(destPath);
        fs.mkdirSync(destDir, { recursive: true });
        const stripCount = entryPath.split('/').length - 1;
        const baseName = path.basename(entryPath);
        await tar.extract({
            file: this.archivePath,
            cwd: destDir,
            strip: stripCount,
            filter: (p: string) => {
                const normalized = p.replace(/\\/g, '/').replace(/\/$/, '');
                return normalized === entryPath;
            },
        });
        const extracted = path.join(destDir, baseName);
        if (extracted !== destPath && fs.existsSync(extracted)) {
            fs.renameSync(extracted, destPath);
        }
    }

    async extractToDir(entryPaths: string[], destDir: string): Promise<void> {
        fs.mkdirSync(destDir, { recursive: true });
        const pathSet = new Set(entryPaths);
        await tar.extract({
            file: this.archivePath,
            cwd: destDir,
            filter: (p: string) => {
                const normalized = p.replace(/\\/g, '/').replace(/\/$/, '');
                return pathSet.has(normalized);
            },
        });
    }

    close(): void {
        // no-op
    }
}

class TarPlugin implements ArchivePlugin {
    readonly name = 'TAR';
    readonly extensions = ['.tar', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '.tar.xz', '.txz'];

    canOpen(filePath: string): boolean {
        const lower = filePath.toLowerCase();
        return this.extensions.some(ext => lower.endsWith(ext));
    }

    async open(filePath: string): Promise<ArchiveHandle> {
        return new TarHandle(filePath);
    }
}

registerPlugin(new TarPlugin());
