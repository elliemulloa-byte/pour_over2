import { useState } from 'react';
import { addReview } from './api';

const REVIEW_DESCRIPTORS = ['bitter', 'sweet', 'smooth', 'strong', 'creamy', 'bold', 'mild', 'roasty'];

export function DrinkResults({ results, loading, query, hasCoords, user }) {
  if (loading) return null;

  return (
    <section className="results" aria-label={`Results for ${query}`}>
      <p className="results-count">
        {results.length} {results.length === 1 ? 'drink' : 'drinks'} found
        {hasCoords ? ' (sorted by relevance & distance)' : ''}
      </p>
      <ul className="results-list">
        {results.map((r) => (
          <ResultCard key={`${r.shopId}-${r.drinkId}`} r={r} user={user} />
        ))}
      </ul>
    </section>
  );
}

function ResultCard({ r, user }) {
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [descriptors, setDescriptors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  function toggleDescriptor(tag) {
    setDescriptors((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating < 1 || rating > 5) return;
    setSubmitting(true);
    setMessage('');
    try {
      await addReview(r.drinkId, rating, comment.trim() || undefined, descriptors);
      setMessage('Review saved! It will appear on your profile.');
      setShowForm(false);
      setRating(0);
      setComment('');
      setDescriptors([]);
    } catch (err) {
      setMessage(err.message || 'Could not save review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="result-card">
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
        {(r.distanceMiles ?? r.distanceKm) != null && (
          <span className="result-distance">{(r.distanceMiles ?? (r.distanceKm * 0.621371).toFixed(1))} mi away</span>
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
      {user && (
        <div className="result-add-review">
          {!showForm ? (
            <button type="button" className="result-add-review-btn" onClick={() => setShowForm(true)}>
              Add your review
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="result-review-form">
              <p className="result-review-drink-label">Rating: <strong>{r.displayName}</strong></p>
              <div className="result-review-stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`result-star-btn ${rating >= n ? 'filled' : ''}`}
                    onClick={() => setRating(n)}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="result-review-descriptors">
                {REVIEW_DESCRIPTORS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`descriptor-btn ${descriptors.includes(tag) ? 'selected' : ''}`}
                    onClick={() => toggleDescriptor(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="result-review-comment-input"
              />
              {message && <p className="result-review-message">{message}</p>}
              <div className="result-review-actions">
                <button type="submit" className="result-review-submit" disabled={submitting || rating < 1}>
                  {submitting ? 'Saving…' : 'Save review'}
                </button>
                <button type="button" className="result-review-cancel" onClick={() => { setShowForm(false); setRating(0); setComment(''); setDescriptors([]); setMessage(''); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
