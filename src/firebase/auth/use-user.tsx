
'use client';

import { useAuthentication, UserProfile } from '@/context/authentication-provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, setDoc } from 'firebase/firestore';
import { useState, useEffect, useMemo } from 'react';
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
    
    // Create a stable reference to the user's document to prevent re-renders in useDoc
    const userDocRef = useMemo(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);

    // Use the realtime useDoc hook to listen for profile changes
    const { data: profile, loading: profileIsLoading, error: profileError } = useDoc<UserProfile>(userDocRef);
    
    // This state prevents the creation logic from running multiple times
    const [creationAttempted, setCreationAttempted] = useState(false);

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
        // Conditions to run the creation logic:
        // 1. Auth must be finished.
        // 2. Profile loading from useDoc must be finished.
        // 3. There must be a user object and a firestore instance.
        // 4. The profile must be definitively null (not just loading).
        // 5. We haven't already tried to create a profile for this user session.
        if (authIsLoading || profileIsLoading || !user || !firestore || profile || creationAttempted) {
            return;
        }

        // At this point, we know auth and profile loading are done, and there's no profile.
        // Mark that we are going to attempt to create the profile.
        setCreationAttempted(true);

        const createProfile = async () => {
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
            
            try {
                // The userDocRef is stable and memoized from the outer scope.
                await setDoc(userDocRef!, newProfileData);
                toast({
                    title: "Welcome!",
                    description: "Your user profile has been created.",
                });
                // The `useDoc` hook's `onSnapshot` listener will automatically pick up
                // the newly created document. This will update the `profile` state,
                // trigger a re-render, and finally allow the user to proceed.
            } catch (error) {
                console.error("Failed to create user profile:", error);
                toast({
                    variant: "destructive",
                    title: "Profile Creation Failed",
                    description: (error as Error).message || "An unexpected error occurred while creating your profile.",
                });
            }
        };

        createProfile();
        
    }, [user, firestore, authIsLoading, profileIsLoading, profile, creationAttempted, toast, userDocRef]);
    
    // The main loading state is true if either authentication or the initial profile fetch is in progress.
    const isLoading = authIsLoading || profileIsLoading;
    
    return {
        user,
        profile: profile || null,
        role: profile?.role || null,
        department: profile?.department || null,
        status: profile?.status || null,
        loading: isLoading,
    };
}
