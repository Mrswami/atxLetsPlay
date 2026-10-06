import { useEffect, useRef, useState } from 'react';
import { searchMapWithOpenAI, askAustinAiAssistant, getStoredOpenAIKey } from '../services/openaiService';
import { AUSTIN_DISTRICTS_GEOJSON } from './austinDistricts';
import './AustinStreetMap.css';

// Curated Austin Places matching the user's map image
const MAP_LOCATIONS = [
  {
    id: 'texas-capitol',
    name: 'Texas Capitol',
    category: 'landmark',
    icon: '🏛️',
    district: 'Downtown',
    lat: 30.2747,
    lng: -97.7404,
    address: '1100 Congress Ave, Austin, TX 78701',
    description: 'Iconic sunset red granite state capitol building with lush green grounds.',
  },
  {
    id: '99-ranch-market',
    name: '99 Ranch Market',
    category: 'market',
    icon: '🛒',
    district: 'North Austin / Mueller',
    lat: 30.3524,
    lng: -97.7136,
    address: '6929 Airport Blvd, Austin, TX 78752',
    description: 'Premier Asian supermarket and food hall in North Austin.',
  },
  {
    id: 'broken-spoke',
    name: 'Broken Spoke',
    category: 'music',
    icon: '🎵',
    district: 'South Austin',
    lat: 30.2407,
    lng: -97.7854,
    address: '3201 S Lamar Blvd, Austin, TX 78704',
    description: 'Legendary Texas dance hall featuring live country music and two-stepping.',
  },
  {
    id: 'barton-springs-pool',
    name: 'Barton Springs Pool (Court Mode)',
    category: 'court',
    icon: '<img src="/assets/raw/landmark_court_0.png" class="cartoon-marker-img" />',
    district: 'West Austin / Zilker',
    lat: 30.2638,
    lng: -97.7713,
    address: '2201 Barton Springs Rd, Austin, TX 78704',
    description: 'Spring-fed 68°F natural pool surrounded by Zilker Park lawns.',
  },
  {
    id: 'austin-hindu-temple',
    name: 'Austin Hindu Temple',
    category: 'landmark',
    icon: '🛕',
    district: 'East Austin',
    lat: 30.2842,
    lng: -97.5855,
    address: '9801 Decker Ln, Austin, TX 78724',
    description: 'Vibrant cultural and community center in East Austin.',
  },
  {
    id: 'austin-bergstrom-airport',
    name: 'Austin-Bergstrom Int. Airport',
    category: 'travel',
    icon: '✈️',
    district: 'South Austin',
    lat: 30.1975,
    lng: -97.6664,
    address: '3600 Presidential Blvd, Austin, TX 78719',
    description: 'Austin’s international airport connection.',
  },
  {
    id: 'dick-nichols-park',
    name: 'Dick Nichols District Park',
    category: 'court',
    icon: '<img src="/assets/raw/landmark_court_1.png" class="cartoon-marker-img" />',
    district: 'South Austin',
    lat: 30.2078,
    lng: -97.8545,
    address: '8011 Beckett Rd, Austin, TX 78749',
    description: 'Full basketball courts, tennis courts, and shaded trails.',
  },
  {
    id: 'mueller-lake-park',
    name: 'Mueller Lake Park Courts',
    category: 'court',
    icon: '<img src="/assets/raw/landmark_court_2.png" class="cartoon-marker-img" />',
    district: 'North Austin / Mueller',
    lat: 30.2985,
    lng: -97.7051,
    address: '4550 Mueller Blvd, Austin, TX 78723',
    description: 'Browning Hangar, pickleball courts, and scenic lake loop.',
  },
  {
    id: 'pease-park',
    name: 'Pease Park Volleyball',
    category: 'court',
    icon: '<img src="/assets/raw/landmark_court_3.png" class="cartoon-marker-img" />',
    district: 'West Austin / Zilker',
    lat: 30.2825,
    lng: -97.7523,
    address: '1100 Kingsbury St, Austin, TX 78703',
    description: 'Volleyball courts, basketball, and shaded Shoal Creek greenway.',
  },
  {
    id: 'costco-wholesale-south',
    name: 'Costco Wholesale',
    category: 'market',
    icon: '🛍️',
    district: 'South Austin',
    lat: 30.2225,
    lng: -97.8285,
    address: '4301 W William Cannon Dr, Austin, TX 78749',
    description: 'South Austin wholesale shopping hub.',
  },
];

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

