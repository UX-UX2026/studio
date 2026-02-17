import { EventEmitter } from 'events';

// This is a global event emitter for Firebase errors.
// It's used to propagate errors to a central listener component.
export const errorEmitter = new EventEmitter();
