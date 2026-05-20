import { Theme } from '../../settings';
import { FrameBuffer } from '../../frameBuffer';

export interface MenuBarEntry {
    label: string;
    hotkeyIndex: number;
    col: number;
    width: number;
}

// The horizontal top menu bar: a row of menu titles with hotkey highlighting
// and a current selection.
export class MenuBar {
    readonly entries: MenuBarEntry[] = [];
    selected = 0;

    constructor(labels: string[], hotkeyIndices: number[], indent: number, gap: number) {
        let col = indent + 1;
        for (let i = 0; i < labels.length; i++) {
            const w = labels[i].length;
            this.entries.push({ label: labels[i], hotkeyIndex: hotkeyIndices[i] ?? 0, col, width: w });
            col += w + gap;
        }
    }

    get count(): number {
        return this.entries.length;
    }

    selectByHotkey(ch: string): boolean {
        const lower = ch.toLowerCase();
        for (let i = 0; i < this.entries.length; i++) {
            const m = this.entries[i];
            if (m.label[m.hotkeyIndex].toLowerCase() === lower) {
                this.selected = i;
                return true;
            }
        }
        return false;
    }

    // Which entry contains a bar column, or -1.
    hitTest(fbCol: number): number {
        for (let i = 0; i < this.entries.length; i++) {
            const m = this.entries[i];
            const rel = fbCol - (m.col - 1);
            if (rel >= 0 && rel < m.width) return i;
        }
        return -1;
    }

    render(totalCols: number, theme: Theme): FrameBuffer {
        const t = theme;
        const fb = new FrameBuffer(totalCols, 1);
        fb.fill(0, 0, totalCols, 1, ' ', t.menuBar.idle);
        for (let i = 0; i < this.entries.length; i++) {
            const m = this.entries[i];
            const isSelected = i === this.selected;
            const style = isSelected ? t.menuBar.selected : t.menuBar.idle;
            const hotkeyStyle = isSelected ? t.menuBarHotkey.selected : t.menuBarHotkey.idle;
            fb.write(0, m.col - 1, m.label, style);
            fb.write(0, m.col - 1 + m.hotkeyIndex, m.label[m.hotkeyIndex], hotkeyStyle);
        }
        return fb;
    }
}
