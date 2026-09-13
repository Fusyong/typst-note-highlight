import * as vscode from "vscode";
import { syncFromSettings } from "./highlight";
import {
  addNote,
  diagnoseDocument,
  dispatchNoteAction,
  removeNote,
  type EditOptions,
  type EditResult,
} from "./snt-edit";
import { extractNtpPlainText } from "./ntp-extract";
import { findPairAt, formatHoverMarkdown, hoverPayload, jumpFailMessage } from "./snt-nav";
import { mergeSnt, splitSnt } from "./snt-split";

const TYPST = { language: "typst" };

function eolOf(document: vscode.TextDocument): string {
  return document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
}

function rangeOf(
  document: vscode.TextDocument,
  span: { start: number; end: number },
): vscode.Range {
  return new vscode.Range(document.positionAt(span.start), document.positionAt(span.end));
}

async function applyEditResult(
  editor: vscode.TextEditor,
  result: EditResult,
): Promise<void> {
  if (!result.ok) {
    void vscode.window.showWarningMessage(result.error);
    return;
  }
  const doc = editor.document;
  const ok = await editor.edit((builder) => {
    const edits = [...result.edits].sort((a, b) => b.start - a.start);
    for (const e of edits) {
      builder.replace(
        new vscode.Range(doc.positionAt(e.start), doc.positionAt(e.end)),
        e.text,
      );
    }
  });
  if (!ok) {
    return;
  }
  if (result.selectionStart != null) {
    const start = editor.document.positionAt(result.selectionStart);
    const end = editor.document.positionAt(
      result.selectionEnd ?? result.selectionStart,
    );
    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(new vscode.Range(start, end));
  }
}

function runOnEditor(
  fn: (text: string, start: number, end: number, options?: EditOptions) => EditResult,
): () => Promise<void> {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "typst") {
      void vscode.window.showWarningMessage("请在 Typst 源码中使用此命令");
      return;
    }
    const doc = editor.document;
    const sel = editor.selection;
    const result = fn(doc.getText(), doc.offsetAt(sel.start), doc.offsetAt(sel.end), {
      eol: eolOf(doc),
    });
    await applyEditResult(editor, result);
  };
}

async function revealOffset(
  uri: vscode.Uri | string,
  start: number,
  end?: number,
): Promise<void> {
  const parsed = typeof uri === "string" ? vscode.Uri.parse(uri) : uri;
  const doc = await vscode.workspace.openTextDocument(parsed);
  const editor = await vscode.window.showTextDocument(doc);
  const a = doc.positionAt(start);
  const b = doc.positionAt(end ?? start);
  editor.selection = new vscode.Selection(a, a);
  editor.revealRange(
    new vscode.Range(a, b),
    vscode.TextEditorRevealType.InCenterIfOutsideViewport,
  );
}

async function extractNtpBody(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "typst") {
    void vscode.window.showWarningMessage("请在 Typst 源码中使用此命令");
    return;
  }
  const doc = editor.document;
  const sel = editor.selection;
  const body = extractNtpPlainText(doc.getText(), {
    start: doc.offsetAt(sel.start),
    end: doc.offsetAt(sel.end),
    eol: eolOf(doc),
  });
  if (!body.trim()) {
    const msg = sel.isEmpty
      ? "光标不在 #ntp 内"
      : "选区没有与任何 #ntp 相交";
    void vscode.window.showWarningMessage(msg);
    return;
  }
  await vscode.env.clipboard.writeText(body);
  const preview = await vscode.workspace.openTextDocument({
    content: body,
    language: "plaintext",
  });
  await vscode.window.showTextDocument(preview, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
  });
  void vscode.window.showInformationMessage(
    `已收集正文 ${body.replace(/\s+/g, "").length} 字，并复制到剪贴板`,
  );
}

async function gotoPair(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "typst") {
    void vscode.window.showWarningMessage("请在 Typst 源码中使用此命令");
    return;
  }
  const doc = editor.document;
  const match = findPairAt(doc.getText(), doc.offsetAt(editor.selection.active));
  const err = jumpFailMessage(match);
  if (err || !match?.targetInner) {
    void vscode.window.showWarningMessage(err);
    return;
  }
  await revealOffset(doc.uri, match.targetInner.start, match.targetInner.end);
}

