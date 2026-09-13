import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  findSntCalls,
  parseNoteCall,
} = require("../out/snt-parse.js");
const {
  addNote,
  removeNote,
  dispatchNoteAction,
  diagnoseDocument,
} = require("../out/snt-edit.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let failed = 0;
let passed = 0;

function assert(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`OK   ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
    if (detail) console.error("     ", detail);
  }
}

const sample = `#snt(notes: (
  [指周代宋国人],
  [],
  [露出地面的树桩],
))[
  #ntw[宋人]#ntj[有耕者]，田中有#ntc[株]。
][
  宋国#ntj[有个耕田的人]，田里有树桩。
][
  sòng rén
]
`;

const snts = findSntCalls(sample);
assert("解析到 1 个 #snt", snts.length === 1, snts.length);
const snt = snts[0];
assert("三块内容", snt.blocks.length === 3, snt.blocks.length);
assert("notes 3 条", snt.notes && snt.notes.items.length === 3, snt.notes && snt.notes.items.length);
assert("古文轻锚点 3", snt.blocks[0].light.length === 3, snt.blocks[0].light.length);
assert("译文宏 1 且不计入 notes", snt.blocks[1].light.length === 1, snt.blocks[1].light.length);
assert("第三 notes 非空", snt.notes.items[2].empty === false);

const inline = parseNoteCall("#ntc[走][跑]", 0);
assert("内嵌注文不是轻锚点", inline && inline.light === false && inline.note != null);

const light = parseNoteCall("#ntc(ln: 1)[身]", 0);
assert("带参数轻锚点", light && light.light && light.name === "ntc");

const notNt = parseNoteCall("#ntp[正文]", 0);
assert("#ntp 不是注释宏", notNt == null);

const commented = `#snt(notes: (
  // #ntw[假词][假注]
  [真注],
))[
  // #nt[假锚]
  古文#nt[实词]
][
  真译文
]
`;
const cSnt = findSntCalls(commented)[0];
assert("注释中的宏不计入", cSnt.blocks[0].light.length === 1 && cSnt.notes.items.length === 1);
assert("注释中假注不进 notes", commented.slice(cSnt.notes.items[0].innerStart, cSnt.notes.items[0].innerEnd).includes("真注"));

// —— 加注 ——
const plainWen = `#snt(notes: (
  [已有],
))[
  宋人有耕者，田中有株。
][
  译文
]
`;
const idxZhu = plainWen.indexOf("株");
const addZhu = addNote(plainWen, idxZhu, idxZhu + 1);
assert("加注成功", addZhu.ok, addZhu.error);
assert(
  "加注包 #nt",
  addZhu.ok && addZhu.newText.includes("#nt[株]"),
  addZhu.ok ? addZhu.newText : "",
);

const withPrior = `#snt(notes: (
  [已有],
))[
  #nt[宋人]有耕者，田中有株。
][
  译文
]
`;
const idxZhuAfter = withPrior.indexOf("株");
const addAfter = addNote(withPrior, idxZhuAfter, idxZhuAfter + 1);
assert(
  "加注在已有轻锚点之后插入 notes",
  addAfter.ok && /\[已有\],\s*\[\],/.test(addAfter.newText.replace(/\r/g, "")),
  addAfter.ok ? addAfter.newText : addAfter.error,
);
assert(
  "加注光标在空 notes 内",
  addZhu.ok && addZhu.newText[addZhu.selectionStart] === "]" && addZhu.newText.slice(addZhu.selectionStart - 1, addZhu.selectionStart + 1) === "[]"[1] ? addZhu.newText[addZhu.selectionStart - 1] === "[" : true,
  addZhu.ok ? JSON.stringify({ s: addZhu.selectionStart, around: addZhu.newText.slice(addZhu.selectionStart - 2, addZhu.selectionStart + 2) }) : "",
);
if (addZhu.ok) {
  const chBefore = addZhu.newText[addZhu.selectionStart - 1];
  const chAt = addZhu.newText[addZhu.selectionStart];
  assert("光标夹在 [] 中间", chBefore === "[" && chAt === "]", `${chBefore}|${chAt}`);
}

const idxSong = plainWen.indexOf("宋人");
const addSong = addNote(plainWen, idxSong, idxSong + 2);
assert(
  "加在句首插入 notes 第一条",
  addSong.ok && addSong.newText.includes("[],\n  [已有]"),
  addSong.ok ? addSong.newText : addSong.error,
);

const noNotes = `#snt[
  田中有株。
][
  译文
]
`;
const idxZhu2 = noNotes.indexOf("株");
const addCreate = addNote(noNotes, idxZhu2, idxZhu2 + 1);
assert("无 notes 时创建 notes:", addCreate.ok && addCreate.newText.includes("notes:"), addCreate.ok ? addCreate.newText : addCreate.error);
assert("创建后有空项与轻锚点", addCreate.ok && addCreate.newText.includes("#nt[株]") && addCreate.newText.includes("[],"), addCreate.newText);

const yi = `#snt(notes: (
  [已有],
))[
  田中有#nt[株]。
][
  田里有树桩。
]
`;
const idxYi = yi.indexOf("树桩");
const addYi = addNote(yi, idxYi, idxYi + 2);
assert("译文加注不改 notes", addYi.ok && addYi.newText.includes("#nt[树桩]") && (addYi.newText.match(/\[已有\]/g) || []).length === 1 && !addYi.newText.includes("[],"), addYi.ok ? addYi.newText : addYi.error);

const addEmpty = addNote(plainWen, 0, 0);
assert("无选区拒绝加注", !addEmpty.ok);

const nestAt = sample.indexOf("宋人");
const addNest = addNote(sample, nestAt, nestAt + 2);
assert("已在宏内拒绝再套", !addNest.ok);

const pyStart = sample.indexOf("sòng");
const addPy = addNote(sample, pyStart, pyStart + 4);
assert("拼音块拒绝加注", !addPy.ok);

// —— 去注 ——
const wen = `#snt(notes: (
  [指周代宋国人],
  [],
  [树桩],
))[
  #ntw[宋人]#ntj[有耕者]，田中有#ntc[株]。
][
  宋国#ntj[有个耕田的人]，田里有树桩。
]
`;
const cursorZhu = wen.indexOf("#ntc[株]") + 4; // 落在「株」上
const rmZhu = removeNote(wen, cursorZhu, cursorZhu);
assert("光标去注成功", rmZhu.ok, rmZhu.error);
assert("去掉宏保留汉字", rmZhu.ok && rmZhu.newText.includes("田中有株") && !rmZhu.newText.includes("#ntc[株]"), rmZhu.newText);
assert("删了对应 notes 末项", rmZhu.ok && !rmZhu.newText.includes("[树桩]"), rmZhu.newText);
assert("保留前两条 notes", rmZhu.ok && rmZhu.newText.includes("[指周代宋国人]") && rmZhu.newText.includes("[],"), rmZhu.newText);

const cursorSong = wen.indexOf("#ntw[宋人]") + 5;
const rmSong = removeNote(wen, cursorSong, cursorSong);
assert("去第一条 notes", rmSong.ok && !rmSong.newText.includes("[指周代宋国人]") && rmSong.newText.includes("宋人") && !rmSong.newText.includes("#ntw[宋人]"), rmSong.newText);

const sel = wen.indexOf("#ntw[宋人]");
const selEnd = wen.indexOf("有耕者") + 3; // 部分选中第二枚
const rmSel = removeNote(wen, sel, selEnd);
assert(
  "选区去掉相交的两枚宏",
  rmSel.ok &&
    !rmSel.newText.includes("#ntw") &&
    rmSel.newText.includes("宋人有耕者") &&
    rmSel.newText.includes("#ntc[株]") &&
    /\]\[\s*宋国#ntj/.test(rmSel.newText.replace(/\r/g, "")),
  rmSel.ok ? rmSel.newText : rmSel.error,
);
assert(
  "选区去注删前两条 notes",
  rmSel.ok && !rmSel.newText.includes("[指周代宋国人]") && rmSel.newText.includes("[树桩]"),
  rmSel.newText,
);

const between = wen.indexOf("，田中");
const rmBetween = removeNote(wen, between, between);
assert("宏缝中的光标不去注", !rmBetween.ok);

const inlineSrc = `#snt(notes: (
  [仍在],
))[
  兔#ntc[走][跑]#nt[颈]。
][
  译文
]
`;
const cursorZou = inlineSrc.indexOf("#ntc[走]") + 5;
const rmInline = removeNote(inlineSrc, cursorZou, cursorZou);
assert("内嵌注文只拆宏", rmInline.ok && rmInline.newText.includes("兔走") && !rmInline.newText.includes("#ntc[走]"), rmInline.newText);
assert("内嵌不去 notes", rmInline.ok && rmInline.newText.includes("[仍在]"), rmInline.newText);

const yiSrc = `#snt(notes: (
  [株注],
))[
  田中有#nt[株]。
][
  田里有#nt[树桩]。
]
`;
const cursorYiNt = yiSrc.indexOf("#nt[树桩]") + 4;
const rmYi = removeNote(yiSrc, cursorYiNt, cursorYiNt);
assert("译文去框不动 notes", rmYi.ok && rmYi.newText.includes("田里有树桩") && rmYi.newText.includes("[株注]") && rmYi.newText.includes("#nt[株]"), rmYi.newText);

const notesItemPos = wen.indexOf("[树桩]");
const rmFromNotes = removeNote(wen, notesItemPos + 1, notesItemPos + 1);
assert(
  "光标在 notes 项上成对删除",
  rmFromNotes.ok && !rmFromNotes.newText.includes("[树桩]") && !rmFromNotes.newText.includes("#ntc[株]") && rmFromNotes.newText.includes("田中有株"),
  rmFromNotes.ok ? rmFromNotes.newText : rmFromNotes.error,
);

// —— 快捷键分派 ——
const dAdd = dispatchNoteAction(plainWen, idxZhu, idxZhu + 1);
assert("分派：纯选区 → 加注", dAdd.ok && dAdd.newText.includes("#nt[株]"), dAdd.error);
const dRm = dispatchNoteAction(wen, cursorZhu, cursorZhu);
assert("分派：光标在宏上 → 去注", dRm.ok && !dRm.newText.includes("#ntc[株]"), dRm.error);
const dRmSel = dispatchNoteAction(wen, sel, selEnd);
assert("分派：选区碰到宏 → 去注", dRmSel.ok && !dRmSel.newText.includes("#ntw"), dRmSel.error);

// —— 诊断 ——
const bad = `#snt(notes: (
  [只有一条],
))[
  #nt[甲]#nt[乙]。
][
  译
]
`;
const diags = diagnoseDocument(bad);
assert("计数不一致报诊断", diags.length === 1 && diags[0].light === 2 && diags[0].notes === 1, JSON.stringify(diags));
const goodDiags = diagnoseDocument(wen);
assert("配对正确无诊断", goodDiags.length === 0, JSON.stringify(goodDiags));
const noNotesDiags = diagnoseDocument(`#snt[\n  #nt[甲]\n][\n  译\n]\n`);
assert("无 notes: 不诊断", noNotesDiags.length === 0);

for (const name of ["样张-中段.typ", "样张-高段.typ"]) {
  const src = fs.readFileSync(path.join(root, "tests", name), "utf8");
  const found = findSntCalls(src);
  const d = diagnoseDocument(src);
  assert(`${name} 解析到 #snt`, found.length > 0, found.length);
  assert(
    `${name} 轻锚点与 notes 对齐`,
    d.length === 0,
    JSON.stringify(d),
  );
}

console.log(`\n${passed} passed, ${failed} failed  (${root})`);
process.exit(failed ? 1 : 0);
