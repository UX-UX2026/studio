
'use client';

import { type ReactNode, useMemo, useCallback } from "react";
import Image from "next/image";
import { AppHeader } from "@/components/app-header";
import { NavLinks } from "@/components/nav-links";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Link from "next/link";
import { useUser, useAuth, useFirestore, useDoc } from "@/firebase";
import { Loader, LogOut, Palette, Type, Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import useInactivityTimeout from "@/hooks/use-inactivity-timeout";
import type { AppMetadata } from '@/app/dashboard/settings/security/page';
import { doc } from "firebase/firestore";
import { useTheme } from "next-themes";
import { useFont } from "@/context/font-provider";


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === "avatar-1");
  const { user, profile, loading, role } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { theme, themes, setTheme } = useTheme();
  const { font, setFont } = useFont();

  const appMetadataRef = useMemo(() => {
    if (!firestore) return null;
    return doc(firestore, 'app', 'metadata');
  }, [firestore]);
  const { data: appMetadata } = useDoc<AppMetadata>(appMetadataRef);

  const handleSignOut = useCallback(async (isTimeout = false) => {
    if (!auth) {
      toast({ variant: 'destructive', title: 'Sign Out Failed', description: 'Authentication service not available.' });
      return;
    }
    try {
      await signOut(auth);
      if (isTimeout) {
        toast({ title: 'Session Timed Out', description: 'You have been logged out due to inactivity.' });
      } else {
        toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
      }
      // The AuthenticationProvider will handle redirecting the user on sign out.
    } catch (error: any) {
      console.error("Sign Out Error:", error);
      toast({
        variant: 'destructive',
        title: 'Sign Out Failed',
        description: error.message || 'An unexpected error occurred during sign out.',
      });
    }
  }, [auth, toast]);

  const onTimeout = useCallback(() => {
    handleSignOut(true);
  }, [handleSignOut]);

  const timeoutMinutes = appMetadata?.securitySettings?.autoLogoutEnabled
    ? appMetadata.securitySettings.inactivityTimeoutMinutes || 0
    : 0;

  useInactivityTimeout(onTimeout, timeoutMinutes);

  if (loading || !user || !profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const fonts = ['inter', 'poppins', 'source-sans-pro', 'roboto', 'lato'];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="bg-sidebar text-sidebar-foreground">
        <SidebarHeader className="h-16 border-b border-sidebar-border p-2 flex items-center justify-between">
            <div className="w-7"/>
            <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden font-bold tracking-tight text-sidebar-foreground p-2">
                <div className="flex flex-row items-baseline gap-2 group-data-[collapsible=icon]:hidden">
                    <span className="font-bold text-lg">UBUNTU</span>
                    <span className="text-sm font-semibold tracking-wider">PATHWAYS</span>
                </div>
            </Link>
            <SidebarTrigger className="hidden md:flex" />
        </SidebarHeader>
        <SidebarContent className="p-2">
            <NavLinks role={role} />
        </SidebarContent>
        <SidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent p-3 cursor-pointer hover:bg-sidebar-accent/80 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
                <Avatar className="h-8 w-8">
                  {profile.photoURL ? (
                    <AvatarImage
                      src={profile.photoURL}
                      alt={profile.displayName || 'User Avatar'}
                    />
                  ) : userAvatar && (
                    <AvatarImage
                      src={userAvatar.imageUrl}
                      alt={userAvatar.description}
                      data-ai-hint={userAvatar.imageHint}
                      width={32}
                      height={32}
                    />
                  )}
                  <AvatarFallback>{profile.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">
                    {profile.displayName || user.email}
                  </p>
                  {role && (
                    <p className="truncate text-xs text-sidebar-foreground/80">
                      {role}
                    </p>
                  )}
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette className="mr-2 h-4 w-4" />
                    <span>Theme</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                       <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                        {themes.map(t => (
                          <DropdownMenuRadioItem key={t} value={t} className="capitalize">{t}</DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Type className="mr-2 h-4 w-4" />
                    <span>Font</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={font} onValueChange={(v) => setFont(v as any)}>
                        {fonts.map(f => (
                          <DropdownMenuRadioItem key={f} value={f} className="capitalize font-sans">{f}</DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleSignOut(false)} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-background">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
