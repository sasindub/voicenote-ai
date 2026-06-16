import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// The standard shadcn helper: merge conditional + Tailwind classes cleanly.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
