'use client';

import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { NavLinks } from "@/components/nav-links";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
} from "@/components/app/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Link from "next/link";
import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === "avatar-1");
  const { user, loading } = useUser();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <Link
              href="/"
              className="p-2 text-xl font-bold tracking-tight text-primary"
            >
              PROCURE<span className="text-white">PORTAL</span>
            </Link>
          </SidebarHeader>
          <SidebarBody>
            <NavLinks />
          </SidebarBody>
          <SidebarFooter>
            <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent p-3">
              <Avatar className="h-8 w-8">
                {user.photoURL ? (
                  <AvatarImage
                    src={user.photoURL}
                    alt={user.displayName || 'User Avatar'}
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
                <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {user.displayName}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/80">
                  Administrator
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col">
          <AppHeader />
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
