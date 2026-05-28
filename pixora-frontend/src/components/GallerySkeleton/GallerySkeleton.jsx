// Masonry loading skeleton with shimmer effect
const HEIGHTS = [260, 340, 200, 400, 280, 320, 240, 380];

function SkeletonItem({ height }) {
  return (
    <div
      className="skeleton-item"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

export default function GallerySkeleton({ columns = 4, count = 20 }) {
  const perCol = Math.ceil(count / columns);

  return (
    <div className="skeleton-grid" aria-label="Loading images..." role="status">
      {Array.from({ length: columns }, (_, col) => (
        <div key={col} className="skeleton-column">
          {Array.from({ length: perCol }, (_, row) => {
            const idx = col * perCol + row;
            return (
              <SkeletonItem
                key={idx}
                height={HEIGHTS[idx % HEIGHTS.length]}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
