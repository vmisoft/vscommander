export class BlinkTimer {
    private timer: ReturnType<typeof setInterval> | undefined;

    constructor(private interval: number = 500) {}

    start(tick: () => string | void, emit: (s: string) => void): void {
        this.stop();
        this.timer = setInterval(() => {
            const result = tick();
            if (typeof result === 'string' && result) {
                emit(result);
            }
        }, this.interval);
    }

    sync(
        isActive: () => boolean,
        reset: () => void,
        tick: () => string | void,
        emit: (s: string) => void,
    ): void {
        if (isActive() && !this.timer) {
            reset();
            this.start(tick, emit);
        } else if (!isActive() && this.timer) {
            this.stop();
        }
    }

    restart(reset: () => void, tick: () => string | void, emit: (s: string) => void): void {
        this.stop();
        reset();
        this.start(tick, emit);
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    get running(): boolean {
        return this.timer !== undefined;
    }
}

export class PollTimer {
    private timer: ReturnType<typeof setTimeout> | undefined;

    start(interval: number, tick: () => boolean): void {
        this.stop();
        const step = () => {
            this.timer = setTimeout(() => {
                if (tick()) {
                    step();
                } else {
                    this.timer = undefined;
                }
            }, interval);
        };
        step();
    }

    stop(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    get running(): boolean {
        return this.timer !== undefined;
    }
}
