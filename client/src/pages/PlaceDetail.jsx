import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getPlace, addPlaceReview, addPlaceDrink, addPlaceDrinkReview } from '../api';
import { saveReviewDraft, loadReviewDraft } from '../reviewDraft';
import { useAuth } from '../AuthContext';
import { getDrinkPhotoUrl } from '../drinkPhotos';
import { StarRating } from '../StarRating';
import './ShopDetail.css';

const REVIEW_DESCRIPTORS = ['bitter', 'sweet', 'smooth', 'strong', 'creamy', 'bold', 'mild', 'roasty'];
const MAX_PHOTO_SIZE = 500 * 1024; // 500KB

function AddPhotoButton({ onPhotoSelected }) {
  const inputRef = useRef(null);
  function handleChange(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) {
      alert('Photo must be under 500KB. Please choose a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onPhotoSelected(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }
  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="review-photo-input" />
      <button type="button" className="add-photo-btn" onClick={() => inputRef.current?.click()}>
        Add photo
      </button>
    </>
  );
}

export function PlaceDetail() {
  const { placeId } = useParams();
  const { state: locationState } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const decodedId = placeId ? decodeURIComponent(placeId) : '';
  const searchResult = locationState?.searchResult;
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState(null);
  const [reviewInteracted, setReviewInteracted] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [addReviewError, setAddReviewError] = useState('');
  const [showAddDrink, setShowAddDrink] = useState(false);
  const [newDrinkName, setNewDrinkName] = useState('');
  const [addDrinkError, setAddDrinkError] = useState('');
  const [addingDrink, setAddingDrink] = useState(false);
  const [reviewingDrinkId, setReviewingDrinkId] = useState(null);
  const [drinkReviewRating, setDrinkReviewRating] = useState(0);
  const [drinkReviewComment, setDrinkReviewComment] = useState('');
  const [drinkReviewDescriptors, setDrinkReviewDescriptors] = useState([]);
  const [drinkReviewPhoto, setDrinkReviewPhoto] = useState(null);
  const [drinkReviewInteracted, setDrinkReviewInteracted] = useState(false);
  const [submittingDrinkReview, setSubmittingDrinkReview] = useState(false);

  function refresh() {
    if (!decodedId) return;
    getPlace(decodedId).then((data) => setPlace(data.place)).catch(() => setPlace(null));
  }

  useEffect(() => {
    if (!placeId || !decodedId) return;
    const draft = loadReviewDraft(decodedId);
    if (draft && user) {
      if (draft.type === 'place') {
        setShowReviewForm(true);
        setReviewRating(draft.rating || 0);
        setReviewComment(draft.comment || '');
        setReviewPhoto(draft.photo || null);
      } else if (draft.type === 'drink' && draft.drinkId) {
        setReviewingDrinkId(draft.drinkId);
        setDrinkReviewRating(draft.rating || 0);
        setDrinkReviewComment(draft.comment || '');
        setDrinkReviewDescriptors(draft.descriptors || []);
        setDrinkReviewPhoto(draft.photo || null);
      }
    }
  }, [decodedId, user]);

  useEffect(() => {
    if (!placeId) return;
    setLoading(true);
    setError('');
    getPlace(decodedId)
      .then((data) => setPlace(data.place))
      .catch(() => {
        if (searchResult && searchResult.placeId === decodedId) {
          setPlace({
            placeId: searchResult.placeId,
            name: searchResult.name,
            address: searchResult.address || '',
            avgRating: searchResult.avgRating,
            reviewCount: searchResult.reviewCount || 0,
            source: searchResult.source || 'osm',
            photos: [],
            reviews: [],
            placeDrinks: [],
            userReviews: [],
          });
          setError('');
        } else {
          setPlace(null);
          setError('Place not found');
        }
      })
      .finally(() => setLoading(false));
  }, [placeId, decodedId]);

  async function handleSubmitPlaceReview(e) {
    e?.preventDefault();
    if (!user) return;
    if (reviewRating < 1 || reviewRating > 5) return;
    setSubmittingReview(true);
    setAddReviewError('');
    try {
      await addPlaceReview(decodedId, reviewRating, reviewComment.trim() || undefined, reviewPhoto);
      refresh();
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment('');
      setReviewPhoto(null);
      setReviewInteracted(false);
      try { sessionStorage.removeItem('beanverdict_review_draft'); } catch (_) {}
    } catch (err) {
      setAddReviewError(err.message || 'Failed to add review');
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleAddDrink(e) {
    e.preventDefault();
    if (!newDrinkName.trim()) return;
    setAddingDrink(true);
    setAddDrinkError('');
    try {
      const { drink } = await addPlaceDrink(decodedId, newDrinkName.trim());
      await refresh();
      setNewDrinkName('');
      setShowAddDrink(false);
      if (drink?.id && user) setReviewingDrinkId(drink.id);
    } catch (err) {
      setAddDrinkError(err.message || 'Failed to add drink');
    } finally {
      setAddingDrink(false);
    }
  }

  async function handleSubmitDrinkReview(drinkId) {
    if (!user) return;
    if (drinkReviewRating < 1 || drinkReviewRating > 5) return;
    setSubmittingDrinkReview(true);
    try {
      await addPlaceDrinkReview(decodedId, drinkId, drinkReviewRating, drinkReviewComment.trim() || undefined, drinkReviewDescriptors, drinkReviewPhoto);
      refresh();
      setReviewingDrinkId(null);
      setDrinkReviewRating(0);
      setDrinkReviewComment('');
      setDrinkReviewDescriptors([]);
      setDrinkReviewPhoto(null);
      setDrinkReviewInteracted(false);
      try { sessionStorage.removeItem('beanverdict_review_draft'); } catch (_) {}
    } catch (err) {
      setAddDrinkError(err.message);
    } finally {
      setSubmittingDrinkReview(false);
    }
  }

  if (loading) return <div className="shop-detail"><p className="shop-loading">Loading…</p></div>;
  if (error || !place) return <div className="shop-detail"><p className="shop-error">{error || 'Place not found.'}</p></div>;

  const placeMapsUrl = place.placeId && !place.placeId.startsWith('osm-') && !place.placeId.startsWith('fsq-')
    ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address || place.name)}`;

  const allDrinks = (place.placeDrinks || [])
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  const topDrinks = allDrinks.slice(0, 5);

  const heroPhoto = place.photos?.[0] || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=450&fit=crop';
  const reviewSnippet = (place.reviews?.[0] || place.userReviews?.[0]);
  const categories = ['Coffee Shop', 'Cafe'];

  return (
    <div className="shop-detail place-detail place-detail--yelp">
      <div className="place-hero">
        <img src={heroPhoto} alt="" className="place-hero-img" />
      </div>
      <header className="shop-header">
        <h1 className="shop-name">{place.name}</h1>
        <div className="shop-meta-row shop-meta-row--rating">
          {(place.avgRating != null || place.reviewCount) && (
            <div className="shop-rating shop-rating--inline">
              {place.avgRating != null && (
                <>
                  <span className="stars">{'★'.repeat(Math.round(place.avgRating))}{'☆'.repeat(5 - Math.round(place.avgRating))}</span>
                  <span className="shop-rating-value">{place.avgRating}</span>
                </>
              )}
              {place.reviewCount != null && place.reviewCount > 0 && (
                <span className="shop-review-count">({place.reviewCount} {place.source === 'osm' ? 'reviews' : place.source === 'foursquare' ? 'Foursquare reviews' : 'Google reviews'})</span>
              )}
            </div>
          )}
          {place.priceLevel && <span className="shop-price">{place.priceLevel}</span>}
        </div>
        {categories.length > 0 && (
          <div className="place-tags">
            {categories.map((c) => (
              <span key={c} className="place-tag">{c}</span>
            ))}
          </div>
        )}
        {place.address && <p className="shop-address">{place.address}</p>}
        {reviewSnippet && (reviewSnippet.text || reviewSnippet.comment) && (
          <div className="place-review-snippet">
            <span className="place-review-snippet-icon" aria-hidden>❝</span>
            <span className="place-review-snippet-text">
              {((reviewSnippet.text || reviewSnippet.comment || '').slice(0, 150))}
              {((reviewSnippet.text || reviewSnippet.comment || '').length > 150 ? '...' : '')}
            </span>
          </div>
        )}
        <a href={placeMapsUrl} target="_blank" rel="noopener noreferrer" className="shop-map-link">
          Get Directions
        </a>
      </header>

      {/* Photos from Google - real location images */}
      {place.photos && place.photos.length > 0 && (
        <section className="place-photos" aria-label="Photos">
          <h2 className="shop-section-title">Photos</h2>
          <div className="place-photos-grid">
            {place.photos.map((photoUrl, i) => (
              <a key={i} href={photoUrl} target="_blank" rel="noopener noreferrer" className="place-photo-wrap">
                <img src={photoUrl} alt="" className="place-photo" loading={i < 4 ? 'eager' : 'lazy'} />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Menu / drink ratings - overall in header; show only top few drinks here */}
      <section className="shop-drinks" aria-label="Menu">
        <h2 className="shop-section-title">Menu & drink ratings</h2>
        {topDrinks.length > 0 ? (
          <>
            <h3 className="shop-drinks-subtitle">Top rated</h3>
            <ul className="shop-drinks-list shop-drinks-list--with-photos">
              {topDrinks.map((d) => (
                <DrinkCard
                  key={d.id}
                  drink={d}
                  user={user}
                  placeId={decodedId}
                  navigate={navigate}
                  reviewingDrinkId={reviewingDrinkId}
                  setReviewingDrinkId={setReviewingDrinkId}
                  drinkReviewRating={drinkReviewRating}
                  setDrinkReviewRating={setDrinkReviewRating}
                  drinkReviewComment={drinkReviewComment}
                  setDrinkReviewComment={setDrinkReviewComment}
                  drinkReviewDescriptors={drinkReviewDescriptors}
                  setDrinkReviewDescriptors={setDrinkReviewDescriptors}
                  drinkReviewPhoto={drinkReviewPhoto}
                  setDrinkReviewPhoto={setDrinkReviewPhoto}
                  drinkReviewInteracted={drinkReviewInteracted}
                  setDrinkReviewInteracted={setDrinkReviewInteracted}
                  submittingDrinkReview={submittingDrinkReview}
                  onSubmitReview={handleSubmitDrinkReview}
                />
              ))}
            </ul>
          </>
        ) : (
          <p className="shop-no-drinks">No drinks rated yet. Add one below!</p>
        )}
        {user && (
          <div className="shop-add-drink">
            {!showAddDrink ? (
              <button type="button" className="shop-add-drink-btn" onClick={() => setShowAddDrink(true)}>
                + Add a drink
              </button>
            ) : (
              <form onSubmit={handleAddDrink} className="shop-add-drink-form">
                {addDrinkError && <p className="shop-error">{addDrinkError}</p>}
                <input
                  type="text"
                  placeholder="e.g. Latte, Gingerbread Spice Frappuccino"
                  value={newDrinkName}
                  onChange={(e) => setNewDrinkName(e.target.value)}
                  className="shop-add-drink-input"
                />
                <div className="shop-add-drink-actions">
                  <button type="submit" className="shop-add-drink-submit" disabled={addingDrink || newDrinkName.trim().length < 2}>
                    Add
                  </button>
                  <button type="button" className="shop-add-drink-cancel" onClick={() => { setShowAddDrink(false); setNewDrinkName(''); setAddDrinkError(''); }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {/* Hours & website (Yelp-like) */}
      {(place.openingHours?.length > 0 || place.website) && (
        <section className="place-info" aria-label="Info">
          <h2 className="shop-section-title">Info</h2>
          {place.openingHours?.length > 0 && (
            <ul className="place-hours">
              {place.openingHours.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
          {place.website && (
            <a href={place.website} target="_blank" rel="noopener noreferrer" className="place-website">
              Website
            </a>
          )}
        </section>
      )}

      {/* Reviews from Google */}
      {place.reviews && place.reviews.length > 0 && (
        <section className="shop-reviews" aria-label="Reviews from Google">
          <h2 className="shop-section-title">Reviews from Google</h2>
          <ul className="shop-reviews-list">
            {place.reviews.map((r, i) => (
              <li key={`g-${i}`} className="shop-review-card">
                <span className="stars">{'★'.repeat(r.rating || 0)}{'☆'.repeat(5 - (r.rating || 0))}</span>
                <span className="shop-review-author">{r.author}</span>
                {r.time && <span className="shop-review-time">{r.time}</span>}
                {r.text && <p className="shop-review-text">{r.text}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* User place reviews */}
      {place.userReviews && place.userReviews.length > 0 && (
        <section className="shop-reviews" aria-label="User reviews">
          <h2 className="shop-section-title">User reviews</h2>
          <ul className="shop-reviews-list">
            {place.userReviews.map((r) => (
              <li key={r.id} className="shop-review-card">
                <span className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="shop-review-author">{r.author}</span>
                {r.photo && <img src={r.photo} alt="" className="review-photo-display" />}
                {r.comment && <p className="shop-review-text">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Add place review */}
      <section className="shop-add-review" aria-label="Add your review">
        <h2 className="shop-section-title">Add your review</h2>
        {!showReviewForm ? (
          <button type="button" className="shop-add-review-btn" onClick={() => setShowReviewForm(true)}>
            Write a review
          </button>
        ) : (
          <form className="shop-review-form" onSubmit={handleSubmitPlaceReview}>
            {!user && reviewInteracted && (
              <div className="login-reminder">
                <button
                  type="button"
                  className="login-reminder-link"
                  onClick={() => {
                    saveReviewDraft(decodedId, { type: 'place', rating: reviewRating, comment: reviewComment, photo: reviewPhoto });
                    navigate(`/login?redirect=${encodeURIComponent(`/place/${encodeURIComponent(placeId)}`)}`);
                  }}
                >
                  Sign in
                </button>
                {' '}to leave a review.
              </div>
            )}
            {addReviewError && <p className="shop-error">{addReviewError}</p>}
            <StarRating value={reviewRating} onChange={(n) => { setReviewRating(n); if (!user) setReviewInteracted(true); }} />
            <input type="text" placeholder="Comment (optional)" value={reviewComment} onChange={(e) => { setReviewComment(e.target.value); if (!user && e.target.value) setReviewInteracted(true); }} className="shop-review-comment" />
            <div className="review-photo-row">
              <AddPhotoButton onPhotoSelected={setReviewPhoto} />
              {reviewPhoto && (
                <div className="review-photo-preview">
                  <img src={reviewPhoto} alt="Your photo" />
                  <button type="button" className="remove-photo-btn" onClick={() => setReviewPhoto(null)}>Remove</button>
                </div>
              )}
            </div>
            <button type="submit" className="shop-review-submit" disabled={submittingReview || reviewRating < 1 || !user}>Save</button>
            <button type="button" className="shop-add-drink-cancel" onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewComment(''); setReviewPhoto(null); setReviewInteracted(false); setAddReviewError(''); }}>Cancel</button>
          </form>
        )}
      </section>
    </div>
  );
}

function DrinkCard({ drink, user, placeId, navigate, reviewingDrinkId, setReviewingDrinkId, drinkReviewRating, setDrinkReviewRating, drinkReviewComment, setDrinkReviewComment, drinkReviewDescriptors, setDrinkReviewDescriptors, drinkReviewPhoto, setDrinkReviewPhoto, drinkReviewInteracted, setDrinkReviewInteracted, submittingDrinkReview, onSubmitReview }) {
  const isReviewing = reviewingDrinkId === drink.id;
  const photoUrl = getDrinkPhotoUrl(drink.drinkType, drink.displayName);

  function toggleDescriptor(tag) {
    setDrinkReviewDescriptors((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <li className="shop-drink-card shop-drink-card--with-photo">
      <img src={photoUrl} alt="" className="shop-drink-photo" />
      <div className="shop-drink-content">
        <div className="shop-drink-name">{drink.displayName}</div>
        <div className="shop-drink-meta">
          {drink.avgRating != null ? (
            <span className="stars">{'★'.repeat(Math.round(drink.avgRating))}{'☆'.repeat(5 - Math.round(drink.avgRating))} {drink.avgRating} ({drink.reviewCount} reviews)</span>
          ) : (
            <span className="no-reviews">No reviews yet</span>
          )}
        </div>
        {drink.reviews && drink.reviews.length > 0 && (
          <div className="shop-drink-reviews-preview">
            {drink.reviews.slice(0, 2).map((r, i) => (
              <div key={i} className="shop-drink-review-preview">
                <StarRating value={r.rating} readonly size="1rem" />
                {r.descriptors?.length > 0 && (
                  <span className="review-descriptors"> {r.descriptors.join(', ')}</span>
                )}
                {r.photo && <img src={r.photo} alt="" className="review-photo-display review-photo-display--sm" />}
                {r.comment && <span className="review-preview-text"> – {r.comment.slice(0, 60)}{r.comment.length > 60 ? '…' : ''}</span>}
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="shop-add-review-btn"
          onClick={() => { setReviewingDrinkId(isReviewing ? null : drink.id); if (isReviewing) setDrinkReviewInteracted(false); }}
        >
          {isReviewing ? 'Cancel' : 'Rate this drink'}
        </button>
        {isReviewing && (
          <form className="shop-review-form" onSubmit={(e) => { e.preventDefault(); onSubmitReview(drink.id); }}>
            {!user && drinkReviewInteracted && (
              <div className="login-reminder">
                <button
                  type="button"
                  className="login-reminder-link"
                  onClick={() => {
                    saveReviewDraft(placeId, { type: 'drink', drinkId: drink.id, rating: drinkReviewRating, comment: drinkReviewComment, descriptors: drinkReviewDescriptors, photo: drinkReviewPhoto });
                    navigate(`/login?redirect=${encodeURIComponent(`/place/${encodeURIComponent(placeId || '')}`)}`);
                  }}
                >
                  Sign in
                </button>
                {' '}to leave a review.
              </div>
            )}
            <StarRating value={drinkReviewRating} onChange={(n) => { setDrinkReviewRating(n); if (!user) setDrinkReviewInteracted(true); }} />
            <div className="shop-review-descriptors">
              {REVIEW_DESCRIPTORS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`descriptor-btn ${drinkReviewDescriptors.includes(tag) ? 'selected' : ''}`}
                  onClick={() => { toggleDescriptor(tag); if (!user) setDrinkReviewInteracted(true); }}
                >
                  {tag}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Comment (optional)" value={drinkReviewComment} onChange={(e) => { setDrinkReviewComment(e.target.value); if (!user && e.target.value) setDrinkReviewInteracted(true); }} className="shop-review-comment" maxLength={500} />
            <div className="review-photo-row">
              <AddPhotoButton onPhotoSelected={setDrinkReviewPhoto} />
              {drinkReviewPhoto && (
                <div className="review-photo-preview">
                  <img src={drinkReviewPhoto} alt="Your photo" />
                  <button type="button" className="remove-photo-btn" onClick={() => setDrinkReviewPhoto(null)}>Remove</button>
                </div>
              )}
            </div>
            <button type="submit" className="shop-review-submit" disabled={submittingDrinkReview || drinkReviewRating < 1 || !user}>Save</button>
          </form>
        )}
      </div>
    </li>
  );
}
