import { Harness, KEY } from '../harness';

// The Copy dialog (F5) and its "If file exists:" dropdown. Tab moves from the
// target input to the dropdown; Ctrl+Down opens the dropdown list.
suite('038 - copy dialog dropdown', () => {
    test('F5 opens the Copy dialog', async () => {
        const harness = await Harness.launch(__dirname);
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> source.txt
        await harness.sendAndSettle(KEY.f5);
        await harness.expectScreenshot('dialog-open');
    });

    test('the "If file exists" dropdown opens', async () => {
        const harness = await Harness.launch(__dirname);
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.f5);
        await harness.sendAndSettle(KEY.tab);       // target input -> dropdown
        await harness.sendAndSettle(KEY.ctrlDown);  // open the dropdown list
        await harness.expectScreenshot('dropdown-open');
    });

    test('an option can be picked from the dropdown', async () => {
        const harness = await Harness.launch(__dirname);
        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down);
        await harness.sendAndSettle(KEY.f5);
        await harness.sendAndSettle(KEY.tab);
        await harness.sendAndSettle(KEY.ctrlDown);
        await harness.sendAndSettle(KEY.down);      // highlight 'Overwrite'
        await harness.sendAndSettle(KEY.enter);     // select it, close the list
        await harness.expectScreenshot('option-selected');
    });
});
