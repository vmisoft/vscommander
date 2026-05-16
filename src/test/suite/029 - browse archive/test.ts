import { Harness, KEY } from '../harness';

// Entering a .zip browses it like a directory (Far-style archive plugin).
suite('029 - browse archive', () => {
    test('Enter opens a zip, navigates inside it, and exits', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        // Home -> '..', Down -> archive.zip, Enter -> into the archive.
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.enter, 400);
        await harness.expectScreenshot('inside-archive');

        // Home -> '..', Down -> 'data' (directory), Enter -> into it.
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.enter, 300);
        await harness.expectScreenshot('inside-data');

        // Enter on '..' returns to the archive root.
        await harness.sendAndSettle(KEY.enter, 300);
        // Home -> '..', Enter exits the archive back to the filesystem.
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.enter, 300);
        await harness.expectScreenshot('exited-archive');
    });
});
