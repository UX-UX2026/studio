
import { FirestorePermissionError } from './errors';

type Listener<T> = (event: T) => void;

class EventEmitter<T extends Record<string, any>> {
  private listeners: { [K in keyof T]?: Listener<T[K]>[] } = {};

  on<K extends keyof T>(event: K, listener: Listener<T[K]>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    if (this.listeners[event]) {
      this.listeners[event]!.forEach(listener => listener(data));
    }
  }
}

type Events = {
  'permission-error': FirestorePermissionError;
};

export const errorEmitter = new EventEmitter<Events>();
