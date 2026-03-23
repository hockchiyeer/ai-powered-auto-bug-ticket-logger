(function registerAnalysis() {
  window.BugGenie = window.BugGenie || {};

  const { geminiApiKey, googleImageSearchUrl } = window.BugGenie.config;
  const { fileToBase64 } = window.BugGenie.fileUtils;
  const { sanitizeReport } = window.BugGenie.reportUtils;
  const modelEndpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";

  const isGeminiConfigured = () => Boolean(geminiApiKey);

  const normalizeErrorMessage = (error) => {
    return String(
      error?.message || error?.statusText || error?.error || ""
    ).toLowerCase();
  };

  const shouldUseGoogleLensFallback = (error) => {
    const message = normalizeErrorMessage(error);
    const credentialSignals = [
      "missing gemini api key",
      "api key",
      "api_key_invalid",
      "not valid",
      "invalid api key",
      "credential",
      "permission denied",
      "forbidden",
      "unauthorized",
      "access denied",
      "reported as leaked",
      "blocked"
    ];

    return credentialSignals.some((signal) => message.includes(signal));
  };

  const normalizeSummaryText = (value) => {
    return String(value || "")
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const normalizeLabel = (value) => {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  };

  const splitParagraphs = (value) => {
    return normalizeSummaryText(value)
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  };

  const extractLabeledSections = (summaryText) => {
    const sections = {};
    let activeLabel = null;

    normalizeSummaryText(summaryText)
      .split("\n")
      .forEach((line) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          return;
        }

        const labelMatch = trimmedLine.match(
          /^([A-Za-z][A-Za-z0-9 /()&_-]{1,50}):\s*(.*)$/
        );

        if (labelMatch) {
          activeLabel = normalizeLabel(labelMatch[1]);
          sections[activeLabel] = labelMatch[2] ? labelMatch[2].trim() : "";
          return;
        }

        if (activeLabel) {
          sections[activeLabel] = sections[activeLabel]
            ? `${sections[activeLabel]}\n${trimmedLine}`
            : trimmedLine;
        }
      });

    return sections;
  };

  const readSection = (sections, labels) => {
    for (const label of labels) {
      const directMatch = sections[normalizeLabel(label)];

      if (directMatch) {
        return directMatch.trim();
      }
    }

    const sectionEntries = Object.entries(sections);

    for (const [key, value] of sectionEntries) {
      if (labels.some((label) => key.includes(normalizeLabel(label)))) {
        return value.trim();
      }
    }

    return "";
  };

  const extractNumberedSteps = (summaryText) => {
    return normalizeSummaryText(summaryText)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+[\.\)-]\s+/.test(line))
      .map((line) => line.replace(/^\d+[\.\)-]\s+/, "").trim())
      .filter(Boolean);
  };

  const firstSentence = (value) => {
    const normalized = normalizeSummaryText(value);
    const sentenceMatch = normalized.match(/^(.+?[.!?])(?:\s|$)/);
    return (sentenceMatch?.[1] || normalized).trim();
  };

  const truncate = (value, maxLength = 90) => {
    const normalized = normalizeSummaryText(value);

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 3).trim()}...`;
  };

  const inferSeverity = (summaryText) => {
    const normalized = normalizeSummaryText(summaryText).toLowerCase();

    if (
      /(critical|outage|down|data loss|security|payment failure|crash on launch|cannot log in|blocked for all users)/.test(
        normalized
      )
    ) {
      return "Critical";
    }

    if (
      /(high|broken|fails|failure|error|cannot|unable|stuck|blank screen|not working)/.test(
        normalized
      )
    ) {
      return "High";
    }

    if (/(low|minor|cosmetic|ui issue|typo)/.test(normalized)) {
      return "Low";
    }

    return "Medium";
  };

  const priorityFromSeverity = (severity) => {
    switch (severity) {
      case "Critical":
        return "P0";
      case "High":
        return "P1";
      case "Low":
        return "P3";
      default:
        return "P2";
    }
  };

  const extractErrorCode = (summaryText) => {
    const errorCodeMatch = normalizeSummaryText(summaryText).match(
      /(?:error(?:\s*code)?|code)\s*[:#-]?\s*([A-Z0-9_-]{3,})/i
    );

    return errorCodeMatch?.[1] || "N/A";
  };

  const extractComponent = (sections, summaryText) => {
    const sectionValue = readSection(sections, [
      "component",
      "feature",
      "screen",
      "page",
      "module",
      "area affected"
    ]);

    if (sectionValue) {
      return sectionValue;
    }

    const componentMatch = normalizeSummaryText(summaryText).match(
      /(?:on|in|within)\s+the\s+([A-Za-z0-9 /_-]{3,40})(?:\s+page|\s+screen|\s+flow|\s+component)?/i
    );

    return componentMatch?.[1]?.trim() || "N/A";
  };

  const buildGoogleLensFallbackReport = (assets, envData = {}, reason) => {
    const imageAssets = assets.filter((asset) => asset.type === "image");
    const unsupportedAssets = assets.filter((asset) => asset.type !== "image");
    const fallbackReason =
      reason ||
      "Gemini AI analysis was unavailable, so the app prepared a Google Lens fallback for image attachments.";

    const report = sanitizeReport({
      metadata: {
        title: imageAssets.length
          ? "Google Lens fallback prepared for manual image analysis"
          : "Google Lens fallback needs at least one image attachment",
        severity: "Medium",
        priority: "P2",
        status: "Needs Manual Review"
      },
      environment: {
        client: envData.browser || "N/A",
        device: envData.resolution || "N/A",
        osPlatform: envData.os || "N/A",
        networkCondition: "N/A"
      },
      behavior: {
        expected:
          "Gemini should analyze the attached artifacts and return a structured 10-section bug report.",
        observed:
          "Gemini credentials were missing or rejected, so the app switched to a Google Lens fallback for image-based review."
      },
      stepsToReproduce: [
        imageAssets.length > 0
          ? "Open Google Images or Google Lens from the fallback actions in this app."
          : "Attach at least one screenshot or other image artifact.",
        imageAssets.length > 0
          ? `Upload one of the prepared image files: ${imageAssets
              .map((asset) => asset.name)
              .join(", ")}`
          : "Retry analysis after adding an image attachment.",
        "Copy the AI-generated summary from Google Search or Google Lens.",
        "Paste that summary back into BugGenie to generate ticket-ready content locally."
      ],
      technicalDetails: {
        errorCode: "GEMINI_FALLBACK_GOOGLE_LENS",
        component: "AI Analysis Engine",
        logsOrStackTrace: fallbackReason,
        additionalNotes: unsupportedAssets.length > 0
          ? `Google image search only supports image files in this fallback. Other attached files stay local: ${unsupportedAssets
              .map((asset) => asset.name)
              .join(", ")}`
          : "Only image attachments are handed off in the Google Lens fallback."
      },
      impact: {
        user:
          "Automatic report generation is paused until a manual Google Lens review is completed or Gemini access is restored.",
        business:
          "Bug logging remains possible, but triage slows down because image review becomes a manual step."
      },
      investigation: {
        rootCause: fallbackReason,
        workaround: imageAssets.length > 0
          ? "Use the provided Google Lens fallback actions, then paste the Google AI summary back into BugGenie."
          : "Attach a screenshot or other image artifact, then retry the fallback path.",
        proposedFix:
          "Restore a valid Gemini API key to re-enable automatic analysis, or keep using the manual Google Lens path for screenshots."
      },
      systemContext: {
        url: envData.url || "N/A",
        environment: envData.testEnv || "N/A"
      }
    });

    report.fallbackContext = {
      mode: "google-lens",
      reason: fallbackReason,
      googleImageSearchUrl,
      imageAssetIds: imageAssets.map((asset) => asset.id),
      imageAssetNames: imageAssets.map((asset) => asset.name),
      unsupportedAssetNames: unsupportedAssets.map((asset) => asset.name),
      searchSummary: ""
    };

    return report;
  };

  const generateReportFromLensSummary = (
    summaryText,
    assets,
    envData = {},
    fallbackContext = {}
  ) => {
    const normalizedSummary = normalizeSummaryText(summaryText);

    if (!normalizedSummary) {
      throw new Error("Google Search AI summary is empty.");
    }

    const sections = extractLabeledSections(normalizedSummary);
    const paragraphs = splitParagraphs(normalizedSummary);
    const numberedSteps = extractNumberedSteps(normalizedSummary);
    const titleField = readSection(sections, ["title", "issue", "bug", "summary"]);
    const expectedField = readSection(sections, [
      "expected",
      "expected behavior",
      "intended behavior",
      "should happen"
    ]);
    const observedField = readSection(sections, [
      "observed",
      "actual",
      "actual behavior",
      "problem",
      "issue"
    ]);
    const rootCauseField = readSection(sections, [
      "root cause",
      "possible cause",
      "cause",
      "analysis"
    ]);
    const workaroundField = readSection(sections, ["workaround", "temporary fix"]);
    const proposedFixField = readSection(sections, [
      "fix",
      "proposed fix",
      "recommendation",
      "next step"
    ]);
    const userImpactField = readSection(sections, ["user impact", "impact"]);
    const businessImpactField = readSection(sections, ["business impact"]);
    const severityField = readSection(sections, ["severity"]);
    const priorityField = readSection(sections, ["priority"]);

    const inferredSeverity = severityField
      ? severityField.charAt(0).toUpperCase() + severityField.slice(1).toLowerCase()
      : inferSeverity(normalizedSummary);
    const inferredPriority = priorityField || priorityFromSeverity(inferredSeverity);
    const title =
      titleField ||
      truncate(
        firstSentence(normalizedSummary) ||
          "Ticket drafted from Google Search AI summary"
      );
    const observed =
      observedField ||
      paragraphs.slice(0, 2).join("\n\n") ||
      normalizedSummary;
    const expected =
      expectedField ||
      "The affected flow should complete successfully without the issue described in the Google Search AI summary.";
    const stepsToReproduce =
      numberedSteps.length > 0
        ? numberedSteps
        : [
            "Open Google Images or Google Lens and inspect the attached image.",
            "Review the AI-generated summary returned by Google Search.",
            "Use the pasted summary in BugGenie to continue ticket drafting."
          ];

    const report = sanitizeReport({
      metadata: {
        title,
        severity: inferredSeverity,
        priority: inferredPriority,
        status: "Open"
      },
      environment: {
        client: envData.browser || "N/A",
        device: envData.resolution || "N/A",
        osPlatform: envData.os || "N/A",
        networkCondition: "N/A"
      },
      behavior: {
        expected,
        observed
      },
      stepsToReproduce,
      technicalDetails: {
        errorCode: extractErrorCode(normalizedSummary),
        component: extractComponent(sections, normalizedSummary),
        logsOrStackTrace: normalizedSummary,
        additionalNotes: [
          "Ticket generated from a pasted Google Search or Google Lens AI summary.",
          readSection(sections, ["additional notes", "notes"]) || ""
        ]
          .filter(Boolean)
          .join("\n\n")
      },
      impact: {
        user:
          userImpactField ||
          "Users encounter the behavior described in the Google Search AI summary until the issue is resolved.",
        business:
          businessImpactField ||
          "Manual follow-up is required because automated image analysis was unavailable."
      },
      investigation: {
        rootCause: rootCauseField || "N/A",
        workaround:
          workaroundField ||
          "Use the available workaround from the Google Search AI summary, or continue manual triage.",
        proposedFix:
          proposedFixField ||
          "Use the Google Search AI summary as a draft and refine the fix with engineering investigation."
      },
      systemContext: {
        url: envData.url || "N/A",
        environment: envData.testEnv || "N/A"
      }
    });

    report.fallbackContext = {
      ...fallbackContext,
      mode: "google-lens-summary",
      searchSummary: normalizedSummary,
      reason:
        fallbackContext.reason ||
        "Gemini AI analysis was unavailable, so Google Search AI summary content was used instead.",
      googleImageSearchUrl:
        fallbackContext.googleImageSearchUrl || googleImageSearchUrl,
      imageAssetIds:
        fallbackContext.imageAssetIds ||
        assets.filter((asset) => asset.type === "image").map((asset) => asset.id),
      imageAssetNames:
        fallbackContext.imageAssetNames ||
        assets.filter((asset) => asset.type === "image").map((asset) => asset.name),
      unsupportedAssetNames:
        fallbackContext.unsupportedAssetNames ||
        assets.filter((asset) => asset.type !== "image").map((asset) => asset.name),
      summaryCapturedAt: new Date().toISOString()
    };

    return report;
  };

  const analyzeBugAssets = async (assets, envData = {}) => {
    if (!isGeminiConfigured()) {
      throw new Error(
        "Missing Gemini API key. Set window.BUGGENIE_CONFIG.geminiApiKey before loading the app."
      );
    }

    const systemPrompt = `You are an expert QA Engineer and Technical Lead.
