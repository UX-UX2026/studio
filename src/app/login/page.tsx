'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useUser } from "@/firebase";
import { Loader2 } from "lucide-react";

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
    const { toast } = useToast();
    const auth = useAuth();
    const { user, loading: userLoading } = useUser();
    
    const [email, setEmail] = useState('admin@procurportal.com');
    const [password, setPassword] = useState('admin');
    const [isLoading, setIsLoading] = useState<'google' | 'admin' | null>(null);

    useEffect(() => {
      if (!userLoading && user) {
        router.push('/');
      }
    }, [user, userLoading, router]);

    const handleGoogleSignIn = async () => {
        setIsLoading('google');
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // The useEffect will handle the redirect
        } catch (error: any) {
            console.error("Google authentication error:", error);
            let description = error.message;
            if (error.code === 'auth/unauthorized-domain') {
                const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
                description = `This app's domain is not authorized. Go to your Firebase project's Authentication settings, find the 'Sign-in method' tab, and add this exact domain to the 'Authorized domains' list: "${hostname}"`;
            }
            toast({
                variant: "destructive",
                title: "Google Login Failed",
                description: description,
            });
        } finally {
            setIsLoading(null);
        }
    };

    const handleAdminSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading('admin');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // The useEffect will handle the redirect
        } catch (error: any) {
            console.error("Admin authentication error:", error);
            let description = "An unexpected error occurred. Please try again.";
            // The error codes are useful for debugging
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    description = "Invalid email or password. Please ensure the user `admin@procurportal.com` with password `admin` exists in your Firebase Authentication users list.";
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
            toast({
                variant: "destructive",
                title: "Admin Login Failed",
                description: description,
            });
        } finally {
            setIsLoading(null);
        }
    };

    if (userLoading || user) {
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
                    <div className="mx-auto mb-4">
                        <h1 className="text-3xl font-bold tracking-tight text-primary">PROCURE<span className="text-foreground">PORTAL</span></h1>
                        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">Ubuntu Education Fund</p>
                    </div>
                    <CardTitle className="text-2xl">Welcome Back</CardTitle>
                    <CardDescription>Sign in to access your procurement dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Button variant="outline" className="w-full h-12 text-base" onClick={handleGoogleSignIn} disabled={!!isLoading}>
                             {isLoading === 'google' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <GoogleIcon className="mr-2"/>}
                            Login with Google
                        </Button>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                              Or as an Administrator
                            </span>
                          </div>
                        </div>

                        <form onSubmit={handleAdminSignIn} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Admin Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@procurportal.com"
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
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={!!isLoading}
                                />
                            </div>
                            <Button type="submit" className="w-full h-12 text-base" disabled={!!isLoading}>
                                 {isLoading === 'admin' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Login as Admin
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
