import { useRef, useEffect } from 'react';

export function SearchHeader({
  query,
  setQuery,
  onSubmit,
  loading,
  geoLoading,
  geoError,
  onRequestLocation,
  hasCoords,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <header className="header">
      <h1 className="logo">
        <span className="logo-icon" aria-hidden>☕</span>
        <span>Pour Over</span>
      </h1>
      <p className="tagline">Find your drink — not the vibe.</p>
      <form className="search-form" onSubmit={onSubmit} role="search">
        <label htmlFor="drink-search" className="visually-hidden">
          Search for a drink
        </label>
        <input
          ref={inputRef}
          id="drink-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="e.g. cappuccino, pour over, peppermint mocha"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
          aria-describedby="search-hint"
        />
        <button
          type="submit"
          className="search-btn"
          disabled={loading || query.trim().length < 2}
          aria-label="Search"
        >
          {loading ? (
            <span className="spinner" aria-hidden />
          ) : (
            <span className="search-btn-icon" aria-hidden>→</span>
          )}
        </button>
      </form>
      <p id="search-hint" className="search-hint">
        Only the drink is reviewed — no venue noise.
      </p>
      <div className="location-row">
        {!hasCoords && !geoLoading && (
          <button
            type="button"
            className="location-btn"
            onClick={onRequestLocation}
            aria-label="Use my location for nearby results"
          >
            Use my location for nearby
          </button>
        )}
        {geoLoading && <span className="location-status">Getting location…</span>}
        {geoError && (
          <span className="location-error" role="alert">
            Location unavailable. Results not sorted by distance.
          </span>
        )}
        {hasCoords && <span className="location-ok">Nearby results on</span>}
      </div>
    </header>
  );
}
