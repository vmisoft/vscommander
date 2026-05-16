import { Harness, KEY } from '../harness';

// The cursor highlight is colour-only, but the info bar shows the focused
// entry's name/size — so cursor movement is verified through the info bar.
suite('004 - cursor movement', () => {
    test('Home, Down and End move the cursor', async () => {
        const harness = await Harness.launch(__dirname);

        await harness.sendAndSettle(KEY.home);
        await harness.expectScreenshot('at-parent');

        await harness.sendAndSettle(KEY.down);
        await harness.expectScreenshot('at-first-file');

        await harness.sendAndSettle(KEY.end);
        await harness.expectScreenshot('at-last-file');
    });
});
