import { Harness, KEY } from '../harness';

suite('031 - user menu', () => {
    test('F2 opens the User Menu with the configured items', async () => {
        const harness = await Harness.launch(__dirname, {
            userMenu: [
                { hotkey: 'c', label: 'Compile project', commands: ['make'], submenu: false },
                { hotkey: 's', label: 'Git status', commands: ['git status'], submenu: false },
            ],
        });

        await harness.sendAndSettle(KEY.f2);
        await harness.expectScreenshot('user-menu-open');

        await harness.sendAndSettle(KEY.esc);
        await harness.expectScreenshot('user-menu-closed');
    });
});
