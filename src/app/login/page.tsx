'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth as useFirebaseAuthInstance } from "@/firebase";
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
import { useAuthentication } from "@/context/authentication-provider";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px" {...props}>
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.244,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>
)

export default function LoginPage() {
    const auth = useFirebaseAuthInstance();
    const { user, isLoading: isAuthLoading } = useAuthentication();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSigningIn, setIsSigningIn] = useState<'google' | 'email' | null>(null);
    const [errorDialog, setErrorDialog] = useState<{title: string, description: string} | null>(null);

    const handleGoogleSignIn = async () => {
        setIsSigningIn('google');
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // On success, the AuthenticationProvider will see the new user and redirect.
        } catch (error: any) {
            console.error("Google authentication error:", error);
            
            let description = "An unexpected error occurred. Please try again.";
            // The 403 error the user is seeing often manifests as 'auth/internal-error' or 'auth/auth-domain-config-required'
            // when using signInWithPopup/Redirect if the project isn't configured correctly.
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                    description = "The sign-in popup was closed before completing the sign-in. Please try again.";
                    break;
                case 'auth/cancelled-popup-request':
                    description = "The sign-in flow was cancelled. Please try again.";
                    break;
                case 'auth/operation-not-allowed':
                    description = "Google Sign-In is not enabled for this project. Please go to the Firebase Console, select your project, go to Authentication > Sign-in method, and enable the Google provider.";
                    break;
                case 'auth/internal-error':
                case 'auth/auth-domain-config-required':
                    description = "Your Firebase project is not configured correctly for Google Sign-In. Please check the following in your Google Cloud & Firebase consoles: 1) Ensure the 'Identity Platform' API is enabled. 2) Ensure your OAuth consent screen is configured. 3) For Google Sign-In, ensure your domain is added to the authorized domains list in Firebase Authentication. If the problem persists, it may be a temporary Firebase service issue.";
                    break;
                default:
                    description = error.message;
            }

            setErrorDialog({
                title: "Login Failed",
                description: description,
            });
        } finally {
            setIsSigningIn(null);
        }
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSigningIn('email');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // On success, the AuthenticationProvider will see the new user and redirect.
        } catch (error: any) {
            console.error("Email/Password authentication error:", error);
            
            let description = "An unexpected error occurred. Please try again.";
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    description = "Invalid email or password. Please double-check your credentials.";
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
                case 'auth/internal-error':
                    description = "An internal error occurred. This often indicates a misconfiguration in your Firebase project. Please check the following in your Google Cloud & Firebase consoles: 1) Ensure the 'Identity Platform' API is enabled. 2) Ensure your OAuth consent screen is configured. 3) For Google Sign-In, ensure the provider is enabled in Firebase Authentication. If the problem persists, it may be a temporary Firebase service issue.";
                    break;
                default:
                    description = error.message;
            }

             setErrorDialog({
                title: "Login Failed",
                description: description,
            });
        } finally {
            setIsSigningIn(null);
        }
    };

    // Show a loading screen while the AuthenticationProvider is determining the auth state.
    // This includes processing the redirect result from Google.
    if (isAuthLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    // If the provider is done loading and we have a user, it means the login was successful
    // and we are waiting for the provider to redirect us to the dashboard.
    if (user) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Redirecting...</p>
            </div>
        );
    }

    // If not loading and no user, we are not logged in, so show the login form.
    return (
        <>
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md shadow-2xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 text-center">
                        <p className="text-sm font-medium uppercase text-primary">ProcurePortal</p>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">UBUNTU PATHWAYS</h1>
                        </div>
                        <CardTitle className="text-2xl">Welcome</CardTitle>
                        <CardDescription>Sign in to access your procurement dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Button variant="outline" className="w-full h-12 text-base" onClick={handleGoogleSignIn} disabled={!!isSigningIn}>
                                {isSigningIn === 'google' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <GoogleIcon className="mr-2"/>}
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
                                        disabled={!!isSigningIn}
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
                                        disabled={!!isSigningIn}
                                    />
                                </div>
                                <Button type="submit" className="w-full h-12 text-base" disabled={!!isSigningIn}>
                                    {isSigningIn === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
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
