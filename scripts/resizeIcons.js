import { Jimp } from 'jimp';

async function resizeIcons() {
  try {
    const image = await Jimp.read('public/favicon.jpg');
    
    // Create 192x192
    image.clone().resize({ w: 192, h: 192 }).write('public/icon-192.png');
    
    // Create 512x512
    image.clone().resize({ w: 512, h: 512 }).write('public/icon-512.png');
    
    console.log('Icons generated successfully.');
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

resizeIcons();
