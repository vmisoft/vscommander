import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

// Copying onto an existing file with the default "Ask" policy must raise an
// overwrite confirmation. This test cancels it and checks nothing changed.
suite('026 - overwrite prompt', () => {
    test('copying onto an existing file asks before overwriting', async () => {
        const harness = await Harness.launch(__dirname);

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> dup.txt

        await harness.sendAndSettle(KEY.f5);
        await harness.sendAndSettle(KEY.enter, 600); // confirm copy -> conflict
        await harness.expectScreenshot('overwrite-prompt');

        await harness.sendAndSettle(KEY.esc, 400); // cancel the whole copy
        await harness.expectScreenshot('after-cancel');

        assert.strictEqual(
            fs.readFileSync(path.join(harness.panel2Dir, 'dup.txt'), 'utf8'),
            'old content\n',
            'target file left untouched after cancelling',
        );
    });
});
