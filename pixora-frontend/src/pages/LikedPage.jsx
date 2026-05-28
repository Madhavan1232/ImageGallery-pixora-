import { useState, useEffect } from 'react';
import Masonry from 'react-masonry-css';
import { Heart } from 'lucide-react';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useGallery } from '../context/GalleryContext';
import ImageCard from '../components/ImageCard/ImageCard';
import ImageModal from '../components/ImageModal/ImageModal';
import GallerySkeleton from '../components/GallerySkeleton/GallerySkeleton';

const BREAKPOINTS = {
  default: 4,
  1400: 4,
  1100: 3,
  768: 2,
  480: 2,
};

export default function LikedPage() {
  const { user } = useAuth();
  const { likes } = useGallery();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    userAPI.getLikedImages()
      .then(({ data }) => setImages(data.images || []))
      .catch(() => setImages([]))
      .finally(() => setLoading(false));
  }, [user, likes]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">Your Liked Images</h1>
        <p className="page-header__sub">
          {images.length > 0
            ? `${images.length} liked photo${images.length !== 1 ? 's' : ''}`
            : 'Your liked photos will appear here'}
        </p>
      </div>

      <div className="gallery-wrap" style={{ paddingTop: 0 }}>
        {loading ? (
          <GallerySkeleton columns={4} count={16} />
        ) : images.length === 0 ? (
          <div className="empty-state">
            <Heart size={56} style={{ opacity: 0.15, marginBottom: 20 }} />
            <h3 className="empty-state__title">No likes yet</h3>
            <p className="empty-state__sub">
              Tap the heart on any photo to save it here.
            </p>
          </div>
        ) : (
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
        )}
      </div>

      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
}