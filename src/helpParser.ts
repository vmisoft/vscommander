import * as fs from 'fs';
import * as path from 'path';

export interface HelpSpan {
    text: string;
    type: 'text' | 'hotkey' | 'link' | 'header';
    linkTarget?: string;
}

export interface HelpLine {
    spans: HelpSpan[];
    isHeader: boolean;
    isSeparator: boolean;
}

export interface HelpTopic {
    file: string;
    title: string;
}

export function loadHelpTopics(docsDir: string): HelpTopic[] {
    const contentsPath = path.join(docsDir, 'Contents.md');
    const topics: HelpTopic[] = [];
    try {
        const content = fs.readFileSync(contentsPath, 'utf-8');
        const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(content)) !== null) {
            topics.push({ file: m[2], title: m[1] });
        }
    } catch {
        // fallback: scan docs dir
        try {
            const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md') && f !== 'Contents.md').sort();
            for (const file of files) {
                const filePath = path.join(docsDir, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const firstLine = content.split('\n')[0] || '';
                    const title = firstLine.replace(/^#+\s*/, '').trim() || file.replace('.md', '');
                    topics.push({ file, title });
                } catch {
                    topics.push({ file, title: file.replace('.md', '') });
                }
            }
        } catch {
            // no docs dir
        }
    }
    return topics;
}

export function loadHelpFile(docsDir: string, filename: string): string {
    try {
        return fs.readFileSync(path.join(docsDir, filename), 'utf-8');
    } catch {
        return '# Not Found\n\nHelp topic "' + filename + '" could not be loaded.';
    }
}

function parseInlineSpans(text: string): HelpSpan[] {
    const spans: HelpSpan[] = [];
    const re = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > lastIndex) {
            spans.push({ text: text.slice(lastIndex, m.index), type: 'text' });
        }
        if (m[1] !== undefined) {
            spans.push({ text: m[1], type: 'hotkey' });
        } else if (m[2] !== undefined) {
            spans.push({ text: m[2], type: 'link', linkTarget: m[3] });
        }
        lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) {
        spans.push({ text: text.slice(lastIndex), type: 'text' });
    }
    return spans;
}

function wordWrapSpans(spans: HelpSpan[], wrapWidth: number): HelpLine[] {
    if (spans.length === 0) return [{ spans: [], isHeader: false, isSeparator: false }];

    const lines: HelpLine[] = [];
    let currentSpans: HelpSpan[] = [];
    let currentWidth = 0;

    for (const span of spans) {
        const words = span.text.split(/( +)/);
        for (const word of words) {
            if (word.length === 0) continue;
            if (currentWidth + word.length > wrapWidth && currentWidth > 0 && word.trim().length > 0) {
                lines.push({ spans: currentSpans, isHeader: false, isSeparator: false });
                currentSpans = [];
                currentWidth = 0;
                if (word.trim().length === 0) continue;
            }
            currentSpans.push({ text: word, type: span.type, linkTarget: span.linkTarget });
            currentWidth += word.length;
        }
    }
    if (currentSpans.length > 0) {
        lines.push({ spans: currentSpans, isHeader: false, isSeparator: false });
    }
    return lines;
}

export function parseHelpFile(content: string, wrapWidth: number): HelpLine[] {
    const rawLines = content.split('\n');
    const result: HelpLine[] = [];

    for (const raw of rawLines) {
        const trimmed = raw.trimEnd();

        if (trimmed === '' || trimmed === '\r') {
            result.push({ spans: [], isHeader: false, isSeparator: false });
            continue;
        }

        if (/^---+\s*$/.test(trimmed)) {
            result.push({ spans: [], isHeader: false, isSeparator: true });
            continue;
        }

        const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headerMatch) {
            const headerText = headerMatch[2];
            const spans = parseInlineSpans(headerText);
            for (const s of spans) {
                if (s.type === 'text') s.type = 'header';
            }
            result.push({ spans, isHeader: true, isSeparator: false });
            continue;
        }

        const inlineSpans = parseInlineSpans(trimmed);
        const wrapped = wordWrapSpans(inlineSpans, wrapWidth);
        for (const line of wrapped) {
            result.push(line);
        }
    }

    return result;
}
