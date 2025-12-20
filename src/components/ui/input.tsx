"use client";

import * as React from "react";
import { useState, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  helperText?: string;
  enablePasswordToggle?: boolean;
  noFocusRing?: boolean;
  labelClassName?: string;
  endAdornment?: React.ReactNode;
}

function Input({
  className,
  type,
  label,
  error,
  helperText,
  id,
  enablePasswordToggle = false,
  noFocusRing = false,
  labelClassName = "",
  endAdornment = null,
  ...props
}: InputProps) {
  const reactId = useId();
  const inputId = id || reactId;
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const computedType = type === "password" && isPasswordVisible ? "text" : type;
  
  const hasPasswordToggle = enablePasswordToggle && type === "password";
  const hasEndAdornment = Boolean(endAdornment);
  const inputPaddingClasses = hasPasswordToggle || hasEndAdornment ? "pr-10" : "";

  const baseClasses = "w-full px-3 py-2 border rounded-lg transition-colors bg-background text-foreground";
  const focusClasses = noFocusRing
    ? "focus:outline-none focus:ring-0 focus:ring-offset-0"
    : "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent";
  const errorClasses = error
    ? "border-destructive focus:ring-destructive"
    : "border-input";

  if (!label && !error && !helperText && !hasPasswordToggle && !hasEndAdornment) {
    // Simple input without wrapper
    return (
      <input
        type={computedType || type}
        data-slot="input"
        className={cn(
          baseClasses,
          focusClasses,
          errorClasses,
          className
        )}
        {...props}
      />
    );
  }

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            "block text-sm font-medium text-muted-foreground",
            labelClassName
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={cn(
            baseClasses,
            focusClasses,
            errorClasses,
            inputPaddingClasses,
            className
          )}
          type={computedType || type}
          {...props}
        />
        {hasPasswordToggle && (
          <button
            type="button"
            onClick={() => setIsPasswordVisible((v) => !v)}
            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground text-xs"
          >
            {isPasswordVisible ? "Hide" : "Show"}
          </button>
        )}
        {hasEndAdornment && (
          <div
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground"
            aria-hidden="true"
          >
            {endAdornment}
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

export { Input };
