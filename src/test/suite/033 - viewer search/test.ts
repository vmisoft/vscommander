import { Harness, KEY } from '../harness';

suite('033 - viewer search', () => {
    test('F7 inside the viewer opens search and finds a term', async () => {
        const harness = await Harness.launch(__dirname);

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> poem.txt

        await harness.sendAndSettle(KEY.f3, 500);
        await harness.sendAndSettle(KEY.f7, 300);
        await harness.expectScreenshot('search-dialog');

        await harness.type('Search');
        await harness.expectScreenshot('search-term-typed');

        await harness.sendAndSettle(KEY.enter, 300);
        await harness.expectScreenshot('after-search');
    });
});
