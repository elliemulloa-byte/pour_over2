import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getMyReviews } from '../api';
import './Profile.css';

export function Profile() {
  const { user, logout } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyReviews()
      .then((data) => { if (!cancelled) setReviews(data.reviews || []); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!user) {
    return (
      <div className="profile-page">
        <p className="profile-guest">Please <Link to="/login">sign in</Link> to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar" aria-hidden>
          {(user.displayName || user.email).charAt(0).toUpperCase()}
        </div>
        <h1 className="profile-name">{user.displayName || user.email}</h1>
        <p className="profile-email">{user.email}</p>
        <button type="button" className="profile-logout" onClick={logout}>
          Sign out
        </button>
      </div>
      <section className="profile-reviews" aria-label="Your reviews">
        <h2 className="profile-reviews-title">Your reviews</h2>
        {loading ? (
          <p className="profile-loading">Loading…</p>
        ) : reviews.length === 0 ? (
          <p className="profile-empty">
            You haven’t written any reviews yet. Search for a drink and add a review to see it here.
          </p>
        ) : (
          <ul className="profile-review-list">
            {reviews.map((r) => (
              <li key={r.review_id} className="profile-review-card">
                <div className="profile-review-drink">{r.drink_name}</div>
                <div className="profile-review-shop">{r.shop_name}</div>
                <div className="profile-review-meta">
                  <span className="stars" aria-label={`${r.rating} out of 5`}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </span>
                  <span className="profile-review-date">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                {r.comment && <p className="profile-review-comment">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