Analyze the provided images/logs and system context to generate a highly detailed, 10-section bug report.

CRITICAL INSTRUCTIONS:
1. Deduce details from the images if possible. For example:
- Check status bars for OS (iOS vs Android) and Network Condition (WiFi, LTE, signal bars).
- Check UI layout to deduce Device (e.g., iPhone, Desktop Browser, Tablet).
- Look for visible error toasts, console logs, or network requests for Error Codes.
2. If any piece of information cannot be deduced or found, output "N/A". DO NOT guess wildly if there is no visual or
contextual evidence.

The output MUST be a JSON object matching this schema:
{
"metadata": {
"title": "Concise bug title",
"severity": "Low | Medium | High | Critical",
"priority": "P0 | P1 | P2 | P3",
"status": "Open"
},
"environment": {
"client": "Browser or App version (deduce if possible)",
"device": "Device model or type (e.g., iPhone 14, Desktop, Android Tablet)",
"osPlatform": "OS and version",
"networkCondition": "e.g., 4G, WiFi, Offline, N/A"
},
"behavior": {
"expected": "Detailed explanation of what should happen",
"observed": "Detailed explanation of what actually happened"
},
"stepsToReproduce": ["step 1", "step 2", "step 3"],
"technicalDetails": {
"errorCode": "Any visible error code or N/A",
"component": "The UI or system component failing",
"logsOrStackTrace": "Transcribe any visible stack traces, logs, or 'N/A'",
"additionalNotes": "Any technical observations or 'N/A'"
},
"impact": {
"user": "How this affects the end user",
"business": "How this impacts business metrics/revenue"
},
"investigation": {
"rootCause": "Hypothesized root cause or 'N/A'",
"workaround": "Any possible workaround or 'N/A'",
"proposedFix": "Suggested technical fix or 'N/A'"
}
}`;

    const userQuery = `Analyze this bug.
