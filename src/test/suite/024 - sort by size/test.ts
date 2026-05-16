import { Harness, KEY } from '../harness';

// Files are named so alphabetical order differs from size order; selecting
// "Size" in the sort popup must visibly reorder the listing.
suite('024 - sort by size', () => {
    test('selecting Size in the sort popup reorders the listing', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('sorted-by-name');

        await harness.sendAndSettle(KEY.ctrlF12);
        // Sort popup cursor starts on the active mode (Name); Name, Extension,
        // Write time, Size -> Down x3.
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.enter);
        await harness.expectScreenshot('sorted-by-size');
    });
});
