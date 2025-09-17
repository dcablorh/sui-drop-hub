import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const glassButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden group",
  {
    variants: {
      variant: {
        default: "bg-[#3890FF]/30 text-white border border-[#1E70D6]/60 backdrop-filter backdrop-blur-[10px] hover:bg-[#3890FF]/40 hover:border-[#1E70D6]/80 hover:shadow-[0_0_25px_rgba(56,144,255,0.5)] hover:scale-105 shadow-[0_0_15px_rgba(56,144,255,0.3)]",
        primary: "bg-[#3890FF]/20 text-white border border-[#1E70D6]/50 backdrop-filter backdrop-blur-[10px] hover:bg-[#3890FF]/30 hover:border-[#1E70D6]/70 hover:shadow-[0_0_25px_rgba(56,144,255,0.4)] hover:scale-105",
        secondary: "bg-[#5727F5]/20 text-white border border-[#1E70D6]/40 backdrop-filter backdrop-blur-[10px] hover:bg-[#5727F5]/30 hover:border-[#1E70D6]/60 hover:shadow-[0_0_20px_rgba(87,39,245,0.3)] hover:scale-105",
        destructive: "bg-red-500/20 text-white border border-red-400/40 backdrop-filter backdrop-blur-[10px] hover:bg-red-400/30 hover:border-red-300/60 hover:shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:scale-105",
        outline: "border border-[#1E70D6]/50 backdrop-filter backdrop-blur-[10px] hover:bg-[#3890FF]/10 hover:border-[#1E70D6]/70 hover:shadow-[0_0_20px_rgba(30,112,214,0.3)] hover:scale-105",
        ghost: "backdrop-filter backdrop-blur-[10px] hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-105",
        link: "text-cyan-300 underline-offset-4 hover:underline hover:text-cyan-200 hover:scale-105",
        neon: "bg-[#3890FF]/15 text-white border border-[#1E70D6]/60 backdrop-filter backdrop-blur-[10px] hover:bg-[#3890FF]/25 hover:border-[#1E70D6]/80 hover:shadow-[0_0_30px_rgba(56,144,255,0.6)] hover:scale-110 shadow-[0_0_15px_rgba(56,144,255,0.3)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(glassButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {/* Subtle inner glow effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Content */}
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
        
        {/* Animated border glow */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-[#1E70D6]/30 via-[#3890FF]/30 to-[#1E70D6]/30 blur-sm -z-10" />
      </Comp>
    )
  }
)
GlassButton.displayName = "GlassButton"

export { GlassButton, glassButtonVariants }