function refreshDiagnostics(
  collection: vscode.DiagnosticCollection,
  document: vscode.TextDocument,
): void {
  if (document.languageId !== "typst") {
    collection.delete(document.uri);
    return;
  }
  const diags = diagnoseDocument(document.getText()).map((d) => {
    const range = new vscode.Range(
      document.positionAt(d.start),
      document.positionAt(d.end),
    );
    const item = new vscode.Diagnostic(
      range,
      d.message,
      vscode.DiagnosticSeverity.Error,
    );
    item.source = "Typst Buddy";
    return item;
  });
  collection.set(document.uri, diags);
}

const hoverProvider: vscode.HoverProvider = {
  provideHover(document, position) {
    const match = findPairAt(document.getText(), document.offsetAt(position));
    if (!match) {
      return undefined;
    }
    const payload = hoverPayload(match);
    let jumpHref: string | null = null;
    if (payload.jumpHint && match.targetInner) {
      jumpHref = `command:typstBuddy._revealOffset?${encodeURIComponent(
        JSON.stringify([document.uri.toString(), match.targetInner.start]),
      )}`;
    }
    const md = new vscode.MarkdownString(formatHoverMarkdown(payload, jumpHref), true);
    md.supportHtml = true;
    md.isTrusted = jumpHref != null;
    return new vscode.Hover(md, rangeOf(document, match.hover));
  },
};

const definitionProvider: vscode.DefinitionProvider = {
  provideDefinition(document, position) {
    const offset = document.offsetAt(position);
    const match = findPairAt(document.getText(), offset);
    if (!match?.paired || !match.target || !match.targetInner) {
      return undefined;
    }
    if (offset < match.origin.start || offset >= match.origin.end) {
      return undefined;
    }
    return [
      {
        originSelectionRange: rangeOf(document, match.origin),
        targetUri: document.uri,
        targetRange: rangeOf(document, match.target),
        targetSelectionRange: rangeOf(document, match.targetInner),
      },
    ];
  },
};

const highlightProvider: vscode.DocumentHighlightProvider = {
  provideDocumentHighlights(document, position) {
    const match = findPairAt(document.getText(), document.offsetAt(position));
    if (!match) {
      return undefined;
    }
    const out = [
      new vscode.DocumentHighlight(
        rangeOf(document, match.hover),
        vscode.DocumentHighlightKind.Read,
      ),
    ];
    if (match.target) {
      out.push(
        new vscode.DocumentHighlight(
          rangeOf(document, match.target),
          vscode.DocumentHighlightKind.Write,
        ),
      );
    }
    return out;
  },
};

export function activate(context: vscode.ExtensionContext): void {
  void syncFromSettings();

  const diagnostics = vscode.languages.createDiagnosticCollection("typstBuddy");
  context.subscriptions.push(diagnostics);

  let diagTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleDiagnostics = (document: vscode.TextDocument): void => {
    if (document.languageId !== "typst") {
      return;
    }
    if (diagTimer) {
      clearTimeout(diagTimer);
    }
    diagTimer = setTimeout(() => {
      refreshDiagnostics(diagnostics, document);
    }, 200);
  };

  for (const doc of vscode.workspace.textDocuments) {
    refreshDiagnostics(diagnostics, doc);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("typstBuddy.foreground")) {
        void syncFromSettings();
      }
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      refreshDiagnostics(diagnostics, doc);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      scheduleDiagnostics(event.document);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnostics.delete(doc.uri);
    }),
    vscode.languages.registerHoverProvider(TYPST, hoverProvider),
    vscode.languages.registerDefinitionProvider(TYPST, definitionProvider),
    vscode.languages.registerDocumentHighlightProvider(TYPST, highlightProvider),
    vscode.commands.registerCommand("typstBuddy.addNote", runOnEditor(addNote)),
    vscode.commands.registerCommand("typstBuddy.removeNote", runOnEditor(removeNote)),
    vscode.commands.registerCommand(
      "typstBuddy.noteShortcut",
      runOnEditor(dispatchNoteAction),
    ),
    vscode.commands.registerCommand("typstBuddy.gotoPair", () => gotoPair()),
    vscode.commands.registerCommand("typstBuddy.splitSnt", runOnEditor(splitSnt)),
    vscode.commands.registerCommand("typstBuddy.mergeSnt", runOnEditor(mergeSnt)),
    vscode.commands.registerCommand("typstBuddy.extractNtpBody", () => extractNtpBody()),
    vscode.commands.registerCommand(
      "typstBuddy._revealOffset",
      (uri: string, offset: number) => revealOffset(uri, offset),
    ),
    {
      dispose: () => {
        if (diagTimer) {
          clearTimeout(diagTimer);
        }
      },
    },
  );
}

export function deactivate(): void {}
