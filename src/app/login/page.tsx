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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const AppLogo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 258 104"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("text-foreground", className)}
    aria-label="Ubuntu Pathways Logo"
    {...props}
  >
    <g fill="currentColor">
      <path d="M84.55 31.84h6.7l-12.03-18.49h-6.7l12.03 18.49zM60.11 31.84L78.6 0h6.7L66.81 31.84h-6.7zM197.89 31.84l-18.49-31.84h-6.7l18.49 31.84h6.7zM173.45 31.84h-6.7l12.03-18.49h6.7l-12.03 18.49z" />
      <path d="M96.61 13.35l7.74 11.97 7.74-11.97h6.7l-11.59 18.49h-6.7l-11.59-18.49h7.7zM121.2 13.35h6.6v18.49h-6.6zM135.5 13.35h6.6v18.49h-6.6zM149.8 13.35h6.6v18.49h-6.6z" />
      <path d="M164.1 13.35h6.7v18.49h-6.7z" />
    </g>
    <text
      style={{
        lineHeight: "100%",
        fontFamily: "Poppins, sans-serif",
        fontWeight: 700,
        letterSpacing: "0.05em",
        fontSize: "36px",
      }}
      x="129"
      y="65"
      textAnchor="middle"
      fill="currentColor"
    >
      UBUNTU
    </text>
    <text
      style={{
        lineHeight: "100%",
        fontFamily: "Poppins, sans-serif",
        fontWeight: 400,
        letterSpacing: "0.4em",
        fontSize: "20px",
      }}
      x="129"
      y="95"
      textAnchor="middle"
      fill="currentColor"
    >
      PATHWAYS
    </text>
  </svg>
);

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
    const { toast } = useToast();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showEmailLogin, setShowEmailLogin] = useState(false);

    const handleGoogleSignIn = async () => {
        if (!auth) return;
        setIsSubmitting(true);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        try {
            await signInWithPopup(auth, provider);
            // On success, the AuthenticationProvider's onAuthStateChanged observer
            // will handle the user state and navigation.
        } catch (error: any) {
            console.error("Google Sign-In Error:", error);
            let description = "An unexpected error occurred. Please try again.";
            if (error.code === 'auth/account-exists-with-different-credential') {
                description = "An account already exists with the same email address but different sign-in credentials. Try signing in with the original method.";
            } else if (error.code === 'auth/popup-closed-by-user') {
                description = "The sign-in window was closed before completion.";
            }
            toast({
                variant: "destructive",
                title: "Google Sign-In Failed",
                description: description,
                duration: 9000,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth) return;
        setIsSubmitting(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // On success, the AuthenticationProvider will handle the redirect.
        } catch (error: any) {
            console.error("Email/Password authentication error:", error);
            let description = "An unexpected error occurred. Please try again.";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                description = "Invalid email or password. Please check your credentials and try again.";
            } else if (error.code === 'auth/too-many-requests') {
                description = "Access to this account has been temporarily disabled due to many failed login attempts. You can try again later.";
            }
             toast({
                variant: "destructive",
                title: "Login Failed",
                description: description,
                duration: 9000,
            });
        } finally {
             setIsSubmitting(false);
        }
    };
    
    // The AuthenticationProvider shows a loader, so we don't need a separate one here.
    // We just render the page. The provider will redirect if the user is already logged in.
    
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        <AppLogo className="h-20 w-auto" />
                    </div>
                    <CardTitle className="text-2xl">Welcome to ProcurePortal</CardTitle>
                    <CardDescription>Sign in to access your dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {showEmailLogin ? (
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
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <Button type="submit" className="w-full h-12 text-base" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Sign In
                                </Button>
                            </form>
                        ) : (
                            <Button variant="outline" className="w-full h-12 text-base" onClick={handleGoogleSignIn} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <GoogleIcon className="mr-2"/>}
                                Sign in with Google
                            </Button>
                        )}

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                Or
                                </span>
                            </div>
                        </div>

                        <Button variant="link" className="w-full" onClick={() => setShowEmailLogin(prev => !prev)}>
                            {showEmailLogin ? 'Sign in with Google instead' : 'Continue with email'}
                        </Button>
                        
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
