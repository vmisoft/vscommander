import * as assert from 'assert';
import { Harness, KEY } from '../harness';

suite('021 - edit opens editor tab', () => {
    test('F4 opens the file under the cursor in a VS Code editor tab', async () => {
        const harness = await Harness.launch(__dirname);

        harness.send(KEY.home);
        await harness.sendAndSettle(KEY.down); // cursor -> editme.txt

        await harness.sendAndSettle(KEY.f4, 800);

        assert.ok(
            harness.openTabs().includes('editme.txt'),
            'editme.txt opened as an editor tab; open tabs: ' +
                harness.openTabs().join(', '),
        );
    });
});
