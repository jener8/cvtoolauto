"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { Copy, Check } from "lucide-react";
import { buildCvReviewInsights } from "@/lib/cv-review-insights";
import { useFormatterWorkspaceOptional } from "@/components/formatter-workspace-context";
import { captureTextareaSelection } from "@/lib/assistant-selection-context";
import { useUndoableText } from "@/lib/use-undoable-text";
import {
  applyPortfolioSlotUpdate,
  normalizeContactInfo,
  withJobAdvertFromApplication,
} from "@/lib/contact-info";
import {
  compressLogoToDataUrl,
  compressProfilePhotoToDataUrl,
} from "@/lib/compress-image";
import {
  CHATGPT_INLINE_LINK_RULES_DE,
  CHATGPT_INLINE_LINK_RULES_EN,
  RESUME_INLINE_LINK_REGEX,
} from "@/lib/resume-inline-links";
import {
  CHATGPT_PAGE_BREAK_RULES_DE,
  CHATGPT_PAGE_BREAK_RULES_EN,
  MANUAL_PAGE_BREAK_MARKER,
} from "@/lib/resume-page-breaks";

import {
  ResumeFormatterSidebar,
  type EditPopoverId,
  type FormatterTab,
  type FormatterPopoverId,
  type TrustPopoverId,
} from "@/components/resume-formatter-sidebar";
import { translateTextWithRateLimit, clearTranslationRateLimit } from "@/lib/utils";
import { detectResumeBodyLanguage } from "@/lib/resume-language";
import {
  hasMatchingLanguageSnapshot,
  loadResumeLanguageCache,
  saveResumeLanguageCache,
  snapshotFromCurrent,
  sourceLanguageWasEdited,
  type ResumeLanguage,
  type ResumeLanguageCache,
} from "@/lib/resume-language-cache";
import {
  alignTranslatedResumeMarkup,
  hasPrematurePageBreak,
  removePrematurePageBreaks,
  shouldReplaceTruncatedTranslation,
} from "@/lib/resume-translate-markup";
import {
  normalizeResumeBuilderText,
  resumeBuilderTextNeedsNormalize,
} from "@/lib/parse-resume-text";

function buildResumeFormattingPromptEn(resumeText: string): string {
  return `Please help me format my resume content for an ATS-friendly resume formatter.

IMPORTANT FORMATTING RULES:

Use this markup syntax:
# Job Title or Degree Name
## Company Name or Institution Name  
### Date Range
- Bullet point for responsibilities, achievements, or details

${CHATGPT_INLINE_LINK_RULES_EN}

LENGTH:
- The resume must fit on exactly 2 A4 pages — keep it concise and do not make it too long
- Use fewer bullets per role and only the most relevant entries if needed

SKILLS:
- List at most 20 skill items total in the skills section

${CHATGPT_PAGE_BREAK_RULES_EN}

DO NOT INCLUDE:
- Name (goes in a separate field)
- Email, Phone, LinkedIn, Address (goes in separate contact info fields)
- Just provide the main resume sections with content

SECTIONS YOU CAN USE:
You can customize section titles and add sections as needed. Common sections:
- PROFIL (Profile/Summary)
- BERUFSERFAHRUNG (Work Experience)
- AUSBILDUNG (Education)
- EIGENPROJEKT & FORSCHUNG (Projects & Research)
- KI- & FACHLICHE KENNTNISSE (AI & Technical Skills)
- SPRACHEN (Languages)
- ZERTIFIZIERUNGEN (Certifications)
- PUBLIKATIONEN (Publications)
- EHRENAMT (Volunteer Work)
- SONSTIGES (Other/Additional Information)

EXAMPLE OUTPUT:

PROFIL
- Human-AI Interaction specialist. See project: [Trust Bridge](https://trustbridge.design).
- Passionate about AI and machine learning with focus on responsible AI practices
- Strong leadership and mentoring capabilities

BERUFSERFAHRUNG

# Senior Software Engineer
## Tech Solutions GmbH, Berlin
### März 2021 – heute
- Led development of microservices architecture serving 1M+ users
- Reduced API response time by 40% through optimization
- Mentored team of 3 junior developers

# Software Engineer
## StartUp Inc., München
### Juni 2019 – Februar 2021
- Built React-based dashboard for data visualization
- Implemented CI/CD pipeline reducing deployment time by 60%
- Collaborated with cross-functional teams on product roadmap

AUSBILDUNG

# Master of Science in Computer Science
## Technische Universität München
### Oktober 2017 – Mai 2019
- Focus on Machine Learning and Artificial Intelligence
- Thesis: "Deep Learning Approaches for Natural Language Processing"

# Bachelor of Science in Computer Science
## Ludwig-Maximilians-Universität München
### Oktober 2014 – September 2017

KI- & FACHLICHE KENNTNISSE
- Programming: Python, JavaScript, TypeScript, Java
- Frameworks: React, Node.js, Next.js, Django, Flask
- AI/ML: TensorFlow, PyTorch, scikit-learn, OpenAI API
- Cloud: AWS, Azure, Google Cloud Platform
- Databases: PostgreSQL, MongoDB, Redis
- Tools: Git, Docker, Kubernetes, Jenkins

SPRACHEN
- Deutsch (Muttersprache)
- Englisch (Fließend)

# User Experience Designer
${MANUAL_PAGE_BREAK_MARKER}
## Bundesdruckerei-Gruppe, Berlin
### 2020 – 2022
- Led UX design for secure digital identity products

---

**IMPORTANT: Write your entire formatted CV in a code block using triple backticks (\`\`\`) so I can easily copy and paste it into the resume formatter.**

Now please format my resume content following this structure with the markup syntax. Here's my information:

${resumeText || "[Paste your resume information here]"}`;
}

