import * as vscode from "vscode";

const SCOPE_MARKERS = [
  "markup.editorial.secondary.typst",
  "meta.editorial.secondary.typst",
  "markup.note.annotation.typst",
  "meta.note.annotation.typst",
];

export const DEFAULT_FOREGROUND = "#68559E";

interface TextMateRule {
  scope?: string | string[];
  settings?: {
    foreground?: string;
    fontStyle?: string;
  };
}

interface TokenColorCustomizations {
  textMateRules?: TextMateRule[];
  [key: string]: unknown;
}

function isOurRule(rule: TextMateRule | undefined): boolean {
  if (!rule || rule.settings == null) {
    return false;
  }
  const scope = rule.scope;
  if (typeof scope === "string") {
    return SCOPE_MARKERS.includes(scope);
  }
  if (Array.isArray(scope)) {
    return scope.some((s) => SCOPE_MARKERS.includes(s));
  }
  return false;
}

function buildOurRule(foreground: string): TextMateRule {
  return {
    scope: [...SCOPE_MARKERS],
    settings: {
      foreground,
    },
  };
}

function resolveTarget(): vscode.ConfigurationTarget {
  if (vscode.workspace.workspaceFolders?.length) {
    return vscode.ConfigurationTarget.Workspace;
  }
  return vscode.ConfigurationTarget.Global;
}

async function applyForeground(foreground: string | undefined): Promise<void> {
  const color =
    typeof foreground === "string" && foreground.trim()
      ? foreground.trim()
      : DEFAULT_FOREGROUND;

  const editorConfig = vscode.workspace.getConfiguration("editor");
  const current = (editorConfig.get("tokenColorCustomizations") ?? {}) as TokenColorCustomizations;
  const existingRules = Array.isArray(current.textMateRules) ? current.textMateRules : [];
  const nextRules = existingRules.filter((rule) => !isOurRule(rule));
  nextRules.push(buildOurRule(color));

  const next: TokenColorCustomizations = {
    ...current,
    textMateRules: nextRules,
  };

  await editorConfig.update("tokenColorCustomizations", next, resolveTarget());
}

export async function syncFromSettings(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("typstBuddy");
  const foreground = cfg.get<string>("foreground", DEFAULT_FOREGROUND);
  await applyForeground(foreground);
}
