// Run after `npx cap add android` (the android/ folder is generated and not committed): npm run android:prepare
import fs from 'fs';
import path from 'path';
import { allowCleartext } from './allowCleartext';

const MANIFEST = path.join(__dirname, '../../android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(MANIFEST)) {
  throw new Error(`File not found. Offending value: "${MANIFEST}". Expected shape: run "npx cap add android" first`);
}
const before = fs.readFileSync(MANIFEST, 'utf8');
const after = allowCleartext(before);
fs.writeFileSync(MANIFEST, after);
console.log(
  before === after ? 'AndroidManifest.xml already allows cleartext' : 'AndroidManifest.xml now allows cleartext',
);
