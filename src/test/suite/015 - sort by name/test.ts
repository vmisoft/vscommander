import { Harness, KEY } from '../harness';

suite('015 - sort by name', () => {
    test('Ctrl+F12 opens the sort modes popup', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        await harness.sendAndSettle(KEY.ctrlF12);
        await harness.expectScreenshot('sort-popup');

        await harness.sendAndSettle(KEY.esc);
        await harness.expectScreenshot('popup-closed');
    });
});
