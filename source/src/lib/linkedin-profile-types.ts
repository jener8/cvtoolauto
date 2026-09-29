export type LinkedInProfileSections = {
  about: string
  experience: string
  projects: string
  education: string
  certificates: string
  skills: string
}

export const EMPTY_LINKEDIN_SECTIONS: LinkedInProfileSections = {
  about: "",
  experience: "",
  projects: "",
  education: "",
  certificates: "",
  skills: "",
}

export const LINKEDIN_SECTION_LABELS: Record<keyof LinkedInProfileSections, string> = {
  about: "About",
  experience: "Work history",
  projects: "Projects",
  education: "Education",
  certificates: "Certificates",
  skills: "Skills",
}
