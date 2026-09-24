import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { AUSTIN_COURTS_DATA, SPORT_META, DISTRICT_META } from '../data/courtsMeta';
import { AUSTIN_LANDMARKS_CONFIG } from './austinLandmarks';
import { getSimulatedCapacity } from '../utils/capacity';
import { useUserLocation } from '../hooks/useUserLocation';
import './WorldGlobe.css';

// ── Geographic Center of Austin (Texas State Capitol) ──
const AUSTIN_CENTER = { lat: 30.2747, lng: -97.7404 };

// Coordinate Scale: mapping GPS degrees to 2.5D board units
// Latitude in Austin is ~30.27° N. cos(30.27°) ≈ 0.8637.
// SCALE_Z governs North-South; SCALE_X = SCALE_Z * cos(lat) ensures 1:1 true physical aspect ratio.
const SCALE_Z = 28.0;
const SCALE_X = SCALE_Z * Math.cos((AUSTIN_CENTER.lat * Math.PI) / 180); // ~24.184

// Compact Board dimensions & navigation bounds for Austin Urban Core
const BOARD_WIDTH = 10.0;
const BOARD_DEPTH = 10.0;
const BOARD_LIMIT = 2.6;
const METRO_OUTER_SIZE = 22.0;

/**
 * Converts GPS (lat, lng) to 2.5D X-Z planar coordinates on the tabletop board.
 * X = East (+), West (-)
 * Z = South (+), North (-)
 * Y = Elevation above board
 */
function latLngToBoardPos(lat, lng, altitude = 0.005) {
  const x = (lng - AUSTIN_CENTER.lng) * SCALE_X;
  const z = -(lat - AUSTIN_CENTER.lat) * SCALE_Z;
  return new THREE.Vector3(x, altitude, z);
}

// ── Procedural Dark Digital Vector Grid Canvas Texture ──
function createAustinGridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Deep dark tech slate background
  ctx.fillStyle = '#080f20';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle street grid network lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.035)';
  ctx.lineWidth = 1;
  const step = 32;
  for (let x = 0; x <= canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Major arterial block dividers
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= canvas.width; x += step * 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += step * 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Metro radial illumination gradient focused on downtown & central Austin
  const grad = ctx.createRadialGradient(512, 512, 50, 512, 512, 490);
  grad.addColorStop(0, 'rgba(14, 165, 233, 0.14)');
  grad.addColorStop(0.45, 'rgba(30, 41, 59, 0.07)');
  grad.addColorStop(1, 'rgba(8, 15, 32, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// ── Text Sprite & Ground Badge Helpers ──
function createTextSprite(text, fontSize = 26, color = '#f8fafc', bgColor = 'rgba(15, 23, 42, 0.88)', borderColor = 'rgba(56, 189, 248, 0.55)') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Pill badge background
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 16);
  ctx.fill();
  ctx.stroke();

  // Crisp centered text
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function createGroundLabel(text, lat, lng, width = 0.28, height = 0.07, fontSize = 24, color = '#f8fafc', bgColor = 'rgba(15, 23, 42, 0.88)', borderColor = 'rgba(56, 189, 248, 0.55)') {
  const texture = createTextSprite(text, fontSize, color, bgColor, borderColor);
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  const pos = latLngToBoardPos(lat, lng, 0.0042);
  mesh.position.copy(pos);
  return mesh;
}

// ── Crisp Uppercase Neighborhood Text Labels (Google Maps Dark Mode Style) ──
function createNeighborhoodTextLabel(text, lat, lng, width = 0.36, height = 0.09, fontSize = 20, color = 'rgba(148, 163, 184, 0.80)') {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  const pos = latLngToBoardPos(lat, lng, 0.0045);
  mesh.position.copy(pos);
  return mesh;
}

function createDistrictZone(lat, lng, radius, colorHex, opacity = 0.14) {
  const pos = latLngToBoardPos(lat, lng, 0.0016);
  const geo = new THREE.CircleGeometry(radius, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(pos);
  return mesh;
}

// ── 2D Sport Badges for Google Maps Style Overhead View ──
const sportBadgeTextures = {};
function getSportBadgeTexture(sportKey) {
  if (sportBadgeTextures[sportKey]) return sportBadgeTextures[sportKey];
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');

  const meta = SPORT_META[sportKey] || { emoji: '🏀', color: '#f97316' };

  // Outer glow shadow
  ctx.shadowColor = meta.color;
  ctx.shadowBlur = 10;

  // Outer crisp white rim
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(40, 40, 36, 0, Math.PI * 2);
  ctx.fill();

  // Inner sport color circle
  ctx.shadowBlur = 0;
  ctx.fillStyle = meta.color;
  ctx.beginPath();
  ctx.arc(40, 40, 31, 0, Math.PI * 2);
  ctx.fill();

  // Emoji icon
  ctx.font = '32px system-ui, "Apple Color Emoji", "Segoe UI Emoji"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(meta.emoji, 40, 42);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  sportBadgeTextures[sportKey] = texture;
  return texture;
}

// ── 2D Landmark POI Badges for Google Maps Style Overhead View ──
const landmarkPoiTextures = {};
function getLandmarkPoiTexture(emoji, name) {
  const key = emoji + name;
  if (landmarkPoiTextures[key]) return landmarkPoiTextures[key];
  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');

  // Pill badge background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 18);
  ctx.fill();
  ctx.stroke();

  // Emoji
  ctx.font = '28px system-ui, "Apple Color Emoji", "Segoe UI Emoji"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 16, canvas.height / 2);

  // Landmark name
  ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 58, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  landmarkPoiTextures[key] = texture;
  return texture;
}

// ── District navigation targets for quick-jump bar ──
const NEIGHBORHOOD_TARGETS = [
  { label: 'Mueller', lat: 30.2980, lng: -97.7050, zoom: 0.75, icon: '🦆' },
  { label: 'Austin Metro', lat: 30.2747, lng: -97.7404, zoom: 1.55, icon: '🌟' },
  { label: 'Downtown', lat: 30.2670, lng: -97.7440, zoom: 0.80, icon: '🏛️' },
  { label: 'The Domain', lat: 30.4020, lng: -97.7240, zoom: 0.85, icon: '🛍️' },
  { label: 'Wampus / UT', lat: 30.2862, lng: -97.7394, zoom: 0.80, icon: '🤘' },
  { label: 'Hyde Park', lat: 30.3040, lng: -97.7320, zoom: 0.80, icon: '🏡' },
  { label: 'Cherrywood', lat: 30.2880, lng: -97.7150, zoom: 0.80, icon: '🎨' },
  { label: 'Tarrytown', lat: 30.2920, lng: -97.7700, zoom: 0.85, icon: '🌳' },
  { label: 'Zilker', lat: 30.2650, lng: -97.7720, zoom: 0.80, icon: '🏖️' },
  { label: 'E Cesar Chavez', lat: 30.2520, lng: -97.7180, zoom: 0.80, icon: '🌮' },
  { label: 'South / 290', lat: 30.2220, lng: -97.7750, zoom: 0.90, icon: '🤠' },
];


/**
 * Procedural low-poly 3D sports court meshes sitting on the 2.5D board.
 */
function createLowPolyCourtMesh(court) {
  const group = new THREE.Group();
  const primarySport = (court.sport && court.sport[0]) || 'basketball';

  // Concrete Foundation Plinth
  const plinthGeo = new THREE.BoxGeometry(0.028, 0.003, 0.020);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.6,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = 0.0015;
  group.add(plinth);

  if (primarySport === 'basketball') {
    // Royal blue court surface
    const courtGeo = new THREE.BoxGeometry(0.025, 0.001, 0.017);
    const courtMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.35,
    });
    const courtMesh = new THREE.Mesh(courtGeo, courtMat);
    courtMesh.position.y = 0.0035;
    group.add(courtMesh);

    // Red key areas
    const keyGeo = new THREE.BoxGeometry(0.006, 0.0011, 0.008);
    const keyMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const k1 = new THREE.Mesh(keyGeo, keyMat);
    k1.position.set(-0.009, 0.0036, 0);
    const k2 = new THREE.Mesh(keyGeo, keyMat);
    k2.position.set(0.009, 0.0036, 0);
    group.add(k1, k2);

    // Center court circle
    const centerCircleGeo = new THREE.RingGeometry(0.002, 0.0026, 12);
    const centerCircleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const centerCircle = new THREE.Mesh(centerCircleGeo, centerCircleMat);
    centerCircle.rotation.x = Math.PI / 2;
    centerCircle.position.y = 0.0042;
    group.add(centerCircle);

    // Scaled backboards & orange hoops
    [-0.011, 0.011].forEach((xPos) => {
      const postGeo = new THREE.CylinderGeometry(0.0006, 0.0006, 0.012, 4);
      const postMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(xPos, 0.008, 0);

      const boardGeo = new THREE.BoxGeometry(0.0008, 0.004, 0.006);
      const boardMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(xPos, 0.012, 0);

      const rimGeo = new THREE.TorusGeometry(0.0012, 0.0003, 4, 6);
      const rimMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(xPos > 0 ? xPos - 0.0015 : xPos + 0.0015, 0.0105, 0);

      group.add(post, board, rim);
    });
  } else if (primarySport === 'tennis') {
    // US Open hardcourt blue surface
    const courtGeo = new THREE.BoxGeometry(0.026, 0.001, 0.018);
    const courtMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
    });
    const courtMesh = new THREE.Mesh(courtGeo, courtMat);
    courtMesh.position.y = 0.0035;
    group.add(courtMesh);

    // Center Tennis Net
    const netGeo = new THREE.BoxGeometry(0.0008, 0.0045, 0.018);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
    });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.y = 0.0055;
    group.add(net);
  } else if (primarySport === 'pickleball') {
    // Vibrant cyan court
    const courtGeo = new THREE.BoxGeometry(0.022, 0.001, 0.014);
    const courtMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.35 });
    const courtMesh = new THREE.Mesh(courtGeo, courtMat);
    courtMesh.position.y = 0.0035;

    const netGeo = new THREE.BoxGeometry(0.0008, 0.0035, 0.014);
    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.y = 0.005;
    group.add(courtMesh, net);
  } else if (primarySport === 'volleyball') {
    // Sand volleyball pit
    const sandGeo = new THREE.BoxGeometry(0.026, 0.0012, 0.018);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.95 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.position.y = 0.0035;

    const netGeo = new THREE.BoxGeometry(0.0008, 0.006, 0.018);
    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.y = 0.008;

    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.0005, 0.010, 4), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    p1.position.set(0, 0.008, -0.009);
    const p2 = p1.clone();
    p2.position.set(0, 0.008, 0.009);
    group.add(sand, net, p1, p2);
  } else if (primarySport === 'soccer') {
    // Striped grass pitch
    const pitchGeo = new THREE.BoxGeometry(0.030, 0.001, 0.020);
    const pitchMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.position.y = 0.0035;
    group.add(pitch);

    // Goal cages
    [-0.014, 0.014].forEach((xPos) => {
      const goalGeo = new THREE.BoxGeometry(0.003, 0.005, 0.008);
      const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true });
      const goal = new THREE.Mesh(goalGeo, goalMat);
      goal.position.set(xPos, 0.006, 0);
      group.add(goal);
    });
  } else {
    const genGeo = new THREE.BoxGeometry(0.024, 0.001, 0.015);
    const genMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 });
    const gen = new THREE.Mesh(genGeo, genMat);
    gen.position.y = 0.0035;
    group.add(gen);
  }

  return group;
}

