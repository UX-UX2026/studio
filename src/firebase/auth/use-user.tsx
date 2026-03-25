

'use client';

import { useAuthentication, UserProfile } from '@/context/authentication-provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export type UserRole = string | null;
export type UserStatus = 'Active' | 'Invited' | null;

/**
 * This hook is the definitive source for user and profile information.
 * It uses a realtime listener for the user's profile and creates it if it doesn't exist.
 */
export function useUser() {
    const { user, isLoading: authIsLoading, firestore } = useAuthentication();
    const { toast } = useToast();
    
    const userDocRef = useMemo(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);

    const { data: profile, loading: profileIsLoading, error: profileError } = useDoc<UserProfile>(userDocRef);
    
    const creationAttempted = useRef(false);

    const isSuperAdmin = user?.email === 'heinrich@ubuntux.co.za';

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
        // This effect's job is to ensure a user profile document exists in Firestore.
        // It runs a one-time check after the user is authenticated.
        if (authIsLoading || !user || !firestore || creationAttempted.current) {
            return;
        }

        // Mark that we're performing the check to prevent re-running.
        creationAttempted.current = true;

        const checkAndCreateProfile = async () => {
            const docRef = doc(firestore, 'users', user.uid);
            try {
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) {
                    // The document does not exist, so we create it.
                    console.log("No profile found for this user. Creating a new one...");
                    
                    const newProfileData: Omit<UserProfile, 'id'> = {
                        displayName: user.displayName || user.email?.split('@')[0] || 'New User',
                        email: user.email!,
                        photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.email}`,
                        role: isSuperAdmin ? 'Administrator' : 'Requester', // Default role
                        department: isSuperAdmin ? 'Executive' : 'Unassigned',
                        departmentId: null,
                        companyId: null,
                        companyName: 'Unassigned',
                        status: 'Active',
                    };
                    
                    await setDoc(docRef, newProfileData);

                    toast({
                        title: "Welcome!",
                        description: "Your user profile has been created.",
                    });
                } else {
                    // Profile exists, check for necessary updates.
                    const existingProfile = docSnap.data();
                    const updates: Partial<Omit<UserProfile, 'id'>> = {};

                    // If user was invited, activate their account AND ensure they have a role.
                    if (existingProfile.status === 'Invited') {
                        updates.status = 'Active';
                        // Only set a default role if one isn't already set.
                        if (!existingProfile.role) {
                            updates.role = 'Requester';
                        }
                    }

                    // Always ensure the super admin has the administrator role.
                    if (isSuperAdmin && existingProfile.role !== 'Administrator') {
                        updates.role = 'Administrator';
                    }

                    // If there are updates to be made, apply them.
                    if (Object.keys(updates).length > 0) {
                        await setDoc(docRef, updates, { merge: true });
                        if (updates.status === 'Active') {
                             toast({ title: "Account Activated", description: "Welcome! Your user profile is now active." });
                        }
                        if (updates.role === 'Administrator') {
                            toast({ title: "Admin Role Corrected", description: "Your administrator role has been set." });
                        }
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
        
    }, [user, firestore, authIsLoading, toast, isSuperAdmin]);
    
    // The main loading state is true if either authentication or the initial profile fetch is in progress.
    const isLoading = authIsLoading || profileIsLoading;
    
    return {
        user,
        profile: profile || null,
        role: isSuperAdmin ? 'Administrator' : (profile?.role || null),
        department: profile?.department || null,
        departmentId: profile?.departmentId || null,
        companyId: profile?.companyId || null,
        companyName: profile?.companyName || null,
        status: profile?.status || null,
        loading: isLoading,
    };
}

    