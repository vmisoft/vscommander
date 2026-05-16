import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    // Project root — loaded as the extension under development.
    const extensionDevelopmentPath = path.resolve(__dirname, '../..');
    // Compiled mocha entry (dist/test/suite/index.js).
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    try {
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: ['--disable-extensions'],
            // Forward the screenshot-update flag into the extension host.
            extensionTestsEnv: { UPDATE_SCREENSHOTS: process.env.UPDATE_SCREENSHOTS },
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
