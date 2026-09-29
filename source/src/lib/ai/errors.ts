import {
  APICallError,
  EmptyResponseBodyError,
  InvalidPromptError,
  InvalidResponseDataError,
  LoadAPIKeyError,
  NoContentGeneratedError,
  NoSuchModelError,
} from "ai"

export type AiErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "model_not_found"
  | "quota_exceeded"
  | "malformed_request"
  | "timeout"
  | "rate_limit"
  | "api_error"
  | "empty_response"
  | "parse_error"
  | "validation_error"
  | "unknown"

export type ClassifiedAiError = {
  code: AiErrorCode
  message: string
  retryable: boolean
  statusCode?: number
  cause?: string
  /** OpenAI / provider error type when available */
  providerErrorType?: string
  providerErrorCode?: string
}

type ParsedApiBody = {
  type?: string
  code?: string
  message?: string
}

function parseApiErrorBody(error: APICallError): ParsedApiBody {
  const raw = error.responseBody
  if (!raw) return {}
  try {
    const json = typeof raw === "string" ? JSON.parse(raw) : raw
    const err = json?.error ?? json
    if (err && typeof err === "object") {
      return {
        type: typeof err.type === "string" ? err.type : undefined,
        code: typeof err.code === "string" ? err.code : undefined,
        message: typeof err.message === "string" ? err.message : undefined,
      }
    }
  } catch {
    /* ignore JSON parse errors */
  }
  return {}
}

function messageIndicatesQuota(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes("insufficient_quota") ||
    lower.includes("billing") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("payment") ||
    lower.includes("credit")
  )
}

function classifyFromApiCall(error: APICallError): ClassifiedAiError {
  const status = error.statusCode
  const body = parseApiErrorBody(error)
  const combined = `${error.message} ${body.message ?? ""} ${body.code ?? ""} ${body.type ?? ""}`

  const base = {
    statusCode: status,
    cause: error.message,
    providerErrorType: body.type,
    providerErrorCode: body.code,
  }

  if (status === 401 || body.code === "invalid_api_key" || body.type === "invalid_api_key") {
    return {
      ...base,
      code: "invalid_api_key",
      message:
        "Invalid OpenAI API key. Check OPENAI_API_KEY in .env.local and restart the dev server.",
      retryable: false,
    }
  }

  if (
    status === 404 ||
    body.code === "model_not_found" ||
    (combined.toLowerCase().includes("model") && combined.toLowerCase().includes("not found"))
  ) {
    return {
      ...base,
      code: "model_not_found",
      message: `OpenAI model not found. Set OPENAI_MODEL in .env.local or use a valid model ID.`,
      retryable: false,
    }
  }

  if (
    status === 402 ||
    status === 429 ||
    body.code === "insufficient_quota" ||
    body.type === "insufficient_quota" ||
    messageIndicatesQuota(combined)
  ) {
    return {
      ...base,
      code: "quota_exceeded",
      message:
        "OpenAI quota or billing limit reached. Check your OpenAI account billing and usage.",
      retryable: false,
    }
  }

  if (status === 400 || body.type === "invalid_request_error") {
    return {
      ...base,
      code: "malformed_request",
      message: body.message || "The AI request was rejected as invalid. Try again with shorter input.",
      retryable: false,
    }
  }

  if (status === 429) {
    return {
      ...base,
      code: "rate_limit",
      message: "OpenAI rate limit reached. Wait a moment and try again.",
      retryable: true,
    }
  }

  const retryable =
    status === 408 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    error.isRetryable ||
    !status

  return {
    ...base,
    code: "api_error",
    message: body.message || error.message || "The AI service returned an error.",
    retryable,
  }
}

export function classifyAiError(error: unknown): ClassifiedAiError {
  if (error instanceof LoadAPIKeyError) {
    return {
      code: "missing_api_key",
      message:
        "AI analysis requires an OpenAI API key. Configure OPENAI_API_KEY in your environment settings and restart the application.",
      retryable: false,
      cause: error.message,
    }
  }

  if (error instanceof NoSuchModelError) {
    return {
      code: "model_not_found",
      message: "The configured AI model was not found. Check OPENAI_MODEL in .env.local.",
      retryable: false,
      cause: error.message,
    }
  }

  if (error instanceof InvalidPromptError) {
    return {
      code: "malformed_request",
      message: "The generation prompt was invalid.",
      retryable: false,
      cause: error.message,
    }
  }

  if (error instanceof APICallError) {
    return classifyFromApiCall(error)
  }

  if (error instanceof EmptyResponseBodyError || error instanceof NoContentGeneratedError) {
    return {
      code: "empty_response",
      message: "The AI returned an empty response. Try again.",
      retryable: true,
      cause: error.message,
    }
  }

  if (error instanceof InvalidResponseDataError) {
    return {
      code: "parse_error",
      message: "Could not read the AI response. Try again.",
      retryable: true,
      cause: error.message,
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (error.name === "AbortError" || msg.includes("aborted") || msg.includes("timeout")) {
      return {
        code: "timeout",
        message: "Generation timed out. Try again with a shorter CV or job description.",
        retryable: true,
        cause: error.message,
      }
    }
    if (
      msg.includes("incorrect api key") ||
      msg.includes("invalid api key") ||
      msg.includes("authentication") ||
      msg.includes("unauthorized")
    ) {
      return {
        code: "invalid_api_key",
        message: "Invalid API key. Check OPENAI_API_KEY in .env.local.",
        retryable: false,
        cause: error.message,
      }
    }
    if (messageIndicatesQuota(msg)) {
      return {
        code: "quota_exceeded",
        message: "OpenAI quota or billing limit reached.",
        retryable: false,
        cause: error.message,
      }
    }
    if (msg.includes("model") && (msg.includes("not found") || msg.includes("does not exist"))) {
      return {
        code: "model_not_found",
        message: "AI model not found. Check OPENAI_MODEL in .env.local.",
        retryable: false,
        cause: error.message,
      }
    }
    if (
      msg.includes("api key") ||
      msg.includes("openai_api_key") ||
      msg.includes("anthropic_api_key") ||
      msg.includes("ai_gateway_api_key")
    ) {
      return {
        code: "missing_api_key",
        message:
          "AI analysis requires an OpenAI API key. Configure OPENAI_API_KEY in your environment settings and restart the application.",
        retryable: false,
        cause: error.message,
      }
    }
    return {
      code: "unknown",
      message: error.message || "AI generation failed.",
      retryable: true,
      cause: error.message,
    }
  }

  return {
    code: "unknown",
    message: "AI generation failed.",
    retryable: true,
  }
}
