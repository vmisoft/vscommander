import * as path from 'path';
import * as fs from 'fs';
import AdmZip = require('adm-zip');
import { ArchivePlugin, ArchiveHandle, ArchiveEntry, registerPlugin } from './archiveFs';

class ZipHandle implements ArchiveHandle {
    readonly archivePath: string;
    readonly format = 'ZIP';
    readonly entries: ArchiveEntry[];
    private zip: AdmZip;

    constructor(filePath: string) {
        this.archivePath = filePath;
        this.zip = new AdmZip(filePath);
        const zipEntries = this.zip.getEntries();
        this.entries = [];
        for (const e of zipEntries) {
            const entryPath = e.entryName.replace(/\\/g, '/');
            if (!entryPath || entryPath === '/') continue;
            this.entries.push({
                path: entryPath.endsWith('/') ? entryPath.slice(0, -1) : entryPath,
                isDir: e.isDirectory,
                size: e.header.size,
                compressedSize: e.header.compressedSize,
                mtime: e.header.time ? new Date(e.header.time) : new Date(0),
            });
        }
    }

    async extractToFile(entryPath: string, destPath: string): Promise<void> {
        const destDir = path.dirname(destPath);
        fs.mkdirSync(destDir, { recursive: true });
        const zipEntry = this.zip.getEntries().find(e => {
            const p = e.entryName.replace(/\\/g, '/');
            return p === entryPath || p === entryPath + '/';
        });
        if (zipEntry) {
            fs.writeFileSync(destPath, zipEntry.getData());
        }
    }

    async extractToDir(entryPaths: string[], destDir: string): Promise<void> {
        fs.mkdirSync(destDir, { recursive: true });
        for (const ep of entryPaths) {
            const zipEntry = this.zip.getEntries().find(e => {
                const p = e.entryName.replace(/\\/g, '/');
                return p === ep || p === ep + '/';
            });
            if (zipEntry && !zipEntry.isDirectory) {
                const dest = path.join(destDir, path.basename(ep));
                fs.writeFileSync(dest, zipEntry.getData());
            }
        }
    }

    async addEntries(sourcePaths: string[], archiveDir: string): Promise<void> {
        for (const src of sourcePaths) {
            const stat = fs.statSync(src);
            const targetPath = archiveDir ? archiveDir + '/' + path.basename(src) : path.basename(src);
            if (stat.isDirectory()) {
                this.zip.addLocalFolder(src, targetPath);
            } else {
                this.zip.addLocalFile(src, archiveDir || '');
            }
        }
        this.zip.writeZip(this.archivePath);
    }

    async deleteEntries(entryPaths: string[]): Promise<void> {
        for (const ep of entryPaths) {
            const zipEntry = this.zip.getEntries().find(e => {
                const p = e.entryName.replace(/\\/g, '/');
                return p === ep || p === ep + '/';
            });
            if (zipEntry) {
                this.zip.deleteFile(zipEntry);
            }
        }
        this.zip.writeZip(this.archivePath);
    }

    async mkdirEntry(dirPath: string): Promise<void> {
        const entryName = dirPath.endsWith('/') ? dirPath : dirPath + '/';
        this.zip.addFile(entryName, Buffer.alloc(0));
        this.zip.writeZip(this.archivePath);
    }

    close(): void {
        // adm-zip is stateless after load
    }
}

class ZipPlugin implements ArchivePlugin {
    readonly name = 'ZIP';
    readonly extensions = ['.zip', '.jar', '.war', '.ear', '.apk'];

    canOpen(filePath: string): boolean {
        const lower = filePath.toLowerCase();
        return this.extensions.some(ext => lower.endsWith(ext));
    }

    async open(filePath: string): Promise<ArchiveHandle> {
        return new ZipHandle(filePath);
    }
}

registerPlugin(new ZipPlugin());
