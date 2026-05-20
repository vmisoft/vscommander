import { readUserMap } from '../../fileOps';
import { IdSelector } from './idSelector';

// The Owner field: an IdSelector pre-loaded with /etc/passwd user names.
export class UserDropdown extends IdSelector {
    constructor(label: string, labelWidth: number, width: number, initialUid: number) {
        super(label, labelWidth, width, initialUid, readUserMap());
    }
}
