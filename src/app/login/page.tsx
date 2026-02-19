'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { collection, doc, getDocs, getDoc, setDoc, query, limit } from "firebase/firestore";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px" {...props}>
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.244,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>
)

export default function LoginPage() {
    const router = useRouter();
    const auth = useAuth();
    const firestore = useFirestore();
    const { user, loading: userLoading, status } = useUser();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState<'google' | 'email' | null>(null);
    const [errorDialog, setErrorDialog] = useState<{title: string, description: string} | null>(null);


    useEffect(() => {
      const handleAuthRedirect = async () => {
        if (!userLoading && user) {
          if (status === 'Active') {
            router.push('/');
            return;
          }

          if (status === 'Invited') {
            setErrorDialog({
              title: "Account Pending Activation",
              description: "Your account has been invited but not yet activated. Please check your email for an activation link or contact an administrator.",
            });
            await signOut(auth);
            return;
          }
          
          // If user is authenticated but has no profile, create one.
          if (status === null) {
            try {
              const metadataRef = doc(firestore, 'app', 'metadata');
              const userRef = doc(firestore, 'users', user.uid);
              
              const metadataSnap = await getDoc(metadataRef);
              const adminIsSetUp = metadataSnap.exists() && metadataSnap.data()?.adminIsSetUp;

              let role = 'Requester'; // Default role
              let department = 'Unassigned';
              if (!adminIsSetUp) {
                role = 'Administrator';
                department = 'Executive';
              }

              // Create the user document
              await setDoc(userRef, {
                displayName: user.displayName || user.email?.split('@')[0],
                email: user.email,
                photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.email}`,
                role: role,
                department: department,
                status: 'Active',
              });

              // If we just created the first admin, update the metadata flag
              if (role === 'Administrator') {
                await setDoc(metadataRef, { adminIsSetUp: true });
              }
              // The useUser hook will now pick up the new profile and status will become 'Active',
              // which will trigger the redirect on the next render.
            } catch (error: any) {
              console.error("Account setup error:", error);
              let description = "An error occurred while setting up your account. Please try again.";
              if (error.code === 'permission-denied') {
                description = "A database security rule prevented your user profile from being created. Please ensure Firestore security rules are configured correctly."
              }
              setErrorDialog({
                  title: "Account Setup Failed",
                  description: description,
              });
              await signOut(auth);
            }
          }
        }
      };

      handleAuthRedirect();
    }, [user, userLoading, status, router, auth, firestore]);

    const handleGoogleSignIn = async () => {
        setIsLoading('google');
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // The useEffect will handle the redirect
        } catch (error: any)
        {
            console.error("Google authentication error:", error);
            let description = error.message;
            if (error.code === 'auth/unauthorized-domain') {
                const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
                description = `This app's domain is not authorized. Go to your Firebase project's Authentication settings, find the 'Sign-in method' tab, and add this exact domain to the 'Authorized domains' list: "${hostname}"`;
            }
            setErrorDialog({
                title: "Google Login Failed",
                description: description,
            });
        } 
        finally {
            setIsLoading(null);
        }
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading('email');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // The useEffect will handle the redirect
        } catch (error: any) {
            console.error("Email/Password authentication error:", error);
            
            const usersCollection = collection(firestore, 'users');
            const q = query(usersCollection, limit(1));
            const userSnapshot = await getDocs(q);

            let description = "An unexpected error occurred. Please try again.";

            if (userSnapshot.empty && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
                description = "This seems to be the first login. To use a local admin account, you must first create it in your Firebase project's Authentication console. Use the email and password you're trying to log in with, then sign in here.";
            } else {
                // The error codes are useful for debugging
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                        description = "Invalid email or password. Please double-check your credentials. Note: new email/password users must first be created in the Firebase Authentication console by an administrator.";
                        break;
                    case 'auth/invalid-email':
                        description = "The email address format is not valid.";
                        break;
                    case 'auth/operation-not-allowed':
                        description = "Email & Password sign-in is not enabled for this app. Please enable it in the Firebase console.";
                        break;
                    case 'auth/configuration-not-found':
                    case 'auth/invalid-api-key':
                        description = "Firebase configuration is invalid. Please check your setup.";
                        break;
                    default:
                        description = error.message;
                }
            }

             setErrorDialog({
                title: "Login Failed",
                description: description,
            });
        } finally {
            setIsLoading(null);
        }
    };

    if (userLoading || (user && status === 'Active')) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <>
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md shadow-2xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 text-center">
                        <p className="text-sm font-medium uppercase tracking-widest text-primary">ProcurePortal</p>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">UBUNTU PATHWAYS</h1>
                        </div>
                        <CardTitle className="text-2xl">Welcome</CardTitle>
                        <CardDescription>Sign in to access your procurement dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Button variant="outline" className="w-full h-12 text-base" onClick={handleGoogleSignIn} disabled={!!isLoading}>
                                {isLoading === 'google' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <GoogleIcon className="mr-2"/>}
                                Sign in with Google
                            </Button>
                            <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                Or continue with email
                                </span>
                            </div>
                            </div>

                            <form onSubmit={handleEmailSignIn} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@procurportal.local"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={!!isLoading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="P@ssword123!"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={!!isLoading}
                                    />
                                </div>
                                <Button type="submit" className="w-full h-12 text-base" disabled={!!isLoading}>
                                    {isLoading === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Sign In
                                </Button>
                            </form>
                            <p className="px-8 text-center text-xs text-muted-foreground">
                                By clicking continue, you agree to our{" "}
                                <Link href="#" className="underline underline-offset-4 hover:text-primary">
                                    Terms of Service
                                </Link>{" "}
                                and{" "}
                                <Link href="#" className="underline underline-offset-4 hover:text-primary">
                                    Privacy Policy
                                </Link>
                                .
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
             <AlertDialog open={!!errorDialog} onOpenChange={() => setErrorDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{errorDialog?.title}</AlertDialogTitle>
                        <AlertDialogDescription>{errorDialog?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setErrorDialog(null)}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
