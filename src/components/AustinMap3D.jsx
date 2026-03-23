import { useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import './AustinMap3D.css';

// ─── DISTRICT DATA ───
// Position each district tile on the isometric grid (x, z) — y is height
const DISTRICTS = [
  {
    id: 'mueller',
    name: 'Mueller',
    position: [1.5, 0, -1.5],
    color: '#22d366',
    hoverColor: '#34eeff',
    height: 0.35,
    size: [2.2, 0.35, 2.0],
  },
  {
    id: 'hyde-park',
    name: 'Hyde Park',
    position: [-1.5, 0, -1.2],
    color: '#f59e0b',
    hoverColor: '#fcd34d',
    height: 0.28,
    size: [1.8, 0.28, 1.6],
  },
  {
    id: 'downtown',
    name: 'Downtown',
    position: [0, 0, 0.8],
    color: '#6366f1',
    hoverColor: '#a78bfa',
    height: 0.55,
    size: [2.6, 0.55, 2.2],
  },
  {
    id: 'south-congress',
    name: 'SoCo',
    position: [-0.5, 0, 2.8],
    color: '#ec4899',
    hoverColor: '#f9a8d4',
    height: 0.3,
    size: [2.4, 0.3, 1.8],
  },
];

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
  const targetPos = useRef(new THREE.Vector3(8, 9, 8));
  const targetZoom = useRef(80);

  useFrame((_, delta) => {
    // Zoom in as scroll increases (overview → close)
    const zoom = 80 + scrollProgress * 60; // 80 → 140
    targetZoom.current += (zoom - targetZoom.current) * delta * 4;
    camera.zoom = targetZoom.current;
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
        gl={{ antialias: true, alpha: true }}
      >
        {/* Isometric-style orthographic camera at 45° */}
        <OrthographicCamera
          makeDefault
          position={[8, 9, 8]}
          zoom={80}
          near={0.1}
          far={100}
        />

        <CameraController scrollProgress={scrollProgress} />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 12, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-4, 6, -4]} intensity={0.4} color="#6366f1" />

        {/* Scene */}
        <Ground />
        <GridLines />

        {DISTRICTS.map(district => (
          <DistrictTile
            key={district.id}
            district={district}
            onDistrictClick={onDistrictClick}
            activeGames={activeGames}
          />
        ))}
      </Canvas>
    </div>
  );
}
