import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchUnified, geocodeAddress } from '../api';
import { useGeo } from '../useGeo';
import { SearchResults } from '../SearchResults';
import { useAuth } from '../AuthContext';
import './SearchResultsPage.css';

export function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const loc = searchParams.get('location') || '';
  const [results, setResults] = useState({ shops: [], drinks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { coords, request: requestLocation } = useGeo();
  const { user } = useAuth();

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setLoading(false);
      setResults({ shops: [], drinks: [] });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    async function doSearch() {
      let coordsToUse = coords;
      if (!coordsToUse && loc.trim()) {
        try {
          coordsToUse = await Promise.race([
            geocodeAddress(loc.trim()),
            new Promise((r) => setTimeout(r, 4000)),
          ]);
        } catch (_) {}
      }
      if (!coordsToUse && navigator.geolocation) {
        try {
          coordsToUse = await Promise.race([
            requestLocation(),
            new Promise((r) => setTimeout(r, 3000)),
          ]);
        } catch (_) {}
      }

      if (cancelled) return;
      try {
        const { lat, lng } = coordsToUse ?? {};
        const data = await searchUnified(trimmed, lat, lng);
        if (cancelled) return;
        setResults({ shops: data.shops || [], drinks: data.drinks || [] });
      } catch (e) {
        if (cancelled) return;
        setError('Search failed. Make sure the server is running.');
        setResults({ shops: [], drinks: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    doSearch();
    return () => { cancelled = true; };
  }, [q, loc, coords, requestLocation]);

  const trimmed = q.trim();
  const hasLocation = !!coords || !!loc.trim();
  const hasResults = results.shops.length > 0 || results.drinks.length > 0;

  return (
    <div className="search-results-page">
      <div className="search-results-page-header">
        <Link to="/" className="search-results-back">← Back to search</Link>
        <h1 className="search-results-page-title">Results for &ldquo;{trimmed || '...'}&rdquo;</h1>
        {loc && <p className="search-results-location">Near: {loc}</p>}
      </div>

      {error && (
        <div className="search-results-error">
          <p>{error}</p>
        </div>
      )}

      <SearchResults
        shops={results.shops}
        drinks={results.drinks}
        loading={loading}
        query={trimmed}
        hasLocation={hasLocation}
        user={user}
      />

      {!loading && !error && trimmed.length >= 2 && !hasResults && (
        <div className="search-results-empty">
          <p>No results for &ldquo;{trimmed}&rdquo;.</p>
          <p className="search-results-empty-hint">Try &ldquo;latte&rdquo;, &ldquo;cold brew&rdquo;, or add a city in the location field.</p>
          <Link to="/" className="search-results-back-link">Search again</Link>
        </div>
      )}
    </div>
  );
}
