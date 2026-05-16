import { Harness, KEY } from '../harness';

suite('022 - swap panels', () => {
    test('Ctrl+U swaps the left and right pane directories', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('before-swap');

        await harness.sendAndSettle(KEY.ctrlU);
        await harness.expectScreenshot('after-swap');
    });
});
