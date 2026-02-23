import * as path from 'path';

export interface UserMenuItem {
    hotkey: string;
    label: string;
    commands: string[];
    submenu: boolean;
    children: UserMenuItem[];
}

export type MenuScope = 'user' | 'workspace';
export type MenuViewMode = 'all' | 'user' | 'workspace';

export interface ScopedMenuItem extends UserMenuItem {
    scope: MenuScope;
    children: ScopedMenuItem[];
}

export interface SubstContext {
    activeCwd: string;
    activeFile: string;
    activeFileName: string;
    activeExtension: string;
    passiveCwd: string;
    passiveFile: string;
    selectedFiles: string[];
    passiveSelectedFiles: string[];
}

export interface PromptRequest {
    title: string;
    initialValue: string;
}

export function mergeMenuItems(userItems: UserMenuItem[], workspaceItems: UserMenuItem[]): ScopedMenuItem[] {
    const result: ScopedMenuItem[] = [];
    for (const item of userItems) {
        result.push(tagScope(item, 'user'));
    }
    for (const item of workspaceItems) {
        result.push(tagScope(item, 'workspace'));
    }
    return result;
}

function tagScope(item: UserMenuItem, scope: MenuScope): ScopedMenuItem {
    return {
        ...item,
        scope,
        children: item.children.map(c => tagScope(c, scope)),
    };
}

export function substituteVariables(
    command: string,
    ctx: SubstContext,
    promptValues?: Map<string, string>,
): { result: string; prompts: PromptRequest[] } {
    const prompts: PromptRequest[] = [];
    let out = '';
    let i = 0;
    while (i < command.length) {
        if (command[i] !== '!') {
            out += command[i];
            i++;
            continue;
        }

        if (i + 1 >= command.length) {
            out += '!';
            i++;
            continue;
        }

        if (command[i + 1] === '!') {
            out += '!';
            i += 2;
            continue;
        }

        if (command[i + 1] === '.' && i + 2 < command.length && command[i + 2] === '!') {
            out += ctx.activeFile;
            i += 3;
            continue;
        }

        if (command[i + 1] === '.') {
            const afterDot = i + 2 < command.length ? command[i + 2] : '';
            if (afterDot === '' || /\W/.test(afterDot)) {
                out += ctx.activeFileName;
                i += 2;
                continue;
            }
        }

        if (command[i + 1] === '`') {
            out += ctx.activeExtension;
            i += 2;
            continue;
        }

        if (command[i + 1] === '\\') {
            out += ctx.activeCwd + path.sep;
            i += 2;
            continue;
        }

        if (command[i + 1] === '#') {
            if (i + 2 < command.length && command[i + 2] === '\\') {
                out += ctx.passiveCwd + path.sep;
                i += 3;
                continue;
            }
            out += ctx.passiveFile;
            i += 2;
            continue;
        }

        if (command[i + 1] === '&') {
            const files = ctx.selectedFiles.length > 0
                ? ctx.selectedFiles
                : [ctx.activeFile];
            out += files.map(f => '"' + f + '"').join(' ');
            i += 2;
            continue;
        }

        if (command[i + 1] === '?') {
            const rest = command.slice(i + 2);
            const endIdx = rest.indexOf('!');
            if (endIdx >= 0) {
                const inner = rest.slice(0, endIdx);
                const qIdx = inner.indexOf('?');
                let title: string;
                let init: string;
                if (qIdx >= 0) {
                    title = inner.slice(0, qIdx);
                    init = inner.slice(qIdx + 1);
                } else {
                    title = inner;
                    init = '';
                }
                const key = title + '?' + init;
                if (promptValues && promptValues.has(key)) {
                    out += promptValues.get(key)!;
                } else {
                    prompts.push({ title, initialValue: init });
                }
                i += 2 + endIdx + 1;
                continue;
            }
        }

        out += '!';
        i++;
    }
    return { result: out, prompts };
}

export function isCommentLine(line: string): boolean {
    const trimmed = line.trimStart();
    return trimmed.startsWith('REM ') || trimmed.startsWith('rem ')
        || trimmed.startsWith('::');
}

export function formatHotkeyDisplay(hotkey: string): string {
    if (hotkey.startsWith('F') && hotkey.length > 1 && /^\d+$/.test(hotkey.slice(1))) {
        return hotkey.padEnd(4);
    }
    return hotkey.padEnd(4);
}

export function normalizeMenuItem(raw: Record<string, unknown>): UserMenuItem {
    return {
        hotkey: typeof raw.hotkey === 'string' ? raw.hotkey : '',
        label: typeof raw.label === 'string' ? raw.label : '',
        commands: Array.isArray(raw.commands) ? raw.commands.filter((c: unknown) => typeof c === 'string') : [],
        submenu: raw.submenu === true,
        children: Array.isArray(raw.children)
            ? raw.children.map((c: unknown) => normalizeMenuItem(c as Record<string, unknown>))
            : [],
    };
}
