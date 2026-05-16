import { Harness, KEY } from '../harness';

suite('003 - enter and leave directory', () => {
    test('Enter navigates into a directory and back out', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        // Home -> '..', Down -> 'alpha' (directory), Enter -> into it.
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.enter);
        await harness.expectScreenshot('inside-alpha');

        // Cursor sits on '..' inside alpha; Enter goes back up.
        await harness.sendAndSettle(KEY.enter);
        await harness.expectScreenshot('back-at-root');
    });
});
