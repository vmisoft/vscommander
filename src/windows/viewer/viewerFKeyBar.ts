import { moveTo, resetStyle } from '../../draw';
import { Theme } from '../../settings';
import { applyStyle } from '../../helpers';

// The viewer's bottom function-key bar.
export class ViewerFKeyBar {
    static readonly KEY_COUNT = 10;

    render(rows: number, cols: number, theme: Theme, encodingLabel: string): string {
        const numStyle = applyStyle(theme.fkeyNum.idle);
        const labelStyle = applyStyle(theme.fkeyLabel.idle);
        const inactiveStyle = applyStyle(theme.fkeyLabelInactive.idle);

        const labels: { num: string; label: string; inactive: boolean }[] = [
            { num: '1', label: 'Help', inactive: true },
            { num: '2', label: 'Wrap', inactive: false },
            { num: '3', label: 'Quit', inactive: false },
            { num: '4', label: 'Hex', inactive: false },
            { num: '5', label: '', inactive: true },
            { num: '6', label: 'Edit', inactive: false },
            { num: '7', label: 'Search', inactive: false },
            { num: '8', label: encodingLabel, inactive: false },
            { num: '9', label: '', inactive: true },
            { num: '10', label: 'Quit', inactive: false },
        ];

        const out: string[] = [];
        out.push(moveTo(rows, 1) + resetStyle());

        const totalKeys = labels.length;
        const slotWidth = Math.floor(cols / totalKeys);
        let col = 1;

        for (let i = 0; i < totalKeys; i++) {
            const k = labels[i];
            const isLast = i === totalKeys - 1;
            const w = isLast ? cols - col + 1 : slotWidth;

            out.push(moveTo(rows, col));
            out.push(numStyle + ' ' + k.num);
            const remaining = Math.max(0, w - 1 - k.num.length);
            const label = k.label.slice(0, remaining);
            const pad = ' '.repeat(Math.max(0, remaining - label.length));
            out.push((k.inactive ? inactiveStyle : labelStyle) + label + pad);

            col += w;
        }

        return out.join('');
    }
}
