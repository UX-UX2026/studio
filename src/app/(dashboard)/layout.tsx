import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { NavLinks } from "@/components/nav-links";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/app/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === "avatar-1");

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
                {userAvatar && (
                  <AvatarImage
                    src={userAvatar.imageUrl}
                    alt={userAvatar.description}
                    data-ai-hint={userAvatar.imageHint}
                    width={32}
                    height={32}
                  />
                )}
                <AvatarFallback>TM</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  Tarryn M.
                </p>
                <p className="truncate text-xs text-sidebar-foreground/80">
                  Dept Manager
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
