import * as THREE from 'three';

/**
 * Procedural low-poly 3D Austin landmarks styled with vibrant colors
 * matching the 2.5D tabletop Austin aesthetic.
 *
 * Tier 1: Large primary landmarks (Capitol, UT Tower, Frost Bank, Mueller Tower, Pennybacker Bridge)
 * Tier 2: Medium secondary landmarks (Browning Hangar, Palmer Events Center, Barton Springs, South Congress)
 */

// ═══════════════════════════════════════════════════════════════════
// ── TIER 1: PRIMARY LARGE 3D ICONS ──
// ═══════════════════════════════════════════════════════════════════

/**
 * 1. Grand Texas State Capitol
 * Iconic sunset red granite wings, columned rotunda drum, illuminated golden dome, and Goddess of Liberty spire.
 */
export function createCapitolLandmark() {
  const group = new THREE.Group();
  group.name = 'Landmark_TexasCapitol';

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0xdfa07a, // Sunset Red Texas Granite
    roughness: 0.5,
    metalness: 0.1,
  });
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.25,
    metalness: 0.5,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
  });
  const columnMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.4,
  });
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Lush Capitol Grounds Green Plaza Pad
  const lawnGeo = new THREE.CylinderGeometry(0.105, 0.108, 0.002, 32);
  const lawnMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 });
  const lawn = new THREE.Mesh(lawnGeo, lawnMat);
  lawn.position.y = 0.001;
  lawn.receiveShadow = true;
  group.add(lawn);

  // South Capitol Walkway (Congress Ave axis)
  const walkGeo = new THREE.BoxGeometry(0.016, 0.0025, 0.08);
  const walkMat = new THREE.MeshBasicMaterial({ color: 0xd6d3d1 });
  const walk = new THREE.Mesh(walkGeo, walkMat);
  walk.position.set(0, 0.0015, 0.045);
  group.add(walk);

  // Main central podium
  const centerBlock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.026, 0.048), baseMat);
  centerBlock.position.y = 0.013;
  centerBlock.castShadow = true;
  group.add(centerBlock);

  // Left (House) & Right (Senate) building wings
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.018, 0.032), baseMat);
  leftWing.position.set(-0.060, 0.009, 0);
  leftWing.castShadow = true;
  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.018, 0.032), baseMat);
  rightWing.position.set(0.060, 0.009, 0);
  rightWing.castShadow = true;
  group.add(leftWing, rightWing);

  // South Portico Columns facing Congress Ave
  [-0.018, -0.006, 0.006, 0.018].forEach((xPos) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.024, 6), columnMat);
    col.position.set(xPos, 0.012, 0.026);
    group.add(col);
  });

  // Rotunda drum (two-tiered)
  const drumLower = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.014, 20), baseMat);
  drumLower.position.y = 0.033;
  drumLower.castShadow = true;
  group.add(drumLower);

  const drumUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.012, 20), columnMat);
  drumUpper.position.y = 0.045;
  drumUpper.castShadow = true;
  group.add(drumUpper);

  // Main Dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.019, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    domeMat
  );
  dome.position.y = 0.051;
  dome.castShadow = true;
  group.add(dome);

  // Lantern & Goddess of Liberty Spire
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.015, 8), domeMat);
  lantern.position.y = 0.075;
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.004), starMat);
  star.position.y = 0.086;
  group.add(lantern, star);

  // Scale: Grand centerpiece
  group.scale.set(1.2, 1.2, 1.2);
  return group;
}

/**
 * 2. UT Tower (Main Building)
 * Burnt Orange observation deck, library base, and golden beacon.
 */
