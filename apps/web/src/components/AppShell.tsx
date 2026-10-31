'use client';

import { Role } from '@courier/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', roles: [Role.ADMIN, Role.BRANCH_MANAGER] },
  { href: '/bookings', label: 'Bookings', roles: [Role.ADMIN, Role.BRANCH_MANAGER] },
  { href: '/tracking', label: 'Tracking', roles: [Role.ADMIN, Role.BRANCH_MANAGER] },
  { href: '/delivery', label: 'Delivery', roles: [Role.ADMIN, Role.BRANCH_MANAGER] },
  { href: '/customers', label: 'Customers', roles: [Role.ADMIN, Role.BRANCH_MANAGER] },
  { href: '/masters/states', label: 'States', roles: [Role.ADMIN] },
  { href: '/masters/cities', label: 'Cities', roles: [Role.ADMIN] },
  { href: '/billing', label: 'Billing', roles: [Role.ADMIN, Role.BRANCH_MANAGER] },
  { href: '/admin/users', label: 'Users', roles: [Role.ADMIN] },
  { href: '/profile', label: 'Profile', roles: [Role.ADMIN, Role.BRANCH_MANAGER] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="page-center">Loading…</div>;
  }

  const links = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="app-shell">
      <header className="topbar" aria-label="Main navigation">
        <div className="topbar-brand">Courier ERP</div>
        <nav className="topbar-nav">
          {links.map((item) => {
            const isActive =
              item.href === '/profile'
                ? pathname === '/profile'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? 'nav-link active' : 'nav-link'}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="topbar-user">
          <div className="user-meta">
            <strong>{user.fullName}</strong>
            <span>{user.role.replace(/_/g, ' ')}</span>
          </div>
          <Button
            label="Logout"
            severity="secondary"
            text
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          />
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
