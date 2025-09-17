import { cn } from "@/lib/utils";
import { ComponentProps } from "react";

interface GlassCardProps extends ComponentProps<"div"> {
  variant?: "default" | "glow" | "hero" | "frosted";
  intensity?: "light" | "medium" | "heavy";
}

export function GlassCard({ 
  className, 
  variant = "default", 
  intensity = "medium",
  children,
  ...props 
}: GlassCardProps) {
  const intensityClasses = {
    light: "backdrop-blur-[8px] bg-white/10",
    medium: "backdrop-blur-[12px] bg-white/15", 
    heavy: "backdrop-blur-[16px] bg-white/20"
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-white/20 shadow-xl transition-all duration-300",
        intensityClasses[intensity],
        {
          "hover:shadow-[0_0_30px_rgba(56,144,255,0.4)] hover:border-[#1E70D6]/50 hover:scale-[1.02]": variant === "glow",
          "bg-gradient-to-br from-white/20 via-white/10 to-white/5 border-white/30": variant === "hero",
          "backdrop-blur-[20px] bg-white/25 border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.3)]": variant === "frosted",
        },
        className
      )}
      {...props}
    >
      {/* Inner glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}