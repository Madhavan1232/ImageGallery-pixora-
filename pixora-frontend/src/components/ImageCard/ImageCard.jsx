import { useState, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { Heart, Bookmark, Download } from 'lucide-react';
import { useGallery } from '../../context/GalleryContext';

function ImageCard({ image, onClick }) {
  const { likes, bookmarks, toggleLike, toggleBookmark } = useGallery();
  const [loaded,  setLoaded]  = useState(false);
  const [imgError, setImgError] = useState(false);
  const { ref: inViewRef, inView } = useInView({ triggerOnce: true, rootMargin: '400px' });

  const idStr = String(image.id);
  const isLiked      = likes.has(idStr);
  const isBookmarked = bookmarks.has(idStr);

  const handleDownload = useCallback(async (e) => {
    e.stopPropagation();
    try {
      const link = document.createElement('a');
      link.href = image.download || image.full || image.url;
      link.download = `pixora-${image.id}.jpg`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(image.full || image.url, '_blank');
    }
  }, [image]);

  // Skip broken images silently
  if (imgError) return null;

  const aspectRatio = image.height && image.width
    ? `${image.width} / ${image.height}`
    : '4 / 3';

  return (
    <div
      ref={inViewRef}
      className={`image-card${loaded ? ' image-card--loaded' : ''}`}
      onClick={() => onClick(image)}
      role="button"
      tabIndex={0}
      aria-label={`View photo: ${image.description || 'Photo by ' + image.author}`}
      onKeyDown={e => e.key === 'Enter' && onClick(image)}
    >
      <div className="image-card__img-wrap" style={{ aspectRatio }}>
        {/* Skeleton / color swatch while loading */}
        {!loaded && (
          <div
            className="skeleton-item"
            style={{
              position: 'absolute', inset: 0,
              background: image.color || '#1a1a1a',
              borderRadius: 0,
            }}
          />
        )}

        {/* Lazy image */}
        {inView && (
          <img
            className="image-card__img"
            src={image.url || image.thumb}
            alt={image.description || `Photo by ${image.author}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setImgError(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        )}

        {/* Hover overlay */}
        <div className="image-card__overlay">
          <div className="image-card__actions">
            <button
              className={`image-card__action-btn${isLiked ? ' liked' : ''}`}
              onClick={e => { e.stopPropagation(); toggleLike(image.id, image); }}
              aria-label={isLiked ? 'Unlike' : 'Like'}
              title={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart size={15} />
            </button>
            <button
              className={`image-card__action-btn${isBookmarked ? ' bookmarked' : ''}`}
              onClick={e => { e.stopPropagation(); toggleBookmark(image.id, image); }}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              <Bookmark size={15} />
            </button>
            <button
              className="image-card__download-btn"
              onClick={handleDownload}
              aria-label="Download image"
              title="Download"
            >
              <Download size={15} />
            </button>
          </div>
          <div className="image-card__meta">
            <div className="image-card__author">{image.author}</div>
            {image.description && (
              <div className="image-card__desc">{image.description}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageCard;
