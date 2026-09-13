import {
  type NoteCall,
  type NotesArray,
  type SntBlock,
  type SntCall,
  findSntCalls,
  findSntAt,
  findNoteCalls,
  parseNoteCall,
  skipTrivia,
  blockIndexAt,
  noteCallContaining,
  noteCallsIntersecting,
  notesItemContaining,
  indentAt,
  lineStartAt,
} from "./snt-parse";

export interface TextEdit {
  start: number;
  end: number;
  text: string;
  cursorOffset?: number;
  cursorEndOffset?: number;
}

export interface EditOptions {
  eol?: string;
}

export type EditOk = {
  ok: true;
  edits: TextEdit[];
  newText: string;
  selectionStart: number | null;
  selectionEnd: number | null;
};

export type EditFail = {
  ok: false;
  error: string;
};

export type EditResult = EditOk | EditFail;

export interface CountDiagnostic {
  start: number;
  end: number;
  message: string;
  light: number;
  notes: number;
}

interface NotesStyle {
  itemIndent: string;
  multiline: boolean;
  eol: string;
  baseIndent: string;
}

export function applyEdits(
  text: string,
  edits: TextEdit[],
): { text: string; selectionStart: number | null; selectionEnd: number | null } {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  let result = "";
  let last = 0;
  let selectionStart: number | null = null;
  let selectionEnd: number | null = null;
  for (const e of sorted) {
    result += text.slice(last, e.start);
    const insAt = result.length;
    result += e.text;
    if (e.cursorOffset != null) {
      selectionStart = insAt + e.cursorOffset;
      selectionEnd = e.cursorEndOffset != null ? insAt + e.cursorEndOffset : selectionStart;
    }
    last = e.end;
  }
  result += text.slice(last);
  return { text: result, selectionStart, selectionEnd };
}

function fail(error: string): EditFail {
  return { ok: false, error };
}

function succeed(text: string, edits: TextEdit[]): EditOk {
  const applied = applyEdits(text, edits);
  return {
    ok: true,
    edits,
    newText: applied.text,
    selectionStart: applied.selectionStart,
    selectionEnd: applied.selectionEnd,
  };
}

function selectionInOneSnt(
  text: string,
  start: number,
  end: number,
  sntCalls: SntCall[],
): { error: string } | { snt: SntCall | undefined } {
  const a = findSntAt(text, start, sntCalls);
  const b = findSntAt(text, Math.max(start, end - 1), sntCalls);
  if (a && b && a.start !== b.start) {
    return { error: "选区跨越了两个 #snt，请缩小范围" };
  }
  return { snt: a ?? b };
}

function collectAllNoteCalls(snt: SntCall): NoteCall[] {
  const out: NoteCall[] = [];
  for (const block of snt.blocks) {
    out.push(...block.calls);
  }
  return out;
}

function notesStyle(text: string, snt: SntCall, eol: string): NotesStyle {
  const baseIndent = indentAt(text, snt.start);
  const notes = snt.notes;
  if (!notes || notes.items.length === 0) {
    return {
      itemIndent: baseIndent + "  ",
      multiline: true,
      eol,
      baseIndent,
    };
  }
  const multiline = text.slice(notes.start, notes.end).includes("\n");
  return {
    itemIndent: indentAt(text, notes.items[0].start),
    multiline,
    eol,
    baseIndent,
  };
}

function createNotesArgEdit(text: string, snt: SntCall, eol: string): TextEdit {
  const indent = indentAt(text, snt.start);
  const inner = `notes: (${eol}${indent}  [],${eol}${indent})`;
  if (!snt.paren) {
    return {
      start: snt.start + 4,
      end: snt.start + 4,
      text: `(${inner})`,
      cursorOffset: `(notes: (${eol}${indent}  [`.length,
    };
  }
  const close = snt.paren.end - 1;
  const innerParen = text.slice(snt.paren.start + 1, close).trim();
  if (!innerParen) {
    return {
      start: snt.paren.start + 1,
      end: close,
      text: inner,
      cursorOffset: `notes: (${eol}${indent}  [`.length,
    };
  }
  const prefix = `, ${inner}`;
  return {
    start: close,
    end: close,
    text: prefix,
    cursorOffset: `, notes: (${eol}${indent}  [`.length,
  };
}