export function createUTTowerLandmark() {
  const group = new THREE.Group();
  group.name = 'Landmark_UTTower';

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe2d8c9, roughness: 0.6 });
  const burntOrangeMat = new THREE.MeshBasicMaterial({ color: 0xc05a11 }); // Burnt Orange
  const goldBeaconMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

  // Main Library Quad Base
  const mainBldg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.016, 0.046), stoneMat);
  mainBldg.position.y = 0.008;
  mainBldg.castShadow = true;
  group.add(mainBldg);

  // Tower Shaft
  const towerShaft = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.068, 0.022), stoneMat);
  towerShaft.position.y = 0.050;
  towerShaft.castShadow = true;
  group.add(towerShaft);

  // Burnt Orange Observation deck & clock face
  const clockDeck = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.013, 0.025), burntOrangeMat);
  clockDeck.position.y = 0.089;
  group.add(clockDeck);

  // Top Spire / Lantern
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.020, 8), goldBeaconMat);
  spire.position.y = 0.104;
  group.add(spire);

  // Base shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.055, 16),
    new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.35 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  group.add(shadow);

  group.scale.set(1.15, 1.15, 1.15);
  return group;
}

/**
 * 3. Frost Bank Tower & Downtown Skyline
 * Glass tower shaft with iconic illuminated diamond-crown pyramid.
 */
export function createFrostBankTowerLandmark() {
  const group = new THREE.Group();
  group.name = 'Landmark_FrostBank';

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.88,
  });
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.05,
    metalness: 0.95,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
  });

  // Tower lower shaft
  const baseShaft = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.048, 0.028), glassMat);
  baseShaft.position.y = 0.024;
  group.add(baseShaft);

  // Mid setback
  const midShaft = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.038, 0.023), glassMat);
  midShaft.position.y = 0.067;
  group.add(midShaft);

  // Iconic Crown (Pyramid / Diamond lattice)
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.034, 4), crownMat);
  crown.rotation.y = Math.PI / 4;
  crown.position.y = 0.098;
  group.add(crown);

  return group;
}

/**
 * 4. Mueller Control Tower
 * Historic blue airport control tower with hexagonal glass cab and red beacon.
 */
export function createMuellerTowerLandmark() {
  const group = new THREE.Group();
  group.name = 'Landmark_MuellerTower';

  const towerMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
  const cabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const redBeaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  // Tapered tower stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.015, 0.052, 12), towerMat);
  stem.position.y = 0.026;
  group.add(stem);

  // Control cab (hexagonal glass top)
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.015, 0.017, 8), cabMat);
  cab.position.y = 0.059;
  group.add(cab);

  // Roof & Red beacon
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.009, 8), towerMat);
  roof.position.y = 0.071;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), redBeaconMat);
  beacon.position.y = 0.079;
  group.add(roof, beacon);

  // Base circular park pad
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.002, 16),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 })
  );
  pad.position.y = 0.001;
  group.add(pad);

  return group;
}

/**
 * 5. Pennybacker 360 Bridge
 * Iconic weathering steel through-arch bridge over the Colorado River.
 */
export function createPennybackerBridgeLandmark() {
  const group = new THREE.Group();
  group.name = 'Landmark_PennybackerBridge';

  const archMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c, // Rust red-orange weathering steel
    roughness: 0.4,
    metalness: 0.3,
  });
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

  // Road deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.003, 0.016), roadMat);
  deck.position.y = 0.012;
  group.add(deck);

  // Arches
  const arch1 = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.0028, 8, 20, Math.PI), archMat);
  arch1.position.set(0, 0.012, 0.007);
  const arch2 = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.0028, 8, 20, Math.PI), archMat);
  arch2.position.set(0, 0.012, -0.007);
  group.add(arch1, arch2);

  // Vertical suspender cables
  [-0.020, -0.010, 0, 0.010, 0.020].forEach((x) => {
    const cableH = 0.015 * (1 - Math.abs(x) / 0.038);
    const cableGeo = new THREE.CylinderGeometry(0.0006, 0.0006, cableH, 4);
    const cable1 = new THREE.Mesh(cableGeo, archMat);
    cable1.position.set(x, 0.012 + cableH / 2, 0.007);
    const cable2 = new THREE.Mesh(cableGeo, archMat);
    cable2.position.set(x, 0.012 + cableH / 2, -0.007);
    group.add(cable1, cable2);
  });

  return group;
}

// ═══════════════════════════════════════════════════════════════════
// ── TIER 2: SECONDARY MEDIUM 3D ICONS ──
// ═══════════════════════════════════════════════════════════════════

