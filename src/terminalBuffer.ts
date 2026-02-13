export class TerminalBuffer {
    private grid: string[][];
    private styleGrid: string[][];
    private currentStyle = '';
    private curRow = 0;
    private curCol = 0;
    private rows: number;
    private cols: number;
    private state: 'normal' | 'escape' | 'csi' | 'osc' = 'normal';
    private csiBuffer = '';
    private savedCurRow = 0;
    private savedCurCol = 0;
    private scrollTop = 0;
    private scrollBottom: number;

    constructor(cols: number, rows: number) {
        this.rows = rows;
        this.cols = cols;
        this.scrollBottom = rows - 1;
        this.grid = [];
        this.styleGrid = [];
        for (let r = 0; r < rows; r++) {
            this.grid.push(new Array(cols).fill(' '));
            this.styleGrid.push(new Array(cols).fill(''));
        }
    }

    feed(data: string): void {
        for (let i = 0; i < data.length; i++) {
            const ch = data[i];
            const code = ch.charCodeAt(0);

            switch (this.state) {
                case 'normal':
                    if (code === 0x1b) {
                        this.state = 'escape';
                    } else if (code === 0x0d) {
                        this.curCol = 0;
                    } else if (code === 0x0a) {
                        this.lineFeed();
                    } else if (code === 0x08) {
                        if (this.curCol > 0) this.curCol--;
                    } else if (code === 0x09) {
                        this.curCol = Math.min(this.cols - 1, (Math.floor(this.curCol / 8) + 1) * 8);
                    } else if (code === 0x07 || code < 0x20) {
                        // ignore bell and other control chars
                    } else if (code >= 0x20) {
                        if (this.curCol >= this.cols) {
                            this.curCol = 0;
                            this.lineFeed();
                        }
                        this.grid[this.curRow][this.curCol] = ch;
                        this.styleGrid[this.curRow][this.curCol] = this.currentStyle;
                        this.curCol++;
                    }
                    break;

                case 'escape':
                    if (ch === '[') {
                        this.state = 'csi';
                        this.csiBuffer = '';
                    } else if (ch === ']') {
                        this.state = 'osc';
                    } else if (ch === '(' || ch === ')' || ch === '#' || ch === '%') {
                        i++;
                        this.state = 'normal';
                    } else if (ch === '7') {
                        this.savedCurRow = this.curRow;
                        this.savedCurCol = this.curCol;
                        this.state = 'normal';
                    } else if (ch === '8') {
                        this.curRow = this.savedCurRow;
                        this.curCol = this.savedCurCol;
                        this.state = 'normal';
                    } else if (ch === 'M') {
                        if (this.curRow > this.scrollTop) {
                            this.curRow--;
                        } else {
                            this.scrollDown();
                        }
                        this.state = 'normal';
                    } else if (ch === 'D') {
                        this.lineFeed();
                        this.state = 'normal';
                    } else if (ch === 'E') {
                        this.curCol = 0;
                        this.lineFeed();
                        this.state = 'normal';
                    } else if (ch === 'c') {
                        this.reset();
                        this.state = 'normal';
                    } else {
                        this.state = 'normal';
                    }
                    break;

                case 'csi':
                    if ((ch >= '0' && ch <= '9') || ch === ';' || ch === '?' || ch === '>' || ch === '=' || ch === '!' || ch === '"' || ch === ' ' || ch === '\'') {
                        this.csiBuffer += ch;
                    } else {
                        this.executeCsi(ch);
                        this.state = 'normal';
                    }
                    break;

                case 'osc':
                    if (code === 0x07) {
                        this.state = 'normal';
                    } else if (code === 0x1b) {
                        if (i + 1 < data.length && data[i + 1] === '\\') {
                            i++;
                            this.state = 'normal';
                        } else {
                            this.state = 'escape';
                        }
                    }
                    break;
            }
        }
    }

    private parseCsiParams(): number[] {
        const clean = this.csiBuffer.replace(/^[?>=!" ']*/, '');
        if (clean === '') return [];
        return clean.split(';').map(s => {
            const n = parseInt(s, 10);
            return isNaN(n) ? 0 : n;
        });
    }

    private isPrivate(): boolean {
        return this.csiBuffer.length > 0 && '?>='.indexOf(this.csiBuffer[0]) >= 0;
    }

    private executeCsi(finalChar: string): void {
        if (this.isPrivate() && (finalChar === 'h' || finalChar === 'l')) {
            return;
        }

        const params = this.parseCsiParams();
        const p0 = params[0] || 0;

        switch (finalChar) {
            case 'A':
                this.curRow = Math.max(this.scrollTop, this.curRow - Math.max(1, p0));
                break;
            case 'B':
                this.curRow = Math.min(this.scrollBottom, this.curRow + Math.max(1, p0));
                break;
            case 'C':
                this.curCol = Math.min(this.cols - 1, this.curCol + Math.max(1, p0));
                break;
            case 'D':
                this.curCol = Math.max(0, this.curCol - Math.max(1, p0));
                break;
            case 'E':
                this.curCol = 0;
                this.curRow = Math.min(this.scrollBottom, this.curRow + Math.max(1, p0));
                break;
            case 'F':
                this.curCol = 0;
                this.curRow = Math.max(this.scrollTop, this.curRow - Math.max(1, p0));
                break;
            case 'G':
                this.curCol = Math.min(this.cols - 1, Math.max(0, Math.max(1, p0) - 1));
                break;
            case 'H':
            case 'f':
                this.curRow = Math.min(this.rows - 1, Math.max(0, (params[0] || 1) - 1));
                this.curCol = Math.min(this.cols - 1, Math.max(0, (params[1] || 1) - 1));
                break;
            case 'd':
                this.curRow = Math.min(this.rows - 1, Math.max(0, Math.max(1, p0) - 1));
                break;
            case 'J':
                if (p0 === 0) {
                    this.clearRange(this.curRow, this.curCol, this.rows - 1, this.cols - 1);
                } else if (p0 === 1) {
                    this.clearRange(0, 0, this.curRow, this.curCol);
                } else if (p0 === 2 || p0 === 3) {
                    this.clearAll();
                }
                break;
            case 'K':
                if (p0 === 0) {
                    this.clearRange(this.curRow, this.curCol, this.curRow, this.cols - 1);
                } else if (p0 === 1) {
                    this.clearRange(this.curRow, 0, this.curRow, this.curCol);
                } else if (p0 === 2) {
                    this.clearRange(this.curRow, 0, this.curRow, this.cols - 1);
                }
                break;
            case 'r':
                this.scrollTop = Math.max(0, (params[0] || 1) - 1);
                this.scrollBottom = Math.min(this.rows - 1, (params[1] || this.rows) - 1);
                this.curRow = 0;
                this.curCol = 0;
                break;
            case 'L': {
                const n = Math.max(1, p0);
                for (let j = 0; j < n; j++) {
                    if (this.scrollBottom < this.grid.length) {
                        this.grid.splice(this.scrollBottom, 1);
                        this.styleGrid.splice(this.scrollBottom, 1);
                    }
                    this.grid.splice(this.curRow, 0, new Array(this.cols).fill(' '));
                    this.styleGrid.splice(this.curRow, 0, new Array(this.cols).fill(''));
                }
                break;
            }
            case 'M': {
                const n = Math.max(1, p0);
                for (let j = 0; j < n; j++) {
                    this.grid.splice(this.curRow, 1);
                    this.grid.splice(this.scrollBottom, 0, new Array(this.cols).fill(' '));
                    this.styleGrid.splice(this.curRow, 1);
                    this.styleGrid.splice(this.scrollBottom, 0, new Array(this.cols).fill(''));
                }
                break;
            }
            case 'P': {
                const n = Math.max(1, p0);
                const row = this.grid[this.curRow];
                const srow = this.styleGrid[this.curRow];
                row.splice(this.curCol, n);
                srow.splice(this.curCol, n);
                while (row.length < this.cols) row.push(' ');
                while (srow.length < this.cols) srow.push('');
                break;
            }
            case '@': {
                const n = Math.max(1, p0);
                const row = this.grid[this.curRow];
                const srow = this.styleGrid[this.curRow];
                for (let j = 0; j < n; j++) {
                    row.splice(this.curCol, 0, ' ');
                    srow.splice(this.curCol, 0, '');
                }
                row.length = this.cols;
                srow.length = this.cols;
                break;
            }
            case 'X': {
                const n = Math.max(1, p0);
                for (let j = 0; j < n && this.curCol + j < this.cols; j++) {
                    this.grid[this.curRow][this.curCol + j] = ' ';
                    this.styleGrid[this.curRow][this.curCol + j] = '';
                }
                break;
            }
            case 'S': {
                const n = Math.max(1, p0);
                for (let j = 0; j < n; j++) this.scrollUp();
                break;
            }
            case 'T': {
                const n = Math.max(1, p0);
                for (let j = 0; j < n; j++) this.scrollDown();
                break;
            }
            case 'm': {
                const raw = '\x1b[' + this.csiBuffer + 'm';
                if (this.csiBuffer === '' || this.csiBuffer === '0') {
                    this.currentStyle = '';
                } else {
                    this.currentStyle += raw;
                }
                break;
            }
            // h, l, n, s, u, t and others: ignore
        }
    }

    private lineFeed(): void {
        if (this.curRow >= this.scrollBottom) {
            this.scrollUp();
        } else {
            this.curRow++;
        }
    }

    private scrollUp(): void {
        this.grid.splice(this.scrollTop, 1);
        this.grid.splice(this.scrollBottom, 0, new Array(this.cols).fill(' '));
        this.styleGrid.splice(this.scrollTop, 1);
        this.styleGrid.splice(this.scrollBottom, 0, new Array(this.cols).fill(''));
    }

    private scrollDown(): void {
        this.grid.splice(this.scrollBottom, 1);
        this.grid.splice(this.scrollTop, 0, new Array(this.cols).fill(' '));
        this.styleGrid.splice(this.scrollBottom, 1);
        this.styleGrid.splice(this.scrollTop, 0, new Array(this.cols).fill(''));
    }

    private clearRange(r1: number, c1: number, r2: number, c2: number): void {
        for (let r = r1; r <= r2 && r < this.rows; r++) {
            const startC = r === r1 ? c1 : 0;
            const endC = r === r2 ? c2 : this.cols - 1;
            for (let c = startC; c <= endC && c < this.cols; c++) {
                this.grid[r][c] = ' ';
                this.styleGrid[r][c] = '';
            }
        }
    }

    private clearAll(): void {
        for (let r = 0; r < this.rows; r++) {
            this.grid[r].fill(' ');
            this.styleGrid[r].fill('');
        }
        this.curRow = 0;
        this.curCol = 0;
    }

    private reset(): void {
        this.clearAll();
        this.currentStyle = '';
        this.scrollTop = 0;
        this.scrollBottom = this.rows - 1;
        this.savedCurRow = 0;
        this.savedCurCol = 0;
    }

    getRow(n: number): string {
        if (n < 0 || n >= this.rows) return '';
        return this.grid[n].join('');
    }

    getStyledRow(n: number): string {
        if (n < 0 || n >= this.rows) return '';
        const chars = this.grid[n];
        const styles = this.styleGrid[n];
        let out = '\x1b[0m';
        let lastStyle = '';
        for (let i = 0; i < this.cols; i++) {
            if (styles[i] !== lastStyle) {
                out += '\x1b[0m' + styles[i];
                lastStyle = styles[i];
            }
            out += chars[i];
        }
        out += '\x1b[0m';
        return out;
    }

    getStyledRowSlice(n: number, start: number, len: number): string {
        if (n < 0 || n >= this.rows) return ' '.repeat(len);
        const chars = this.grid[n];
        const styles = this.styleGrid[n];
        let out = '\x1b[0m';
        let lastStyle = '';
        const end = Math.min(start + len, this.cols);
        for (let i = start; i < end; i++) {
            if (styles[i] !== lastStyle) {
                out += '\x1b[0m' + styles[i];
                lastStyle = styles[i];
            }
            out += chars[i];
        }
        out += '\x1b[0m';
        const produced = end - start;
        if (produced < len) {
            out += ' '.repeat(len - produced);
        }
        return out;
    }

    getCursorRow(): number { return this.curRow; }
    getCursorCol(): number { return this.curCol; }
    getRowCount(): number { return this.rows; }
    getColCount(): number { return this.cols; }

    resize(cols: number, rows: number): void {
        const newGrid: string[][] = [];
        const newStyleGrid: string[][] = [];
        for (let r = 0; r < rows; r++) {
            if (r < this.rows && this.grid[r]) {
                const row = this.grid[r].slice(0, cols);
                while (row.length < cols) row.push(' ');
                newGrid.push(row);
                const srow = this.styleGrid[r].slice(0, cols);
                while (srow.length < cols) srow.push('');
                newStyleGrid.push(srow);
            } else {
                newGrid.push(new Array(cols).fill(' '));
                newStyleGrid.push(new Array(cols).fill(''));
            }
        }
        this.grid = newGrid;
        this.styleGrid = newStyleGrid;
        this.rows = rows;
        this.cols = cols;
        if (this.scrollBottom >= rows) this.scrollBottom = rows - 1;
        if (this.scrollTop >= rows) this.scrollTop = 0;
        if (this.curRow >= rows) this.curRow = rows - 1;
        if (this.curCol >= cols) this.curCol = cols - 1;
    }
}