function extendAfterItem(text: string, from: number, limit: number): number {
  let i = from;
  while (i < limit && (text[i] === " " || text[i] === "\t")) {
    i += 1;
  }
  if (text[i] === ",") {
    i += 1;
  }
  if (text[i] === "\r") {
    i += 1;
  }
  if (text[i] === "\n") {
    i += 1;
  }
  return i;
}

function insertEmptyNotesItem(
  text: string,
  snt: SntCall,
  index: number,
  eol: string,
): { error: string } | { edit: TextEdit } {
  if (!snt.notes) {
    if (index !== 0) {
      return { error: "无法在缺少 notes: 时按指定下标插入" };
    }
    return { edit: createNotesArgEdit(text, snt, eol) };
  }
  const notes = snt.notes;
  const style = notesStyle(text, snt, eol);
  const pad = style.itemIndent;
  const items = notes.items;

  if (items.length === 0) {
    const inner = `${eol}${pad}[],${eol}${style.baseIndent}`;
    return {
      edit: {
        start: notes.start + 1,
        end: notes.end - 1,
        text: inner,
        cursorOffset: `${eol}${pad}[`.length,
      },
    };
  }

  if (index < items.length) {
    const at = items[index].start;
    if (style.multiline) {
      return {
        edit: {
          start: at,
          end: at,
          text: `[],${eol}${pad}`,
          cursorOffset: 1,
        },
      };
    }
    return {
      edit: {
        start: at,
        end: at,
        text: "[], ",
        cursorOffset: 1,
      },
    };
  }

  const last = items[items.length - 1];
  let j = last.end;
  while (j < notes.end - 1 && (text[j] === " " || text[j] === "\t")) {
    j += 1;
  }
  const hasComma = text[j] === ",";
  if (hasComma) {
    j += 1;
    if (text[j] === "\r") {
      j += 1;
    }
    if (text[j] === "\n") {
      j += 1;
    }
    if (style.multiline) {
      return {
        edit: {
          start: j,
          end: j,
          text: `${pad}[],${eol}`,
          cursorOffset: `${pad}[`.length,
        },
      };
    }
    return {
      edit: {
        start: j,
        end: j,
        text: " [],",
        cursorOffset: 2,
      },
    };
  }
  if (style.multiline) {
    return {
      edit: {
        start: last.end,
        end: last.end,
        text: `,${eol}${pad}[],`,
        cursorOffset: `,${eol}${pad}[`.length,
      },
    };
  }
  return {
    edit: {
      start: last.end,
      end: last.end,
      text: ", [],",
      cursorOffset: 3,
    },
  };
}

function deleteNotesItemRange(text: string, notes: NotesArray, index: number): TextEdit {
  const items = notes.items;
  const item = items[index];
  if (items.length === 1) {
    return { start: notes.start + 1, end: notes.end - 1, text: "" };
  }
  const multiline = text.slice(notes.start, notes.end).includes("\n");
  const sameLine =
    items.length >= 2 &&
    lineStartAt(text, items[0].start) === lineStartAt(text, items[1].start);

  if (!multiline || sameLine) {
    if (index < items.length - 1) {
      return { start: item.start, end: items[index + 1].start, text: "" };
    }
    return {
      start: items[index - 1].end,
      end: extendAfterItem(text, item.end, notes.end - 1),
      text: "",
    };
  }

  if (index < items.length - 1) {
    const start = lineStartAt(text, item.start);
    const end = lineStartAt(text, items[index + 1].start);
    if (start < end) {
      return { start, end, text: "" };
    }
    return { start: item.start, end: items[index + 1].start, text: "" };
  }

  const start = lineStartAt(text, item.start);
  const end = extendAfterItem(text, item.end, notes.end - 1);
  return { start, end, text: "" };
}

