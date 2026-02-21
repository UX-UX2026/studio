'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithRedirect } from 'firebase/auth';
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth as useFirebaseAuthInstance } from "@/firebase";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
    const { isLoading: isAuthLoading } = useAuthentication();
    const { toast } = useToast();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleGoogleSignIn = async () => {
        setIsSubmitting(true);
        const provider = new GoogleAuthProvider();
        try {
            await signInWithRedirect(auth, provider);
        } catch (error: any) {
            console.error("Google Sign-In Error:", error);
            let description = "An unexpected error occurred. Please try again.";
            switch (error.code) {
                case 'auth/operation-not-allowed':
                    description = "Google Sign-In is not enabled for this project. Please go to the Firebase Console -> Authentication -> Sign-in method, and enable the Google provider.";
                    break;
                case 'auth/popup-blocked':
                    description = "The sign-in pop-up was blocked by your browser. Please allow pop-ups for this site and try again.";
                    break;
                case 'auth/popup-closed-by-user':
                    description = "You closed the sign-in window before completing the process. Please try again.";
                    break;
                case 'auth/unauthorized-domain':
                    description = "This domain is not authorized to use Firebase Authentication. Please go to the Firebase Console -> Authentication -> Settings -> Authorized domains, and add this application's domain.";
                    break;
                case 'auth/internal-error':
                    description = "An internal error occurred. This often indicates a misconfiguration in your Firebase project. Please check the following: 1) In the Google Cloud Console, ensure the 'Identity Platform' API is enabled for your project. 2) Check your OAuth consent screen configuration. If it's in 'Testing' mode, add your email address as a test user.";
                    break;
                default:
                    description = `An unknown error occurred. (Code: ${error.code})`;
                    break;
            }
            toast({
                variant: "destructive",
                title: "Google Sign-In Failed",
                description: description,
            });
            setIsSubmitting(false);
        }
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // On success, the AuthenticationProvider will handle the redirect.
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
                    description = "Email & Password sign-in is not enabled. Please enable it in the Firebase console.";
                    break;
                 case 'auth/internal-error':
                    description = "An internal Firebase error occurred. This can indicate a project misconfiguration. Please ensure the 'Identity Platform' API is enabled in your Google Cloud Console.";
                    break;
                default:
                    description = `An unknown error occurred. (Code: ${error.code})`;
            }
             toast({
                variant: "destructive",
                title: "Login Failed",
                description: description
            });
             setIsSubmitting(false);
        }
    };
    
    const isLoading = isAuthLoading || isSubmitting;

    // A simple loader that shows while the AuthenticationProvider is figuring out the user's state.
    if (isAuthLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    return (
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
                        <Button variant="outline" className="w-full h-12 text-base" onClick={handleGoogleSignIn} disabled={isLoading}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <GoogleIcon className="mr-2"/>}
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
                                    disabled={isLoading}
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
                                    disabled={isLoading}
                                />
                            </div>
                            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
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
    )
}
