
"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-2">
        <h3 className="text-lg font-semibold">Theme</h3>
        <p className="text-sm text-muted-foreground">
            Select a theme for the application.
        </p>
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Ubuntu Light</SelectItem>
            <SelectItem value="dark">Ubuntu Dark</SelectItem>
            <SelectItem value="classic">Classic Light</SelectItem>
            <SelectItem value="colorful">Colorful</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
    </div>
  );
}
