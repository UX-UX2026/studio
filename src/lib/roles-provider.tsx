'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

export type Role = {
  id: string;
  name: string;
  permissions?: string[];
};

interface RolesContextValue {
  roles: Role[];
  loading: boolean;
  addRole: (roleData: { name: string, permissions?: string[] }) => Promise<void>;
  updateRole: (role: Role) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;
}

const RolesContext = createContext<RolesContextValue | undefined>(undefined);

export function RolesProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const rolesCollection = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roles'), orderBy('name'));
  }, [firestore]);
  
  const { data: roles, loading, error } = useCollection<Role>(rolesCollection);

  useEffect(() => {
    if (loading || !firestore || error) {
      if (error) {
        console.error("Error loading roles, cannot seed default roles:", error);
      }
      return;
    }

    if (roles) {
      const seedRoles = async () => {
        const defaultRoles = [
          'Administrator', 
          'Manager', 
          'Procurement Officer', 
          'Executive', 
          'Requester', 
          'Procurement Assistant'
        ];
        
        try {
          const existingRoleNames = roles.map(r => r.name);
          const rolesToCreate = defaultRoles.filter(defaultRole => !existingRoleNames.includes(defaultRole));

          for (const roleName of rolesToCreate) {
            await addDoc(collection(firestore, 'roles'), { name: roleName, permissions: [] });
          }
        } catch (seedError) {
            console.error("Error seeding roles:", seedError);
        }
      };
      seedRoles();
    }
  }, [roles, loading, firestore, error]);

  const addRole = async (roleData: { name: string, permissions?: string[] }) => {
    if (!firestore) throw new Error("Firestore not available");
    await addDoc(collection(firestore, 'roles'), roleData);
  };

  const updateRole = async (updatedRole: Role) => {
    if (!firestore) throw new Error("Firestore not available");
    const roleRef = doc(firestore, 'roles', updatedRole.id);
    const { id, ...roleData } = updatedRole;
    await setDoc(roleRef, roleData, { merge: true });
  };

  const deleteRole = async (roleId: string) => {
    if (!firestore) throw new Error("Firestore not available");
    const roleRef = doc(firestore, 'roles', roleId);
    await deleteDoc(roleRef);
  };

  return (
    <RolesContext.Provider value={{ roles: roles || [], loading, addRole, updateRole, deleteRole }}>
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
