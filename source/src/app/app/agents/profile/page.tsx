import { notFound } from "next/navigation"
import { isJobAgentEnabled } from "@/lib/agents/feature-flag"
import { AgentProfilePage } from "@/components/agents/agent-profile-page"

export default function AgentsProfileRoutePage() {
  if (!isJobAgentEnabled()) {
    notFound()
  }
  return <AgentProfilePage />
}
