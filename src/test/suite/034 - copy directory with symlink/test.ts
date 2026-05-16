import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

// 'tree' contains an internal symlink (link -> real.txt). Copying it must
// raise the Softlinks policy dialog and preserve the link as a symlink.
suite('034 - copy directory with symlink', () => {
    test('F5 preserves symlinks when copying a directory', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> tree

        await harness.sendAndSettle(KEY.f5);
        await harness.sendAndSettle(KEY.enter, 700); // confirm copy -> scan
        await harness.expectScreenshot('softlinks-dialog');

        await harness.sendAndSettle(KEY.enter, 800); // accept default policy
        await harness.expectScreenshot('after-copy');

        const copiedReal = path.join(harness.panel2Dir, 'tree', 'real.txt');
        const copiedLink = path.join(harness.panel2Dir, 'tree', 'link');
        assert.ok(fs.existsSync(copiedReal), 'real file copied');
        assert.ok(
            fs.lstatSync(copiedLink).isSymbolicLink(),
            'link copied as a symbolic link, not a plain file',
        );
    });
});
