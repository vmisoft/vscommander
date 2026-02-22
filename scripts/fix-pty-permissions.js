const fs = require('fs');
const path = require('path');
const os = require('os');

if (os.platform() === 'win32') process.exit(0);

const prebuildsDir = path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds');
if (!fs.existsSync(prebuildsDir)) process.exit(0);

for (const dir of fs.readdirSync(prebuildsDir)) {
    const helper = path.join(prebuildsDir, dir, 'spawn-helper');
    if (fs.existsSync(helper)) {
        try {
            fs.chmodSync(helper, 0o755);
        } catch {}
    }
}
