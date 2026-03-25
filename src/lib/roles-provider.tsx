
'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, setDoc, deleteDoc, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { useAuthentication } from '@/context/authentication-provider';

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

const defaultRolesWithPermissions: Omit<Role, 'id'>[] = [
    {
        name: 'Administrator',
        permissions: [
            'dashboard:view', 'procurement:submit', 'procurement:summary', 'procurement:recurring',
            'approvals:view', 'approvals:action', 'fulfillment:view', 'fulfillment:manage',
            'reports:view', 'vendors:manage', 'help:view',
            'settings:general', 'settings:users', 'settings:departments', 'settings:roles',
            'settings:workflow', 'settings:budget', 'settings:procurement-periods',
            'settings:integrations', 'settings:email', 'settings:auditlog',
            'settings:errorlog', 'settings:data'
        ]
    },
    {
        name: 'Manager',
        permissions: [
            'dashboard:view', 'procurement:submit', 'procurement:summary', 'procurement:recurring',
            'approvals:view', 'approvals:action', 'reports:view', 'help:view'
        ]
    },
    {
        name: 'Executive',
        permissions: [
            'dashboard:view', 'procurement:summary', 'approvals:view', 'approvals:action',
            'reports:view', 'help:view'
        ]
    },
    {
        name: 'Procurement Officer',
        permissions: [
            'dashboard:view', 'procurement:summary', 'procurement:recurring', 'approvals:view',
            'fulfillment:view', 'fulfillment:manage', 'reports:view', 'vendors:manage',
            'settings:budget', 'help:view'
        ]
    },
    {
        name: 'Procurement Assistant',
        permissions: ['dashboard:view', 'fulfillment:view', 'fulfillment:manage', 'help:view']
    },
    {
        name: 'Requester',
        permissions: ['dashboard:view', 'procurement:submit', 'help:view']
    }
];

export function RolesProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { user } = useAuthentication();
  const rolesCollection = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roles'), orderBy('name'));
  }, [firestore]);
  
  const { data: roles, loading, error } = useCollection<Role>(rolesCollection);

  useEffect(() => {
    // This effect is ONLY for seeding roles and should only run once for the Super Admin.
    if (!firestore || !user || user.email !== 'heinrich@ubuntux.co.za') {
      return;
    }

    const seedRoles = async () => {
      try {
        const rolesQuery = query(collection(firestore, 'roles'), limit(1));
        const snapshot = await getDocs(rolesQuery);
        
        if (snapshot.empty) {
          console.log("Roles collection is empty. Seeding default roles...");
          for (const roleData of defaultRolesWithPermissions) {
            await addDoc(collection(firestore, 'roles'), roleData);
          }
          console.log("Default roles seeded successfully.");
        }
      } catch (e) {
        console.error("Error checking or seeding roles:", e);
      }
    };
    
    // A short delay can help prevent race conditions where the check runs
    // before Firestore rules have fully propagated after a user logs in.
    const timer = setTimeout(() => {
      seedRoles();
    }, 1500);

    return () => clearTimeout(timer);
    
  }, [firestore, user]);

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
