import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

// Active pane is colour-only on screen, so Tab is verified by a side effect:
// F7 mkdir creates in the active pane's directory.
suite('005 - switch panes', () => {
    test('Tab moves the active pane to the right', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        await harness.sendAndSettle(KEY.tab);
        await harness.sendAndSettle(KEY.f7);
        await harness.type('made-on-right');
        await harness.sendAndSettle(KEY.enter, 400);
        await harness.expectScreenshot('dir-created-in-right-pane');

        assert.ok(
            fs.existsSync(path.join(harness.panel2Dir, 'made-on-right')),
            'directory created in panel2 (right pane became active)',
        );
        assert.ok(
            !fs.existsSync(path.join(harness.panel1Dir, 'made-on-right')),
            'panel1 was left untouched',
        );
    });
});
