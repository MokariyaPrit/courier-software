'use client';

import { Role } from '@courier/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';

type NavLeaf = {
  href: string;
  label: string;
  roles: Role[];
  match?: (pathname: string) => boolean;
};

type NavGroup = {
  id: string;
  label: string;
  roles: Role[];
  href?: string;
  children?: NavLeaf[];
};

const NAV: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    roles: [Role.ADMIN, Role.BRANCH_MANAGER],
    href: '/dashboard',
  },
  {
    id: 'booking',
    label: 'Booking',
    roles: [Role.ADMIN, Role.BRANCH_MANAGER],
    children: [
      {
        href: '/bookings/account',
        label: 'Account booking',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
        match: (p) =>
          p === '/bookings/account' || p.startsWith('/bookings/account/'),
      },
      {
        href: '/bookings/cash',
        label: 'Cash booking',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
        match: (p) =>
          p === '/bookings/cash' || p.startsWith('/bookings/cash/'),
      },
      {
        href: '/booking-cursor',
        label: 'Booking cursor',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
    ],
  },
  {
    id: 'party',
    label: 'Party',
    roles: [Role.ADMIN, Role.BRANCH_MANAGER],
    children: [
      {
        href: '/customers',
        label: 'Parties',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
      {
        href: '/receivers',
        label: 'Receivers',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
      {
        href: '/sender-locations',
        label: 'Centers',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
      {
        href: '/customer-ledger',
        label: 'Party ledger',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
      {
        href: '/billing',
        label: 'Generate bill',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
        match: (p) => p === '/billing',
      },
      {
        href: '/billing/invoices',
        label: 'Invoices',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
        match: (p) =>
          p === '/billing/invoices' || p.startsWith('/billing/invoices/'),
      },
      {
        href: '/ca-gst',
        label: 'CA GST',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    roles: [Role.ADMIN, Role.BRANCH_MANAGER],
    children: [
      {
        href: '/rate-columns',
        label: 'Rate columns',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
      {
        href: '/quotations',
        label: 'Quotations',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
        match: (p) =>
          p === '/quotations' ||
          (p.startsWith('/quotations/') &&
            !p.startsWith('/quotations/templates')),
      },
      {
        href: '/quotations/templates',
        label: 'Rate templates',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
      {
        href: '/cash-rates',
        label: 'Cash rates',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
      {
        href: '/courier-companies',
        label: 'Courier companies',
        roles: [Role.ADMIN, Role.BRANCH_MANAGER],
      },
      {
        href: '/masters/states',
        label: 'States',
        roles: [Role.ADMIN],
      },
      {
        href: '/masters/cities',
        label: 'Cities',
        roles: [Role.ADMIN],
      },
      {
        href: '/admin/users',
        label: 'Users',
        roles: [Role.ADMIN],
      },
    ],
  },
  {
    id: 'profile',
    label: 'Profile',
    roles: [Role.ADMIN, Role.BRANCH_MANAGER],
    href: '/profile',
  },
];

function leafActive(pathname: string, leaf: NavLeaf) {
  if (leaf.match) return leaf.match(pathname);
  return pathname === leaf.href || pathname.startsWith(`${leaf.href}/`);
}

function groupActive(pathname: string, group: NavGroup, leaves: NavLeaf[]) {
  if (!leaves.length && group.href) {
    return pathname === group.href || pathname.startsWith(`${group.href}/`);
  }
  return leaves.some((leaf) => leafActive(pathname, leaf));
}

function NavDropdown({
  label,
  active,
  open,
  onOpen,
  onClose,
  onToggle,
  children,
}: {
  label: string;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleEnter = () => {
    clearCloseTimer();
    onOpen();
  };

  const handleLeave = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => onClose(), 120);
  };

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={`nav-item${active ? ' active' : ''}${open ? ' open' : ''}`}
      ref={rootRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        className={`nav-link nav-trigger${active ? ' active' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span>{label}</span>
        <i className="pi pi-chevron-down nav-chevron" aria-hidden />
      </button>
      {open ? (
        <div id={panelId} className="nav-dropdown" role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    setOpenId(null);
  }, [pathname]);

  const closeMenus = useCallback(() => setOpenId(null), []);

  if (loading || !user) {
    return <div className="page-center">Loading…</div>;
  }

  const groups = NAV.map((group) => ({
    ...group,
    children: (group.children ?? []).filter((c) =>
      c.roles.includes(user.role),
    ),
  })).filter((group) => {
    if (!group.roles.includes(user.role)) return false;
    if (group.href && !(group.children?.length)) return true;
    return (group.children?.length ?? 0) > 0;
  });

  return (
    <div className="app-shell">
      <header className="topbar" aria-label="Main navigation">
        <Link href="/dashboard" className="topbar-brand">
          Courier ERP
        </Link>
        <nav className="topbar-nav">
          {groups.map((group) => {
            const leaves = group.children ?? [];
            const active = groupActive(pathname, group, leaves);

            if (group.href && leaves.length === 0) {
              return (
                <Link
                  key={group.id}
                  href={group.href}
                  className={active ? 'nav-link active' : 'nav-link'}
                >
                  {group.label}
                </Link>
              );
            }

            return (
              <NavDropdown
                key={group.id}
                label={group.label}
                active={active}
                open={openId === group.id}
                onOpen={() => setOpenId(group.id)}
                onToggle={() =>
                  setOpenId((cur) => (cur === group.id ? null : group.id))
                }
                onClose={() =>
                  setOpenId((cur) => (cur === group.id ? null : cur))
                }
              >
                {leaves.map((leaf) => (
                  <Link
                    key={leaf.href}
                    href={leaf.href}
                    role="menuitem"
                    className={
                      leafActive(pathname, leaf)
                        ? 'nav-dropdown-link active'
                        : 'nav-dropdown-link'
                    }
                    onClick={() => setOpenId(null)}
                  >
                    {leaf.label}
                  </Link>
                ))}
              </NavDropdown>
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
            className="topbar-logout-btn"
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
