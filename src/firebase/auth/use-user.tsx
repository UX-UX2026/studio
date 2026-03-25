
'use client';

import { useAuthentication, UserProfile } from '@/context/authentication-provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { signOut } from 'firebase/auth';

export type UserRole = string | null;
export type UserStatus = 'Active' | 'Invited' | null;

/**
 * This hook is the definitive source for user and profile information.
 * It uses a realtime listener for the user's profile and creates it if it doesn't exist.
 */
export function useUser() {
    const { user, isLoading: authIsLoading, firestore, auth } = useAuthentication();
    const { toast } = useToast();
    
    const userDocRef = useMemo(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);

    const { data: profile, loading: profileIsLoading, error: profileError } = useDoc<UserProfile>(userDocRef);
    
    const creationAttempted = useRef(false);

    const isSuperAdmin = user?.email === 'heinrich@ubuntux.co.za' || user?.email === 'admin@procurportal.com';

    useEffect(() => {
        if (profileError) {
            toast({
                variant: "destructive",
                title: "Error Loading Profile",
                description: profileError.message || "Could not load your user profile from the database."
            });
        }
    }, [profileError, toast]);
    
    useEffect(() => {
        if (authIsLoading || !user || !firestore || creationAttempted.current) {
            return;
        }

        creationAttempted.current = true;

        const checkAndCreateProfile = async () => {
            const docRef = doc(firestore, 'users', user.uid);
            try {
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) {
                    if (isSuperAdmin) {
                        console.log("Super admin profile not found. Creating a new one...");
                        const newProfileData: Omit<UserProfile, 'id'> = {
                            displayName: user.displayName || user.email?.split('@')[0] || 'New User',
                            email: user.email!,
                            photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.email}`,
                            role: 'Administrator',
                            department: 'Unassigned',
                            departmentId: null,
                            companyIds: [],
                            status: 'Active',
                        };
                        await setDoc(docRef, newProfileData);
                        toast({ title: "Welcome, Administrator!", description: "Your admin profile has been created." });
                    } else {
                        console.warn(`Access denied. No profile found for user: ${user.email}. Signing out.`);
                        toast({
                            variant: "destructive",
                            title: "Access Denied",
                            description: "Your account has not been setup by an administrator. Please contact support.",
                            duration: 9000,
                        });
                        if (auth) {
                            await signOut(auth);
                        }
                    }
                } else {
                    const existingProfile = docSnap.data();
                    let updates: Partial<Omit<UserProfile, 'id'>> = {};

                    if (existingProfile.status === 'Invited') {
                        updates.status = 'Active';
                        if (!existingProfile.role) {
                            updates.role = 'Requester'; 
                        }
                        toast({ title: "Account Activated", description: "Welcome! Your user profile is now active." });
                    }
                    
                    if (isSuperAdmin && existingProfile.role !== 'Administrator') {
                        updates.role = 'Administrator';
                         toast({ title: "Admin Role Corrected", description: "Your administrator role has been set." });
                    }

                    if (Object.keys(updates).length > 0) {
                        await setDoc(docRef, updates, { merge: true });
                    }
                }
            } catch (error) {
                console.error("Failed to check or create user profile:", error);
                toast({
                    variant: "destructive",
                    title: "Profile Initialization Failed",
                    description: (error as Error).message || "An unexpected error occurred while setting up your profile.",
                });
            }
        };

        checkAndCreateProfile();
        
    }, [user, firestore, auth, authIsLoading, toast, isSuperAdmin]);
    
    const isLoading = authIsLoading || profileIsLoading;
    
    return {
        user,
        profile: profile || null,
        role: isSuperAdmin ? 'Administrator' : (profile?.role || null),
        department: profile?.department || null,
        departmentId: profile?.departmentId || null,
        companyIds: profile?.companyIds || [],
        status: profile?.status || null,
        loading: isLoading,
    };
}
