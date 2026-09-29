import { AI_TOOL_NAME } from "@/lib/ai-transparency"

export const GDPR_CONTACT_EMAIL = "privacy@example.com"

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: "Data controller",
    body: `${AI_TOOL_NAME} processes personal data you enter (CV text, job applications, cover letters, contact details) to provide document editing and AI-assisted suggestions. You remain the data controller for content you export and send to employers.`,
  },
  {
    title: "Lawful basis",
    body: "We process your data based on contract performance (providing the service you request) and your consent where required (e.g. optional AI features, optional personal learning). You may withdraw consent by disabling AI features or deleting your data.",
  },
  {
    title: "What we store",
    body: "CV versions, application records, cover letters, strategic notes, AI activity logs, and browser-local preferences. AI chat history may be stored in your browser session until cleared.",
  },
  {
    title: "Retention",
    body: "Data is retained while your workspace exists on this device or cloud sync is enabled. You can delete CVs, applications, cover letters, or all account data at any time via the Privacy Centre.",
  },
  {
    title: "Your rights (GDPR)",
    body: "You have the right to access, rectify, erase, restrict processing, data portability, and object. Use Export My Data or deletion tools in the Privacy Centre. You may lodge a complaint with your supervisory authority.",
  },
  {
    title: "International transfers",
    body: "If AI features are enabled, document excerpts may be sent to AI providers (e.g. OpenAI, Anthropic) which may process data outside the EEA. See AI Usage Information for provider-specific details.",
  },
] as const

export const TERMS_OF_SERVICE_SECTIONS = [
  {
    title: "Service description",
    body: `${AI_TOOL_NAME} helps you create and tailor CVs and application materials. AI suggestions are assistive only — you are responsible for accuracy and final submissions.`,
  },
  {
    title: "Acceptable use",
    body: "Do not submit unlawful content or misrepresent qualifications. You must have the right to use any text, images, or data you upload.",
  },
  {
    title: "No warranty",
    body: "The tool is provided as-is. We do not guarantee interview outcomes, ATS compatibility, or error-free AI output.",
  },
  {
    title: "Limitation of liability",
    body: "To the extent permitted by law, we are not liable for employment decisions, rejected applications, or inaccuracies in AI-generated text you choose to use.",
  },
] as const

export const AI_DATA_USAGE_POINTS = [
  {
    id: "sent-to-providers",
    title: "Data sent to AI providers",
    body: "When you use AI features, excerpts of your CV, job description, selected text, and your instructions are transmitted to the configured AI provider to generate suggestions.",
  },
  {
    id: "providers",
    title: "Which providers receive data",
    body: "Depending on server configuration: OpenAI, Anthropic, or Vercel AI Gateway. The active provider is shown in AI Transparency.",
  },
  {
    id: "training",
    title: "Model training",
    body: "Your documents are processed to generate suggestions for you. They are not used to train AI models by this application. Refer to your AI provider's enterprise/API terms for their training policies.",
  },
  {
    id: "retention",
    title: "Data retention",
    body: "AI interaction history is stored locally in your browser and in your resume audit log when you accept or reject changes. Cloud-synced CV data follows your workspace retention until you delete it.",
  },
  {
    id: "control",
    title: "Your control",
    body: "No AI change is applied without your explicit Accept action. You can reject suggestions, compare versions, export your data, or delete all records at any time.",
  },
] as const
