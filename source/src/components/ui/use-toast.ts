'use client'

/**
 * Re-export the canonical toast store used by `<Toaster />` in `hooks/use-toast`.
 * Call sites must share that module — a duplicate store here made toasts invisible.
 */
export { useToast, toast } from '@/hooks/use-toast'
