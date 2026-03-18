import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function generateObjectHash(obj: any): Promise<string> {
  // A stable stringify function to ensure consistent hash generation.
  // This handles nested objects and arrays.
  const stableStringify = (data: any): string => {
    if (data === null || typeof data !== 'object') {
      return JSON.stringify(data);
    }
    if (Array.isArray(data)) {
      return `[${data.map(stableStringify).join(',')}]`;
    }
    // For objects, sort keys and then stringify
    return `{${Object.keys(data).sort().map(key => `"${key}":${stableStringify(data[key])}`).join(',')}}`;
  };

  const jsonString = stableStringify(obj);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
