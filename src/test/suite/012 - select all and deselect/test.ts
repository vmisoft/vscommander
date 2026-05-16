import { Harness, KEY } from '../harness';

suite('012 - select all and deselect', () => {
    test('Numpad + selects all files, Numpad - clears the selection', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        await harness.sendAndSettle(KEY.numpadPlus);
        await harness.expectScreenshot('all-selected');

        await harness.sendAndSettle(KEY.numpadMinus);
        await harness.expectScreenshot('none-selected');
    });
});
