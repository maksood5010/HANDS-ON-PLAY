import './Layout.css';
import SideNavigation from '../SideNavigation';

function Layout({ children, user, onLogout }) {
  const isPlatformAdmin = user?.role === "platform_super_admin";

  return (
    <div className={`layout ${isPlatformAdmin ? "theme-platform-admin" : "theme-default"}`}>
      <SideNavigation user={user} onLogout={onLogout} />
      <div className="layout-content">
        {children}
      </div>
    </div>
  );
}

export default Layout;

