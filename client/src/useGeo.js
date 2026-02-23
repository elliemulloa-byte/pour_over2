import { useState, useCallback } from 'react';

export function useGeo() {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async () => {
    if (coords) return Promise.resolve(coords);
    setError(null);
    setLoading(true);

    const tryGeolocation = () => new Promise((resolve) => {
      // Geolocation only works on HTTPS or localhost; skip if insecure context
      const isSecure = typeof window !== 'undefined' && (window.location?.protocol === 'https:' || /^localhost$|^127\./.test(window.location?.hostname || ''));
      if (!navigator.geolocation || !isSecure) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          setLoading(false);
          resolve(c);
        },
        () => resolve(null),
        // Use low accuracy (cell/wifi) - works when GPS is restricted
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
      );
    });

    let c = await tryGeolocation();
    if (c) {
      setCoords(c);
      setLoading(false);
      return c;
    }

    // Fallback: approximate location from IP (city-level)
    try {
      const res = await fetch('/api/location/ip', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data?.lat != null && data?.lng != null) {
          c = { lat: data.lat, lng: data.lng };
          setCoords(c);
          setError(null);
          setLoading(false);
          return c;
        }
      }
    } catch (_) { /* ignore */ }

    setError('Location unavailable. Enter a city or address below.');
    setLoading(false);
    return null;
  }, [coords]);

  return { coords, loading, error, request };
}
