'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { mockRoles as initialMockRoles, type Role } from '@/lib/roles-mock-data';

interface RolesContextValue {
  roles: Role[];
  addRole: (roleData: { name: string }) => void;
  updateRole: (role: Role) => void;
  deleteRole: (roleId: string) => void;
}

const RolesContext = createContext<RolesContextValue | undefined>(undefined);

export function RolesProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<Role[]>(initialMockRoles);

  const addRole = (roleData: { name: string }) => {
    const newRole: Role = { id: `role-${Date.now()}`, name: roleData.name };
    setRoles(prevRoles => [...prevRoles, newRole]);
  };

  const updateRole = (updatedRole: Role) => {
    setRoles(prevRoles => prevRoles.map(role => (role.id === updatedRole.id ? updatedRole : role)));
  };

  const deleteRole = (roleId: string) => {
    setRoles(prevRoles => prevRoles.filter(role => role.id !== roleId));
  };

  return (
    <RolesContext.Provider value={{ roles, addRole, updateRole, deleteRole }}>
      {children}
    </RolesContext.Provider>
  );
}

export function useRoles() {
  const context = useContext(RolesContext);
  if (context === undefined) {
    throw new Error('useRoles must be used within a RolesProvider');
  }
  return context;
}
