import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getShop, addDrinkToShop, addReview } from '../api';
import { useAuth } from '../AuthContext';
import { getDrinkPhotoUrl } from '../drinkPhotos';
import './ShopDetail.css';

const REVIEW_DESCRIPTORS = ['bitter', 'sweet', 'smooth', 'strong', 'creamy', 'bold', 'mild', 'roasty'];

export function ShopDetail() {
  const { shopId } = useParams();
  const { user } = useAuth();
  const [shop, setShop] = useState(null);
  const [drinks, setDrinks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDrink, setShowAddDrink] = useState(false);
  const [newDrinkName, setNewDrinkName] = useState('');
  const [addDrinkError, setAddDrinkError] = useState('');
  const [addingDrink, setAddingDrink] = useState(false);
  const [reviewingDrink, setReviewingDrink] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewDescriptors, setReviewDescriptors] = useState([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [drinkSearchFilter, setDrinkSearchFilter] = useState('');
  const [showAllDrinks, setShowAllDrinks] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    getShop(shopId)
      .then((data) => {
        setShop(data.shop);
        setDrinks(data.drinks || []);
        setReviews(data.reviews || []);
      })
      .catch(() => setShop(null))
      .finally(() => setLoading(false));
  }, [shopId]);

  async function handleAddDrink(e) {
    e.preventDefault();
    if (!newDrinkName.trim()) return;
    setAddingDrink(true);
    setAddDrinkError('');
    try {
      await addDrinkToShop(parseInt(shopId, 10), newDrinkName.trim());
      const data = await getShop(shopId);
      setDrinks(data.drinks || []);
      setNewDrinkName('');
      setShowAddDrink(false);
    } catch (err) {
      setAddDrinkError(err.message || 'Failed to add drink');
    } finally {
      setAddingDrink(false);
    }
  }

  async function handleSubmitReview(drinkId) {
    if (reviewRating < 1 || reviewRating > 5) return;
    setSubmittingReview(true);
    try {
      await addReview(drinkId, reviewRating, reviewComment.trim() || undefined, reviewDescriptors);
      const data = await getShop(shopId);
      setDrinks(data.drinks || []);
      setReviews(data.reviews || []);
      setReviewingDrink(null);
      setReviewRating(0);
      setReviewComment('');
      setReviewDescriptors([]);
    } catch (err) {
      setAddDrinkError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) return <div className="shop-detail"><p className="shop-loading">Loading…</p></div>;
  if (!shop) return <div className="shop-detail"><p className="shop-error">Shop not found.</p></div>;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address || shop.name)}`;
  const allDrinks = [...drinks]
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

  return (
    <div className="shop-detail">
      <header className="shop-header">
        <h1 className="shop-name">{shop.name}</h1>
        {shop.address && <p className="shop-address">{shop.address}</p>}
        {shop.avgRating != null && (
          <div className="shop-rating">
            <span className="stars">{'★'.repeat(Math.round(shop.avgRating))}{'☆'.repeat(5 - Math.round(shop.avgRating))}</span>
            <span>{shop.avgRating}</span>
            <span className="shop-review-count">({shop.reviewCount} reviews)</span>
          </div>
        )}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="shop-map-link">
          Get Directions
        </a>
      </header>

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
                <ShopDrinkCard
                  key={d.drinkId}
                  drink={d}
                  user={user}
                  reviewingDrink={reviewingDrink}
                  setReviewingDrink={setReviewingDrink}
                  reviewRating={reviewRating}
                  setReviewRating={setReviewRating}
                  reviewComment={reviewComment}
                  setReviewComment={setReviewComment}
                  reviewDescriptors={reviewDescriptors}
                  setReviewDescriptors={setReviewDescriptors}
                  submittingReview={submittingReview}
                  onSubmitReview={handleSubmitReview}
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
                      <ShopDrinkCard
                        key={d.drinkId}
                        drink={d}
                        user={user}
                        reviewingDrink={reviewingDrink}
                        setReviewingDrink={setReviewingDrink}
                        reviewRating={reviewRating}
                        setReviewRating={setReviewRating}
                        reviewComment={reviewComment}
                        setReviewComment={setReviewComment}
                        reviewDescriptors={reviewDescriptors}
                        setReviewDescriptors={setReviewDescriptors}
                        submittingReview={submittingReview}
                        onSubmitReview={handleSubmitReview}
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
          <p className="shop-no-drinks">No drinks rated yet.</p>
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
                  placeholder="e.g. Peppermint Mocha, Oat Milk Latte"
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

      {reviews.length > 0 && (
        <section className="shop-reviews" aria-label="Recent reviews">
          <h2 className="shop-section-title">Recent reviews</h2>
          <ul className="shop-reviews-list">
            {reviews.slice(0, 10).map((r) => (
              <li key={r.id} className="shop-review-card">
                <span className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="shop-review-drink">{r.drink_name}</span>
                {r.comment && <p className="shop-review-text">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ShopDrinkCard({ drink, user, reviewingDrink, setReviewingDrink, reviewRating, setReviewRating, reviewComment, setReviewComment, reviewDescriptors, setReviewDescriptors, submittingReview, onSubmitReview }) {
  const isReviewing = reviewingDrink === drink.drinkId;
  const photoUrl = getDrinkPhotoUrl(drink.drinkType, drink.displayName);

  function toggleDescriptor(tag) {
    setReviewDescriptors((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
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
        {user && (
          <button
            type="button"
            className="shop-add-review-btn"
            onClick={() => setReviewingDrink(isReviewing ? null : drink.drinkId)}
          >
            {isReviewing ? 'Cancel' : 'Rate this drink'}
          </button>
        )}
        {isReviewing && (
          <form className="shop-review-form" onSubmit={(e) => { e.preventDefault(); onSubmitReview(drink.drinkId); }}>
            <p className="shop-review-drink-label">Rating: <strong>{drink.displayName}</strong></p>
            <div className="shop-review-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={`star-btn ${reviewRating >= n ? 'filled' : ''}`} onClick={() => setReviewRating(n)}>★</button>
              ))}
            </div>
            <div className="shop-review-descriptors">
              {REVIEW_DESCRIPTORS.map((tag) => (
                <button key={tag} type="button" className={`descriptor-btn ${reviewDescriptors.includes(tag) ? 'selected' : ''}`} onClick={() => toggleDescriptor(tag)}>
                  {tag}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Comment (optional)" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="shop-review-comment" />
            <button type="submit" className="shop-review-submit" disabled={submittingReview || reviewRating < 1}>Save</button>
          </form>
        )}
      </div>
    </li>
  );
}
