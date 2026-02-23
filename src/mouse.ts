import { MOUSE_SGR_PREFIX } from './keys';

export interface MouseEvent {
    button: number;
    col: number;
    row: number;
    isRelease: boolean;
    isMotion: boolean;
}

export function parseMouseEvent(data: string): MouseEvent | null {
    if (!data.startsWith(MOUSE_SGR_PREFIX)) return null;
    const tail = data.slice(3);
    const terminator = tail[tail.length - 1];
    if (terminator !== 'M' && terminator !== 'm') return null;
    const parts = tail.slice(0, -1).split(';');
    if (parts.length !== 3) return null;
    const rawBtn = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    const row = parseInt(parts[2], 10);
    if (isNaN(rawBtn) || isNaN(col) || isNaN(row)) return null;
    const isMotion = (rawBtn & 32) !== 0;
    const button = rawBtn & 0x43;
    return { button, col, row, isRelease: terminator === 'm', isMotion };
}
