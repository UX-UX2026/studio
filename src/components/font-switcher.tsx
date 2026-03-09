
'use client';

import * as React from 'react';
import { useFont } from '@/context/font-provider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function FontSwitcher() {
  const { font, setFont } = useFont();

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Font Family</h3>
      <p className="text-sm text-muted-foreground">
        Select a font for the application.
      </p>
      <Select value={font} onValueChange={(value) => setFont(value as any)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select font" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="inter">
            <span className="font-inter">Inter</span>
          </SelectItem>
          <SelectItem value="poppins">
            <span className="font-poppins">Poppins</span>
          </SelectItem>
          <SelectItem value="source-sans-pro">
            <span className="font-source-sans-pro">Source Sans Pro</span>
          </SelectItem>
          <SelectItem value="roboto">
            <span className="font-roboto">Roboto</span>
          </SelectItem>
          <SelectItem value="lato">
            <span className="font-lato">Lato</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