/**
 * Creates 3D geographic ribbons for Colorado River, Lake Austin, major highway network,
 * greenbelts, and district zones across Greater Austin.
 */
function createAustinGeographicFeatures() {
  const geoGroup = new THREE.Group();
  geoGroup.name = 'Austin_Geographic_Features';

  // 1. Extended Colorado River & Lake Austin Ribbon (Full Lake Travis to East Austin)
  const riverCoords = [
    { lat: 30.395, lng: -97.915 }, // Lake Travis / Mansfield Dam entrance
    { lat: 30.380, lng: -97.875 }, // Mansfield Dam / Lake Austin headwaters
    { lat: 30.360, lng: -97.850 }, // Steiner Ranch bend
    { lat: 30.345, lng: -97.835 }, // Commons Ford
    { lat: 30.351, lng: -97.797 }, // Pennybacker 360 Bridge
    { lat: 30.335, lng: -97.778 }, // Mount Bonnell loop
    { lat: 30.312, lng: -97.805 }, // Lake Austin upstream
    { lat: 30.302, lng: -97.792 }, // Westwood / Laguna Gloria
    { lat: 30.290, lng: -97.780 }, // Tom Miller Dam
    { lat: 30.278, lng: -97.771 }, // Deep Eddy / Red Bud Isle
    { lat: 30.268, lng: -97.763 }, // Zilker Park north edge
    { lat: 30.265, lng: -97.753 }, // Barton Creek confluence
    { lat: 30.263, lng: -97.744 }, // South 1st Bridge
    { lat: 30.261, lng: -97.737 }, // Congress Ave bridge (Bat bridge)
    { lat: 30.255, lng: -97.728 }, // I-35 bridge
    { lat: 30.250, lng: -97.718 }, // Festival Beach / Metz Park
    { lat: 30.245, lng: -97.708 }, // Pleasant Valley / Longhorn Dam
    { lat: 30.238, lng: -97.685 }, // East river outflow
    { lat: 30.230, lng: -97.640 }, // Hornsby Bend
    { lat: 30.210, lng: -97.580 }, // Eastern boundary
  ];

  const riverPoints = riverCoords.map((c) => latLngToBoardPos(c.lat, c.lng, 0.002));
  const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
  const riverSegments = 90;
  const riverRibbonPoints = riverCurve.getPoints(riverSegments);

  const riverGeo = new THREE.BufferGeometry();
  const riverVerts = [];
  const riverIndices = [];
  const halfWidth = 0.038; // Generous river width

  for (let i = 0; i <= riverSegments; i++) {
    const p = riverRibbonPoints[i];
    const tangent = riverCurve.getTangent(i / riverSegments);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    riverVerts.push(
      p.x + normal.x * halfWidth, 0.0022, p.z + normal.z * halfWidth,
      p.x - normal.x * halfWidth, 0.0022, p.z - normal.z * halfWidth
    );

    if (i < riverSegments) {
      const base = i * 2;
      riverIndices.push(base, base + 2, base + 1);
      riverIndices.push(base + 1, base + 2, base + 3);
    }
  }

  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(riverVerts, 3));
  riverGeo.setIndex(riverIndices);
  riverGeo.computeVertexNormals();

  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Vibrant Texas water blue
    emissive: 0x0369a1,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.2,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.receiveShadow = true;
  geoGroup.add(riverMesh);

  // 2. Barton Creek Tributary through Greenbelt
  const bartonCoords = [
    { lat: 30.235, lng: -97.820 }, // Southwest greenbelt
    { lat: 30.245, lng: -97.800 }, // Twin Falls / Sculpture Falls
    { lat: 30.258, lng: -97.785 }, // Barton Creek Greenbelt trailhead
    { lat: 30.2635, lng: -97.771 }, // Barton Springs Pool
    { lat: 30.265, lng: -97.753 }, // Confluence with Lady Bird Lake
  ];
  const bartonPts = bartonCoords.map((c) => latLngToBoardPos(c.lat, c.lng, 0.0022));
  const bartonCurve = new THREE.CatmullRomCurve3(bartonPts);
  const bartonSegs = 30;
  const bartonCurvePts = bartonCurve.getPoints(bartonSegs);
  const bartonGeo = new THREE.BufferGeometry();
  const bVerts = [];
  const bIdxs = [];
  const bHalfW = 0.016;

  for (let i = 0; i <= bartonSegs; i++) {
    const p = bartonCurvePts[i];
    const tan = bartonCurve.getTangent(i / bartonSegs);
    const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    bVerts.push(
      p.x + norm.x * bHalfW, 0.0024, p.z + norm.z * bHalfW,
      p.x - norm.x * bHalfW, 0.0024, p.z - norm.z * bHalfW
    );
    if (i < bartonSegs) {
      const b = i * 2;
      bIdxs.push(b, b + 2, b + 1);
      bIdxs.push(b + 1, b + 2, b + 3);
    }
  }
  bartonGeo.setAttribute('position', new THREE.Float32BufferAttribute(bVerts, 3));
  bartonGeo.setIndex(bIdxs);
  bartonGeo.computeVertexNormals();
  const bartonMesh = new THREE.Mesh(bartonGeo, riverMat);
  geoGroup.add(bartonMesh);

  // 3. Shoal Creek Tributary
  const shoalCoords = [
    { lat: 30.340, lng: -97.740 },
    { lat: 30.315, lng: -97.745 },
    { lat: 30.285, lng: -97.751 }, // Pease Park
    { lat: 30.267, lng: -97.752 }, // Lady Bird Lake outflow
  ];
  const shoalPts = shoalCoords.map((c) => latLngToBoardPos(c.lat, c.lng, 0.0022));
  const shoalCurve = new THREE.CatmullRomCurve3(shoalPts);
  const shoalSegs = 20;
  const shoalCurvePts = shoalCurve.getPoints(shoalSegs);
  const shoalGeo = new THREE.BufferGeometry();
  const sVerts = [];
  const sIdxs = [];
  const sHalfW = 0.012;

  for (let i = 0; i <= shoalSegs; i++) {
    const p = shoalCurvePts[i];
    const tan = shoalCurve.getTangent(i / shoalSegs);
    const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    sVerts.push(
      p.x + norm.x * sHalfW, 0.0023, p.z + norm.z * sHalfW,
      p.x - norm.x * sHalfW, 0.0023, p.z - norm.z * sHalfW
    );
    if (i < shoalSegs) {
      const b = i * 2;
      sIdxs.push(b, b + 2, b + 1);
      sIdxs.push(b + 1, b + 2, b + 3);
    }
  }
  shoalGeo.setAttribute('position', new THREE.Float32BufferAttribute(sVerts, 3));
  shoalGeo.setIndex(sIdxs);
  shoalGeo.computeVertexNormals();
  const shoalMesh = new THREE.Mesh(shoalGeo, riverMat);
  geoGroup.add(shoalMesh);

  // 4. Mueller Lake in Mueller Lake Park
  const muellerLakePos = latLngToBoardPos(30.2972, -97.7048, 0.0025);
  const muellerLakeGeo = new THREE.CircleGeometry(0.040, 32);
  const muellerLakeMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const muellerLakeMesh = new THREE.Mesh(muellerLakeGeo, muellerLakeMat);
  muellerLakeMesh.rotation.x = -Math.PI / 2;
  muellerLakeMesh.position.copy(muellerLakePos);
  geoGroup.add(muellerLakeMesh);

  // 5. Walter E. Long / Decker Lake in East Austin
  const deckerLakePos = latLngToBoardPos(30.300, -97.610, 0.0022);
  const deckerLakeGeo = new THREE.CircleGeometry(0.090, 32);
  const deckerLakeMesh = new THREE.Mesh(deckerLakeGeo, muellerLakeMat);
  deckerLakeMesh.rotation.x = -Math.PI / 2;
  deckerLakeMesh.position.copy(deckerLakePos);
  geoGroup.add(deckerLakeMesh);

  // 6. Major Austin Greenbelts & Parklands (Google Maps Dark Mode Teal Green)
  const parklands = [
    { name: 'Mayfield Park & Nature Preserve', lat: 30.312, lng: -97.771, radius: 0.085, color: 0x064e3b },
    { name: 'Zilker Metropolitan Park', lat: 30.266, lng: -97.770, radius: 0.090, color: 0x064e3b },
    { name: 'Barton Creek Greenbelt', lat: 30.245, lng: -97.795, radius: 0.085, color: 0x0a3d31 },
    { name: 'Pease District Park', lat: 30.285, lng: -97.751, radius: 0.055, color: 0x064e3b },
    { name: 'Mueller Lake Park & Greenway', lat: 30.298, lng: -97.705, radius: 0.070, color: 0x085446 },
    { name: 'Walnut Creek Metro Park', lat: 30.405, lng: -97.700, radius: 0.090, color: 0x064e3b },
    { name: 'Roy G. Guerrero Colorado River Park', lat: 30.245, lng: -97.695, radius: 0.070, color: 0x064e3b },
    { name: 'McKinney Falls State Park', lat: 30.185, lng: -97.720, radius: 0.085, color: 0x0a3d31 },
    { name: 'Hyde Park Green Corridor', lat: 30.304, lng: -97.732, radius: 0.050, color: 0x085446 },
  ];

  parklands.forEach((p) => {
    const parkPos = latLngToBoardPos(p.lat, p.lng, 0.0018);
    const pGeo = new THREE.CircleGeometry(p.radius, 24);
    const pMat = new THREE.MeshBasicMaterial({
      color: p.color,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pMesh = new THREE.Mesh(pGeo, pMat);
    pMesh.rotation.x = -Math.PI / 2;
    pMesh.position.copy(parkPos);
    geoGroup.add(pMesh);
  });

  // 7. Comprehensive Greater Austin Highway Network & Arterial Corridors
  const streetsAndHighways = [
    // ── I-35 Corridor (Round Rock / Tech Ridge to Slaughter / Buda) ──
    {
      name: 'I-35',
      color: 0x6366f1, // Bright electric indigo corridor
      width: 0.024,
      opacity: 0.95,
      coords: [
        { lat: 30.480, lng: -97.675 },
        { lat: 30.430, lng: -97.675 },
        { lat: 30.390, lng: -97.685 },
        { lat: 30.350, lng: -97.700 },
        { lat: 30.320, lng: -97.714 },
        { lat: 30.285, lng: -97.726 },
        { lat: 30.268, lng: -97.733 },
        { lat: 30.255, lng: -97.728 },
        { lat: 30.245, lng: -97.744 },
        { lat: 30.210, lng: -97.766 },
        { lat: 30.165, lng: -97.788 },
        { lat: 30.135, lng: -97.805 },
      ],
    },
    // ── Loop 1 (MoPac Expressway: The Domain to Circle C / Slaughter) ──
    {
      name: 'MoPac (Loop 1)',
      color: 0x0ea5e9, // Bright sky-blue expressway
      width: 0.022,
      opacity: 0.95,
      coords: [
        { lat: 30.440, lng: -97.705 },
        { lat: 30.400, lng: -97.725 },
        { lat: 30.370, lng: -97.738 },
        { lat: 30.345, lng: -97.748 },
        { lat: 30.315, lng: -97.755 },
        { lat: 30.280, lng: -97.763 },
        { lat: 30.260, lng: -97.771 },
        { lat: 30.245, lng: -97.788 },
        { lat: 30.230, lng: -97.801 },
        { lat: 30.200, lng: -97.835 },
        { lat: 30.170, lng: -97.870 },
      ],
    },
    // ── US-183 (Research Blvd / Ed Bluestein / Airport Fwy) ──
    {
      name: 'US-183',
      color: 0x10b981, // Vibrant emerald-cyan diagonal highway
      width: 0.022,
      opacity: 0.95,
      coords: [
        { lat: 30.470, lng: -97.805 },
        { lat: 30.425, lng: -97.770 },
        { lat: 30.395, lng: -97.745 },
        { lat: 30.365, lng: -97.730 },
        { lat: 30.335, lng: -97.705 },
        { lat: 30.305, lng: -97.695 },
        { lat: 30.270, lng: -97.685 },
        { lat: 30.235, lng: -97.675 },
        { lat: 30.205, lng: -97.665 },
      ],
    },
    // ── Hwy 71 / Ben White Blvd / ABIA Airport Freeway ──
    {
      name: 'Hwy 71 (Ben White)',
      color: 0xa855f7, // Vibrant purple cross-town corridor
      width: 0.022,
      opacity: 0.95,
      coords: [
        { lat: 30.235, lng: -97.860 },
        { lat: 30.230, lng: -97.801 },
        { lat: 30.225, lng: -97.785 },
        { lat: 30.222, lng: -97.755 },
        { lat: 30.215, lng: -97.705 },
        { lat: 30.205, lng: -97.665 },
        { lat: 30.190, lng: -97.620 },
      ],
    },
    // ── Loop 360 (Capital of Texas Highway across Pennybacker Bridge) ──
    {
      name: 'Loop 360',
      color: 0xf59e0b, // Glowing amber scenic corridor
      width: 0.020,
      opacity: 0.90,
      coords: [
        { lat: 30.395, lng: -97.745 },
        { lat: 30.370, lng: -97.770 },
        { lat: 30.351, lng: -97.797 },
        { lat: 30.325, lng: -97.805 },
        { lat: 30.295, lng: -97.820 },
        { lat: 30.260, lng: -97.830 },
        { lat: 30.235, lng: -97.840 },
      ],
    },
    // ── US-290 East (Manor Corridor) ──
    {
      name: 'US-290 East',
      color: 0x8b5cf6,
      width: 0.020,
      opacity: 0.90,
      coords: [
        { lat: 30.320, lng: -97.714 },
        { lat: 30.322, lng: -97.680 },
        { lat: 30.335, lng: -97.640 },
        { lat: 30.355, lng: -97.580 },
      ],
    },
    // ── SH-130 Tollway ──
    {
      name: 'SH-130',
      color: 0x64748b,
      width: 0.018,
      opacity: 0.85,
      coords: [
        { lat: 30.460, lng: -97.580 },
        { lat: 30.345, lng: -97.600 },
        { lat: 30.240, lng: -97.605 },
        { lat: 30.170, lng: -97.630 },
      ],
    },
    // ── Iconic North-South Arterials ──
    {
      name: 'Congress Avenue',
      color: 0xfbbf24, // Bright amber glowing spine to Capitol & SoCo
      width: 0.018,
      opacity: 0.95,
      coords: [
        { lat: 30.2747, lng: -97.7404 }, // Capitol South Portico
        { lat: 30.2670, lng: -97.7430 }, // 6th St Downtown
        { lat: 30.2610, lng: -97.7450 }, // Congress Ave Bridge
        { lat: 30.2500, lng: -97.7490 }, // South Congress Strip
        { lat: 30.2350, lng: -97.7560 }, // SoCo South
        { lat: 30.2150, lng: -97.7650 }, // St. Elmo
        { lat: 30.1700, lng: -97.7850 }, // Southpark Meadows
      ],
    },
    {
      name: 'Lamar Blvd',
      color: 0x38bdf8,
      width: 0.016,
      opacity: 0.85,
      coords: [
        { lat: 30.370, lng: -97.700 },
        { lat: 30.340, lng: -97.715 },
        { lat: 30.315, lng: -97.734 },
        { lat: 30.285, lng: -97.749 },
        { lat: 30.267, lng: -97.759 },
        { lat: 30.250, lng: -97.770 },
        { lat: 30.220, lng: -97.795 },
      ],
    },
    {
      name: 'Guadalupe St / The Drag / Burnet Rd',
      color: 0x38bdf8,
      width: 0.015,
      opacity: 0.85,
      coords: [
        { lat: 30.395, lng: -97.725 },
        { lat: 30.355, lng: -97.730 },
        { lat: 30.315, lng: -97.734 },
        { lat: 30.306, lng: -97.738 },
        { lat: 30.292, lng: -97.741 },
        { lat: 30.282, lng: -97.742 },
        { lat: 30.265, lng: -97.746 },
      ],
    },
    // ── Iconic East-West Arterials ──
    {
      name: 'Cesar Chavez St',
      color: 0x38bdf8,
      width: 0.016,
      opacity: 0.85,
      coords: [
        { lat: 30.270, lng: -97.768 },
        { lat: 30.264, lng: -97.743 },
        { lat: 30.258, lng: -97.730 },
        { lat: 30.252, lng: -97.712 },
        { lat: 30.250, lng: -97.695 },
      ],
    },
    {
      name: 'RM 2222 / Koenig Ln',
      color: 0x818cf8,
      width: 0.015,
      opacity: 0.85,
      coords: [
        { lat: 30.375, lng: -97.800 },
        { lat: 30.355, lng: -97.770 },
        { lat: 30.335, lng: -97.748 },
        { lat: 30.320, lng: -97.718 },
        { lat: 30.315, lng: -97.700 },
      ],
    },
    {
      name: 'Airport Blvd (Mueller Link)',
      color: 0xf43f5e, // Rose neon link through Mueller
      width: 0.016,
      opacity: 0.85,
      coords: [
        { lat: 30.340, lng: -97.715 },
        { lat: 30.320, lng: -97.715 },
        { lat: 30.306, lng: -97.708 },
        { lat: 30.298, lng: -97.701 },
        { lat: 30.270, lng: -97.690 },
      ],
    },
    {
      name: 'MLK Jr Blvd',
      color: 0x818cf8,
      width: 0.014,
      opacity: 0.85,
      coords: [
        { lat: 30.283, lng: -97.755 },
        { lat: 30.281, lng: -97.740 },
        { lat: 30.279, lng: -97.725 },
        { lat: 30.277, lng: -97.700 },
        { lat: 30.280, lng: -97.685 },
      ],
    },
    {
      name: 'Riverside Drive',
      color: 0x38bdf8,
      width: 0.015,
      opacity: 0.85,
      coords: [
        { lat: 30.260, lng: -97.750 },
        { lat: 30.245, lng: -97.735 },
        { lat: 30.235, lng: -97.715 },
        { lat: 30.220, lng: -97.685 },
      ],
    },
    {
      name: 'Barton Springs Rd',
      color: 0x2dd4bf,
      width: 0.015,
      opacity: 0.85,
      coords: [
        { lat: 30.2635, lng: -97.771 },
        { lat: 30.260, lng: -97.760 },
        { lat: 30.257, lng: -97.746 },
      ],
    },
    {
      name: 'Parmer Lane',
      color: 0x60a5fa,
      width: 0.016,
      opacity: 0.85,
      coords: [
        { lat: 30.440, lng: -97.760 },
        { lat: 30.420, lng: -97.710 },
        { lat: 30.400, lng: -97.670 },
        { lat: 30.380, lng: -97.620 },
      ],
    },
    {
      name: 'Slaughter Lane',
      color: 0x60a5fa,
      width: 0.016,
      opacity: 0.85,
      coords: [
        { lat: 30.185, lng: -97.870 },
        { lat: 30.175, lng: -97.820 },
        { lat: 30.170, lng: -97.785 },
        { lat: 30.165, lng: -97.745 },
      ],
    },
    // ── Additional Major Austin Arterials ──
    {
      name: 'Springdale Rd',
      color: 0xec4899,
      width: 0.014,
      opacity: 0.85,
      coords: [
        { lat: 30.320, lng: -97.695 },
        { lat: 30.290, lng: -97.690 },
        { lat: 30.260, lng: -97.695 },
      ],
    },
    {
      name: 'Pleasant Valley Rd',
      color: 0x38bdf8,
      width: 0.015,
      opacity: 0.85,
      coords: [
        { lat: 30.300, lng: -97.705 },
        { lat: 30.275, lng: -97.712 },
        { lat: 30.245, lng: -97.720 },
        { lat: 30.225, lng: -97.730 },
      ],
    },
    {
      name: 'Manor Rd',
      color: 0xfbbf24,
      width: 0.014,
      opacity: 0.85,
      coords: [
        { lat: 30.284, lng: -97.730 },
        { lat: 30.285, lng: -97.715 },
        { lat: 30.295, lng: -97.698 },
        { lat: 30.305, lng: -97.675 },
      ],
    },
    {
      name: 'Enfield Rd / 15th St',
      color: 0x818cf8,
      width: 0.014,
      opacity: 0.85,
      coords: [
        { lat: 30.285, lng: -97.775 },
        { lat: 30.280, lng: -97.755 },
        { lat: 30.278, lng: -97.735 },
        { lat: 30.276, lng: -97.715 },
      ],
    },
    {
      name: 'East 7th St',
      color: 0xf43f5e,
      width: 0.015,
      opacity: 0.85,
      coords: [
        { lat: 30.267, lng: -97.750 },
        { lat: 30.264, lng: -97.735 },
        { lat: 30.261, lng: -97.715 },
        { lat: 30.258, lng: -97.690 },
      ],
    },
    {
      name: 'Lake Austin Blvd / Exposition',
      color: 0x2dd4bf,
      width: 0.014,
      opacity: 0.85,
      coords: [
        { lat: 30.310, lng: -97.770 },
        { lat: 30.290, lng: -97.765 },
        { lat: 30.275, lng: -97.770 },
        { lat: 30.270, lng: -97.755 },
      ],
    },
    {
      name: 'Braker Lane',
      color: 0x60a5fa,
      width: 0.015,
      opacity: 0.85,
      coords: [
        { lat: 30.415, lng: -97.750 },
        { lat: 30.400, lng: -97.715 },
        { lat: 30.385, lng: -97.675 },
      ],
    },
    {
      name: 'Spicewood Springs / Anderson Ln',
      color: 0x818cf8,
      width: 0.015,
      opacity: 0.85,
      coords: [
        { lat: 30.380, lng: -97.770 },
        { lat: 30.360, lng: -97.730 },
        { lat: 30.355, lng: -97.700 },
      ],
    },
    {
      name: 'Berkman Dr (Mueller Loop)',
      color: 0x06b6d4,
      width: 0.013,
      opacity: 0.88,
      coords: [
        { lat: 30.310, lng: -97.702 },
        { lat: 30.295, lng: -97.705 },
        { lat: 30.285, lng: -97.710 },
      ],
    },
    {
      name: 'South 1st St',
      color: 0x38bdf8,
      width: 0.015,
      opacity: 0.85,
      coords: [
        { lat: 30.263, lng: -97.749 },
        { lat: 30.248, lng: -97.755 },
        { lat: 30.230, lng: -97.765 },
        { lat: 30.200, lng: -97.780 },
      ],
    },
  ];

  streetsAndHighways.forEach((road) => {
    const pts = road.coords.map((c) => latLngToBoardPos(c.lat, c.lng, 0.0035));
    const curve = new THREE.CatmullRomCurve3(pts);
    const segs = Math.max(25, pts.length * 7);
    const curvePts = curve.getPoints(segs);
    const roadGeo = new THREE.BufferGeometry();
    const verts = [];
    const idxs = [];
    const halfW = road.width / 2;

    for (let i = 0; i <= segs; i++) {
      const p = curvePts[i];
      const tan = curve.getTangent(i / segs);
      const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      verts.push(
        p.x + norm.x * halfW, 0.0035, p.z + norm.z * halfW,
        p.x - norm.x * halfW, 0.0035, p.z - norm.z * halfW
      );
      if (i < segs) {
        const b = i * 2;
        idxs.push(b, b + 2, b + 1);
        idxs.push(b + 1, b + 2, b + 3);
      }
    }
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    roadGeo.setIndex(idxs);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshBasicMaterial({
      color: road.color,
      transparent: true,
      opacity: road.opacity || 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    geoGroup.add(roadMesh);
  });

  // 8. Austin Neighborhood & District Zones (Translucent Ambient Ground Patches)
  const districtZones = [
    { label: '🦆 Mueller', lat: 30.2980, lng: -97.7050, radius: 0.16, color: 0x06b6d4 },
    { label: '🏛️ Downtown', lat: 30.2670, lng: -97.7440, radius: 0.15, color: 0xf59e0b },
    { label: '🤘 UT Campus', lat: 30.2862, lng: -97.7394, radius: 0.14, color: 0xf97316 },
    { label: '🛍️ The Domain', lat: 30.4020, lng: -97.7240, radius: 0.18, color: 0x6366f1 },
    { label: '🏖️ Zilker', lat: 30.2650, lng: -97.7720, radius: 0.15, color: 0x22c55e },
    { label: '🌮 SoCo', lat: 30.2450, lng: -97.7520, radius: 0.15, color: 0xa855f7 },
    { label: '🏡 Hyde Park', lat: 30.3040, lng: -97.7320, radius: 0.13, color: 0x10b981 },
    { label: '🎨 Cherrywood', lat: 30.2880, lng: -97.7150, radius: 0.13, color: 0xec4899 },
    { label: '🌳 Tarrytown', lat: 30.2920, lng: -97.7700, radius: 0.14, color: 0x38bdf8 },
    { label: '🌯 East Austin', lat: 30.2580, lng: -97.7150, radius: 0.16, color: 0xf43f5e },
    { label: '🤠 South / 290', lat: 30.2220, lng: -97.7750, radius: 0.18, color: 0x64748b },
    { label: '✈️ Airport (ABIA)', lat: 30.1980, lng: -97.6650, radius: 0.18, color: 0x14b8a6 },
    { label: '🏞️ Oak Hill', lat: 30.2350, lng: -97.8600, radius: 0.16, color: 0xd97706 },
  ];

  districtZones.forEach((dz) => {
    // Ambient colored circle patch
    const zoneMesh = createDistrictZone(dz.lat, dz.lng, dz.radius, dz.color, 0.15);
    geoGroup.add(zoneMesh);

    // Flat Ground Name Label Badge
    const labelMesh = createGroundLabel(dz.label, dz.lat, dz.lng, 0.28, 0.07, 24, '#ffffff', 'rgba(15, 23, 42, 0.85)', '#38bdf8');
    geoGroup.add(labelMesh);
  });

  // 8b. Uppercase Google Maps Typography (District Labels matching dark mode screenshot)
  const gmapsNeighborhoodLabels = [
    { label: 'CRESTVIEW', lat: 30.352, lng: -97.722, w: 0.26 },
    { label: 'HYDE PARK', lat: 30.304, lng: -97.732, w: 0.28 },
    { label: 'CENTRAL AUSTIN', lat: 30.292, lng: -97.742, w: 0.36 },
    { label: 'UNIVERSITY OF TEXAS AT AUSTIN', lat: 30.283, lng: -97.736, w: 0.52 },
    { label: 'TEXAS CAPITOL', lat: 30.2747, lng: -97.7404, w: 0.32 },
    { label: 'TARRYTOWN', lat: 30.292, lng: -97.770, w: 0.28 },
    { label: 'MAYFIELD PARK AND NATURE PRESERVE', lat: 30.312, lng: -97.771, w: 0.56 },
    { label: 'ZILKER', lat: 30.265, lng: -97.772, w: 0.24 },
    { label: 'BARTON HILLS', lat: 30.252, lng: -97.780, w: 0.30 },
    { label: 'BOULDIN CREEK', lat: 30.250, lng: -97.756, w: 0.32 },
    { label: 'EAST CESAR CHAVEZ', lat: 30.255, lng: -97.718, w: 0.38 },
    { label: 'EAST RIVERSIDE - OLTORF', lat: 30.235, lng: -97.725, w: 0.44 },
    { label: 'SOUTH LAMAR', lat: 30.230, lng: -97.775, w: 0.30 },
  ];

  gmapsNeighborhoodLabels.forEach((nl) => {
    const txtMesh = createNeighborhoodTextLabel(nl.label, nl.lat, nl.lng, nl.w, 0.08, 19, 'rgba(148, 163, 184, 0.82)');
    geoGroup.add(txtMesh);
  });

  // 9. Major Highway Shield Ground Badges
  const highwayShields = [
    { label: 'I-35', lat: 30.355, lng: -97.700, color: '#6366f1' },
    { label: 'MOPAC', lat: 30.350, lng: -97.747, color: '#0ea5e9' },
    { label: 'US-183', lat: 30.380, lng: -97.735, color: '#10b981' },
    { label: 'HWY 71', lat: 30.224, lng: -97.735, color: '#a855f7' },
    { label: 'LOOP 360', lat: 30.335, lng: -97.802, color: '#f59e0b' },
  ];

  highwayShields.forEach((hw) => {
    const shield = createGroundLabel(hw.label, hw.lat, hw.lng, 0.20, 0.06, 22, hw.color, 'rgba(11, 19, 43, 0.90)', hw.color);
    geoGroup.add(shield);
  });

  return geoGroup;
}


/**
 * Dispersal algorithm to prevent overlapping pins on the 2.5D plane.
 * Calibrated with a tight 0.0035 degree radius so courts stay in their
 * true Austin neighborhood & park while preventing pin overlap.
 */
function getDispersedCourts(courts) {
  const items = courts.map((c) => ({
    ...c,
    renderLat: c.coords.lat,
    renderLng: c.coords.lng,
  }));

  const MIN_DIST = 0.008;
  const ITERATIONS = 60;

  const landmarkPositions = AUSTIN_LANDMARKS_CONFIG.map((lm) => ({
    lat: lm.lat,
    lng: lm.lng,
  }));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < items.length; i++) {
      // Repel from other courts
      for (let j = i + 1; j < items.length; j++) {
        let dLat = items[j].renderLat - items[i].renderLat;
        let dLng = items[j].renderLng - items[i].renderLng;
        let dist = Math.hypot(dLat, dLng);

        if (dist < MIN_DIST) {
          if (dist < 0.0001) {
            dLat = (Math.random() - 0.5) * 0.003;
            dLng = (Math.random() - 0.5) * 0.003;
            dist = Math.hypot(dLat, dLng);
          }
          const overlap = (MIN_DIST - dist) / 2;
          const pushLat = (dLat / dist) * overlap;
          const pushLng = (dLng / dist) * overlap;

          items[j].renderLat += pushLat;
          items[j].renderLng += pushLng;
          items[i].renderLat -= pushLat;
          items[i].renderLng -= pushLng;
        }
      }

      // Repel from nearby landmarks so pins never obscure landmark models
      for (let k = 0; k < landmarkPositions.length; k++) {
        const lm = landmarkPositions[k];
        let dLat = items[i].renderLat - lm.lat;
        let dLng = items[i].renderLng - lm.lng;
        let dist = Math.hypot(dLat, dLng);

        if (dist < MIN_DIST * 0.85) {
          if (dist < 0.0001) {
            dLat = (Math.random() - 0.5) * 0.003;
            dLng = (Math.random() - 0.5) * 0.003;
            dist = Math.hypot(dLat, dLng);
          }
          const overlap = (MIN_DIST * 0.85 - dist);
          items[i].renderLat += (dLat / dist) * overlap;
          items[i].renderLng += (dLng / dist) * overlap;
        }
      }
    }
  }
  return items;
}

export default function WorldGlobe({ onCourtSelect, activeGames = {}, activeGamesList = {}, onCallNext, onJoinGame, userProfile }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);

  const markerMeshesRef = useRef([]);
  const courtGroupListRef = useRef([]);
  const landmarkMeshesRef = useRef([]);
  const animFrameRef = useRef(null);
  const selectionRingRef = useRef(null);

  // 2.5D Tabletop Camera & Navigation Tracking (Mueller initial focus)
  const initialFocusPos = latLngToBoardPos(30.2980, -97.7050);
  const currentTargetPosRef = useRef({ x: initialFocusPos.x, z: initialFocusPos.z });
  const desiredTargetPosRef = useRef({ x: initialFocusPos.x, z: initialFocusPos.z });

  const currentZoomRef = useRef(0.75); // Mueller zoom level
  const targetZoomRef = useRef(0.75);

  // Gesture, swipe momentum & inertia tracking
  const velocityRef = useRef({ x: 0, z: 0 });
  const isDraggingRef = useRef(false);

  const [selectedCourt, setSelectedCourt] = useState(null);
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [selectedSport, setSelectedSport] = useState('all');
  const selectedSportRef = useRef('all');
  const [activeDistrict, setActiveDistrict] = useState('Mueller');
  const [loaded, setLoaded] = useState(false);
  const [zoomLevelState, setZoomLevelState] = useState('detail');
  const [viewMode, setViewMode] = useState('3d'); // '3d' | '2d' (Google Maps style)
  const viewModeRef = useRef('3d');
  const modeTransitionRef = useRef(0); // 0 = 3D isometric, 1 = 2D flat top-down

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // ── User Location ──
  const { position: userGeoPos, error: locationError, loading: locationLoading, request: requestLocation } = useUserLocation();
  const userLocPinnedRef = useRef(false);
  const [userMarkerScreen, setUserMarkerScreen] = useState(null);

  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // ── Setup 2.5D Isometric Tabletop Scene ──
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.08);
    sceneRef.current = scene;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Camera: 2.5D Isometric Perspective ──
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 50);
    cameraRef.current = camera;

    // ── Lighting ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.8);
    sunLight.position.set(4, 8, 4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // ── Background Ambient Particles ──
    const starGeo = new THREE.BufferGeometry();
    const starCount = 400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 16;
      starPos[i + 1] = Math.random() * 4 - 0.5;
      starPos[i + 2] = (Math.random() - 0.5) * 16;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          color: 0x38bdf8,
          size: 0.025,
          transparent: true,
          opacity: 0.45,
        })
      )
    );

    // ═══════════════════════════════════════════════════════════════════
    // ── 1. EXPANSIVE AUSTIN METRO GAME BOARD & GEOGRAPHY ──
    // ═══════════════════════════════════════════════════════════════════
    const boardGroup = new THREE.Group();
    boardGroup.name = 'ATX_Tabletop_Board';
    scene.add(boardGroup);

    // Infinite Horizon Backdrop (seamlessly blends with scene atmospheric fog)
    const backdropGeo = new THREE.PlaneGeometry(METRO_OUTER_SIZE, METRO_OUTER_SIZE);
    const backdropMat = new THREE.MeshBasicMaterial({
      color: 0x070b14,
    });
    const backdropMesh = new THREE.Mesh(backdropGeo, backdropMat);
    backdropMesh.rotation.x = -Math.PI / 2;
    backdropMesh.position.y = -0.006;
    boardGroup.add(backdropMesh);

    // Base Metro Ground surface (14.0 x 14.0 covering Greater Austin)
    const canvasGeo = new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_DEPTH);
    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0x091024,
      roughness: 0.85,
      metalness: 0.05,
    });
    const canvasMesh = new THREE.Mesh(canvasGeo, canvasMat);
    canvasMesh.rotation.x = -Math.PI / 2;
    canvasMesh.receiveShadow = true;
    boardGroup.add(canvasMesh);

    // Procedural Dark Digital Vector Grid texture
    const gridTexture = createAustinGridTexture();
    canvasMat.map = gridTexture;
    canvasMat.needsUpdate = true;

    // Add Procedural Colorado River, Lake Austin, highways & district zones
    const geoFeatures = createAustinGeographicFeatures();
    boardGroup.add(geoFeatures);

    // Selection Halo Ring for currently selected court
    const selRingGeo = new THREE.RingGeometry(0.028, 0.038, 32);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const selectionRing = new THREE.Mesh(selRingGeo, selRingMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.006;
    selectionRing.visible = false;
    scene.add(selectionRing);
    selectionRingRef.current = selectionRing;

    // ═══════════════════════════════════════════════════════════════════
    // ── 2. ICONIC 3D LOW-POLY AUSTIN LANDMARKS & 2D POI BADGES ──
    // ═══════════════════════════════════════════════════════════════════
    const landmarksGroup = new THREE.Group();
    landmarksGroup.name = 'ATX_Landmarks';
    const landmarkClickMeshes = [];

    AUSTIN_LANDMARKS_CONFIG.forEach((lm) => {
      const pos = latLngToBoardPos(lm.lat, lm.lng, 0.005);
      const landmarkMesh = lm.createMesh();
      landmarkMesh.position.copy(pos);
      if (lm.scale) {
        landmarkMesh.scale.multiplyScalar(lm.scale);
      }
      landmarkMesh.userData = { landmark: lm };

      // 2D POI Badge for overhead Google Maps style view
      const poiTexture = getLandmarkPoiTexture(lm.emoji || '🏛️', lm.name);
      const poiGeo = new THREE.PlaneGeometry(0.24, 0.06);
      const poiMat = new THREE.MeshBasicMaterial({
        map: poiTexture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      const poiMesh = new THREE.Mesh(poiGeo, poiMat);
      poiMesh.rotation.x = -Math.PI / 2;
      poiMesh.position.set(0, 0.007, 0.06);
      poiMesh.userData = { landmark: lm, parentGroup: landmarkMesh };
      landmarkMesh.add(poiMesh);

      // Generous finger-friendly touch hitbox for landmarks
      const lmHitRadius = 0.080;
      const lmHitHeight = 0.120;
      const lmHitGeo = new THREE.CylinderGeometry(lmHitRadius, lmHitRadius, lmHitHeight, 12);
      const lmHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const lmHitBox = new THREE.Mesh(lmHitGeo, lmHitMat);
      lmHitBox.position.y = lmHitHeight / 2;
      lmHitBox.userData = { landmark: lm, parentGroup: landmarkMesh };
      landmarkMesh.add(lmHitBox);
      landmarkClickMeshes.push(lmHitBox);

      // Tag all children for raycasting
      landmarkMesh.traverse((child) => {
        if (child.isMesh) {
          child.userData = { landmark: lm, parentGroup: landmarkMesh };
          landmarkClickMeshes.push(child);
        }
      });

      landmarksGroup.add(landmarkMesh);
    });

    boardGroup.add(landmarksGroup);
    landmarkMeshesRef.current = landmarkClickMeshes;

    // ═══════════════════════════════════════════════════════════════════
    // ── 3. INTERACTIVE SPORTS COURTS WITH 3D MODELS & 2D MAP BADGES ──
    // ═══════════════════════════════════════════════════════════════════
    const courtsGroup = new THREE.Group();
    courtsGroup.name = 'ATX_Courts';
    const dispersedCourts = getDispersedCourts(AUSTIN_COURTS_DATA);
    const markerClickMeshes = [];
    const courtGroups = [];

    dispersedCourts.forEach((court) => {
      const courtWrapper = new THREE.Group();
      const pos = latLngToBoardPos(court.renderLat, court.renderLng, 0.004);

      // Low-poly 3D sports court surface
      const lowPolyCourt = createLowPolyCourtMesh(court);
      courtWrapper.add(lowPolyCourt);

      const primarySport = (court.sport && court.sport[0]) || 'basketball';
      const sportColor = SPORT_META[primarySport]?.color || '#f97316';
      const threeColor = new THREE.Color(sportColor);

      // Flagpole & glowing sports sphere pin (3D Mode)
      const poleGeo = new THREE.CylinderGeometry(0.0012, 0.0012, 0.030, 6);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 0.016;

      const headGeo = new THREE.SphereGeometry(0.0075, 12, 10);
      const headMat = new THREE.MeshStandardMaterial({
        color: threeColor,
        emissive: threeColor,
        emissiveIntensity: 0.75,
        roughness: 0.2,
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 0.033;

      courtWrapper.add(pole, head);

      // Flat 2D Google Maps-style pin badge lying horizontally on the ground
      const badgeTexture = getSportBadgeTexture(primarySport);
      const badgeGeo = new THREE.PlaneGeometry(0.046, 0.046);
      const badgeMat = new THREE.MeshBasicMaterial({
        map: badgeTexture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
      badgeMesh.rotation.x = -Math.PI / 2;
      badgeMesh.position.y = 0.0055;
      badgeMesh.userData = { court, parentGroup: courtWrapper, isCourt: true };
      courtWrapper.add(badgeMesh);

      // Generous finger-friendly touch hitbox for mobile & desktop
      const hitRadius = 0.075;
      const hitHeight = 0.110;
      const hitGeo = new THREE.CylinderGeometry(hitRadius, hitRadius, hitHeight, 12);
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const hitBox = new THREE.Mesh(hitGeo, hitMat);
      hitBox.position.y = hitHeight / 2;
      hitBox.userData = { court, parentGroup: courtWrapper, isCourt: true };
      courtWrapper.add(hitBox);

      courtWrapper.position.copy(pos);

      courtWrapper.userData = { court, head, hitBox, lowPolyCourt, primarySport, badgeMesh };
      head.userData = { court, parentGroup: courtWrapper, isCourt: true };
      pole.userData = { court, parentGroup: courtWrapper, isCourt: true };

      // Tag all meshes within lowPolyCourt as well for raycasting
      lowPolyCourt.traverse((child) => {
        if (child.isMesh) {
          child.userData = { court, parentGroup: courtWrapper, isCourt: true };
          markerClickMeshes.push(child);
        }
      });

      markerClickMeshes.push(hitBox, head, pole, badgeMesh);
      courtGroups.push(courtWrapper);
      courtsGroup.add(courtWrapper);
    });


    boardGroup.add(courtsGroup);
    markerMeshesRef.current = markerClickMeshes;
    courtGroupListRef.current = courtGroups;

    // ═══════════════════════════════════════════════════════════════════
    // ── 4. BULLETPROOF TAP & MOBILE SCREEN-SPACE PROXIMITY SELECTION ──
    // ═══════════════════════════════════════════════════════════════════
    let lastTapHandledTime = 0;

    function handleTap(clientX, clientY) {
      if (!mount || !camera) return;
      const rect = mount.getBoundingClientRect();
      const tapX = clientX;
      const tapY = clientY;

      // 1. Screen-Space Proximity to Courts (58px thumb-friendly radius on mobile screen!)
      // This guarantees that tapping anywhere near a court on a phone screen reliably selects it.
      let closestCourt = null;
      let minCourtDist = 58;

      if (courtGroupListRef.current) {
        for (let i = 0; i < courtGroupListRef.current.length; i++) {
          const group = courtGroupListRef.current[i];
          if (!group.visible) continue;
          const court = group.userData?.court;
          if (!court) continue;

          // Project court head pin position to 2D screen coordinates
          const pinPos = group.position.clone();
          pinPos.y += 0.024;
          const proj = pinPos.project(camera);

          // Skip if behind camera view plane
          if (proj.z > 1) continue;

          const sx = ((proj.x + 1) / 2) * rect.width + rect.left;
          const sy = ((-proj.y + 1) / 2) * rect.height + rect.top;

          const dist = Math.hypot(tapX - sx, tapY - sy);
          if (dist < minCourtDist) {
            minCourtDist = dist;
            closestCourt = court;
          }
        }
      }

      if (closestCourt) {
        setSelectedCourt(closestCourt);
        setSelectedLandmark(null);
        const pos = latLngToBoardPos(
          closestCourt.renderLat || closestCourt.coords.lat,
          closestCourt.renderLng || closestCourt.coords.lng
        );
        desiredTargetPosRef.current = { x: pos.x, z: pos.z };
        targetZoomRef.current = 0.65;
        velocityRef.current = { x: 0, z: 0 };
        lastTapHandledTime = performance.now();
        return;
      }

      // 2. Screen-Space Proximity to Landmarks (Capitol, UT Tower, Mueller Tower, etc.)
      let closestLandmark = null;
      let minLandmarkDist = 65;

      AUSTIN_LANDMARKS_CONFIG.forEach((lm) => {
        const lmPos = latLngToBoardPos(lm.lat, lm.lng, 0.035);
        const proj = lmPos.project(camera);
        if (proj.z > 1) return;

        const sx = ((proj.x + 1) / 2) * rect.width + rect.left;
        const sy = ((-proj.y + 1) / 2) * rect.height + rect.top;
        const dist = Math.hypot(tapX - sx, tapY - sy);
        if (dist < minLandmarkDist) {
          minLandmarkDist = dist;
          closestLandmark = lm;
        }
      });

      if (closestLandmark) {
        setSelectedLandmark(closestLandmark);
        setSelectedCourt(null);
        const pos = latLngToBoardPos(closestLandmark.lat, closestLandmark.lng);
        desiredTargetPosRef.current = { x: pos.x, z: pos.z };
        targetZoomRef.current = 0.70;
        velocityRef.current = { x: 0, z: 0 };
        lastTapHandledTime = performance.now();
        return;
      }

      // 3. Fallback: 3D Raycasting
      mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      const visibleCourtMeshes = markerMeshesRef.current.filter((m) => {
        const parent = m.userData?.parentGroup || m.parent;
        return parent && parent.visible !== false;
      });

      const courtHits = raycasterRef.current.intersectObjects(visibleCourtMeshes, false);
      if (courtHits.length > 0) {
        for (let i = 0; i < courtHits.length; i++) {
          const court = courtHits[i].object.userData?.court;
          if (court) {
            setSelectedCourt(court);
            setSelectedLandmark(null);
            const pos = latLngToBoardPos(court.renderLat || court.coords.lat, court.renderLng || court.coords.lng);
            desiredTargetPosRef.current = { x: pos.x, z: pos.z };
            targetZoomRef.current = 0.65;
            velocityRef.current = { x: 0, z: 0 };
            lastTapHandledTime = performance.now();
            return;
          }
        }
      }

      // Tapped empty space far from any courts or landmarks
      setSelectedCourt(null);
      setSelectedLandmark(null);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ── 5. UNIFIED MULTI-TOUCH, SWIPE & INERTIA GESTURE ENGINE ──
    // ═══════════════════════════════════════════════════════════════════
    const activePointers = new Map();
    let initialPinchDist = null;
    let initialPinchZoom = null;
    let gestureStart = { x: 0, y: 0, time: 0 };
    let hasMovedSignificantly = false;
    let lastMoveTime = 0;
    let dragStart = { x: 0, y: 0 };

    function onPointerDown(e) {
      try {
        mount.setPointerCapture(e.pointerId);
      } catch (_) {}

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      velocityRef.current = { x: 0, z: 0 };

      if (activePointers.size === 1) {
        isDraggingRef.current = true;
        dragStart = { x: e.clientX, y: e.clientY };
        gestureStart = { x: e.clientX, y: e.clientY, time: performance.now() };
        hasMovedSignificantly = false;
        lastMoveTime = performance.now();
      } else if (activePointers.size === 2) {
        // Two-finger pinch
        const pts = Array.from(activePointers.values());
        initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        initialPinchZoom = targetZoomRef.current;
        hasMovedSignificantly = true;
      }
    }

    function onPointerMove(e) {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Handle 2-finger pinch zoom
      if (activePointers.size === 2 && initialPinchDist) {
        const pts = Array.from(activePointers.values());
        const currDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (currDist > 10) {
          const ratio = initialPinchDist / currDist;
          targetZoomRef.current = Math.max(0.38, Math.min(2.20, initialPinchZoom * ratio));
        }

        return;
      }

      // Handle 1-finger swipe / pan
      if (activePointers.size === 1 && isDraggingRef.current) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const totalDist = Math.hypot(e.clientX - gestureStart.x, e.clientY - gestureStart.y);

        // Mobile touch slop: only treat as drag if finger moved > 18px
        if (totalDist > 18) {
          hasMovedSignificantly = true;
        }

        if (hasMovedSignificantly) {
          const panSpeed = 0.0022 * currentZoomRef.current;
          const worldDx = -dx * panSpeed;
          const worldDz = -dy * panSpeed;

          desiredTargetPosRef.current.x = Math.max(
            -BOARD_LIMIT,
            Math.min(BOARD_LIMIT, desiredTargetPosRef.current.x + worldDx)
          );
          desiredTargetPosRef.current.z = Math.max(
            -BOARD_LIMIT,
            Math.min(BOARD_LIMIT, desiredTargetPosRef.current.z + worldDz)
          );

          dragStart = { x: e.clientX, y: e.clientY };

          const now = performance.now();
          const dt = Math.max(1, now - lastMoveTime);
          velocityRef.current = {
            x: (worldDx / dt) * 16.6,
            z: (worldDz / dt) * 16.6,
          };
          lastMoveTime = now;
        }
      }
    }

    function onPointerUp(e) {
      try {
        mount.releasePointerCapture(e.pointerId);
      } catch (_) {}

      activePointers.delete(e.pointerId);

      if (activePointers.size === 0) {
        isDraggingRef.current = false;
        const now = performance.now();

        // If pointer stopped moving for > 80ms before release, kill flick momentum
        if (now - lastMoveTime > 80) {
          velocityRef.current = { x: 0, z: 0 };
        } else {
          // Clamp maximum flick glide velocity
          const maxVel = 0.038;
          velocityRef.current.x = Math.max(-maxVel, Math.min(maxVel, velocityRef.current.x));
          velocityRef.current.z = Math.max(-maxVel, Math.min(maxVel, velocityRef.current.z));
        }

        // Tap detected using initial gesture touch position
        if (!hasMovedSignificantly && now - gestureStart.time < 500) {
          handleTap(gestureStart.x, gestureStart.y);
        }
      }
    }

    function onPointerCancel(e) {
      try {
        mount.releasePointerCapture(e.pointerId);
      } catch (_) {}
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) {
        isDraggingRef.current = false;
        velocityRef.current = { x: 0, z: 0 };
      }
    }

    function onMountClick(e) {
      // Direct click fallback if pointerup didn't already fire within 350ms
      if (performance.now() - lastTapHandledTime < 350) return;
      handleTap(e.clientX, e.clientY);
    }

    mount.addEventListener('pointerdown', onPointerDown);
    mount.addEventListener('pointermove', onPointerMove);
    mount.addEventListener('pointerup', onPointerUp);
    mount.addEventListener('pointercancel', onPointerCancel);
    mount.addEventListener('click', onMountClick);

    // ═══════════════════════════════════════════════════════════════════
    // ── 6. ANIMATION & 2.5D ISOMETRIC CAMERA GLIDE LOOP ──
    // ═══════════════════════════════════════════════════════════════════
    let frame = 0;
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      frame++;

      // Apply swipe inertia / flick momentum when finger is released
      if (!isDraggingRef.current && (Math.abs(velocityRef.current.x) > 0.0001 || Math.abs(velocityRef.current.z) > 0.0001)) {
        desiredTargetPosRef.current.x = Math.max(
          -BOARD_LIMIT,
          Math.min(BOARD_LIMIT, desiredTargetPosRef.current.x + velocityRef.current.x)
        );
        desiredTargetPosRef.current.z = Math.max(
          -BOARD_LIMIT,
          Math.min(BOARD_LIMIT, desiredTargetPosRef.current.z + velocityRef.current.z)
        );
        velocityRef.current.x *= 0.91; // Smooth friction decay
        velocityRef.current.z *= 0.91;
      }

      // Smooth camera target glide
      currentTargetPosRef.current.x +=
        (desiredTargetPosRef.current.x - currentTargetPosRef.current.x) * 0.12;
      currentTargetPosRef.current.z +=
        (desiredTargetPosRef.current.z - currentTargetPosRef.current.z) * 0.12;

      // Smooth zoom interpolation
      currentZoomRef.current += (targetZoomRef.current - currentZoomRef.current) * 0.12;

      // ── Dynamic 3D Isometric <-> Flat 2D Google Maps Camera Swoop ──
      const targetTransition = viewModeRef.current === '2d' ? 1.0 : 0.0;
      modeTransitionRef.current += (targetTransition - modeTransitionRef.current) * 0.10;
      const t = modeTransitionRef.current;

      const zoom = currentZoomRef.current;
      const targetX = currentTargetPosRef.current.x;
      const targetZ = currentTargetPosRef.current.z;

      // 3D Isometric camera position (45-degree angle)
      const cam3D_Y = targetZ + zoom * 1.55;
      const cam3D_Z = targetZ + zoom * 1.35;

      // 2D Flat Top-Down camera position (90-degree overhead Google Maps mode)
      const cam2D_Y = zoom * 2.25;
      const cam2D_Z = targetZ;

      const camY = THREE.MathUtils.lerp(cam3D_Y, cam2D_Y, t);
      const camZ = THREE.MathUtils.lerp(cam3D_Z, cam2D_Z, t);

      camera.position.set(targetX, camY, camZ);

      // Interpolate up vector: in 3D up is (0, 1, 0); in 2D top-down up is (0, 0.001, -1) ensuring North is UP
      camera.up.set(0, THREE.MathUtils.lerp(1, 0.001, t), THREE.MathUtils.lerp(0, -1, t)).normalize();
      camera.lookAt(targetX, 0, targetZ);


      // Pulse pin heads subtly
      if (frame % 2 === 0) {
        const pulse = 1.0 + Math.sin(frame * 0.05) * 0.06;
        markerMeshesRef.current.forEach((mesh) => {
          if (mesh.userData?.isCourt && mesh.geometry?.type === 'SphereGeometry') {
            mesh.scale.setScalar(pulse);
          }
        });
      }

      // Pulse selected court halo ring
      if (selectionRingRef.current && selectionRingRef.current.visible) {
        const ringScale = 1.0 + Math.sin(frame * 0.08) * 0.08;
        selectionRingRef.current.scale.set(ringScale, ringScale, ringScale);
      }

      // LOD State updates
      if (zoom < 1.0 && zoomLevelState !== 'detail') {
        setZoomLevelState('detail');
      } else if (zoom >= 1.0 && zoomLevelState !== 'overview') {
        setZoomLevelState('overview');
      }

      renderer.render(scene, camera);

      // ── Project user location to screen coords ──
      if (userGeoPos && mountRef.current) {
        const boardPos = latLngToBoardPos(userGeoPos.lat, userGeoPos.lng, 0.04);
        const projected = boardPos.clone().project(camera);
        const rect = mountRef.current.getBoundingClientRect();
        const sx = ((projected.x + 1) / 2) * rect.width;
        const sy = ((-projected.y + 1) / 2) * rect.height;
        setUserMarkerScreen({ x: sx, y: sy });
      } else {
        setUserMarkerScreen(null);
      }
    }

    animate();
    setLoaded(true);

    function onResize() {
      const rw = mount.clientWidth;
      const rh = mount.clientHeight;
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh);
    }
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      mount.removeEventListener('pointerdown', onPointerDown);
      mount.removeEventListener('pointermove', onPointerMove);
      mount.removeEventListener('pointerup', onPointerUp);
      mount.removeEventListener('pointercancel', onPointerCancel);
      mount.removeEventListener('click', onMountClick);
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── Sync Selection Halo Ring ──
  useEffect(() => {
    if (!selectionRingRef.current) return;
    if (selectedCourt) {
      const pos = latLngToBoardPos(
        selectedCourt.renderLat || selectedCourt.coords.lat,
        selectedCourt.renderLng || selectedCourt.coords.lng,
        0.005
      );
      selectionRingRef.current.position.set(pos.x, 0.005, pos.z);
      selectionRingRef.current.visible = true;
    } else {
      selectionRingRef.current.visible = false;
    }
  }, [selectedCourt]);

  // ── Sync Sport Filter ──
  useEffect(() => {
    selectedSportRef.current = selectedSport;
    if (!courtGroupListRef.current) return;
    courtGroupListRef.current.forEach((group) => {
      const court = group.userData.court;
      const isVisible = selectedSport === 'all' || (court.sport || []).includes(selectedSport);
      group.visible = isVisible;
    });
  }, [selectedSport]);

  // ── Auto-pan to user on first GPS fix ──
  useEffect(() => {
    if (!userGeoPos || userLocPinnedRef.current) return;
    userLocPinnedRef.current = true;
    const boardPos = latLngToBoardPos(userGeoPos.lat, userGeoPos.lng);
    desiredTargetPosRef.current = { x: boardPos.x, z: boardPos.z };
    targetZoomRef.current = 0.72;
    velocityRef.current = { x: 0, z: 0 };
  }, [userGeoPos]);

  // ── Zoom In / Out Controls ──
  const handleZoomIn = () => {
    targetZoomRef.current = Math.max(0.38, targetZoomRef.current - 0.22);
  };

  const handleZoomOut = () => {
    targetZoomRef.current = Math.min(2.20, targetZoomRef.current + 0.22);
  };

  const handleResetView = () => {
    desiredTargetPosRef.current = { x: 0, z: 0 };
    targetZoomRef.current = viewModeRef.current === '2d' ? 1.55 : 1.40;
    velocityRef.current = { x: 0, z: 0 };
    setActiveDistrict('Austin Metro');
    setSelectedCourt(null);
    setSelectedLandmark(null);
  };

  const jumpToNeighborhood = (target) => {
    setActiveDistrict(target.label);
    const pos = latLngToBoardPos(target.lat, target.lng);
    desiredTargetPosRef.current = { x: pos.x, z: pos.z };
    targetZoomRef.current = target.zoom || 0.80;
    velocityRef.current = { x: 0, z: 0 };
    setSelectedCourt(null);
    setSelectedLandmark(null);
  };

  const handleCourtNavigate = useCallback(() => {
    if (selectedCourt && onCourtSelect) {
      onCourtSelect(selectedCourt);
    }
  }, [selectedCourt, onCourtSelect]);

  return (
    <div className="world-globe-root">
      {/* 2.5D Isometric / 2D Flat Canvas */}
      <div
        ref={mountRef}
        className="world-globe-canvas"
      />

      {/* Loading overlay */}
      {!loaded && (
        <div className="world-globe-loading">
          <div className="wgl-spinner" />
          <span>Generating Austin Map...</span>
        </div>
      )}

      {/* Top Neighborhood Quick-Jump Bar */}
      <div className="austin-neighborhood-bar">
        <div className="anb-scroll">
          {NEIGHBORHOOD_TARGETS.map((target) => (
            <button
              key={target.label}
              className={`anb-pill ${activeDistrict === target.label ? 'active' : ''}`}
              onClick={() => jumpToNeighborhood(target)}
            >
              <span>{target.icon}</span>
              <span>{target.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic 2D / 3D Mode Switcher & LOD Pill */}
      <div className="austin-view-mode-pill">
        <button
          className={`avm-btn ${viewMode === '3d' ? 'active' : ''}`}
          onClick={() => setViewMode('3d')}
          title="Switch to 3D Isometric View"
          id="avm-btn-3d"
        >
          🏙️ 3D View
        </button>
        <button
          className={`avm-btn ${viewMode === '2d' ? 'active' : ''}`}
          onClick={() => setViewMode('2d')}
          title="Switch to Flat 2D Map (Google Maps mode)"
          id="avm-btn-2d"
        >
          🗺️ 2D Map
        </button>
      </div>

      {/* On-Screen Precision Floating Controls (2D/3D + Compass + Zoom In/Out + Locate Me + Reset Metro) */}
      <div className="austin-zoom-controls">
        {/* 2D / 3D Mode Toggle Button */}
        <button
          className={`azc-btn azc-btn--mode ${viewMode === '2d' ? 'active-2d' : ''}`}
          onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}
          title={viewMode === '2d' ? 'Switch to 3D Isometric View' : 'Switch to Flat 2D Map (Google Maps)'}
          aria-label="Toggle 2D / 3D mode"
          id="azc-mode-toggle"
        >
          {viewMode === '2d' ? '3D' : '2D'}
        </button>

        {/* Compass / Reset North button */}
        <button
          className="azc-btn azc-btn--compass"
          onClick={() => {
            desiredTargetPosRef.current = { x: 0, z: 0 };
            targetZoomRef.current = viewModeRef.current === '2d' ? 1.55 : 1.40;
            velocityRef.current = { x: 0, z: 0 };
          }}
          title="Reset North & Metro Center"
          aria-label="Reset North"
          id="azc-compass"
        >
          🧭
        </button>

        <button className="azc-btn" onClick={handleZoomIn} title="Zoom In" aria-label="Zoom In">
          ➕
        </button>
        <button className="azc-btn" onClick={handleZoomOut} title="Zoom Out" aria-label="Zoom Out">
          ➖
        </button>

        {/* Locate Me button */}
        <button
          className={`azc-btn azc-btn--locate ${locationLoading ? 'loading' : ''} ${userGeoPos ? 'located' : ''}`}
          onClick={() => {
            if (userGeoPos) {
              const boardPos = latLngToBoardPos(userGeoPos.lat, userGeoPos.lng);
              desiredTargetPosRef.current = { x: boardPos.x, z: boardPos.z };
              targetZoomRef.current = 0.72;
              velocityRef.current = { x: 0, z: 0 };
            } else {
              requestLocation();
            }
          }}
          title={userGeoPos ? 'Pan to my location' : 'Find my location'}
          aria-label="Locate me"
        >
          {locationLoading ? '⏳' : '📍'}
        </button>

        {/* Reset to Metro View */}
        <button
          className="azc-btn azc-btn--reset"
          onClick={handleResetView}
          title="Reset to Austin Metro View"
          aria-label="Reset View"
        >
          🎯
        </button>
      </div>


      {/* Sport Filter Floating Bar */}
      <div className="austin-sport-filter">
        {[
          { key: 'all', label: 'All Courts', emoji: '🌐' },
          { key: 'basketball', label: 'Basketball', emoji: '🏀' },
          { key: 'tennis', label: 'Tennis', emoji: '🎾' },
          { key: 'pickleball', label: 'Pickleball', emoji: '🏓' },
          { key: 'volleyball', label: 'Volleyball', emoji: '🏐' },
          { key: 'soccer', label: 'Soccer', emoji: '⚽' },
        ].map((s) => (
          <button
            key={s.key}
            className={`asf-pill ${selectedSport === s.key ? 'active' : ''}`}
            onClick={() => setSelectedSport(s.key)}
          >
            <span>{s.emoji}</span>
            <span className="asf-text">{s.label}</span>
          </button>
        ))}
      </div>

      {/* User location avatar marker */}
      {userMarkerScreen && (
        <div
          className="user-location-marker"
          style={{ left: userMarkerScreen.x, top: userMarkerScreen.y }}
          title={`You are here${userProfile?.displayName ? ` · ${userProfile.displayName}` : ''}`}
        >
          <div className="ulm-pulse-ring" />
          <div className="ulm-pulse-ring ulm-pulse-ring--delay" />
          <div className="ulm-avatar-circle">
            {userProfile?.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="You" className="ulm-avatar-img" />
            ) : (
              <span className="ulm-avatar-initials">
                {userProfile?.displayName
                  ? userProfile.displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                  : '👤'}
              </span>
            )}
          </div>
          <div className="ulm-label">You</div>
        </div>
      )}

      {/* Location error toast */}
      {locationError && (
        <div className="ulm-error-toast">
          📍 {locationError}
        </div>
      )}

      {/* Navigation Hint */}
      {!selectedCourt && !selectedLandmark && (
        <div className="world-globe-hint">
          <span>👆 Swipe to explore ATX · Pinch to zoom · Tap any court to play</span>
        </div>
      )}

      {/* Selected Landmark Card */}
      {selectedLandmark && !selectedCourt && (
        <div className="austin-court-card">
          <button
            className="acc-close"
            onClick={() => setSelectedLandmark(null)}
            aria-label="Close landmark card"
          >
            ✕
          </button>
          <div className="acc-header">
            <span className="acc-emoji">{selectedLandmark.emoji || '🏛️'}</span>
            <div className="acc-title-group">
              <h3 className="acc-name">{selectedLandmark.name}</h3>
              <p className="acc-district">
                {selectedLandmark.district} · {selectedLandmark.tier === 'large' ? '🌟 Iconic 3D Landmark' : '✨ Austin Landmark'}
              </p>
            </div>
          </div>
          <p className="acc-desc">
            {selectedLandmark.description ||
              `Iconic 3D Austin landmark in the heart of ${selectedLandmark.district}. Explore nearby sports courts and games!`}
          </p>
          <div className="acc-actions" style={{ marginTop: '0.75rem' }}>
            <button
              className="acc-btn acc-btn--secondary"
              onClick={() => {
                const pos = latLngToBoardPos(selectedLandmark.lat, selectedLandmark.lng);
                desiredTargetPosRef.current = { x: pos.x, z: pos.z };
                targetZoomRef.current = 0.60;
                velocityRef.current = { x: 0, z: 0 };
              }}
            >
              🔍 Focus Camera
            </button>
          </div>
        </div>
      )}

      {/* Selected Court Bottom Card */}
      {selectedCourt && (
        <div className="austin-court-card">
          <button
            className="acc-close"
            onClick={() => setSelectedCourt(null)}
            aria-label="Close court card"
          >
            ✕
          </button>
          <div className="acc-header">
            <span className="acc-emoji">
              {SPORT_META[(selectedCourt.sport && selectedCourt.sport[0]) || 'basketball']?.emoji || '🏀'}
            </span>
            <div className="acc-title-group">
              <h3 className="acc-name">{selectedCourt.name}</h3>
              <p className="acc-district">
                {DISTRICT_META[selectedCourt.district]?.label || selectedCourt.district}
                {selectedCourt.courtCount ? ` · ${selectedCourt.courtCount} Courts` : ''}
              </p>
            </div>
          </div>

          <p className="acc-address">📍 {selectedCourt.address}</p>
          <p className="acc-desc">{selectedCourt.description}</p>

          <div className="acc-capacity-container">
            {(() => {
              const cap = getSimulatedCapacity(selectedCourt.id);
              return (
                <div className="acc-capacity">
                  <div className="acc-capacity-header">
                    <span className="acc-capacity-title">👥 Fullness (Simulated)</span>
                    <span className={`acc-capacity-status ${cap.colorClass}`}>
                      {cap.label} ({cap.percentage}%)
                    </span>
                  </div>
                  <div className="acc-capacity-bar-bg">
                    <div 
                      className={`acc-capacity-bar-fill ${cap.colorClass}`} 
                      style={{ width: `${cap.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="acc-tags">
            {(selectedCourt.sport || []).map((s) => (
              <span key={s} className="acc-tag">
                {SPORT_META[s]?.emoji} {SPORT_META[s]?.label || s}
              </span>
            ))}
            {selectedCourt.lights && <span className="acc-tag acc-tag--light">💡 Lighted</span>}
            {activeGames[selectedCourt.id] > 0 && (
              <span className="acc-tag acc-tag--live">
                🔥 {activeGames[selectedCourt.id]} Game Live
              </span>
            )}
          </div>

          <div className="acc-quick-games">
            {activeGamesList[selectedCourt.id] && activeGamesList[selectedCourt.id].length > 0 ? (
              activeGamesList[selectedCourt.id].map((game) => {
                const scheduledDate = game.scheduledTime?.toDate?.();
                const timeStr = scheduledDate ? scheduledDate.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'Time TBD';
                const spotsLeft = (game.maxPlayers || 10) - (game.currentPlayers?.length || 0);
                
                return (
                  <button key={game.id} className="acc-quick-game-item" onClick={() => onJoinGame && onJoinGame(game)}>
                    <span className="aqg-time">{timeStr}</span>
                    <span className="aqg-spots">{spotsLeft} spots left</span>
                    <span className="aqg-join">Join →</span>
                  </button>
                );
              })
            ) : (
              <p className="acc-no-games">No active games right now. Be the first to start one!</p>
            )}
          </div>

          <div className="acc-actions">
            <button
              className="acc-btn acc-btn--call-next"
              onClick={() => onCallNext && onCallNext(selectedCourt.id)}
              id={`acc-call-next-${selectedCourt.id}`}
            >
              CALL NEXT (Start Match)
            </button>
            <div className="acc-actions-row">
              <button
                className="acc-btn acc-btn--secondary"
                onClick={handleCourtNavigate}
                id={`acc-view-court-${selectedCourt.id}`}
              >
                Court Details →
              </button>
              <button
                className="acc-btn acc-btn--secondary"
                onClick={() =>
                  window.open(
                    `https://maps.google.com/?q=${encodeURIComponent(
                      selectedCourt.name + ', ' + selectedCourt.address + ', Austin TX'
                    )}`,
                    '_blank'
                  )
                }
              >
                🗺️ Maps
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
