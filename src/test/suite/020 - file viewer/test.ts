import { Harness, KEY } from '../harness';

suite('020 - file viewer', () => {
    test('F3 opens the internal file viewer', async () => {
        const harness = await Harness.launch(__dirname);

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> viewme.txt

        await harness.sendAndSettle(KEY.f3, 500);
        await harness.expectScreenshot('viewer-open');

        await harness.sendAndSettle(KEY.esc);
        await harness.expectScreenshot('viewer-closed');
    });
});
