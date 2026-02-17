import { Theme } from './settings';
import type { ArchiveHandle } from './archiveFs';

export type SortMode = 'name' | 'extension' | 'size' | 'date' | 'unsorted'
    | 'creationTime' | 'accessTime' | 'changeTime' | 'description'
    | 'owner' | 'allocatedSize' | 'hardLinks' | 'streams' | 'streamSize';

export interface DriveEntry {
    label: string;
    description: string;
    totalSize: number;
    freeSpace: number;
    path: string;
    group: 'location' | 'drive' | 'home' | 'workspace';
}

export interface DirEntry {
    name: string;
    isDir: boolean;
    isSymlink: boolean;
    linkTarget: string;
    size: number;
    mtime: Date;
    atime?: Date;
    ctime?: Date;
    birthtime?: Date;
    nlink?: number;
    blocks?: number;
    uid?: number;
    streamCount?: number;
    streamTotalSize?: number;
    description?: string;
}

export interface PaneState {
    cwd: string;
    sortMode: SortMode;
    sortReversed: boolean;
    sortDirsFirst: boolean;
    colCount: number;
    archiveHandle: ArchiveHandle | null;
    archiveDir: string;
    isVirtual: boolean;
}

export interface PaneGeometry {
    startCol: number;
    width: number;
    innerStart: number;
    innerWidth: number;
    numCols: number;
    colStarts: number[];
    colWidths: number[];
    dividerCols: number[];
}

export interface Layout {
    topRow: number;
    headerRow: number;
    listStart: number;
    listHeight: number;
    separatorRow: number;
    infoRow: number;
    bottomRow: number;
    cmdRow: number;
    fkeyRow: number;
    leftPane: PaneGeometry;
    rightPane: PaneGeometry;
}

export interface PaneStats {
    totalBytes: number;
    fileCount: number;
    dirCount: number;
}

export interface PaneRenderContext {
    geo: PaneGeometry;
    layout: Layout;
    theme: Theme;
    isActive: boolean;
    showClock: boolean;
    selected?: Set<string>;
}
