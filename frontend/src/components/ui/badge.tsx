import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        inquiry: "border-transparent bg-amber-100 text-amber-800",
        confirmed: "border-transparent bg-green-100 text-green-800",
        delivered: "border-transparent bg-blue-100 text-blue-800",
        completed: "border-transparent bg-teal-100 text-teal-800",
        cancelled: "border-transparent bg-red-100 text-red-800",
        returning: "border-transparent bg-purple-100 text-purple-800",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
