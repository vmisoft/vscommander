import { ComposedPopup } from '../../components/composedPopup';
import { Theme } from '../../settings';
import { PermissionGrid } from './permissionGrid';
import { TimestampField } from './timestampField';
import { UserDropdown } from './userDropdown';
import { GroupDropdown } from './groupDropdown';

// The current attributes of the target, used to pre-fill the dialog.
export interface AttrModel {
    name: string;    // display name of the (first) target
    count: number;   // number of targets
    hasDir: boolean; // any target is a directory (enables the recurse option)
    mode: number;    // permission bits (mode & 0o7777)
    uid: number;
    gid: number;
}

export interface AttrResult {
    mode: number;
    ownerUid: number | undefined;       // resolved uid, or undefined if unparseable
    groupGid: number | undefined;
    mtime: Date | 'invalid' | undefined; // undefined = leave unchanged
    atime: Date | 'invalid' | undefined;
    recurse: boolean;
}

const DIALOG_WIDTH = 64;
const LABEL_WIDTH = 16;

// File attributes window (Ctrl+A) — POSIX variant. See specs/file-attributes.md.
// Assembled entirely from components: a PermissionGrid, two id dropdowns and
// two timestamp fields, each a hierarchy of generic components.
export class AttrPopup extends ComposedPopup {
    private permGrid!: PermissionGrid;
    private ownerSelector!: UserDropdown;
    private groupSelector!: GroupDropdown;
    private mtimeField!: TimestampField;
    private atimeField!: TimestampField;
    private recurseEnabled = false;

    openWith(model: AttrModel, cols: number): void {
        const width = Math.min(DIALOG_WIDTH, cols - 4);
        const fieldWidth = width - 2 - LABEL_WIDTH - 6;
        this.recurseEnabled = model.hasDir;

        this.permGrid = new PermissionGrid(model.mode);
        this.ownerSelector = new UserDropdown('Owner:', LABEL_WIDTH, fieldWidth, model.uid);
        this.groupSelector = new GroupDropdown('Group:', LABEL_WIDTH, fieldWidth, model.gid);
        this.mtimeField = new TimestampField('Change modified time');
        this.atimeField = new TimestampField('Change accessed time');

        const view = this.createView('File attributes');
        view.minWidth = width;

        const header = model.count > 1
            ? `Change attributes for ${model.count} selected items`
            : `Change attributes for: ${model.name}`;
        view.addLabel(header);
        view.addSeparator();
        view.addComponent(this.permGrid, 'perms');
        view.addSeparator();
        view.addComponent(this.ownerSelector, 'owner');
        view.addComponent(this.groupSelector, 'group');
        view.addSeparator();
        view.addComponent(this.mtimeField, 'mtime');
        view.addComponent(this.atimeField, 'atime');
        view.addSeparator();
        if (this.recurseEnabled) {
            view.addCheckbox('recurse', 'Apply changes to directory contents', false, 'r');
            view.addSeparator();
        }
        view.addButtons('buttons', ['Set', 'Cancel']);

        view.onConfirm = () => {
            // A timestamp field that is enabled but not a valid date blocks
            // Set — the dialog stays open with "(invalid)" shown.
            if (this.mtimeField.getValue() === 'invalid'
                || this.atimeField.getValue() === 'invalid') {
                return { action: 'consumed' };
            }
            return this.closeWithConfirm();
        };
        view.onCancel = () => {
            this.close();
            return { action: 'close', confirm: false };
        };

        this.setActiveView(view);
        super.open();
    }

    renderAttrBlink(rows: number, cols: number, theme: Theme): string {
        return this.renderBlink(rows, cols, theme);
    }

    resetAttrBlink(): void {
        if (this.activeView) {
            this.activeView.resetBlinks();
        }
    }

    get result(): AttrResult {
        const view = this.activeView!;
        let recurse = false;
        if (this.recurseEnabled) {
            recurse = view.checkbox('recurse').checked;
        }
        return {
            mode: this.permGrid.mode,
            ownerUid: this.ownerSelector.resolvedId(),
            groupGid: this.groupSelector.resolvedId(),
            mtime: this.mtimeField.getValue(),
            atime: this.atimeField.getValue(),
            recurse,
        };
    }
}
