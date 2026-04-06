
'use client';

import { useEffect, useCallback, useRef } from 'react';

const useInactivityTimeout = (onTimeout: () => void, timeoutInMinutes: number) => {
    const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetTimer = useCallback(() => {
        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
        }
        // Only set a new timer if timeout is greater than 0
        if (timeoutInMinutes > 0) {
            timeoutId.current = setTimeout(onTimeout, timeoutInMinutes * 60 * 1000);
        }
    }, [onTimeout, timeoutInMinutes]);

    useEffect(() => {
        // If timeout is disabled (0 or less), clear any existing timer and don't set up listeners.
        if (timeoutInMinutes <= 0) {
            if (timeoutId.current) {
                clearTimeout(timeoutId.current);
            }
            return;
        }

        const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
        
        const eventHandler = () => {
            resetTimer();
        };

        // Set up event listeners
        events.forEach(event => window.addEventListener(event, eventHandler, { passive: true }));
        
        // Start the timer initially
        resetTimer();

        // Cleanup function
        return () => {
            if (timeoutId.current) {
                clearTimeout(timeoutId.current);
            }
            events.forEach(event => window.removeEventListener(event, eventHandler));
        };
    }, [resetTimer, timeoutInMinutes]);
};

export default useInactivityTimeout;

