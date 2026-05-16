import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

suite('030 - extract from archive', () => {
    test('F5 inside an archive extracts the file to the other pane', async () => {
        const harness = await Harness.launch(__dirname);

        // Enter the archive.
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.enter, 400);
        await harness.expectScreenshot('inside-archive');

        // Home -> '..', Down -> 'data' dir, Down -> 'notes.txt'.
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.down);

        await harness.sendAndSettle(KEY.f5);
        await harness.sendAndSettle(KEY.enter, 800);
        await harness.expectScreenshot('after-extract');

        const extracted = path.join(harness.panel2Dir, 'notes.txt');
        assert.ok(fs.existsSync(extracted), 'file extracted to panel2');
        assert.strictEqual(
            fs.readFileSync(extracted, 'utf8'),
            'archived notes\n',
            'extracted content matches the archive entry',
        );
    });
});
