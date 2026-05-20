import { SortMode } from '../../types';
import { CHECK_MARK, SORT_ASC, SORT_DESC } from '../../visualPrimitives';
import { OptionList, OptionListItem } from '../../components/optionList';

export interface SortItem {
    type: 'item' | 'separator';
    label?: string;
    hotkeyIndex?: number;
    shortcut?: string;
    mode?: SortMode;
    toggle?: 'dirsFirst' | 'sortGroups' | 'selectedFirst';
}

// The sort-modes menu list: an OptionList whose left mark column shows a sort
// arrow on the active mode and a check mark on enabled toggles.
export class SortModeList extends OptionList {
    readonly sortItems: SortItem[];
    sortMode: SortMode = 'name';
    sortReversed = false;
    useSortGroups = false;
    selectedFirst = false;
    dirsFirst = true;

    constructor(sortItems: SortItem[]) {
        super(sortItems.map<OptionListItem>((it) => ({
            separator: it.type === 'separator',
            label: it.label,
            hotkeyIndex: it.hotkeyIndex,
            shortcut: it.shortcut,
        })));
        this.sortItems = sortItems;
    }

    protected markFor(index: number): string {
        const item = this.sortItems[index];
        if (item.mode && item.mode === this.sortMode) {
            return this.sortReversed ? SORT_DESC : SORT_ASC;
        }
        if (item.toggle === 'dirsFirst' && this.dirsFirst) return CHECK_MARK;
        if (item.toggle === 'sortGroups' && this.useSortGroups) return CHECK_MARK;
        if (item.toggle === 'selectedFirst' && this.selectedFirst) return CHECK_MARK;
        return ' ';
    }

    current(): SortItem {
        return this.sortItems[this.selected];
    }

    selectCurrentMode(): void {
        for (let i = 0; i < this.sortItems.length; i++) {
            if (this.sortItems[i].mode === this.sortMode) {
                this.selected = i;
                return;
            }
        }
        this.selected = this.firstSelectable();
    }
}
