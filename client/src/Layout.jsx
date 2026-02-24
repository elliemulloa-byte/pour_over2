import { Link, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { BeanVerdictLogo } from './BeanVerdictLogo';
import { Avatar } from './Avatar';
import './Layout.css';

export function Layout() {
  const { user } = useAuth();

  return (
    <div className="layout">
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="site-logo" aria-label="Bean Verdict home">
            <BeanVerdictLogo className="site-logo-svg" />
            <span className="site-logo-text">Bean Verdict</span>
          </Link>
          <nav className="site-nav" aria-label="Main">
            {user ? (
              <>
                <Link to="/profile" className="site-nav-link site-nav-profile">
                  <Avatar avatar={user.avatar} size={28} />
                  <span>{user.displayName || user.email}</span>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="site-nav-link">Sign in</Link>
                <Link to="/signup" className="site-nav-link site-nav-cta">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </div>
  );
}
