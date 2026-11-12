window.BugGenie = window.BugGenie || {};

window.BugGenie.html = htm.bind(React.createElement);
window.BugGenie.config = {
  googleImageSearchUrl:
    window.BUGGENIE_CONFIG?.googleImageSearchUrl ??
    "https://images.google.com/"
};
