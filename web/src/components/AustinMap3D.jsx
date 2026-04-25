import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import './AustinMap3D.css';
import CelestialOracleRive from './CelestialOracleRive';

// ─── DISTRICT DATA ───
// Position each district tile on the isometric grid (x, z) — y is height
const DISTRICTS = [
  {
    id: 'mueller',
    name: 'Mueller',
    legendId: 'mueller-maverick',
    loreSnippet: 'Home of the Neighborhood Strategists.',
    position: [1.5, 0, -1.5],
    color: '#22d366',
    hoverColor: '#34eeff',
    height: 0.35,
    size: [2.2, 0.35, 2.0],
  },
  {
    id: 'hyde-park',
    name: 'Hyde Park',
    legendId: 'shipe-historian',
    loreSnippet: 'Technical mastery at Shipe Park.',
    position: [-1.5, 0, -1.2],
    color: '#f59e0b',
    hoverColor: '#fcd34d',
    height: 0.28,
    size: [1.8, 0.28, 1.6],
  },
  {
    id: 'downtown',
    name: 'Downtown',
    legendId: 'nelson-the-red',
    loreSnippet: 'The High-Intensity Urban Kings.',
    position: [0, 0, 0.8],
    color: '#6366f1',
    hoverColor: '#a78bfa',
    height: 0.55,
    size: [2.6, 0.55, 2.2],
  },
  {
    id: 'south-congress',
    name: 'SoCo',
    legendId: 'soco-neon-spiker',
    loreSnippet: 'Vibrant connections at Little Stacy.',
    position: [-0.5, 0, 2.8],
    color: '#ec4899',
    hoverColor: '#f9a8d4',
    height: 0.3,
    size: [2.4, 0.3, 1.8],
  },
];

// ─── CELESTIAL ORACLE DATA ───
const ORACLES = [
  {
    id: 'barbara-jordan',
    name: 'Saint Barbara',
    position: [0.2, 3.2, 0.4], // Over Downtown
    color: '#fbbf24',
    targetDistrict: 'downtown',
    intensity: 1.2,
    size: 0.18,
  },
  {
    id: 'azalea',
    name: 'Azalea',
    position: [-1.2, 2.5, -0.8], // Over Hyde Park area
    color: '#ec4899',
    targetDistrict: 'hyde-park',
    intensity: 0.9,
    size: 0.14,
  },
  {
    id: 'mustangs',
    name: 'Seven Mustangs',
    position: [2.0, 4.0, 2.0], // Starting high
    color: '#92400e',
    isKinetic: true,
    intensity: 1.5,
    size: 0.22,
  },
];

// ─── CELSTIAL ORACLE COMPONENT ───
function CelestialOracle({ oracle, scrollProgress }) {
  const meshRef = useRef();
  
  useFrame(({ clock, mouse }) => {
    if (!meshRef.current) return;
    const time = clock.getElapsedTime();
    
    // Float logic
    meshRef.current.position.y = oracle.position[1] + Math.sin(time * 0.8) * 0.2;
    
    // Kinetic Guide logic (Mustangs follow mouse or scroll)
    if (oracle.isKinetic) {
      const targetX = oracle.position[0] + mouse.x * 2;
      const targetZ = oracle.position[2] + mouse.y * 2;
      meshRef.current.position.x += (targetX - meshRef.current.position.x) * 0.05;
      meshRef.current.position.z += (targetZ - meshRef.current.position.z) * 0.05;
    } else {
      // Others subtle drift
      meshRef.current.position.x = oracle.position[0] + Math.cos(time * 0.5) * 0.1;
    }
  });

  return (
    <group position={oracle.position}>
      <mesh ref={meshRef}>
        <Html center occlude={false} transform distanceFactor={5}>
          <CelestialOracleRive name={oracle.name} />
        </Html>
      </mesh>
      <pointLight color={oracle.color} intensity={oracle.intensity} distance={4} />
    </group>
  );
}

// ─── LIGHT BEAM (STITCH) COMPONENT ───
function LightBeam({ start, end, color }) {
  const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color={color} transparent opacity={0.4} linewidth={2} />
    </line>
  );
}

// ─── HORIZON MURAL COMPONENT ───
function HorizonMural({ scrollProgress }) {
  const texture = useTexture('styleistbackgrounud.jpg');
  const snapThreshold = 0.98;
  const isSnapped = scrollProgress >= snapThreshold;

  return (
    <mesh position={[0, 4, -18]} rotation={[0, 0, 0]}>
      <planeGeometry args={[40, 22]} />
      <meshBasicMaterial 
        map={texture} 
        transparent 
        opacity={isSnapped ? 1 : 0} 
      />
    </mesh>
  );
}

