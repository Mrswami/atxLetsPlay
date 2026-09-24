import { useState, useEffect } from 'react';

/**
 * useUserLocation – requests the browser Geolocation API and returns the
 * user's current position along with permission / error state.
 *
 * Returns:
 *   position  – { lat, lng } | null
 *   accuracy  – metres | null
 *   error     – string | null
 *   loading   – boolean
 *   request   – function() – manually trigger / re-request permission
 */
export function useUserLocation() {
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [triggered, setTriggered] = useState(false);

  function request() {
    setTriggered(true);
  }

  useEffect(() => {
    if (!triggered) return;
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setError(null);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy);
        setLoading(false);
      },
      (err) => {
        let message = 'Unable to retrieve your location.';
        if (err.code === err.PERMISSION_DENIED) {
          message = 'Location permission denied. Please enable it in your browser settings.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message = 'Location information is unavailable.';
        } else if (err.code === err.TIMEOUT) {
          message = 'Location request timed out.';
        }
        setError(message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [triggered]);

  return { position, accuracy, error, loading, request };
}
