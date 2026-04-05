# ATX LET'S PLAY: LORE MANIFEST (V1.0)

This manifest defines the "Lore Seeds" that will drive the **Overnight Character Forge**. Each district has a distinct personality, competitive intensity, and historical vibe to ensure the generated characters feel rooted in the local Austin culture.

---

## 🏗️ District DNA: Character Generators

### 🏀 PEASE DISTRICT (Downtown)
- **The Vibe:** "High-Intensity Urban King"
- **Lore Tier:** THE KINGS OF THE COURT.
- **Personality Traits:** Competitive, high-velocity, street-smart, adaptive.
- **Character Archetypes:** The Streetball Legend, The Corporate Hustler (post-work release), The High-Ground Strategist.
- **Lore Hook:** This district is the central hub. To play here, you need to prove your "court credit."

### 🏐 MUELLER (North-East)
- **The Vibe:** "The Neighborhood Strategists"
- **Lore Tier:** THE DISCIPLINED LOYALISTS.
- **Personality Traits:** Analytical, loyal, community-driven, tactical.
- **Character Archetypes:** The Data-Driven Dad, The Co-op Captain, The Systematic Scorer.
- **Lore Hook:** Mueller players are known for the "System"—every move is calculated, and loyalty to the neighborhood is absolute.

### 🎾 HYDE PARK (Central-North)
- **The Vibe:** "The Intellectual Tacticians"
- **Lore Tier:** THE HISTORIC PURISTS.
- **Personality Traits:** Precise, traditional, respect-heavy, technical.
- **Character Archetypes:** The Classic Professor, The Technical Rival, The Quiet Precisionist.
- **Lore Hook:** Playing at Shipe Park is about technical mastery. Flashy moves are secondary to perfect form.

### 🏓 SOUTH CONGRESS (SoCo / Little Stacy)
- **The Vibe:** "The Social Stylists"
- **Lore Tier:** THE VIBRANT CONNECTORS.
- **Personality Traits:** Trendy, high-energy, socially-fluid, "Austin Weird" aesthetic.
- **Character Archetypes:** The Neon-Socialite, The Boutique Beginner, The SoCo Trendsetter.
- **Lore Hook:** It’s not just about the win; it’s about the vibe. The games here are the most social, high-energy, and visually-distinct.

---

## 🧬 Automation Workflow: The Forge Script

### Step 1: Character Soul Generation (GPT-4o)
The script will iterate through these seeds. For each character, it will generate:
- **DisplayName**: (e.g., `ZilkerZane`, `SystematicSarah`)
- **Bio**: A 2-sentence lore-integrated backstory.
- **Skill Level**: (1.0 - 5.0) tied to the district’s usual intensity.
- **XP**: Scaled based on their "legend status."
- **VibeNote**: Their usual call-to-action text for games.

### Step 2: Visual Synthesis (DALL-E 3)
A prompt will be synthesized based on the character's bio:
> "A vibrant, 3D avatar in the style of ATX Let's Play. A [Descriptor] character with [Traits], wearing [District-Themed Gear]. Background is a neon-stylized Austin sunset."

### Step 3: Firestore Sync
The script will perform a batch write to the `profiles` and `games` collections, populating the map automatically.

---

## 🎯 Next Steps
- [ ] **Approve the Lore Manifest**: Do these district vibes align with your vision?
- [ ] **Prepare credentials**: I'll need to set up a Node script that has access to your OpenAI API key and Firebase service account.
- [ ] **First Forge Test**: We'll run a 5-character pilot to verify the output quality.
