import type { CareerPhrase, PhraseCategory, PhraseCategoryId } from "@/lib/phrase-library/types"

export const PHRASE_CATEGORIES: PhraseCategory[] = [
  {
    id: "career-direction",
    label: "Career direction",
    description: "How you describe where you're heading",
  },
  {
    id: "professional-strengths",
    label: "Professional strengths",
    description: "Qualities employers notice in you",
  },
  {
    id: "transferable-skills",
    label: "Transferable skills",
    description: "Experience that travels across industries",
  },
  {
    id: "values",
    label: "Values",
    description: "What matters to you at work",
  },
  {
    id: "motivation",
    label: "Motivation",
    description: "What drives you day to day",
  },
  {
    id: "career-goals",
    label: "Career goals",
    description: "Where you want to grow",
  },
  {
    id: "confidence-builders",
    label: "Confidence builders",
    description: "Reminders of what you bring",
  },
]

function p(
  id: string,
  categoryId: PhraseCategoryId,
  title: string,
  example: string,
  goodFor: string[],
  relatedIds: string[],
  tags: string[] = [],
): CareerPhrase {
  return { id, categoryId, title, example, goodFor, relatedIds, tags }
}

export const CAREER_PHRASES: CareerPhrase[] = [
  // Career direction
  p(
    "cd-learning",
    "career-direction",
    "Learning and contributing",
    "I am looking for opportunities where I can continue learning and contribute my experience.",
    ["Career story", "Cover letters", "Interviews"],
    ["cg-develop", "mot-learning"],
    ["learning", "growth", "contribute"],
  ),
  p(
    "cd-practical-people",
    "career-direction",
    "Practical problem solver",
    "I enjoy solving practical problems and working with people.",
    ["Career story", "Team roles", "Customer-facing jobs"],
    ["ps-problem-solving", "ps-team-player"],
    ["practical", "people", "problem solving"],
  ),
  p(
    "cd-germany-long-term",
    "career-direction",
    "Long-term career in Germany",
    "I would like to build a long-term career in Germany.",
    ["Career story", "Motivation questions", "Cover letters"],
    ["cg-long-term", "cb-international"],
    ["germany", "long-term", "career"],
  ),

  // Professional strengths
  p(
    "ps-communication",
    "professional-strengths",
    "Strong communication skills",
    "I communicate clearly with colleagues, customers, and managers — in person and in writing.",
    ["Administration", "Healthcare", "Retail", "Education"],
    ["ps-customer-focused", "ps-team-player"],
    ["communication", "writing", "speaking"],
  ),
  p(
    "ps-organised",
    "professional-strengths",
    "Organised and reliable",
    "I enjoy organising work efficiently and making sure tasks are completed on time.",
    ["Administration", "Office", "Retail", "Healthcare", "Education"],
    ["ps-attention-detail", "ts-documentation"],
    ["organised", "reliable", "planning", "time management"],
  ),
  p(
    "ps-quick-learner",
    "professional-strengths",
    "Quick learner",
    "I pick up new tools, processes, and responsibilities quickly — and I'm not afraid to ask questions.",
    ["Career changers", "New roles", "Training periods"],
    ["mot-learning", "cb-still-learning"],
    ["learning", "adaptable", "curious"],
  ),
  p(
    "ps-adaptable",
    "professional-strengths",
    "Adaptable",
    "I adapt well to new teams, environments, and ways of working.",
    ["International experience", "Career changes", "Start-ups"],
    ["ps-quick-learner", "cb-transferable"],
    ["adaptable", "flexible", "change"],
  ),
  p(
    "ps-attention-detail",
    "professional-strengths",
    "Attention to detail",
    "I notice small details that matter — whether it's data, documents, or customer needs.",
    ["Administration", "Finance", "Healthcare", "Quality"],
    ["ps-organised", "ts-documentation"],
    ["detail", "accuracy", "quality"],
  ),
  p(
    "ps-customer-focused",
    "professional-strengths",
    "Customer focused",
    "I focus on understanding what people need and delivering a positive experience.",
    ["Retail", "Hospitality", "Healthcare", "Service"],
    ["ts-customers", "ps-calm-pressure"],
    ["customer", "service", "hospitality"],
  ),
  p(
    "ps-calm-pressure",
    "professional-strengths",
    "Calm under pressure",
    "I stay calm when things are busy or unpredictable, and I help others do the same.",
    ["Healthcare", "Hospitality", "Retail", "Logistics"],
    ["ps-team-player", "ts-problem-solving"],
    ["pressure", "stress", "busy"],
  ),
  p(
    "ps-team-player",
    "professional-strengths",
    "Team player",
    "I work well with others — sharing tasks, supporting colleagues, and celebrating shared wins.",
    ["Most roles", "Interviews", "Cover letters"],
    ["mot-collaborative", "ps-leadership"],
    ["team", "collaboration", "teamwork"],
  ),
  p(
    "ps-leadership",
    "professional-strengths",
    "Leadership",
    "I take initiative, support others, and help teams move forward — even without a formal title.",
    ["Management track", "Project roles", "Mentoring"],
    ["ts-training", "cg-responsibility"],
    ["leadership", "initiative", "management"],
  ),
  p(
    "ps-coordination",
    "professional-strengths",
    "Project coordination",
    "I coordinate tasks, timelines, and communication so projects stay on track.",
    ["Project management", "Office", "Events"],
    ["ps-organised", "ts-documentation"],
    ["coordination", "projects", "planning"],
  ),

  // Transferable skills
  p(
    "ts-customers",
    "transferable-skills",
    "Working with customers",
    "I have experience helping customers — listening to their needs, answering questions, and resolving issues.",
    ["Retail", "Hospitality", "Healthcare", "Call centres"],
    ["ps-customer-focused", "ps-calm-pressure"],
    ["customer", "retail", "hospitality", "service"],
  ),
  p(
    "ts-schedules",
    "transferable-skills",
    "Managing schedules",
    "I'm used to planning shifts, appointments, or deadlines and keeping everyone informed.",
    ["Administration", "Healthcare", "Logistics"],
    ["ps-organised", "ps-coordination"],
    ["scheduling", "planning", "administration"],
  ),
  p(
    "ts-training",
    "transferable-skills",
    "Training colleagues",
    "I've helped new colleagues learn their role — explaining processes patiently and checking understanding.",
    ["Healthcare", "Retail", "Manufacturing", "Education"],
    ["ps-leadership", "ts-teaching"],
    ["training", "onboarding", "mentoring"],
  ),
  p(
    "ts-problem-solving",
    "transferable-skills",
    "Problem solving",
    "When something goes wrong, I look for practical solutions instead of giving up.",
    ["Most industries", "Interviews", "Cover letters"],
    ["cd-practical-people", "ps-calm-pressure"],
    ["problem solving", "solutions", "practical"],
  ),
  p(
    "ts-documentation",
    "transferable-skills",
    "Documentation",
    "I keep clear records — notes, reports, or handover documents — so nothing gets lost.",
    ["Healthcare", "Administration", "Engineering"],
    ["ps-attention-detail", "ps-organised"],
    ["documentation", "records", "administration"],
  ),
  p(
    "ts-research",
    "transferable-skills",
    "Research",
    "I gather information, compare options, and summarise what matters for a decision.",
    ["Academic", "Marketing", "Product", "Healthcare"],
    ["ps-attention-detail", "ts-documentation"],
    ["research", "analysis"],
  ),
  p(
    "ts-teaching",
    "transferable-skills",
    "Teaching",
    "I explain ideas clearly and adjust my approach for different learners.",
    ["Education", "Training", "Healthcare", "Childcare"],
    ["ts-training", "ps-communication"],
    ["teaching", "education", "training"],
  ),
  p(
    "ts-healthcare",
    "transferable-skills",
    "Healthcare experience",
    "I have hands-on experience caring for people — with empathy, safety, and attention to detail.",
    ["Healthcare", "Social work", "Care"],
    ["ps-calm-pressure", "val-helping"],
    ["healthcare", "nursing", "care"],
  ),
  p(
    "ts-administration",
    "transferable-skills",
    "Administration",
    "I handle emails, files, appointments, and office tasks reliably and discreetly.",
    ["Office", "Public sector", "Healthcare"],
    ["ps-organised", "ts-documentation"],
    ["administration", "office"],
  ),
  p(
    "ts-retail",
    "transferable-skills",
    "Retail",
    "I've worked in fast-paced retail — serving customers, handling payments, and keeping displays organised.",
    ["Retail", "Hospitality", "Sales"],
    ["ts-customers", "ps-calm-pressure"],
    ["retail", "sales", "shop"],
  ),
  p(
    "ts-hospitality",
    "transferable-skills",
    "Hospitality",
    "I've worked in hospitality — welcoming guests, coordinating service, and staying positive under pressure.",
    ["Hotels", "Restaurants", "Events"],
    ["ts-customers", "ps-team-player"],
    ["hospitality", "hotel", "restaurant", "service"],
  ),
  p(
    "ts-childcare",
    "transferable-skills",
    "Childcare",
    "I have experience supporting children's safety, learning, and wellbeing with patience and care.",
    ["Education", "Social work", "Care"],
    ["val-helping", "ts-teaching"],
    ["childcare", "children", "education"],
  ),
  p(
    "ts-engineering",
    "transferable-skills",
    "Engineering",
    "I apply technical knowledge to solve real-world problems — with precision and accountability.",
    ["Manufacturing", "Construction", "IT"],
    ["ts-problem-solving", "ps-attention-detail"],
    ["engineering", "technical"],
  ),
  p(
    "ts-design",
    "transferable-skills",
    "Design",
    "I think visually and practically — turning ideas into layouts, products, or experiences people can use.",
    ["Creative", "Marketing", "Product"],
    ["ts-research", "val-innovation"],
    ["design", "creative", "ux"],
  ),
  p(
    "ts-it",
    "transferable-skills",
    "IT",
    "I'm comfortable with digital tools — learning software, troubleshooting issues, and supporting others.",
    ["Office", "Tech", "Administration"],
    ["ps-quick-learner", "ts-problem-solving"],
    ["it", "technology", "software"],
  ),
  p(
    "ts-finance",
    "transferable-skills",
    "Finance",
    "I work carefully with numbers, budgets, and records — checking details and following procedures.",
    ["Accounting", "Administration", "Retail"],
    ["ps-attention-detail", "val-reliability"],
    ["finance", "accounting", "numbers"],
  ),
  p(
    "ts-manufacturing",
    "transferable-skills",
    "Manufacturing",
    "I follow safety and quality standards on the production line and work steadily as part of a team.",
    ["Production", "Logistics", "Engineering"],
    ["ps-team-player", "val-quality"],
    ["manufacturing", "production", "factory"],
  ),
  p(
    "ts-logistics",
    "transferable-skills",
    "Logistics",
    "I coordinate deliveries, stock, or transport — keeping track of details and deadlines.",
    ["Warehouse", "Supply chain", "Retail"],
    ["ps-organised", "ts-schedules"],
    ["logistics", "warehouse", "supply chain"],
  ),

  // Values
  p("val-helping", "values", "Helping people", "Helping others is what motivates me most at work.", ["Healthcare", "Social work", "Education"], ["mot-meaningful", "ts-healthcare"], ["helping", "care"]),
  p("val-learning", "values", "Learning", "I value workplaces where I can keep learning and improving.", ["Career story", "Interviews"], ["mot-learning", "cd-learning"], ["learning", "growth"]),
  p("val-quality", "values", "Quality", "I take pride in doing work properly — not just quickly.", ["Manufacturing", "Healthcare", "Engineering"], ["ps-attention-detail", "val-reliability"], ["quality", "standards"]),
  p("val-reliability", "values", "Reliability", "People can count on me to show up, follow through, and communicate honestly.", ["Most roles", "References"], ["ps-organised", "val-trust"], ["reliability", "trust"]),
  p("val-innovation", "values", "Innovation", "I enjoy finding better ways to do things — small improvements that add up.", ["Tech", "Creative", "Start-ups"], ["cd-practical-people", "ts-design"], ["innovation", "improvement"]),
  p("val-community", "values", "Community", "I care about working somewhere that contributes positively to the community.", ["Non-profit", "Public sector", "Education"], ["val-helping", "mot-meaningful"], ["community", "social"]),
  p("val-fairness", "values", "Fairness", "Fair treatment and respect matter deeply to me.", ["Interviews", "Career story"], ["val-respect", "val-trust"], ["fairness", "equality"]),
  p("val-sustainability", "values", "Sustainability", "I want my work to support sustainable, responsible practices.", ["Green jobs", "Manufacturing", "Policy"], ["val-community", "val-quality"], ["sustainability", "environment"]),
  p("val-accessibility", "values", "Accessibility", "I believe products, services, and workplaces should be accessible to everyone.", ["Design", "Public sector", "Tech"], ["val-helping", "val-respect"], ["accessibility", "inclusion"]),
  p("val-respect", "values", "Respect", "Mutual respect makes teams stronger — I treat colleagues and customers with dignity.", ["All roles", "Interviews"], ["val-fairness", "ps-team-player"], ["respect", "dignity"]),
  p("val-trust", "values", "Trust", "I build trust by being honest, consistent, and open to feedback.", ["Leadership", "Healthcare", "Client work"], ["val-reliability", "ps-communication"], ["trust", "honesty"]),

  // Motivation
  p("mot-positive", "motivation", "Positive contribution", "I enjoy making a positive contribution — even in small, everyday ways.", ["Cover letters", "Interviews"], ["val-helping", "mot-meaningful"], ["contribution", "impact"]),
  p("mot-collaborative", "motivation", "Collaborative teams", "I like working in collaborative teams where people support each other.", ["Team roles", "Interviews"], ["ps-team-player", "val-respect"], ["team", "collaboration"]),
  p("mot-learning", "motivation", "Learning new skills", "I enjoy learning new skills and putting them into practice.", ["Career changers", "Training"], ["ps-quick-learner", "val-learning"], ["learning", "skills"]),
  p("mot-meaningful", "motivation", "Meaningful work", "I am motivated by meaningful work that aligns with my values.", ["Career story", "Non-profit"], ["val-helping", "mot-positive"], ["meaningful", "purpose"]),

  // Career goals
  p("cg-develop", "career-goals", "Continue developing", "I want to continue developing professionally and taking on new challenges.", ["Interviews", "Career story"], ["cd-learning", "mot-learning"], ["development", "growth"]),
  p("cg-responsibility", "career-goals", "More responsibility", "I would like to take on more responsibility over time.", ["Promotion conversations", "Interviews"], ["ps-leadership", "cg-develop"], ["responsibility", "leadership"]),
  p("cg-long-term", "career-goals", "Long-term career", "I hope to build a stable, long-term career where I can grow and contribute.", ["Career story", "Cover letters"], ["cd-germany-long-term", "cg-develop"], ["long-term", "stability"]),
  p("cg-international", "career-goals", "International experience", "I want to contribute my international experience and perspective.", ["Career story", "Global companies"], ["cb-international", "cb-perspective"], ["international", "global"]),

  // Confidence builders
  p("cb-international", "confidence-builders", "Valuable international experience", "I have valuable experience from another country — and I'm ready to bring it here.", ["Career story", "Interviews"], ["cg-international", "cb-transferable"], ["international", "migration"]),
  p("cb-transferable", "confidence-builders", "Transferable skills", "My skills are transferable — they may look different on paper, but they matter in practice.", ["Career changers", "Recognition"], ["ps-adaptable", "cb-journey"], ["transferable", "skills"]),
  p("cb-still-learning", "confidence-builders", "Still learning — and that's okay", "I am still learning, and that's okay. I'm committed to growing step by step.", ["Interviews", "Career story"], ["ps-quick-learner", "mot-learning"], ["learning", "growth", "confidence"]),
  p("cb-perspective", "confidence-builders", "Unique perspective", "I bring a unique perspective that can help teams see problems differently.", ["Interviews", "Creative roles"], ["cg-international", "cb-journey"], ["perspective", "diversity"]),
  p("cb-journey", "confidence-builders", "Journey as strength", "My journey is part of my strength — it taught me resilience, empathy, and adaptability.", ["Career story", "Cover letters"], ["cb-transferable", "ps-adaptable"], ["journey", "resilience"]),
]

export const PHRASE_BY_ID: Record<string, CareerPhrase> = Object.fromEntries(
  CAREER_PHRASES.map((phrase) => [phrase.id, phrase]),
)

export function phrasesForCategory(categoryId: PhraseCategoryId): CareerPhrase[] {
  return CAREER_PHRASES.filter((p) => p.categoryId === categoryId)
}

export function relatedPhrases(phrase: CareerPhrase): CareerPhrase[] {
  return phrase.relatedIds
    .map((id) => PHRASE_BY_ID[id])
    .filter((p): p is CareerPhrase => Boolean(p))
}
