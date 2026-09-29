"use client"

type MobilePlaceholderProps = {
  title: string
  description: string
}

/** Stub screen for mobile tabs not built yet. */
export function MobilePlaceholder({ title, description }: MobilePlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-600">{description}</p>
      <p className="mt-6 max-w-sm text-xs leading-relaxed text-zinc-500">
        Full editing stays on desktop. This phone view is a companion for the essentials.
      </p>
    </div>
  )
}
