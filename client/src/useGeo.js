import { useState, useCallback } from 'react';

export function useGeo() {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return Promise.resolve(null);
    }
    if (coords) return Promise.resolve(coords);
    setError(null);
    setLoading(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          setLoading(false);
          resolve(c);
        },
        (err) => {
          setError(err.message || 'Location denied');
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  }, [coords]);

  return { coords, loading, error, request };
}
