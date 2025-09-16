import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const glassButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden group",
  {
    variants: {
      variant: {
        default: "bg-white/20 text-white border border-white/30 backdrop-filter backdrop-blur-[10px] hover:bg-white/30 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-105",
        primary: "bg-blue-500/20 text-white border border-blue-400/40 backdrop-filter backdrop-blur-[10px] hover:bg-blue-400/30 hover:border-blue-300/60 hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] hover:scale-105",
        secondary: "bg-slate-500/20 text-slate-100 border border-slate-400/30 backdrop-filter backdrop-blur-[10px] hover:bg-slate-400/30 hover:border-slate-300/50 hover:shadow-[0_0_20px_rgba(148,163,184,0.3)] hover:scale-105",
        destructive: "bg-red-500/20 text-white border border-red-400/40 backdrop-filter backdrop-blur-[10px] hover:bg-red-400/30 hover:border-red-300/60 hover:shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:scale-105",
        outline: "border border-white/40 backdrop-filter backdrop-blur-[10px] hover:bg-white/10 hover:border-cyan-400/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:scale-105",
        ghost: "backdrop-filter backdrop-blur-[10px] hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-105",
        link: "text-cyan-300 underline-offset-4 hover:underline hover:text-cyan-200 hover:scale-105",
        neon: "bg-cyan-500/10 text-cyan-100 border border-cyan-400/50 backdrop-filter backdrop-blur-[10px] hover:bg-cyan-400/20 hover:border-cyan-300/70 hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] hover:scale-110 shadow-[0_0_15px_rgba(34,211,238,0.2)]",
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
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-cyan-400/20 blur-sm -z-10" />
      </Comp>
    )
  }
)
GlassButton.displayName = "GlassButton"

export { GlassButton, glassButtonVariants }