function buildResumeFormattingPromptDe(resumeText: string): string {
  return `Bitte formatiere meinen Lebenslauf für einen ATS-freundlichen Lebenslauf-Formatter.

WICHTIGE FORMATIERUNGSREGELN:

Verwende ausschließlich deutsche Abschnittsüberschriften im Lebenslauf, z. B. Profil, Berufserfahrung, Ausbildung, Fähigkeiten, Projekte, Zertifikate und Sprachen.

Verwende diese Markup-Syntax:
# Berufsbezeichnung oder Abschluss
## Unternehmens- oder Institutionenname
### Zeitraum
- Aufzählungspunkt für Aufgaben, Erfolge oder Details

${CHATGPT_INLINE_LINK_RULES_DE}

LÄNGE:
- Der Lebenslauf muss auf genau 2 A4-Seiten passen — kompakt halten, nicht zu lang
- Weniger Stichpunkte pro Rolle; nur die relevantesten Einträge behalten

FÄHIGKEITEN:
- Maximal 20 Kompetenz-Einträge im Abschnitt Fähigkeiten

${CHATGPT_PAGE_BREAK_RULES_DE}

NICHT EINFÜGEN:
- Name (eigenes Feld)
- E-Mail, Telefon, LinkedIn, Adresse (Kontaktfelder)
- Nur die Hauptabschnitte des Lebenslaufs mit Inhalt

NUTZBARE ABSCHNITTE (nur deutsche Überschriften — englische Titel wie Education, Experience, Skills, Profile, Projects vermeiden):
- PROFIL oder ZUSAMMENFASSUNG (Summary)
- BERUFSERFAHRUNG (Experience / Work Experience)
- AUSBILDUNG (Education)
- FÄHIGKEITEN (Skills)
- PROJEKTE (Projects)
- ZERTIFIKATE (Certifications)
- SPRACHEN (Languages)
- KONTAKT nur falls im Fließtext nötig

BEISPIELAUSGABE (nur deutsche Abschnittstitel):

PROFIL
- Human-AI-Interaction-Spezialistin. Projekt: [Trust Bridge](https://trustbridge.design).
- Schwerpunkt verantwortungsvolle KI und Machine Learning
- Führungs- und Mentoringkompetenz

BERUFSERFAHRUNG

# Senior Software Engineerin
## Tech Solutions GmbH, Berlin
### März 2021 – heute
- Leitung der Entwicklung einer Microservice-Architektur für über 1 Mio. Nutzer
- API-Antwortzeiten um 40 % reduziert
- Mentoring von drei Junior-Entwickler:innen

# Software Engineerin
## StartUp Inc., München
### Juni 2019 – Februar 2021
- React-Dashboard für Datenvisualisierung entwickelt
- CI/CD-Pipeline eingeführt, Deploy-Zeit um 60 % gesenkt

AUSBILDUNG

# Master of Science Informatik
## Technische Universität München
### Oktober 2017 – Mai 2019
- Schwerpunkt Machine Learning und KI
- Masterarbeit: „Deep Learning für NLP“

# Bachelor of Science Informatik
## Ludwig-Maximilians-Universität München
### Oktober 2014 – September 2017

FÄHIGKEITEN
- Programmierung: Python, JavaScript, TypeScript, Java
- Frameworks: React, Node.js, Next.js, Django, Flask
- KI/ML: TensorFlow, PyTorch, scikit-learn, OpenAI API
- Cloud: AWS, Azure, Google Cloud
- Datenbanken: PostgreSQL, MongoDB, Redis
- Tools: Git, Docker, Kubernetes, Jenkins

SPRACHEN
- Deutsch (Muttersprache)
- Englisch (fließend)

# User Experience Designerin
${MANUAL_PAGE_BREAK_MARKER}
## Bundesdruckerei-Gruppe, Berlin
### 2020 – 2022
- UX-Design für sichere digitale Identitätsprodukte

---

**WICHTIG: Schreibe den gesamten formatierten Lebenslauf in einem Code-Block mit dreifachen Backticks (\`\`\`), damit ich ihn in den Lebenslauf-Formatter einfügen kann.**

Bitte formatiere nun meine Angaben nach dieser Struktur:

${resumeText || "[Lebenslauf-Informationen hier einfügen]"}`;
}

interface ResumeInputProps {
  initialVersion?: {
    resumeText: string;
    profileImage: string | null;
    companyLogo: string | null;
    accentColor: string;
    accentColorHex: string;
    contactInfo?: ContactInfo;
    targetBoxBgColor?: string;
    targetBoxBorderColor?: string;
    profilePhotoBorder?: boolean;
  };
  onSave: (data: {
    name: string;
    resumeText: string;
    profileImage: string | null;
    companyLogo: string | null;
    contactInfo: ContactInfo;
    accentColor: string;
    accentColorHex: string;
    targetBoxBgColor: string;
    targetBoxBorderColor: string;
    profilePhotoBorder: boolean;
  }) => void | Promise<void | boolean>;
  onResumeUpdate: (data: {
    contactInfo: ContactInfo;
    resumeContent: string;
    profilePhoto?: string | null;
    companyLogo?: string | null;
    accentColor: string;
    accentColorHex: string;
    targetBoxBgColor: string;
    targetBoxBorderColor: string;
    profilePhotoBorder: boolean;
  }) => void;
  availableResumes?: any[];
  selectedJobId?: string;
  onJobSelect?: (jobId: string) => void;
  onClose?: () => void;
  jobDescription?: string; // Job description from job application or getting started
  onJobDescriptionChange?: (jobDescription: string) => void; // Callback to update job description for current job application
  /** Job posting URL from the linked application (shown in Job advert source). */
  linkedJobDescriptionUrl?: string | null;
  resumeDisplayName?: string;
  targetRoleDisplay?: string;
}

