/**
 * 轻锚点 ↔ notes 注文、内嵌注文 的配对、跳转与悬停文案。
 */

import {
  type NoteCall,
  type SntBlock,
  type SntCall,
  type Span,
  findNoteCalls,
  findSntAt,
  findSntCalls,
  noteCallContaining,
  notesItemContaining,
} from "./snt-parse";

export type PairKind =
  | "light-to-notes"
  | "notes-to-light"
  | "word-to-embedded"
  | "embedded-to-word";

export interface PairMatch {
  kind: PairKind;
  paired: boolean;
  index: number;
  hover: Span;
  origin: Span;
  target: Span | null;
  targetInner: Span | null;
  word: string;
  note: string;
  lightCount: number;
  notesCount: number;
}

export interface HoverPayload {
  /** `>>` 后的短标签，如「注文 2」「锚点 2」。 */
  tag: string;
  /** 下部主内容：注文或被注词。 */
  body: string;
  /** 可跳转时辅助行以「跳转」起头。 */
  jumpHint: string | null;
}

function sliceInner(text: string, start: number, end: number): string {
  return text.slice(start, end);
}

function embeddedPair(text: string, call: NoteCall, offset: number): PairMatch {
  const note = call.note;
  if (!note) {
    return {
      kind: "word-to-embedded",
      paired: false,
      index: 0,
      hover: { start: call.start, end: call.end },
      origin: { start: call.word.innerStart, end: call.word.innerEnd },
      target: null,
      targetInner: null,
      word: sliceInner(text, call.word.innerStart, call.word.innerEnd),
      note: "",
      lightCount: 0,
      notesCount: 0,
    };
  }
  const inNote = offset >= note.start;
  const wordSpan: Span = { start: call.word.innerStart, end: call.word.innerEnd };
  const noteSpan: Span = { start: note.innerStart, end: note.innerEnd };
  if (inNote) {
    return {
      kind: "embedded-to-word",
      paired: true,
      index: 0,
      hover: { start: note.start, end: note.end },
      origin: noteSpan,
      target: { start: call.word.start, end: call.word.end },
      targetInner: wordSpan,
      word: sliceInner(text, wordSpan.start, wordSpan.end),
      note: sliceInner(text, noteSpan.start, noteSpan.end),
      lightCount: 0,
      notesCount: 0,
    };
  }
  return {
    kind: "word-to-embedded",
    paired: true,
    index: 0,
    hover: { start: call.start, end: note.start },
    origin: wordSpan,
    target: { start: note.start, end: note.end },
    targetInner: noteSpan,
    word: sliceInner(text, wordSpan.start, wordSpan.end),
    note: sliceInner(text, noteSpan.start, noteSpan.end),
    lightCount: 0,
    notesCount: 0,
  };
}

function pairFromNotes(text: string, snt: SntCall, index: number): PairMatch {
  const item = snt.notes!.items[index];
  const lights = snt.blocks[0]?.light ?? [];
  const light = lights[index];
  const note = sliceInner(text, item.innerStart, item.innerEnd);
  const word = light ? sliceInner(text, light.word.innerStart, light.word.innerEnd) : "";
  return {
    kind: "notes-to-light",
    paired: light != null,
    index,
    hover: { start: item.start, end: item.end },
    origin: { start: item.innerStart, end: item.innerEnd },
    target: light ? { start: light.start, end: light.end } : null,
    targetInner: light
      ? { start: light.word.innerStart, end: light.word.innerEnd }
      : null,
    word,
    note,
    lightCount: lights.length,
    notesCount: snt.notes!.items.length,
  };
}

function pairFromLight(
  text: string,
  snt: SntCall,
  call: NoteCall,
  index: number,
): PairMatch {
  const notes = snt.notes;
  const item = notes?.items[index];
  const word = sliceInner(text, call.word.innerStart, call.word.innerEnd);
  const note = item ? sliceInner(text, item.innerStart, item.innerEnd) : "";
  return {
    kind: "light-to-notes",
    paired: item != null,
    index,
    hover: { start: call.start, end: call.end },
    origin: { start: call.word.innerStart, end: call.word.innerEnd },
    target: item ? { start: item.start, end: item.end } : null,
    targetInner: item ? { start: item.innerStart, end: item.innerEnd } : null,
    word,
    note,
    lightCount: snt.blocks[0]?.light.length ?? 0,
    notesCount: notes?.items.length ?? 0,
  };
}

