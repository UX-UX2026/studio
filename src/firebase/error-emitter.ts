'use client';

type Listener = (event: any) => void;

class EventEmitter {
  private listeners: Record<string, Listener[]> = {};

  on(eventName: string, listener: Listener): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(listener);
  }

  off(eventName: string, listener: Listener): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName].filter(l => l !== listener);
  }

  emit(eventName: string, data: any): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName].forEach(listener => {
      try {
        listener(data);
      } catch (e) {
        console.error(`Error in event listener for ${eventName}:`, e);
      }
    });
  }
}

export const errorEmitter = new EventEmitter();
