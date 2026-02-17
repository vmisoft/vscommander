import * as path from 'path';
import * as fs from 'fs';
import { ArchivePlugin, ArchiveHandle, ArchiveEntry, registerPlugin } from './archiveFs';

type SevenZipModule = {
    FS: {
        mkdir(path: string): void;
        mount(type: any, opts: any, mountpoint: string): void;
        writeFile(path: string, data: Uint8Array): void;
        readFile(path: string): Uint8Array;
        readdir(path: string): string[];
        stat(path: string): { mode: number };
        isDir(mode: number): boolean;
    };
    NODEFS: any;
    callMain(args: string[]): void;
};

type SevenZipFactory = (opts?: Record<string, any>) => Promise<SevenZipModule>;

let cachedFactory: SevenZipFactory | null = null;

async function getFactory(): Promise<SevenZipFactory> {
    if (!cachedFactory) {
        const mod = await import('7z-wasm');
        cachedFactory = (mod as any).default as SevenZipFactory;
    }
    return cachedFactory;
}

function parseListOutput(stdout: string): ArchiveEntry[] {
    const entries: ArchiveEntry[] = [];
    const lines = stdout.split('\n');
    let inEntries = false;
    let currentProps: Record<string, string> = {};

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '----------') {
            inEntries = true;
            continue;
        }
        if (!inEntries) continue;

        if (trimmed === '') {
            if (currentProps['Path']) {
                const attrs = currentProps['Attributes'] || '';
                const isDir = attrs.includes('D') || currentProps['Folder'] === '+';
                entries.push({
                    path: currentProps['Path'].replace(/\\/g, '/'),
                    isDir,
                    size: parseInt(currentProps['Size'] || '0', 10) || 0,
                    compressedSize: parseInt(currentProps['Packed Size'] || '0', 10) || 0,
                    mtime: currentProps['Modified'] ? new Date(currentProps['Modified']) : new Date(0),
                });
            }
            currentProps = {};
            continue;
        }

        const eqIdx = trimmed.indexOf(' = ');
        if (eqIdx >= 0) {
            currentProps[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 3);
        }
    }

    if (currentProps['Path']) {
        const attrs = currentProps['Attributes'] || '';
        const isDir = attrs.includes('D') || currentProps['Folder'] === '+';
        entries.push({
            path: currentProps['Path'].replace(/\\/g, '/'),
            isDir,
            size: parseInt(currentProps['Size'] || '0', 10) || 0,
            compressedSize: parseInt(currentProps['Packed Size'] || '0', 10) || 0,
            mtime: currentProps['Modified'] ? new Date(currentProps['Modified']) : new Date(0),
        });
    }

    return entries;
}

async function createModule(stdoutLines?: string[]): Promise<SevenZipModule> {
    const factory = await getFactory();
    return await factory({
        print: (str: string) => { if (stdoutLines) stdoutLines.push(str); },
        printErr: () => {},
    });
}

class SevenZipHandle implements ArchiveHandle {
    readonly archivePath: string;
    readonly format = '7Z';
    readonly entries: ArchiveEntry[];

    constructor(archivePath: string, entries: ArchiveEntry[]) {
        this.archivePath = archivePath;
        this.entries = entries;
    }

    async extractToFile(entryPath: string, destPath: string): Promise<void> {
        const destDir = path.dirname(destPath);
        fs.mkdirSync(destDir, { recursive: true });

        const module = await createModule();
        const archiveDir = path.dirname(this.archivePath);
        const archiveName = path.basename(this.archivePath);

        module.FS.mkdir('/src');
        module.FS.mount(module.NODEFS, { root: archiveDir }, '/src');
        module.FS.mkdir('/out');

        try {
            module.callMain(['x', '/src/' + archiveName, '-o/out', '-y', '--', entryPath]);
        } catch (e: any) {
            if (!e || e.status !== 0) {
                // non-zero exit may still have extracted the file
            }
        }

        const virtualPath = '/out/' + entryPath.replace(/\\/g, '/');
        try {
            const data = module.FS.readFile(virtualPath);
            fs.writeFileSync(destPath, Buffer.from(data));
        } catch {
            throw new Error('Failed to extract ' + entryPath);
        }
    }

    async extractToDir(entryPaths: string[], destDir: string): Promise<void> {
        fs.mkdirSync(destDir, { recursive: true });

        const module = await createModule();
        const archiveParent = path.dirname(this.archivePath);
        const archiveName = path.basename(this.archivePath);

        module.FS.mkdir('/src');
        module.FS.mount(module.NODEFS, { root: archiveParent }, '/src');
        module.FS.mkdir('/dst');
        module.FS.mount(module.NODEFS, { root: destDir }, '/dst');

        try {
            module.callMain(['x', '/src/' + archiveName, '-o/dst', '-y', '--', ...entryPaths]);
        } catch {
            // non-zero exit is common for warnings
        }
    }

    async deleteEntries(entryPaths: string[]): Promise<void> {
        const module = await createModule();
        const archiveParent = path.dirname(this.archivePath);
        const archiveName = path.basename(this.archivePath);

        module.FS.mkdir('/arc');
        module.FS.mount(module.NODEFS, { root: archiveParent }, '/arc');

        try {
            module.callMain(['d', '/arc/' + archiveName, '-y', '--', ...entryPaths]);
        } catch {
            // non-zero exit is common for warnings
        }
    }

    async mkdirEntry(dirPath: string): Promise<void> {
        const os = await import('os');
        const tmpBase = path.join(os.tmpdir(), 'vscommander-7z-mkdir-' + Date.now());
        const newDir = path.join(tmpBase, ...dirPath.split('/'));
        fs.mkdirSync(newDir, { recursive: true });

        const module = await createModule();
        const archiveParent = path.dirname(this.archivePath);
        const archiveName = path.basename(this.archivePath);

        module.FS.mkdir('/arc');
        module.FS.mount(module.NODEFS, { root: archiveParent }, '/arc');
        module.FS.mkdir('/tmp');
        module.FS.mount(module.NODEFS, { root: tmpBase }, '/tmp');

        try {
            module.callMain(['a', '/arc/' + archiveName, '-y', '/tmp/' + dirPath.split('/')[0] + '/']);
        } catch {
            // non-zero exit is common
        }

        fs.rmSync(tmpBase, { recursive: true, force: true });
    }

    close(): void {
        // nothing to close
    }
}

class SevenZipPlugin implements ArchivePlugin {
    readonly name = '7Z';
    readonly extensions = ['.7z'];

    canOpen(filePath: string): boolean {
        return filePath.toLowerCase().endsWith('.7z');
    }

    async open(filePath: string): Promise<ArchiveHandle> {
        const stdoutLines: string[] = [];
        const module = await createModule(stdoutLines);

        const archiveDir = path.dirname(filePath);
        const archiveName = path.basename(filePath);

        module.FS.mkdir('/src');
        module.FS.mount(module.NODEFS, { root: archiveDir }, '/src');

        try {
            module.callMain(['l', '-slt', '/src/' + archiveName]);
        } catch {
            // ExitStatus is expected
        }

        const entries = parseListOutput(stdoutLines.join('\n'));
        return new SevenZipHandle(filePath, entries);
    }
}

registerPlugin(new SevenZipPlugin());
