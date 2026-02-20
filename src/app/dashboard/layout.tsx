'use client';

import { type ReactNode, useEffect } from "react";
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
import { Loader, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { RolesProvider } from "@/lib/roles-provider";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === "avatar-1");
  const { user, loading, role } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

  const handleSignOut = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);
  
  useEffect(() => {
    if (loading || !user || !firestore) {
        return;
    }
    
    const seedDepartments = async () => {
        const deptsCol = collection(firestore, 'departments');
        const defaultDepartments = [
            { name: 'Executive', budget: 500000 },
            { name: 'ICT', budget: 250000 },
            { name: 'Marketing', budget: 150000 },
            { name: 'Operations', budget: 300000 },
            { name: 'Human Resources', budget: 100000 },
            { name: 'Finance', budget: 120000 },
        ];

        for (const dept of defaultDepartments) {
            const q = query(deptsCol, where('name', '==', dept.name));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                await addDoc(deptsCol, { ...dept, managerId: null });
            }
        }
    };

    seedDepartments().catch(console.error);

  }, [loading, user, firestore]);


  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <Link
              href="/dashboard"
              className="flex flex-col items-center justify-center p-2 text-center"
            >
              <span className="text-xs font-medium uppercase tracking-widest text-sidebar-primary">ProcurePortal</span>
              <span className="text-xl font-bold tracking-tight text-sidebar-foreground">UBUNTU PATHWAYS</span>
            </Link>
          </SidebarHeader>
          <SidebarBody>
            <NavLinks role={role} />
          </SidebarBody>
          <SidebarFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent p-3 cursor-pointer hover:bg-sidebar-accent/80 transition-colors">
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
                      {user.displayName || user.email}
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
        <main className="flex-1 flex flex-col">
          <AppHeader />
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
            <RolesProvider>{children}</RolesProvider>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
