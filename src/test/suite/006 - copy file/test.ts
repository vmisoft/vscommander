import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

suite('006 - copy file', () => {
    test('F5 copies the file under the cursor to the other pane', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> source.txt

        await harness.sendAndSettle(KEY.f5);
        await harness.expectScreenshot('copy-dialog');

        await harness.sendAndSettle(KEY.enter, 600);
        await harness.expectScreenshot('after-copy');

        const copied = path.join(harness.panel2Dir, 'source.txt');
        assert.ok(fs.existsSync(copied), 'file copied into panel2');
        assert.strictEqual(fs.readFileSync(copied, 'utf8'), 'copy me\n', 'content preserved');
        assert.ok(
            fs.existsSync(path.join(harness.panel1Dir, 'source.txt')),
            'source file still present',
        );
    });
});
