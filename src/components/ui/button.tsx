import * as React from "react"
import { cn } from "@/src/lib/utils"

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' }>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2",
          variant === 'default' && "bg-slate-900 text-white hover:bg-slate-900/90",
          variant === 'outline' && "border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900",
          variant === 'ghost' && "hover:bg-slate-100 hover:text-slate-900",
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
