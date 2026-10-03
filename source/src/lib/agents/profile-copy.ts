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
    advancedToggle: string
    advancedHide: string
    workspaceTitle: string
    workspaceBody: string
    workspaceCta: string
    orPickOne: string
    orHand: string
  }
  check: {
    progress: (checked: number, total: number) => string
    howToAdvance: string
    calmTitle: string
    calmBody: (total: number) => string
    trustAll: string
    trustAllWorking: string
    reviewDetails: string
    hideDetails: string
    confirmAll: string
    confirmAllWorking: string
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
    "We will only use what you say is true. Take one step at a time. You can stop and come back later.",
  confirmedExplain:
    "Correct means: this is true about you. Only correct items are used in applications.",
  backAgents: "Back to job agents",
  steps: {
    add: "1. Add",
    check: "2. Check",
    ready: "3. Ready",
  },
  next: {
    add: "Do this now: Add your experience.",
    directions: "Do this now: Read your work directions. If they are right, press the green button.",
    check: (n) =>
      n <= 0
        ? "Do this now: Go to Ready."
        : "Do this now: Press the green button to keep your items and continue.",
    readyMissing: "Do this now: Add what is still missing.",
    readyDone:
      "You are ready. Open job agents when you want — you still choose every job and approve every CV before anything is sent.",
  },
  primary: {
    add: "Add your experience",
    check: "Continue",
    agreeDirections: "Yes — these directions are right",
    goAgents: "Open job agents (nothing sends yet)",
    addEducation: "Add education",
    addMissing: "Add what is missing",
  },
  directions: {
    title: "Your work directions",
    body: "These are the kinds of work your CVs point to. Read the list. If it is right, press the green button.",
    agreedTitle: "Directions saved",
    agreedBody: "Good. Next you will keep your profile items, then you can go to Ready.",
    continueCheck: "Continue",
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
    clearMixedBody: "Only use this if the wrong person’s CVs were imported.",
    clearMixedCta: "Delete all profile items",
    clearMixedConfirm:
      "Delete every item on this profile? You can import again afterwards.",
    reimportTitle: "Import only my CVs",
    reimportBody: "Choose your name, then press the green button.",
    advancedToggle: "Need to start over?",
    advancedHide: "Hide start over",
    workspaceTitle: "Use one CV from your workspace",
    workspaceBody: "Import suggestions from a single CV you already saved here.",
    workspaceCta: "Pick a CV",
    orPickOne: "or pick just one CV",
    orHand: "or add items by hand",
  },
  check: {
    progress: (checked, total) => `${checked} of ${total} done`,
    howToAdvance: "Press the green button to continue. You do not need to open every item.",
    calmTitle: "Keep these profile items?",
    calmBody: (total) =>
      total === 1
        ? "We found 1 item from your CVs. If it looks fine, press the green button."
        : `We found ${total} items from your CVs. If they look fine, press the green button. You can open the list later if you want.`,
    trustAll: "Yes — keep them and continue",
    trustAllWorking: "Saving… please wait",
    reviewDetails: "Show items one by one (optional)",
    hideDetails: "Hide the item list",
    confirmAll: "Yes — keep them and continue",
    confirmAllWorking: "Saving… please wait",
    onlyUnchecked: "Show only items not done yet",
    fromSource: (label) => `From: ${label}`,
    correct: "Yes, correct",
    edit: "Change",
    remove: "Remove",
    removeConfirm: "Remove this item? You can add it again later.",
    allCheckedTitle: "All items are saved",
    allCheckedBody: "Step 3 is next. Scroll down to Ready, or press the green button.",
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
    "Wir nutzen nur, was du als wahr bestätigst. Mach einen Schritt nach dem anderen. Du kannst jederzeit pausieren.",
  confirmedExplain:
    "Stimmt heißt: das ist wahr über dich. Nur bestätigte Einträge kommen in Bewerbungen.",
  backAgents: "Zurück zu Job-Agenten",
  steps: {
    add: "1. Hinzufügen",
    check: "2. Prüfen",
    ready: "3. Bereit",
  },
  next: {
    add: "Jetzt: Füge deine Erfahrung hinzu.",
    directions:
      "Jetzt: Lies deine Arbeitsrichtungen. Wenn sie stimmen, drücke den grünen Knopf.",
    check: (n) =>
      n <= 0
        ? "Jetzt: Gehe zu Bereit."
        : "Jetzt: Drücke den grünen Knopf, um deine Einträge zu behalten und weiterzugehen.",
    readyMissing: "Jetzt: Ergänze, was noch fehlt.",
    readyDone: "Du bist bereit. Öffne die Job-Agenten, wenn du magst — du wählst weiter jeden Job und prüfst jedes CV, bevor etwas gesendet wird.",
  },
  primary: {
    add: "Erfahrung hinzufügen",
    check: "Weiter",
    agreeDirections: "Ja — diese Richtungen stimmen",
    goAgents: "Job-Agenten öffnen (noch kein Versand)",
    addEducation: "Ausbildung hinzufügen",
    addMissing: "Fehlendes hinzufügen",
  },
  directions: {
    title: "Deine Arbeitsrichtungen",
    body: "Das sind die Arbeitsrichtungen aus deinen Lebensläufen. Lies die Liste. Wenn sie stimmt, drücke den grünen Knopf.",
    agreedTitle: "Richtungen gespeichert",
    agreedBody: "Gut. Als Nächstes behältst du deine Profileinträge — dann kannst du zu Bereit gehen.",
    continueCheck: "Weiter",
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
    clearMixedBody: "Nur nutzen, wenn die Lebensläufe der falschen Person importiert wurden.",
    clearMixedCta: "Alle Profileinträge löschen",
    clearMixedConfirm:
      "Wirklich alle Einträge löschen? Danach kannst du neu importieren.",
    reimportTitle: "Nur meine Lebensläufe importieren",
    reimportBody: "Wähle deinen Namen und drücke den grünen Knopf.",
    advancedToggle: "Neu starten nötig?",
    advancedHide: "Neu starten ausblenden",
    workspaceTitle: "Einen Lebenslauf aus dem Workspace",
    workspaceBody: "Vorschläge aus einem einzelnen hier gespeicherten Lebenslauf.",
    workspaceCta: "Lebenslauf wählen",
    orPickOne: "oder nur einen Lebenslauf wählen",
    orHand: "oder Einträge von Hand hinzufügen",
  },
  check: {
    progress: (checked, total) => `${checked} von ${total} erledigt`,
    howToAdvance: "Drücke den grünen Knopf, um weiterzugehen. Du musst nicht jeden Eintrag öffnen.",
    calmTitle: "Diese Profileinträge behalten?",
    calmBody: (total) =>
      total === 1
        ? "Wir haben 1 Eintrag aus deinen Lebensläufen gefunden. Wenn er passt, drücke den grünen Knopf."
        : `Wir haben ${total} Einträge aus deinen Lebensläufen gefunden. Wenn sie passen, drücke den grünen Knopf. Die Liste kannst du später öffnen.`,
    trustAll: "Ja — behalten und weiter",
    trustAllWorking: "Speichern… bitte warten",
    reviewDetails: "Einträge einzeln zeigen (optional)",
    hideDetails: "Liste ausblenden",
    confirmAll: "Ja — behalten und weiter",
    confirmAllWorking: "Speichern… bitte warten",
    onlyUnchecked: "Nur offene Einträge zeigen",
    fromSource: (label) => `Quelle: ${label}`,
    correct: "Ja, stimmt",
    edit: "Ändern",
    remove: "Entfernen",
    removeConfirm: "Diesen Eintrag entfernen? Du kannst ihn später wieder hinzufügen.",
    allCheckedTitle: "Alle Einträge sind gespeichert",
    allCheckedBody: "Schritt 3 kommt als Nächstes. Scrolle zu Bereit oder drücke den grünen Knopf.",
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
