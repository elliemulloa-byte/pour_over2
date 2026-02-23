import { useState, useCallback, useRef, useEffect } from 'react';
import { searchUnified, suggestDrinks, getPopularDrinks, geocodeAddress, correctDrinkTypo } from '../api';
import '../App.css';
import { SearchHeader } from '../SearchHeader';
import { BeanVerdictLogo } from '../BeanVerdictLogo';
import { useGeo } from '../useGeo';
import { useAuth } from '../AuthContext';
import { SearchResults } from '../SearchResults';
import './Landing.css';

function parseSearchInput(input) {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return { query: trimmed, location: '' };
  const last = parts[parts.length - 1].toLowerCase();
  const drinkWords = ['latte', 'mocha', 'cappuccino', 'espresso', 'americano', 'cortado', 'macchiato', 'peppermint', 'chai', 'matcha', 'oat'];
  if (drinkWords.some((w) => last.includes(w))) return { query: trimmed, location: '' };
  const location = parts.pop();
  return { query: parts.join(' '), location };
}

const RECOMMENDED = [
  { label: 'Peppermint Mocha', img: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&h=200&fit=crop', query: 'peppermint mocha' },
  { label: 'Latte', img: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=200&h=200&fit=crop', query: 'latte' },
  { label: 'Cold Brew', img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=200&h=200&fit=crop', query: 'cold brew' },
  { label: 'Pour Over', img: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=200&h=200&fit=crop', query: 'pour over' },
  { label: 'Cappuccino', img: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=200&h=200&fit=crop', query: 'cappuccino' },
  { label: 'Mocha', img: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&h=200&fit=crop', query: 'mocha' },
  { label: 'Pure Espresso', img: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=200&h=200&fit=crop', query: 'pure espresso' },
  { label: 'Americano', img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop', query: 'americano' },
];

export function Landing() {
  const [query, setQuery] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [results, setResults] = useState({ shops: [], drinks: [] });
  const [suggestions, setSuggestions] = useState([]);
  const [popularSuggestions, setPopularSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [locationError, setLocationError] = useState('');
  const { user } = useAuth();
  const { coords, loading: geoLoading, error: geoError, request: requestLocation } = useGeo();
  const debounceRef = useRef(null);

  const hasLocation = !!coords || !!locationInput.trim();


  useEffect(() => {
    getPopularDrinks().then((data) => setPopularSuggestions(data.suggestions || []));
  }, []);

  const runSearch = useCallback(
    async (q, coordsToUse) => {
      const trimmed = (q ?? query).trim();
      if (trimmed.length < 2) {
        setResults({ shops: [], drinks: [] });
        setSearched(false);
        return;
      }
      setLoading(true);
      setSearched(true);
      try {
        const { lat, lng } = coordsToUse ?? coords ?? {};
        const data = await searchUnified(trimmed, lat, lng);
        setResults({ shops: data.shops || [], drinks: data.drinks || [] });
        setSuggestions(data.suggestions || []);
      } catch (e) {
        setResults({ shops: [], drinks: [] });
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [query, coords]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const data = await suggestDrinks(query);
      setSuggestions(data.suggestions || []);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const getCoords = useCallback(async () => {
    if (coords) return coords;
    if (locationInput.trim()) {
      const c = await geocodeAddress(locationInput.trim());
      if (c) return c;
    }
    if (navigator.geolocation) return await requestLocation();
    return null;
  }, [coords, locationInput, requestLocation]);

  const handleShareLocation = useCallback(async () => {
    await requestLocation();
  }, [requestLocation]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    let trimmed = query.trim();
    const parsed = parseSearchInput(trimmed);
    if (parsed.location && !locationInput.trim()) {
      setLocationInput(parsed.location);
    }
    const searchQuery = parsed.query || trimmed;
    const corrected = correctDrinkTypo(searchQuery);
    if (corrected !== searchQuery) setQuery(corrected);
    const finalQuery = corrected;
    const effectiveLocation = parsed.location || locationInput.trim() || coords;
    if (finalQuery.length < 2) return;
    if (!effectiveLocation && !coords) {
      setLocationError('Enter a city or address, or tap the pin to share your location.');
      return;
    }
    setLocationError('');
    let coordsToUse = coords;
    if (parsed.location || locationInput.trim()) {
      coordsToUse = await geocodeAddress(parsed.location || locationInput.trim());
      if (!coordsToUse && coords) coordsToUse = coords;
      if (!coordsToUse && navigator.geolocation) coordsToUse = await requestLocation();
    } else if (navigator.geolocation) {
      coordsToUse = await requestLocation();
    }
    await runSearch(finalQuery, coordsToUse);
  };

  const handleSuggestionClick = async (s) => {
    setQuery(s);
    setResults({ shops: [], drinks: [] });
    setSearched(false);
    if (!hasLocation) return;
    const coordsToUse = await getCoords();
    setTimeout(() => runSearch(s, coordsToUse), 0);
  };

  const handleRecommendedClick = async (item) => {
    setQuery(item.query);
    setResults({ shops: [], drinks: [] });
    setSearched(false);
    if (!hasLocation) {
      return;
    }
    const coordsToUse = await getCoords();
    setTimeout(() => runSearch(item.query, coordsToUse), 0);
  };

  const displaySuggestions = query.trim().length >= 2 ? suggestions : popularSuggestions;
  const suggestionsLabel = query.trim().length >= 2 ? 'Try one of these' : 'Popular drinks';

  return (
    <main className="landing">
      <div className="landing-hero">
        <div className="landing-hero-bg" aria-hidden />
        <div className="landing-hero-content">
          <h1 className="landing-title">
            <BeanVerdictLogo className="landing-logo" />
            Bean Verdict
          </h1>
          <p className="landing-tagline">
            Search by drink or coffee shop and location.
          </p>
          <SearchHeader
            query={query}
            setQuery={setQuery}
            locationInput={locationInput}
            setLocationInput={setLocationInput}
            onShareLocation={handleShareLocation}
            onSubmit={handleSubmit}
            loading={loading}
            geoLoading={geoLoading}
            geoError={geoError}
            hasCoords={!!coords}
            hasLocation={hasLocation}
            compact
            hideHint
          />
          {!hasLocation && (
            <p className="landing-location-required">
              Enter your city or address, or tap the pin to share your location.
            </p>
          )}
          {locationError && (
            <p className="landing-location-error" role="alert">{locationError}</p>
          )}
        </div>
      </div>

      <section className="landing-recommended" aria-label="Recommended searches">
        <h2 className="landing-recommended-title">Try searching</h2>
        <div className="recommended-grid">
          {RECOMMENDED.map((item) => (
            <button
              key={item.query}
              type="button"
              className="recommended-card"
              onClick={() => handleRecommendedClick(item)}
              disabled={!hasLocation}
            >
              <img src={item.img} alt="" className="recommended-img" />
              <span className="recommended-label">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {!searched && displaySuggestions.length > 0 && (
        <section className="suggestions landing-suggestions" aria-label="Drink suggestions">
          <p className="suggestions-label">{suggestionsLabel}</p>
          <ul className="suggestions-list">
            {displaySuggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="suggestion-btn"
                  onClick={() => handleSuggestionClick(s)}
                  disabled={!hasLocation}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {searched && (
        <SearchResults
          shops={results.shops}
          drinks={results.drinks}
          loading={loading}
          query={query}
          hasLocation={hasLocation || !!coords}
          user={user}
        />
      )}

      {searched && !loading && results.shops.length === 0 && results.drinks.length === 0 && (
        <div className="empty">
          <p>No results for "{query}".</p>
          <p className="empty-hint">
            Try a drink (e.g. latte, peppermint mocha) or a coffee shop (e.g. Houndstooth Austin).
          </p>
        </div>
      )}
    </main>
  );
}
