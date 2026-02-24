import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getMyReviews, updateAvatar } from '../api';
import { Avatar } from '../Avatar';
import './Profile.css';

const AVATAR_OPTIONS = [
  { id: 'cup', label: 'Coffee cup', emoji: '☕' },
  { id: 'scroll', label: 'Scroll', emoji: '📜' },
];

export function Profile() {
  const { user, logout, refreshUser } = useAuth();
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

  const [avatarSaving, setAvatarSaving] = useState(false);

  async function handleAvatarSelect(id) {
    setAvatarSaving(true);
    try {
      await updateAvatar(id);
      await refreshUser?.();
    } catch (err) {
      alert(err?.message || 'Failed to update profile picture');
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target?.files?.[0];
    if (!file || file.size > 200 * 1024) {
      alert('Choose an image under 200KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setAvatarSaving(true);
      try {
        await updateAvatar(reader.result);
        await refreshUser?.();
      } catch (err) {
        alert(err?.message || 'Failed to upload');
      } finally {
        setAvatarSaving(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <Avatar avatar={user?.avatar} size={80} className="profile-avatar" />
        <h1 className="profile-name">{user ? (user.displayName || user.email) : 'Guest'}</h1>
        <p className="profile-email">{user?.email || ' '}</p>
        {user ? (
        <>
        <div className="profile-avatar-picker">
          <p className="profile-avatar-label">Profile picture</p>
          <div className="profile-avatar-options">
            {AVATAR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`profile-avatar-opt ${(user?.avatar === opt.id || (!user?.avatar && opt.id === 'cup')) ? 'selected' : ''}`}
                onClick={() => handleAvatarSelect(opt.id)}
                disabled={avatarSaving}
                title={opt.label}
              >
                {opt.emoji}
              </button>
            ))}
            <label className="profile-avatar-opt profile-avatar-upload">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              📷
            </label>
          </div>
          <span className="profile-avatar-hint">Default: cup</span>
        </div>
        <button type="button" className="profile-logout" onClick={logout}>
          Sign out
        </button>
        </>
        ) : (
        <p className="profile-guest">Please <Link to="/login">sign in</Link> to view your profile and reviews.</p>
        )}
      </div>
      <section className="profile-reviews" aria-label="Your reviews">
        <h2 className="profile-reviews-title">Your reviews</h2>
        {!user ? (
          <p className="profile-empty">Sign in to see your reviews here.</p>
        ) : loading ? (
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
