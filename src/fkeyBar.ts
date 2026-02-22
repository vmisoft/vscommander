import { moveTo, resetStyle } from './draw';
import { PanelSettings, KeyBindings, getFKeyNumber } from './settings';
import { Layout } from './types';
import { applyStyle } from './helpers';

export class FKeyBar {
    render(layout: Layout, cols: number, settings: PanelSettings): string {
        const { fkeyRow } = layout;
        const t = settings.theme;
        const out: string[] = [];

        const actionSlots: { action: keyof KeyBindings; label: string }[] = [
            { action: 'help', label: 'Help' },
            { action: 'edit', label: 'Edit' },
            { action: 'copy', label: 'Copy' },
            { action: 'move', label: 'Move' },
            { action: 'mkdir', label: 'Mkdir' },
            { action: 'delete', label: 'Del' },
            { action: 'menu', label: 'Conf' },
            { action: 'quit', label: 'Quit' },
        ];
        const defaultLabels: Record<number, string> = {
            2: 'Menu', 3: 'View',
        };
        const keys: { num: string; label: string; inactive: boolean }[] = [];
        for (let i = 1; i <= 10; i++) {
            let label = '';
            let inactive = false;
            for (const al of actionSlots) {
                if (getFKeyNumber(settings.keys[al.action]) === i) {
                    label = al.label;
                    break;
                }
            }
            if (!label) {
                label = defaultLabels[i] || '';
                inactive = label !== '';
            }
            keys.push({ num: String(i), label, inactive });
        }

        out.push(moveTo(fkeyRow, 1) + resetStyle());

        const totalKeys = keys.length;
        const slotWidth = Math.floor(cols / totalKeys);
        let col = 1;

        for (let i = 0; i < totalKeys; i++) {
            const k = keys[i];
            const isLast = i === totalKeys - 1;
            const w = isLast ? cols - col + 1 : slotWidth;

            out.push(moveTo(fkeyRow, col));
            out.push(applyStyle(t.fkeyNum.idle) + ' ' + k.num);
            const remaining = Math.max(0, w - 1 - k.num.length);
            const label = k.label.slice(0, remaining);
            const pad = ' '.repeat(Math.max(0, remaining - label.length));
            const labelStyle = k.inactive ? t.fkeyLabelInactive.idle : t.fkeyLabel.idle;
            out.push(applyStyle(labelStyle) + label + pad);

            col += w;
        }

        return out.join('');
    }

    handleMouseClick(col: number, cols: number): string | null {
        const slotWidth = Math.floor(cols / 10);
        const slot = Math.min(9, Math.floor((col - 1) / slotWidth));
        const fkeyNum = slot + 1;
        const fkeySeqs: Record<number, string> = {
            1: '\x1bOP', 2: '\x1bOQ', 3: '\x1bOR', 4: '\x1bOS',
            5: '\x1b[15~', 6: '\x1b[17~', 7: '\x1b[18~', 8: '\x1b[19~',
            9: '\x1b[20~', 10: '\x1b[21~',
        };
        return fkeySeqs[fkeyNum] || null;
    }
}
