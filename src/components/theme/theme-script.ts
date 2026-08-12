// Runs inline, before hydration, so the correct theme applies on first
// paint instead of flashing light-then-dark. Kept as a plain string (not a
// React event handler) because it must run via a literal <script> tag.
export const THEME_STORAGE_KEY = "money-context-theme";

export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var theme = stored === "dark" || stored === "light" ? stored : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (error) {}
})();
`;
