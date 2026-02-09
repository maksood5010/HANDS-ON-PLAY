import './Layout.css';
import SideNavigation from '../SideNavigation';

function Layout({ children, user, onLogout }) {
  return (
    <div className="layout">
      <SideNavigation user={user} onLogout={onLogout} />
      <div className="layout-content">
        {children}
      </div>
    </div>
  );
}

export default Layout;

