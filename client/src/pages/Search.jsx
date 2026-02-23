import { useState, useCallback, useRef, useEffect } from 'react';
import { searchDrinks, suggestDrinks, getPopularDrinks, addReview } from '../api';
import '../App.css';
import { SearchHeader } from '../SearchHeader';
import { DrinkResults } from '../DrinkResults';
import { useGeo } from '../useGeo';
import { useAuth } from '../AuthContext';

export function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [popularSuggestions, setPopularSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { user } = useAuth();
  const { coords, loading: geoLoading, error: geoError, request: requestLocation } = useGeo();
  const debounceRef = useRef(null);

  useEffect(() => {
    getPopularDrinks().then((data) => setPopularSuggestions(data.suggestions || []));
  }, []);

  const runSearch = useCallback(
    async (q, coordsToUse) => {
      const trimmed = (q ?? query).trim();
      if (trimmed.length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      setSearched(true);
      try {
        const { lat, lng } = coordsToUse ?? coords ?? {};
        const data = await searchDrinks(trimmed, lat, lng);
        setResults(data.results || []);
        setSuggestions(data.suggestions || []);
      } catch (e) {
        setResults([]);
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

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    if (!coords && !geoError && navigator.geolocation) {
      const c = await requestLocation();
      await runSearch(trimmed, c);
    } else {
      await runSearch(trimmed);
    }
  };

  const handleSuggestionClick = async (s) => {
    setQuery(s);
    setResults([]);
    setSearched(false);
    if (!coords && !geoError && navigator.geolocation) {
      const c = await requestLocation();
      setTimeout(() => runSearch(s, c), 0);
    } else {
      setTimeout(() => runSearch(s), 0);
    }
  };

  const displaySuggestions = query.trim().length >= 2 ? suggestions : popularSuggestions;
  const suggestionsLabel = query.trim().length >= 2 ? 'Try one of these' : 'Popular drinks';

  return (
    <div className="app">
      <SearchHeader
        query={query}
        setQuery={setQuery}
        onSubmit={handleSubmit}
        loading={loading}
        geoLoading={geoLoading}
        geoError={geoError}
        hasCoords={!!coords}
        compact
      />
      {!searched && displaySuggestions.length > 0 && (
        <section className="suggestions" aria-label="Drink suggestions">
          <p className="suggestions-label">{suggestionsLabel}</p>
          <ul className="suggestions-list">
            {displaySuggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="suggestion-btn"
                  onClick={() => handleSuggestionClick(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {searched && (
        <DrinkResults
          results={results}
          loading={loading}
          query={query}
          hasCoords={!!coords}
          user={user}
        />
      )}
      {searched && !loading && results.length === 0 && (
        <div className="empty">
          <p>No drinks found for "{query}".</p>
          <p className="empty-hint">Try another name (e.g. cappuccino, pour over, flat white).</p>
        </div>
      )}
    </div>
  );
}
