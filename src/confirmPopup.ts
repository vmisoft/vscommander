import { Theme } from './settings';
import { PopupInputResult } from './popup';
import { ComposedPopup } from './composedPopup';
import { warningFormTheme, infoFormTheme, BodyTextElement } from './formView';
import { FrameBuffer } from './frameBuffer';

export interface ConfirmPopupConfig {
    title: string;
    bodyLines: string[];
    buttons: string[];
    disabledButtons?: number[];
    warning?: boolean;
    onConfirm: (buttonIndex: number) => unknown;
}

export class ConfirmPopup extends ComposedPopup {
    private config: ConfirmPopupConfig | undefined;

    constructor() {
        super();
    }

    get selectedButton(): number {
        if (!this.activeView) return 0;
        return this.activeView.buttons('buttons').selectedIndex;
    }

    openWith(config: ConfirmPopupConfig): void {
        this.config = config;
        const isWarning = config.warning !== false;
        const resolver = isWarning ? warningFormTheme : infoFormTheme;

        const view = this.createView(config.title, undefined, resolver);

        let contentWidth = 0;
        for (const line of config.bodyLines) {
            const w = BodyTextElement.displayLen(line);
            if (w > contentWidth) contentWidth = w;
        }
        view.minWidth = Math.max(contentWidth + 4, config.title.length + 4);

        view.addBodyText(config.bodyLines, true);
        view.addSeparator();
        view.addButtons('buttons', config.buttons);

        const btnGroup = view.buttons('buttons');
        if (config.disabledButtons) {
            btnGroup.disabledIndices = new Set(config.disabledButtons);
            for (let i = 0; i < config.buttons.length; i++) {
                if (!btnGroup.disabledIndices.has(i)) {
                    btnGroup.selectedIndex = i;
                    break;
                }
            }
        }

        view.onConfirm = () => {
            const command = config.onConfirm(btnGroup.selectedIndex);
            this.close();
            return { action: 'close', confirm: true, command };
        };
        view.onCancel = () => {
            this.close();
            return { action: 'close', confirm: false };
        };

        this.setActiveView(view);
        super.open();
    }

    override emitConfirm(): unknown {
        if (this.config && this.activeView) {
            return this.config.onConfirm(this.activeView.buttons('buttons').selectedIndex);
        }
    }
}
