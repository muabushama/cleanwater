/**
 * ينسخ مخرجات Vite من dist/ إلى public/ حتى يظهر التحديث على الاستضافة التي جذرها public/
 * (لا يمس public/api ولا app-config.js ولا uploads)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const pub = path.join(root, 'public');

const indexSrc = path.join(dist, 'index.html');
if (!fs.existsSync(indexSrc)) {
  console.error('sync-dist-to-public: dist/index.html غير موجود — شغّل npm run build أولاً');
  process.exit(1);
}

fs.mkdirSync(path.join(pub, 'assets'), { recursive: true });
fs.copyFileSync(indexSrc, path.join(pub, 'index.html'));

const assetsDist = path.join(dist, 'assets');
if (fs.existsSync(assetsDist)) {
  for (const name of fs.readdirSync(assetsDist)) {
    fs.copyFileSync(path.join(assetsDist, name), path.join(pub, 'assets', name));
  }
}

console.log('sync-dist-to-public: تم نسخ dist → public (index.html + assets/)');
