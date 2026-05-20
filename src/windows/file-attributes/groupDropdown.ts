import { readGroupMap } from '../../fileOps';
import { IdSelector } from './idSelector';

// The Group field: an IdSelector pre-loaded with /etc/group group names.
export class GroupDropdown extends IdSelector {
    constructor(label: string, labelWidth: number, width: number, initialGid: number) {
        super(label, labelWidth, width, initialGid, readGroupMap());
    }
}
