import { Harness, KEY } from '../harness';

suite('001 - start and quit', () => {
    test('panel opens and renders', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');
    });

    test('F10 opens the quit dialog', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.sendAndSettle(KEY.f10);
        await harness.expectScreenshot('after-f10');
    });
});