function wrapEdit(start: number, end: number, selected: string): TextEdit {
  const prefix = "#nt[";
  return {
    start,
    end,
    text: `${prefix}${selected}]`,
    cursorOffset: prefix.length,
    cursorEndOffset: prefix.length + selected.length,
  };
}

/** 加注：必须先选中；默认 #nt；古文轻锚点同步插入 notes 空项。 */
export function addNote(
  text: string,
  start: number,
  end: number,
  options: EditOptions = {},
): EditResult {
  const eol = options.eol ?? "\n";
  if (start === end) {
    return fail("请先选中要加注的文字");
  }
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }
  const selected = text.slice(start, end);
  if (!selected.trim()) {
    return fail("请先选中要加注的文字");
  }

  const sntCalls = findSntCalls(text);
  const span = selectionInOneSnt(text, start, end, sntCalls);
  if ("error" in span) {
    return fail(span.error);
  }
  const snt = span.snt;

  if (snt) {
    const startBlock = blockIndexAt(snt, start);
    const endBlock = blockIndexAt(snt, end - 1);
    if (startBlock < 0 || endBlock < 0) {
      return fail("请在 #snt 的古文或译文中选中要加注的文字");
    }
    if (startBlock !== endBlock) {
      return fail("请勿跨古文 / 译文 / 拼音加注");
    }
    if (startBlock >= 2) {
      return fail("不能给拼音块加注");
    }
    const block = snt.blocks[startBlock];
    if (start < block.innerStart || end > block.innerEnd) {
      return fail("请在 #snt 的古文或译文中选中要加注的文字");
    }
    const hit = noteCallsIntersecting(block.calls, start, end);
    if (hit.length) {
      return fail("不能在已有注释宏上再套一层，请先去注或缩小选区");
    }

    const edits: TextEdit[] = [wrapEdit(start, end, selected)];
    if (startBlock === 0) {
      const lights = block.light;
      let index = 0;
      for (const call of lights) {
        if (call.end <= start) {
          index += 1;
        } else {
          break;
        }
      }
      const ins = insertEmptyNotesItem(text, snt, index, eol);
      if ("error" in ins) {
        return fail(ins.error);
      }
      delete edits[0].cursorOffset;
      delete edits[0].cursorEndOffset;
      edits.push(ins.edit);
    }
    return succeed(text, edits);
  }

  return succeed(text, [wrapEdit(start, end, selected)]);
}

function lightIndexOf(block: SntBlock, call: NoteCall): number {
  if (!call.light) {
    return -1;
  }
  return block.light.indexOf(call);
}

interface NoteTarget {
  call: NoteCall;
  blockIndex: number;
  snt: SntCall | null;
}

interface NotesTarget {
  snt: SntCall;
  index: number;
}

