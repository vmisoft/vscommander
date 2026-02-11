import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Theme, PanelSettings } from './settings';
import { DriveEntry } from './types';
import { Popup, PopupInputResult } from './popup';
import { formatSizeHuman } from './helpers';
import { PopupTable, TableSection, TableRow } from './popupTable';

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
    private separatorIndex = -1;

    open(target?: 'left' | 'right', settings?: PanelSettings): void {
        if (!target || !settings) return;
        const entries = DrivePopup.buildEntries(settings.workspaceFolders);
        if (entries.length === 0) return;
        super.open();
        this.targetPane = target;
        this.entries = entries;
        this.cursor = 0;
        this.separatorIndex = entries.findIndex(e => e.group === 'workspace');
    }

    close(): void {
        super.close();
    }

    handleInput(data: string): PopupInputResult {
        if (data === '\x1b' || data === '\x1b\x1b') {
            this.close();
            return { action: 'close', confirm: false };
        }

        if (data === '\r') {
            this.close();
            return { action: 'close', confirm: true };
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
            const workspaceStart = this.entries.findIndex(e => e.group === 'workspace');

            if (ch === '0') {
                if (workspaceStart >= 0) {
                    this.cursor = workspaceStart;
                    this.close();
                    return { action: 'close', confirm: true };
                }
                return { action: 'consumed' };
            }

            if (ch >= '1' && ch <= '9') {
                const idx = parseInt(ch, 10) - 1;
                if (idx >= 0 && idx < this.entries.length && this.entries[idx].group !== 'workspace') {
                    this.cursor = idx;
                    this.close();
                    return { action: 'close', confirm: true };
                }
                return { action: 'consumed' };
            }

            const lower = ch.toLowerCase();
            if (lower >= 'a' && lower <= 'z') {
                if (os.platform() === 'win32') {
                    const driveIdx = this.entries.findIndex(
                        e => e.group === 'drive' && e.label.toLowerCase().startsWith(lower),
                    );
                    if (driveIdx >= 0) {
                        this.cursor = driveIdx;
                        this.close();
                        return { action: 'close', confirm: true };
                    }
                }

                if (workspaceStart >= 0) {
                    const offset = lower.charCodeAt(0) - 97 + 1;
                    const targetIdx = workspaceStart + offset;
                    if (targetIdx < this.entries.length) {
                        this.cursor = targetIdx;
                        this.close();
                        return { action: 'close', confirm: true };
                    }
                }
                return { action: 'consumed' };
            }
        }

        return { action: 'consumed' };
    }

    get selectedEntry(): DriveEntry | undefined {
        return this.entries[this.cursor];
    }

    render(anchorRow: number, anchorCol: number, theme: Theme, maxWidth?: number): string {
        if (!this.active || this.entries.length === 0) return '';

        const driveEntries = this.entries.filter(e => e.group === 'drive');
        const homeEntries = this.entries.filter(e => e.group === 'home');
        const workspaceEntries = this.entries.filter(e => e.group === 'workspace');
        const hasSizeCols = driveEntries.some(e => e.totalSize > 0 || e.freeSpace > 0);

        const driveRows: TableRow[] = driveEntries.map(e => ({
            label: e.label,
            detail: e.description,
            fixedCols: hasSizeCols
                ? [formatSizeHuman(e.totalSize), formatSizeHuman(e.freeSpace)]
                : undefined,
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
        if (homeRows.length > 0) sections.push({ rows: homeRows });
        if (workspaceRows.length > 0) sections.push({ rows: workspaceRows, startIndex: 9 });

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

        return table.render(anchorRow, anchorCol, {
            body: theme.driveBody,
            label: theme.driveLabel,
            text: theme.driveText,
            number: theme.driveNumber,
        }, maxWidth);
    }

    static buildEntries(workspaceFolders: string[]): DriveEntry[] {
        const entries = DrivePopup.discoverDrives();
        const homeDirs = DrivePopup.discoverHomeDirs();
        for (const hd of homeDirs) entries.push(hd);
        if (workspaceFolders.length > 0) {
            for (const folder of workspaceFolders) {
                entries.push({
                    label: 'VSCode Explorer',
                    description: path.basename(folder),
                    totalSize: 0,
                    freeSpace: 0,
                    path: folder,
                    group: 'workspace',
                });
            }
        } else {
            entries.push({
                label: 'VSCode Explorer',
                description: 'no folder',
                totalSize: 0,
                freeSpace: 0,
                path: '',
                group: 'workspace',
            });
        }
        return entries;
    }

    static discoverHomeDirs(): DriveEntry[] {
        const home = os.homedir();
        const names = ['Desktop', 'Documents', 'Downloads', 'Movies', 'Music', 'Pictures', 'Public'];
        const entries: DriveEntry[] = [];
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
        if (os.platform() === 'win32') {
            return DrivePopup.discoverDrivesWindows();
        }
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

    static discoverDrivesPosix(): DriveEntry[] {
        try {
            const output = execSync('df -kT 2>/dev/null || df -k', {
                timeout: 5000,
                encoding: 'utf8',
            });
            const lines = output.trim().split(/\r?\n/);
            if (lines.length < 2) return [];

            const header = lines[0];
            const hasFsType = /\btype\b/i.test(header) || header.split(/\s+/).length >= 7;
            const entries: DriveEntry[] = [];
            const seen = new Set<string>();

            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].trim().split(/\s+/);
                if (parts.length < 6) continue;

                let fsType: string;
                let totalKb: number;
                let availKb: number;
                let mountPoint: string;

                if (hasFsType && parts.length >= 7) {
                    fsType = parts[1];
                    totalKb = parseInt(parts[2], 10) || 0;
                    availKb = parseInt(parts[4], 10) || 0;
                    mountPoint = parts[6];
                } else {
                    fsType = '';
                    totalKb = parseInt(parts[1], 10) || 0;
                    availKb = parseInt(parts[3], 10) || 0;
                    mountPoint = parts[5];
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
