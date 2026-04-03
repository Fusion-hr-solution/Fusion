"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@repo/ui";
import { corePrimaryButtonClassName } from "@/lib/core-ui-classes";
import { cn } from "@/lib/utils";

/**
 * Primary CTA — `@repo/ui` `Button` + Fusion Core primary styling (`min-h-12`, shared hover/focus).
 */
export function CorePrimaryButton({
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <Button
      type={type}
      variant="outline"
      className={cn(corePrimaryButtonClassName, className)}
      {...props}
    />
  );
}
