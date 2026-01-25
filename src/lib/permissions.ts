import type { UserRole, Permission } from '../types';

// Role hierarchy - higher roles inherit all lower permissions
const roleHierarchy: UserRole[] = ['viewer', 'technician', 'dispatcher', 'manager', 'admin', 'owner'];

// Permissions for each role
const rolePermissions: Record<UserRole, Permission[]> = {
  viewer: ['properties.view', 'reports.view'],
  technician: ['properties.view', 'phases.complete', 'reports.view'],
  dispatcher: ['properties.view', 'properties.create', 'phases.complete', 'phases.assign', 'reports.view'],
  manager: [
    'properties.view',
    'properties.create',
    'properties.edit',
    'phases.complete',
    'phases.assign',
    'users.manage',
    'reports.view',
    'settings.manage',
  ],
  admin: [
    'properties.view',
    'properties.create',
    'properties.edit',
    'properties.delete',
    'phases.complete',
    'phases.assign',
    'users.manage',
    'reports.view',
    'settings.manage',
    'billing.manage',
  ],
  owner: [
    'properties.view',
    'properties.create',
    'properties.edit',
    'properties.delete',
    'phases.complete',
    'phases.assign',
    'users.manage',
    'reports.view',
    'settings.manage',
    'billing.manage',
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

// Check if a role is at least as high as another role
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userIndex = roleHierarchy.indexOf(userRole);
  const requiredIndex = roleHierarchy.indexOf(requiredRole);
  return userIndex >= requiredIndex;
}

// Check if user can perform manager-level actions
export function isManager(role: UserRole): boolean {
  return hasRole(role, 'manager');
}

// Check if user can perform admin-level actions
export function isAdmin(role: UserRole): boolean {
  return hasRole(role, 'admin');
}

// Get all permissions for a role
export function getPermissions(role: UserRole): Permission[] {
  return rolePermissions[role] || [];
}

// Check if user can view a property
export function canViewProperty(role: UserRole): boolean {
  return hasPermission(role, 'properties.view');
}

// Check if user can edit a property
export function canEditProperty(role: UserRole): boolean {
  return hasPermission(role, 'properties.edit');
}

// Check if user can complete a phase
export function canCompletePhase(role: UserRole): boolean {
  return hasPermission(role, 'phases.complete');
}

// Check if user can assign phases to users
export function canAssignPhase(role: UserRole): boolean {
  return hasPermission(role, 'phases.assign');
}

// Check if user can manage other users
export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, 'users.manage');
}
