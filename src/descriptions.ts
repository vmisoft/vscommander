import * as fs from 'fs';
import * as path from 'path';
import { DirEntry } from './types';

function parseDizFile(filePath: string): Map<string, string> {
    const result = new Map<string, string>();
    let content: string;
    try {
        const buf = fs.readFileSync(filePath);
        if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
            content = buf.slice(3).toString('utf-8');
        } else {
            content = buf.toString('utf-8');
            if (content.includes('\uFFFD')) {
                content = buf.toString('latin1');
            }
        }
    } catch {
        return result;
    }

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        if (line.length === 0) continue;
        if (line[0] === ' ' || line[0] === '\t') continue;

        let filename: string;
        let desc: string;

        if (line[0] === '"') {
            const closeQuote = line.indexOf('"', 1);
            if (closeQuote < 0) continue;
            filename = line.substring(1, closeQuote);
            desc = line.substring(closeQuote + 1).trimStart();
        } else {
            const spaceIdx = line.search(/\s/);
            if (spaceIdx < 0) continue;
            filename = line.substring(0, spaceIdx);
            desc = line.substring(spaceIdx).trimStart();
        }

        desc = desc.replace(/^[\d,.]+\s+/, '');
        desc = desc.trim();
        if (filename.length > 0 && desc.length > 0) {
            result.set(filename.toLowerCase(), desc);
        }
    }

    return result;
}

function findDizFile(dirPath: string): string | undefined {
    const exact = path.join(dirPath, 'descript.ion');
    try {
        fs.accessSync(exact, fs.constants.R_OK);
        return exact;
    } catch { /* not found */ }

    try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            if (item.toLowerCase() === 'descript.ion') {
                return path.join(dirPath, item);
            }
        }
    } catch { /* can't read dir */ }

    return undefined;
}

function readmeFirstLine(dirPath: string): string | undefined {
    const candidates = ['readme.txt', 'readme.md', 'README.txt', 'README.md', 'README'];
    for (const name of candidates) {
        const full = path.join(dirPath, name);
        try {
            const fd = fs.openSync(full, 'r');
            try {
                const buf = Buffer.alloc(4096);
                const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
                const text = buf.slice(0, bytesRead).toString('utf-8');
                const lines = text.split(/\r?\n/);
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.length > 0) {
                        return trimmed;
                    }
                }
            } finally {
                fs.closeSync(fd);
            }
        } catch { /* skip */ }
    }
    return undefined;
}

export function loadDescriptions(dirPath: string, entries: DirEntry[]): Map<string, string> {
    const result = new Map<string, string>();

    const dizPath = findDizFile(dirPath);
    if (dizPath) {
        const dizMap = parseDizFile(dizPath);
        for (const [key, value] of dizMap) {
            result.set(key, value);
        }
    }

    for (const entry of entries) {
        if (entry.name === '..') continue;
        if (!entry.isDir) continue;
        if (result.has(entry.name.toLowerCase())) continue;
        const line = readmeFirstLine(path.join(dirPath, entry.name));
        if (line) {
            result.set(entry.name.toLowerCase(), line);
        }
    }

    return result;
}
