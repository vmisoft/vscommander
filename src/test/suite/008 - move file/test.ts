import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

suite('008 - move file', () => {
    test('F6 moves the file under the cursor to the other pane', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> movethis.txt

        await harness.sendAndSettle(KEY.f6);
        await harness.expectScreenshot('move-dialog');

        await harness.sendAndSettle(KEY.enter, 600);
        await harness.expectScreenshot('after-move');

        assert.ok(
            fs.existsSync(path.join(harness.panel2Dir, 'movethis.txt')),
            'file now present in panel2',
        );
        assert.ok(
            !fs.existsSync(path.join(harness.panel1Dir, 'movethis.txt')),
            'file removed from panel1',
        );
    });
});
