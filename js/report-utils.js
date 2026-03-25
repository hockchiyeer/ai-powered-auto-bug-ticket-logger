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
  <div style="margin-top: 24px; margin-bottom: 24px;">
    <h2 style="color: #475569; font-size: 18px; font-weight: bold; text-decoration: underline; margin: 0 0 12px 0;">User Provided Context</h2>
    <div style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; word-wrap: break-word; overflow-wrap: break-word;">
      <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: disc;">
        ${userContextFields.map(f => `
          <li style="margin-bottom: 12px; color: #1e293b;">
            <strong style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-right: 4px;">${escapeHtml(f.label)}:</strong>
            <span style="font-size: 13px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(f.value)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  </div>`
      : "";

    const envContextFields = [
      { label: "Client", value: r.environment?.client },
      { label: "Device", value: r.environment?.device },
      { label: "OS/Platform", value: r.environment?.osPlatform },
      { label: "Network Condition", value: r.environment?.networkCondition }
    ].filter(f => f.value && f.value !== "N/A");

    const technicalDetailsFields = [
      { label: "Error Code", value: r.technicalDetails?.errorCode || "N/A" },
      { label: "Component", value: r.technicalDetails?.component || "N/A" },
      { label: "Logs / Stack Trace", value: r.technicalDetails?.logsOrStackTrace || "N/A", isLong: true }
    ];

    const impactFields = [
      { label: "User Impact", value: r.impact?.user },
      { label: "Business Impact", value: r.impact?.business }
    ].filter(f => f.value && f.value !== "N/A");

    return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; background: #ffffff; padding: 24px; line-height: 1.5; word-wrap: break-word; overflow-wrap: break-word; mso-line-height-rule: exactly;">
  <div style="margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
    <div style="margin-bottom: 12px;">
      <h1 style="color: #4f46e5; margin: 0 0 8px 0; font-size: 28px; font-weight: bold; text-decoration: underline;">${escapeHtml(r.metadata?.title)}</h1>
      <div style="margin: 0; font-size: 14px; color: #475569;">
        <strong style="color: #1e293b;">Severity:</strong> ${escapeHtml(r.metadata?.severity)} 
        <span style="color: #cbd5e1; margin: 0 8px;">|</span> 
        <strong style="color: #1e293b;">Priority:</strong> ${escapeHtml(r.metadata?.priority)}
      </div>
    </div>
    <div style="margin-top: 8px;">
      <div style="font-weight: bold; color: #4f46e5; font-size: 18px; margin: 0; line-height: 1.2;">${escapeHtml(sys.bugId)}</div>
      <div style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.2;"><strong>Date:</strong> ${escapeHtml(sys.dateReported)}</div>
    </div>
  </div>

  ${userContextHtml}

  <div style="margin-top: 32px; margin-bottom: 24px;">
    <h2 style="color: #475569; font-size: 18px; font-weight: bold; text-decoration: underline; margin-bottom: 12px;">Environment Context</h2>
    <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: disc;">
      ${envContextFields.map(f => `
        <li style="margin-bottom: 8px; color: #1e293b;">
          <strong style="color: #64748b; font-size: 14px; margin-right: 4px;">${escapeHtml(f.label)}:</strong>
          <span style="font-size: 14px;">${escapeHtml(f.value)}</span>
        </li>
      `).join('')}
    </ul>
  </div>

  <div style="margin-top: 32px; margin-bottom: 24px;">
    <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 16px;">
      <h3 style="color: #166534; font-size: 14px; margin: 0 0 8px 0; font-weight: bold;">Expected Behavior</h3>
      <div style="font-size: 14px; color: #14532d; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(r.behavior?.expected)}</div>
    </div>
    <div style="background: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444;">
      <h3 style="color: #991b1b; font-size: 14px; margin: 0 0 8px 0; font-weight: bold;">Observed Behavior</h3>
      <div style="font-size: 14px; color: #7f1d1d; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(r.behavior?.observed)}</div>
    </div>
  </div>

  <div style="margin-top: 32px; margin-bottom: 24px;">
    <h2 style="color: #475569; font-size: 18px; font-weight: bold; text-decoration: underline; margin-bottom: 12px;">Steps to Reproduce</h2>
    <div style="margin-bottom: 16px;">
      ${(r.stepsToReproduce ?? []).map((step, index) => `
        <div style="margin-bottom: 10px; word-wrap: break-word; overflow-wrap: break-word;">
          <strong style="font-size: 14px; color: #94a3b8; margin-right: 8px;">${index + 1}.</strong>
          <span style="font-size: 14px; color: #1e293b;">${escapeHtml(step)}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <div style="margin-top: 32px; margin-bottom: 24px;">
    <h2 style="color: #475569; font-size: 18px; font-weight: bold; text-decoration: underline; margin-bottom: 12px;">Technical Details</h2>
    <div style="padding: 20px; background: #0f172a; border-radius: 8px; color: #cbd5e1; word-wrap: break-word; overflow-wrap: break-word;">
      <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: disc;">
        ${technicalDetailsFields.map(f => `
          <li style="margin-bottom: 12px; color: #f8fafc;">
            <strong style="color: #94a3b8; font-size: 10px; text-transform: uppercase; margin-right: 8px; vertical-align: top;">${escapeHtml(f.label)}:</strong>
            <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; word-break: break-all; white-space: pre-wrap; line-height: 1.4; vertical-align: top;">${escapeHtml(f.value)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  </div>

  ${imageDataUrls.length > 0 ? `
  <div style="margin-top: 32px; margin-bottom: 24px;">
    <h2 style="color: #475569; font-size: 18px; font-weight: bold; text-decoration: underline; margin-bottom: 16px;">Screenshots</h2>
    ${imageDataUrls.map((img) => `
      <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc; max-width: 100%;">
        <div style="padding: 0; text-align: center;">
          <img src="${img.data}" alt="${escapeHtml(img.name)}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="padding: 8px; font-size: 11px; color: #64748b; text-align: center; background: #ffffff; border-top: 1px solid #e2e8f0;">
          ${escapeHtml(img.name)}
        </div>
      </div>
    `).join('')}
  </div>
  ` : ""}

  <div style="margin-top: 32px; margin-bottom: 24px;">
    <h2 style="color: #475569; font-size: 18px; font-weight: bold; text-decoration: underline; margin-bottom: 12px;">Stakeholder Impact</h2>
    <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: disc;">
      ${impactFields.map(f => `
        <li style="margin-bottom: 8px; color: #1e293b;">
          <strong style="color: #64748b; font-size: 14px; margin-right: 4px;">${escapeHtml(f.label)}:</strong>
          <span style="font-size: 14px;">${escapeHtml(f.value)}</span>
        </li>
      `).join('')}
    </ul>
  </div>
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