/** 去注：无选区拆光标所在宏；有选区拆与选区相交的整枚宏。 */
export function removeNote(
  text: string,
  start: number,
  end: number,
  _options: EditOptions = {},
): EditResult {
  const sntCalls = findSntCalls(text);
  const emptySel = start === end;
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }

  const span = selectionInOneSnt(text, start, emptySel ? start : end, sntCalls);
  if ("error" in span) {
    return fail(span.error);
  }

  const targets: NoteTarget[] = [];
  const notesTargets: NotesTarget[] = [];

  const considerSnt = (snt: SntCall): void => {
    if (emptySel) {
      const notesIdx = notesItemContaining(snt.notes, start);
      if (notesIdx >= 0) {
        notesTargets.push({ snt, index: notesIdx });
        const light = snt.blocks[0]?.light[notesIdx];
        if (light) {
          targets.push({ call: light, blockIndex: 0, snt });
        }
        return;
      }
      const all = collectAllNoteCalls(snt);
      const hit = noteCallContaining(all, start);
      if (hit) {
        const bi = snt.blocks.findIndex((b) => b.calls.includes(hit));
        targets.push({ call: hit, blockIndex: bi, snt });
      }
      return;
    }
    for (let bi = 0; bi < snt.blocks.length; bi += 1) {
      const hits = noteCallsIntersecting(snt.blocks[bi].calls, start, end);
      for (const call of hits) {
        targets.push({ call, blockIndex: bi, snt });
      }
    }
  };

  if (span.snt) {
    considerSnt(span.snt);
  } else if (emptySel) {
    let i = 0;
    let hit: NoteCall | null = null;
    while (i < text.length) {
      const j = skipTrivia(text, i);
      if (j > i) {
        i = j;
        continue;
      }
      if (text[i] === "#") {
        const call = parseNoteCall(text, i);
        if (call) {
          if (call.start <= start && start < call.end) {
            hit = call;
          }
          i = call.end;
          continue;
        }
      }
      i += 1;
    }
    if (hit) {
      targets.push({ call: hit, blockIndex: -1, snt: null });
    }
  } else {
    const hits = findNoteCalls(text, 0, text.length).filter(
      (c) => c.start < end && c.end > start,
    );
    for (const call of hits) {
      targets.push({ call, blockIndex: -1, snt: null });
    }
  }

  if (targets.length === 0 && notesTargets.length === 0) {
    if (emptySel) {
      return fail("光标不在注释宏上");
    }
    return fail("选区中没有注释宏");
  }

  const edits: TextEdit[] = [];
  const seenCall = new Set<number>();
  const notesDeletes: NotesTarget[] = [];

  for (const t of targets) {
    if (seenCall.has(t.call.start)) {
      continue;
    }
    seenCall.add(t.call.start);
    edits.push({
      start: t.call.start,
      end: t.call.end,
      text: text.slice(t.call.word.innerStart, t.call.word.innerEnd),
      cursorOffset: 0,
    });
    if (t.snt && t.blockIndex === 0 && t.call.light && t.snt.notes) {
      const idx = lightIndexOf(t.snt.blocks[0], t.call);
      if (idx >= 0) {
        notesDeletes.push({ snt: t.snt, index: idx });
      }
    }
  }

  for (const n of notesTargets) {
    if (!notesDeletes.some((d) => d.snt === n.snt && d.index === n.index)) {
      notesDeletes.push(n);
    }
  }

  notesDeletes.sort((a, b) => b.index - a.index);
  for (const d of notesDeletes) {
    if (!d.snt.notes) {
      continue;
    }
    if (d.index < 0 || d.index >= d.snt.notes.items.length) {
      continue;
    }
    edits.push(deleteNotesItemRange(text, d.snt.notes, d.index));
  }

  const firstUnwrap = [...edits]
    .filter((e) => e.cursorOffset === 0)
    .sort((a, b) => a.start - b.start)[0];
  for (const e of edits) {
    if (e !== firstUnwrap) {
      delete e.cursorOffset;
      delete e.cursorEndOffset;
    }
  }

  return succeed(text, edits);
}

export function dispatchNoteAction(
  text: string,
  start: number,
  end: number,
  options: EditOptions = {},
): EditResult {
  const emptySel = start === end;
  if (emptySel) {
    return removeNote(text, start, end, options);
  }

  const sntCalls = findSntCalls(text);
  const span = selectionInOneSnt(text, start, end, sntCalls);
  if ("error" in span) {
    return fail(span.error);
  }

  const calls: NoteCall[] = span.snt
    ? collectAllNoteCalls(span.snt)
    : findNoteCalls(text, 0, text.length);
  const hits = noteCallsIntersecting(calls, start, end);
  if (hits.length) {
    return removeNote(text, start, end, options);
  }
  return addNote(text, start, end, options);
}

export function diagnoseDocument(text: string): CountDiagnostic[] {
  const diags: CountDiagnostic[] = [];
  for (const snt of findSntCalls(text)) {
    if (!snt.notes) {
      continue;
    }
    const light = snt.blocks[0] ? snt.blocks[0].light.length : 0;
    const n = snt.notes.items.length;
    if (light === n) {
      continue;
    }
    diags.push({
      start: snt.start,
      end: Math.min(snt.start + 4, snt.end),
      message: `轻锚点 ${light} 条，notes ${n} 条`,
      light,
      notes: n,
    });
  }
  return diags;
}
