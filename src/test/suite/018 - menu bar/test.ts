import { Harness, KEY } from '../harness';

suite('018 - menu bar', () => {
    test('F9 opens the top menu bar and a dropdown', async () => {
        const harness = await Harness.launch(__dirname);

        await harness.sendAndSettle(KEY.f9);
        await harness.expectScreenshot('menu-bar-open');

        await harness.sendAndSettle(KEY.enter);
        await harness.expectScreenshot('dropdown-open');

        await harness.sendAndSettle(KEY.esc);
        await harness.sendAndSettle(KEY.esc);
        await harness.expectScreenshot('menu-closed');
    });
});
