# BugGenie AI

BugGenie AI is a browser-based bug ticket drafting tool that turns screenshots and supporting artifacts into structured bug reports.

It uses the Google Gemini API for primary analysis and includes a manual Google Images / Google Lens fallback when Gemini credentials are missing or rejected. In the fallback path, the user uploads an image to Google, copies the AI-generated summary, and pastes that summary back into the app so BugGenie can generate ticket-ready content locally.

## What It Does

- Collects bug artifacts through drag-and-drop or file input
- Captures system context such as Intent/Context for AI, target URL, version, and test environment
- Sends attached images to Gemini for structured bug analysis
- Produces a 10-section report with metadata, environment, behavior, steps, technical details, impact, investigation notes, and resolution placeholders
- Supports rich-text copy, PDF export, and mock push actions for Jira Cloud and Azure DevOps
- Falls back to a Google Images / Lens-assisted workflow when Gemini is unavailable
- Converts a pasted Google AI-generated summary into a draft bug ticket

## Current Tech Stack

- Plain HTML entrypoint
- React 18 via CDN
- HTM for JSX-free templating
- Tailwind CSS via CDN
- Lucide icons via CDN
- Browser APIs for file handling, clipboard access, printing, and popup windows
- Optional Vite + dotenv tooling for local development and build-time env injection

The app runtime is still a static frontend with no backend, but the repository also includes Node/Vite tooling for local development.

## Repository Structure

```text
.
|-- .env.example        # Environment variable template
|-- LICENSE.txt         # License information
|-- README.md           # Project documentation
|-- index.html          # Main application entry point
|-- metadata.json       # AI Studio application metadata
|-- package.json        # Project dependencies and scripts
|-- tsconfig.json       # TypeScript configuration
|-- vite.config.ts      # Vite configuration
`-- js/                 # Application logic
    |-- analysis.js     # Gemini and fallback analysis logic
    |-- app.js          # Main application orchestration
    |-- components.js   # UI components and rendering
    |-- config.js       # Configuration and namespace setup
    |-- file-utils.js   # File handling utilities
    `-- report-utils.js # Report formatting and export utilities
```

## File Overview

- `index.html`
  Loads the app shell, CDN dependencies, animation styles, and runtime config.

- `js/config.js`
  Reads configuration from `window.BUGGENIE_CONFIG` and initializes the shared `window.BugGenie` namespace.

- `js/file-utils.js`
  Handles file mapping, preview URL creation, base64 conversion, and cleanup.

- `js/report-utils.js`
  Sanitizes report objects, builds printable HTML, supports PDF export, and prepares rich text content for clipboard copy.

- `js/analysis.js`
  Contains Gemini request logic, fallback detection, Google Lens fallback report generation, and pasted-summary-to-ticket parsing.

- `js/components.js`
  Holds reusable UI components and report display rendering.

- `js/app.js`
  Orchestrates app state, file upload flow, Gemini analysis, fallback flow, clipboard actions, PDF export, and mock ticket sync actions.

## How It Works

### System Context Inputs

The `System Context` panel includes four user-entered fields:

- `Intent/Context for AI`
- `Target URL`
- `Version`
- `Environment` such as `Production`, `Staging`, `QA`, `Dev`, or `Local`

For Gemini analysis, these values are included in the inference prompt together with browser and OS runtime details. In generated reports, the same four values are preserved in `systemContext` and rendered near the top of the report as a user-provided context block, which helps the output stay aligned with the scenario being tested.

### Primary Flow

1. The user enters system context such as Intent/Context for AI, target URL, version, and environment.
2. The user uploads screenshots or other artifacts.
3. BugGenie sends image artifacts to Gemini.
4. Gemini returns a JSON-shaped bug report.
5. The report is rendered in the app with the user-provided context attached near the header and can be copied, printed, or pushed through the mock integration buttons.

### Fallback Flow

1. If Gemini is not configured or the API key is rejected, BugGenie switches to Google Lens fallback mode.
2. The user opens Google Images or Google Lens from the app.
3. The user uploads one of the prepared image files manually in Google.
4. The user copies the Google AI-generated summary or overview.
5. The user pastes that summary back into BugGenie.
6. BugGenie converts the pasted summary into a structured bug ticket draft.
7. Standard actions such as copy, export, and mock push become available again.

## Configuration

Create a Gemini API key in Google AI Studio before running the app:

`https://aistudio.google.com/apikey`

Reference documentation:

`https://ai.google.dev/gemini-api/docs/api-key`

Google's current Gemini guidance distinguishes between server-side SDK usage and browser usage:

- Gemini SDKs can automatically pick up `GEMINI_API_KEY` or `GOOGLE_API_KEY` from the environment.
- Browser JavaScript and raw REST calls must receive the API key explicitly.

BugGenie is a browser app, so the project-specific recommendation is:

- Prefer `window.BUGGENIE_CONFIG.geminiApiKey` for explicit browser injection.
- `js/config.js` also falls back to `window.GEMINI_API_KEY`.
- If you run through Vite, `js/config.js` also falls back to `process.env.GEMINI_API_KEY`.
- Although Google's SDKs support `GOOGLE_API_KEY`, this project does not currently read that variable automatically.

### Recommended Browser Config

Configuration is provided in `index.html` through `window.BUGGENIE_CONFIG`.

