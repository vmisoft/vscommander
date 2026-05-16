import { Harness, KEY } from '../harness';

suite('013 - toggle dotfiles', () => {
    test('Ctrl+H hides and shows dotfiles', async () => {
        const harness = await Harness.launch(__dirname);
        await harness.expectScreenshot('dotfiles-visible');

        await harness.sendAndSettle(KEY.ctrlH);
        await harness.expectScreenshot('dotfiles-hidden');

        await harness.sendAndSettle(KEY.ctrlH);
        await harness.expectScreenshot('dotfiles-visible-again');
    });
});
