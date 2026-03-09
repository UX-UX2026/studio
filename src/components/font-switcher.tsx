
'use client';

import * as React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useFont } from '@/context/font-provider';

export function FontSwitcher() {
  const { font, setFont } = useFont();

  return (
    <div className="space-y-2">
        <h3 className="text-lg font-semibold">Font Family</h3>
        <p className="text-sm text-muted-foreground">
            Select a font for the application.
        </p>
        <RadioGroup
            value={font}
            onValueChange={(value) => setFont(value as any)}
            className="flex items-center space-x-4 pt-2"
        >
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="inter" id="inter" />
                <Label htmlFor="inter" className="font-inter">Inter</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="poppins" id="poppins" />
                <Label htmlFor="poppins" className="font-poppins">Poppins</Label>
            </div>
             <div className="flex items-center space-x-2">
                <RadioGroupItem value="source-sans-pro" id="source-sans-pro" />
                <Label htmlFor="source-sans-pro" className="font-source-sans-pro">Source Sans Pro</Label>
            </div>
        </RadioGroup>
    </div>
  );
}
