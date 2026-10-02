/**
 * Plain-language copy for “Your profile for applications” (EN/DE).
 */

export type ProfileLocale = "en" | "de"

export type ProfileCopy = {
  brand: string
  title: string
  subtitle: string
  confirmedExplain: string
  backAgents: string
  steps: { add: string; check: string; ready: string }
  next: {
    add: string
    directions: string
    check: (unchecked: number) => string
    readyMissing: string
    readyDone: string
  }
  primary: {
    add: string
    check: string
    agreeDirections: string
    goAgents: string
    addEducation: string
    addMissing: string
  }
  directions: {
    title: string
    body: string
    agreedTitle: string
    agreedBody: string
    continueCheck: string
  }
  empty: {
    uploadTitle: string
    uploadBody: string
    uploadCta: string
    linkedinTitle: string
    linkedinBody: string
    linkedinHowTo: string
    linkedinCta: string
    allCvsTitle: string
    allCvsBody: (count: number) => string
    allCvsBodyUnknown: string
    allCvsCta: string
    allCvsEmptyHint: string
    whoseCvs: string
    whoseCvsHint: string
    clearMixed: string
    clearMixedBody: string
    clearMixedCta: string
    clearMixedConfirm: string
    reimportTitle: string
    reimportBody: string
    workspaceTitle: string
    workspaceBody: string
    workspaceCta: string
    orPickOne: string
    orHand: string
  }
  check: {
    progress: (checked: number, total: number) => string
    onlyUnchecked: string
    fromSource: (label: string) => string
    correct: string
    edit: string
    remove: string
    removeConfirm: string
    allCheckedTitle: string
    allCheckedBody: string
  }
  sections: {
    experience: string
    achievements: string
    education: string
    skills: string
    languages: string
    projects: string
  }
  hand: {
    title: string
    pickSection: string
    save: string
    cancel: string
    experience: string
    achievement: string
    education: string
    skills: string
    languages: string
    jobTitle: string
    employer: string
    from: string
    to: string
    current: string
    location: string
    description: string
    whatYouDid: string
    result: string
    whichRole: string
    degree: string
    institution: string
    year: string
    skillTags: string
    language: string
    level: string
    levels: { native: string; fluent: string; good: string; basic: string }
    placeholders: {
      jobTitle: string
      employer: string
      location: string
      description: string
      whatYouDid: string
      result: string
      degree: string
      institution: string
      skills: string
      language: string
    }
  }
  ready: {
    heading: string
    currentRole: string
    achievements: string
    education: string
    languages: string
    stillMissing: (items: string[]) => string
  }
  toast: {
    importOk: string
    importOkDirections: (count: number, directions: string[]) => string
    importOkOwn: (
      count: number,
      ownerLabel: string | null,
      directions: string[],
    ) => string
    clearOk: (deleted: number) => string
    clearFail: string
    importFail: string
    loadFail: string
    updateFail: string
    removeFail: string
    addOk: string
    addFail: string
  }
  a11y: {
    stepProgress: string
    itemList: string
    localeToggle: string
  }
}

