// Role names match the shared PHP backend. Hiding tabs is not server-side authorization;
// every API call is checked again on the server.
export type Role = 'botanist' | 'conservation_officer';
export type TabName = 'home' | 'scan' | 'records' | 'sync' | 'profile' | 'species';
export type NavigationItem = { id: TabName; label: string };

const home: NavigationItem = { id: 'home', label: 'Home' };
const profile: NavigationItem = { id: 'profile', label: 'Profile' };

export const roleNavigation: Record<Role, { label: string; tabs: NavigationItem[] }> = {
  botanist: {
    label: 'Botanist',
    tabs: [home, { id: 'scan', label: 'Scan' }, { id: 'records', label: 'Records' }, { id: 'sync', label: 'Sync' }, profile],
  },
  // Review, species management and reports are Web portal features for officers.
  conservation_officer: {
    label: 'Conservation Officer',
    tabs: [home, { id: 'species', label: 'Species' }, profile],
  },
};

// Explicit comparisons prevent unknown roles from receiving a navigation menu.
export function isRole(value: unknown): value is Role {
  return value === 'botanist' || value === 'conservation_officer';
}
