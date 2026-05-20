import { resetStyle, moveTo } from '../../draw';
import { Theme } from '../../settings';
import { applyStyle, formatSizeComma, truncatePath } from '../../helpers';

export interface ViewerTitleState {
    hexMode: boolean;
    encodingLabel: string;
    fileSize: number;
    scrollLeft: number;
    fileName: string;
    percent: number;
}

// The viewer's top status/title bar: file name on the left, mode / encoding /
// size / column / percentage status on the right.
export class ViewerTitleBar {
    render(cols: number, theme: Theme, st: ViewerTitleState): string {
        const statusStyle = applyStyle(theme.viewerStatus.idle);

        const mode = st.hexMode ? 'h' : 't';
        const sizeStr = formatSizeComma(st.fileSize);
        const colStr = 'Col ' + String(st.scrollLeft).padStart(3, ' ');
        const pctStr = String(st.percent) + '%';

        const statusPart = '│' + mode + '│' + st.encodingLabel + '│'
            + sizeStr.padStart(10, ' ') + '│' + colStr + '│'
            + pctStr.padStart(4, ' ');
        const statusLen = statusPart.length;

        const maxNameLen = cols - statusLen - 1;
        let nameStr = st.fileName;
        if (nameStr.length > maxNameLen) {
            nameStr = truncatePath(nameStr, maxNameLen);
        }
        const gap = Math.max(0, cols - nameStr.length - statusLen);

        return statusStyle + moveTo(1, 1) + nameStr + ' '.repeat(gap) + statusPart + resetStyle();
    }
}
