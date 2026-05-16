import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

// Coverage for the Make Directory feature, derived from specs/make-directory.md
// (the far-feature-spec skill's spec of Far Manager's F7 dialog).
// The mkdir-over-existing-file error path is covered by test 035.
suite('036 - make directory coverage', () => {
    test('F7 opens the make-directory dialog', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.sendAndSettle(KEY.f7);
        await harness.expectScreenshot('dialog-open');
    });

    test('Tab cycles focus through the dialog controls', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.sendAndSettle(KEY.f7);
        await harness.sendAndSettle(KEY.tab);
        await harness.expectScreenshot('focus-after-1-tab');
        await harness.sendAndSettle(KEY.tab);
        await harness.expectScreenshot('focus-after-2-tabs');
        await harness.sendAndSettle(KEY.tab);
        await harness.expectScreenshot('focus-after-3-tabs');
    });

    test('Escape cancels the dialog', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.sendAndSettle(KEY.f7);
        await harness.sendAndSettle(KEY.esc);
        await harness.expectScreenshot('dialog-cancelled');
    });

    test('creates a nested directory tree', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.sendAndSettle(KEY.f7);
        await harness.type('alpha/beta/gamma');
        await harness.sendAndSettle(KEY.enter, 400);
        await harness.expectScreenshot('nested-created');

        const deep = path.join(harness.panel1Dir, 'alpha', 'beta', 'gamma');
        assert.ok(
            fs.existsSync(deep) && fs.statSync(deep).isDirectory(),
            'every nested level was created',
        );
    });

    test('Process multiple names creates several directories', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.sendAndSettle(KEY.f7);
        await harness.type('one;two;three');
        // name -> link type -> target -> "Process multiple names" checkbox.
        await harness.sendAndSettle(KEY.tab);
        await harness.sendAndSettle(KEY.tab);
        await harness.sendAndSettle(KEY.tab);
        await harness.sendAndSettle(KEY.space);
        await harness.sendAndSettle(KEY.enter, 400);
        await harness.expectScreenshot('multiple-created');

        for (const name of ['one', 'two', 'three']) {
            assert.ok(
                fs.existsSync(path.join(harness.panel1Dir, name)),
                `directory "${name}" was created`,
            );
        }
    });

    test('the link-type dropdown can be changed', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.sendAndSettle(KEY.f7);
        await harness.sendAndSettle(KEY.tab);   // focus -> Link type dropdown
        await harness.sendAndSettle(KEY.space); // cycle its value
        await harness.expectScreenshot('linktype-changed');
    });
});
