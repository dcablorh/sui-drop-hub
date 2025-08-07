import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ComponentProps } from "react";

interface GradientCardProps extends ComponentProps<typeof Card> {
  variant?: "default" | "glow" | "hero";
}

export function GradientCard({ className, variant = "default", ...props }: GradientCardProps) {
  return (
    <Card
      className={cn(
        "bg-gradient-card border-border/50 shadow-card transition-all duration-300",
        {
          "hover:shadow-glow hover:border-primary/30": variant === "glow",
          "bg-gradient-hero border-primary/20": variant === "hero",
        },
        className
      )}
      {...props}
    />
  );
}