import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vsctm from "vscode-textmate";
import oniguruma from "vscode-oniguruma";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function findTinymistGrammar() {
  const extRoot = path.join(process.env.USERPROFILE || "", ".cursor", "extensions");
  if (!fs.existsSync(extRoot)) return null;
  const dirs = fs
    .readdirSync(extRoot)
    .filter((n) => n.startsWith("myriad-dreamin.tinymist-"))
    .sort()
    .reverse();
  for (const d of dirs) {
    const p = path.join(extRoot, d, "out", "typst.tmLanguage.json");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const tinymist = process.env.TINYMIST_GRAMMAR || findTinymistGrammar();
if (!tinymist) {
  console.error("找不到 Tinymist typst.tmLanguage.json；请安装 Tinymist 或设置 TINYMIST_GRAMMAR");
  process.exit(2);
}

const wasm = fs.readFileSync(
  path.join(root, "node_modules/vscode-oniguruma/release/onig.wasm"),
);
await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

const registry = new vsctm.Registry({
  onigLib: {
    createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
    createOnigString: (s) => new oniguruma.OnigString(s),
  },
  loadGrammar: async (scopeName) => {
    if (scopeName === "source.typst") {
      return vsctm.parseRawGrammar(fs.readFileSync(tinymist, "utf8"), tinymist);
    }
    if (scopeName === "typst-note.injection") {
      const p = path.join(root, "syntaxes/note.injection.json");
      return vsctm.parseRawGrammar(fs.readFileSync(p, "utf8"), p);
    }
    return null;
  },
  getInjections: (scopeName) => {
    if (scopeName === "source.typst") return ["typst-note.injection"];
    return [];
  },
});

const grammar = await registry.loadGrammarWithConfiguration("source.typst", 0, {
  embeddedLanguages: {},
  injectTo: ["source.typst"],
});

/** @param {string} sample */
function collectSecondary(sample) {
  let ruleStack = vsctm.INITIAL;
  const lines = sample.split(/\r?\n/);
  /** @type {string[]} */
  const hits = [];
  for (const line of lines) {
    const r = grammar.tokenizeLine(line, ruleStack);
    ruleStack = r.ruleStack;
    for (const t of r.tokens) {
      const text = line.slice(t.startIndex, t.endIndex);
      const scopes = t.scopes.join(" ");
      if (scopes.includes("markup.editorial.secondary.typst") && text.trim()) {
        hits.push(text);
      }
    }
  }
  return hits;
}

/** @param {string} name @param {string} sample @param {string[]} mustInclude @param {string[]} [mustExclude] */
function assertSample(name, sample, mustInclude, mustExclude = []) {
  const hits = collectSecondary(sample);
  const joined = hits.join("");
  const missing = mustInclude.filter((s) => !joined.includes(s));
  const leaked = mustExclude.filter((s) => joined.includes(s));
  if (missing.length || leaked.length) {
    console.error(`FAIL ${name}`);
    console.error("  secondary:", hits.map((h) => JSON.stringify(h)).join(" "));
    if (missing.length) console.error("  missing:", missing);
    if (leaked.length) console.error("  leaked from comments:", leaked);
    return false;
  }
  console.log(`OK   ${name}`);
  for (const h of hits) {
    console.log("     ", JSON.stringify(h));
  }
  return true;
}

const cases = [
  {
    name: "snt 同行译文/拼音",
    sample: `#snt[古文][译文在此][pīn yīn]
`,
    must: ["译文在此", "pīn", "yīn"],
  },
  {
    name: "snt 跨行译文/拼音",
    sample: `#snt[
  古文正文
][
  跨行译文
][
  kuà háng
]
`,
    must: ["跨行译文", "kuà", "háng"],
  },
  {
    name: "snt(notes:) 跨行 + 轻锚点注文",
    sample: `#snt(notes: (
  [指周代宋国人],
  [],
  [露出地面的树桩],
))[
  #ntw[宋人]#ntj[有耕者]，田中有#ntc[株]。
][
  宋国有个耕田的人，田里有树桩。
][
  sòng rén
]
`,
    must: ["指周代宋国人", "露出地面的树桩", "宋国有个耕田的人", "sòng"],
  },
  {
    name: "nt 注文与 py 拼音",
    sample: `#ntw[建和元年][147 年]
#ntc(ln: 1)[#py[诏][zhào]][帝王的文书命令]
`,
    must: ["147", "zhào", "帝王的文书命令"],
  },
  {
    name: "独立 #py",
    sample: `#py[踧踖][cù jí]
`,
    must: ["cù", "jí"],
  },
  {
    name: "行注释中的宏名不抢匹配",
    sample: `// 这不是调用 #snt[假古文][假译文]
// #snt前加空行可形成分段
#snt[真古文][真译文]
`,
    must: ["真译文"],
    mustNot: ["假译文", "假古文"],
  },
  {
    name: "块内行注释中的 #nt / #snt 不抢匹配",
    sample: `#snt(notes: (
  // 按序与正文 #nt 一一匹配；勿把本行当调用
  // #ntw[假词][假注]
  [真注],
))[
  // 每句一个#snt（sentence）
  // #nt(ln:2, a:"l", o:0em) 默认参数
  古文#nt[实词]
][
  真译文
]
`,
    must: ["真注", "真译文"],
    mustNot: ["假注", "假词", "sentence", "默认参数"],
  },
  {
    name: "块注释中的宏名不抢匹配",
    sample: `#snt[
  古文 /* #snt[x][块内假译] #ntw[假词][块内假注] */
][
  真译文
]
`,
    must: ["真译文"],
    mustNot: ["块内假译", "块内假注"],
  },
];

let ok = true;
for (const c of cases) {
  if (!assertSample(c.name, c.sample, c.must, c.mustNot)) ok = false;
}

// oniguruma WASM 在 Windows 上 process.exit 可能触发 libuv 断言；跳过清理
process.reallyExit(ok ? 0 : 1);
