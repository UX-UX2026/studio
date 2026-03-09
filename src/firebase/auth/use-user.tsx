
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
 * It consumes the `useAuthentication` hook to get the auth state, and then
 * becomes responsible for fetching or creating the user's profile document from Firestore.
 */
export function useUser() {
    const { user, isLoading: authIsLoading, firestore } = useAuthentication();
    const { toast } = useToast();
    
    // Create a stable reference to the user's document
    const userDocRef = useMemo(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);

    // Use the useDoc hook to listen for profile changes
    const { data: profile, loading: profileIsLoading, error: profileError } = useDoc<UserProfile>(userDocRef);
    
    const [isCreatingProfile, setIsCreatingProfile] = useState(false);

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
        // This effect triggers when a user is authenticated, we've checked for a profile, and it doesn't exist.
        if (!user || !firestore || authIsLoading || profileIsLoading || profile || isCreatingProfile) {
            return;
        }

        const createProfile = async () => {
            setIsCreatingProfile(true);

            // This is a first-time sign-in.
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
                newProfileData.department = 'Executive'; // Or another appropriate default
            }
            
            try {
                // Use the stable doc ref from the outer scope
                await setDoc(userDocRef!, newProfileData);
                toast({
                    title: "Welcome!",
                    description: "Your user profile has been created.",
                });
                // The useDoc listener will automatically pick up the newly created document,
                // which will update the `profile` state and turn off loading states.
            } catch (error) {
                console.error("Failed to create user profile:", error);
                toast({
                    variant: "destructive",
                    title: "Profile Creation Failed",
                    description: (error as Error).message || "An unexpected error occurred while creating your profile.",
                });
            } finally {
                setIsCreatingProfile(false);
            }
        };

        createProfile();
        
    }, [user, firestore, authIsLoading, profileIsLoading, profile, isCreatingProfile, toast, userDocRef]);
    
    const isLoading = authIsLoading || profileIsLoading || isCreatingProfile;
    
    return {
        user,
        profile: profile || null,
        role: profile?.role || null,
        department: profile?.department || null,
        status: profile?.status || null,
        loading: isLoading,
    };
}
