import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getPlace, addPlaceReview, addPlaceDrink, addPlaceDrinkReview } from '../api';
import { saveReviewDraft, loadReviewDraft } from '../reviewDraft';
import { useAuth } from '../AuthContext';
import { getDrinkPhotoUrl } from '../drinkPhotos';
import { StarRating } from '../StarRating';
import './ShopDetail.css';

const REVIEW_DESCRIPTORS = ['bitter', 'sweet', 'smooth', 'strong', 'creamy', 'bold', 'mild', 'roasty'];
const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB

function AddPhotoButton({ onPhotoSelected }) {
  const inputRef = useRef(null);
  function handleChange(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) {
      alert('Photo must be under 2MB. Please choose a smaller image.');
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
  const [drinkSearchFilter, setDrinkSearchFilter] = useState('');
  const [showAllDrinks, setShowAllDrinks] = useState(false);
  const [expandedDrinkReviewsId, setExpandedDrinkReviewsId] = useState(null);
  const [showRateDrinkForm, setShowRateDrinkForm] = useState(false);
  const [rateDrinkSelectedId, setRateDrinkSelectedId] = useState('');
  const [rateDrinkNewName, setRateDrinkNewName] = useState('');
  const [rateDrinkRating, setRateDrinkRating] = useState(0);
  const [rateDrinkComment, setRateDrinkComment] = useState('');
  const [rateDrinkDescriptors, setRateDrinkDescriptors] = useState([]);
  const [rateDrinkPhoto, setRateDrinkPhoto] = useState(null);
  const [submittingRateDrink, setSubmittingRateDrink] = useState(false);
  const [rateDrinkError, setRateDrinkError] = useState('');

  function refresh() {
    if (!decodedId) return;
    getPlace(decodedId).then((data) => setPlace(data.place)).catch(() => setPlace(null));
  }

  useEffect(() => {
    if (!placeId || !decodedId) return;
    const draft = loadReviewDraft(decodedId);
    if (draft && user && draft.type === 'drink' && draft.drinkId) {
      setReviewingDrinkId(draft.drinkId);
      setDrinkReviewRating(draft.rating || 0);
      setDrinkReviewComment(draft.comment || '');
      setDrinkReviewDescriptors(draft.descriptors || []);
      setDrinkReviewPhoto(draft.photo || null);
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
    setAddDrinkError('');
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

  async function handleSubmitRateDrink(e) {
    e.preventDefault();
    if (!user) return;
    setRateDrinkError('');
    let drinkId = null;
    const isAddingNew = rateDrinkSelectedId === '__add__';
    if (isAddingNew) {
      if (!rateDrinkNewName.trim() || rateDrinkNewName.trim().length < 2) {
        setRateDrinkError('Enter a drink name (min 2 characters)');
        return;
      }
      setSubmittingRateDrink(true);
      try {
        const { drink } = await addPlaceDrink(decodedId, rateDrinkNewName.trim());
        drinkId = drink?.id;
        if (!drinkId) throw new Error('Failed to add drink');
      } catch (err) {
        setRateDrinkError(err.message || 'Failed to add drink');
        setSubmittingRateDrink(false);
        return;
      }
    } else {
      drinkId = rateDrinkSelectedId ? parseInt(rateDrinkSelectedId, 10) : null;
    }
    if (!drinkId || rateDrinkRating < 1 || rateDrinkRating > 5) {
      setRateDrinkError('Select a drink and give a rating (1–5 stars)');
      setSubmittingRateDrink(false);
      return;
    }
    setSubmittingRateDrink(true);
    try {
      await addPlaceDrinkReview(decodedId, drinkId, rateDrinkRating, rateDrinkComment.trim() || undefined, rateDrinkDescriptors, rateDrinkPhoto);
      refresh();
      setShowRateDrinkForm(false);
      setRateDrinkSelectedId('');
      setRateDrinkNewName('');
      setRateDrinkRating(0);
      setRateDrinkComment('');
      setRateDrinkDescriptors([]);
      setRateDrinkPhoto(null);
      try { sessionStorage.removeItem('beanverdict_review_draft'); } catch (_) {}
    } catch (err) {
      setRateDrinkError(err.message);
    } finally {
      setSubmittingRateDrink(false);
    }
  }

  function toggleRateDrinkDescriptor(tag) {
    setRateDrinkDescriptors((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  if (loading) return <div className="shop-detail"><p className="shop-loading">Loading…</p></div>;
  if (error || !place) return <div className="shop-detail"><p className="shop-error">{error || 'Place not found.'}</p></div>;

  const placeMapsUrl = place.placeId && !place.placeId.startsWith('osm-') && !place.placeId.startsWith('fsq-')
    ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address || place.name)}`;

  const allDrinks = (place.placeDrinks || [])
    .sort((a, b) => {
      const seasonal = (b.isSeasonal ? 1 : 0) - (a.isSeasonal ? 1 : 0);
      if (seasonal !== 0) return seasonal;
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0) || (b.avgRating ?? 0) - (a.avgRating ?? 0);
    });
  const drinkFilter = (drinkSearchFilter || '').trim().toLowerCase();
  const filteredDrinks = drinkFilter
    ? allDrinks.filter((d) => (d.displayName || '').toLowerCase().includes(drinkFilter) || (d.drinkType || '').toLowerCase().includes(drinkFilter))
    : allDrinks;
  const TOP_COUNT = 6;
  const topDrinks = filteredDrinks.slice(0, TOP_COUNT);
  const restDrinks = filteredDrinks.slice(TOP_COUNT);

  const googlePhotos = place.photos || [];
  const userPhotos = [
    ...(place.userReviews || []).filter((r) => r.photo).map((r) => r.photo),
    ...(place.placeDrinks || []).flatMap((d) => (d.reviews || []).filter((r) => r.photo).map((r) => r.photo)),
  ];
  const allPlacePhotos = [...googlePhotos, ...userPhotos];
  const heroPhoto = allPlacePhotos[0] || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=450&fit=crop';
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

      {/* Photos - Google + user uploads (like Google Reviews) */}
      {allPlacePhotos.length > 0 && (
        <section className="place-photos" aria-label="Photos">
          <h2 className="shop-section-title">Photos</h2>
          <div className="place-photos-grid">
            {allPlacePhotos.map((photoUrl, i) => (
              <a key={i} href={photoUrl} target="_blank" rel="noopener noreferrer" className="place-photo-wrap">
                <img src={photoUrl} alt="" className="place-photo" loading={i < 4 ? 'eager' : 'lazy'} />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Menu / drink ratings */}
      <section className="shop-drinks" aria-label="Menu">
        <h2 className="shop-section-title">Menu & drink ratings</h2>
        {allDrinks.length > 0 && (
          <div className="shop-drink-search-wrap">
            <input
              type="search"
              placeholder="Search drinks from this coffee shop"
              value={drinkSearchFilter}
              onChange={(e) => setDrinkSearchFilter(e.target.value)}
              className="shop-drink-search"
              aria-label="Search drinks at this shop"
            />
          </div>
        )}
        {filteredDrinks.length > 0 ? (
          <>
          <ul className="shop-drinks-list shop-drinks-list--with-photos">
              {topDrinks.map((d) => (
                <DrinkCard
                  key={d.id}
                  drink={d}
                  user={user}
                  placeId={decodedId}
                  addDrinkError={addDrinkError}
                  setAddDrinkError={setAddDrinkError}
                  expandedDrinkReviewsId={expandedDrinkReviewsId}
                  setExpandedDrinkReviewsId={setExpandedDrinkReviewsId}
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
            {restDrinks.length > 0 && (
              <div className="shop-see-more">
                <button
                  type="button"
                  className="shop-see-more-btn"
                  onClick={() => setShowAllDrinks(!showAllDrinks)}
                  aria-expanded={showAllDrinks}
                >
                  {showAllDrinks ? 'See less' : `See more (${restDrinks.length})`}
                </button>
                {showAllDrinks && (
                  <ul className="shop-drinks-list shop-drinks-list--with-photos shop-drinks-list--expanded">
                    {restDrinks.map((d) => (
                      <DrinkCard
                        key={d.id}
                        drink={d}
                        user={user}
                        placeId={decodedId}
                        addDrinkError={addDrinkError}
                        setAddDrinkError={setAddDrinkError}
                        expandedDrinkReviewsId={expandedDrinkReviewsId}
                        setExpandedDrinkReviewsId={setExpandedDrinkReviewsId}
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
                )}
              </div>
            )}
          </>
        ) : allDrinks.length > 0 ? (
          <p className="shop-no-drinks">No drinks match &ldquo;{drinkSearchFilter}&rdquo;</p>
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

      {/* Rate a drink - single form at bottom */}
      <section className="shop-rate-drink" aria-label="Rate a drink">
        <h2 className="shop-section-title">Rate a drink</h2>
        {!user ? (
          <p className="shop-rate-drink-signin">Sign in to rate a drink at this coffee shop.</p>
        ) : !showRateDrinkForm ? (
          <button type="button" className="shop-add-drink-btn shop-rate-drink-btn" onClick={() => setShowRateDrinkForm(true)}>
            Rate a drink
          </button>
        ) : (
          <form className="shop-rate-drink-form shop-review-form" onSubmit={handleSubmitRateDrink}>
            {rateDrinkError && <p className="shop-error">{rateDrinkError}</p>}
            <label className="shop-review-drink-label">Type of drink</label>
            <select
              value={rateDrinkSelectedId}
              onChange={(e) => { setRateDrinkSelectedId(e.target.value); setRateDrinkError(''); }}
              className="shop-rate-drink-select"
              required
            >
              <option value="">— Select a drink —</option>
              {(place.placeDrinks || []).map((d) => (
                <option key={d.id} value={d.id}>{d.displayName || d.drinkType}</option>
              ))}
              <option value="__add__">+ Add a drink</option>
            </select>
            {rateDrinkSelectedId === '__add__' && (
              <input
                type="text"
                placeholder="e.g. Latte, Gingerbread Spice Frappuccino"
                value={rateDrinkNewName}
                onChange={(e) => setRateDrinkNewName(e.target.value)}
                className="shop-add-drink-input shop-rate-drink-new-input"
              />
            )}
            <p className="shop-review-drink-label">Your rating for this drink</p>
            <StarRating value={rateDrinkRating} onChange={setRateDrinkRating} />
            <div className="shop-review-descriptors">
              {REVIEW_DESCRIPTORS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`descriptor-btn ${rateDrinkDescriptors.includes(tag) ? 'selected' : ''}`}
                  onClick={() => toggleRateDrinkDescriptor(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Comment (optional)" value={rateDrinkComment} onChange={(e) => setRateDrinkComment(e.target.value)} className="shop-review-comment" maxLength={500} />
            <div className="review-photo-row">
              <AddPhotoButton onPhotoSelected={setRateDrinkPhoto} />
              {rateDrinkPhoto && (
                <div className="review-photo-preview">
                  <img src={rateDrinkPhoto} alt="Your photo" />
                  <button type="button" className="remove-photo-btn" onClick={() => setRateDrinkPhoto(null)}>Remove</button>
                </div>
              )}
            </div>
            <div className="shop-rate-drink-actions">
              <button type="submit" className="shop-review-submit" disabled={submittingRateDrink || rateDrinkRating < 1}>
                Save
              </button>
              <button type="button" className="shop-add-drink-cancel" onClick={() => { setShowRateDrinkForm(false); setRateDrinkSelectedId(''); setRateDrinkNewName(''); setRateDrinkRating(0); setRateDrinkComment(''); setRateDrinkDescriptors([]); setRateDrinkPhoto(null); setRateDrinkError(''); }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

    </div>
  );
}

function DrinkCard({ drink, user, placeId, addDrinkError, setAddDrinkError, expandedDrinkReviewsId, setExpandedDrinkReviewsId, navigate, reviewingDrinkId, setReviewingDrinkId, drinkReviewRating, setDrinkReviewRating, drinkReviewComment, setDrinkReviewComment, drinkReviewDescriptors, setDrinkReviewDescriptors, drinkReviewPhoto, setDrinkReviewPhoto, drinkReviewInteracted, setDrinkReviewInteracted, submittingDrinkReview, onSubmitReview }) {
  const isReviewing = reviewingDrinkId === drink.id;
  const showAllReviews = expandedDrinkReviewsId === drink.id;
  const cardRef = useRef(null);
  const photoUrl = getDrinkPhotoUrl(drink.drinkType, drink.displayName);

  function handleReviewsClick() {
    setExpandedDrinkReviewsId((prev) => (prev === drink.id ? null : drink.id));
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }

  function toggleDescriptor(tag) {
    setDrinkReviewDescriptors((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <li ref={cardRef} id={`drink-${drink.id}`} className="shop-drink-card shop-drink-card--with-photo">
      <img src={photoUrl} alt="" className="shop-drink-photo" />
      <div className="shop-drink-content">
        <div className="shop-drink-name">{drink.displayName}</div>
        <div className="shop-drink-meta">
          {drink.avgRating != null ? (
            <span className="stars">{'★'.repeat(Math.round(drink.avgRating))}{'☆'.repeat(5 - Math.round(drink.avgRating))} {drink.avgRating}{' '}
              <button type="button" className="shop-drink-reviews-link" onClick={handleReviewsClick} aria-label={`View ${drink.reviewCount} reviews for ${drink.displayName}`}>
                ({drink.reviewCount} reviews)
              </button>
            </span>
          ) : (
            <span className="no-reviews">No reviews yet</span>
          )}
        </div>
        {drink.reviews && drink.reviews.length > 0 && (
          <div className="shop-drink-reviews-preview">
            {(showAllReviews ? drink.reviews : drink.reviews.slice(0, 2)).map((r, i) => (
              <div key={i} className="shop-drink-review-preview">
                <StarRating value={r.rating} readonly size="1rem" />
                {r.descriptors?.length > 0 && (
                  <span className="review-descriptors"> {r.descriptors.join(', ')}</span>
                )}
                {r.photo && <img src={r.photo} alt="" className="review-photo-display review-photo-display--sm" />}
                {r.comment && <span className="review-preview-text"> – {r.comment.slice(0, 60)}{r.comment.length > 60 ? '…' : ''}</span>}
              </div>
            ))}
            {drink.reviews.length > 2 && !showAllReviews && (
              <button type="button" className="shop-drink-reviews-link shop-drink-reviews-more" onClick={handleReviewsClick}>
                View all {drink.reviewCount} reviews
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          className="shop-add-review-btn"
          onClick={() => { setReviewingDrinkId(isReviewing ? null : drink.id); if (isReviewing) setDrinkReviewInteracted(false); setAddDrinkError(''); }}
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
            {addDrinkError && <p className="shop-error">{addDrinkError}</p>}
            <p className="shop-review-drink-label">Rating: <strong>{drink.displayName}</strong></p>
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
