import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Terminal } from '@xterm/headless';

// Structural views of the extension's exposed test API. Kept local so the
// test code never imports extension.ts (which esbuild bundles separately).
interface PanelTerminal {
    handleInput(data: string): void;
    getScreen(): { cols: number; rows: number; data: string };
}

// A configurable User Menu (F2) item — matches src/userMenu.ts UserMenuItem.
// `children` is optional here; normalizeMenuItems() fills it in.
export interface MenuItem {
    hotkey: string;
    label: string;
    commands: string[];
    submenu: boolean;
    children?: MenuItem[];
}

function normalizeMenuItems(items: MenuItem[]): MenuItem[] {
    return items.map((it) => ({
        hotkey: it.hotkey,
        label: it.label,
        commands: it.commands ?? [],
        submenu: it.submenu ?? false,
        children: normalizeMenuItems(it.children ?? []),
    }));
}

interface TestApi {
    getActiveTerminal(): PanelTerminal | undefined;
    openTest(opts: {
        leftCwd: string;
        rightCwd: string;
        settings?: Record<string, unknown>;
        cols?: number;
        rows?: number;
        userMenuItems?: MenuItem[];
    }): void;
    disposeTest(): void;
}

// Fixed panel size for all tests — keeps the screenshot grid a fixed shape so
// reference screenshots line up cell for cell. Machine-specific content
// (cwd, clock, dates) is handled by '?' wildcards in the reference files.
export const DEFAULT_COLS = 100;
export const DEFAULT_ROWS = 30;

// Input byte sequences — the exact sequences VSCommander's key decoder
// expects (kept in sync with src/keys.ts). Mouse events use SGR encoding.
export const KEY = {
    enter: '\r',
    esc: '\x1b',
    tab: '\t',
    shiftTab: '\x1b[Z',
    space: ' ',
    backspace: '\x7f',
    insert: '\x1b[2~',
    delete: '\x1b[3~',
    up: '\x1b[A',
    down: '\x1b[B',
    right: '\x1b[C',
    left: '\x1b[D',
    home: '\x1b[H',
    end: '\x1b[F',
    pageUp: '\x1b[5~',
    pageDown: '\x1b[6~',
    f1: '\x1bOP',
    f2: '\x1bOQ',
    f3: '\x1bOR',
    f4: '\x1bOS',
    f5: '\x1b[15~',
    f6: '\x1b[17~',
    f7: '\x1b[18~',
    f8: '\x1b[19~',
    f9: '\x1b[20~',
    f10: '\x1b[21~',
    shiftF8: '\x1b[19;2~',
    ctrlF12: '\x1b[24;5~',
    ctrlH: '\x08',
    ctrlP: '\x10',
    ctrlQ: '\x11',
    ctrlR: '\x12',
    ctrlU: '\x15',
    ctrl1: '\x1b[49;5u',
    ctrl2: '\x1b[50;5u',
    ctrl3: '\x1b[51;5u',
    ctrlLeft: '\x1b[1;5D',
    ctrlRight: '\x1b[1;5C',
    numpadStar: '\x1bOj',
    numpadPlus: '\x1bOk',
    numpadMinus: '\x1bOm',
} as const;

// Alt+<letter> — e.g. quick search. A terminal sends ESC then the letter.
export function alt(letter: string): string {
    return '\x1b' + letter;
}

export const MOUSE_LEFT = 0;
export const MOUSE_MIDDLE = 1;
export const MOUSE_RIGHT = 2;
export const MOUSE_WHEEL_UP = 64;
export const MOUSE_WHEEL_DOWN = 65;

// SGR mouse sequence. col/row are 1-based terminal cells.
export function mousePress(button: number, col: number, row: number): string {
    return `\x1b[<${button};${col};${row}M`;
}

export function mouseRelease(button: number, col: number, row: number): string {
    return `\x1b[<${button};${col};${row}m`;
}

export function mouseClick(button: number, col: number, row: number): string {
    return mousePress(button, col, row) + mouseRelease(button, col, row);
}

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function removeDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

// Drives a live VSCommander panel inside the running VS Code instance.
// "Screenshots" are the panel's full-frame ANSI render replayed through a
// headless xterm parser into a plain text grid — deterministic, no pixels.
export class Harness {
    // Only one test panel is alive at a time; tracked so it can be torn
    // down before the next launch and after the suite (see disposeCurrent).
    private static current: Harness | undefined;
    private static api: TestApi | undefined;

    private constructor(
        private readonly term: PanelTerminal,
        private readonly sandbox: string,
        private readonly srcDir: string,
    ) {}

