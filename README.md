# Typst Buddy

团队内部工具。为 Typst / Tinymist 正文、注释、译文、拼音集成排版宏中的各个部分单独着色，并提供便捷操作命令。本扩展依赖 Tinymist。


## 当前版本为 v0.0.5

- 优化拆分 `#snt` 句子的方式，现在必须在正文和译文中插入相同数量的光标

见 [CHANGELOG.md](CHANGELOG.md)。

## 要求

- VS Code ≥ 1.80
- 插件[Tinymist](https://marketplace.visualstudio.com/items?itemName=myriad-dreamin.tinymist)（提供 `source.typst` 语法）

## 效果

| 写法                                         | 着色部分                   |
| -------------------------------------------- | -------------------------- |
| `#ntw[词语][注释]`                           | 「注释」                   |
| `#ntc(ln: 1)[#py[诏][zhào]][帝王的文书命令]` | 「zhào」「帝王的文书命令」 |
| `#nt[撞]`（仅被注词 / 轻锚点）               | 无                         |
| `#snt[古文][译文][拼音]`（可跨行）           | 「译文」「拼音」           |
| `#snt(notes: ([注1], …))[古文][译文][拼音]`  | 「注1」…、「译文」「拼音」 |
| `#py[踧踖][cù jí]`                           | 「cù jí」                  |

默认颜色：`#68559E`。Scope：`markup.editorial.secondary.typst`。

`#snt` 支持跨行古文 / 译文 / 拼音；`notes:` 数组可跨多行；参数分隔符 `][` 可写在同一行，或 `]` 与 `[` 分两行。

## 设置颜色

打开设置，搜索 **Typst Buddy**，修改 **Foreground**（带取色器）。

或在 `settings.json` 中：

```json
{
  "typstBuddy.foreground": "#68559E"
}
```

扩展会在打开 `.typ` 时把该颜色同步到 `editor.tokenColorCustomizations`（工作区优先）。


## 快捷操作

在 `.typ` 中可用命令面板（搜 **Typst Buddy**）、编辑器右键，或快捷键。加注 / 去注会成对改动古文里的轻锚点和 `#snt(notes: …)`，一次撤销即可还原。跳转、拆分、合并见下表。

| 命令                  | 作用                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typst Buddy: add note 加注** | 把选中文字包成 `#nt[…]`。在古文中还会按轻锚点顺序插入空注文 `[],`；该句若还没有 `notes:` 会一并补上。加完后光标落在空的 `[]` 里，便于立刻填写。 |
| **Typst Buddy: clear notes 去注** | 拆掉注释宏、保留被注词。古文轻锚点会同时删掉对应的 `notes` 项。                                                                                 |
| **Typst Buddy: go to pair 跳转到对应注文 / 轻锚点** | 在古文轻锚点与对应 `notes` 项之间跳转；内嵌 `#ntc[词][注]` 则在词、注之间跳转。也可把光标放在被注词上按 F12 / Ctrl+单击（点在 `#nt` 宏名上仍走 Tinymist）。 |
| **Typst Buddy: split snt 拆分 #snt** | 按正文与译文中数量相同的光标切开当前句；`notes` 随轻锚点走，拼音按汉字槽数切开。 |
| **Typst Buddy: merge snt 合并 #snt** | 把当前句与下一句合成一句（已在末句则与上一句合并）。选区跨相邻两句则合并这两句。                                                               |
| **Typst Buddy: collect body 收集正文** | 无选区时收集光标所在 `#ntp` 的古文；有选区则收集与选区相交的 `#ntp`。去掉注释宏，按「`#snt` 前空行」分段。写入剪贴板，并在旁边打开纯文本窗口。 |

**加注**必须先选中要注的字符串。默认宏名为 `#nt`（未分类）；已包在宏里的选区不会再套一层。译文里只加框，不动 `notes:`。拼音块不能加注。

**去注**：

- 无选区：删除光标所在的那一枚宏（点在 `#nt`、参数或 `[词]` 内均可）。光标落在 `notes:` 某一项里时，会连同对应的古文轻锚点一起删。
- 有选区：删除与选区相交的完整宏（部分划到也整枚去掉）。
- 内嵌写法 `#ntc[走][跑]` 只拆宏、丢掉内嵌注文，不改 `notes:`。
- 两枚宏之间的缝里按下去注会提示，以免删错邻注。

**快捷键** `Ctrl+Shift+N`（Typst 编辑器有焦点时；macOS 也是 Control+Shift+N，不占用 Cmd+Shift+N）：

- 已选中且未碰到注释宏 → 加注
- 光标在宏上，或选区碰到宏 → 去注

也可在命令面板分别调用「加注」「去注」。此快捷键在 Typst 源码中会盖过「新建窗口」；若要改绑，打开键盘快捷方式搜索 `typstBuddy.noteShortcut`。

**跳转** `Ctrl+Shift+J`：光标在轻锚点或 `notes` 项上时跳到另一侧。悬停轻锚点会预览对应注文（空项显示 `null`）；悬停注文则预览被注词。光标停在配对上时，两侧会同时高亮。

**拆分 `#snt`**：在正文和译文里放入相同数量的光标（Alt+单击可加光标），每个光标是一处切口，两边按从左到右配对。一句拆成两句时两边各放一个；要拆成多句则两边各放多个。拼音仍按各段正文字数切开，`notes` 按轻锚点落在哪一段分配。没有译文、或译文是空的，就只在正文放光标。不要把光标放在拼音、`notes` 或注释宏中间；任一侧正文或译文被拆空会拒绝。

**合并 `#snt`**：光标在某句中时与下一句合并；已是末句则与上一句合并。两句之间若有非空白内容会拒绝，以免误删夹在中间的文字。

**收集正文**：命令面板或右键「collect body 收集正文」。无选区只收光标所在的那一个 `#ntp`；有选区则收所有与选区相交的 `#ntp`（相交即整段，不只选中的那几句）。只取 `#snt` 第一块（古文），去掉 `#nt*` / `#py` 等宏及源码注释；同一段的句子连成一行，`#snt` 前若有空行则另起一段。多个 `#ntp` 之间空两行。结果同时写入剪贴板，并在侧栏打开纯文本窗口。

### 计数诊断

当 `#snt` 写了 `notes:` 时，扩展会核对古文轻锚点（省略第二块的 `#nt` / `#ntc` 等）与 `notes` 条数。不一致则在 `#snt` 上标错，例如「轻锚点 3 条，notes 2 条」，不必等 Typst 编译报错。未写 `notes:`、仅加框的轻锚点不诊断。

## TODO

- 切换注释类别（`#nt` / `#ntc` / `#ntj` / `#ntw`）
- 循环调整 `ln`、`a`
- 内嵌注文与 `notes` 数组互转
- 扩选到整枚宏

## 开发

源码在 `src/`（TypeScript），`tsc` 编译到 `out/`。本地调试：打开本仓库，按 **F5**（会先 `watch` 编译，再启动扩展开发主机）。`tests/` 下的样张（`#snt` / `#nt*` / `#py`）即目标宏约定。

```
src/extension.ts    激活、命令、诊断、悬停 / 跳转
src/highlight.ts    着色同步到编辑器
src/snt-parse.ts    #snt / #nt* / notes 源码解析
src/snt-edit.ts     加注、去注、计数核对
src/snt-nav.ts      轻锚点 ↔ 注文配对
src/snt-split.ts    拆分 / 合并 #snt
src/ntp-extract.ts  收集 #ntp 古文正文
```

```powershell
npm install
npm run watch
npm test
npm run lint
npm run package
```

| 命令 | 作用 |
|------|------|
| `npm run compile` | 编译一次到 `out/` |
| `npm run watch` | 监视 `src/`，改动后增量编译 |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm test` | 先编译，再跑全部用例 |
| `npm run check` | lint + 全部测试 |
| `npm run package` | 打包 VSIX |
| `npm run clean` | 删除 `out/` |

## 排查

1. 光标放在注文或译文上，运行 **Developer: Inspect Editor Tokens and Scopes**。
2. 应能看到 `markup.editorial.secondary.typst`。
3. 若颜色仍被盖住，可对 Typst 暂时关闭语义高亮：

```json
{
  "[typst]": {
    "editor.semanticHighlighting.enabled": false
  }
}
```

