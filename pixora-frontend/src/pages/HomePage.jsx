import { useState } from 'react';
import Masonry from 'react-masonry-css';
import { AlertCircle } from 'lucide-react';
import { useGallery } from '../context/GalleryContext';
import ImageCard from '../components/ImageCard/ImageCard';
import GallerySkeleton from '../components/GallerySkeleton/GallerySkeleton';
import InfiniteScrollSentinel from '../components/InfiniteScrollSentinel/InfiniteScrollSentinel';
import ImageModal from '../components/ImageModal/ImageModal';

const BREAKPOINTS = {
  default: 4,
  1400:    4,
  1100:    3,
  768:     2,
  480:     2,
};

export default function HomePage() {
  const { images, loading, error, searchQuery } = useGallery();
  const [selectedImage, setSelectedImage] = useState(null);

  const isSearching = Boolean(searchQuery && searchQuery.trim());

  return (
    <>
      <main id="main-content">
        {/* Hero — only show when not searching */}
        {!isSearching && (
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero__eyebrow">
              <span>✦</span> Premium Photography
            </div>
            <h1 className="hero__title" id="hero-title">
              Discover the World<br />
              <em>Through the Lens</em>
            </h1>
            <p className="hero__sub">
              Curated HD photographs from the world's finest photographers,
              beautifully mixed in a premium Pinterest-style feed.
            </p>
          </section>
        )}

        {/* Search result header */}
        {isSearching && (
          <div className="search-header">
            <h2 className="search-header__title">
              Results for <em>"{searchQuery}"</em>
            </h2>
            <p className="search-header__count">
              {loading ? 'Searching…' : `${images.length} photos found`}
            </p>
          </div>
        )}

        {/* Error state — only show when no images are visible */}
        {error && images.length === 0 && (
          <div className="error-banner" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Gallery */}
        <div className={`gallery-wrap${isSearching ? ' no-hero' : ''}`}>
          {/* Skeleton while first load */}
          {images.length === 0 && loading ? (
            <GallerySkeleton columns={4} count={24} />
          ) : images.length === 0 && !loading ? (
            /* Empty state — only shows if search truly returns nothing */
            <div className="empty-state">
              <div className="empty-state__icon">🔍</div>
              <h3 className="empty-state__title">No photos found</h3>
              <p className="empty-state__sub">
                Try a different search term or clear the search to see the trending feed.
              </p>
            </div>
          ) : (
            <>
              <Masonry
                breakpointCols={BREAKPOINTS}
                className="my-masonry-grid"
                columnClassName="my-masonry-grid_column"
              >
                {images.map(img => (
                  <ImageCard
                    key={img.id}
                    image={img}
                    onClick={setSelectedImage}
                  />
                ))}
              </Masonry>

              {/* Bottom spinner / end-of-feed while more images exist */}
              <InfiniteScrollSentinel />
            </>
          )}
        </div>
      </main>

      {/* Modal */}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
}
