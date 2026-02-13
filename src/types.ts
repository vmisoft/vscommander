import { Theme } from './settings';

export type SortMode = 'name' | 'extension' | 'size' | 'date' | 'unsorted';

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
    size: number;
    mtime: Date;
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
