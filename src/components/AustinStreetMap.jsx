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
  esri_topo: {
    name: '🗺️ Minimal Clean World',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Topo Map',
  }
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
  const [selectedTileLayer, setSelectedTileLayer] = useState('esri_topo');
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

      // Initialize empty layer group for courts
      layerGroupRef.current = L.layerGroup().addTo(map);

      // Fetch and Overlay Austin Council Districts as colored cartoon zones
      const districtLayers = [];
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
            // Add a permanent cartoon label to the district center (retained across all zoom levels)
            layer.bindTooltip(
              `<div class="asm-district-label-text" style="font-weight:900;font-size:16px;color:${feature.properties.color};text-shadow:2px 2px 0 #fff,-2px -2px 0 #fff,2px -2px 0 #fff,-2px 2px 0 #fff,0 2px 8px rgba(255,255,255,0.95);font-family:'Fredoka',sans-serif;white-space:nowrap;">${feature.properties.name}</div>`,
              { permanent: true, direction: 'center', className: 'district-label-tooltip' }
            );

            districtLayers.push({
              feature,
              layer,
              naturalCenter: layer.getBounds().getCenter(),
            });
            
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

      const updateDistrictLabelPositions = () => {
        if (!mapInstanceRef.current) return;
        const currentMap = mapInstanceRef.current;
        const rawBounds = currentMap.getBounds();
        const latSpan = rawBounds.getNorth() - rawBounds.getSouth();
        const lngSpan = rawBounds.getEast() - rawBounds.getWest();

        // Inset viewport bounds so labels stay clear of top search bar and bottom nav bars when zoomed in
        const vSouth = rawBounds.getSouth() + latSpan * 0.18;
        const vNorth = rawBounds.getNorth() - latSpan * 0.12;
        const vWest = rawBounds.getWest() + lngSpan * 0.10;
        const vEast = rawBounds.getEast() - lngSpan * 0.10;

        districtLayers.forEach(({ feature, layer, naturalCenter }) => {
          const tooltip = layer.getTooltip();
          if (!tooltip) return;
          const polyBounds = layer.getBounds().pad(-0.08);
          if (!rawBounds.intersects(polyBounds)) {
            tooltip.setLatLng(naturalCenter);
            return;
          }
          const iSouth = Math.max(polyBounds.getSouth(), vSouth);
          const iNorth = Math.min(polyBounds.getNorth(), vNorth);
          const iWest = Math.max(polyBounds.getWest(), vWest);
          const iEast = Math.min(polyBounds.getEast(), vEast);

          if (iSouth <= iNorth && iWest <= iEast) {
            let lat = Math.min(Math.max(naturalCenter.lat, iSouth), iNorth);
            let lng = Math.min(Math.max(naturalCenter.lng, iWest), iEast);
            // Keep L-shaped West Austin / Zilker label outside the Downtown cutout
            if (feature.properties.name === 'West Austin / Zilker' && lat < 30.285 && lng > -97.758) {
              lng = Math.min(-97.762, iEast);
            }
            tooltip.setLatLng([lat, lng]);
          } else {
            tooltip.setLatLng(naturalCenter);
          }
        });
      };

      // Track zoom & pan changes and keep region names visible inside zoomed viewport
      map.on('zoomend moveend', () => {
        setCurrentZoom(map.getZoom());
        updateDistrictLabelPositions();
      });
      updateDistrictLabelPositions();
      updateVisibleCourts(activeDistrictZone);
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

  const matchesDistrictZone = (court, zoneName) => {
    if (!zoneName) return true;
    if (court.id === 'caswell-tennis-center' && (zoneName === 'West Austin / Zilker' || zoneName === 'Downtown')) {
      return true;
    }
    return getCartoonZone(court.district) === zoneName;
  };

  const updateVisibleCourts = (zoneName) => {
    if (!mapInstanceRef.current || !window.L || !layerGroupRef.current) return;
    const L = window.L;

    // Clear existing markers robustly
    layerGroupRef.current.clearLayers();

    AUSTIN_COURTS_DATA.forEach((court) => {
      if (matchesDistrictZone(court, zoneName)) {
        const sportColor = SPORT_META[court.sport[0]]?.color || '#3b82f6';
        const sportEmoji = SPORT_META[court.sport[0]]?.emoji || '🏟️';
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
        marker.bindTooltip(`${sportEmoji} ${court.name}`, {
          direction: 'top',
          offset: [0, -8],
        });

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

    const apiKey = getStoredOpenAIKey();

    if (apiKey) {
      try {
        const result = await searchMapWithOpenAI({
          query: searchQuery,
          locations: AUSTIN_COURTS_DATA,
          model: 'gpt-4o-mini',
        });

        if (result.matchedIds && result.matchedIds.length > 0) {
          const firstId = result.matchedIds[0];
          const court = AUSTIN_COURTS_DATA.find(c => c.id === firstId);
          if (court) {
             const zone = getCartoonZone(court.district);
             setActiveDistrictZone(zone);
             if (mapInstanceRef.current) mapInstanceRef.current.setView([court.coords.lat, court.coords.lng], 14, { animate: true });
          }
        } else {
          fallbackLocalSearch();
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
    const q = searchQuery.toLowerCase().trim();
    const court = AUSTIN_COURTS_DATA.find((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.shortName && c.shortName.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      c.district.toLowerCase().includes(q) ||
      (c.sport || []).some((s) => s.toLowerCase().includes(q))
    );
    if (court) {
      const zone = getCartoonZone(court.district);
      setActiveDistrictZone(zone);
      if (mapInstanceRef.current) mapInstanceRef.current.setView([court.coords.lat, court.coords.lng], 14, { animate: true });
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


      </div>

      {/* Map Leaflet Container */}
      <div className="asm-map-container" ref={mapContainerRef} />





      {/* Quick Drawer Tabs Bar on Map */}
      <div className="asm-map-floating-tabs">
        <button
          className={`asm-map-tab-btn ${activeDistrictZone === 'North Austin / Mueller' ? 'active' : ''}`}
          onClick={() => setActiveDistrictZone('North Austin / Mueller')}
          id="asm-tab-mueller"
        >
          🌳 Mueller Courts
        </button>
        <button
          className={`asm-map-tab-btn ${activeDistrictZone === 'Downtown' ? 'active' : ''}`}
          onClick={() => setActiveDistrictZone('Downtown')}
          id="asm-tab-downtown"
        >
          🏙️ Downtown
        </button>
        <button
          className={`asm-map-tab-btn ${activeDistrictZone === 'West Austin / Zilker' ? 'active' : ''}`}
          onClick={() => setActiveDistrictZone('West Austin / Zilker')}
          id="asm-tab-zilker"
        >
          🏊 Zilker
        </button>
        <button
          className={`asm-map-tab-btn ${activeDistrictZone === 'East Austin' ? 'active' : ''}`}
          onClick={() => setActiveDistrictZone('East Austin')}
          id="asm-tab-east"
        >
          🎨 East ATX
        </button>
      </div>

      {/* Slide-out District Sidebar */}
      {activeDistrictZone && (
        <>
          <style>{`
            .view-mode-floating-bar { display: none !important; }
            .asm-item-icon .cartoon-marker-img { width: 64px !important; height: 64px !important; border-radius: 50%; }
            .asm-sidebar-header { padding: 80px 20px 15px 20px !important; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
            .asm-back-to-map-btn { background: #0f172a !important; color: white !important; padding: 12px 20px !important; border-radius: 12px !important; border: none; cursor: pointer; font-size: 1.1rem !important; font-weight: 800 !important; width: 100%; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: transform 0.2s, background 0.2s; }
            .asm-back-to-map-btn:hover { transform: translateY(-2px); background: #1e293b !important; }
            .asm-drawer-district-tabs { display: flex; gap: 6px; overflow-x: auto; width: 100%; padding-bottom: 6px; scrollbar-width: none; }
            .asm-drawer-district-tabs::-webkit-scrollbar { display: none; }
            .asm-drawer-tab { padding: 6px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 700; border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
            .asm-drawer-tab.active { background: #06b6d4; color: white; border-color: #06b6d4; box-shadow: 0 2px 6px rgba(6,182,212,0.3); }
            .asm-badge-new-venue { background: linear-gradient(135deg, #06b6d4, #10b981); color: white; font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-left: 6px; vertical-align: middle; }
            .asm-highlight-card { border-left: 4px solid #06b6d4 !important; background: #f0fdfa !important; }
          `}</style>
          <div className="asm-district-sidebar">
            <div className="asm-sidebar-header">
              <button className="asm-back-to-map-btn" onClick={() => setActiveDistrictZone(null)}>
                ← Back to Map
              </button>
              <h2>{activeDistrictZone} Courts</h2>
              
              {/* Drawer District Tabs */}
              <div className="asm-drawer-district-tabs">
                {[
                  { id: 'North Austin / Mueller', label: '🌳 Mueller / North' },
                  { id: 'Downtown', label: '🏙️ Downtown' },
                  { id: 'West Austin / Zilker', label: '🏊 West / Zilker' },
                  { id: 'East Austin', label: '🎨 East Austin' },
                  { id: 'South Austin', label: '🌲 South Austin' },
                ].map((dt) => (
                  <button
                    key={dt.id}
                    className={`asm-drawer-tab ${activeDistrictZone === dt.id ? 'active' : ''}`}
                    onClick={() => setActiveDistrictZone(dt.id)}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="asm-sidebar-list">
              {AUSTIN_COURTS_DATA.filter(c => matchesDistrictZone(c, activeDistrictZone)).map(court => {
                const isMuellerEastLawn = court.id === 'mueller-lake-park-east-lawn';
                return (
                  <div
                    key={court.id}
                    className={`asm-sidebar-item ${isMuellerEastLawn ? 'asm-highlight-card' : ''}`}
                    onClick={() => { if (onPlaceSelect) onPlaceSelect({ id: court.id, category: 'court' }); }}
                  >
                    <span className="asm-item-icon" dangerouslySetInnerHTML={{ __html: getCartoonIcon(court.id) }}></span>
                    <div className="asm-item-info">
                      <h4>
                        {court.name}
                        {isMuellerEastLawn && <span className="asm-badge-new-venue">✨ NEW VENUE</span>}
                      </h4>
                      <span>{court.sport.map(s => SPORT_META[s]?.label || s).join(' · ')}</span>
                      {isMuellerEastLawn && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>
                          Volleyball, footvolley & spikeball weekly gathering spot
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Court Missing Button */}
              <div style={{ padding: '1rem 0', marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                <button
                  id="missing-court-btn"
                  onClick={() => {
                    const subject = encodeURIComponent(`Missing Court Recommendation - ${activeDistrictZone}`);
                    const body = encodeURIComponent("Hi Let's Play ATX team,\n\nI'd like to recommend a court that's missing:\n\nCourt name:\nAddress:\nSport(s):\n");
                    window.location.href = `mailto:jacobflutterdev@gmail.com?subject=${subject}&body=${body}`;
                  }}
                  style={{
                    width: '100%', padding: '1.1rem', background: 'rgba(16,185,129,0.12)',
                    border: '2px dashed rgba(16,185,129,0.6)', borderRadius: '12px',
                    color: '#047857', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  <span>📍</span> Missing a court? Let us know!
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
