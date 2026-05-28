import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';
import { useGallery } from '../../context/GalleryContext';

export default function InfiniteScrollSentinel() {
  const { loadMore, hasMore, loading } = useGallery();
  const { ref, inView } = useInView({ threshold: 0.1 });

  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadMore]);

  return (
    <div ref={ref} className="load-sentinel">
      {loading && <div className="load-spinner" aria-label="Loading more images" role="status" />}
      {!hasMore && !loading && (
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          You've seen it all ✦
        </span>
      )}
    </div>
  );
}
