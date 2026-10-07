import { notFound } from "next/navigation"
import { isJobAgentEnabled } from "@/lib/agents/feature-flag"
import { AgentsHomePage } from "@/components/agents/agents-home-page"

export default function AgentsRoutePage() {
  if (!isJobAgentEnabled()) {
    notFound()
  }
  return <AgentsHomePage />
}
