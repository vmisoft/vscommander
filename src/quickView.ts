export interface QuickViewHost {
    openSplit(uri: string, targetType: 'file' | 'dir', side: 'left' | 'right'): void;
    updateSplit(uri: string, targetType: 'file' | 'dir', side: 'left' | 'right'): void;
    closeSplit(side: 'left' | 'right'): void;
    cancelDirScan(): void;
    scanDir(dirPath: string): void;
}

export class QuickViewController {
    active = false;
    side: 'left' | 'right' = 'right';
    lastFile: string | undefined;
    lastType: 'file' | 'dir' = 'file';

    constructor(private host: QuickViewHost) {}

    open(filePath: string, targetType: 'file' | 'dir', side: 'left' | 'right'): void {
        this.active = true;
        this.side = side;
        this.lastFile = filePath;
        this.lastType = targetType;

        if (targetType === 'dir') {
            this.host.scanDir(filePath);
        }
        this.host.openSplit(filePath, targetType, side);
    }

    updateFromCursor(filePath: string, fileType: 'file' | 'dir'): void {
        if (!this.active) return;
        if (filePath === this.lastFile && fileType === this.lastType) return;
        this.lastFile = filePath;
        this.lastType = fileType;

        if (fileType === 'dir') {
            this.host.scanDir(filePath);
        } else {
            this.host.cancelDirScan();
        }
        this.host.updateSplit(filePath, fileType, this.side);
    }

    close(): void {
        if (!this.active) return;
        this.active = false;
        this.host.cancelDirScan();
        this.host.closeSplit(this.side);
        this.lastFile = undefined;
        this.lastType = 'file';
    }
}
