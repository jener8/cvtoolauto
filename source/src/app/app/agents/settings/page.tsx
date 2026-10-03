import { notFound } from "next/navigation"
import { isJobAgentEnabled } from "@/lib/agents/feature-flag"
import { AgentSettingsPage } from "@/components/agents/agent-settings-page"

export default function AgentsSettingsRoutePage() {
  if (!isJobAgentEnabled()) {
    notFound()
  }
  return <AgentSettingsPage />
}
