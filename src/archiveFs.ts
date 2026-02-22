import { DirEntry, SortMode } from './types';
import { Pane } from './pane';

export interface ArchiveEntry {
    path: string;
    isDir: boolean;
    size: number;
    compressedSize?: number;
    mtime: Date;
}

export interface ArchiveHandle {
    readonly archivePath: string;
    readonly format: string;
    readonly entries: ArchiveEntry[];
    extractToFile(entryPath: string, destPath: string): Promise<void>;
    extractToDir(entryPaths: string[], destDir: string): Promise<void>;
    addEntries?(sourcePaths: string[], archiveDir: string): Promise<void>;
    deleteEntries?(entryPaths: string[]): Promise<void>;
    mkdirEntry?(dirPath: string): Promise<void>;
    close(): void;
}

export interface ArchivePlugin {
    readonly name: string;
    readonly extensions: string[];
    canOpen(filePath: string): boolean;
    open(filePath: string): Promise<ArchiveHandle>;
}

const pluginRegistry: ArchivePlugin[] = [];

export function registerPlugin(plugin: ArchivePlugin): void {
    pluginRegistry.push(plugin);
}

const ARCHIVE_EXTENSIONS = [
    '.zip', '.jar', '.war', '.ear', '.apk',
    '.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '.tar.xz', '.txz', '.tar',
    '.7z',
    '.rar',
];

export function isArchiveFile(name: string): boolean {
    const lower = name.toLowerCase();
    for (const ext of ARCHIVE_EXTENSIONS) {
        if (lower.endsWith(ext)) return true;
    }
    return false;
}

export async function openArchive(filePath: string): Promise<ArchiveHandle | undefined> {
    for (const plugin of pluginRegistry) {
        if (plugin.canOpen(filePath)) {
            try {
                return await plugin.open(filePath);
            } catch {
                continue;
            }
        }
    }
    return undefined;
}

export function filterArchiveDir(
    allEntries: ArchiveEntry[],
    virtualDir: string,
    sortMode: SortMode,
    sortReversed: boolean,
    sortDirsFirst: boolean,
): DirEntry[] {
    const prefix = virtualDir ? virtualDir + '/' : '';
    const dirsSeen = new Set<string>();
    const result: DirEntry[] = [];

    result.push({
        name: '..', isDir: true, isSymlink: false, linkTarget: '', size: 0, mtime: new Date(0),
    });

    for (const entry of allEntries) {
        let entryPath = entry.path;
        if (entryPath.endsWith('/')) entryPath = entryPath.slice(0, -1);
        if (!entryPath) continue;

        if (prefix && !entryPath.startsWith(prefix)) continue;
        if (!prefix && entryPath.includes('/') && !entry.isDir) {
            const firstSlash = entryPath.indexOf('/');
            const dirName = entryPath.slice(0, firstSlash);
            if (!dirsSeen.has(dirName)) {
                dirsSeen.add(dirName);
                result.push({
                    name: dirName, isDir: true, isSymlink: false, linkTarget: '',
                    size: 0, mtime: new Date(0),
                });
            }
            continue;
        }

        const remainder = prefix ? entryPath.slice(prefix.length) : entryPath;
        if (!remainder) continue;

        const slashIdx = remainder.indexOf('/');
        if (slashIdx < 0) {
            result.push({
                name: remainder,
                isDir: entry.isDir,
                isSymlink: false,
                linkTarget: '',
                size: entry.size,
                mtime: entry.mtime,
            });
        } else {
            const dirName = remainder.slice(0, slashIdx);
            if (!dirsSeen.has(dirName)) {
                dirsSeen.add(dirName);
                result.push({
                    name: dirName, isDir: true, isSymlink: false, linkTarget: '',
                    size: 0, mtime: new Date(0),
                });
            }
        }
    }

    Pane.sortEntries(result, sortMode, sortDirsFirst, sortReversed);
    return result;
}
