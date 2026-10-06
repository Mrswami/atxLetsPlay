import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = path.join(__dirname, 'public', 'assets', 'raw_courts');
const OUTPUT_DIR = path.join(__dirname, 'public', 'assets', 'courts_v1');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Our masterpiece prompt!
const PROMPT = `A stunning 3D isometric video game diorama of a sports court, rendered in a highly polished, modern 'HD-2D' retro pixel-art style. The scene is floating on a thick, stylized chunk of earth against a solid vibrant background. Incredible tilt-shift macro photography effect, volumetric light illuminating the court, vibrant neon accents mixed with lush stylized foliage. Soft ambient occlusion, glossy reflections on the court surface, and meticulously detailed micro-props (like tiny water bottles or retro arcade-style scoreboards) that give it a premium, toy-like miniature aesthetic. Masterpiece, unreal engine 5 render, trending on ArtStation.`;

const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('_raw.jpg'));

console.log(`Starting generation for ${files.length} images...`);

for (const [index, file] of files.entries()) {
  const inputPath = path.join(INPUT_DIR, file);
  // Clean up the name so it matches what the React app expects exactly!
  const cleanName = file.replace('_raw', '');
  const outputPath = path.join(OUTPUT_DIR, cleanName);

  if (fs.existsSync(outputPath)) {
    console.log(`[${index + 1}/${files.length}] Skipping ${file}, already processed!`);
    continue;
  }

  console.log(`\n[${index + 1}/${files.length}] Processing ${file}...`);

  // NOTE: If your CLI uses --source instead of --image, change it right here!
  // Same goes for --output if it uses a different flag to save the file.
  const command = `openart generate image --image "${inputPath}" --prompt "${PROMPT}" --output "${outputPath}"`;
  
  try {
    console.log(`Running: ${command}`);
    // Execute the CLI command synchronously
    execSync(command, { stdio: 'inherit' });
    console.log(` => Successfully saved to ${outputPath}`);
  } catch (error) {
    console.error(` => Failed to process ${file}`);
  }
}

console.log('\nGeneration complete! V1 Iterations are sitting in public/assets/courts_v1/');
