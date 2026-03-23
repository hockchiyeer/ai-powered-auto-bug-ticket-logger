# BugGenie AI

BugGenie AI is a browser-based bug ticket drafting tool that turns screenshots and supporting artifacts into structured bug reports.

It uses the Google Gemini API for primary analysis and includes a manual Google Images / Google Lens fallback when Gemini credentials are missing or rejected. In the fallback path, the user uploads an image to Google, copies the AI-generated summary, and pastes that summary back into the app so BugGenie can generate ticket-ready content locally.

## What It Does

- Collects bug artifacts through drag-and-drop or file input
- Captures environment context such as URL, version, and test environment
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

This repository does not currently use a bundler, package manager, or backend service.

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

### Primary Flow

1. The user enters context such as target URL, version, and environment.
2. The user uploads screenshots or other artifacts.
3. BugGenie sends image artifacts to Gemini.
4. Gemini returns a JSON-shaped bug report.
5. The report is rendered in the app and can be copied, printed, or pushed through the mock integration buttons.

### Fallback Flow

1. If Gemini is not configured or the API key is rejected, BugGenie switches to Google Lens fallback mode.
2. The user opens Google Images or Google Lens from the app.
3. The user uploads one of the prepared image files manually in Google.
4. The user copies the Google AI-generated summary or overview.
5. The user pastes that summary back into BugGenie.
6. BugGenie converts the pasted summary into a structured bug ticket draft.
7. Standard actions such as copy, export, and mock push become available again.

## Configuration

Configuration is provided in `index.html` through `window.BUGGENIE_CONFIG`. By default, the app attempts to retrieve the Gemini API key from a global `GEMINI_API_KEY` variable, which is often injected by the hosting environment (e.g., AI Studio).

```html
<script>
  window.BUGGENIE_CONFIG = window.BUGGENIE_CONFIG || {
    // Falls back to global GEMINI_API_KEY if not explicitly set
    geminiApiKey: typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : "YOUR_GEMINI_API_KEY",
    googleImageSearchUrl: "https://images.google.com/"
  };
</script>
```

The initialization logic in `js/config.js` also checks for `window.GEMINI_API_KEY` directly as a secondary fallback.

### Config Options

- `geminiApiKey`
  Google Gemini API key used for primary AI analysis. It can be provided via `window.BUGGENIE_CONFIG.geminiApiKey` or the global `GEMINI_API_KEY` variable.

- `googleImageSearchUrl`
  URL opened during the manual Google Images / Lens fallback flow.

## Running the App

Because this is a static frontend, you can serve it with any local static server.

### Option 1: Python

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

### Option 2: Any Static Server

Use any equivalent tool such as `npx serve`, VS Code Live Server, or your preferred static hosting environment.

## Usage Guide

### Generate a Report with Gemini

1. Set a valid Gemini API key in `index.html`.
2. Start a local static server.
3. Open the app in a browser.
4. Enter the target URL, version, and environment.
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
- `behavior`
- `stepsToReproduce`
- `technicalDetails`
- `impact`
- `investigation`
- `systemContext`
- `fallbackContext` when fallback mode is involved

The app sanitizes incomplete data so missing fields still render safely.

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
- The Gemini API key is exposed to the browser at runtime, which is not appropriate for production use.
- Jira and Azure DevOps sync are currently simulated.
- The Google fallback depends on the user manually uploading the image and pasting the generated summary.
- Non-image files are not sent through the Google fallback route.
- PDF export depends on browser popup and print behavior.
- Clipboard actions may be affected by browser permissions and context restrictions.

## Security Considerations

- Do not commit real production API keys into source control.
- Prefer injecting runtime config from a secure environment if this project evolves beyond a local prototype.
- Move API access behind a backend before using this in a shared or production environment.

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
