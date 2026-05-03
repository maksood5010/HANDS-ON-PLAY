import './MobileTopBar.css';

function MobileTopBar({ onMenu, title, rightSlot }) {
  return (
    <header className="mobile-top-bar">
      <button
        type="button"
        className="mobile-top-bar__menu"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>
      <h1 className="mobile-top-bar__title">{title}</h1>
      {rightSlot ? <div className="mobile-top-bar__actions">{rightSlot}</div> : null}
    </header>
  );
}

export default MobileTopBar;
