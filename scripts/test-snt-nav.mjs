import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { findSntCalls, findSntAt } = require("../out/snt-parse.js");
const { diagnoseDocument } = require("../out/snt-edit.js");
const { findPairAt, hoverPayload, jumpFailMessage, formatHoverMarkdown } = require("../out/snt-nav.js");
const { splitSnt, mergeSnt } = require("../out/snt-split.js");

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
  sòng rén yǒu gēng zhě tián zhōng yǒu zhū
]
`;

const zhuCall = sample.indexOf("#ntc[株]");
const zhuWord = zhuCall + "#ntc[".length;
const pairZhu = findPairAt(sample, zhuWord);
assert("轻锚点找到配对", pairZhu && pairZhu.kind === "light-to-notes" && pairZhu.paired, pairZhu);
assert(
  "轻锚点对应树桩注",
  pairZhu && pairZhu.note.includes("露出地面的树桩") && pairZhu.index === 2,
  pairZhu && pairZhu.note,
);
const hoverZhu = pairZhu && hoverPayload(pairZhu);
assert(
  "悬停标签为注文",
  hoverZhu && hoverZhu.tag === "注文 3" && hoverZhu.body.includes("树桩"),
  hoverZhu,
);
assert("轻锚点可跳转", pairZhu && jumpFailMessage(pairZhu) === "");

const notesZhu = sample.indexOf("[露出地面的树桩]") + 1;
const pairNotes = findPairAt(sample, notesZhu);
assert(
  "注文跳回轻锚点",
  pairNotes &&
    pairNotes.kind === "notes-to-light" &&
    pairNotes.paired &&
    pairNotes.word.includes("株"),
  pairNotes,
);
const hoverNotes = pairNotes && hoverPayload(pairNotes);
assert(
  "悬停标签为锚点",
  hoverNotes && hoverNotes.tag === "锚点 3" && hoverNotes.body.includes("株"),
  hoverNotes,
);

const emptyLight = sample.indexOf("#ntj[有耕者]") + "#ntj[".length;
const pairEmpty = findPairAt(sample, emptyLight);
const hoverEmpty = pairEmpty && hoverPayload(pairEmpty);
assert(
  "空注轻锚点悬停显示 null",
  pairEmpty &&
    pairEmpty.kind === "light-to-notes" &&
    pairEmpty.paired &&
    hoverEmpty &&
    hoverEmpty.body === "null",
  hoverEmpty,
);
const emptyNotes = sample.indexOf("[]") + 1;
const pairEmptyNotes = findPairAt(sample, emptyNotes);
assert(
  "空 notes 项悬停显示被注词",
  pairEmptyNotes &&
    pairEmptyNotes.kind === "notes-to-light" &&
    pairEmptyNotes.word.includes("有耕者"),
  pairEmptyNotes,
);

if (hoverZhu) {
  const html = formatHoverMarkdown(hoverZhu, "command:typstBuddy._revealOffset?%5B0%5D");
  const auxAt = html.indexOf("跳转");
  const tagAt = html.indexOf("注文 3");
  const smallAt = html.indexOf("<small>");
  const strongAt = html.indexOf("<strong>");
  const bodyAt = html.indexOf("树桩");
  assert(
    "弹窗辅助行为 跳转 >> 注文 N ::",
    html.includes("跳转") && html.includes(" &gt;&gt; 注文 3 ::") && auxAt < bodyAt,
    html,
  );
  assert("辅助一行在主内容之前", smallAt >= 0 && tagAt >= 0 && strongAt > tagAt && tagAt < bodyAt, html);
  assert("辅助信息用 small 浅色", html.includes("<small>") && html.includes("descriptionForeground"), html);
  assert("跳转链在辅助区", html.includes(">跳转</span>") && html.indexOf("跳转") < strongAt, html);
  assert("主内容用 strong 突出", html.includes("<strong>") && html.indexOf("树桩") > strongAt, html);
}

if (hoverNotes) {
  const html = formatHoverMarkdown(hoverNotes, "command:typstBuddy._revealOffset?%5B0%5D");
  assert(
    "反向弹窗为 跳转 >> 锚点 N ::",
    html.includes(" &gt;&gt; 锚点 3 ::") && html.includes("株") && html.indexOf("锚点 3") < html.indexOf("株"),
    html,
  );
}

const unsafe = hoverPayload({
  kind: "light-to-notes",
  paired: true,
  index: 0,
  hover: { start: 0, end: 1 },
  origin: { start: 0, end: 1 },
  target: { start: 0, end: 1 },
  targetInner: { start: 0, end: 1 },
  word: "甲",
  note: `1 < 2 & "注"`,
  lightCount: 1,
  notesCount: 1,
});
const escaped = formatHoverMarkdown(unsafe, null);
assert(
  "注文 HTML 转义",
  escaped.includes("1 &lt; 2 &amp; &quot;注&quot;") && !escaped.includes("1 < 2"),
  escaped,
);

const identPos = zhuCall + 1;
const pairIdent = findPairAt(sample, identPos);
assert(
  "宏名上仍能悬停（整枚轻锚点）",
  pairIdent && pairIdent.kind === "light-to-notes" && pairIdent.paired,
  pairIdent,
);
assert(
  "宏名不在 origin 内（F12 让给 Tinymist）",
  pairIdent && (identPos < pairIdent.origin.start || identPos >= pairIdent.origin.end),
  pairIdent && JSON.stringify(pairIdent.origin),
);

const yiBox = sample.indexOf("#ntj[有个耕田的人]") + 5;
assert("译文加框不配 notes", findPairAt(sample, yiBox) == null);

const songPos = sample.indexOf("[指周代宋国人]") + 1;
const pairSong = findPairAt(sample, songPos);
assert(
  "第一条 notes 对 宋人",
  pairSong && pairSong.word.includes("宋人") && pairSong.index === 0,
  pairSong,
);

const embedded = `兔#ntc[走][跑]触株。`;
const zouWord = embedded.indexOf("走");
const pairEmb = findPairAt(embedded, zouWord);
assert(
  "内嵌词悬停看出注",
  pairEmb && pairEmb.kind === "word-to-embedded" && pairEmb.note === "跑",
  pairEmb,
);
const paoPos = embedded.indexOf("跑");
const pairPao = findPairAt(embedded, paoPos);
assert(
  "内嵌注跳回被注词",
  pairPao && pairPao.kind === "embedded-to-word" && pairPao.word === "走",
  pairPao,
);

