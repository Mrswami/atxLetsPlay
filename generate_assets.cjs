const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const config = JSON.parse(fs.readFileSync('assets_prompts.json', 'utf8'));

const outDir = path.join(__dirname, 'public', 'assets', 'raw');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const OPENART_CLI = `C:\\Users\\freem\\AppData\\Local\\Programs\\openart\\bin\\openart.exe`;
const MODEL = "nano-banana-2-1";

function generateAsset(category, name, prompt) {
  const filename = `${category}_${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
  const outputPath = path.join(outDir, filename);
  
  console.log(`Generating [${category}] ${name}...`);
  const cmd = `"${OPENART_CLI}" generate image "${prompt}" --model ${MODEL} -o "${outputPath}" --quiet`;
  
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`Saved to ${outputPath}`);
  } catch (err) {
    console.error(`Failed to generate ${name}:`, err.message);
  }
}

// Generate Characters
config.prompts.characters.examples.forEach((example, i) => {
  const prompt = config.prompts.characters.template
    .replace('{description}', example)
    .replace('{style_characters}', config.styles.characters);
  generateAsset('character', `avatar_${i}`, prompt);
});

// Generate Landmarks
config.prompts.landmarks.examples.forEach((example, i) => {
  const prompt = config.prompts.landmarks.template
    .replace('{landmark_name}', example)
    .replace('{style_landmarks}', config.styles.landmarks);
  generateAsset('landmark', `court_${i}`, prompt);
});

// Generate UI Buttons
config.prompts.ui_buttons.examples.forEach((example, i) => {
  const prompt = config.prompts.ui_buttons.template
    .replace('{button_text}', example)
    .replace('{style_ui}', config.styles.ui);
  generateAsset('ui', `btn_${example}`, prompt);
});

// Generate UI Panels
config.prompts.ui_panels.examples.forEach((example, i) => {
  const prompt = config.prompts.ui_panels.template
    .replace('{panel_type}', example)
    .replace('{style_ui}', config.styles.ui);
  generateAsset('ui', `panel_${i}`, prompt);
});

console.log("All raw assets generated! Next step: process and convert to webp.");
