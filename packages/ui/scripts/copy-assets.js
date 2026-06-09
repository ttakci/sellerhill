const fs = require('fs');
const path = require('path');

const pkgRoot = path.join(__dirname, '..');
const srcDir = path.join(pkgRoot, 'src', 'assets');
const destDir = path.join(pkgRoot, 'dist', 'assets');

fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(srcDir, destDir, { recursive: true });
