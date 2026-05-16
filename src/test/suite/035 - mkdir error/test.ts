import { Harness, KEY } from '../harness';

// 'blocker' already exists as a file, so F7 mkdir of that name must fail
// and raise the make-directory error dialog.
suite('035 - mkdir error', () => {
    test('mkdir over an existing file shows an error dialog', async () => {
        const harness = await Harness.launch(__dirname);

        await harness.sendAndSettle(KEY.f7);
        await harness.type('blocker');
        await harness.sendAndSettle(KEY.enter, 500);
        await harness.expectScreenshot('mkdir-error');

        // Cancel out of the error dialog.
        await harness.sendAndSettle(KEY.esc, 300);
        await harness.expectScreenshot('error-dismissed');
    });
});
