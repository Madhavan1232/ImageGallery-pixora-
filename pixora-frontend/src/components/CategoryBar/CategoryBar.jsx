import { useGallery } from '../../context/GalleryContext';

export default function CategoryBar() {
  const { categories, activeCategory, handleCategory } = useGallery();

  if (!categories.length) return null;

  return (
    <div className="category-bar" role="navigation" aria-label="Image categories">
      {categories.map(cat => (
        <button
          key={cat.id}
          id={`cat-${cat.id}`}
          className={`category-btn${activeCategory === cat.id ? ' active' : ''}`}
          onClick={() => handleCategory(cat.id)}
          aria-pressed={activeCategory === cat.id}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
