import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Theme, PanelSettings } from './settings';
import { DriveEntry } from './types';
import { Popup, PopupInputResult } from './popup';
import { formatSizeHuman } from './helpers';
import { PopupTable, PopupTableStyles, TableSection, TableRow } from './popupTable';
import { FrameBuffer } from './frameBuffer';

const VIRTUAL_FS_TYPES = new Set([
    'tmpfs', 'devtmpfs', 'proc', 'sysfs', 'devpts', 'securityfs',
    'debugfs', 'cgroup', 'cgroup2', 'pstore', 'bpf', 'tracefs',
    'hugetlbfs', 'mqueue', 'fusectl', 'configfs', 'ramfs',
    'efivarfs', 'binfmt_misc', 'autofs', 'nsfs', 'overlay', 'squashfs',
]);

const FILTERED_MOUNT_PREFIXES = ['/snap/', '/run/', '/sys/', '/proc/'];

export class DrivePopup extends Popup {
    targetPane: 'left' | 'right' = 'left';
    entries: DriveEntry[] = [];
    cursor = 0;
    override padding = 0;
    private separatorIndex = -1;
    private savedCursor: Record<string, number> = {};

    constructor() {
        super();
    }

    open(target?: 'left' | 'right', settings?: PanelSettings, paneCwd?: string): void {
        if (!target || !settings) return;
        const entries = DrivePopup.buildEntries(settings.workspaceDirs);
        if (entries.length === 0) return;
        super.open();
        this.targetPane = target;
        let locationDesc = 'N/A';
        let locationPath = '';
        if (paneCwd) {
            try {
                const stat = fs.statSync(paneCwd);
                if (stat.isDirectory()) {
                    locationDesc = path.basename(paneCwd) || paneCwd;
                    locationPath = paneCwd;
                }
            } catch {
                locationDesc = paneCwd;
            }
        }
        const otherSide = target === 'left' ? 'Right' : 'Left';
        const locationEntry: DriveEntry = {
            label: otherSide + ' panel location',
            description: locationDesc,
            totalSize: 0,
            freeSpace: 0,
            path: locationPath,
            group: 'location',
        };
        this.entries = [...entries, locationEntry];
        const saved = this.savedCursor[target];
        this.cursor = (saved !== undefined && saved < this.entries.length) ? saved : 0;
        this.separatorIndex = this.entries.findIndex(e => e.group === 'workspace');
    }

    close(): void {
        this.savedCursor[this.targetPane] = this.cursor;
        super.close();
    }

    handleInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === '\r') {
            return this.closeWithConfirm();
        }

        if (data === '\x1b[A' || data === '\x1b[D') {
            if (this.cursor > 0) this.cursor--;
            return { action: 'consumed' };
        }

        if (data === '\x1b[B' || data === '\x1b[C') {
            if (this.cursor < this.entries.length - 1) this.cursor++;
            return { action: 'consumed' };
        }

        if (data === '\x1b[H' || data === '\x1b[1~') {
            this.cursor = 0;
            return { action: 'consumed' };
        }

        if (data === '\x1b[F' || data === '\x1b[4~') {
            this.cursor = Math.max(0, this.entries.length - 1);
            return { action: 'consumed' };
        }

        if (data === '\x1b[5~') {
            this.cursor = 0;
            return { action: 'consumed' };
        }

        if (data === '\x1b[6~') {
            this.cursor = Math.max(0, this.entries.length - 1);
            return { action: 'consumed' };
        }

        if (data.length === 1) {
            const ch = data;

            if (ch === '`') {
                const locIdx = this.entries.findIndex(e => e.group === 'location');
                if (locIdx >= 0 && this.entries[locIdx].path) {
                    this.cursor = locIdx;
                    return this.closeWithConfirm();
                }
                return { action: 'consumed' };
            }

            if (os.platform() === 'win32') {
                const lower = ch.toLowerCase();
                if (lower >= 'a' && lower <= 'z') {
                    const driveIdx = this.entries.findIndex(
                        e => e.group === 'drive' && e.label.toLowerCase().startsWith(lower),
                    );
                    if (driveIdx >= 0) {
                        this.cursor = driveIdx;
                        return this.closeWithConfirm();
                    }
                }
            }

            const globalIdx = DrivePopup.prefixToIndex(ch);
            if (globalIdx >= 0) {
                const driveEntries = this.entries.filter(e => e.group === 'drive');
                const homeEntries = this.entries.filter(e => e.group === 'home');
                const workspaceEntries = this.entries.filter(e => e.group === 'workspace');

                let target: DriveEntry | undefined;
                if (globalIdx < driveEntries.length) {
                    target = driveEntries[globalIdx];
                } else if (globalIdx < driveEntries.length + homeEntries.length) {
                    target = homeEntries[globalIdx - driveEntries.length];
                } else if (globalIdx < driveEntries.length + homeEntries.length + workspaceEntries.length) {
                    target = workspaceEntries[globalIdx - driveEntries.length - homeEntries.length];
                }

                if (target) {
                    this.cursor = this.entries.indexOf(target);
                    return this.closeWithConfirm();
                }
                return { action: 'consumed' };
            }
        }

        return { action: 'consumed' };
    }

    override handleMouseScroll(up: boolean): PopupInputResult {
        if (up && this.cursor > 0) {
            this.cursor--;
        } else if (!up && this.cursor < this.entries.length - 1) {
            this.cursor++;
        }
        return { action: 'consumed' };
    }

    protected override onMouseDown(fbRow: number, _fbCol: number): PopupInputResult | null {
        const groups = this.getGroupedEntries();
        let contentRow = 2;
        let entryIdx = 0;
        for (let si = 0; si < groups.length; si++) {
            if (si > 0) contentRow++;
            for (let ri = 0; ri < groups[si].length; ri++) {
                if (fbRow === contentRow) {
                    this.cursor = entryIdx;
                    return { action: 'consumed' };
                }
                contentRow++;
                entryIdx++;
            }
        }
        return null;
    }

    private getGroupedEntries(): DriveEntry[][] {
        const locations = this.entries.filter(e => e.group === 'location');
        const drives = this.entries.filter(e => e.group === 'drive');
        const homes = this.entries.filter(e => e.group === 'home');
        const workspaces = this.entries.filter(e => e.group === 'workspace');
        const sections: DriveEntry[][] = [];
        if (drives.length > 0) sections.push(drives);
        if (homes.length > 0) sections.push(homes);
        if (workspaces.length > 0) sections.push(workspaces);
        if (locations.length > 0) sections.push(locations);
        return sections;
    }

    get selectedEntry(): DriveEntry | undefined {
        return this.entries[this.cursor];
    }

    private buildTable(theme: Theme): { table: PopupTable; styles: PopupTableStyles } {
        const locationEntries = this.entries.filter(e => e.group === 'location');
        const driveEntries = this.entries.filter(e => e.group === 'drive');
        const homeEntries = this.entries.filter(e => e.group === 'home');
        const workspaceEntries = this.entries.filter(e => e.group === 'workspace');
        const hasSizeCols = driveEntries.some(e => e.totalSize > 0 || e.freeSpace > 0);

        const locationRows: TableRow[] = locationEntries.map(e => ({
            label: e.label,
            detail: e.description,
            spanAll: true,
            numberLabel: '`',
        }));

        const driveRows: TableRow[] = driveEntries.map((e, i) => ({
            label: e.label,
            detail: e.description,
            fixedCols: hasSizeCols
                ? [formatSizeHuman(e.totalSize), formatSizeHuman(e.freeSpace)]
                : undefined,
            numberLabel: PopupTable.indexToPrefix(i),
        }));

        const homeRows: TableRow[] = homeEntries.map(e => ({
            label: e.label,
            detail: e.description,
            spanAll: true,
        }));

        const workspaceRows: TableRow[] = workspaceEntries.map(e => ({
            label: e.label,
            detail: e.description,
            spanAll: true,
        }));

        const sections: TableSection[] = [];
        if (driveRows.length > 0) sections.push({ rows: driveRows });
        if (homeRows.length > 0) sections.push({ rows: homeRows, startIndex: driveEntries.length });
        if (workspaceRows.length > 0) sections.push({ rows: workspaceRows, startIndex: driveEntries.length + homeEntries.length });
        if (locationRows.length > 0) sections.push({ rows: locationRows });

        const table = new PopupTable();
        table.title = 'Change drive';
        table.sections = sections;
        table.cursor = this.cursor;
        table.numbered = true;
        if (hasSizeCols) {
            table.fixedColumns = [
                { width: 8, align: 'right' },
                { width: 8, align: 'right' },
            ];
        }

        return {
            table,
            styles: {
                body: theme.popupActionBody,
                label: theme.popupActionLabel,
                text: theme.popupActionText,
                number: theme.popupActionNumber,
            },
        };
    }

    override renderToBuffer(theme: Theme): FrameBuffer {
        if (!this.active || this.entries.length === 0) return new FrameBuffer(0, 0);
        const { table, styles } = this.buildTable(theme);
        return table.renderToBuffer(styles);
    }

    render(anchorRow: number, anchorCol: number, theme: Theme, maxWidth?: number, listHeight?: number): string {
        if (!this.active || this.entries.length === 0) return '';
        const { table, styles } = this.buildTable(theme);

        const rightEdge = maxWidth ? anchorCol + maxWidth - 1 : 999;
        let popupCol = anchorCol + 3;

        let fb = table.renderToBuffer(styles);
        if (fb.width === 0) return '';

        if (popupCol + fb.width - 1 > rightEdge) {
            popupCol = rightEdge - fb.width + 1;
            if (popupCol < 1) {
                popupCol = 1;
                fb = table.renderToBuffer(styles, rightEdge);
                if (fb.width === 0) return '';
            }
        }

        let popupRow = anchorRow;
        if (typeof listHeight === 'number') {
            const areaHeight = listHeight + 2;
            popupRow = anchorRow + Math.max(0, Math.floor((areaHeight - fb.height) / 2));
        }

        this.setScreenPosition(popupRow, popupCol, fb.width, fb.height);
        return fb.toAnsi(this.screenRow, this.screenCol);
    }

    static buildEntries(workspaceDirs: string[]): DriveEntry[] {
        const entries = DrivePopup.discoverDrives();
        const homeDirs = DrivePopup.discoverHomeDirs();
        for (const hd of homeDirs) entries.push(hd);
        if (workspaceDirs.length > 0) {
            for (const dir of workspaceDirs) {
                entries.push({
                    label: 'VSCode Explorer',
                    description: path.basename(dir),
                    totalSize: 0,
                    freeSpace: 0,
                    path: dir,
                    group: 'workspace',
                });
            }
        } else {
            entries.push({
                label: 'VSCode Explorer',
                description: 'no directory',
                totalSize: 0,
                freeSpace: 0,
                path: '',
                group: 'workspace',
            });
        }
        return entries;
    }

    static prefixToIndex(ch: string): number {
        if (ch >= '1' && ch <= '9') return ch.charCodeAt(0) - 49;
        if (ch === '0') return 9;
        const lower = ch.toLowerCase();
        if (lower >= 'a' && lower <= 'z') return 10 + lower.charCodeAt(0) - 97;
        return -1;
    }

    static discoverHomeDirs(): DriveEntry[] {
        const home = os.homedir();
        const entries: DriveEntry[] = [];
        entries.push({
            label: 'Home',
            description: '',
            totalSize: 0,
            freeSpace: 0,
            path: home,
            group: 'home',
        });
        const names = ['Desktop', 'Documents', 'Downloads', 'Movies', 'Music', 'Pictures', 'Public'];
        for (const name of names) {
            const dirPath = path.join(home, name);
            try {
                const stat = fs.statSync(dirPath);
                if (stat.isDirectory()) {
                    entries.push({
                        label: name,
                        description: '',
                        totalSize: 0,
                        freeSpace: 0,
                        path: dirPath,
                        group: 'home',
                    });
                }
            } catch {
                // directory doesn't exist
            }
        }
        return entries;
    }

    static discoverDrives(): DriveEntry[] {
        if (os.platform() === 'win32') return DrivePopup.discoverDrivesWindows();
        if (os.platform() === 'darwin') return DrivePopup.discoverDrivesDarwin();
        return DrivePopup.discoverDrivesPosix();
    }

    static discoverDrivesWindows(): DriveEntry[] {
        const typeMap: Record<string, string> = {
            '2': 'removable',
            '3': 'fixed',
            '4': 'network',
            '5': 'cdrom',
        };

        try {
            const output = execSync(
                'wmic logicaldisk get caption,drivetype,freespace,size /format:csv',
                { timeout: 5000, encoding: 'utf8' },
            );
            const lines = output.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
            const entries: DriveEntry[] = [];
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(',');
                if (parts.length < 5) continue;
                const caption = parts[1].trim();
                const driveType = parts[2].trim();
                const freeSpace = parseInt(parts[3].trim(), 10) || 0;
                const totalSize = parseInt(parts[4].trim(), 10) || 0;
                if (!caption) continue;
                entries.push({
                    label: caption,
                    description: typeMap[driveType] || 'unknown',
                    totalSize,
                    freeSpace,
                    path: caption + '\\',
                    group: 'drive',
                });
            }
            if (entries.length > 0) {
                entries.sort((a, b) => a.label.localeCompare(b.label));
                return entries;
            }
        } catch {
            // fallback below
        }

        const entries: DriveEntry[] = [];
        for (let c = 65; c <= 90; c++) {
            const letter = String.fromCharCode(c);
            const drivePath = letter + ':\\';
            try {
                fs.accessSync(drivePath);
                entries.push({
                    label: letter + ':',
                    description: 'drive',
                    totalSize: 0,
                    freeSpace: 0,
                    path: drivePath,
                    group: 'drive',
                });
            } catch {
                // drive not accessible
            }
        }
        return entries;
    }

    static discoverDrivesDarwin(): DriveEntry[] {
        try {
            const dfOutput = execSync('df -k', { timeout: 5000, encoding: 'utf8' });
            const dfLines = dfOutput.trim().split(/\r?\n/);

            const reDarwin = /^\S+\s+(\d+)\s+\d+\s+(\d+)\s+\d+%\s+\d+\s+\d+\s+\d+%\s+(.+)$/;
            const dfMap = new Map<string, { totalKb: number; availKb: number }>();

            for (let i = 1; i < dfLines.length; i++) {
                const m = reDarwin.exec(dfLines[i].trim());
                if (!m) continue;
                const mountPoint = m[3];
                if (mountPoint === '/dev') continue;
                if (mountPoint.startsWith('/System/')) continue;
                if (mountPoint.startsWith('/private/')) continue;
                dfMap.set(mountPoint, {
                    totalKb: parseInt(m[1], 10) || 0,
                    availKb: parseInt(m[2], 10) || 0,
                });
            }

            const entries: DriveEntry[] = [];
            const seen = new Set<string>();

            let volumeEntries: fs.Dirent[] = [];
            try {
                volumeEntries = fs.readdirSync('/Volumes', { withFileTypes: true });
            } catch {
                // /Volumes not readable
            }

            for (const ent of volumeEntries) {
                const volPath = path.join('/Volumes', ent.name);
                let resolvedPath: string;
                try {
                    resolvedPath = fs.realpathSync(volPath);
                } catch {
                    resolvedPath = volPath;
                }

                const df = dfMap.get(resolvedPath) || dfMap.get(volPath);
                if (!df) continue;
                if (seen.has(resolvedPath)) continue;
                seen.add(resolvedPath);

                entries.push({
                    label: ent.name,
                    description: resolvedPath === '/' ? '/' : volPath,
                    totalSize: df.totalKb * 1024,
                    freeSpace: df.availKb * 1024,
                    path: resolvedPath,
                    group: 'drive',
                });
            }

            for (const [mountPoint, df] of dfMap) {
                if (seen.has(mountPoint)) continue;
                seen.add(mountPoint);
                entries.push({
                    label: path.basename(mountPoint) || mountPoint,
                    description: mountPoint,
                    totalSize: df.totalKb * 1024,
                    freeSpace: df.availKb * 1024,
                    path: mountPoint,
                    group: 'drive',
                });
            }

            entries.sort((a, b) => {
                const aRank = a.path === '/' ? 0 : 1;
                const bRank = b.path === '/' ? 0 : 1;
                if (aRank !== bRank) return aRank - bRank;
                return a.label.localeCompare(b.label);
            });
            return entries;
        } catch {
            return [];
        }
    }

    static discoverDrivesPosix(): DriveEntry[] {
        try {
            const output = execSync('df -kT 2>/dev/null || df -k', {
                timeout: 5000,
                encoding: 'utf8',
            });
            const lines = output.trim().split(/\r?\n/);
            if (lines.length < 2) return [];

            const header = lines[0];
            const hasFsType = /\btype\b/i.test(header);
            const entries: DriveEntry[] = [];
            const seen = new Set<string>();

            const reWithType = /^\S+\s+(\S+)\s+(\d+)\s+\d+\s+(\d+)\s+\d+%\s+(.+)$/;
            const reNoType = /^\S+\s+(\d+)\s+\d+\s+(\d+)\s+\d+%\s+(.+)$/;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                let fsType: string;
                let totalKb: number;
                let availKb: number;
                let mountPoint: string;

                if (hasFsType) {
                    const m = reWithType.exec(line);
                    if (!m) continue;
                    fsType = m[1];
                    totalKb = parseInt(m[2], 10) || 0;
                    availKb = parseInt(m[3], 10) || 0;
                    mountPoint = m[4];
                } else {
                    const m = reNoType.exec(line);
                    if (!m) continue;
                    fsType = '';
                    totalKb = parseInt(m[1], 10) || 0;
                    availKb = parseInt(m[2], 10) || 0;
                    mountPoint = m[3];
                }

                if (VIRTUAL_FS_TYPES.has(fsType)) continue;
                if (FILTERED_MOUNT_PREFIXES.some(p => mountPoint.startsWith(p))) continue;
                if (seen.has(mountPoint)) continue;
                seen.add(mountPoint);

                entries.push({
                    label: mountPoint,
                    description: fsType || 'fs',
                    totalSize: totalKb * 1024,
                    freeSpace: availKb * 1024,
                    path: mountPoint,
                    group: 'drive',
                });
            }
            entries.sort((a, b) => {
                const aRank = a.path === '/' ? 0 : a.path.startsWith('/mnt/') ? 1 : 2;
                const bRank = b.path === '/' ? 0 : b.path.startsWith('/mnt/') ? 1 : 2;
                if (aRank !== bRank) return aRank - bRank;
                return a.path.localeCompare(b.path);
            });
            return entries;
        } catch {
            return [];
        }
    }
}
