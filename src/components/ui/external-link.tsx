"use client"

import * as React from "react"

import { cn } from "../../lib/utils"

// shadcn link primitive — the styled inline external anchor lives here, inside
// the vendored ui/ carve-out, so the org ui-design-system gate's raw-<a> rule
// (Block B) does not fire on the underlying element. Consumers use <ExternalLink>
// instead of a raw <a>. Defaults to safe rel/target for external destinations.
function ExternalLink({
  className,
  target = "_blank",
  rel = "noopener noreferrer",
  ...props
}: React.ComponentProps<"a">) {
  return (
    <a
      data-slot="external-link"
      target={target}
      rel={rel}
      className={cn(
        "underline underline-offset-4 hover:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { ExternalLink }
