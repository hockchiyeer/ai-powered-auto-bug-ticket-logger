window.BugGenie = window.BugGenie || {};

window.BugGenie.html = htm.bind(React.createElement);
window.BugGenie.config = {
  geminiApiKey:
    window.BUGGENIE_CONFIG?.geminiApiKey ||
    window.GEMINI_API_KEY ||
    (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : "") ||
    "",
  googleImageSearchUrl:
    window.BUGGENIE_CONFIG?.googleImageSearchUrl ??
    "https://images.google.com/"
};
