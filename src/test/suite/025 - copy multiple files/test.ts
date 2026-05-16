import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

suite('025 - copy multiple files', () => {
    test('F5 copies every selected file, skipping unselected ones', async () => {
        const harness = await Harness.launch(__dirname);

        // Home -> '..', Down -> m1.txt.
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.insert); // select m1.txt, cursor -> m2.txt
        await harness.sendAndSettle(KEY.down);   // cursor -> m3.txt
        await harness.sendAndSettle(KEY.insert); // select m3.txt
        await harness.expectScreenshot('two-of-three-selected');

        await harness.sendAndSettle(KEY.f5);
        await harness.sendAndSettle(KEY.enter, 800);
        await harness.expectScreenshot('after-copy');

        assert.ok(fs.existsSync(path.join(harness.panel2Dir, 'm1.txt')), 'm1 copied');
        assert.ok(fs.existsSync(path.join(harness.panel2Dir, 'm3.txt')), 'm3 copied');
        assert.ok(
            !fs.existsSync(path.join(harness.panel2Dir, 'm2.txt')),
            'm2 was not selected, so not copied',
        );
    });
});
