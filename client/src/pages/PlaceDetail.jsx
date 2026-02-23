import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPlace } from '../api';
import './ShopDetail.css';

export function PlaceDetail() {
  const { placeId } = useParams();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!placeId) return;
    setLoading(true);
    setError('');
    getPlace(decodeURIComponent(placeId))
      .then((data) => setPlace(data.place))
      .catch(() => {
        setPlace(null);
        setError('Place not found');
      })
      .finally(() => setLoading(false));
  }, [placeId]);

  if (loading) return <div className="shop-detail"><p className="shop-loading">Loading…</p></div>;
  if (error || !place) return <div className="shop-detail"><p className="shop-error">{error || 'Place not found.'}</p></div>;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address || place.name)}`;
  const placeMapsUrl = place.placeId
    ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
    : mapsUrl;

  return (
    <div className="shop-detail">
      <header className="shop-header">
        <h1 className="shop-name">{place.name}</h1>
        <p className="shop-address">{place.address}</p>
        {(place.avgRating != null || place.reviewCount) && (
          <div className="shop-rating">
            {place.avgRating != null && (
              <>
                <span className="stars">{'★'.repeat(Math.round(place.avgRating))}{'☆'.repeat(5 - Math.round(place.avgRating))}</span>
                <span>{place.avgRating}</span>
              </>
            )}
            {place.reviewCount != null && place.reviewCount > 0 && (
              <span className="shop-review-count">({place.reviewCount} Google reviews)</span>
            )}
          </div>
        )}
        <a
          href={placeMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shop-map-link"
        >
          Open in Google Maps
        </a>
      </header>

      {place.photos && place.photos.length > 0 && (
        <section className="place-photos" aria-label="Photos">
          <h2 className="shop-section-title">Photos</h2>
          <div className="place-photos-grid">
            {place.photos.map((photoUrl, i) => (
              <a
                key={i}
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="place-photo-wrap"
              >
                <img src={photoUrl} alt="" className="place-photo" loading={i < 4 ? 'eager' : 'lazy'} />
              </a>
            ))}
          </div>
          <p className="place-photos-hint">Interior, menu, and more from Google Maps</p>
        </section>
      )}
    </div>
  );
}