// ─── DISTRICT TILE ───
function DistrictTile({ district, onDistrictClick, activeGames }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const targetY = useRef(0);
  const gameCount = activeGames?.[district.id] || 0;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // Idle hover float + on-hover lift
    const floatY = Math.sin(Date.now() * 0.001 + district.position[0]) * 0.03;
    const hoverLift = hovered ? 0.18 : 0;
    targetY.current += (floatY + hoverLift - targetY.current) * delta * 6;
    meshRef.current.position.y = district.position[1] + targetY.current;

    // Subtle scale pulse on hover
    const targetScale = hovered ? 1.05 : 1.0;
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 8);
  });

  const baseColor = hovered ? district.hoverColor : district.color;

  return (
    <group position={district.position}>
      {/* Main tile */}
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={() => onDistrictClick(district)}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <boxGeometry args={district.size} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.3}
          metalness={0.15}
          emissive={hovered ? baseColor : '#000000'}
          emissiveIntensity={hovered ? 0.15 : 0}
        />
      </mesh>

      {/* Top accent ledge */}
      <mesh position={[0, district.height / 2 + 0.04, 0]}>
        <boxGeometry args={[district.size[0] * 0.85, 0.04, district.size[2] * 0.85]} />
        <meshStandardMaterial color={hovered ? '#ffffff' : baseColor} opacity={0.6} transparent />
      </mesh>

      {/* District name label */}
      <Html
        position={[0, district.height / 2 + 0.35, 0]}
        center
        occlude={false}
      >
        <div className={`district-label ${hovered ? 'active' : ''}`}>
          <span className="district-label-name">{district.name}</span>
          {gameCount > 0 && (
            <span className="district-label-badge">{gameCount} 🔥</span>
          )}
        </div>
      </Html>
    </group>
  );
}

// ─── GROUND PLANE ───
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]} receiveShadow>
      <planeGeometry args={[18, 18]} />
      <meshStandardMaterial color="#0a1220" roughness={0.9} />
    </mesh>
  );
}

// ─── GRID LINES ───
function GridLines() {
  return (
    <gridHelper
      args={[18, 18, '#1a2a3a', '#1a2a3a']}
      position={[0, -0.32, 0]}
    />
  );
}

// ─── CAMERA ZOOM CONTROLLER ───
function CameraController({ scrollProgress }) {
  const { camera } = useThree();
  const snapThreshold = 0.98;

  useFrame(() => {
    const isSnapped = scrollProgress >= snapThreshold;
    
    if (isSnapped) {
      // SUDDEN SNAP: Pivot to Horizon
      const targetPos = new THREE.Vector3(0, 4, 12);
      const targetLook = new THREE.Vector3(0, 4, -18);
      
      camera.position.lerp(targetPos, 0.1);
      camera.lookAt(targetLook);
      
      camera.zoom += (110 - camera.zoom) * 0.1;
    } else {
      // NORMAL: Isometric Zoom
      camera.lookAt(0, 0, 0);
      const targetZoom = 60 + scrollProgress * 60;
      camera.zoom += (targetZoom - camera.zoom) * 0.08;
      
      // Keep isometric position
      const isoPos = new THREE.Vector3(8, 9, 8);
      camera.position.lerp(isoPos, 0.1);
    }
    
    camera.updateProjectionMatrix();
  });

  return null;
}

// ─── MAIN MAP COMPONENT ───
export default function AustinMap3D({ onDistrictClick, activeGames, scrollProgress = 0 }) {
  return (
    <div className="map3d-container">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [8, 9, 8], zoom: 60, near: 0.1, far: 200 }}
        orthographic
      >
        <CameraController scrollProgress={scrollProgress} />

        {/* Lighting */}
        <ambientLight intensity={scrollProgress >= 0.98 ? 0.3 : 0.7} />
        <directionalLight
          position={[5, 12, 5]}
          intensity={scrollProgress >= 0.98 ? 0.2 : 1.4}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[0, 5, -5]} intensity={scrollProgress >= 0.98 ? 3 : 0.5} color="#a78bfa" />

        {/* Scene */}
        <color attach="background" args={[scrollProgress >= 0.98 ? '#0a0510' : '#060c14']} />
        <Ground />
        <GridLines />
        <HorizonMural scrollProgress={scrollProgress} />

        {DISTRICTS.map(district => (
          <DistrictTile
            key={district.id}
            district={district}
            onDistrictClick={onDistrictClick}
            activeGames={activeGames}
          />
        ))}

        {/* Celestial Oracles Layer */}
        {ORACLES.map(oracle => (
          <group key={oracle.id}>
            <CelestialOracle oracle={oracle} scrollProgress={scrollProgress} />
            {oracle.targetDistrict && (
              <LightBeam 
                start={oracle.position} 
                end={DISTRICTS.find(d => d.id === oracle.targetDistrict).position} 
                color={oracle.color} 
              />
            )}
          </group>
        ))}
      </Canvas>
    </div>
  );
}
