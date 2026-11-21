import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
export function Button({ asChild, variant = "primary", className = "", ...props }: ComponentProps<"button"> & { asChild?: boolean; variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const Component = asChild ? Slot : "button";
  return <Component className={`button ${variant} ${className}`} {...props} />;
}
