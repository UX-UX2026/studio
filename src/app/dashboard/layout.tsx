'use client';

import { type ReactNode, useEffect } from "react";
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
import { useAuth, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { RolesProvider } from "@/lib/roles-provider";
import { collection, getDocs, addDoc, query, where, serverTimestamp, limit } from "firebase/firestore";
import { testUsers, testProcurementRequests } from "@/lib/test-data";


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === "avatar-1");
  const { user, profile, loading, role } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

  const handleSignOut = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    if (loading || !user || !firestore) {
        return;
    }
    
    const seedData = async () => {
      try {
        // Seed Departments
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

        // Seed Procurement Data
        const requestsCol = collection(firestore, 'procurementRequests');
        const q = query(requestsCol, limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            return; // Data already exists
        }

        console.log("Seeding procurement test data...");

        const usersCol = collection(firestore, 'users');
        const usersSnapshot = await getDocs(usersCol);
        const userMap = new Map<string, string>(); // email -> id
        usersSnapshot.forEach(doc => {
            userMap.set(doc.data().email.toLowerCase(), doc.id);
        });
        
        const deptsColForSeed = collection(firestore, 'departments');
        const deptsSnapshot = await getDocs(deptsColForSeed);
        const deptMap = new Map<string, string>(); // name -> id
        deptsSnapshot.forEach(doc => {
            deptMap.set(doc.data().name, doc.id);
        });

        const requesterRay = testUsers.find(u => u.displayName === 'Requester Ray');
        const managerMike = testUsers.find(u => u.displayName === 'Manager Mike');

        for (const req of testProcurementRequests) {
            let submittedById = null;
            if (req.submittedBy === 'Requester Ray' && requesterRay) {
                submittedById = userMap.get(requesterRay.email.toLowerCase());
            } else if (req.submittedBy === 'Manager Mike' && managerMike) {
                submittedById = userMap.get(managerMike.email.toLowerCase());
            }

            const departmentId = deptMap.get(req.department);

            if (submittedById && departmentId) {
                const finalRequest = {
                    ...req,
                    departmentId,
                    submittedById,
                    createdAt: serverTimestamp()
                };

                await addDoc(requestsCol, finalRequest);
            } else {
                 console.warn(`Could not seed request for ${req.department}. Missing user or department ID.`);
            }
        }
      } catch (error) {
        console.error("Data seeding error:", error);
      }
    };

    seedData();

  }, [loading, user, firestore]);


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
          <RolesProvider>{children}</RolesProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