const miss = findPairAt("无宏的一段话", 2);
assert("无关位置无配对", miss == null);
assert("无关位置跳转提示", jumpFailMessage(miss).includes("不在"));

const unmatched = `#snt(notes: (
  [只有一条],
))[
  #nt[甲]#nt[乙]。
][
  译
]
`;
const yiLight = unmatched.indexOf("#nt[乙]") + 4;
const pairMiss = findPairAt(unmatched, yiLight);
assert("条数不够则 unpaired", pairMiss && pairMiss.paired === false, pairMiss);
assert(
  "unpaired 悬停说明条数",
  pairMiss && hoverPayload(pairMiss).jumpHint === null && hoverPayload(pairMiss).body.includes("notes"),
  pairMiss && hoverPayload(pairMiss),
);

for (const name of ["样张-中段.typ", "样张-高段.typ"]) {
  const src = fs.readFileSync(path.join(root, "tests", name), "utf8");
  let pairs = 0;
  let broken = 0;
  for (const snt of findSntCalls(src)) {
    const lights = snt.blocks[0] ? snt.blocks[0].light : [];
    const n = Math.min(lights.length, snt.notes ? snt.notes.items.length : 0);
    for (let i = 0; i < n; i += 1) {
      const fromLight = findPairAt(src, lights[i].word.innerStart);
      const item = snt.notes.items[i];
      const fromNotes = findPairAt(src, item.innerStart);
      pairs += 1;
      if (
        !fromLight ||
        !fromLight.paired ||
        fromLight.index !== i ||
        !fromNotes ||
        !fromNotes.paired ||
        fromNotes.index !== i
      ) {
        broken += 1;
      }
    }
  }
  assert(`${name} 轻锚点↔notes 双向配对`, broken === 0 && pairs > 0, { pairs, broken });
}

