import { Harness, KEY } from '../harness';

suite('017 - help system', () => {
    test('F1 opens and Escape closes the built-in help', async () => {
        const harness = await Harness.launch(__dirname);

        await harness.sendAndSettle(KEY.f1, 400);
        await harness.expectScreenshot('help-open');

        await harness.sendAndSettle(KEY.esc);
        await harness.expectScreenshot('help-closed');
    });
});
