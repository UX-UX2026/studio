
"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-2">
        <h3 className="text-lg font-semibold">Theme</h3>
        <p className="text-sm text-muted-foreground">
            Select a theme for the application.
        </p>
        <RadioGroup
            value={theme}
            onValueChange={setTheme}
            className="flex items-center space-x-4 pt-2"
        >
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light">Ubuntu Light</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark">Ubuntu Dark</Label>
            </div>
             <div className="flex items-center space-x-2">
                <RadioGroupItem value="classic" id="classic" />
                <Label htmlFor="classic">Classic Light</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="system" />
                <Label htmlFor="system">System</Label>
            </div>
        </RadioGroup>
    </div>
  );
}
