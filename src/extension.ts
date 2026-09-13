import * as vscode from "vscode";
import {
  addNote,
  diagnoseDocument,
  dispatchNoteAction,
  removeNote,
  type EditOptions,
  type EditResult,
} from "./snt-edit";
import { syncFromSettings } from "./highlight";

function eolOf(document: vscode.TextDocument): string {
  return document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
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
    vscode.commands.registerCommand("typstBuddy.addNote", runOnEditor(addNote)),
    vscode.commands.registerCommand("typstBuddy.removeNote", runOnEditor(removeNote)),
    vscode.commands.registerCommand(
      "typstBuddy.noteShortcut",
      runOnEditor(dispatchNoteAction),
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
