import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// These are hand-picked, highly professional Unsplash or similar free image URLs
// mapped to the new slugs in demoData.ts. Unsplash Source is deprecated, so we use direct IDs.
// We use a high quality format for each.
const IMAGES = {
  'espresso-machine': 'https://images.unsplash.com/photo-1517246221469-6500df1b4a3c?w=800&q=80',
  'smart-thermostat': 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?w=800&q=80',
  'mechanical-keyboard': 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80',
  'camera-drone': 'https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=800&q=80',
  'luxury-watch': 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800&q=80',
  'ergonomic-chair': 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=800&q=80',
  'anc-headphones': 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80',
  'professional-blender': 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=800&q=80',
  'security-camera': 'https://images.unsplash.com/photo-1557438159-51eec7a6c9e8?w=800&q=80',
  'vr-headset': 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800&q=80',
  'robot-vacuum': 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80',
  'electric-scooter': 'https://images.unsplash.com/photo-1593856272365-d0c3eb1de18c?w=800&q=80',
  'smart-ring': 'https://images.unsplash.com/photo-1605385638166-07ceb10c598f?w=800&q=80',
  'luxury-perfume': 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80',
  'massage-gun': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
  'minimalist-wallet': 'https://images.unsplash.com/photo-1601660126938-7fba0b779a55?w=800&q=80',
  'aviator-sunglasses': 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80',
  'home-projector': 'https://images.unsplash.com/photo-1605286467362-e5659de3b6ff?w=800&q=80',
  'smart-dumbbells': 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80',
  'coffee-grinder': 'https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=800&q=80',
};

const DEST_DIR = path.resolve(__dirname, '../apps/web/public/demo-products');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadImage(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  console.log('Downloading demo product images...');
  
  for (const [slug, url] of Object.entries(IMAGES)) {
    const dest = path.join(DEST_DIR, `${slug}.jpg`);
    try {
      await downloadImage(url, dest);
      console.log(`✅ Downloaded ${slug}.jpg`);
    } catch (err) {
      console.error(`❌ Failed to download ${slug}:`, err.message);
    }
  }
  
  console.log('Done.');
}

run();
