import * as fs from 'fs';
import * as path from 'path';
import { Harness, KEY } from '../harness';

suite('023 - reread directory', () => {
    test('Ctrl+R reloads the active pane after an external change', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('before-reread');

        // Create a file behind the panel's back, then re-read.
        fs.writeFileSync(path.join(harness.panel1Dir, 'appeared.txt'), 'new\n');
        await harness.sendAndSettle(KEY.ctrlR, 300);
        await harness.expectScreenshot('after-reread');
    });
});
