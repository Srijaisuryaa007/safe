import * as React from "react"
import { cn } from "@/lib/utils"

export interface FrameProps extends React.HTMLAttributes<HTMLDivElement> {
  stacked?: boolean
}

const Frame = React.forwardRef<HTMLDivElement, FrameProps>(
  ({ className, stacked = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        stacked && "divide-y divide-zinc-200 dark:divide-zinc-800",
        className
      )}
      {...props}
    />
  )
)
Frame.displayName = "Frame"

export interface FramePanelProps extends React.HTMLAttributes<HTMLDivElement> {}

const FramePanel = React.forwardRef<HTMLDivElement, FramePanelProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative overflow-hidden p-4", className)}
      {...props}
    />
  )
)
FramePanel.displayName = "FramePanel"

export { Frame, FramePanel }
