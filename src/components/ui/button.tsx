import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline" | "success" | "warning";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
  const variants = {
    primary:
      "bg-white/10 text-white shadow-lg shadow-black/20 backdrop-blur hover:bg-white/15 focus-visible:outline-white/40 border border-white/10",
    ghost: "bg-transparent text-white/80 hover:bg-white/5 border border-transparent",
    danger: "bg-red-500/20 text-red-100 border border-red-400/30 hover:bg-red-500/30",
    outline: "border border-white/20 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/30",
    success:
      "border border-emerald-400/50 bg-emerald-500/20 text-emerald-50 shadow-inner shadow-emerald-900/20 hover:bg-emerald-500/30",
    warning:
      "border border-amber-400/45 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25",
  };
  return <button type={type} className={cn(base, variants[variant], className)} {...props} />;
}
