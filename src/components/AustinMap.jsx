import { useState } from 'react';
import './AustinMap.css';

const DISTRICTS = [
  {
    id: 'north',
    name: 'North Austin',
    shortName: 'NORTH',
    path: 'M 140,20 L 200,15 L 260,25 L 270,70 L 250,100 L 200,105 L 150,95 L 130,60 Z',
    labelPos: { x: 195, y: 60 },
    color: 'var(--district-north)',
  },
  {
    id: 'hyde-park',
    name: 'Hyde Park',
    shortName: 'HYDE PARK',
    path: 'M 130,60 L 150,95 L 200,105 L 195,140 L 160,150 L 120,130 L 110,90 Z',
    labelPos: { x: 155, y: 110 },
    color: 'var(--district-hydepark)',
  },
  {
    id: 'mueller',
    name: 'Mueller',
    shortName: 'MUELLER',
    path: 'M 200,105 L 250,100 L 270,70 L 300,80 L 310,120 L 280,145 L 240,150 L 195,140 Z',
    labelPos: { x: 250, y: 115 },
    color: 'var(--district-mueller)',
  },
  {
    id: 'east',
    name: 'East Austin',
    shortName: 'EAST',
    path: 'M 240,150 L 280,145 L 310,120 L 330,150 L 320,200 L 280,220 L 250,200 L 235,170 Z',
    labelPos: { x: 280, y: 175 },
    color: 'var(--district-east)',
  },
  {
    id: 'downtown',
    name: 'Downtown',
    shortName: 'DOWNTOWN',
    path: 'M 160,150 L 195,140 L 240,150 L 235,170 L 250,200 L 220,220 L 180,210 L 155,180 Z',
    labelPos: { x: 200, y: 180 },
    color: 'var(--district-downtown)',
  },
  {
    id: 'norwood',
    name: 'Norwood / Zilker',
    shortName: 'ZILKER',
    path: 'M 110,90 L 120,130 L 160,150 L 155,180 L 130,200 L 90,180 L 80,130 Z',
    labelPos: { x: 120, y: 155 },
    color: 'var(--district-norwood)',
  },
  {
    id: 'south-congress',
    name: 'South Congress',
    shortName: 'S. CONGRESS',
    path: 'M 155,180 L 180,210 L 220,220 L 210,260 L 180,280 L 140,270 L 120,230 L 130,200 Z',
    labelPos: { x: 170, y: 245 },
    color: 'var(--district-scongress)',
  },
  {
    id: 'south',
    name: 'South Austin',
    shortName: 'SOUTH',
    path: 'M 120,230 L 140,270 L 180,280 L 210,260 L 230,280 L 210,320 L 170,330 L 130,310 L 100,270 Z',
    labelPos: { x: 165, y: 300 },
    color: 'var(--district-south)',
  },
  {
    id: 'river',
    name: 'Barton Creek',
    shortName: 'RIVER',
    path: 'M 220,220 L 250,200 L 280,220 L 300,250 L 280,280 L 230,280 L 210,260 Z',
    labelPos: { x: 255, y: 250 },
    color: 'var(--district-river)',
  },
];

export default function AustinMap({ onDistrictClick, activeGames = {} }) {
  const [hoveredDistrict, setHoveredDistrict] = useState(null);

  return (
    <div className="austin-map-container">
      <svg
        className="austin-map-svg"
        viewBox="50 -10 310 370"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {DISTRICTS.map((district, i) => (
          <g key={district.id} className="district-group">
            <path
              className={`district-path ${hoveredDistrict === district.id ? 'hovered' : ''}`}
              d={district.path}
              fill={district.color}
              stroke="var(--bg-primary)"
              strokeWidth="2.5"
              style={{ '--district-index': i }}
              onMouseEnter={() => setHoveredDistrict(district.id)}
              onMouseLeave={() => setHoveredDistrict(null)}
              onClick={() => onDistrictClick?.(district)}
            />
            <text
              className="district-label"
              x={district.labelPos.x}
              y={district.labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
            >
              {district.shortName}
            </text>
            {activeGames[district.id] > 0 && (
              <g pointerEvents="none">
                <circle
                  cx={district.labelPos.x + 30}
                  cy={district.labelPos.y - 14}
                  r="11"
                  fill="none"
                  stroke="var(--accent-secondary)"
                  strokeWidth="2"
                  className="game-count-pulse-ring"
                />
                <circle
                  cx={district.labelPos.x + 30}
                  cy={district.labelPos.y - 14}
                  r="11"
                  fill="var(--accent-secondary)"
                  className="game-count-circle"
                />
                <text
                  x={district.labelPos.x + 30}
                  y={district.labelPos.y - 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="game-count-text"
                >
                  {activeGames[district.id]}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
