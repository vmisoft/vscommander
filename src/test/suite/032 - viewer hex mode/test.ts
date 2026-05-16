import { Harness, KEY } from '../harness';

suite('032 - viewer hex mode', () => {
    test('F4 inside the viewer toggles hex display', async () => {
        const harness = await Harness.launch(__dirname);

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> data.txt

        await harness.sendAndSettle(KEY.f3, 500);
        await harness.expectScreenshot('text-mode');

        await harness.sendAndSettle(KEY.f4, 400);
        await harness.expectScreenshot('hex-mode');

        await harness.sendAndSettle(KEY.f4, 400);
        await harness.expectScreenshot('text-mode-again');
    });
});
