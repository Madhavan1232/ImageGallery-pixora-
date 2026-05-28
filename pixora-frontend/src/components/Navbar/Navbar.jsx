import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bookmark, Heart, LogOut, X, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGallery } from '../../context/GalleryContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { handleSearch, searchQuery } = useGallery();
  const navigate = useNavigate();

  const [inputVal, setInputVal]       = useState(searchQuery || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [morePinned, setMorePinned] = useState(false);
  const [scrolled, setScrolled]       = useState(false);
  const [focused, setFocused]         = useState(false);

  const dropdownRef = useRef(null);
  const moreRef     = useRef(null);
  const inputRef    = useRef(null);
  const hoverTimeout = useRef(null);
  const debounceRef = useRef(null);

  // Sync local state if external searchQuery is cleared
  useEffect(() => {
    if (!searchQuery) setInputVal('');
  }, [searchQuery]);

  // Scroll listener
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setShowMoreMenu(false);
        setMorePinned(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => clearTimeout(hoverTimeout.current);
  }, []);

  // Debounced instant search while typing
  const triggerSearch = useCallback((val) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSearch(val);
      if (val.trim()) navigate('/');
    }, 380);
  }, [handleSearch, navigate]);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setInputVal(val);
    triggerSearch(val);
  }, [triggerSearch]);

  const clearSearch = useCallback(() => {
    setInputVal('');
    clearTimeout(debounceRef.current);
    handleSearch('');
    inputRef.current?.focus();
  }, [handleSearch]);

  const submitSearch = useCallback((e) => {
    e?.preventDefault();
    clearTimeout(debounceRef.current);
    handleSearch(inputVal.trim());
    if (inputVal.trim()) navigate('/');
  }, [inputVal, handleSearch, navigate]);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
    navigate('/');
  };

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`} role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <Link to="/" className="navbar__logo" aria-label="Pixora home" onClick={clearSearch}>
        <div className="navbar__logo-mark" aria-hidden="true">
          <img src="/pixora-icon.svg" alt="" aria-hidden="true" className="navbar__logo-icon" />
        </div>
        <span className="navbar__logo-text">Pixora</span>
      </Link>

      {/* Search */}
      <form
        className={`navbar__search${focused ? ' focused' : ''}`}
        onSubmit={submitSearch}
        role="search"
      >
        <label htmlFor="navbar-search" className="sr-only">Search images</label>
        <div className="navbar__search-icon">
          <Search size={15} />
        </div>
        <input
          ref={inputRef}
          id="navbar-search"
          type="text"
          className="navbar__search-input"
          placeholder="Search photos, photographers, moods…"
          value={inputVal}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
        />
        {inputVal && (
          <button
            type="button"
            className="navbar__search-btn"
            onClick={clearSearch}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {/* Actions */}
      <div className="navbar__actions">
        <div
          className="navbar__more"
          ref={moreRef}
          onMouseEnter={() => {
            clearTimeout(hoverTimeout.current);
            setShowMoreMenu(true);
          }}
          onMouseLeave={() => {
            if (!morePinned) {
              hoverTimeout.current = setTimeout(() => setShowMoreMenu(false), 120);
            }
          }}
        >
          <button
            className="navbar__more-trigger"
            title="More"
            aria-label="More options"
            aria-haspopup="true"
            aria-expanded={showMoreMenu}
            onClick={() => {
              setShowMoreMenu((prev) => {
                const next = !prev;
                setMorePinned(next);
                return next;
              });
            }}
          >
            <MoreHorizontal size={18} />
          </button>
          {showMoreMenu && (
            <div
              className="navbar__dropdown"
              role="menu"
              onMouseEnter={() => {
                clearTimeout(hoverTimeout.current);
                setShowMoreMenu(true);
              }}
              onMouseLeave={() => {
                if (!morePinned) {
                  hoverTimeout.current = setTimeout(() => setShowMoreMenu(false), 120);
                }
              }}
            >
              <Link
                to="/contact"
                className="navbar__dropdown-item"
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  setMorePinned(false);
                }}
              >
                Contact Us
              </Link>
              <Link
                to="/help"
                className="navbar__dropdown-item"
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  setMorePinned(false);
                }}
              >
                Help Us
              </Link>
            </div>
          )}
        </div>
        {user ? (
          <>
            <Link to="/likes" aria-label="View liked images">
              <button className="navbar__icon-btn" title="Liked">
                <Heart size={16} />
              </button>
            </Link>
            <Link to="/bookmarks" aria-label="View bookmarks">
              <button className="navbar__icon-btn" title="Bookmarks">
                <Bookmark size={16} />
              </button>
            </Link>
            <div className="navbar__user" ref={dropdownRef}>
              <button
                className="navbar__avatar"
                onClick={() => setShowDropdown(v => !v)}
                aria-expanded={showDropdown}
                aria-haspopup="true"
                aria-label="User menu"
              >
                <img
                  src={user.avatar}
                  alt={user.username}
                  onError={e => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`; }}
                />
              </button>
              {showDropdown && (
                <div className="navbar__dropdown" role="menu">
                  <div className="navbar__dropdown-header">
                    <div className="navbar__dropdown-username">{user.username}</div>
                    <div className="navbar__dropdown-email">{user.email}</div>
                  </div>
                  <Link
                    to="/likes"
                    className="navbar__dropdown-item"
                    role="menuitem"
                    onClick={() => setShowDropdown(false)}
                  >
                    <Heart size={15} /> Liked
                  </Link>
                  <Link
                    to="/bookmarks"
                    className="navbar__dropdown-item"
                    role="menuitem"
                    onClick={() => setShowDropdown(false)}
                  >
                    <Bookmark size={15} /> Bookmarks
                  </Link>
                  <button
                    className="navbar__dropdown-item danger"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login">
              <button className="navbar__btn navbar__btn--ghost">Log In</button>
            </Link>
            <Link to="/signup">
              <button className="navbar__btn navbar__btn--primary">Sign Up</button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