```html
<script>
  window.BUGGENIE_CONFIG = window.BUGGENIE_CONFIG || {
    // Browser apps should receive the Gemini API key explicitly at runtime.
    geminiApiKey: window.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY",
    googleImageSearchUrl: "https://images.google.com/"
  };
</script>
```

If your host injects a global `GEMINI_API_KEY`, the app's default `index.html` and `js/config.js` fallbacks will still pick it up.

### Using `GEMINI_API_KEY` with Vite

If you want to avoid editing `index.html` for local development, use the included Vite setup:

1. Create a local `.env` or `.env.local` file from `.env.example`.
2. Set `GEMINI_API_KEY` to your Gemini key.
3. Run `npm install`.
4. Run `npm run dev`.

`vite.config.ts` exposes `process.env.GEMINI_API_KEY`, and `js/config.js` reads it as a fallback.

### Config Options

- `geminiApiKey`
  Google Gemini API key used for primary AI analysis. In this browser app, the preferred path is `window.BUGGENIE_CONFIG.geminiApiKey`. The code also supports `window.GEMINI_API_KEY` and `process.env.GEMINI_API_KEY`.

- `googleImageSearchUrl`
  URL opened during the manual Google Images / Lens fallback flow.

## Running the App

Because this is a static frontend, you can serve it with any local static server.

### Option 1: Vite

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

If you use this option, set `GEMINI_API_KEY` locally first or provide the key through `window.BUGGENIE_CONFIG`.

### Option 2: Python

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

When serving the app this way, configure the key explicitly in `index.html` or inject a global `GEMINI_API_KEY` before the app scripts run.

### Option 3: Any Static Server

Use any equivalent tool such as `npx serve`, VS Code Live Server, or your preferred static hosting environment. As with the Python option, browser deployments must inject the Gemini key explicitly.

## Usage Guide

### Generate a Report with Gemini

1. Provide a valid Gemini API key through `window.BUGGENIE_CONFIG.geminiApiKey`, `window.GEMINI_API_KEY`, or Vite-injected `process.env.GEMINI_API_KEY`.
2. Start a local static server.
3. Open the app in a browser.
4. Enter any relevant system context, including Intent/Context for AI, target URL, version, and environment.
5. Upload screenshots or other files.
6. Click `Generate Full Report`.

### Use the Google Lens Summary Fallback

1. Open the app without a valid Gemini key, or trigger a rejected-key scenario.
2. Upload at least one image attachment.
3. Click `Generate Full Report`.
4. In fallback mode, click `Open Google Images`.
5. Upload one of the prepared images manually in Google Images or Lens.
6. Copy the Google AI-generated summary.
7. Paste the summary into the `Paste Google AI Summary` area.
8. Click `Generate Ticket from Summary`.

## Generated Report Shape

The app works with a normalized report object containing:

- `metadata`
- `environment`
- `systemContext`
- `behavior`
- `stepsToReproduce`
- `technicalDetails`
- `impact`
- `investigation`
- `fallbackContext` when fallback mode is involved

The app sanitizes incomplete data so missing fields still render safely.

The `systemContext` block preserves the user-entered `intent`, `url`, `version`, and `environment` values so they can be reused in the rendered report header/context area, clipboard export, and PDF export.

## Supported Actions

- Rich text copy of the generated ticket
- Printable PDF export
- Mock push action for Jira Cloud
- Mock push action for Azure DevOps
- Attachment preview and download in fallback mode

## Notes on the Google Fallback

- The Google fallback is intentionally manual.
- BugGenie does not directly upload local files to Google Images or Google Lens.
- The user performs the Google upload step in the browser.
- BugGenie only uses the pasted Google AI-generated summary to continue ticket generation locally.

This approach avoids relying on unsupported private Google upload flows from the frontend.

## Limitations

- This is a client-side prototype, not a production-hardened application.
- The Gemini API key is exposed to the browser at runtime, which is acceptable only for local testing or tightly controlled demos, not for production use.
- Jira and Azure DevOps sync are currently simulated.
- The Google fallback depends on the user manually uploading the image and pasting the generated summary.
- Non-image files are not sent through the Google fallback route.
- PDF export depends on browser popup and print behavior.
- Clipboard actions may be affected by browser permissions and context restrictions.

## Security Considerations

- Do not commit real production API keys into source control.
- Hard-coding a Gemini API key should be treated as temporary local setup only.
- Prefer injecting runtime config from a secure environment for demos and internal testing.
- Move API access behind a backend before using this in a shared or production environment.
- If you standardize on Google's `GOOGLE_API_KEY` environment variable elsewhere, update `js/config.js` before assuming this frontend will read it.

## Future Improvements

- Replace mock Jira and Azure actions with real integrations
- Move Gemini access behind a backend service
- Add persistence for generated reports
- Add validation and formatting helpers for pasted Google summaries
- Add automated tests for summary parsing and fallback state transitions
- Add richer environment capture for browsers and devices

## Development Notes

- The app uses a shared `window.BugGenie` namespace instead of ES modules.
- UI rendering is done with React + HTM instead of JSX compilation.
- The codebase is organized by responsibility so it remains maintainable even without a build step.

## License

Please refer to [LICENSE.txt](LICENSE.txt)