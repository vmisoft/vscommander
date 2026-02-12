import { Theme } from './settings';
import { FrameBuffer } from './frameBuffer';

export type PopupInputResult =
    | { action: 'consumed' }
    | { action: 'close'; confirm: boolean }
    | { action: 'passthrough' };

export abstract class Popup {
    active = false;
    padding = 1;

    get padH(): number {
        return this.padding * 2;
    }

    get padV(): number {
        return this.padding;
    }

    open(): void {
        this.active = true;
    }

    close(): void {
        this.active = false;
    }

    abstract render(anchorRow: number, anchorCol: number, theme: Theme, ...extra: unknown[]): string;

    renderToBuffer(_theme: Theme): FrameBuffer {
        return new FrameBuffer(0, 0);
    }

    get hasBlink(): boolean {
        return false;
    }

    renderBlink(_anchorRow: number, _anchorCol: number, _theme: Theme): string {
        return '';
    }
}
