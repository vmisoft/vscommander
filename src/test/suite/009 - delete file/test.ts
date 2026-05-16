import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

suite('009 - delete file', () => {
    test('F8 deletes the file under the cursor', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> deleteme.txt

        await harness.sendAndSettle(KEY.f8);
        await harness.expectScreenshot('confirm-delete');

        await harness.sendAndSettle(KEY.enter, 500);
        await harness.expectScreenshot('after-delete');

        assert.ok(
            !fs.existsSync(path.join(harness.panel1Dir, 'deleteme.txt')),
            'file removed from disk',
        );
    });
});
