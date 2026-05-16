import { Harness, KEY } from '../harness';

suite('028 - resize panes', () => {
    test('Ctrl+Left and Ctrl+Right move the divider between panes', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('default-split');

        await harness.sendAndSettle(KEY.ctrlLeft);
        await harness.sendAndSettle(KEY.ctrlLeft);
        await harness.expectScreenshot('left-pane-narrower');

        await harness.sendAndSettle(KEY.ctrlRight);
        await harness.sendAndSettle(KEY.ctrlRight);
        await harness.expectScreenshot('back-to-default');
    });
});
