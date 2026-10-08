export const AUSTIN_DISTRICTS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Downtown', color: '#3b82f6' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-97.755, 30.260],
          [-97.730, 30.260],
          [-97.730, 30.285],
          [-97.755, 30.285],
          [-97.755, 30.260]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'South Austin', color: '#f43f5e' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-97.800, 30.200],
          [-97.730, 30.200],
          [-97.730, 30.260],
          [-97.800, 30.260],
          [-97.800, 30.200]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'East Austin', color: '#10b981' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-97.730, 30.240],
          [-97.680, 30.240],
          [-97.680, 30.290],
          [-97.730, 30.290],
          [-97.730, 30.240]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'North Austin / Mueller', color: '#f59e0b' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-97.740, 30.285],
          [-97.680, 30.285],
          [-97.680, 30.340],
          [-97.740, 30.340],
          [-97.740, 30.285]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'West Austin / Zilker', color: '#8b5cf6' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-97.800, 30.260],
          [-97.755, 30.260],
          [-97.755, 30.285],
          [-97.740, 30.285],
          [-97.740, 30.320],
          [-97.800, 30.320],
          [-97.800, 30.260]
        ]]
      }
    }
  ]
};
