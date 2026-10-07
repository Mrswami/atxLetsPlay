import { useEffect, useRef, useState } from 'react';
import { searchMapWithOpenAI, askAustinAiAssistant, getStoredOpenAIKey } from '../services/openaiService';
import { AUSTIN_DISTRICTS_GEOJSON } from './austinDistricts';
import './AustinStreetMap.css';

import { AUSTIN_COURTS_DATA, SPORT_META } from '../data/courtsMeta';

const getCartoonZone = (district) => {
  if (['downtown'].includes(district)) return 'Downtown';
  if (['south', 'south-congress'].includes(district)) return 'South Austin';
  if (['east', 'cherrywood', 'cesar-chavez'].includes(district)) return 'East Austin';
  if (['north', 'mueller', 'windsor', 'hyde-park'].includes(district)) return 'North Austin / Mueller';
  if (['wampus', 'tarry', 'zilker', 'river', 'norwood'].includes(district)) return 'West Austin / Zilker';
  return 'Downtown';
};

const getCartoonIcon = (courtId) => {
  const sum = courtId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const index = sum % 6; // We have landmark_court_0 to 5
  return `<img src="/assets/raw/landmark_court_${index}.png" class="cartoon-marker-img" />`;
};

const TILE_LAYERS = {
  esri_gray: {
    name: '🗺️ Minimal Clean World',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  },
  google_satellite: {
    name: '🛰️ Real Satellite Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
  },
};

const DISTRICT_COLORS = [
  '#f43f5e', // Rose
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
];

