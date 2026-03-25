(function renderApp() {
  window.BugGenie = window.BugGenie || {};

  const { html } = window.BugGenie;
  const {
    analyzeBugAssets,
    buildGoogleLensFallbackReport,
    generateReportFromLensSummary,
    shouldUseGoogleLensFallback,
    isGeminiConfigured
  } = window.BugGenie.analysis;
  const {
    getImageDataUrls,
    mapIncomingFiles,
    releaseFilePreviews
  } = window.BugGenie.fileUtils;
  const {
    buildRichReportDocument,
    renderRichReportContent,
    waitForImagesToLoad
  } = window.BugGenie.reportUtils;
  const {
    LucideIcon,
    InputGroup,
    ErrorBoundary,
    ReportDisplay,
    LoadingDots
  } = window.BugGenie.components;

  const { useCallback, useEffect, useRef, useState } = React;

  const INITIAL_ENV_CONTEXT = {
    url: "",
    version: "",
    testEnv: "",
    intent: ""
  };

  const ENVIRONMENT_OPTIONS = [
    "Production",
    "Staging",
    "QA",
    "Dev",
    "Local"
  ];

  const getFallbackImageFiles = (report, files) => {
    const imageIds = new Set(report?.fallbackContext?.imageAssetIds || []);
    return files.filter((file) => imageIds.has(file.id));
  };

  const getFallbackInstructions = (report, files) => {
    const imageFiles = getFallbackImageFiles(report, files);
    const unsupportedFiles = report?.fallbackContext?.unsupportedAssetNames || [];
    const reason = report?.fallbackContext?.reason || "Gemini was unavailable.";
    const hasSummary = Boolean(report?.fallbackContext?.searchSummary?.trim());

    return [
      "Google Lens fallback",
      "",
      reason,
      "",
      "Steps:",
      "1. Open Google Images or Google Lens.",
      "2. Upload one of the attached image files listed below.",
      "3. Copy the Google AI-generated summary or overview.",
      "4. Paste that summary back into BugGenie.",
      "5. Click Generate Ticket from Summary.",
      "",
      `Prepared image files: ${imageFiles.length > 0 ? imageFiles.map((file) => file.name).join(", ") : "None"}`,
      `Unsupported for Google image search: ${unsupportedFiles.length > 0 ? unsupportedFiles.join(", ") : "None"}`,
      `Summary already pasted into BugGenie: ${hasSummary ? "Yes" : "No"}`,
      `Target URL: ${report?.systemContext?.url || "N/A"}`,
      `Environment: ${report?.systemContext?.environment || "N/A"}`
    ].join("\n");
  };

  const FallbackAssistPanel = ({
    report,
    files,
    summaryValue,
    onSummaryChange,
    onGenerateFromSummary,
    isGeneratingFromSummary,
    hasGeneratedSummary,
    onOpenGoogleImages,
    onCopyInstructions,
    onOpenAsset,
    onDownloadAsset
  }) => {
    const imageFiles = getFallbackImageFiles(report, files);
    const unsupportedFiles = report?.fallbackContext?.unsupportedAssetNames || [];

    return html`
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-800">
              <${LucideIcon}
                name=${["triangle-alert", "circle-alert", "alert-circle"]}
                size=${18}
              />
              <h3 className="text-lg font-bold">
                Gemini unavailable, Google Lens fallback ready
              </h3>
            </div>
            <p className="text-sm text-amber-900 leading-relaxed max-w-3xl">
              This fallback now has an interim summary step. Upload the image to Google
              Images or Lens, copy the Google AI-generated summary, then paste it below
              so BugGenie can turn it into ticket content locally.
            </p>
            <p className="text-xs text-amber-700 font-medium">
              ${report?.fallbackContext?.reason}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick=${onOpenGoogleImages}
              className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 flex items-center gap-2"
            >
              <${LucideIcon} name=${["search", "image"]} size=${16} />
              Open Google Images
            </button>
            <button
              onClick=${onCopyInstructions}
              className="px-4 py-2 rounded-xl border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100 flex items-center gap-2"
            >
              <${LucideIcon} name="copy" size=${16} />
              Copy Lens Steps
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          ${imageFiles.length > 0
            ? imageFiles.map((file) => html`
                <div key=${file.id} className="bg-white border border-amber-200 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        ${file.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Prepared for Google image search upload
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick=${() => onOpenAsset(file)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                      >
                        <${LucideIcon} name="external-link" size=${12} />
                        Preview
                      </button>
                      <button
                        onClick=${() => onDownloadAsset(file)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                      >
                        <${LucideIcon} name="download" size=${12} />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              `)
            : html`
                <div className="md:col-span-2 bg-white border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                  Add at least one image attachment if you want to use the Google Lens fallback.
                </div>
              `}
        </div>

        <div className="mt-4 bg-white border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Paste Google AI Summary
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Paste the AI-generated summary from Google Search or Lens, then let BugGenie draft the ticket content.
              </p>
            </div>
            ${hasGeneratedSummary
              ? html`
                  <span className="text-[11px] font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                    Summary Applied
                  </span>
                `
              : null}
          </div>
          <textarea
            value=${summaryValue}
            onChange=${(event) => onSummaryChange(event.target.value)}
            placeholder="Paste the Google AI-generated analysis summary here..."
            rows=${8}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y"
          />
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-slate-500">
              Once this summary is applied, the normal ticket copy, export, and push actions become available again.
            </p>
            <button
              onClick=${onGenerateFromSummary}
              disabled=${isGeneratingFromSummary || !summaryValue.trim()}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <${LucideIcon}
                name=${isGeneratingFromSummary ? ["loader-circle", "loader-2"] : ["sparkles", "wand-sparkles", "file-text"]}
                size=${16}
                className=${isGeneratingFromSummary ? "animate-spin" : ""}
              />
              ${isGeneratingFromSummary
                ? "Building Ticket..."
                : hasGeneratedSummary
                  ? "Refresh Ticket from Summary"
                  : "Generate Ticket from Summary"}
            </button>
          </div>
        </div>

        ${unsupportedFiles.length > 0
          ? html`
              <div className="mt-4 text-xs text-amber-800">
                Non-image attachments remain local and are not uploaded to Google image search:
                ${unsupportedFiles.join(", ")}
              </div>
            `
          : null}
      </div>
    `;
  };

  const App = () => {
    console.log("BugGenie AI App Initializing...");
    const [files, setFiles] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [generatedReport, setGeneratedReport] = useState(null);
    const [targetSystem, setTargetSystem] = useState("jira");
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [isGeneratingFromSummary, setIsGeneratingFromSummary] = useState(false);
    const [lensSummaryInput, setLensSummaryInput] = useState("");
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);
    const [envContext, setEnvContext] = useState(INITIAL_ENV_CONTEXT);
    const fileInputRef = useRef(null);
    const latestFilesRef = useRef([]);

    useEffect(() => {
      latestFilesRef.current = files;
    }, [files]);

    useEffect(() => {
      return () => {
        releaseFilePreviews(latestFilesRef.current);
      };
    }, []);

    const buildRuntimeData = () => ({
      ...envContext,
      browser: navigator.userAgent.split(" ").slice(-1)[0],
      os: navigator.platform,
      resolution: `${window.screen.width} x ${window.screen.height}`
    });

    const onDrop = (event) => {
      if (typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      const incomingFiles = Array.from(
        event.target?.files || event.dataTransfer?.files || []
      );

      if (incomingFiles.length > 0) {
        setFiles((previousFiles) => [
          ...previousFiles,
          ...mapIncomingFiles(incomingFiles)
        ]);
      }

      if (event.target && "value" in event.target) {
        event.target.value = "";
      }
    };

    const removeFile = (id) => {
      setFiles((previousFiles) => {
        const fileToRemove = previousFiles.find((file) => file.id === id);

        if (fileToRemove) {
          releaseFilePreviews([fileToRemove]);
        }

        return previousFiles.filter((file) => file.id !== id);
      });
    };

    const handleReset = useCallback(() => {
      releaseFilePreviews(files);
      setFiles([]);
      setGeneratedReport(null);
      setTargetSystem("jira");
      setIsSyncing(false);
      setSyncSuccess(false);
      setIsExporting(false);
      setIsCopying(false);
      setCopySuccess(false);
      setIsGeneratingFromSummary(false);
      setLensSummaryInput("");
      setError(null);
      setToast(null);
      setEnvContext(INITIAL_ENV_CONTEXT);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }, [files]);

    const hasResettableState = Boolean(
      files.length ||
        generatedReport ||
        envContext.url ||
        envContext.version ||
        envContext.testEnv ||
        lensSummaryInput ||
        error ||
        toast ||
        syncSuccess ||
        copySuccess ||
        targetSystem !== "jira"
    );

    const isBusy =
      isAnalyzing ||
      isSyncing ||
      isExporting ||
      isCopying ||
      isGeneratingFromSummary;
    const isLensFallback = generatedReport?.fallbackContext?.mode?.startsWith(
      "google-lens"
    );
    const hasLensSummary = Boolean(
      generatedReport?.fallbackContext?.searchSummary?.trim()
    );
    const canUseTicketActions = !isLensFallback || hasLensSummary;

    const handleGenerateReport = async () => {
      if (files.length === 0) {
        return;
      }

      setIsAnalyzing(true);
      setGeneratedReport(null);
      setLensSummaryInput("");
      setError(null);

      const runtimeData = buildRuntimeData();

      if (!isGeminiConfigured()) {
        const fallbackReport = buildGoogleLensFallbackReport(
          files,
          runtimeData,
          "Missing Gemini API key. Google Lens fallback prepared for the attached image files."
        );
        setGeneratedReport(fallbackReport);
        setError(
          "Gemini API key is missing. Switched to Google Lens fallback for image attachments."
        );
        setIsAnalyzing(false);
        return;
      }

      try {
        const report = await analyzeBugAssets(files, runtimeData);
        setGeneratedReport(report);
        setLensSummaryInput("");
      } catch (analysisError) {
        console.error(analysisError);

        if (shouldUseGoogleLensFallback(analysisError)) {
          const fallbackReport = buildGoogleLensFallbackReport(
            files,
            runtimeData,
            analysisError.message
          );
          setGeneratedReport(fallbackReport);
          setLensSummaryInput("");
          setError(
            "Gemini API key was rejected or unavailable. Switched to Google Lens fallback for image attachments."
          );
        } else {
          const message =
            analysisError?.message &&
            analysisError.message !== "Gemini API request failed."
              ? analysisError.message
              : "Failed to analyze assets. Please check your connection and try again.";
          setError(message);
        }
      } finally {
        setIsAnalyzing(false);
      }
    };

    const handleGenerateFromLensSummary = async () => {
      if (!generatedReport || !isLensFallback) {
        return;
      }

      const normalizedSummary = lensSummaryInput.trim();

      if (!normalizedSummary) {
        setError("Paste the Google AI-generated summary before creating the ticket draft.");
        return;
      }

      setIsGeneratingFromSummary(true);
      setError(null);

      try {
        const summaryReport = generateReportFromLensSummary(
          normalizedSummary,
          files,
          buildRuntimeData(),
          generatedReport.fallbackContext || {}
        );
        setGeneratedReport(summaryReport);
        setLensSummaryInput(normalizedSummary);
        setToast({
          title: "Ticket Draft Updated",
          message:
            "The Google Search or Lens summary has been turned into ticket-ready content.",
          ticketId: summaryReport.systemContext?.bugId || "LENS-SUMMARY",
          url:
            summaryReport.fallbackContext?.googleImageSearchUrl ||
            "https://images.google.com/"
        });
      } catch (summaryError) {
        console.error("Summary processing failed", summaryError);
        setError(
          summaryError?.message ||
            "Could not build the ticket draft from the pasted Google summary."
        );
      } finally {
        setIsGeneratingFromSummary(false);
      }
    };

    const handleCopyRichText = useCallback(async () => {
      if (!generatedReport) {
        return;
      }

      setIsCopying(true);
      setError(null);

      try {
        const { container, cleanup } = await renderRichReportContent(
          generatedReport,
          files,
          {
            contentEditable: true
          }
        );

        try {
          const range = document.createRange();
          range.selectNodeContents(container);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);

          const successful = document.execCommand("copy");
          selection.removeAllRanges();

          if (!successful) {
            throw new Error("execCommand failed");
          }

          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        } finally {
          cleanup();
        }
      } catch (copyError) {
        console.error("Rich copy failed", copyError);
        setError("Rich text copy failed.");
      } finally {
        setIsCopying(false);
      }
    }, [files, generatedReport]);

    const handleSync = async () => {
      setIsSyncing(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const prefix = targetSystem === "jira" ? "JIRA" : "ADO";
      const mockTicketId = `${prefix}-${Math.floor(Math.random() * 9000) + 1000}`;
      const targetUrl =
        targetSystem === "jira"
          ? "https://company.atlassian.net"
          : "https://dev.azure.com/org";

      setIsSyncing(false);
      setSyncSuccess(true);
      setToast({
        title: "Ticket Created Successfully",
        message: `Pushed to ${targetUrl}. Generated ID: ${mockTicketId}`,
        ticketId: mockTicketId,
        url: targetUrl
      });

      setTimeout(() => setSyncSuccess(false), 5000);
    };

    const handleExportPDF = async () => {
      if (!generatedReport) {
        return;
      }

      setIsExporting(true);
      setError(null);

      try {
        const imageDataUrls = await getImageDataUrls(files);
        const richDocument = buildRichReportDocument(
          generatedReport,
          imageDataUrls
        );
        const printWindow = window.open("", "_blank", "width=1100,height=800");

        if (!printWindow) {
          throw new Error("Pop-up blocked");
        }

        printWindow.document.open();
        printWindow.document.write(richDocument);
        printWindow.document.close();

        await new Promise((resolve) => {
          if (printWindow.document.readyState === "complete") {
            resolve();
            return;
          }

          printWindow.addEventListener("load", resolve, { once: true });
        });

        await waitForImagesToLoad(printWindow.document.body);

        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
      } catch (exportError) {
        console.error("PDF generation error:", exportError);
        setError(
          exportError.message === "Pop-up blocked"
            ? "PDF window could not open. Please allow pop-ups."
            : "PDF export failed. Please try again."
        );
      } finally {
        setIsExporting(false);
      }
    };

    const openWindowSafely = (url, message) => {
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");

      if (!newWindow) {
        setError(message || "Could not open a new window. Please allow pop-ups.");
        return false;
      }

      return true;
    };

    const handleOpenGoogleImages = () => {
      openWindowSafely(
        generatedReport?.fallbackContext?.googleImageSearchUrl ||
          "https://images.google.com/",
        "Could not open Google Images. Please allow pop-ups."
      );
    };

    const handleOpenAssetPreview = (file) => {
      if (!file?.preview) {
        setError("Preview unavailable for this attachment.");
        return;
      }

      openWindowSafely(
        file.preview,
        "Could not open the attachment preview. Please allow pop-ups."
      );
    };

    const handleDownloadAsset = (file) => {
      if (!file) {
        return;
      }

      const downloadUrl = file.preview || URL.createObjectURL(file.file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (!file.preview) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      }
    };

    const handleCopyFallbackInstructions = async () => {
      try {
        await navigator.clipboard.writeText(
          getFallbackInstructions(generatedReport, files)
        );
        setToast({
          title: "Fallback Steps Copied",
          message:
            "Google Lens instructions are on your clipboard and ready to paste anywhere you need them.",
          ticketId: "MANUAL-LENS",
          url:
            generatedReport?.fallbackContext?.googleImageSearchUrl ||
            "https://images.google.com/"
        });
      } catch (copyError) {
        console.error("Fallback instruction copy failed", copyError);
        setError("Could not copy Google Lens fallback steps.");
      }
    };

    return html`
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8 relative">
        ${
          toast &&
          html`
            <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-right-8 duration-300">
              <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-2xl border border-slate-700 max-sm:left-4 max-sm:right-4 max-w-sm w-full relative">
                <button
                  onClick=${() => setToast(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                  <${LucideIcon} name="x" size=${16} />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-green-500 p-1 rounded-full">
                    <${LucideIcon}
                      name=${["circle-check", "check-circle-2", "check-circle"]}
                      size=${16}
                      className="text-white"
                    />
                  </div>
                  <h4 className="font-bold text-sm">${toast.title}</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pr-4 mb-3">
                  ${toast.message}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-3">
                  <span className="text-[10px] font-mono text-indigo-400 font-bold tracking-wider truncate">
                    ${toast.ticketId}
                  </span>
                  <button
                    onClick=${() => window.open(toast.url, "_blank", "noopener,noreferrer")}
                    className="text-[10px] text-slate-500 hover:text-indigo-400 flex items-center gap-1 shrink-0"
                  >
                    Open Link
                    <${LucideIcon} name="external-link" size=${10} />
                  </button>
                </div>
              </div>
            </div>
          `
        }

        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3" key="app-header-v2">
              <img
                src="./assets/icons/BugGenie.png"
                alt="BugGenie AI"
                className="w-12 h-12 object-contain"
                referrerPolicy="no-referrer"
              />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">BugGenie AI</h1>
                <p className="text-slate-500 text-sm font-medium">
                  Auto-Bug Logging & Triage Engine
                </p>
              </div>
            </div>

            <div className="flex bg-white p-1 rounded-lg border shadow-sm">
              ${["jira", "azure"].map((system) => {
                const buttonClass =
                  targetSystem === system
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100";

                return html`
                  <button
                    key=${system}
                    onClick=${() => {
                      setTargetSystem(system);
                      setSyncSuccess(false);
                    }}
                    className=${`px-4 py-2 rounded-md text-sm font-semibold transition-all capitalize ${buttonClass}`}
                  >
                    ${system === "jira" ? "Jira Cloud" : "Azure DevOps"}
                  </button>
                `;
              })}
            </div>
          </header>

          ${
            error &&
            html`
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                ${error}
              </div>
            `
          }

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <${LucideIcon} name="layers" className="w-5 h-5 text-indigo-600" />
                  System Context
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Intent/Context for AI
                    </label>
                    <textarea
                      value=${envContext.intent}
                      placeholder="e.g., I'm testing the login flow and it fails when using a long password..."
                      onChange=${(event) =>
                        setEnvContext((previous) => ({
                          ...previous,
                          intent: event.target.value
                        }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[80px] max-h-[200px] overflow-y-auto resize-y"
                    />
                  </div>
                  <${InputGroup}
                    label="Target URL"
                    value=${envContext.url}
                    placeholder="https://..."
                    onChange=${(value) =>
                      setEnvContext((previous) => ({
                        ...previous,
                        url: value
                      }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <${InputGroup}
                      label="Version"
                      value=${envContext.version}
                      placeholder="v1.0"
                      onChange=${(value) =>
                        setEnvContext((previous) => ({
                          ...previous,
                          version: value
                        }))}
                    />
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Environment
                      </label>
                      <select
                        value=${envContext.testEnv}
                        onChange=${(event) =>
                          setEnvContext((previous) => ({
                            ...previous,
                            testEnv: event.target.value
                          }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select...</option>
                        ${ENVIRONMENT_OPTIONS.map(
                          (option) => html`
                            <option key=${option} value=${option}>${option}</option>
                          `
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <${LucideIcon} name="upload" className="w-5 h-5 text-indigo-600" />
                  Asset Collection
                </h2>
                <div
                  onDragOver=${(event) => event.preventDefault()}
                  onDrop=${onDrop}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                >
                  <input
                    ref=${fileInputRef}
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple=${true}
                    onChange=${onDrop}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-100">
                      <${LucideIcon}
                        name="upload"
                        className="w-6 h-6 text-slate-500 group-hover:text-indigo-600"
                      />
                    </div>
                    <p className="text-sm font-semibold">Drop artifacts</p>
                  </label>
                </div>

                ${
                  files.length > 0 &&
                  html`
                    <div className="mt-4 space-y-2">
                      ${files.map((file) => html`
                        <div
                          key=${file.id}
                          className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <${LucideIcon}
                              name=${file.type === "image" ? "image" : "file-text"}
                              size=${14}
                              className=${file.type === "image" ? "text-blue-500" : ""}
                              fallback=${file.type === "image" ? "IMG" : "DOC"}
                            />
                            <span className="truncate">${file.name}</span>
                          </div>
                          <button
                            onClick=${() => removeFile(file.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1 flex items-center justify-center"
                            title="Delete file"
                            aria-label="Delete file"
                          >
                            <${LucideIcon} name="trash-2" size=${16} fallback="×" />
                          </button>
                        </div>
                      `)}
                    </div>
                  `
                }

                <button
                  disabled=${files.length === 0 || isAnalyzing}
                  onClick=${handleGenerateReport}
                  className="w-full mt-6 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                >
                  <${LucideIcon}
                    name=${isAnalyzing ? "loader-circle" : "shield-check"}
                    className=${isAnalyzing ? "animate-spin w-5 h-5" : "w-5 h-5"}
                  />
                  ${isAnalyzing ? html`AI is Analyzing<${LoadingDots} />` : "Generate Full Report"}
                </button>

                <button
                  disabled=${!hasResettableState || isBusy}
                  onClick=${handleReset}
                  className="w-full mt-3 border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  <${LucideIcon} name="rotate-ccw" size=${18} />
                  Reset
                </button>
              </div>
            </div>

            <div className="lg:col-span-8">
              ${
                !generatedReport &&
                !isAnalyzing &&
                html`
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center h-[500px] flex flex-col items-center justify-center">
                    <${LucideIcon}
                      name=${["file-search", "search"]}
                      className="w-16 h-16 text-slate-200 mb-4"
                    />
                    <h3 className="text-xl font-bold">10-Section AI Analysis</h3>
                    <p className="text-slate-400 mt-2 max-w-sm mx-auto">
                      Upload screenshots/logs. AI will automatically deduce
                      environment, device, error codes, and format a
                      comprehensive PDF-ready report.
                    </p>
                  </div>
                `
              }

              ${
                isAnalyzing &&
                html`
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center h-[500px] flex flex-col items-center justify-center">
                    <div className="relative mb-6">
                      <${LucideIcon}
                        name="loader-circle"
                        className="w-16 h-16 text-indigo-600 animate-spin"
                      />
                      <${LucideIcon}
                        name="search"
                        className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      />
                    </div>
                    <h3 className="text-xl font-bold">Forensic Analysis in Progress<${LoadingDots} /></h3>
                    <p className="text-slate-400 mt-2">
                      Deducing device types, analyzing error boundaries, and
                      compiling 10 sections.
                    </p>
                  </div>
                `
              }

              ${
                generatedReport &&
                html`
                  <${ErrorBoundary}>
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      ${isLensFallback
                        ? html`
                            <${FallbackAssistPanel}
                              report=${generatedReport}
                              files=${files}
                              summaryValue=${lensSummaryInput}
                              onSummaryChange=${setLensSummaryInput}
                              onGenerateFromSummary=${handleGenerateFromLensSummary}
                              isGeneratingFromSummary=${isGeneratingFromSummary}
                              hasGeneratedSummary=${hasLensSummary}
                              onOpenGoogleImages=${handleOpenGoogleImages}
                              onCopyInstructions=${handleCopyFallbackInstructions}
                              onOpenAsset=${handleOpenAssetPreview}
                              onDownloadAsset=${handleDownloadAsset}
                            />
                          `
                        : null}

                      <${ReportDisplay} report=${generatedReport} files=${files} />

                      <div className="flex flex-col sm:flex-row gap-4 max-w-4xl mx-auto mt-6">
                        ${canUseTicketActions
                          ? html`
                              <button
                                onClick=${handleSync}
                                disabled=${isSyncing}
                                className=${`flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-2xl shadow-lg transition-all ${
                                  syncSuccess
                                    ? "bg-green-100 text-green-700 border-2 border-green-200"
                                    : "bg-slate-900 text-white hover:bg-black"
                                }`}
                              >
                                <${LucideIcon}
                                  name=${isSyncing
                                    ? ["loader-circle", "loader-2"]
                                    : syncSuccess
                                      ? ["circle-check", "check-circle-2", "check-circle"]
                                      : "send"}
                                  className=${isSyncing ? "animate-spin" : ""}
                                />
                                ${
                                  isSyncing
                                    ? "Pushing..."
                                    : syncSuccess
                                      ? "Success"
                                      : `Push to ${targetSystem === "jira" ? "Jira" : "Azure"}`
                                }
                              </button>

                              <button
                                onClick=${handleCopyRichText}
                                disabled=${isCopying}
                                className=${`flex-1 px-8 py-4 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${
                                  copySuccess
                                    ? "bg-green-100 border-green-200 text-green-700"
                                    : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                }`}
                              >
                                <${LucideIcon}
                                  name=${isCopying
                                    ? ["loader-circle", "loader-2"]
                                    : copySuccess
                                      ? ["circle-check", "check-circle-2", "check-circle"]
                                      : "copy"}
                                  size=${18}
                                  className=${isCopying ? "animate-spin" : ""}
                                />
                                ${
                                  isCopying
                                    ? "Processing..."
                                    : copySuccess
                                      ? "Copied Text!"
                                      : "Copy to Clipboard"
                                }
                              </button>

                              <button
                                onClick=${handleExportPDF}
                                disabled=${isExporting}
                                className="px-8 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-white hover:border-slate-300 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                              >
                                <${LucideIcon}
                                  name=${isExporting ? ["loader-circle", "loader-2"] : "printer"}
                                  size=${18}
                                  className=${isExporting ? "animate-spin" : ""}
                                />
                                ${isExporting ? "Generating..." : "Export PDF"}
                              </button>
                            `
                          : html`
                              <button
                                onClick=${handleOpenGoogleImages}
                                className="flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-2xl shadow-lg transition-all bg-amber-600 text-white hover:bg-amber-700"
                              >
                                <${LucideIcon} name=${["search", "image"]} />
                                Open Google Images
                              </button>

                              <button
                                onClick=${handleCopyFallbackInstructions}
                                className="flex-1 px-8 py-4 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                              >
                                <${LucideIcon} name="copy" size=${18} />
                                Copy Lens Steps
                              </button>

                              <button
                                onClick=${handleExportPDF}
                                disabled=${isExporting}
                                className="px-8 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-white hover:border-slate-300 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                              >
                                <${LucideIcon}
                                  name=${isExporting ? ["loader-circle", "loader-2"] : "printer"}
                                  size=${18}
                                  className=${isExporting ? "animate-spin" : ""}
                                />
                                ${isExporting ? "Generating..." : "Export PDF"}
                              </button>
                            `}
                      </div>
                    </div>
                  </${ErrorBoundary}>
                `
              }
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const rootElement = document.getElementById("root");
  ReactDOM.createRoot(rootElement).render(html`<${App} />`);
})();
