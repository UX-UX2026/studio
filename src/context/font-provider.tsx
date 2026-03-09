'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

type Font = 'inter' | 'lato' | 'roboto';

interface FontContextType {
    font: Font;
    setFont: (font: Font) => void;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

const FONT_STORAGE_KEY = 'app-font';

export function FontProvider({ children }: { children: ReactNode }) {
    // Default to 'inter' and load from localStorage on the client
    const [font, setFontState] = useState<Font>('inter');

    useEffect(() => {
        // This effect runs only on the client
        const storedFont = localStorage.getItem(FONT_STORAGE_KEY) as Font;
        if (storedFont && ['inter', 'lato', 'roboto'].includes(storedFont)) {
            setFontState(storedFont);
        }
    }, []);
    
    useEffect(() => {
        // This effect also runs only on the client
        document.body.classList.remove('font-inter', 'font-lato', 'font-roboto');
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
