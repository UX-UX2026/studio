

'use client';

import { useAuthentication, type UserProfile } from '@/context/authentication-provider';
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
        // Wait until we have a definitive answer on auth state AND profile state
        if (authIsLoading || profileIsLoading) {
            return;
        }

        // Case 1: We have an authenticated user, but no profile document exists for them.
        if (user && !profile) {
            const createProfileForNewUser = async () => {
                if (!firestore) return;

                // To be absolutely sure and prevent race conditions, we do one final check.
                const docRef = doc(firestore, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    // This means useDoc's state is just lagging. Let it catch up.
                    console.warn("useUser: Race condition averted. Profile exists, waiting for hook to update.");
                    return;
                }

                // If user is a designated super admin, create their admin profile.
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
                    // If the user is not a super admin and has no pre-existing profile, deny access.
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
            };

            createProfileForNewUser().catch(error => {
                 console.error("Failed to create user profile:", error);
                 toast({
                    variant: "destructive",
                    title: "Profile Initialization Failed",
                    description: (error as Error).message || "An unexpected error occurred while setting up your profile.",
                });
            });

        // Case 2: We have an authenticated user AND their profile document.
        } else if (user && profile) {
            const updateUserProfileIfNeeded = async () => {
                if (!firestore) return;
                const docRef = doc(firestore, 'users', user.uid);
                let updates: Partial<Omit<UserProfile, 'id'>> = {};

                // If the user was 'Invited', activate their account.
                if (profile.status === 'Invited') {
                    updates.status = 'Active';
                    // If they were invited without a role, assign a default one.
                    if (!profile.role) {
                        updates.role = 'Requester';
                    }
                    toast({ title: "Account Activated", description: "Welcome! Your user profile is now active." });
                }
                
                // Always ensure super admins have the Administrator role.
                if (isSuperAdmin && profile.role !== 'Administrator') {
                    updates.role = 'Administrator';
                    toast({ title: "Admin Role Verified", description: "Your administrator role has been set." });
                }

                // If there are any updates to be made, write them to the database.
                if (Object.keys(updates).length > 0) {
                    await setDoc(docRef, updates, { merge: true });
                }
            };
            
            updateUserProfileIfNeeded().catch(error => {
                console.error("Failed to update user profile:", error);
                 toast({
                    variant: "destructive",
                    title: "Profile Update Failed",
                    description: (error as Error).message || "An unexpected error occurred while updating your profile.",
                });
            });
        }
    }, [user, profile, auth, firestore, authIsLoading, profileIsLoading, toast, isSuperAdmin]);
    
    const isLoading = authIsLoading || profileIsLoading;
    
    return {
        user,
        profile: profile || null,
        role: isSuperAdmin ? 'Administrator' : (profile?.role || null),
        department: profile?.department || null,
        departmentId: profile?.departmentId || null,
        reportingDepartments: profile?.reportingDepartments || [],
        companyIds: profile?.companyIds || [],
        status: profile?.status || null,
        loading: isLoading,
    };
}
