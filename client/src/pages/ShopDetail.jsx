import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getShop, addDrinkToShop, addReview } from '../api';
import { useAuth } from '../AuthContext';
import './ShopDetail.css';

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
  const [submittingReview, setSubmittingReview] = useState(false);

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
      await addReview(drinkId, reviewRating, reviewComment.trim() || undefined);
      const data = await getShop(shopId);
      setDrinks(data.drinks || []);
      setReviews(data.reviews || []);
      setReviewingDrink(null);
      setReviewRating(0);
      setReviewComment('');
    } catch (err) {
      setAddDrinkError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) return <div className="shop-detail"><p className="shop-loading">Loading…</p></div>;
  if (!shop) return <div className="shop-detail"><p className="shop-error">Shop not found.</p></div>;

  return (
    <div className="shop-detail">
      <header className="shop-header">
        <h1 className="shop-name">{shop.name}</h1>
        <p className="shop-address">{shop.address}</p>
        {shop.avgRating != null && (
          <div className="shop-rating">
            <span className="stars">{'★'.repeat(Math.round(shop.avgRating))}{'☆'.repeat(5 - Math.round(shop.avgRating))}</span>
            <span>{shop.avgRating}</span>
            <span className="shop-review-count">({shop.reviewCount} reviews)</span>
          </div>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address || shop.name)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shop-map-link"
        >
          Open in Maps
        </a>
      </header>

      <section className="shop-drinks" aria-label="Drinks">
        <h2 className="shop-section-title">Drinks</h2>
        <ul className="shop-drinks-list">
          {drinks.map((d) => (
            <li key={d.drinkId} className="shop-drink-card">
              <div className="shop-drink-name">{d.displayName}</div>
              <div className="shop-drink-meta">
                {d.avgRating != null ? (
                  <span className="stars">{'★'.repeat(Math.round(d.avgRating))}{'☆'.repeat(5 - Math.round(d.avgRating))} {d.avgRating} ({d.reviewCount})</span>
                ) : (
                  <span className="no-reviews">No reviews yet</span>
                )}
              </div>
              {user && (
                <button
                  type="button"
                  className="shop-add-review-btn"
                  onClick={() => setReviewingDrink(reviewingDrink === d.drinkId ? null : d.drinkId)}
                >
                  {reviewingDrink === d.drinkId ? 'Cancel' : 'Add review'}
                </button>
              )}
              {reviewingDrink === d.drinkId && (
                <form className="shop-review-form" onSubmit={(e) => { e.preventDefault(); handleSubmitReview(d.drinkId); }}>
                  <div className="shop-review-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" className={`star-btn ${reviewRating >= n ? 'filled' : ''}`} onClick={() => setReviewRating(n)}>★</button>
                    ))}
                  </div>
                  <input type="text" placeholder="Comment (optional)" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="shop-review-comment" />
                  <button type="submit" className="shop-review-submit" disabled={submittingReview || reviewRating < 1}>Save</button>
                </form>
              )}
            </li>
          ))}
        </ul>
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
                  placeholder="e.g. Oat Milk Latte"
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
        <section className="shop-reviews" aria-label="Reviews">
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
