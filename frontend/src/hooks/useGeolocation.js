import { useEffect, useState } from "react";

/**
 * useGeolocation
 *
 * Returns:
 *   coords   – { latitude, longitude } | null
 *   denied   – true when permission is explicitly blocked
 *   loading  – true while waiting for first position
 *
 * Options:
 *   enableHighAccuracy – default false (faster, works on Mac hotspot)
 *   timeout            – ms before giving up (default 8000)
 *   onFallback(coords) – called with IP-based coords when GPS unavailable
 */
export function useGeolocation({ enableHighAccuracy = false, timeout = 8000, onFallback } = {}) {
  const [coords, setCoords] = useState(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setDenied(true);
      setLoading(false);
      return;
    }

    async function tryIpFallback() {
      if (!onFallback) { setLoading(false); return; }
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const ipCoords = { latitude: Number(data.latitude), longitude: Number(data.longitude) };
          setCoords(ipCoords);
          onFallback(ipCoords);
        }
      } catch {
        // IP lookup failed — stay without coords
      } finally {
        setLoading(false);
      }
    }

    function handleSuccess(pos) {
      setCoords({
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
      });
      setDenied(false);
      setLoading(false);
    }

    function handleError(err) {
      if (err.code === 1) {
        setDenied(true);
        setLoading(false);
      } else {
        tryIpFallback();
      }
    }

    const opts = { enableHighAccuracy, timeout, maximumAge: 0 };

    // One-shot for immediate fix
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, opts);

    // Keep updating
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      ...opts,
      timeout: 10000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { coords, denied, loading };
}
