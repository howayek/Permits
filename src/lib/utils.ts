import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a camelCase or snake_case field name to a human-readable label.
 * The transformation capitalizes the first letter and preserves the casing of subsequent words.
 * 
 * Examples: 
 * - "plotNumber" → "Plot Number"
 * - "contact_email" → "Contact Email"
 * - "firstName" → "First Name"
 * 
 * Note: This function is optimized for typical form field names. 
 * It may not handle consecutive capital letters or acronyms ideally
 * (e.g., "XMLHttpRequest" becomes "X M L Http Request").
 */
export function formatFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')  // Insert space before capital letters
    .replace(/_/g, ' ')           // Replace underscores with spaces
    .replace(/^./, (str) => str.toUpperCase())  // Capitalize the first character
    .trim();
}
