'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, setDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';

export type Role = {
  id: string;
  name: string;
};

interface RolesContextValue {
  roles: Role[];
  loading: boolean;
  addRole: (roleData: { name: string }) => Promise<void>;
  updateRole: (role: Role) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;
}

const RolesContext = createContext<RolesContextValue | undefined>(undefined);

export function RolesProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const rolesCollection = useMemo(() => collection(firestore, 'roles'), [firestore]);
  const { data: roles, loading } = useCollection<Role>(rolesCollection);

  useEffect(() => {
    if (!loading && roles && roles.length === 0 && firestore) {
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
          const rolesCol = collection(firestore, 'roles');
          for (const roleName of defaultRoles) {
            const q = query(rolesCol, where('name', '==', roleName));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
              await addDoc(rolesCol, { name: roleName });
            }
          }
        } catch (error) {
            console.error("Error seeding roles:", error);
        }
      };
      seedRoles();
    }
  }, [roles, loading, firestore]);

  const addRole = async (roleData: { name: string }) => {
    await addDoc(collection(firestore, 'roles'), roleData);
  };

  const updateRole = async (updatedRole: Role) => {
    const roleRef = doc(firestore, 'roles', updatedRole.id);
    await setDoc(roleRef, { name: updatedRole.name }, { merge: true });
  };

  const deleteRole = async (roleId: string) => {
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
