import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
  const variants = {
    primary:
      "bg-white/10 text-white shadow-lg shadow-black/20 backdrop-blur hover:bg-white/15 focus-visible:outline-white/40 border border-white/10",
    ghost: "bg-transparent text-white/80 hover:bg-white/5 border border-transparent",
    danger: "bg-red-500/20 text-red-100 border border-red-400/30 hover:bg-red-500/30",
  };
  return <button type={type} className={cn(base, variants[variant], className)} {...props} />;
}