function pairFromCall(
  text: string,
  snt: SntCall,
  block: SntBlock,
  call: NoteCall,
  offset: number,
): PairMatch | undefined {
  if (call.note) {
    return embeddedPair(text, call, offset);
  }
  if (!call.light) {
    return undefined;
  }
  const wen = snt.blocks[0];
  if (!wen || block.start !== wen.start) {
    return undefined;
  }
  const index = wen.light.indexOf(call);
  if (index < 0) {
    return undefined;
  }
  return pairFromLight(text, snt, call, index);
}

/** 光标处的配对：古文轻锚点 ↔ notes，或内嵌 `[词][注]`。 */
export function findPairAt(text: string, offset: number): PairMatch | undefined {
  const snts = findSntCalls(text);
  const snt = findSntAt(text, offset, snts);
  if (snt) {
    const notesIdx = notesItemContaining(snt.notes, offset);
    if (notesIdx >= 0) {
      return pairFromNotes(text, snt, notesIdx);
    }
    for (const block of snt.blocks) {
      const call = noteCallContaining(block.calls, offset);
      if (call) {
        return pairFromCall(text, snt, block, call, offset);
      }
    }
    return undefined;
  }

  const call = noteCallContaining(findNoteCalls(text, 0, text.length), offset);
  if (call?.note) {
    return embeddedPair(text, call, offset);
  }
  return undefined;
}

export function hoverPayload(match: PairMatch): HoverPayload {
  const n = match.index + 1;
  if (match.kind === "light-to-notes" || match.kind === "word-to-embedded") {
    if (!match.paired) {
      return {
        tag: "注文",
        body:
          match.kind === "light-to-notes"
            ? `轻锚点 ${match.lightCount} 条，notes ${match.notesCount} 条`
            : "无内嵌注文",
        jumpHint: null,
      };
    }
    return {
      tag: match.kind === "word-to-embedded" ? "注文" : `注文 ${n}`,
      body: match.note.trim() === "" ? "null" : match.note,
      jumpHint: "跳转",
    };
  }

  if (!match.paired) {
    return {
      tag: "锚点",
      body: `轻锚点 ${match.lightCount} 条，notes ${match.notesCount} 条`,
      jumpHint: null,
    };
  }
  return {
    tag: match.kind === "embedded-to-word" ? "词" : `锚点 ${n}`,
    body: match.word.trim() === "" ? "（空）" : match.word,
    jumpHint: "跳转",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mutedSpan(htmlInner: string): string {
  return `<span style="color:var(--vscode-descriptionForeground);">${htmlInner}</span>`;
}

/**
 * 悬停弹窗 HTML。VS Code 只允许 span 上的 color。
 * 辅助一行：`跳转 >> 注文 2 ::`（小字浅色，仅「跳转」可点）；
 * 主内容用 strong 放在下部，贴近编辑器里被悬停的字。
 */
export function formatHoverMarkdown(payload: HoverPayload, jumpHref: string | null): string {
  const rest = mutedSpan(escapeHtml(` >> ${payload.tag} ::`));
  const lead =
    jumpHref && payload.jumpHint
      ? `<a href="${escapeHtml(jumpHref)}">${mutedSpan(escapeHtml(payload.jumpHint))}</a>`
      : mutedSpan(escapeHtml("无对应"));
  const aux = `<small>${lead}${rest}</small>`;
  if (!payload.body) {
    return aux;
  }
  const bodyHtml = escapeHtml(payload.body).replace(/\r\n|\n|\r/g, "<br>");
  return `${aux}<br><strong>${bodyHtml}</strong>`;
}

export function jumpFailMessage(match: PairMatch | undefined): string {
  if (!match) {
    return "光标不在轻锚点或注文上";
  }
  if (!match.paired || match.targetInner == null) {
    if (match.kind === "light-to-notes" || match.kind === "notes-to-light") {
      return `无配对：轻锚点 ${match.lightCount} 条，notes ${match.notesCount} 条`;
    }
    return "没有可跳转的对应位置";
  }
  return "";
}
