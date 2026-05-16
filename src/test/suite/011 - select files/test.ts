import { Harness, KEY } from '../harness';

// Selected files are shown in colour, but the panel footer switches to a
// selected-files summary — that text change is what we assert.
suite('011 - select files', () => {
    test('Insert toggles selection and advances the cursor', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> f1.txt

        await harness.sendAndSettle(KEY.insert); // select f1.txt
        await harness.sendAndSettle(KEY.insert); // select f2.txt
        await harness.expectScreenshot('two-selected');
    });
});
