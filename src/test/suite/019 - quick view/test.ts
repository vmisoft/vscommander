import { Harness, KEY } from '../harness';

suite('019 - quick view', () => {
    test('Ctrl+Q previews the file under the cursor in the other pane', async () => {
        const harness = await Harness.launch(__dirname);

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> preview.txt

        await harness.sendAndSettle(KEY.ctrlQ, 500);
        await harness.expectScreenshot('quick-view-open');

        await harness.sendAndSettle(KEY.ctrlQ);
        await harness.expectScreenshot('quick-view-closed');
    });
});
