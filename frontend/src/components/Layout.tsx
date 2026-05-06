import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

export function Layout({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className={`app-shell ${hideNav ? 'app-shell--no-nav' : ''}`}>
      <main className="app-content">{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
