
"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";

export function AppHeader() {
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString("en-ZA", {
        year: 'numeric', month: 'long', day: 'numeric' 
      })
    );
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-8">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-lg font-semibold text-foreground">Ubuntu Procure</h1>
      </div>

      <div className="flex items-center space-x-4">
        {currentDate && <span className="text-sm font-medium text-muted-foreground hidden md:inline">
          {currentDate}
        </span>}
        <div className="h-8 w-px bg-border hidden md:inline"></div>
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
      </div>
    </header>
  );
}
