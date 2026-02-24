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
import { useRouter } from "next/navigation";
import { Loader, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { RolesProvider } from "@/lib/roles-provider";
import { DebugLogProvider } from "@/context/debug-log-provider";


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === "avatar-1");
  const { user, profile, loading, role } = useUser();
  const router = useRouter();
  const auth = useAuth();

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (loading || !user || !profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <DebugLogProvider>
      <RolesProvider>
        <SidebarProvider>
          <Sidebar collapsible="icon" className="bg-sidebar text-sidebar-foreground">
            <SidebarHeader className="h-16 border-b border-sidebar-border p-2 flex items-center justify-between">
                <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden font-bold tracking-tight text-sidebar-foreground p-2">
                    <span className="text-xl group-data-[collapsible=icon]:hidden">UBUNTU PATHWAYS</span>
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
            <div className="flex-1 overflow-auto p-4 md:p-8 bg-background">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RolesProvider>
    </DebugLogProvider>
  );
}
