import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

suite('007 - copy directory', () => {
    test('F5 copies a directory and its whole subtree', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> mydir

        await harness.sendAndSettle(KEY.f5);
        await harness.sendAndSettle(KEY.enter, 800);
        await harness.expectScreenshot('after-copy');

        assert.ok(
            fs.existsSync(path.join(harness.panel2Dir, 'mydir', 'a.txt')),
            'top-level file copied',
        );
        assert.ok(
            fs.existsSync(path.join(harness.panel2Dir, 'mydir', 'nested', 'b.txt')),
            'nested file copied recursively',
        );
    });
});