export default function AustinStreetMap({ onPlaceSelect }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const activeDistrictRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTileLayer, setSelectedTileLayer] = useState('esri_gray');
  const [currentZoom, setCurrentZoom] = useState(11.5);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const [showAiGuide, setShowAiGuide] = useState(false);
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
        zoom: 11.5,
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

      // Render place markers
      renderMarkers(MAP_LOCATIONS);

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
                activeDistrictRef.current = feature.properties.name;
                
                // Reveal markers only for this specific district
                markersRef.current.forEach(m => {
                  const el = m.getElement();
                  if (el) {
                    el.style.display = (m.placeDistrict === activeDistrictRef.current) ? 'block' : 'none';
                  }
                });
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

  const renderMarkers = (locationsList) => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    locationsList.forEach((place) => {
      const customHtml = `
        <div class="custom-map-marker-pin ${place.category}">
          <span class="marker-icon">${place.icon}</span>
          <span class="marker-title">${place.name}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-map-marker-container',
        html: customHtml,
        iconSize: [120, 36],
        iconAnchor: [60, 18],
      });

      const marker = L.marker([place.lat, place.lng], { icon: customIcon }).addTo(map);
      marker.placeDistrict = place.district; // Store district info on the marker object
      
      // Hide marker by default unless its district is active
      const el = marker.getElement();
      if (el) {
        el.style.display = (activeDistrictRef.current === place.district) ? 'block' : 'none';
      }

      marker.on('click', () => {
        setSelectedPlace(place);
        if (onPlaceSelect) onPlaceSelect(place);
      });

      markersRef.current.push(marker);
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

        setAiAnswer(result.explanation || '');

        if (result.matchedIds && result.matchedIds.length > 0) {
          const filtered = MAP_LOCATIONS.filter((loc) => result.matchedIds.includes(loc.id));
          renderMarkers(filtered);

          const firstMatch = filtered[0];
          if (firstMatch && mapInstanceRef.current && window.L) {
            mapInstanceRef.current.setView([firstMatch.lat, firstMatch.lng], 13, { animate: true });
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
    const filtered = MAP_LOCATIONS.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.district.toLowerCase().includes(q) ||
        loc.address.toLowerCase().includes(q) ||
        loc.category.toLowerCase().includes(q)
    );
    renderMarkers(filtered);
    if (filtered.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.setView([filtered[0].lat, filtered[0].lng], 12, { animate: true });
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

      {/* OpenAI AI Search Summary Banner */}
      {aiAnswer && (
        <div className="asm-ai-banner">
          <span className="asm-ai-badge">🤖 OpenAI Smart Match</span>
          <p>{aiAnswer}</p>
          <button className="asm-ai-close" onClick={() => setAiAnswer('')}>
            ✕
          </button>
        </div>
      )}

      {/* Place Detail Card */}
      {selectedPlace && (
        <div className="asm-place-card anim-scale-in">
          <button className="asm-card-close" onClick={() => setSelectedPlace(null)}>
            ✕
          </button>
          <div className="asm-card-header">
            <span className="asm-card-icon">{selectedPlace.icon}</span>
            <div>
              <h3>{selectedPlace.name}</h3>
              <span className="asm-card-district">{selectedPlace.district.toUpperCase()}</span>
            </div>
          </div>
          <p className="asm-card-address">📍 {selectedPlace.address}</p>
          <p className="asm-card-desc">{selectedPlace.description}</p>
          <div className="asm-card-actions">
            <button
              className="asm-action-btn primary"
              onClick={async () => {
                setShowAiGuide(true);
                setAiAnswer('Asking ATX Scout AI guide...');
                try {
                  const reply = await askAustinAiAssistant({
                    prompt: `Give me top tips, best times to visit, and activity suggestions for ${selectedPlace.name} in Austin.`,
                    locationContext: selectedPlace,
                    model: 'gpt-4o-mini',
                  });
                  setAiAnswer(reply);
                } catch (err) {
                  setAiAnswer(`OpenAI Guide Tip: Great spot in ${selectedPlace.district}! Perfect for daytime activity.`);
                }
              }}
            >
              🤖 Ask AI Guide Tips
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
