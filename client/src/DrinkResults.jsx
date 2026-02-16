export function DrinkResults({ results, loading, query, hasCoords }) {
  if (loading) return null;

  return (
    <section className="results" aria-label={`Results for ${query}`}>
      <p className="results-count">
        {results.length} {results.length === 1 ? 'drink' : 'drinks'} found
        {hasCoords ? ' (sorted by relevance & distance)' : ''}
      </p>
      <ul className="results-list">
        {results.map((r) => (
          <li key={`${r.shopId}-${r.drinkId}`} className="result-card">
            <div className="result-drink">{r.displayName}</div>
            <div className="result-shop">{r.shopName}</div>
            {r.shopAddress && (
              <div className="result-address">{r.shopAddress}</div>
            )}
            <div className="result-meta">
              {r.avgRating != null && (
                <span className="result-rating" aria-label={`${r.avgRating} out of 5`}>
                  <span className="stars" aria-hidden>
                    {'★'.repeat(Math.round(r.avgRating))}
                    {'☆'.repeat(5 - Math.round(r.avgRating))}
                  </span>
                  <span>{r.avgRating}</span>
                  <span className="result-review-count">({r.reviewCount})</span>
                </span>
              )}
              {r.reviewCount === 0 && (
                <span className="result-no-reviews">No reviews yet</span>
              )}
              {r.distanceKm != null && (
                <span className="result-distance">{r.distanceKm} km away</span>
              )}
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.shopAddress || r.shopName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="result-map-link"
            >
              Open in Maps
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
