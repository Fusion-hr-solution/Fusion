"use client";

import * as React from "react";
import { Input } from "@repo/ui";
import { cn } from "@/lib/utils";
import {
  coreFieldClassName,
  coreFieldReadOnlyClassName,
} from "@/lib/core-ui-classes";

export type CoreInputProps = React.ComponentProps<typeof Input>;

/**
 * `@repo/ui` `Input` with Fusion Core field styling (borders + EY yellow focus ring).
 */
export const CoreInput = React.forwardRef<HTMLInputElement, CoreInputProps>(
  function CoreInput({ className, readOnly, disabled, ...props }, ref) {
    const isStatic = Boolean(readOnly || disabled);
    return (
      <Input
        ref={ref}
        readOnly={readOnly}
        disabled={disabled}
        className={cn(
          "h-auto min-h-10 font-chBody",
          isStatic ? coreFieldReadOnlyClassName : coreFieldClassName,
          className
        )}
        {...props}
      />
    );
  }
);
