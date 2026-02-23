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
              const isGoogle = s.source === 'google';
              const isOsm = s.source === 'osm';
              const linkTo = isGoogle ? `/place/${encodeURIComponent(s.placeId)}` : isOsm ? null : `/shop/${s.shopId}`;
              const key = isGoogle ? `g-${s.placeId}` : isOsm ? `osm-${s.placeId}` : s.shopId;
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address || s.shopName)}`;
              const CardWrapper = linkTo ? Link : 'a';
              const cardProps = linkTo ? { to: linkTo } : { href: mapsUrl, target: '_blank', rel: 'noopener noreferrer' };
              return (
              <li key={key}>
                <CardWrapper {...cardProps} className="result-card result-card--shop">
                  <div className="result-card-main">
                    <div className="result-shop-name">{s.shopName}</div>
                    <div className="result-address">{s.address || ''}</div>
                    <div className="result-meta">
                      {s.avgRating != null && (
                        <span className="result-rating" aria-label={`${s.avgRating} out of 5`}>
                          <span className="stars">{'★'.repeat(Math.round(s.avgRating))}{'☆'.repeat(5 - Math.round(s.avgRating))}</span>
                          <span>{s.avgRating}</span>
                          <span className="result-review-count">({s.reviewCount} reviews)</span>
                        </span>
                      )}
                      {s.distanceKm != null && hasLocation && (
                        <span className="result-distance">{s.distanceKm} km away</span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address || s.shopName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="result-map-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Map
                  </a>
                </CardWrapper>
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
            {drinks.map((d) => (
              <li key={`${d.shopId}-${d.drinkId}`}>
                <Link to={`/shop/${d.shopId}`} className="result-card result-card--drink">
                  <div className="result-drink">{d.displayName}</div>
                  <div className="result-shop">{d.shopName}</div>
                  <div className="result-address">{d.shopAddress}</div>
                  <div className="result-meta">
                    {d.avgRating != null && (
                      <span className="result-rating">
                        <span className="stars">{'★'.repeat(Math.round(d.avgRating))}{'☆'.repeat(5 - Math.round(d.avgRating))}</span>
                        <span>{d.avgRating}</span>
                        <span className="result-review-count">({d.reviewCount})</span>
                      </span>
                    )}
                    {d.distanceKm != null && hasLocation && (
                      <span className="result-distance">{d.distanceKm} km away</span>
                    )}
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.shopAddress || d.shopName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="result-map-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Map
                  </a>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