User Provided Context (Use this if available, otherwise deduce): URL=${envData.url || "N/A"}, Env=${
      envData.testEnv || "N/A"
    }, Version=${envData.version || "N/A"}, Browser=${envData.browser || "N/A"}, OS=${
      envData.os || "N/A"
    }.`;

    const imageParts = await Promise.all(
      assets
        .filter((asset) => asset.type === "image")
        .map(async (asset) => ({
          inlineData: {
            mimeType: asset.file.type,
            data: await fileToBase64(asset.file)
          }
        }))
    );

    let retries = 0;
    const maxRetries = 5;
    const backoff = [1000, 2000, 4000, 8000, 16000];

    while (retries < maxRetries) {
      try {
        const response = await fetch(`${modelEndpoint}?key=${geminiApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: userQuery }, ...imageParts]
              }
            ],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          const message = errorPayload?.error?.message || "Gemini API request failed.";
          throw new Error(message);
        }

        const result = await response.json();
        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = JSON.parse(rawText);
        const report = sanitizeReport(parsed);

        return {
          ...report,
          systemContext: {
            ...(report.systemContext || {}),
            url: envData.url || report.systemContext?.url || "N/A",
            environment:
              envData.testEnv || report.systemContext?.environment || "N/A"
          }
        };
      } catch (error) {
        retries += 1;

        if (shouldUseGoogleLensFallback(error) || retries === maxRetries) {
          throw error;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, backoff[retries - 1]);
        });
      }
    }

    throw new Error("Analysis could not be completed.");
  };

  window.BugGenie.analysis = {
    analyzeBugAssets,
    buildGoogleLensFallbackReport,
    generateReportFromLensSummary,
    shouldUseGoogleLensFallback,
    isGeminiConfigured
  };
})();
