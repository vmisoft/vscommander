import { Harness, KEY, alt } from '../harness';

suite('016 - quick search', () => {
    test('Alt+letter opens quick search and jumps to a match', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('after-open');

        await harness.sendAndSettle(alt('b')); // jump to 'banana.txt'
        await harness.expectScreenshot('search-banana');

        await harness.sendAndSettle(KEY.esc);
        await harness.expectScreenshot('search-closed');
    });
});