const en: ProfileCopy = {
  brand: "EquitAI",
  title: "Your profile for applications",
  subtitle:
    "The agents write your CVs and letters only from what you confirm here. They never invent anything.",
  confirmedExplain:
    "Confirmed means you've checked it's true. Only confirmed items appear in applications.",
  backAgents: "Back to job agents",
  steps: {
    add: "1. Add your experience",
    check: "2. Check each item",
    ready: "3. Ready for the agents",
  },
  next: {
    add: "Next: Add your experience so the agents have something to work with.",
    directions:
      "Next: Review the work directions below. If they look right, agree to continue.",
    check: (n) =>
      n === 1
        ? "Next: Check the 1 item still waiting."
        : `Next: Check the ${n} items still waiting.`,
    readyMissing: "Next: Fill in what's still missing below.",
    readyDone: "Next: Your profile is ready. Go to job agents when you want.",
  },
  primary: {
    add: "Add your experience",
    check: "Check items",
    agreeDirections: "These directions look right",
    goAgents: "Go to job agents",
    addEducation: "Add education",
    addMissing: "Add what's missing",
  },
  directions: {
    title: "Your work directions",
    body: "From your CVs, these are the directions you can look for work in. Agree to keep them in your profile for the agents.",
    agreedTitle: "Directions agreed",
    agreedBody: "These stay on your profile. Continue checking the remaining items, then you’re ready for the agents.",
    continueCheck: "Continue to check items",
  },
  empty: {
    uploadTitle: "Upload your CV",
    uploadBody: "PDF or text file. We'll suggest items for you to check.",
    uploadCta: "Choose file",
    linkedinTitle: "Import from LinkedIn",
    linkedinBody: "Use a LinkedIn data export ZIP or a profile PDF.",
    linkedinHowTo: "How to export from LinkedIn",
    linkedinCta: "Choose file",
    allCvsTitle: "Review my saved CVs",
    allCvsBody: (count) =>
      count === 1
        ? "You already have 1 CV in this workspace. With your OK, we’ll read it and suggest roles you can aim for."
        : `You already have ${count} CVs in this workspace. With your OK, we’ll read them all and surface every direction you can look for work in.`,
    allCvsBodyUnknown:
      "With your OK, we’ll read the CVs saved in this browser workspace and suggest every direction you can look for work in.",
    allCvsCta: "Allow & find directions",
    allCvsEmptyHint:
      "No CVs with text found in this browser. Open your workspace first so they’re loaded here, or upload a file.",
    whoseCvs: "Whose CVs?",
    whoseCvsHint: "Only this person’s CVs will be added to your profile.",
    clearMixed: "Start over",
    clearMixedBody:
      "Clear the mixed items below, then import only your CVs with the card underneath.",
    clearMixedCta: "Clear all profile items",
    clearMixedConfirm:
      "Clear every item on this profile? You can import your CVs again afterwards.",
    reimportTitle: "Import only my CVs",
    reimportBody:
      "Pick your name, then allow EquitAI to read your saved CVs and suggest work directions.",
    workspaceTitle: "Use one CV from your workspace",
    workspaceBody: "Import suggestions from a single CV you already saved here.",
    workspaceCta: "Pick a CV",
    orPickOne: "or pick just one CV",
    orHand: "or add items by hand",
  },
  check: {
    progress: (checked, total) => `${checked} of ${total} checked`,
    onlyUnchecked: "Show only unchecked",
    fromSource: (label) => `From: ${label}`,
    correct: "Correct",
    edit: "Edit",
    remove: "Remove",
    removeConfirm: "Remove this item? You can add it again later.",
    allCheckedTitle: "All imported items checked",
    allCheckedBody: "You can still edit anytime. When you're ready, open job agents.",
  },
  sections: {
    experience: "Experience",
    achievements: "Achievements",
    education: "Education",
    skills: "Skills",
    languages: "Languages",
    projects: "Projects",
  },
  hand: {
    title: "Add by hand",
    pickSection: "What do you want to add?",
    save: "Save item",
    cancel: "Cancel",
    experience: "Experience",
    achievement: "Achievement",
    education: "Education",
    skills: "Skills",
    languages: "Languages",
    jobTitle: "Job title",
    employer: "Employer",
    from: "From",
    to: "To",
    current: "Current role",
    location: "Location",
    description: "Short description (optional)",
    whatYouDid: "What you did",
    result: "The result (include a number if you have one)",
    whichRole: "Which role it belongs to",
    degree: "Degree",
    institution: "Institution",
    year: "Year",
    skillTags: "Skills",
    language: "Language",
    level: "Level",
    levels: {
      native: "Native",
      fluent: "Fluent",
      good: "Good",
      basic: "Basic",
    },
    placeholders: {
      jobTitle: "e.g. Head of Design",
      employer: "e.g. EquitAI",
      location: "e.g. Berlin",
      description: "e.g. Led product design for AI tools",
      whatYouDid: "e.g. Redesigned the application flow",
      result: "e.g. Cut time-to-apply by 40%",
      degree: "e.g. M.A. Interaction Design",
      institution: "e.g. University of the Arts Berlin",
      skills: "e.g. Product design, UX research, Figma",
      language: "e.g. German",
    },
  },
  ready: {
    heading: "Ready for the agents?",
    currentRole: "At least one current role",
    achievements: "3 achievements",
    education: "Education",
    languages: "Languages",
    stillMissing: (items) =>
      items.length === 0 ? "Nothing missing." : `Still missing: ${items.join(", ")}.`,
  },
  toast: {
    importOk: "Items imported — please check each one",
    importOkDirections: (count, directions) => {
      const list =
        directions.length === 0
          ? ""
          : ` Directions found: ${directions.slice(0, 5).join("; ")}${
              directions.length > 5 ? "…" : ""
            }.`
      return `Imported from ${count} CV${count === 1 ? "" : "s"}.${list} Please check each item.`
    },
    importOkOwn: (count, ownerLabel, directions) => {
      const who = ownerLabel ? ` for ${ownerLabel}` : ""
      const list =
        directions.length === 0
          ? ""
          : ` Directions found: ${directions.slice(0, 5).join("; ")}${
              directions.length > 5 ? "…" : ""
            }.`
      return `Imported ${count} CV${count === 1 ? "" : "s"}${who} only.${list} Remove any leftover items that aren’t yours, then check each one.`
    },
    clearOk: (deleted) =>
      deleted === 1
        ? "Cleared 1 profile item. You can import your CVs now."
        : `Cleared ${deleted} profile items. You can import your CVs now.`,
    clearFail: "Could not clear profile items",
    importFail: "Could not import",
    loadFail: "Could not load your profile",
    updateFail: "Could not update item",
    removeFail: "Could not remove item",
    addOk: "Item added",
    addFail: "Could not add item",
  },
  a11y: {
    stepProgress: "Profile setup progress",
    itemList: "Profile items",
    localeToggle: "Language",
  },
}