interface ContactInfo {
  email: string;
  linkedin: string;
  phone: string;
  address: string;
  citizenship: string;
  portfolio: string;
  portfolios: string[];
  showPortfolio: boolean;
  showLinkedInOnCv?: boolean;
  professionalTitle: string;
  name: string;
  language: "en" | "de";
  targetCompany: string;
  targetRole: string;
  jobAdvertSource: string;
}

export default function ResumeInput({
  initialVersion,
  onSave,
  onResumeUpdate,
  availableResumes,
  selectedJobId,
  onJobSelect,
  onClose,
  jobDescription: propJobDescription,
  onJobDescriptionChange,
  linkedJobDescriptionUrl = null,
  resumeDisplayName = "",
  targetRoleDisplay = "",
}: ResumeInputProps) {
  const formatterWorkspace = useFormatterWorkspaceOptional();
  const [activeTab, setActiveTab] = useState<FormatterTab>("edit");
  const [activePopover, setActivePopover] = useState<FormatterPopoverId | null>(null);

  const openPopover = useCallback(
    (id: FormatterPopoverId) => {
      setActivePopover(id);
      formatterWorkspace?.setPopoverOpen(true);
    },
    [formatterWorkspace],
  );

  const openEditRow = useCallback(
    (id: EditPopoverId) => {
      setActiveTab("edit");
      openPopover(id);
    },
    [openPopover],
  );

  const openTrustPopover = useCallback(
    (id: TrustPopoverId) => {
      setActiveTab("settings");
      openPopover(id);
    },
    [openPopover],
  );

  const openPageBreaksPopover = useCallback(() => {
    setActiveTab("settings");
    openPopover("page-breaks");
  }, [openPopover]);

  const openScorePopover = useCallback(() => {
    openPopover("cv-score");
  }, [openPopover]);

  const closePopover = useCallback(() => {
    setActivePopover(null);
    formatterWorkspace?.setPopoverOpen(false);
  }, [formatterWorkspace]);

  useEffect(() => {
    if (!formatterWorkspace) return;
    formatterWorkspace.closePopoverRef.current = closePopover;
    formatterWorkspace.openPopoverRef.current = (id) => openPopover(id as FormatterPopoverId);
    return () => {
      formatterWorkspace.closePopoverRef.current = null;
      formatterWorkspace.openPopoverRef.current = null;
    };
  }, [formatterWorkspace, closePopover, openPopover]);

  const handleTabClick = (tab: FormatterTab) => {
    setActiveTab(tab);
    if (tab === "edit" || tab === "settings" || tab === "help") {
      closePopover();
      return;
    }
    if (tab === "export") {
      openPopover("export");
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const resumeHighlightRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  // Get job description from prop (from job application) or sessionStorage (from Getting Started wizard)
  const [jobDescription, setJobDescription] = useState<string>(
    propJobDescription || "",
  );

  useEffect(() => {
    // Priority: prop > sessionStorage
    if (propJobDescription) {
      setJobDescription(propJobDescription);
    } else {
      const savedJobDescription = sessionStorage.getItem(
        "pendingJobDescription",
      );
      if (savedJobDescription) {
        setJobDescription(savedJobDescription);
      }
    }
  }, [propJobDescription]);

  const {
    value: resumeText,
    setValue: setResumeText,
    reset: resetResumeText,
    handleChange: handleResumeTextChangeRaw,
    handleKeyDown: handleResumeTextKeyDown,
  } = useUndoableText(initialVersion?.resumeText || "");
  const lastSyncedResumeTextRef = useRef(initialVersion?.resumeText || "");

  useEffect(() => {
    lastSyncedResumeTextRef.current = resumeText;
  }, [resumeText]);

  /** Normalize job-first pastes in the change handler (not a useEffect) to avoid parent sync loops. */
  const handleResumeTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      if (!resumeBuilderTextNeedsNormalize(next)) {
        handleResumeTextChangeRaw(e);
        return;
      }
      try {
        const repaired = normalizeResumeBuilderText(next);
        setResumeText(repaired);
      } catch (error) {
        console.error("[resume-input] Failed to normalize pasted resume text:", error);
        handleResumeTextChangeRaw(e);
      }
    },
    [handleResumeTextChangeRaw, setResumeText],
  );
  const [profilePhoto, setProfilePhoto] = useState<string | null>(
    initialVersion?.profileImage || "/images/profile-photo.png",
  );
  const [companyLogo, setCompanyLogo] = useState<string | null>(
    initialVersion?.companyLogo || null,
  );
  const [contactInfo, setContactInfo] = useState<ContactInfo>(() => {
    const base = normalizeContactInfo(initialVersion?.contactInfo);
    const bodyLanguage = detectResumeBodyLanguage(
      initialVersion?.resumeText || "",
      base.language,
    );
    return withJobAdvertFromApplication(
      { ...base, language: bodyLanguage },
      linkedJobDescriptionUrl,
    );
  });

  useEffect(() => {
    if (!linkedJobDescriptionUrl?.trim()) return;
    setContactInfo((prev) =>
      withJobAdvertFromApplication(prev, linkedJobDescriptionUrl),
    );
  }, [linkedJobDescriptionUrl]);

  const [isTranslatingLanguage, setIsTranslatingLanguage] = useState(false);
  const [translatingToLanguage, setTranslatingToLanguage] = useState<ResumeLanguage | null>(null);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const languageCacheRef = useRef<ResumeLanguageCache>(
    loadResumeLanguageCache(initialVersion?.id ?? "") ?? { updatedAt: Date.now() },
  );
  const versionIdRef = useRef(initialVersion?.id ?? "");
  const lastSyncedContactInfoRef = useRef(
    JSON.stringify({
      ...normalizeContactInfo(initialVersion?.contactInfo),
      language: detectResumeBodyLanguage(
        initialVersion?.resumeText || "",
        initialVersion?.contactInfo?.language,
      ),
    }),
  );

  const persistLanguageCache = useCallback(
    (cache: ResumeLanguageCache) => {
      languageCacheRef.current = cache;
      const id = versionIdRef.current || initialVersion?.id;
      if (id) saveResumeLanguageCache(id, cache);
    },
    [initialVersion?.id],
  );

  useEffect(() => {
    const nextId = initialVersion?.id ?? "";
    if (nextId === versionIdRef.current) return;
    versionIdRef.current = nextId;
    languageCacheRef.current = loadResumeLanguageCache(nextId) ?? { updatedAt: Date.now() };
  }, [initialVersion?.id]);

  useEffect(() => {
    lastSyncedContactInfoRef.current = JSON.stringify(normalizeContactInfo(contactInfo));
  }, [contactInfo]);

  useEffect(() => {
    if (!initialVersion?.contactInfo) return;
    const incoming = normalizeContactInfo(initialVersion.contactInfo);
    const bodyLanguage = detectResumeBodyLanguage(
      initialVersion.resumeText || resumeText,
      incoming.language,
    );
    const aligned = withJobAdvertFromApplication(
      { ...incoming, language: bodyLanguage },
      linkedJobDescriptionUrl,
    );
    const external = JSON.stringify(aligned);
    if (external === lastSyncedContactInfoRef.current) return;
    lastSyncedContactInfoRef.current = external;
    setContactInfo(aligned);
  }, [
    JSON.stringify(initialVersion?.contactInfo),
    initialVersion?.resumeText,
    linkedJobDescriptionUrl,
  ]);

  useEffect(() => {
    const external = initialVersion?.resumeText ?? "";
    if (external === lastSyncedResumeTextRef.current) return;
    lastSyncedResumeTextRef.current = external;
    resetResumeText(external);

    const bodyLanguage = detectResumeBodyLanguage(
      external,
      initialVersion?.contactInfo?.language,
    );
    const opposite: ResumeLanguage = bodyLanguage === "de" ? "en" : "de";
    const existingOpposite = languageCacheRef.current[opposite];
    const keepOpposite = hasMatchingLanguageSnapshot(existingOpposite, opposite)
      ? existingOpposite
      : undefined;

    persistLanguageCache({
      ...languageCacheRef.current,
      [bodyLanguage]: snapshotFromCurrent({
        resumeText: external,
        professionalTitle: initialVersion?.contactInfo?.professionalTitle,
        targetRole: initialVersion?.contactInfo?.targetRole,
      }),
      [opposite]: keepOpposite,
      updatedAt: Date.now(),
    });

    setContactInfo((prev) =>
      prev.language === bodyLanguage ? prev : { ...prev, language: bodyLanguage },
    );
  }, [
    initialVersion?.resumeText,
    initialVersion?.id,
    persistLanguageCache,
    resetResumeText,
  ]);

  // Align switcher + cache with the actual body language (fixes mismatched metadata).
  useEffect(() => {
    if (!resumeText.trim() || isTranslatingLanguage) return;
    const bodyLanguage = detectResumeBodyLanguage(resumeText, contactInfo.language);
    if (bodyLanguage === contactInfo.language) return;

    const opposite: ResumeLanguage = bodyLanguage === "de" ? "en" : "de";
    const existingOpposite = languageCacheRef.current[opposite];
    const keepOpposite = hasMatchingLanguageSnapshot(existingOpposite, opposite)
      ? existingOpposite
      : undefined;

    persistLanguageCache({
      ...languageCacheRef.current,
      [bodyLanguage]: snapshotFromCurrent({
        resumeText,
        professionalTitle: contactInfo.professionalTitle,
        targetRole: contactInfo.targetRole,
      }),
      [opposite]: keepOpposite,
      updatedAt: Date.now(),
    });
    setContactInfo((prev) => ({ ...prev, language: bodyLanguage }));
  }, [
    resumeText,
    contactInfo.language,
    contactInfo.professionalTitle,
    contactInfo.targetRole,
    isTranslatingLanguage,
    persistLanguageCache,
  ]);

  // Repair premature page breaks left by a prior translation (huge white gap under PROFILE).
  useEffect(() => {
    if (!resumeText.trim() || isTranslatingLanguage) return;
    if (!hasPrematurePageBreak(resumeText)) return;

    const bodyLanguage = detectResumeBodyLanguage(resumeText, contactInfo.language);
    const opposite: ResumeLanguage = bodyLanguage === "de" ? "en" : "de";
    const sourceSnapshot = languageCacheRef.current[opposite];

    const repaired =
      hasMatchingLanguageSnapshot(sourceSnapshot, opposite)
        ? alignTranslatedResumeMarkup(sourceSnapshot!.resumeText, resumeText)
        : removePrematurePageBreaks(resumeText);

    if (repaired === resumeText) return;

    persistLanguageCache({
      ...languageCacheRef.current,
      [bodyLanguage]: snapshotFromCurrent({
        resumeText: repaired,
        professionalTitle: contactInfo.professionalTitle,
        targetRole: contactInfo.targetRole,
      }),
      updatedAt: Date.now(),
    });
    resetResumeText(repaired);
    lastSyncedResumeTextRef.current = repaired;
  }, [
    resumeText,
    contactInfo.language,
    contactInfo.professionalTitle,
    contactInfo.targetRole,
    isTranslatingLanguage,
    persistLanguageCache,
    resetResumeText,
  ]);

  // Note: do NOT auto-rewrite resumeText for PROFILE→EXPERIENCE here.
  // That fought parent `onResumeUpdate` / `initialVersion` sync and crashed the page.
  // Preview already repairs via parseResumeText(); paste is normalized in handleResumeTextChange.

  const writeCurrentLanguageSnapshot = useCallback(
    (language: ResumeLanguage, text: string, info: ContactInfo) => {
      const next: ResumeLanguageCache = {
        ...languageCacheRef.current,
        [language]: snapshotFromCurrent({
          resumeText: text,
          professionalTitle: info.professionalTitle,
          targetRole: info.targetRole,
        }),
        updatedAt: Date.now(),
      };
      persistLanguageCache(next);
    },
    [persistLanguageCache],
  );

  // Keep the active language snapshot in sync as the user edits.
  // (Intentionally only on language switch via writeCurrentLanguageSnapshot in handleLanguageChange.)

  const handleLanguageChange = useCallback(
    async (nextLanguage: ResumeLanguage) => {
      if (isTranslatingLanguage) return;

      // Trust the CV body over the switcher label — they can disagree after import/edit.
      const sourceLanguage = detectResumeBodyLanguage(resumeText, contactInfo.language);
      if (nextLanguage === sourceLanguage) {
        // Body already in the requested language — just correct the switcher / cache slot.
        writeCurrentLanguageSnapshot(sourceLanguage, resumeText, {
          ...contactInfo,
          language: sourceLanguage,
        });
        if (contactInfo.language !== sourceLanguage) {
          setContactInfo({ ...contactInfo, language: sourceLanguage });
        }
        setLanguageError(null);
        return;
      }

      // Show the translating overlay immediately (before cache/network work) and
      // force a paint so the UI doesn't sit frozen with no feedback.
      flushSync(() => {
        setLanguageError(null);
        setTranslatingToLanguage(nextLanguage);
        setIsTranslatingLanguage(true);
      });
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      try {
        clearTranslationRateLimit();

        // If the user edited the current language after the last switch, the
        // opposite-language cache is stale — drop it so we re-translate (instead
        // of restoring an old English/German body and losing the new content).
        const previousSource = languageCacheRef.current[sourceLanguage]
        const sourceEdited = sourceLanguageWasEdited(previousSource, {
          resumeText,
          professionalTitle: contactInfo.professionalTitle,
          targetRole: contactInfo.targetRole,
        })

        writeCurrentLanguageSnapshot(sourceLanguage, resumeText, contactInfo)

        if (sourceEdited) {
          persistLanguageCache({
            ...languageCacheRef.current,
            [nextLanguage]: undefined,
            updatedAt: Date.now(),
          })
        }

        const cachedTarget = languageCacheRef.current[nextLanguage]
        if (hasMatchingLanguageSnapshot(cachedTarget, nextLanguage)) {
          // Reject PROFILE-only cache entries when the current body is a full CV.
          if (shouldReplaceTruncatedTranslation(cachedTarget!.resumeText, resumeText)) {
            persistLanguageCache({
              ...languageCacheRef.current,
              [nextLanguage]: undefined,
              updatedAt: Date.now(),
            })
          } else {
            const repairedCached = alignTranslatedResumeMarkup(
              resumeText,
              cachedTarget!.resumeText,
            )
            if (repairedCached !== cachedTarget!.resumeText) {
              persistLanguageCache({
                ...languageCacheRef.current,
                [nextLanguage]: {
                  ...cachedTarget!,
                  resumeText: repairedCached,
                },
                updatedAt: Date.now(),
              })
            }
            setContactInfo({
              ...contactInfo,
              language: nextLanguage,
              professionalTitle: cachedTarget!.professionalTitle || contactInfo.professionalTitle,
              targetRole: cachedTarget!.targetRole || contactInfo.targetRole,
            })
            resetResumeText(repairedCached)
            lastSyncedResumeTextRef.current = repairedCached
            return
          }
        }

        // Translate body first (most important), then short fields.
        const bodyResult = await translateTextWithRateLimit(resumeText, nextLanguage, {
          preserveResumeMarkup: true,
        })

        if (bodyResult.error || bodyResult.rateLimited) {
          setLanguageError(
            bodyResult.error ||
              "Translation is temporarily unavailable. Please try again in a moment.",
          );
          return;
        }

        if (!bodyResult.translatedText.trim() || bodyResult.translatedText === resumeText) {
          setLanguageError(
            "Could not translate the resume body. Check your connection and try again.",
          );
          return;
        }

        const translatedBody = alignTranslatedResumeMarkup(
          resumeText,
          bodyResult.translatedText,
        );
        // Guard against caching a non-translation (e.g. model echoed source).
        if (detectResumeBodyLanguage(translatedBody, nextLanguage) !== nextLanguage) {
          setLanguageError(
            "Translation did not produce the expected language. Please try again.",
          );
          return;
        }

        const [titleResult, roleResult] = await Promise.all([
          contactInfo.professionalTitle.trim()
            ? translateTextWithRateLimit(contactInfo.professionalTitle, nextLanguage)
            : Promise.resolve({ translatedText: contactInfo.professionalTitle, rateLimited: false }),
          contactInfo.targetRole.trim()
            ? translateTextWithRateLimit(contactInfo.targetRole, nextLanguage)
            : Promise.resolve({ translatedText: contactInfo.targetRole, rateLimited: false }),
        ]);

        const translatedTitle =
          !titleResult.rateLimited && titleResult.translatedText.trim()
            ? titleResult.translatedText
            : contactInfo.professionalTitle;
        const translatedRole =
          !roleResult.rateLimited && roleResult.translatedText.trim()
            ? roleResult.translatedText
            : contactInfo.targetRole;

        const nextInfo: ContactInfo = {
          ...contactInfo,
          language: nextLanguage,
          professionalTitle: translatedTitle,
          targetRole: translatedRole,
        };

        const nextCache: ResumeLanguageCache = {
          ...languageCacheRef.current,
          [sourceLanguage]: snapshotFromCurrent({
            resumeText,
            professionalTitle: contactInfo.professionalTitle,
            targetRole: contactInfo.targetRole,
          }),
          [nextLanguage]: snapshotFromCurrent({
            resumeText: translatedBody,
            professionalTitle: translatedTitle,
            targetRole: translatedRole,
          }),
          updatedAt: Date.now(),
        };
        persistLanguageCache(nextCache);

        setContactInfo(nextInfo);
        resetResumeText(translatedBody);
        lastSyncedResumeTextRef.current = translatedBody;
        setLanguageError(null);
      } finally {
        setIsTranslatingLanguage(false);
        setTranslatingToLanguage(null);
      }
    },
    [
      contactInfo,
      isTranslatingLanguage,
      persistLanguageCache,
      resetResumeText,
      resumeText,
      writeCurrentLanguageSnapshot,
    ],
  );

  const setContactInfoSafe = useCallback(
    (next: ContactInfo) => {
      const currentLanguage: ResumeLanguage = contactInfo.language === "de" ? "de" : "en";
      const nextLanguage: ResumeLanguage = next.language === "de" ? "de" : "en";
      if (nextLanguage !== currentLanguage) {
        void handleLanguageChange(nextLanguage);
        return;
      }
      setContactInfo(next);
    },
    [contactInfo.language, handleLanguageChange],
  );

  // If the open resume collapsed to PROFILE-only after a bad translation, restore the fuller language.
  const truncRepairAttemptedRef = useRef(false);
  useEffect(() => {
    if (!resumeText.trim() || isTranslatingLanguage || truncRepairAttemptedRef.current) return;

    const bodyLanguage = detectResumeBodyLanguage(resumeText, contactInfo.language);
    const opposite: ResumeLanguage = bodyLanguage === "de" ? "en" : "de";
    const sourceSnapshot = languageCacheRef.current[opposite];
    if (!hasMatchingLanguageSnapshot(sourceSnapshot, opposite)) return;
    if (!shouldReplaceTruncatedTranslation(resumeText, sourceSnapshot!.resumeText)) return;

    truncRepairAttemptedRef.current = true;
    persistLanguageCache({
      ...languageCacheRef.current,
      [bodyLanguage]: undefined,
      [opposite]: sourceSnapshot,
      updatedAt: Date.now(),
    });
    resetResumeText(sourceSnapshot!.resumeText);
    lastSyncedResumeTextRef.current = sourceSnapshot!.resumeText;
    setContactInfo((prev) => ({
      ...prev,
      language: opposite,
      professionalTitle: sourceSnapshot!.professionalTitle || prev.professionalTitle,
      targetRole: sourceSnapshot!.targetRole || prev.targetRole,
    }));
    setLanguageError(
      bodyLanguage === "de"
        ? "German translation was incomplete and was cleared. Switch to Deutsch again to rebuild it."
        : "English translation was incomplete and was cleared. Switch to English again to rebuild it.",
    );
  }, [
    resumeText,
    contactInfo.language,
    isTranslatingLanguage,
    persistLanguageCache,
    resetResumeText,
  ]);
  const [accentColor, setAccentColor] = useState<string>(
    initialVersion?.accentColor || "oklch(65% .15 85)",
  );
  const [currentHexValue, setCurrentHexValue] = useState<string>(
    initialVersion?.accentColorHex || "#b89968",
  );
  const [targetBoxBgColor, setTargetBoxBgColor] = useState<string>(
    initialVersion?.targetBoxBgColor || "#f8f9fa",
  );
  const [targetBoxBorderColor, setTargetBoxBorderColor] = useState<string>(
    initialVersion?.targetBoxBorderColor || "",
  );
  const [profilePhotoBorder, setProfilePhotoBorder] = useState<boolean>(
    initialVersion?.profilePhotoBorder !== false,
  );

  const cvReviewInsights = useMemo(
    () =>
      buildCvReviewInsights({
        resumeText,
        contactInfo,
        jobDescription: jobDescription || undefined,
      }),
    [resumeText, contactInfo, jobDescription],
  );
  const cvScore = cvReviewInsights.score;

  const formattingPrompt = useMemo(
    () =>
      contactInfo.language === "de"
        ? buildResumeFormattingPromptDe(resumeText)
        : buildResumeFormattingPromptEn(resumeText),
    [contactInfo.language, resumeText],
  );

  const onResumeUpdateRef = useRef(onResumeUpdate);
  onResumeUpdateRef.current = onResumeUpdate;

  useEffect(() => {
    onResumeUpdateRef.current?.({
      contactInfo,
      resumeContent: resumeText,
      profilePhoto: profilePhoto ?? undefined,
      companyLogo: companyLogo,
      accentColor,
      accentColorHex: currentHexValue,
      targetBoxBgColor,
      targetBoxBorderColor,
      profilePhotoBorder,
    });
  }, [
    contactInfo,
    resumeText,
    profilePhoto,
    companyLogo,
    accentColor,
    currentHexValue,
    targetBoxBgColor,
    targetBoxBorderColor,
    profilePhotoBorder,
  ]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressProfilePhotoToDataUrl(file, 400);
        setProfilePhoto(compressed);
      } catch (error) {
        console.error("Image compression failed:", error);
        // Fallback to original
        const reader = new FileReader();
        reader.onloadend = () => setProfilePhoto(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressLogoToDataUrl(file, 320);
        setCompanyLogo(compressed);
      } catch (error) {
        console.error("Logo compression failed:", error);
        // Fallback to original
        const reader = new FileReader();
        reader.onloadend = () => setCompanyLogo(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleRemoveImage = () => {
    setProfilePhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setCompanyLogo(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const hexToOklch = (hex: string): string => {
    hex = hex.replace("#", "");
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
      return accentColor;
    }
    const r = Number.parseInt(hex.substring(0, 2), 16) / 255;
    const g = Number.parseInt(hex.substring(2, 4), 16) / 255;
    const b = Number.parseInt(hex.substring(4, 6), 16) / 255;

    // Convert to linear RGB
    const linearR =
      r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const linearG =
      g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const linearB =
      b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    // Calculate perceived lightness using relative luminance
    const luminance = 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
    // Apply cube root for perceptual lightness (closer to oklch L)
    const lightness = Math.round(Math.pow(luminance, 1 / 3) * 100);

    // Calculate hue from sRGB values (not linear)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === r) {
        hue = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        hue = 60 * ((b - r) / delta + 2);
      } else {
        hue = 60 * ((r - g) / delta + 4);
      }
    }
    if (hue < 0) hue += 360;

    // Calculate chroma - simplified approximation based on saturation and lightness
    const l = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    const chroma = saturation * 0.15;

    return `oklch(${lightness}% ${chroma.toFixed(2)} ${Math.round(hue)})`;
  };

  const oklchToRgb = (oklchString: string): string => {
    // Parse OKLCH string like "oklch$$([\d.]+)%?\s+([\d.]+)\s+([\d.]+)$$"
    const match = oklchString.match(
      /oklch$$([\d.]+)%?\s+([\d.]+)\s+([\d.]+)$$/,
    );
    if (!match) return oklchString;

    const L = Number.parseFloat(match[1]) / 100; // Lightness (0-1)
    const C = Number.parseFloat(match[2]); // Chroma
    const H = Number.parseFloat(match[3]); // Hue (degrees)

    // Convert OKLCH to RGB (simplified conversion)
    // This is a basic approximation for display purposes
    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    // Convert to linear RGB (simplified)
    const l = L * 100;
    const r = Math.max(0, Math.min(255, l + a * 128));
    const g = Math.max(0, Math.min(255, l - a * 64 - b * 64));
    const blue = Math.max(0, Math.min(255, l + b * 128));

    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(blue)})`;
  };

  const handleHexInput = (hex: string) => {
    let cleanHex = hex.replace("#", "");
    if (cleanHex.length > 6) cleanHex = cleanHex.substring(0, 6);
    const fullHex = cleanHex.length > 0 ? `#${cleanHex}` : "";

    setCurrentHexValue(fullHex);

    if (/^#[0-9A-Fa-f]{6}$/.test(fullHex)) {
      const oklch = hexToOklch(fullHex);
      setAccentColor(oklch);
    }
  };

  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(formattingPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleResumeUpdate = () => {
    onResumeUpdate({
      contactInfo,
      resumeContent: resumeText,
      profilePhoto: profilePhoto ?? undefined,
      companyLogo: companyLogo, // Pass null explicitly when removed
      accentColor: accentColor,
      accentColorHex: currentHexValue,
      targetBoxBgColor,
      targetBoxBorderColor,
      profilePhotoBorder,
    });
  };

  const handleSaveVersion = async (versionName: string) => {
    try {
      await Promise.resolve(
        onSave({
          name: versionName,
          resumeText,
          profileImage: profilePhoto,
          companyLogo,
          contactInfo,
          accentColor,
          accentColorHex: currentHexValue,
          targetBoxBgColor,
          targetBoxBorderColor,
          profilePhotoBorder,
        }),
      );
    } catch (error) {
      console.error("[resume-input] Save failed:", error);
    }
  };

  const presetColors = [
    { name: "Warm Brown", oklch: "oklch(74% 0.10 81)", hex: "#C9975B" },
    { name: "Professional Blue", oklch: "oklch(55% 0.15 250)", hex: "#2563eb" },
    { name: "Corporate Green", oklch: "oklch(65% 0.15 150)", hex: "#059669" },
    { name: "Classic Black", oklch: "oklch(20% 0 0)", hex: "#000000" },
  ];

  const selectedJob = availableResumes?.find((job) => job.id === selectedJobId);

  const syntaxLegendItems = [
    { label: "# Title", className: "text-emerald-700 font-semibold" },
    { label: "## Company", className: "text-emerald-600 font-medium" },
    { label: "### Date", className: "text-emerald-500" },
    { label: "[Link](url)", className: "text-sky-700 font-medium" },
    { label: "---PAGE BREAK---", className: "text-purple-700 font-semibold" },
  ];

  const renderInlineLinkHighlightedText = (text: string, keyPrefix: string) => {
    const parts: ReactNode[] = [];
    const re = new RegExp(RESUME_INLINE_LINK_REGEX.source, "g");
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let partIndex = 0;

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`${keyPrefix}-t-${partIndex++}`}>
            {text.slice(lastIndex, match.index)}
          </span>,
        );
      }
      parts.push(
        <span
          key={`${keyPrefix}-l-${partIndex++}`}
          className="text-sky-700 font-medium"
        >
          {match[0]}
        </span>,
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span key={`${keyPrefix}-t-${partIndex++}`}>{text.slice(lastIndex)}</span>,
      );
    }

    return parts.length > 0 ? parts : text;
  };

  const getSyntaxLineClass = (line: string) => {
    const trimmedLine = line.trimStart();

    if (trimmedLine.startsWith("---PAGE BREAK---")) {
      return "text-purple-700 font-semibold";
    }

    if (trimmedLine.startsWith("###")) {
      return "text-emerald-500";
    }

    if (trimmedLine.startsWith("##")) {
      return "text-emerald-600 font-medium";
    }

    if (trimmedLine.startsWith("#")) {
      return "text-emerald-700 font-semibold";
    }

    return "text-foreground";
  };

  const renderHighlightedResumeText = (text: string) => {
    if (!text) {
      return (
        <span className="text-muted-foreground/70">
          {`Use this markup format for proper formatting:

PROFIL
- Paste or edit resume content here

# Job Title
## Company Name
### Date Range
- Bullet with [inline link](https://example.com)

---PAGE BREAK---`}
        </span>
      );
    }

    return text.split("\n").map((line, index) => (
      <span key={`${index}-${line}`} className={getSyntaxLineClass(line)}>
        {renderInlineLinkHighlightedText(line, `ln-${index}`)}
        {index < text.split("\n").length - 1 ? "\n" : ""}
      </span>
    ));
  };

  const bgSwatches = [
    { name: "Light Gray", hex: "#f8f9fa" },
    { name: "Warm Beige", hex: "#f5f0eb" },
    { name: "Soft Blue", hex: "#f0f4f8" },
    { name: "Light Sage", hex: "#f0f5f0" },
    { name: "White", hex: "#ffffff" },
    { name: "Soft Green", hex: "#e8f5e9" },
    { name: "Soft Yellow", hex: "#fff8e1" },
    { name: "Soft Orange", hex: "#fff3e0" },
    { name: "Soft Purple", hex: "#f3e5f5" },
  ];

  const borderSwatches = [
    { name: "Accent Color", hex: "" },
    { name: "Black", hex: "#000000" },
    { name: "Dark Gray", hex: "#4a4a4a" },
    { name: "Navy", hex: "#1e3a5f" },
    { name: "Charcoal", hex: "#2d2d2d" },
    { name: "White", hex: "#ffffff" },
    { name: "Green", hex: "#2e7d32" },
    { name: "Yellow", hex: "#f9a825" },
    { name: "Orange", hex: "#e65100" },
    { name: "Purple", hex: "#6a1b9a" },
  ];

  return (
    <ResumeFormatterSidebar
      resumeDisplayName={resumeDisplayName || contactInfo.targetCompany || contactInfo.name}
      targetRoleDisplay={targetRoleDisplay || contactInfo.targetRole || contactInfo.professionalTitle}
      cvScore={cvScore}
      cvReviewInsights={cvReviewInsights}
      activeTab={activeTab}
      activePopover={activePopover}
      onTabClick={handleTabClick}
      onOpenRow={openEditRow}
      onOpenTrustPopover={openTrustPopover}
      onOpenPageBreaksPopover={openPageBreaksPopover}
      onOpenScorePopover={openScorePopover}
      onClosePopover={closePopover}
      contactInfo={contactInfo}
      setContactInfo={setContactInfoSafe}
      linkedJobDescriptionUrl={linkedJobDescriptionUrl}
      isTranslatingLanguage={isTranslatingLanguage}
      translatingToLanguage={translatingToLanguage}
      languageError={languageError}
      onLanguageChange={handleLanguageChange}
      profilePhoto={profilePhoto}
      profilePhotoBorder={profilePhotoBorder}
      setProfilePhotoBorder={setProfilePhotoBorder}
      fileInputRef={fileInputRef}
      logoInputRef={logoInputRef}
      onImageUpload={handleImageUpload}
      onLogoUpload={handleLogoUpload}
      onRemoveImage={handleRemoveImage}
      onRemoveLogo={handleRemoveLogo}
      accentColor={accentColor}
      setAccentColor={setAccentColor}
      currentHexValue={currentHexValue}
      handleHexInput={handleHexInput}
      presetColors={presetColors}
      targetBoxBgColor={targetBoxBgColor}
      setTargetBoxBgColor={setTargetBoxBgColor}
      targetBoxBorderColor={targetBoxBorderColor}
      setTargetBoxBorderColor={setTargetBoxBorderColor}
      companyLogo={companyLogo}
      resumeText={resumeText}
      handleResumeTextChange={handleResumeTextChange}
      handleResumeTextKeyDown={handleResumeTextKeyDown}
      resumeHighlightRef={resumeHighlightRef}
      renderHighlightedResumeText={renderHighlightedResumeText}
      formattingPrompt={formattingPrompt}
      copied={copied}
      onCopyPrompt={copyPromptToClipboard}
      bgSwatches={bgSwatches}
      borderSwatches={borderSwatches}
    />
  );
}
