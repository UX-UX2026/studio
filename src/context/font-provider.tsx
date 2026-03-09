
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

type Font = 'inter' | 'poppins' | 'source-sans-pro';

interface FontContextType {
    font: Font;
    setFont: (font: Font) => void;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

const FONT_STORAGE_KEY = 'app-font';

export function FontProvider({ children }: { children: ReactNode }) {
    const [font, setFontState] = useState<Font>('inter');

    useEffect(() => {
        const storedFont = localStorage.getItem(FONT_STORAGE_KEY) as Font;
        if (storedFont && ['inter', 'poppins', 'source-sans-pro'].includes(storedFont)) {
            setFontState(storedFont);
        } else {
            // If the stored font is no longer valid (e.g., 'lato', 'roboto'), default to 'inter'
            setFontState('inter');
            localStorage.setItem(FONT_STORAGE_KEY, 'inter');
        }
    }, []);
    
    useEffect(() => {
        document.body.classList.remove('font-inter', 'font-poppins', 'font-source-sans-pro', 'font-lato', 'font-roboto');
        document.body.classList.add(`font-${font}`);
    }, [font]);

    const setFont = useCallback((newFont: Font) => {
        setFontState(newFont);
        localStorage.setItem(FONT_STORAGE_KEY, newFont);
    }, []);


    return (
        <FontContext.Provider value={{ font, setFont }}>
            {children}
        </FontContext.Provider>
    );
}

export function useFont() {
    const context = useContext(FontContext);
    if (context === undefined) {
        throw new Error('useFont must be used within a FontProvider');
    }
    return context;
}
