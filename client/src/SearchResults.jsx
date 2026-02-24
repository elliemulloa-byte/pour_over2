import { Link } from 'react-router-dom';

export function SearchResults({ shops, drinks, loading, query, hasLocation, user }) {
  if (loading) {
    return (
      <section className="search-results" aria-label={`Results for ${query}`}>
        <p className="loading-text">Searching…</p>
      </section>
    );
  }

  return (
    <section className="search-results" aria-label={`Results for ${query}`}>
      {shops.length > 0 && (
        <div className="results-section">
          <h2 className="results-section-title">Coffee shops</h2>
          <ul className="results-list results-list--yelp">
            {shops.map((s) => {
              const isPlace = s.source === 'google' || s.source === 'osm' || s.source === 'foursquare';
              const linkTo = isPlace ? `/place/${encodeURIComponent(s.placeId)}` : `/shop/${s.shopId}`;
              const key = isPlace ? (s.placeId || `p-${s.shopName}`) : s.shopId;
              const searchResult = isPlace ? { placeId: s.placeId, name: s.shopName, address: s.address, avgRating: s.avgRating, reviewCount: s.reviewCount || 0, source: s.source } : null;
              const mapsUrl = (s.source === 'google') && s.placeId
                ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(s.placeId)}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address || s.shopName)}`;
              return (
              <li key={key} className="result-card-wrap">
                <Link to={linkTo} state={{ searchResult }} className="result-card result-card--shop">
                  <div className="result-card-main">
                    <div className="result-shop-name">{s.shopName}</div>
                    <div className="result-meta">
                      {s.avgRating != null && (
                        <span className="result-rating" aria-label={`${s.avgRating} out of 5`}>
                          <span className="stars">{'★'.repeat(Math.round(s.avgRating))}{'☆'.repeat(5 - Math.round(s.avgRating))}</span>
                          <span>{s.avgRating}</span>
                          <span className="result-review-count">({s.reviewCount} reviews)</span>
                        </span>
                      )}
                      {(s.distanceMiles ?? s.distanceKm) != null && hasLocation && (
                        <span className="result-distance">{(s.distanceMiles ?? (s.distanceKm * 0.621371).toFixed(1))} mi away</span>
                      )}
                    </div>
                  </div>
                </Link>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-map-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  Directions
                </a>
              </li>
            );
            })}
          </ul>
        </div>
      )}

      {drinks.length > 0 && (
        <div className="results-section">
          <h2 className="results-section-title">Drinks</h2>
          <ul className="results-list results-list--yelp">
            {drinks.map((d) => {
              const isPlace = d.placeId || d.source === 'place';
              const linkTo = isPlace ? `/place/${encodeURIComponent(d.placeId)}` : `/shop/${d.shopId}`;
              const key = isPlace ? `place-${d.placeId}-${d.drinkId}` : `shop-${d.shopId}-${d.drinkId}`;
              return (
              <li key={key} className="result-card-wrap">
                <Link to={linkTo} className="result-card result-card--drink">
                  <div className="result-drink">{d.displayName}</div>
                  <div className="result-shop">{d.shopName}</div>
                  <div className="result-meta">
                    {d.avgRating != null && (
                      <span className="result-rating">
                        <span className="stars">{'★'.repeat(Math.round(d.avgRating))}{'☆'.repeat(5 - Math.round(d.avgRating))}</span>
                        <span>{d.avgRating}</span>
                        <span className="result-review-count">({d.reviewCount})</span>
                      </span>
                    )}
                    {(d.distanceMiles ?? d.distanceKm) != null && hasLocation && (
                      <span className="result-distance">{(d.distanceMiles ?? (d.distanceKm * 0.621371).toFixed(1))} mi away</span>
                    )}
                  </div>
                </Link>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.shopAddress || d.shopName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-map-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  Directions
                </a>
              </li>
            );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
