import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

// File attributes feature (Ctrl+A) - the redesigned dialog: an rwx permission
// grid, owner/group combos, and masked timestamp fields. See
// specs/file-attributes.md.
// panel1 entries sorted: '..', 'tree', 'multi-a.txt', 'multi-b.txt', 'report.txt'.
suite('037 - file attributes', () => {
    async function cursorToReport(harness: Harness): Promise<void> {
        harness.send(KEY.home);
        for (let i = 0; i < 4; i++) {
            await harness.sendAndSettle(KEY.down);
        }
    }

    test('Ctrl+A opens the file attributes dialog', async () => {
        const harness = await Harness.launch(__dirname);
        await cursorToReport(harness);
        await harness.sendAndSettle(KEY.ctrlA);
        await harness.expectScreenshot('dialog-open');
    });

    test('Tab cycles focus through the dialog', async () => {
        const harness = await Harness.launch(__dirname);
        await cursorToReport(harness);
        await harness.sendAndSettle(KEY.ctrlA);
        // Each of the 12 permission checkboxes is its own Tab stop; Tab past
        // them all reaches the owner combo.
        for (let i = 0; i < 12; i++) {
            await harness.sendAndSettle(KEY.tab);
        }
        await harness.expectScreenshot('focus-owner');
        await harness.sendAndSettle(KEY.tab); // -> group combo
        await harness.sendAndSettle(KEY.tab); // -> modified field
        await harness.expectScreenshot('focus-modified');
    });

    test('Escape closes the dialog with no change', async () => {
        const harness = await Harness.launch(__dirname);
        await cursorToReport(harness);
        await harness.sendAndSettle(KEY.ctrlA);
        await harness.sendAndSettle(KEY.esc);
        await harness.expectScreenshot('after-escape');
        const mode = fs.statSync(path.join(harness.panel1Dir, 'report.txt')).mode & 0o777;
        assert.strictEqual(mode, 0o644, 'permissions left unchanged after cancel');
    });

    test('toggling a permission bit applies chmod', async () => {
        const harness = await Harness.launch(__dirname);
        await cursorToReport(harness);
        await harness.sendAndSettle(KEY.ctrlA);
        // Grid cursor starts at Owner-Read; move to Owner-Execute and toggle.
        harness.send(KEY.right);
        harness.send(KEY.right);
        await harness.sendAndSettle(KEY.space);
        await harness.expectScreenshot('owner-exec-toggled');
        await harness.sendAndSettle(KEY.enter, 400);

        const mode = fs.statSync(path.join(harness.panel1Dir, 'report.txt')).mode & 0o777;
        assert.strictEqual(mode, 0o744, 'owner execute bit added (644 -> 744)');
    });

    test('recurse applies the change to directory contents', async () => {
        const harness = await Harness.launch(__dirname);
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> 'tree'
        await harness.sendAndSettle(KEY.ctrlA);
        // Grid cursor at Owner-Read; move to Other-Write and toggle on (755 -> 757).
        harness.send(KEY.down);
        harness.send(KEY.down);
        harness.send(KEY.right);
        await harness.sendAndSettle(KEY.space);
        // Tab from Other-Write through the remaining grid cells, owner, group,
        // modified and accessed fields to reach the recurse checkbox.
        for (let i = 0; i < 9; i++) {
            await harness.sendAndSettle(KEY.tab);
        }
        await harness.sendAndSettle(KEY.space); // tick "Apply to directory contents"
        await harness.sendAndSettle(KEY.enter, 400);

        const childMode = fs.statSync(
            path.join(harness.panel1Dir, 'tree', 'child.txt'),
        ).mode & 0o777;
        assert.strictEqual(childMode, 0o757, 'change recursed into the directory');
    });

    test('acts on a multi-file selection', async () => {
        const harness = await Harness.launch(__dirname);
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // 'tree'
        await harness.sendAndSettle(KEY.down); // 'multi-a.txt'
        await harness.sendAndSettle(KEY.insert); // select multi-a
        await harness.sendAndSettle(KEY.insert); // select multi-b
        await harness.sendAndSettle(KEY.ctrlA);
        await harness.expectScreenshot('multi-dialog');
        harness.send(KEY.right);
        harness.send(KEY.right);
        await harness.sendAndSettle(KEY.space); // Owner-Execute on
        await harness.sendAndSettle(KEY.enter, 400);

        for (const name of ['multi-a.txt', 'multi-b.txt']) {
            const mode = fs.statSync(path.join(harness.panel1Dir, name)).mode & 0o777;
            assert.strictEqual(mode, 0o744, `${name} owner execute bit added`);
        }
    });

    test('a masked timestamp field sets the modification time', async () => {
        const harness = await Harness.launch(__dirname);
        await cursorToReport(harness);
        await harness.sendAndSettle(KEY.ctrlA);
        // Tab through the 12 grid cells, owner and group to the modified field.
        for (let i = 0; i < 14; i++) {
            await harness.sendAndSettle(KEY.tab);
        }
        await harness.sendAndSettle(KEY.space);          // enable the field
        await harness.type('20200102030405');            // 2020-01-02 03:04:05
        await harness.expectScreenshot('modified-typed');
        await harness.sendAndSettle(KEY.enter, 400);

        const mtime = fs.statSync(path.join(harness.panel1Dir, 'report.txt')).mtime;
        const expected = new Date(2020, 0, 2, 3, 4, 5);
        assert.strictEqual(
            Math.floor(mtime.getTime() / 1000),
            Math.floor(expected.getTime() / 1000),
            'modification time set from the masked field',
        );
    });

    test('an invalid masked date blocks Set', async () => {
        const harness = await Harness.launch(__dirname);
        await cursorToReport(harness);
        await harness.sendAndSettle(KEY.ctrlA);
        for (let i = 0; i < 14; i++) {
            await harness.sendAndSettle(KEY.tab);
        }
        await harness.sendAndSettle(KEY.space);   // enable the field
        await harness.type('99999999999999');     // not a real date
        await harness.sendAndSettle(KEY.enter, 300);
        // Set is refused: the dialog is still open showing "(invalid)".
        await harness.expectScreenshot('invalid-blocks-set');
    });
});