/**
 * 6. Browning Hangar at Mueller
 * Historic open-air barrel-vault steel truss hangar at Mueller Lake, right beside the Pétanque court!
 */
export function createBrowningHangarLandmark() {
  const group = new THREE.Group();
  group.name = 'Landmark_BrowningHangar';

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Historic steel truss blue
    roughness: 0.35,
    metalness: 0.4,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Corrugated industrial canopy
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  // Barrel-vault curved canopy (half-cylinder)
  const canopyGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.032, 16, 1, true, 0, Math.PI);
  const canopy = new THREE.Mesh(canopyGeo, roofMat);
  canopy.rotation.z = Math.PI / 2;
  canopy.rotation.y = Math.PI / 2;
  canopy.position.y = 0.012;
  group.add(canopy);

  // Arched end trusses
  [-0.015, 0.015].forEach((zPos) => {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0012, 6, 16, Math.PI), steelMat);
    arch.rotation.y = Math.PI / 2;
    arch.position.set(0, 0.012, zPos);
    group.add(arch);
  });

  // Compact concrete floor pad
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.036, 0.002, 0.036),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
  );
  pad.position.y = 0.001;
  group.add(pad);

  return group;
}

/**
 * 7. Palmer Events Center
 * Iconic sweeping parabolic copper canopy roof south of Lady Bird Lake.
 */
export function createPalmerEventsCenterLandmark() {
  const group = new THREE.Group();
  group.name = 'Landmark_PalmerEventsCenter';

  const copperRoofMat = new THREE.MeshStandardMaterial({
    color: 0xb45309, // Oxidized copper/bronze swooping roof
    roughness: 0.4,
    metalness: 0.5,
    side: THREE.DoubleSide,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    transparent: true,
    opacity: 0.75,
  });

  // Sweeping canopy roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.0025, 0.045), copperRoofMat);
  roof.rotation.z = 0.12; // Dynamic architectural swoop
  roof.position.y = 0.022;
  group.add(roof);

  // Glass event hall beneath
  const hall = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.016, 0.035), glassMat);
  hall.position.y = 0.009;
  group.add(hall);

  // Lakeside park plinth
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.002, 16),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 })
  );
  plinth.position.y = 0.001;
  group.add(plinth);

  group.scale.set(0.85, 0.85, 0.85);
  return group;
}

/**
 * 8. Barton Springs & Zilker Pavilion
 * Natural turquoise spring pool and rustic limestone bathhouse in Zilker Park.
 */
export function createBartonSpringsPavilionLandmark() {
  const group = new THREE.Group();
  group.name = 'Landmark_BartonSprings';

  const limestoneMat = new THREE.MeshStandardMaterial({ color: 0xdfa07a, roughness: 0.6 });
  const springWaterMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4, // Natural spring turquoise
    roughness: 0.2,
    emissive: 0x0891b2,
    emissiveIntensity: 0.45,
  });

  // Spring water pool basin
  const pool = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.0015, 0.024), springWaterMat);
  pool.position.y = 0.002;
  group.add(pool);

  // Bathhouse pavilion building
  const bathhouse = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.014, 0.012), limestoneMat);
  bathhouse.position.set(0, 0.008, -0.016);
  group.add(bathhouse);

  // Tower center entrance
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.022, 0.014), limestoneMat);
  tower.position.set(0, 0.012, -0.016);
  group.add(tower);

  group.scale.set(0.88, 0.88, 0.88);
  return group;
}

/**
 * 9. South Congress Iconic Strip
 * Retro Austin neon pylon & vibrant storefront on SoCo.
 */
export function createSouthCongressSignLandmark() {
  const group = new THREE.Group();
  group.name = 'Landmark_SouthCongress';

  const signMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e, // Neon rose
    emissive: 0xe11d48,
    emissiveIntensity: 0.6,
  });
  const heartMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6 });

  // Twin support pylons
  [-0.012, 0.012].forEach((xPos) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.001, 0.026, 4), postMat);
    post.position.set(xPos, 0.013, 0);
    group.add(post);
  });

  // Retro Austin billboard panel
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.004), signMat);
  board.position.y = 0.024;
  group.add(board);

  // Glowing heart / star badge
  const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.005), heartMat);
  badge.position.set(0, 0.024, 0.0035);
  group.add(badge);

  group.scale.set(0.80, 0.80, 0.80);
  return group;
}

