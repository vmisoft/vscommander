import { MaskedInput } from '../../components/maskedInput';

// A file timestamp field: an opt-in masked YYYY-MM-DD hh:mm:ss editor that
// validates the typed value as a real calendar date/time. Specialized
// derivative of the generic MaskedInput.
export class TimestampField extends MaskedInput {
    constructor(label: string) {
        super(label, 'YYYY-MM-DD hh:mm:ss', 30);
    }

    private parse(): Date | undefined {
        if (!this.complete) {
            return undefined;
        }
        const s = this.rawDigits();
        const y = +s.slice(0, 4), mo = +s.slice(4, 6), d = +s.slice(6, 8);
        const h = +s.slice(8, 10), mi = +s.slice(10, 12), se = +s.slice(12, 14);
        const dt = new Date(y, mo - 1, d, h, mi, se);
        if (isNaN(dt.getTime()) || dt.getMonth() !== mo - 1 || dt.getDate() !== d
            || h > 23 || mi > 59 || se > 59) {
            return undefined;
        }
        return dt;
    }

    protected validate(): boolean {
        return this.parse() !== undefined;
    }

    // undefined = leave unchanged; 'invalid' = enabled but not a valid date;
    // Date = a valid new timestamp.
    getValue(): Date | 'invalid' | undefined {
        if (!this.enabled) {
            return undefined;
        }
        return this.parse() ?? 'invalid';
    }
}
