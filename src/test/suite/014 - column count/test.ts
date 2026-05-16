import { Harness, KEY } from '../harness';

suite('014 - column count', () => {
    test('Ctrl+1 and Ctrl+3 change the active pane column count', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('two-columns-default');

        await harness.sendAndSettle(KEY.ctrl1);
        await harness.expectScreenshot('one-column');

        await harness.sendAndSettle(KEY.ctrl3);
        await harness.expectScreenshot('three-columns');
    });
});
