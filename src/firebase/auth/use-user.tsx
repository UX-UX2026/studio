
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
        if (authIsLoading || !user || !firestore || creationAttempted.current || profile !== null) {
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
                        role: 'Requester', // Default role for all new users.
                        department: 'Unassigned',
                        status: 'Active',
                    };
                    
                    // Special case for the designated administrator.
                    if (user.email === 'heinrich@ubuntux.co.za') {
                        newProfileData.role = 'Administrator';
                        newProfileData.department = 'Executive';
                    }
                    
                    await setDoc(docRef, newProfileData);
                    toast({
                        title: "Welcome!",
                        description: "Your user profile has been created.",
                    });
                    // The `useDoc` hook listening on this `docRef` will automatically update and provide the new profile.
                } else {
                    // Profile exists, let's just make sure their status is Active if they were invited.
                    const existingProfile = docSnap.data();
                    if (existingProfile.status === 'Invited') {
                        await setDoc(docRef, { status: 'Active' }, { merge: true });
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
        
    }, [user, firestore, authIsLoading, toast, profile]);
    
    // The main loading state is true if either authentication or the initial profile fetch is in progress.
    const isLoading = authIsLoading || profileIsLoading;
    
    return {
        user,
        profile: profile || null,
        role: profile?.role || null,
        department: profile?.department || null,
        departmentId: profile?.departmentId || null,
        status: profile?.status || null,
        loading: isLoading,
    };
}
