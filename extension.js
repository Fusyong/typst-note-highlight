const vscode = require("vscode");

const SCOPE_MARKERS = [
  "markup.editorial.secondary.typst",
  "meta.editorial.secondary.typst",
  "markup.note.annotation.typst",
  "meta.note.annotation.typst",
];

const DEFAULT_FOREGROUND = "#68559E";

function isOurRule(rule) {
  if (!rule || rule.settings == null) return false;
  const scope = rule.scope;
  if (typeof scope === "string") {
    return SCOPE_MARKERS.includes(scope);
  }
  if (Array.isArray(scope)) {
    return scope.some((s) => SCOPE_MARKERS.includes(s));
  }
  return false;
}

function buildOurRule(foreground) {
  return {
    scope: [...SCOPE_MARKERS],
    settings: {
      foreground,
    },
  };
}

function resolveTarget() {
  if (vscode.workspace.workspaceFolders?.length) {
    return vscode.ConfigurationTarget.Workspace;
  }
  return vscode.ConfigurationTarget.Global;
}

async function applyForeground(foreground) {
  const color =
    typeof foreground === "string" && foreground.trim()
      ? foreground.trim()
      : DEFAULT_FOREGROUND;

  const editorConfig = vscode.workspace.getConfiguration("editor");
  const current = editorConfig.get("tokenColorCustomizations") || {};
  const existingRules = Array.isArray(current.textMateRules)
    ? current.textMateRules
    : [];
  const nextRules = existingRules.filter((rule) => !isOurRule(rule));
  nextRules.push(buildOurRule(color));

  const next = {
    ...current,
    textMateRules: nextRules,
  };

  await editorConfig.update(
    "tokenColorCustomizations",
    next,
    resolveTarget(),
  );
}

async function syncFromSettings() {
  const cfg = vscode.workspace.getConfiguration("typstBuddy");
  const foreground = cfg.get("foreground", DEFAULT_FOREGROUND);
  await applyForeground(foreground);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  void syncFromSettings();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("typstBuddy.foreground")) {
        void syncFromSettings();
      }
    }),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
