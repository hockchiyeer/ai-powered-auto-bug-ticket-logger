(function registerReportUtils() {
  window.BugGenie = window.BugGenie || {};

  const { getImageDataUrls } = window.BugGenie.fileUtils;

  const escapeHtml = (value) => {
    return String(value ?? "N/A")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const sanitizeReport = (rawReport = {}) => {
    const defaultMetadata = {
      title: "N/A",
      severity: "N/A",
      priority: "N/A",
      status: "Open"
    };
    const defaultEnvironment = {
      client: "N/A",
      device: "N/A",
      osPlatform: "N/A",
      networkCondition: "N/A"
    };
    const defaultBehavior = {
      expected: "N/A",
      observed: "N/A"
    };
    const defaultSteps = ["Not provided"];
    const defaultTechnicalDetails = {
      errorCode: "N/A",
      component: "N/A",
      logsOrStackTrace: "N/A",
      additionalNotes: "N/A"
    };
    const defaultImpact = {
      user: "N/A",
      business: "N/A"
    };
    const defaultInvestigation = {
      rootCause: "N/A",
      workaround: "N/A",
      proposedFix: "N/A"
    };

    return {
      metadata: { ...defaultMetadata, ...(rawReport.metadata || {}) },
      environment: { ...defaultEnvironment, ...(rawReport.environment || {}) },
      behavior: { ...defaultBehavior, ...(rawReport.behavior || {}) },
      stepsToReproduce:
        Array.isArray(rawReport.stepsToReproduce) &&
        rawReport.stepsToReproduce.length
          ? rawReport.stepsToReproduce
          : defaultSteps,
      technicalDetails: {
        ...defaultTechnicalDetails,
        ...(rawReport.technicalDetails || {})
      },
      impact: { ...defaultImpact, ...(rawReport.impact || {}) },
      investigation: {
        ...defaultInvestigation,
        ...(rawReport.investigation || {})
      },
      systemContext: {
        bugId:
          rawReport.systemContext?.bugId ||
          `BUG-${Math.floor(Math.random() * 90000) + 10000}`,
        reportedBy: rawReport.systemContext?.reportedBy || "Auto-Logger User",
        dateReported:
          rawReport.systemContext?.dateReported ||
          new Date().toLocaleDateString(),
        url: rawReport.systemContext?.url || "N/A",
        environment: rawReport.systemContext?.environment || "N/A",
        version: rawReport.systemContext?.version || "N/A",
        intent: rawReport.systemContext?.intent || "N/A",
        ...(rawReport.systemContext || {})
      }
    };
  };

  const buildRichReportHtml = (report, imageDataUrls = []) => {
    const r = sanitizeReport(report || {});
    const sys = r.systemContext || {};

    const userContextFields = [
      { label: "User Prompt", value: sys.intent },
      { label: "Target URL", value: sys.url },
      { label: "Version", value: sys.version },
      { label: "Environment", value: sys.environment }
    ].filter(f => f.value && f.value !== "N/A");

    const userContextHtml = userContextFields.length > 0
      ? `
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
    <h3 style="color: #475569; font-size: 11px; text-transform: uppercase; margin: 0 0 12px 0; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-weight: bold; text-decoration: underline;">User Provided Context</h3>
    <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
      ${userContextFields.map(f => `
        <div>
          <strong style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px;">${escapeHtml(f.label)}:</strong>
          <div style="font-size: 13px; color: #1e293b; white-space: pre-wrap; margin-left: 12px;">${escapeHtml(f.value)}</div>
        </div>
      `).join('')}
    </div>
  </div>`
      : "";

    const envContextFields = [
      { label: "Client", value: r.environment?.client },
      { label: "Device", value: r.environment?.device },
      { label: "OS/Platform", value: r.environment?.osPlatform },
      { label: "Network Condition", value: r.environment?.networkCondition }
    ].filter(f => f.value && f.value !== "N/A");

    return `
<div style="font-family: Arial, sans-serif; color: #333; width: 100%; background: #ffffff; box-sizing: border-box; padding: 24px;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
    <div>
      <h2 style="color: #4f46e5; margin: 0 0 4px 0;">${escapeHtml(r.metadata?.title)}</h2>
      <p style="margin: 0; font-size: 14px;"><strong>Severity:</strong> ${escapeHtml(r.metadata?.severity)} | <strong>Priority:</strong> ${escapeHtml(r.metadata?.priority)}</p>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: bold; color: #4f46e5;">${escapeHtml(sys.bugId)}</div>
      <div style="font-size: 12px; color: #94a3b8;">${escapeHtml(sys.dateReported)}</div>
    </div>
  </div>

  ${userContextHtml}

  <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />

  <h3 style="color: #475569; font-size: 16px; font-weight: bold; text-decoration: underline;">Environment Context</h3>
  <ul style="padding-left: 20px;">
    ${envContextFields.map(f => `
      <li style="margin-bottom: 4px; font-size: 14px;"><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.value)}</li>
    `).join('')}
  </ul>

  <div style="display: flex; gap: 20px; margin-top: 20px; align-items: stretch;">
    <div style="flex: 1; background: #f0fdf4; padding: 12px; border-radius: 8px; border-left: 4px solid #22c55e; page-break-inside: avoid;">
      <strong style="color: #166534; font-size: 12px; text-transform: uppercase;">Expected</strong>
      <p style="margin: 8px 0 0 0; font-size: 14px; white-space: pre-wrap;">${escapeHtml(r.behavior?.expected)}</p>
    </div>
    <div style="flex: 1; background: #fef2f2; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444; page-break-inside: avoid;">
      <strong style="color: #991b1b; font-size: 12px; text-transform: uppercase;">Observed</strong>
      <p style="margin: 8px 0 0 0; font-size: 14px; white-space: pre-wrap;">${escapeHtml(r.behavior?.observed)}</p>
    </div>
  </div>

  <h3 style="color: #475569; font-size: 16px; margin-top: 24px; font-weight: bold; text-decoration: underline;">Steps to Reproduce</h3>
  <ol style="padding-left: 20px;">
    ${(r.stepsToReproduce ?? [])
      .map(
        (step) =>
          `<li style="margin-bottom: 8px; font-size: 14px;">${escapeHtml(step)}</li>`
      )
      .join("")}
  </ol>

  <h3 style="color: #475569; font-size: 16px; margin-top: 24px; font-weight: bold; text-decoration: underline;">Technical Details</h3>
  <div style="background: #0f172a; color: #cbd5e1; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 12px; page-break-inside: avoid;">
    <p style="margin: 0 0 8px 0;"><strong style="color: #94a3b8;">Error Code:</strong> ${escapeHtml(r.technicalDetails?.errorCode)}</p>
    <p style="margin: 0 0 8px 0;"><strong style="color: #94a3b8;">Component:</strong> ${escapeHtml(r.technicalDetails?.component)}</p>
    <div style="border-top: 1px solid #334155; margin-top: 8px; padding-top: 8px;">
      <strong style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">Logs / Stack Trace:</strong>
      <code style="display: block; white-space: pre-wrap; color: #f8fafc;">${escapeHtml(r.technicalDetails?.logsOrStackTrace)}</code>
    </div>
  </div>

  ${
    imageDataUrls.length > 0
      ? `
  <h3 style="color: #475569; font-size: 16px; margin-top: 24px; font-weight: bold; text-decoration: underline;">Screenshots</h3>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
    ${imageDataUrls
      .map(
        (img) => `
    <div style="margin-bottom: 16px; page-break-inside: avoid;">
      <img src="${img.data}" alt="${escapeHtml(img.name)}" style="max-width: 100%; display: block; border: 1px solid #e2e8f0; border-radius: 8px;" />
      <p style="font-size: 10px; color: #94a3b8; text-align: center; margin-top: 4px;">${escapeHtml(img.name)}</p>
    </div>
    `
      )
      .join("")}
  </div>
  `
      : ""
  }

  <h3 style="color: #475569; font-size: 16px; margin-top: 24px; font-weight: bold; text-decoration: underline;">Stakeholder Impact</h3>
  <p style="font-size: 14px; white-space: pre-wrap;"><strong>User Impact:</strong> ${escapeHtml(r.impact?.user)}</p>
  <p style="font-size: 14px; white-space: pre-wrap;"><strong>Business Impact:</strong> ${escapeHtml(r.impact?.business)}</p>
</div>
`;
  };

  const buildRichReportDocument = (report, imageDataUrls = []) => {
    const r = sanitizeReport(report || {});

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(r.systemContext?.bugId || "Bug Report")}</title>
  <style>
    @page {
      size: auto;
      margin: 12mm;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
${buildRichReportHtml(r, imageDataUrls)}
</body>
</html>
`;
  };

  const waitForImagesToLoad = async (element) => {
    const images = Array.from(element.querySelectorAll("img"));

    if (images.length === 0) {
      return;
    }

    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      })
    );
  };

  const nextPaint = () => {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  };

  const renderRichReportContent = async (report, assets, options = {}) => {
    const { contentEditable = false } = options;
    const imageDataUrls = await getImageDataUrls(assets);
    const html = buildRichReportHtml(report, imageDataUrls);

    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.overflow = "auto";
    host.style.pointerEvents = "none";
    host.style.zIndex = "-1";
    host.style.background = "#ffffff";
    host.style.padding = "24px";

    const container = document.createElement("div");
    container.innerHTML = html;
    container.style.width = "850px";
    container.style.margin = "0 auto";
    container.style.background = "#ffffff";
    container.style.boxSizing = "border-box";
    container.contentEditable = contentEditable ? "true" : "false";

    host.appendChild(container);
    document.body.appendChild(host);

    await nextPaint();
    await waitForImagesToLoad(container);
    await nextPaint();

    return {
      container,
      cleanup: () => {
        if (host.parentNode) {
          host.parentNode.removeChild(host);
        }
      }
    };
  };

  window.BugGenie.reportUtils = {
    escapeHtml,
    sanitizeReport,
    buildRichReportHtml,
    buildRichReportDocument,
    waitForImagesToLoad,
    renderRichReportContent
  };
})();