export default function AustinStreetMap({ onPlaceSelect, activeGames = [] }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);

  const [activeDistrictZone, setActiveDistrictZone] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTileLayer, setSelectedTileLayer] = useState('esri_gray');
  const [currentZoom, setCurrentZoom] = useState(12);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  // Load Leaflet dynamically if not already present on window
  useEffect(() => {
    let active = true;

    async function initLeafletMap() {
      if (!window.L) {
        // Inject Leaflet CSS
        if (!document.getElementById('leaflet-css')) {
          const cssLink = document.createElement('link');
          cssLink.id = 'leaflet-css';
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(cssLink);
        }

        // Inject Leaflet JS script
        await new Promise((resolve) => {
          if (document.getElementById('leaflet-js')) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.id = 'leaflet-js';
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }

      if (!active || !mapContainerRef.current) return;

      const L = window.L;
      if (!L) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize map centered slightly tighter on Austin
      const map = L.map(mapContainerRef.current, {
        center: [30.2747, -97.7404],
        zoom: 12,
        zoomControl: false,
      });
      mapInstanceRef.current = map;

      // Add Tile Layer
      const tileConfig = TILE_LAYERS[selectedTileLayer];
      const tileLayer = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: 18,
        subdomains: 'abcd',
      }).addTo(map);

      // Track zoom changes
      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });

      // Initialize empty layer group for courts
      layerGroupRef.current = L.layerGroup().addTo(map);

      // Fetch and Overlay Austin Council Districts as colored cartoon zones
      if (mapInstanceRef.current) {
        L.geoJSON(AUSTIN_DISTRICTS_GEOJSON, {
          style: (feature) => {
            return {
              color: '#ffffff', // Clean white borders
              weight: 3,
              fillColor: feature.properties.color,
              fillOpacity: 0.25, // Stronger tint for cartoon look
              dashArray: '8',
            };
          },
          onEachFeature: (feature, layer) => {
            // Add a permanent cartoon label to the district center
            layer.bindTooltip(
              `<div style="font-weight:900;font-size:16px;color:${feature.properties.color};text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;font-family:'Fredoka',sans-serif;">${feature.properties.name}</div>`,
              { permanent: true, direction: 'center', className: 'district-label-tooltip' }
            );
            
            // On Click: Zoom map to fit this specific area and its courts
            layer.on('click', (e) => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.flyToBounds(e.target.getBounds(), { padding: [50, 50], duration: 0.8 });
                setActiveDistrictZone(feature.properties.name);
              }
            });
          }
        }).addTo(mapInstanceRef.current);
      }
    }

    initLeafletMap();

    return () => {
      active = false;
    };
  }, []);

  // Update tile layer when selection changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;
    const L = window.L;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const tileConfig = TILE_LAYERS[selectedTileLayer];
    L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(map);
  }, [selectedTileLayer]);

  useEffect(() => {
    updateVisibleCourts(activeDistrictZone);
  }, [activeDistrictZone, activeGames]);

  const updateVisibleCourts = (zoneName) => {
    if (!mapInstanceRef.current || !window.L || !layerGroupRef.current) return;
    const L = window.L;

    // Clear existing markers robustly
    layerGroupRef.current.clearLayers();

    if (!zoneName) return;

    AUSTIN_COURTS_DATA.forEach((court) => {
      if (getCartoonZone(court.district) === zoneName) {
        const sportColor = SPORT_META[court.sport[0]]?.color || '#3b82f6';
        const activeGame = activeGames?.find(g => g.courtId === court.id);
        
        let customHtml = '';
        if (activeGame && activeGame.hostAvatarUrl) {
           customHtml = `
             <div class="asm-pulsing-avatar-marker" style="--sport-color: ${sportColor}">
               <div class="asm-pulse-ring"></div>
               <img src="${activeGame.hostAvatarUrl}" class="asm-host-avatar" alt="Host" />
             </div>
           `;
        } else {
           customHtml = `
             <div class="asm-dot-marker" style="background-color: ${sportColor}; width: 18px; height: 18px; border-radius: 50%; box-shadow: 0 0 0 2px rgba(255,255,255,0.2);"></div>
           `;
        }

        const customIcon = L.divIcon({
          className: 'asm-dot-marker-container',
          html: customHtml,
          iconSize: activeGame ? [40, 40] : [18, 18],
          iconAnchor: activeGame ? [20, 20] : [9, 9],
        });

        const marker = L.marker([court.coords.lat, court.coords.lng], { icon: customIcon });

        marker.on('click', () => {
          if (onPlaceSelect) onPlaceSelect({ id: court.id, category: 'court' });
        });

        marker.addTo(layerGroupRef.current);
      }
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setAiAnswer('');

    const apiKey = getStoredOpenAIKey();

    if (apiKey) {
      try {
        const result = await searchMapWithOpenAI({
          query: searchQuery,
          locations: MAP_LOCATIONS,
          model: 'gpt-4o-mini',
        });

        if (result.matchedIds && result.matchedIds.length > 0) {
          const firstId = result.matchedIds[0];
          const court = AUSTIN_COURTS_DATA.find(c => c.id === firstId);
          if (court) {
             const zone = getCartoonZone(court.district);
             setActiveDistrictZone(zone);
             if (mapInstanceRef.current) mapInstanceRef.current.setView([court.coords.lat, court.coords.lng], 13, { animate: true });
          }
        }
      } catch (err) {
        console.warn('OpenAI search fallback:', err);
        fallbackLocalSearch();
      }
    } else {
      fallbackLocalSearch();
    }

    setIsSearching(false);
  };

  const fallbackLocalSearch = () => {
    const q = searchQuery.toLowerCase();
    const court = AUSTIN_COURTS_DATA.find((c) =>
      c.name.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q)
    );
    if (court) {
      const zone = getCartoonZone(court.district);
      setActiveDistrictZone(zone);
      if (mapInstanceRef.current) mapInstanceRef.current.setView([court.coords.lat, court.coords.lng], 13, { animate: true });
    }
  };

  const handleCategoryFilter = (cat) => {
    setActiveCategory(cat);
    if (cat === 'all') {
      renderMarkers(MAP_LOCATIONS);
    } else {
      renderMarkers(MAP_LOCATIONS.filter((l) => l.category === cat));
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([30.2747, -97.7404], 11, { animate: true });
    }
  };

  return (
    <div className={`austin-street-map-view ${currentZoom >= 12.5 ? 'zoomed-in' : ''}`}>
      {/* 🔍 Search location bar matching top-left UI */}
      <div className="asm-top-bar">
        <form className="asm-search-box" onSubmit={handleSearch}>
          <span className="asm-search-icon">🔍</span>
          <input
            type="text"
            className="asm-search-input"
            placeholder="Search location (e.g. 'Broken Spoke', '99 Ranch', 'courts near Zilker')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && <span className="asm-spinner" />}
        </form>

        {/* Category Pills */}
        <div className="asm-category-pills">
          <button
            className={`asm-pill ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryFilter('all')}
          >
            All Places
          </button>
          <button
            className={`asm-pill ${activeCategory === 'court' ? 'active' : ''}`}
            onClick={() => handleCategoryFilter('court')}
          >
            🏀 Courts
          </button>
          <button
            className={`asm-pill ${activeCategory === 'market' ? 'active' : ''}`}
            onClick={() => handleCategoryFilter('market')}
          >
            🛒 Markets
          </button>
          <button
            className={`asm-pill ${activeCategory === 'music' ? 'active' : ''}`}
            onClick={() => handleCategoryFilter('music')}
          >
            🎵 Venues
          </button>
          <button
            className={`asm-pill ${activeCategory === 'landmark' ? 'active' : ''}`}
            onClick={() => handleCategoryFilter('landmark')}
          >
            🏛️ Landmarks
          </button>
        </div>
      </div>

      {/* Map Leaflet Container */}
      <div className="asm-map-container" ref={mapContainerRef} />

      {/* Bottom Left Navigation Controls (+ / - / recenter) */}
      <div className="asm-controls-panel">
        <button className="asm-ctrl-btn" onClick={handleRecenter} title="Recenter Capitol">
          🎯
        </button>
        <button className="asm-ctrl-btn" onClick={handleZoomIn} title="Zoom In">
          +
        </button>
        <div className="asm-zoom-level">{currentZoom}</div>
        <button className="asm-ctrl-btn" onClick={handleZoomOut} title="Zoom Out">
          −
        </button>
      </div>

      {/* Layer Switcher (Top Right) */}
      <div className="asm-layer-switcher">
        <select
          className="asm-layer-select"
          value={selectedTileLayer}
          onChange={(e) => setSelectedTileLayer(e.target.value)}
        >
          {Object.keys(TILE_LAYERS).map((layerKey) => (
            <option key={layerKey} value={layerKey}>
              {TILE_LAYERS[layerKey].name}
            </option>
          ))}
        </select>
      </div>



      {/* Slide-out District Sidebar */}
      {activeDistrictZone && (
        <div className="asm-district-sidebar">
          <div className="asm-sidebar-header">
            <h2>{activeDistrictZone} Courts</h2>
            <button onClick={() => setActiveDistrictZone(null)}>✕</button>
          </div>
          <div className="asm-sidebar-list">
            {AUSTIN_COURTS_DATA.filter(c => getCartoonZone(c.district) === activeDistrictZone).map(court => (
              <div key={court.id} className="asm-sidebar-item" onClick={() => { if (onPlaceSelect) onPlaceSelect({ id: court.id, category: 'court' }); }}>
                <span className="asm-item-icon" dangerouslySetInnerHTML={{ __html: getCartoonIcon(court.id) }}></span>
                <div className="asm-item-info">
                  <h4>{court.name}</h4>
                  <span>{court.sport.map(s => SPORT_META[s]?.label || s).join(' · ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
