import { useRef, useEffect } from 'react';
import { BeanVerdictLogo } from './BeanVerdictLogo';

export function SearchHeader({
  query,
  setQuery,
  locationInput,
  setLocationInput,
  onShareLocation,
  onSubmit,
  loading,
  geoLoading,
  geoError,
  hasCoords,
  hasLocation,
  compact = false,
  hideHint = false,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <header className={`header ${compact ? 'header--compact' : ''}`}>
      {!compact && (
        <h1 className="logo">
          <BeanVerdictLogo className="logo-svg" />
          <span>Bean Verdict</span>
        </h1>
      )}
      <form className="search-form search-form--maps" onSubmit={onSubmit} role="search">
        <div className="search-row">
          <label htmlFor="drink-search" className="visually-hidden">
            Search for a drink or coffee shop
          </label>
          <input
            ref={inputRef}
            id="drink-search"
            type="search"
            tabIndex={1}
            inputMode="search"
            autoComplete="on"
            autoCapitalize="off"
            autoCorrect="on"
            spellCheck="true"
            placeholder="e.g. latte, peppermint mocha, Houndstooth Austin"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(e); }}
            className="search-input"
            aria-describedby={hideHint ? undefined : 'search-hint'}
          />
          <button
            type="submit"
            className="search-btn"
            disabled={loading}
            aria-label="Search"
          >
            {loading ? (
              <span className="spinner" aria-hidden />
            ) : (
              <span className="search-btn-icon" aria-hidden>→</span>
            )}
          </button>
        </div>
        <div className="search-row search-row--location">
          <label htmlFor="location-search" className="visually-hidden">
            Address or city
          </label>
          <input
            id="location-search"
            type="text"
            tabIndex={2}
            inputMode="text"
            autoComplete="address-line1"
            autoCorrect="on"
            spellCheck="true"
            placeholder="Enter address or city"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(e); }}
            className="search-input search-input--location"
          />
          <button
            type="button"
            className="search-btn-location"
            onClick={onShareLocation}
            disabled={geoLoading}
            aria-label="Share my location"
            title="Use my location"
          >
            {geoLoading ? (
              <span className="spinner spinner--sm" aria-hidden />
            ) : (
              <span className="search-btn-location-icon" aria-hidden>📍</span>
            )}
          </button>
        </div>
      </form>
      {!hideHint && (
        <p id="search-hint" className="search-hint">
          Search by drink or shop name and location.
        </p>
      )}
      {geoLoading && <p className="location-status">Getting your location…</p>}
      {geoError && !locationInput && (
        <p className="location-error" role="alert">
          Location unavailable. Enter a city or address below to search.
        </p>
      )}
      {hasCoords && !locationInput && (
        <p className="location-status location-ok">Using your location for nearby results.</p>
      )}
      {locationInput && (
        <p className="location-status location-ok">Searching near: {locationInput}</p>
      )}
    </header>
  );
}
