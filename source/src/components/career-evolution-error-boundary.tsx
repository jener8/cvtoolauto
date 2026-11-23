"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = {
  children: ReactNode
  /** Compact message for formatter popover vs preview. */
  variant?: "panel" | "preview"
  /** Optional reset key — remounts children when it changes after an error. */
  resetKey?: string
}

type State = {
  hasError: boolean
  message: string | null
}

/**
 * Isolates Career Evolution UI failures so Graph text / SVG bugs cannot
 * blank the rest of the CV editor.
 */
export class CareerEvolutionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "Career Evolution failed unexpectedly."
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[career-evolution] UI error boundary:", error, info.componentStack)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: null })
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const isPanel = this.props.variant !== "preview"
    return (
      <div
        className={
          isPanel
            ? "formatter-career-evolution__messages formatter-career-evolution__messages--error"
            : "career-evolution-error-fallback"
        }
        role="alert"
        style={
          isPanel
            ? undefined
            : {
                margin: "8px 0",
                padding: "10px 12px",
                border: "1px solid #d4a017",
                borderRadius: 4,
                background: "#fffbeb",
                color: "#5c4a00",
                fontSize: 12,
                lineHeight: 1.4,
              }
        }
      >
        <p style={{ margin: "0 0 6px", fontWeight: 600 }}>
          Career Evolution could not be displayed.
        </p>
        <p style={{ margin: "0 0 8px" }}>
          {this.state.message ||
            "Check Graph text for missing TRACK headings, dates, or CONNECTION labels. Your typed text was kept so you can fix it."}
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className={isPanel ? "formatter-popover-btn formatter-popover-btn--ghost" : undefined}
          style={
            isPanel
              ? undefined
              : {
                  fontSize: 12,
                  padding: "4px 10px",
                  border: "1px solid #c4a035",
                  borderRadius: 4,
                  background: "#fff",
                  cursor: "pointer",
                }
          }
        >
          Try again
        </button>
      </div>
    )
  }
}