// ═══════════════════════════════════════════════════════════════════
// ── REGISTRY OF ALL AUSTIN 3D LANDMARKS ──
// ═══════════════════════════════════════════════════════════════════
export const AUSTIN_LANDMARKS_CONFIG = [
  // ── Tier 1: Large Primary Icons ──
  {
    id: 'capitol',
    name: 'Texas State Capitol',
    emoji: '🏛️',
    tier: 'large',
    district: 'Downtown',
    lat: 30.2747,
    lng: -97.7404,
    description: 'The historic Texas State Capitol, rising majestic in the heart of Downtown Austin with Sunset Red granite wings, glowing amber dome, and lush park grounds.',
    createMesh: createCapitolLandmark,
    scale: 1.35,
  },
  {
    id: 'ut-tower',
    name: 'UT Tower',
    emoji: '🤘',
    tier: 'large',
    district: 'West Campus / UT',
    lat: 30.2862,
    lng: -97.7394,
    description: 'The iconic 307-foot UT Tower and Main Building at the University of Texas at Austin, glowing burnt orange for Longhorn victories.',
    createMesh: createUTTowerLandmark,
    scale: 1.25,
  },
  {
    id: 'frost-bank',
    name: 'Frost Bank Tower',
    emoji: '💎',
    tier: 'large',
    district: 'Downtown',
    lat: 30.2660,
    lng: -97.7430,
    description: 'The signature illuminated glass crown of the Frost Bank Tower, defining the skyline of Downtown Austin.',
    createMesh: createFrostBankTowerLandmark,
    scale: 1.15,
  },
  {
    id: 'mueller-tower',
    name: 'Mueller Control Tower',
    emoji: '🦆',
    tier: 'large',
    district: 'Mueller',
    lat: 30.3018,
    lng: -97.7030,
    description: 'The historic Robert Mueller Municipal Airport control tower, now towering above Mueller Lake Park and the surrounding sports hub.',
    createMesh: createMuellerTowerLandmark,
    scale: 1.10,
  },

  // ── Tier 2: Medium Secondary Icons ──
  {
    id: 'mueller-hangar',
    name: 'Browning Hangar',
    emoji: '✈️',
    tier: 'medium',
    district: 'Mueller',
    lat: 30.2988,
    lng: -97.7118,
    description: 'Historic open-air barrel-vault steel airplane hangar at Mueller Lake, home to weekly community markets, gatherings, and steps from the Pétanque court.',
    createMesh: createBrowningHangarLandmark,
    scale: 0.70,
  },
  {
    id: 'palmer-events',
    name: 'Palmer Events Center',
    emoji: '🎭',
    tier: 'medium',
    district: 'South / River',
    lat: 30.2585,
    lng: -97.7510,
    description: 'World-class events center featuring a swooping architectural copper canopy roof along the south shore of Lady Bird Lake.',
    createMesh: createPalmerEventsCenterLandmark,
    scale: 0.85,
  },
  {
    id: 'barton-springs-pavilion',
    name: 'Barton Springs Pool',
    emoji: '🏊',
    tier: 'medium',
    district: 'Zilker',
    lat: 30.2635,
    lng: -97.7710,
    description: 'Legendary natural spring-fed swimming pool and limestone bathhouse in Zilker Park, holding 68-degree crystal clear water year-round.',
    createMesh: createBartonSpringsPavilionLandmark,
    scale: 0.90,
  },
  {
    id: 'south-congress-strip',
    name: 'South Congress Strip',
    emoji: '🎸',
    tier: 'medium',
    district: 'South Congress',
    lat: 30.2490,
    lng: -97.7495,
    description: 'Austin’s iconic retro neon corridor featuring live music, food trailers, murals, and authentic Austin funk.',
    createMesh: createSouthCongressSignLandmark,
    scale: 0.85,
  },
];
