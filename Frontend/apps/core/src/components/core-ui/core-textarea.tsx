"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { coreFieldClassName } from "@/lib/core-ui-classes";

export type CoreTextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Textarea with the same Core field treatment as {@link CoreInput}.
 */
export const CoreTextarea = React.forwardRef<
  HTMLTextAreaElement,
  CoreTextareaProps
>(function CoreTextarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn("resize-y font-chBody", coreFieldClassName, className)}
      {...props}
    />
  );
});
