import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

// F7 creates a directory in the active pane. Validates both the UI
// (reference screenshots) and the real filesystem.
suite('002 - create directory', () => {
    test('F7 creates a directory in the active panel', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        // F7 opens the Make-directory dialog.
        await harness.sendAndSettle(KEY.f7);
        await harness.expectScreenshot('after-f7');

        // Type the new directory name.
        await harness.type('testdir');
        await harness.expectScreenshot('after-typing');

        // Enter commits; dialog closes and the new entry is listed.
        await harness.sendAndSettle(KEY.enter, 400);
        await harness.expectScreenshot('after-enter');

        // The directory exists on disk.
        const created = path.join(harness.panel1Dir, 'testdir');
        assert.ok(fs.existsSync(created), 'directory created on disk');
        assert.ok(fs.statSync(created).isDirectory(), 'created entry is a directory');
    });
});