    // `testDir` is the test's own __dirname. Its fixture filesystem
    // (filesystem/panel1, filesystem/panel2, filesystem/settings.json) is
    // copied to a fresh temp dir so tests can mutate it freely; panel1/panel2
    // become the left/right panes.
    static async launch(
        testDir: string,
        opts: { cols?: number; rows?: number; userMenu?: MenuItem[] } = {},
    ): Promise<Harness> {
        const api = await Harness.resolveApi();

        // Tear down the panel + sandbox from any previous launch so state
        // never accumulates across hundreds of tests.
        await Harness.disposeCurrent();

        // Test sources run from dist/; their fixtures live alongside the
        // source under src/. Map back to find filesystem/.
        const srcDir = testDir.replace(
            `${path.sep}dist${path.sep}test${path.sep}`,
            `${path.sep}src${path.sep}test${path.sep}`,
        );
        const fixture = path.join(srcDir, 'filesystem');
        const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'vscommander-test-'));
        if (fs.existsSync(fixture)) {
            // verbatimSymlinks keeps fixture symlinks intact (symlink tests).
            fs.cpSync(fixture, sandbox, { recursive: true, verbatimSymlinks: true });
        }
        // Both panes always need a directory; create any the fixture omitted
        // so empty panes need no .gitkeep placeholder.
        fs.mkdirSync(path.join(sandbox, 'panel1'), { recursive: true });
        fs.mkdirSync(path.join(sandbox, 'panel2'), { recursive: true });

        let settings: Record<string, unknown> = {};
        const settingsPath = path.join(sandbox, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }

        api.openTest({
            leftCwd: path.join(sandbox, 'panel1'),
            rightCwd: path.join(sandbox, 'panel2'),
            settings,
            cols: opts.cols ?? DEFAULT_COLS,
            rows: opts.rows ?? DEFAULT_ROWS,
            userMenuItems: opts.userMenu
                ? normalizeMenuItems(opts.userMenu)
                : undefined,
        });

        // The Pseudoterminal's open() runs asynchronously once VS Code lays
        // out the editor terminal; poll until the panel has rendered.
        for (let i = 0; i < 200; i++) {
            const term = api.getActiveTerminal();
            if (term && term.getScreen().data.length > 0) {
                Harness.current = new Harness(term, sandbox, srcDir);
                return Harness.current;
            }
            await delay(50);
        }

        api.disposeTest();
        removeDir(sandbox);
        throw new Error('panel did not render within timeout');
    }

    // Closes the current test's panel (stopping its timers and shell) and
    // removes its sandbox. Called by launch() before the next panel, and by
    // a global afterEach hook so the final test cleans up too.
    static async disposeCurrent(): Promise<void> {
        const h = Harness.current;
        if (!h) {
            return;
        }
        Harness.current = undefined;
        Harness.api?.disposeTest();
        // Let the pseudoterminal's close() kill the shell before its cwd is
        // deleted (matters on Windows, where a live cwd locks the directory).
        await delay(50);
        removeDir(h.sandbox);
    }

    private static async resolveApi(): Promise<TestApi> {
        if (Harness.api) {
            return Harness.api;
        }
        const ext = vscode.extensions.all.find(
            (e) => e.packageJSON?.name === 'vscommander',
        );
        if (!ext) {
            throw new Error('vscommander extension not found in this VS Code instance');
        }
        const api: TestApi = await ext.activate();
        Harness.api = api;
        return api;
    }

    // Absolute paths of the two panes' working directories inside the
    // sandbox — use these for filesystem assertions.
    get panel1Dir(): string {
        return path.join(this.sandbox, 'panel1');
    }

    get panel2Dir(): string {
        return path.join(this.sandbox, 'panel2');
    }

    // Send raw input bytes to the panel (see KEY / mouse* helpers).
    send(sequence: string): void {
        this.term.handleInput(sequence);
    }

    async sendAndSettle(sequence: string, settleMs = 150): Promise<void> {
        this.term.handleInput(sequence);
        await delay(settleMs);
    }

    // Type text one character at a time (dialogs consume input per keystroke).
    async type(text: string, settleMs = 150): Promise<void> {
        for (const ch of text) {
            this.term.handleInput(ch);
        }
        await delay(settleMs);
    }

    // Left-click (press then release as separate events) at a 1-based cell.
    // The panel rejects a press+release delivered as one chunk, so they must
    // be sent as two handleInput calls.
    async click(col: number, row: number, settleMs = 200): Promise<void> {
        this.term.handleInput(mousePress(MOUSE_LEFT, col, row));
        this.term.handleInput(mouseRelease(MOUSE_LEFT, col, row));
        await delay(settleMs);
    }

    // Capture the current panel as a fixed-shape text grid: exactly `rows`
    // lines, each exactly `cols` wide (trailing cells kept as spaces).
    captureGrid(): Promise<string[]> {
        const { cols, rows, data } = this.term.getScreen();
        const xterm = new Terminal({ cols, rows, allowProposedApi: true });
        return new Promise<string[]>((resolve) => {
            xterm.write(data, () => {
                const buf = xterm.buffer.active;
                const lines: string[] = [];
                for (let y = 0; y < rows; y++) {
                    const line = buf.getLine(y);
                    const text = line ? line.translateToString(false) : '';
                    lines.push(text.padEnd(cols, ' ').slice(0, cols));
                }
                xterm.dispose();
                resolve(lines);
            });
        });
    }

    // The current panel as a single block of text (trailing spaces trimmed) —
    // handy for console.log while developing a test.
    async screenshotText(): Promise<string> {
        return (await this.captureGrid()).map((l) => l.replace(/\s+$/, '')).join('\n');
    }

    // Compare the current panel against a reference screenshot stored at
    // <test dir>/screenshots/<name>.txt. A '?' in the reference matches any
    // character; every other cell must match exactly.
    //
    // If the reference is missing, or UPDATE_SCREENSHOTS=1 is set, the current
    // screenshot is written as the reference instead (then add '?' wildcards
    // over volatile regions — paths, clock, dates — by hand).
    async expectScreenshot(name: string): Promise<void> {
        const refDir = path.join(this.srcDir, 'screenshots');
        const refPath = path.join(refDir, `${name}.txt`);
        const actual = await this.captureGrid();

        if (process.env.UPDATE_SCREENSHOTS === '1' || !fs.existsSync(refPath)) {
            fs.mkdirSync(refDir, { recursive: true });
            fs.writeFileSync(refPath, this.maskVolatile(actual).join('\n') + '\n');
            console.log(`[screenshot] wrote reference ${name}.txt`);
            return;
        }

        const reference = fs.readFileSync(refPath, 'utf8').replace(/\n$/, '').split('\n');
        const diff = diffGrid(reference, actual);
        if (diff) {
            throw new Error(`screenshot "${name}" does not match reference:\n${diff}`);
        }
    }

    // Replace machine/run-dependent regions with '?' wildcards when writing a
    // reference:
    //  - the panel header row (directory path + clock),
    //  - the command-line row (live shell prompt: user, host, cwd),
    //  - any absolute sandbox path (shown in copy/move dialogs),
    //  - YYYY-MM-DD dates.
    private maskVolatile(grid: string[]): string[] {
        const sandboxMask = '?'.repeat(this.sandbox.length);
        const rows = grid.length;
        // The command-line row sits just above the fkey bar; it exists only on
        // panel screens, identified by the panel bottom border one row above.
        const cmdRow = grid[rows - 3]?.includes('╚') ? rows - 2 : -1;
        return grid.map((line, y) => {
            if (y === 0 && line.startsWith('╔')) {
                return [...line]
                    .map((c) => (c === '╔' || c === '╗' ? c : '?'))
                    .join('');
            }
            if (y === cmdRow) {
                return '?'.repeat(line.length);
            }
            let out = line.split(this.sandbox).join(sandboxMask);
            // Dates/times: ISO (info bar) and DD/MM/YYYY HH:MM:SS (dialogs).
            for (const re of [
                /\d{4}-\d\d-\d\d/g,
                /\d\d\/\d\d\/\d\d\d\d/g,
                /\d\d:\d\d:\d\d/g,
            ]) {
                out = out.replace(re, (m) => '?'.repeat(m.length));
            }
            return out;
        });
    }

    // Labels of every open editor tab — for asserting that F4 opened a file.
    openTabs(): string[] {
        return vscode.window.tabGroups.all.flatMap((g) =>
            g.tabs.map((t) => t.label),
        );
    }
}

// Returns null when `actual` matches `reference` (with '?' as a wildcard in
// the reference), otherwise a human-readable description of the mismatches.
function diffGrid(reference: string[], actual: string[]): string | null {
    const out: string[] = [];
    const lineCount = Math.max(reference.length, actual.length);
    for (let y = 0; y < lineCount; y++) {
        const ref = reference[y] ?? '';
        const act = actual[y] ?? '';
        const width = Math.max(ref.length, act.length);
        let lineOk = ref.length === act.length;
        const marker: string[] = [];
        for (let x = 0; x < width; x++) {
            const r = ref[x];
            const a = act[x];
            if (r === '?' || (r === a && r !== undefined)) {
                marker.push(' ');
            } else {
                marker.push('^');
                lineOk = false;
            }
        }
        if (!lineOk) {
            out.push(`  line ${y + 1}:`);
            out.push(`    expected: |${ref}|`);
            out.push(`    actual:   |${act}|`);
            out.push(`              |${marker.join('')}|`);
        }
    }
    return out.length > 0 ? out.join('\n') : null;
}
