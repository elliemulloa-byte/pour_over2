import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { suggestDrinks, getPopularDrinks, correctDrinkTypo } from '../api';
import '../App.css';
import { SearchHeader } from '../SearchHeader';
import { BeanVerdictLogo } from '../BeanVerdictLogo';
import { useGeo } from '../useGeo';
import { useAuth } from '../AuthContext';
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

// Unique images per drink – picsum uses seed for deterministic, working URLs
const RECOMMENDED = [
  { label: 'Peppermint Mocha', img: 'https://picsum.photos/seed/peppermint-mocha/600/600', query: 'peppermint mocha' },
  { label: 'Latte', img: 'https://picsum.photos/seed/latte-coffee/600/600', query: 'latte' },
  { label: 'Cold Brew', img: 'https://picsum.photos/seed/cold-brew/600/600', query: 'cold brew' },
  { label: 'Pour Over', img: 'https://picsum.photos/seed/pour-over/600/600', query: 'pour over' },
  { label: 'Cappuccino', img: 'https://picsum.photos/seed/cappuccino/600/600', query: 'cappuccino' },
  { label: 'Mocha', img: 'https://picsum.photos/seed/mocha-coffee/600/600', query: 'mocha' },
  { label: 'Espresso (shot)', img: 'https://picsum.photos/seed/espresso-shot/600/600', query: 'espresso' },
  { label: 'Americano', img: 'https://picsum.photos/seed/americano/600/600', query: 'americano' },
];

export function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [popularSuggestions, setPopularSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  useAuth();
  const { coords, loading: geoLoading, error: geoError, request: requestLocation } = useGeo();
  const debounceRef = useRef(null);

  const hasLocation = !!coords || !!locationInput.trim();


  useEffect(() => {
    getPopularDrinks().then((data) => setPopularSuggestions(data.suggestions || []));
  }, []);

  const goToResults = useCallback((searchQuery, location) => {
    const params = new URLSearchParams();
    params.set('q', searchQuery.trim());
    if (location && location.trim()) params.set('location', location.trim());
    navigate(`/search?${params.toString()}`);
  }, [navigate]);

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

  const handleShareLocation = useCallback(async () => {
    await requestLocation();
  }, [requestLocation]);

  const handleSubmit = (e) => {
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
    if (finalQuery.length < 2) return;
    setLocationError('');
    const loc = parsed.location || locationInput.trim();
    goToResults(finalQuery, loc);
  };

  const handleSuggestionClick = (s) => {
    setQuery(s);
    goToResults(s, locationInput);
  };

  const handleRecommendedClick = (item) => {
    setQuery(item.query);
    goToResults(item.query, locationInput);
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
            >
              <img src={item.img} alt="" className="recommended-img" />
              <span className="recommended-label">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {displaySuggestions.length > 0 && (
        <section className="suggestions landing-suggestions" aria-label="Drink suggestions">
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
    </main>
  );
}
