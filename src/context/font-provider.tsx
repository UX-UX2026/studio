
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

type Font = 'inter' | 'poppins' | 'source-sans-pro' | 'roboto' | 'lato';

interface FontContextType {
    font: Font;
    setFont: (font: Font) => void;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

const FONT_STORAGE_KEY = 'app-font';

const validFonts: Font[] = ['inter', 'poppins', 'source-sans-pro', 'roboto', 'lato'];

export function FontProvider({ children }: { children: ReactNode }) {
    const [font, setFontState] = useState<Font>('inter');

    useEffect(() => {
        const storedFont = localStorage.getItem(FONT_STORAGE_KEY) as Font;
        if (storedFont && validFonts.includes(storedFont)) {
            setFontState(storedFont);
        } else {
            setFontState('inter');
            localStorage.setItem(FONT_STORAGE_KEY, 'inter');
        }
    }, []);
    
    useEffect(() => {
        document.body.classList.remove(...validFonts.map(f => `font-${f}`));
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
