import { useState, useCallback, useRef, useEffect } from 'react';
import { searchDrinks, suggestDrinks } from './api';
import './App.css';
import { SearchHeader } from './SearchHeader';
import { DrinkResults } from './DrinkResults';
import { useGeo } from './useGeo';

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { coords, loading: geoLoading, error: geoError, request } = useGeo();
  const debounceRef = useRef(null);

  const runSearch = useCallback(
    async (q) => {
      const trimmed = (q ?? query).trim();
      if (trimmed.length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      setSearched(true);
      try {
        const { lat, lng } = coords || {};
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
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const data = await suggestDrinks(query);
      setSuggestions(data.suggestions || []);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    runSearch(query);
  };

  const handleSuggestionClick = (s) => {
    setQuery(s);
    setResults([]);
    setSearched(false);
    setTimeout(() => runSearch(s), 0);
  };

  return (
    <div className="app">
      <SearchHeader
        query={query}
        setQuery={setQuery}
        onSubmit={handleSubmit}
        loading={loading}
        geoLoading={geoLoading}
        geoError={geoError}
        onRequestLocation={request}
        hasCoords={!!coords}
      />
      {!searched && query.trim().length >= 2 && suggestions.length > 0 && (
        <section className="suggestions" aria-label="Drink suggestions">
          <p className="suggestions-label">Try one of these</p>
          <ul className="suggestions-list">
            {suggestions.map((s) => (
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
        />
      )}
      {searched && !loading && results.length === 0 && (
        <div className="empty">
          <p>No drinks found for “{query}”.</p>
          <p className="empty-hint">Try another name (e.g. cappuccino, pour over, flat white).</p>
        </div>
      )}
    </div>
  );
}