// —— 拆分 ——
const splitAt = sample.indexOf("，田中");
const yiSplitAt = sample.indexOf("，田里");
const split = splitSnt(sample, [splitAt, yiSplitAt]);
assert("逗号处拆分成功", split.ok, split.error);
if (split.ok) {
  const two = findSntCalls(split.newText);
  assert("拆成两个 #snt", two.length === 2, two.length);
  assert(
    "左句 notes 2 条",
    two[0].notes && two[0].notes.items.length === 2,
    two[0].notes && two[0].notes.items.length,
  );
  assert(
    "右句 notes 1 条",
    two[1].notes && two[1].notes.items.length === 1,
    two[1].notes && two[1].notes.items.length,
  );
  assert("左句保留宋人/耕者", split.newText.includes("#ntw[宋人]") && split.newText.includes("#ntj[有耕者]"));
  assert("右句保留株", /#snt[\s\S]*#ntc\[株\]/.test(split.newText) && two[1].blocks[0].light.length === 1);
  assert(
    "树桩注在右句",
    two[1].notes &&
      split.newText.slice(two[1].notes.items[0].innerStart, two[1].notes.items[0].innerEnd).includes("树桩"),
  );
  assert("拆分后计数对齐", diagnoseDocument(split.newText).length === 0, JSON.stringify(diagnoseDocument(split.newText)));
  assert("左句拼音含 gēng", two[0].blocks[2] && split.newText.slice(two[0].blocks[2].innerStart, two[0].blocks[2].innerEnd).includes("gēng"));
  assert(
    "右句拼音含 zhū 不含 gēng",
    two[1].blocks[2] &&
      (() => {
        const yin = split.newText.slice(two[1].blocks[2].innerStart, two[1].blocks[2].innerEnd);
        return yin.includes("zhū") && !yin.includes("gēng");
      })(),
  );
  assert(
    "译文在逗号切开",
    two[0].blocks[1] &&
      split.newText.slice(two[0].blocks[1].innerStart, two[0].blocks[1].innerEnd).includes("耕田的人") &&
      !split.newText.slice(two[0].blocks[1].innerStart, two[0].blocks[1].innerEnd).includes("树桩"),
  );
  assert("光标落在右句 #snt", split.selectionStart != null && split.newText.slice(split.selectionStart, split.selectionStart + 4) === "#snt");
}

const insideMacro = sample.indexOf("#ntj[有耕者]") + 6;
const splitInside = splitSnt(sample, [insideMacro, yiSplitAt]);
assert("宏内拒绝拆分", !splitInside.ok);

const splitEdge = splitSnt(sample, [sample.indexOf("#ntw[宋人]"), yiSplitAt]);
assert(
  "块首拆分会拒绝空正文",
  !splitEdge.ok && splitEdge.error.includes("为空"),
  splitEdge.ok ? splitEdge.newText : splitEdge.error,
);

const notInSnt = splitSnt("一段#nt[甲]普通文字", [2]);
assert("非 #snt 拒绝拆分", !notInSnt.ok);

const notesSplitAt = sample.indexOf("[指周代宋国人]") + 3;
const splitFromNotes = splitSnt(sample, [notesSplitAt, splitAt, yiSplitAt]);
assert("notes 里的光标被拒绝", !splitFromNotes.ok, splitFromNotes.error);

const splitFromYi = splitSnt(sample, [yiSplitAt]);
assert(
  "只有译文光标则拒绝",
  !splitFromYi.ok && splitFromYi.error.includes("相同数量"),
  splitFromYi.error,
);

const yinPos = sample.indexOf("tián");
const splitFromYin = splitSnt(sample, [yinPos, splitAt, yiSplitAt]);
assert("拼音里的光标被拒绝", !splitFromYin.ok, splitFromYin.error);

const mismatch = splitSnt(sample, [splitAt, sample.indexOf("田中"), yiSplitAt]);
assert(
  "正文译文光标数量不同则拒绝",
  !mismatch.ok && mismatch.error.includes("相同数量"),
  mismatch.error,
);

const multi = splitSnt(sample, [
  sample.indexOf("#ntj[有耕者]"),
  splitAt,
  sample.indexOf("#ntj[有个耕田的人]"),
  yiSplitAt,
]);
assert("两处光标拆成三句", multi.ok, multi.error);
if (multi.ok) {
  const three = findSntCalls(multi.newText);
  assert("拆成三个 #snt", three.length === 3, three.length);
  assert(
    "三句 notes 各 1 条",
    three.every((s) => s.notes && s.notes.items.length === 1),
    three.map((s) => s.notes && s.notes.items.length),
  );
  assert("三句拆分后计数对齐", diagnoseDocument(multi.newText).length === 0, JSON.stringify(diagnoseDocument(multi.newText)));
}

const line = `#snt[甲，乙。][译甲，译乙。]`;
const lineSplit = splitSnt(line, [line.indexOf("，") + 1, line.indexOf("译甲，") + 3]);
assert("单行两边各一光标可拆", lineSplit.ok && findSntCalls(lineSplit.newText).length === 2, lineSplit.error);
if (lineSplit.ok) {
  const two = findSntCalls(lineSplit.newText);
  const leftYi = lineSplit.newText.slice(two[0].blocks[1].innerStart, two[0].blocks[1].innerEnd);
  const rightYi = lineSplit.newText.slice(two[1].blocks[1].innerStart, two[1].blocks[1].innerEnd);
  assert("单行译文按光标切开", leftYi.includes("译甲") && !leftYi.includes("译乙") && rightYi.includes("译乙"), [leftYi, rightYi]);
}

const onlyWen = `#snt[甲，乙。]`;
const onlySplit = splitSnt(onlyWen, [onlyWen.indexOf("，") + 1]);
assert("没有译文时只按正文光标拆", onlySplit.ok && findSntCalls(onlySplit.newText).length === 2, onlySplit.error);

const noNotes = `#snt[
  曰：‘吾马良。’
][
  他说：‘我的马很好。’
][
  yuē wú mǎ liáng
]
#snt[
  臣曰：‘马虽良，此非楚之路也。’
][
  我说：‘马虽然好，但这不是去楚国的路啊。’
][
  chén yuē mǎ suī liáng
]
`;
const splitPlain = splitSnt(noNotes, [noNotes.indexOf("吾马"), noNotes.indexOf("我的马")]);
assert("无 notes 的 #snt 可拆", splitPlain.ok, splitPlain.error);

const cross = splitSnt(noNotes, [noNotes.indexOf("吾马"), noNotes.indexOf("楚国")]);
assert("光标不在同一个 #snt 则拒绝", !cross.ok && cross.error.includes("同一个"), cross.error);

// —— 合并 ——
const twoSnt = `#snt(notes: (
  [甲注],
))[
  古文#nt[甲]。
][
  译甲。
][
  jiǎ
]
#snt(notes: (
  [乙注],
))[
  古文#nt[乙]。
][
  译乙。
][
  yǐ
]
`;
const cursorFirst = twoSnt.indexOf("甲。");
const mergedOk = mergeSnt(twoSnt, cursorFirst, cursorFirst);
assert("合并相邻两句", mergedOk.ok, mergedOk.error);
if (mergedOk.ok) {
  const one = findSntCalls(mergedOk.newText);
  assert("合并后只剩一句", one.length === 1, one.length);
  assert("notes 拼接", mergedOk.newText.includes("[甲注]") && mergedOk.newText.includes("[乙注]"));
  assert("古文拼接", mergedOk.newText.includes("#nt[甲]") && mergedOk.newText.includes("#nt[乙]"));
  assert("拼音空格拼接", mergedOk.newText.includes("jiǎ yǐ"), mergedOk.newText);
  assert("合并后计数对齐", diagnoseDocument(mergedOk.newText).length === 0, JSON.stringify(diagnoseDocument(mergedOk.newText)));
}

const lastCursor = twoSnt.indexOf("乙。");
const mergeLast = mergeSnt(twoSnt, lastCursor, lastCursor);
assert("末句与上一句合并", mergeLast.ok && findSntCalls(mergeLast.newText).length === 1, mergeLast.error);

const selMerge = mergeSnt(twoSnt, twoSnt.indexOf("甲。"), twoSnt.indexOf("乙。") + 1);
assert("选区跨两句则合并这两句", selMerge.ok && findSntCalls(selMerge.newText).length === 1, selMerge.error);

const withJunk = `#snt[甲][译甲]
中间有字
#snt[乙][译乙]
`;
const junk = mergeSnt(withJunk, withJunk.indexOf("甲"), withJunk.indexOf("甲"));
assert("中间有内容拒绝合并", !junk.ok);

const oneOnly = `#snt[甲][译甲]
`;
assert("单独一句无法合并", !mergeSnt(oneOnly, 4, 4).ok);

if (split.ok) {
  const snts = findSntCalls(split.newText);
  const inLeft = snts[0].blocks[0].innerStart + 1;
  const round = mergeSnt(split.newText, inLeft, inLeft);
  assert("拆分后再合并成功", round.ok, round.error);
  if (round.ok) {
    assert("往返后仍是 1 个 #snt", findSntCalls(round.newText).length === 1, findSntCalls(round.newText).length);
    assert("往返后计数对齐", diagnoseDocument(round.newText).length === 0, JSON.stringify(diagnoseDocument(round.newText)));
    assert("往返保留三注", (round.newText.match(/\[指周代宋国人\]/) || []).length === 1 && round.newText.includes("[露出地面的树桩]"));
    const snt = findSntAt(round.newText, round.newText.indexOf("#snt"));
    assert(
      "往返轻锚点 3",
      snt && snt.blocks[0].light.length === 3 && snt.notes && snt.notes.items.length === 3,
      snt && snt.blocks[0].light.length,
    );
  }
}

const midSample = fs.readFileSync(path.join(root, "tests", "样张-中段.typ"), "utf8");
const realSnts = findSntCalls(midSample);
assert("样张至少两句", realSnts.length >= 2, realSnts.length);
if (realSnts.length >= 2) {
  const a = realSnts[0];
  const b = realSnts[1];
  const between = midSample.slice(a.end, b.start);
  if (/^\s*$/.test(between)) {
    const at = a.blocks[0].innerStart + 2;
    const m = mergeSnt(midSample, at, at);
    assert("样张前两句可合并", m.ok, m.error);
    if (m.ok) {
      assert(
        "样张合并后少一句",
        findSntCalls(m.newText).length === realSnts.length - 1,
        findSntCalls(m.newText).length,
      );
      const diags = diagnoseDocument(m.newText);
      assert("样张合并后无新的计数错误", diags.length === 0, JSON.stringify(diags));
    }
    const comma = midSample.indexOf("，", a.blocks[0].innerStart);
    const yiBlock = a.blocks[1];
    const yiComma = yiBlock ? midSample.indexOf("，", yiBlock.innerStart) : -1;
    if (
      comma > a.blocks[0].innerStart &&
      comma < a.blocks[0].innerEnd &&
      yiBlock &&
      yiComma > yiBlock.innerStart &&
      yiComma < yiBlock.innerEnd
    ) {
      const sp = splitSnt(midSample, [comma + 1, yiComma + 1]);
      assert("样张首句逗号后可拆", sp.ok, sp.error);
      if (sp.ok) {
        assert(
          "样张拆后多一句",
          findSntCalls(sp.newText).length === realSnts.length + 1,
          findSntCalls(sp.newText).length,
        );
        assert("样张拆后计数对齐", diagnoseDocument(sp.newText).length === 0, JSON.stringify(diagnoseDocument(sp.newText)));
      }
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed  (${root})`);
process.exit(failed ? 1 : 0);
