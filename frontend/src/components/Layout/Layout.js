import './Layout.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SideNavigation from '../SideNavigation';
import MobileTopBar from './MobileTopBar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { LayoutTopBarActionContext } from './LayoutTopBarActionContext';

const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/playlists': 'Playlists',
  '/devices': 'Devices',
  '/device-groups': 'Groups',
  '/users': 'Users',
  '/companies': 'Companies',
};

function Layout({ children, user, onLogout }) {
  const isPlatformAdmin = user?.role === 'platform_super_admin';
  const location = useLocation();
  const isMobile = useIsMobile(1023);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [topBarAction, setTopBarAction] = useState(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) setTopBarAction(null);
  }, [isMobile]);

  const pageTitle = useMemo(
    () => ROUTE_TITLES[location.pathname] || 'Hands On Player',
    [location.pathname]
  );

  return (
    <div className={`layout ${isPlatformAdmin ? 'theme-platform-admin' : 'theme-default'}`}>
      <MobileTopBar onMenu={openDrawer} title={pageTitle} rightSlot={isMobile ? topBarAction : null} />
      <SideNavigation
        user={user}
        onLogout={onLogout}
        drawerOpen={drawerOpen}
        onCloseDrawer={closeDrawer}
        isMobile={isMobile}
      />
      <div className="layout-content">
        <LayoutTopBarActionContext.Provider value={setTopBarAction}>
          {children}
        </LayoutTopBarActionContext.Provider>
      </div>
    </div>
  );
}

export default Layout;
