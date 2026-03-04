
'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type LogEntry = {
    message: string;
    timestamp: string;
    data?: any;
};

interface DebugLogContextType {
    logs: LogEntry[];
    log: (message: string, data?: any) => void;
    clearLogs: () => void;
}

const DebugLogContext = createContext<DebugLogContextType | undefined>(undefined);

export function DebugLogProvider({ children }: { children: ReactNode }) {
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const log = useCallback((message: string, data?: any) => {
        const newEntry: LogEntry = {
            message,
            timestamp: new Date().toISOString(),
            data: data ? JSON.parse(JSON.stringify(data, (key, value) => // Avoid circular refs
                typeof value === 'object' && value !== null && key === 'firestore' ? undefined : value
            )) : undefined,
        };
        setLogs(prevLogs => [newEntry, ...prevLogs]);
    }, []);
    
    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    return (
        <DebugLogContext.Provider value={{ logs, log, clearLogs }}>
            {children}
        </DebugLogContext.Provider>
    );
}

export function useDebugLog() {
    const context = useContext(DebugLogContext);
    if (context === undefined) {
        throw new Error('useDebugLog must be used within a DebugLogProvider');
    }
    return context;
}
