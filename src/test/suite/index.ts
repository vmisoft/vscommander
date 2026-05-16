import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { Harness } from './harness';

export async function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000,
    });

    // Tear down the panel + sandbox after every test — backstop for the last
    // test in each file (launch() handles teardown between launches).
    mocha.suite.afterEach('vscommander: clean panel state', async () => {
        await Harness.disposeCurrent();
    });

    // Each test lives in a directory named "nnn - description" containing a
    // test.ts and a filesystem/ fixture; the numeric prefix orders the suites.
    const testsRoot = __dirname;
    let files = (await glob('[0-9]*/test.js', { cwd: testsRoot })).sort();
    // TEST_ONLY=<substring> limits the run to matching test directories
    // (used to run a feature's own tests before the full suite).
    const only = process.env.TEST_ONLY;
    if (only) {
        files = files.filter((f) => f.includes(only));
    }
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

    return new Promise<void>((resolve, reject) => {
        try {
            mocha.run((failures) => {
                if (failures > 0) {
                    reject(new Error(`${failures} test(s) failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}
