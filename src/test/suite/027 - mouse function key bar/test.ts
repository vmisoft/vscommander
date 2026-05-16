import { Harness, KEY } from '../harness';

// The function key bar is the bottom row (row 30). Clicking the F10 cell
// triggers the same action as pressing F10 — the quit confirmation.
suite('027 - mouse function key bar', () => {
    test('clicking the F10 label opens the quit dialog', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        await harness.click(95, 30);
        await harness.expectScreenshot('quit-dialog-via-mouse');

        await harness.sendAndSettle(KEY.esc);
        await harness.expectScreenshot('dialog-dismissed');
    });
});
