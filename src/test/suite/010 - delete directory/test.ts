import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

suite('010 - delete directory', () => {
    test('F8 deletes a directory and its contents', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> dirtodelete

        await harness.sendAndSettle(KEY.f8);
        await harness.expectScreenshot('confirm-delete');

        await harness.sendAndSettle(KEY.enter, 600);
        await harness.expectScreenshot('after-delete');

        assert.ok(
            !fs.existsSync(path.join(harness.panel1Dir, 'dirtodelete')),
            'directory removed from disk',
        );
    });
});
