import { useState } from 'react';

/**
 * Yelp/Google-style star rating: click to rate, hover to preview.
 * Stars fill on hover and stay filled after click.
 */
export function StarRating({ value = 0, onChange, size = '1.5rem', readonly = false }) {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = readonly ? value : (hoverValue || value);

  return (
    <div
      className="star-rating"
      style={{ fontSize: size }}
      onMouseLeave={() => !readonly && setHoverValue(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${displayValue >= n ? 'filled' : ''}`}
          onClick={() => !readonly && onChange && onChange(n)}
          onMouseEnter={() => !readonly && setHoverValue(n)}
          disabled={readonly}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
