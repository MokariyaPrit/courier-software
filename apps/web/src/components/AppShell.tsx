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
  { href: '/masters/customers', label: 'Customers', roles: [Role.ADMIN, Role.BRANCH_MANAGER] },
  { href: '/masters/pincodes', label: 'Pincodes', roles: [Role.ADMIN] },
  { href: '/billing', label: 'Billing', roles: [Role.ADMIN, Role.BRANCH_MANAGER] },
  { href: '/admin/users', label: 'Users', roles: [Role.ADMIN] },
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
      <aside className="sidebar">
        <div className="brand">Courier ERP</div>
        <nav>
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname.startsWith(item.href) ? 'nav-link active' : 'nav-link'}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-meta">
            <strong>{user.fullName}</strong>
            <span>{user.role.replace('_', ' ')}</span>
            {user.userInfo?.companyName ? (
              <span>{user.userInfo.companyName}</span>
            ) : null}
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
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
