import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { X, Heart, Bookmark, Download, ExternalLink, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGallery } from '../../context/GalleryContext';
import { useAuth } from '../../context/AuthContext';
import FollowButton from '../FollowButton/FollowButton';

export default function ImageModal({ image, onClose }) {
  const { user } = useAuth();
  const { likes, bookmarks, toggleLike, toggleBookmark } = useGallery();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareWrapRef = useRef(null);
  const isLiked = likes.has(image.id);
  const isBookmarked = bookmarks.has(image.id);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const handleOutsideClick = (e) => {
      if (shareWrapRef.current && !shareWrapRef.current.contains(e.target)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('mousedown', handleOutsideClick);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const shareUrl = useMemo(() => {
    const target = image.full || image.url || '';
    try {
      return new URL(target, window.location.origin).toString();
    } catch {
      return target;
    }
  }, [image]);

  const shareText = useMemo(() => {
    const title = image.description || `Photo by ${image.author || 'Pixora'}`;
    return `${title} | Pixora`;
  }, [image]);

  const handleShare = useCallback((platform) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    const routes = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      email: `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    };
    const nextUrl = routes[platform];
    if (nextUrl) {
      window.open(nextUrl, '_blank', 'noopener,noreferrer');
      setShowShareMenu(false);
    }
  }, [shareText, shareUrl]);

  const handleCopyLink = useCallback(async () => {
    const text = shareUrl;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    } finally {
      setShowShareMenu(false);
    }
  }, [shareUrl]);

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(image.full || image.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pixora-${image.id}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(image.full || image.url, '_blank');
    }
  }, [image]);

  const fmtDim = (w, h) => w && h ? `${w} × ${h}` : '—';

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${image.description || 'Photo'}`}
    >
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
      >
        {/* Image */}
        <div className="modal-img-wrap">
          <img
            className="modal-img"
            src={image.url}
            alt={image.description || `Photo by ${image.author}`}
            loading="eager"
          />
        </div>

        {/* Info panel */}
        <div className="modal-info">
          {/* Author */}
          <div className="modal-author">
            <div className="modal-author-avatar">
              {image.authorProfile ? (
                <img
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(image.author)}&backgroundColor=111111&textColor=ffffff`}
                  alt={image.author}
                />
              ) : (
                <span style={{ fontSize: 18 }}>📷</span>
              )}
            </div>
            <div>
              <div className="modal-author-name">{image.author}</div>
              <div className="modal-author-label">
                {image.source === 'unsplash' ? 'via Unsplash' : 'via Picsum'}
              </div>
              {image.ownerId && user && user.id !== image.ownerId && (
                <div style={{ marginTop: 8 }}>
                  <FollowButton targetUserId={image.ownerId} />
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {image.description && (
            <p className="modal-desc">{image.description}</p>
          )}

          {/* Tags */}
          {image.tags && image.tags.length > 0 && (
            <div className="modal-tags">
              {image.tags.slice(0, 8).map(tag => (
                <span key={tag} className="modal-tag">#{tag}</span>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="modal-meta">
            <div className="modal-meta-item">
              <div className="modal-meta-label">Resolution</div>
              <div className="modal-meta-value">{fmtDim(image.width, image.height)}</div>
            </div>
            <div className="modal-meta-item">
              <div className="modal-meta-label">Likes</div>
              <div className="modal-meta-value">{(image.likes || 0).toLocaleString()}</div>
            </div>
            <div className="modal-meta-item">
              <div className="modal-meta-label">Source</div>
              <div className="modal-meta-value" style={{ textTransform: 'capitalize' }}>{image.source}</div>
            </div>
            <div className="modal-meta-item">
              <div className="modal-meta-label">Quality</div>
              <div className="modal-meta-value">HD</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="modal-actions">
            <button
              className={`modal-action-btn${isLiked ? ' active' : ''}`}
              onClick={() => toggleLike(image.id, image)}
              aria-label={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart size={15} /> {isLiked ? 'Liked' : 'Like'}
            </button>
            <button
              className={`modal-action-btn${isBookmarked ? ' active' : ''}`}
              onClick={() => toggleBookmark(image.id, image)}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              <Bookmark size={15} /> {isBookmarked ? 'Saved' : 'Save'}
            </button>
            <div className="modal-share-wrap" ref={shareWrapRef}>
              <button
                className={`modal-action-btn modal-action-btn--share${showShareMenu ? ' active' : ''}`}
                aria-label="Share"
                aria-haspopup="menu"
                aria-expanded={showShareMenu}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShareMenu(prev => !prev);
                }}
              >
                <Share2 size={15} /> Share
              </button>
              {showShareMenu && (
                <div className="modal-share-popover" role="menu" aria-label="Share via">
                  <div className="modal-share-title">Share via</div>
                  <button className="modal-share-item" role="menuitem" onClick={() => handleShare('facebook')}>Facebook</button>
                  <button className="modal-share-item" role="menuitem" onClick={() => handleShare('email')}>Email</button>
                  <button className="modal-share-item" role="menuitem" onClick={() => handleShare('twitter')}>Twitter</button>
                  <button className="modal-share-item" role="menuitem" onClick={handleCopyLink}>Copy link</button>
                </div>
              )}
            </div>
          </div>

          <button className="modal-download-btn" onClick={handleDownload}>
            <Download size={16} /> Download HD
          </button>

          {image.authorProfile && (
            <a
              href={image.authorProfile}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none',
                marginTop: -8,
              }}
            >
              <ExternalLink size={12} /> View on Unsplash
            </a>
          )}

        </div>

        {/* Close button */}
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
