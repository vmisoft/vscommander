import * as path from 'path';
import * as fs from 'fs';
import { ArchivePlugin, ArchiveHandle, ArchiveEntry, registerPlugin } from './archiveFs';

class RarHandle implements ArchiveHandle {
    readonly archivePath: string;
    readonly format = 'RAR';
    readonly entries: ArchiveEntry[];

    constructor(archivePath: string, entries: ArchiveEntry[]) {
        this.archivePath = archivePath;
        this.entries = entries;
    }

    async extractToFile(entryPath: string, destPath: string): Promise<void> {
        const destDir = path.dirname(destPath);
        fs.mkdirSync(destDir, { recursive: true });

        const { createExtractorFromData } = await import('node-unrar-js');
        const data = fs.readFileSync(this.archivePath);
        const extractor = await createExtractorFromData({
            data: data.buffer as ArrayBuffer,
        });
        const result = extractor.extract({ files: [entryPath] });

        for (const file of result.files) {
            if (file.extraction) {
                fs.writeFileSync(destPath, file.extraction);
                return;
            }
        }
        throw new Error('Failed to extract ' + entryPath);
    }

    async extractToDir(entryPaths: string[], destDir: string): Promise<void> {
        fs.mkdirSync(destDir, { recursive: true });

        const { createExtractorFromData } = await import('node-unrar-js');
        const data = fs.readFileSync(this.archivePath);
        const extractor = await createExtractorFromData({
            data: data.buffer as ArrayBuffer,
        });
        const result = extractor.extract({ files: entryPaths });

        for (const file of result.files) {
            if (file.extraction && file.fileHeader) {
                const relativePath = file.fileHeader.name.replace(/\\/g, '/');
                const destPath = path.join(destDir, ...relativePath.split('/'));
                const parentDir = path.dirname(destPath);
                fs.mkdirSync(parentDir, { recursive: true });
                fs.writeFileSync(destPath, file.extraction);
            }
        }
    }

    close(): void {
        // nothing to close
    }
}

class RarPlugin implements ArchivePlugin {
    readonly name = 'RAR';
    readonly extensions = ['.rar'];

    canOpen(filePath: string): boolean {
        return filePath.toLowerCase().endsWith('.rar');
    }

    async open(filePath: string): Promise<ArchiveHandle> {
        const { createExtractorFromFile } = await import('node-unrar-js');
        const extractor = await createExtractorFromFile({ filepath: filePath });
        const list = extractor.getFileList();

        const entries: ArchiveEntry[] = [];
        for (const header of list.fileHeaders) {
            let entryPath = header.name.replace(/\\/g, '/');
            if (entryPath.endsWith('/')) entryPath = entryPath.slice(0, -1);
            if (!entryPath) continue;
            entries.push({
                path: entryPath,
                isDir: header.flags.directory,
                size: header.unpSize,
                compressedSize: header.packSize,
                mtime: header.time ? new Date(header.time) : new Date(0),
            });
        }

        return new RarHandle(filePath, entries);
    }
}

registerPlugin(new RarPlugin());
