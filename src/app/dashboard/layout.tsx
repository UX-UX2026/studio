'use client';

import { type ReactNode } from "react";
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
import { useUser } from "@/firebase/auth/use-user";
import { Loader, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
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


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === "avatar-1");
  // The useUser hook now gets its data from the robust AuthenticationProvider
  const { user, profile, loading, role } = useUser();
  const auth = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    if (!auth) {
      toast({ variant: 'destructive', title: 'Sign Out Failed', description: 'Authentication service not available.' });
      return;
    }
    try {
      await signOut(auth);
      toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
      // The AuthenticationProvider will handle redirecting the user on sign out.
    } catch (error: any) {
      console.error("Sign Out Error:", error);
      toast({
        variant: 'destructive',
        title: 'Sign Out Failed',
        description: error.message || 'An unexpected error occurred during sign out.',
      });
    }
  };

  // The main loading state is now handled by the AuthenticationProvider itself,
  // which shows a full-screen loader. We only need to handle the case where
  // data might still be loading inside the dashboard layout itself.
  if (loading || !user || !profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="bg-sidebar text-sidebar-foreground">
        <SidebarHeader className="h-16 border-b border-sidebar-border p-2 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden font-bold tracking-tight text-sidebar-foreground p-2">
                <AppLogo className="h-9 w-auto text-sidebar-foreground group-data-[collapsible=icon]:hidden" />
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
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
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
