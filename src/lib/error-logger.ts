
import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';

export type LogErrorOptions = {
    userId?: string;
    userName?: string;
    action: string;
    errorMessage: string;
    errorStack?: string;
};

export const logErrorToFirestore = async (firestore: Firestore, options: LogErrorOptions) => {
    try {
        if (!firestore) {
            console.error("Firestore is not initialized. Could not log error.", options);
            return;
        }
        await addDoc(collection(firestore, 'errorLogs'), {
            userId: options.userId || 'N/A',
            userName: options.userName || 'N/A',
            action: options.action,
            errorMessage: options.errorMessage,
            errorStack: options.errorStack || 'N/A',
            timestamp: serverTimestamp()
        });
    } catch (logError) {
        // If logging to Firestore fails, log to console as a last resort.
        console.error("FATAL: Failed to write to error log collection. Original error:", options, "Logging error:", logError);
    }
};
