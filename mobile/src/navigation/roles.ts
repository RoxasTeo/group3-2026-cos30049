// UI preview roles only. Replace the URL role with the authenticated user's role
// when the backend is connected; hiding tabs is not server-side authorization.
export type Role = 'botanist' | 'conservation-officer';
export type TabName = 'home' | 'scan' | 'records' | 'sync' | 'profile' | 'species' | 'review' | 'reports';
export type NavigationItem = { id: TabName; label: string };

const home: NavigationItem = { id: 'home', label: 'Home' };
const profile: NavigationItem = { id: 'profile', label: 'Profile' };

export const roleNavigation: Record<Role, { label: string; tabs: NavigationItem[] }> = {
  botanist: {
    label: 'Botanist',
    tabs: [home, { id: 'scan', label: 'Scan' }, { id: 'records', label: 'Records' }, { id: 'sync', label: 'Sync' }, profile],
  },
  'conservation-officer': {
    label: 'Conservation Officer',
    tabs: [home, { id: 'species', label: 'Species' }, { id: 'review', label: 'Review' }, { id: 'reports', label: 'Reports' }, profile],
  },
};

// Explicit comparisons prevent unknown roles from receiving a navigation menu.
export function isRole(value: unknown): value is Role {
  return value === 'botanist' || value === 'conservation-officer';
}
