"use client"

import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFormatterWorkspaceOptional } from "@/components/formatter-workspace-context"

export function FormatterPopoverShell({
  open,
  onClose,
  title,
  children,
  className,
  hideClose = false,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  hideClose?: boolean
}) {
  const workspace = useFormatterWorkspaceOptional()

  if (!open || !workspace?.workspaceRef.current) return null

  return createPortal(
    <div
      className={cn("formatter-popover", className)}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="formatter-popover__header">
        {title ? <span className="formatter-popover__title">{title}</span> : <span />}
        {hideClose ? (
          <span className="formatter-popover__close-spacer" aria-hidden />
        ) : (
          <button
            type="button"
            className="formatter-popover__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
      <div className="formatter-popover__body">{children}</div>
    </div>,
    workspace.workspaceRef.current,
  )
}

export function FormatterSidebarGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="formatter-sidebar-group">
      <p className="formatter-sidebar-eyebrow">{label}</p>
      <div className="formatter-sidebar-rows">{children}</div>
    </div>
  )
}

export function FormatterSidebarRow({
  icon: Icon,
  title,
  subtitle,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>
  title: string
  subtitle: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn("formatter-sidebar-row", active && "formatter-sidebar-row--active")}
      onClick={onClick}
    >
      <span className="formatter-sidebar-row__icon">
        <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="formatter-sidebar-row__text">
        <span className="formatter-sidebar-row__title">{title}</span>
        <span className="formatter-sidebar-row__subtitle">{subtitle}</span>
      </span>
      <span className="formatter-sidebar-row__chevron" aria-hidden>
        ›
      </span>
    </button>
  )
}

export function FormatterPopoverSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="formatter-popover-section">
      <p className="formatter-popover-eyebrow">{label}</p>
      {children}
    </div>
  )
}

export function FormatterDarkField({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="formatter-dark-field">
      <label className="formatter-dark-field__label">{label}</label>
      {children}
      {hint ? <p className="formatter-dark-field__hint">{hint}</p> : null}
    </div>
  )
}

export function FormatterDarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("formatter-dark-input", props.className)} />
}

export function FormatterDarkTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea {...props} className={cn("formatter-dark-textarea", props.className)} />
}

export function FormatterToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="formatter-toggle-row"
      onClick={() => {
        if (disabled) return
        onChange(!checked)
      }}
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
    >
      <span className="formatter-toggle-row__text">
        <span className="formatter-toggle-row__label">{label}</span>
        {description ? (
          <span className="formatter-toggle-row__desc">{description}</span>
        ) : null}
      </span>
      <span className={cn("formatter-toggle", checked && "formatter-toggle--on")}>
        <span className="formatter-toggle__knob" />
      </span>
    </button>
  )
}

export function FormatterSwatchPill({
  name,
  hex,
  selected,
  onClick,
  showHex = true,
}: {
  name: string
  hex: string
  selected: boolean
  onClick: () => void
  showHex?: boolean
}) {
  return (
    <button
      type="button"
      className={cn("formatter-swatch-pill", selected && "formatter-swatch-pill--active")}
      onClick={onClick}
    >
      {showHex ? (
        <span
          className="formatter-swatch-pill__dot"
          style={{ backgroundColor: hex || "transparent" }}
        />
      ) : null}
      {name}
    </button>
  )
}