const de: ProfileCopy = {
  brand: "EquitAI",
  title: "Dein Profil für Bewerbungen",
  subtitle:
    "Die Agenten schreiben deine Lebensläufe und Anschreiben nur aus dem, was du hier bestätigst. Sie erfinden nichts.",
  confirmedExplain:
    "Bestätigt heißt: du hast geprüft, dass es stimmt. Nur bestätigte Einträge erscheinen in Bewerbungen.",
  backAgents: "Zurück zu Job-Agenten",
  steps: {
    add: "1. Erfahrung hinzufügen",
    check: "2. Jeden Eintrag prüfen",
    ready: "3. Bereit für die Agenten",
  },
  next: {
    add: "Als Nächstes: Füge deine Erfahrung hinzu, damit die Agenten etwas zum Arbeiten haben.",
    directions:
      "Als Nächstes: Prüfe die Arbeitsrichtungen unten. Wenn sie stimmen, stimme zu und mach weiter.",
    check: (n) =>
      n === 1
        ? "Als Nächstes: Prüfe den 1 offenen Eintrag."
        : `Als Nächstes: Prüfe die ${n} offenen Einträge.`,
    readyMissing: "Als Nächstes: Ergänze, was unten noch fehlt.",
    readyDone: "Als Nächstes: Dein Profil ist bereit. Öffne die Job-Agenten, wenn du magst.",
  },
  primary: {
    add: "Erfahrung hinzufügen",
    check: "Einträge prüfen",
    agreeDirections: "Diese Richtungen stimmen",
    goAgents: "Zu den Job-Agenten",
    addEducation: "Ausbildung hinzufügen",
    addMissing: "Fehlendes hinzufügen",
  },
  directions: {
    title: "Deine Arbeitsrichtungen",
    body: "Aus deinen Lebensläufen: In diesen Richtungen kannst du Arbeit suchen. Stimme zu, damit sie im Profil für die Agenten bleiben.",
    agreedTitle: "Richtungen bestätigt",
    agreedBody:
      "Sie bleiben in deinem Profil. Prüfe als Nächstes die übrigen Einträge — dann bist du bereit für die Agenten.",
    continueCheck: "Weiter zu den Einträgen",
  },
  empty: {
    uploadTitle: "Lebenslauf hochladen",
    uploadBody: "PDF oder Textdatei. Wir schlagen Einträge vor, die du prüfst.",
    uploadCta: "Datei wählen",
    linkedinTitle: "Aus LinkedIn importieren",
    linkedinBody: "LinkedIn-Datenexport (ZIP) oder Profil-PDF.",
    linkedinHowTo: "So exportierst du aus LinkedIn",
    linkedinCta: "Datei wählen",
    allCvsTitle: "Meine gespeicherten Lebensläufe prüfen",
    allCvsBody: (count) =>
      count === 1
        ? "Du hast schon 1 Lebenslauf in diesem Workspace. Mit deiner Erlaubnis lesen wir ihn und schlagen mögliche Richtungen vor."
        : `Du hast schon ${count} Lebensläufe in diesem Workspace. Mit deiner Erlaubnis lesen wir sie alle und erkennen jede Richtung, in der du Arbeit suchen kannst.`,
    allCvsBodyUnknown:
      "Mit deiner Erlaubnis lesen wir die Lebensläufe in diesem Browser-Workspace und schlagen jede Richtung vor, in der du Arbeit suchen kannst.",
    allCvsCta: "Erlauben & Richtungen finden",
    allCvsEmptyHint:
      "Keine Lebensläufe mit Text in diesem Browser. Öffne zuerst den Workspace, oder lade eine Datei hoch.",
    whoseCvs: "Wessen Lebensläufe?",
    whoseCvsHint: "Nur die Lebensläufe dieser Person kommen in dein Profil.",
    clearMixed: "Neu starten",
    clearMixedBody:
      "Lösche die vermischten Einträge unten und importiere danach nur deine Lebensläufe mit der Karte darunter.",
    clearMixedCta: "Alle Profileinträge löschen",
    clearMixedConfirm:
      "Wirklich alle Einträge in diesem Profil löschen? Danach kannst du deine Lebensläufe neu importieren.",
    reimportTitle: "Nur meine Lebensläufe importieren",
    reimportBody:
      "Wähle deinen Namen und erlaube EquitAI, deine gespeicherten Lebensläufe zu lesen und Arbeitsrichtungen vorzuschlagen.",
    workspaceTitle: "Einen Lebenslauf aus dem Workspace",
    workspaceBody: "Vorschläge aus einem einzelnen hier gespeicherten Lebenslauf.",
    workspaceCta: "Lebenslauf wählen",
    orPickOne: "oder nur einen Lebenslauf wählen",
    orHand: "oder Einträge von Hand hinzufügen",
  },
  check: {
    progress: (checked, total) => `${checked} von ${total} geprüft`,
    onlyUnchecked: "Nur ungeprüfte zeigen",
    fromSource: (label) => `Quelle: ${label}`,
    correct: "Stimmt",
    edit: "Bearbeiten",
    remove: "Entfernen",
    removeConfirm: "Diesen Eintrag entfernen? Du kannst ihn später wieder hinzufügen.",
    allCheckedTitle: "Alle importierten Einträge geprüft",
    allCheckedBody: "Du kannst jederzeit noch ändern. Wenn du bereit bist, öffne die Job-Agenten.",
  },
  sections: {
    experience: "Erfahrung",
    achievements: "Erfolge",
    education: "Ausbildung",
    skills: "Fähigkeiten",
    languages: "Sprachen",
    projects: "Projekte",
  },
  hand: {
    title: "Von Hand hinzufügen",
    pickSection: "Was möchtest du hinzufügen?",
    save: "Eintrag speichern",
    cancel: "Abbrechen",
    experience: "Erfahrung",
    achievement: "Erfolg",
    education: "Ausbildung",
    skills: "Fähigkeiten",
    languages: "Sprachen",
    jobTitle: "Jobtitel",
    employer: "Arbeitgeber",
    from: "Von",
    to: "Bis",
    current: "Aktuelle Rolle",
    location: "Ort",
    description: "Kurze Beschreibung (optional)",
    whatYouDid: "Was du getan hast",
    result: "Das Ergebnis (mit Zahl, falls vorhanden)",
    whichRole: "Zu welcher Rolle",
    degree: "Abschluss",
    institution: "Einrichtung",
    year: "Jahr",
    skillTags: "Fähigkeiten",
    language: "Sprache",
    level: "Niveau",
    levels: {
      native: "Muttersprache",
      fluent: "Fließend",
      good: "Gut",
      basic: "Grundkenntnisse",
    },
    placeholders: {
      jobTitle: "z. B. Head of Design",
      employer: "z. B. EquitAI",
      location: "z. B. Berlin",
      description: "z. B. Leitung Produktdesign für KI-Tools",
      whatYouDid: "z. B. Bewerbungsfluss neu gestaltet",
      result: "z. B. Zeit bis zur Bewerbung um 40 % verkürzt",
      degree: "z. B. M.A. Interaction Design",
      institution: "z. B. Universität der Künste Berlin",
      skills: "z. B. Produktdesign, UX Research, Figma",
      language: "z. B. Deutsch",
    },
  },
  ready: {
    heading: "Bereit für die Agenten?",
    currentRole: "Mindestens eine aktuelle Rolle",
    achievements: "3 Erfolge",
    education: "Ausbildung",
    languages: "Sprachen",
    stillMissing: (items) =>
      items.length === 0 ? "Nichts fehlt." : `Noch fehlend: ${items.join(", ")}.`,
  },
  toast: {
    importOk: "Einträge importiert — bitte jeden prüfen",
    importOkDirections: (count, directions) => {
      const list =
        directions.length === 0
          ? ""
          : ` Gefundene Richtungen: ${directions.slice(0, 5).join("; ")}${
              directions.length > 5 ? "…" : ""
            }.`
      return `Importiert aus ${count === 1 ? "1 Lebenslauf" : `${count} Lebensläufen`}.${list} Bitte jeden Eintrag prüfen.`
    },
    importOkOwn: (count, ownerLabel, directions) => {
      const who = ownerLabel ? ` für ${ownerLabel}` : ""
      const list =
        directions.length === 0
          ? ""
          : ` Gefundene Richtungen: ${directions.slice(0, 5).join("; ")}${
              directions.length > 5 ? "…" : ""
            }.`
      return `Nur ${count === 1 ? "1 Lebenslauf" : `${count} Lebensläufe`}${who} importiert.${list} Entferne fremde Einträge, dann jeden prüfen.`
    },
    clearOk: (deleted) =>
      deleted === 1
        ? "1 Profileintrag gelöscht. Du kannst jetzt deine Lebensläufe importieren."
        : `${deleted} Profileinträge gelöscht. Du kannst jetzt deine Lebensläufe importieren.`,
    clearFail: "Profileinträge konnten nicht gelöscht werden",
    importFail: "Import fehlgeschlagen",
    loadFail: "Profil konnte nicht geladen werden",
    updateFail: "Eintrag konnte nicht aktualisiert werden",
    removeFail: "Eintrag konnte nicht entfernt werden",
    addOk: "Eintrag hinzugefügt",
    addFail: "Eintrag konnte nicht hinzugefügt werden",
  },
  a11y: {
    stepProgress: "Fortschritt Profil-Einrichtung",
    itemList: "Profileinträge",
    localeToggle: "Sprache",
  },
}

export function getProfileCopy(locale: ProfileLocale): ProfileCopy {
  return locale === "de" ? de : en
}

export function detectProfileLocale(): ProfileLocale {
  if (typeof navigator === "undefined") return "en"
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en"
}
