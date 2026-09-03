# Typst Buddy

为 Tinymist / Typst 源码中行上注的**注文**、`#snt` 的**译文 / 拼音**，以及 `#py` 的**拼音**单独着色。

## 效果

| 写法 | 着色部分 |
|------|----------|
| `#ntw[词语][注释]` | 「注释」 |
| `#ntc(ln: 1)[#py[诏][zhào]][帝王的文书命令]` | 「zhào」「帝王的文书命令」 |
| `#nt[撞]`（仅被注词 / 轻锚点） | 无 |
| `#snt[古文][译文][拼音]`（可跨行） | 「译文」「拼音」 |
| `#snt(notes: ([注1], …))[古文][译文][拼音]` | 「注1」…、「译文」「拼音」 |
| `#py[踧踖][cù jí]` | 「cù jí」 |

默认颜色：`#68559E`。Scope：`markup.editorial.secondary.typst`。

`#snt` 支持跨行古文 / 译文 / 拼音；`notes:` 数组可跨多行；参数分隔符 `][` 可写在同一行，或 `]` 与 `[` 分两行。

## 要求

- [Tinymist](https://marketplace.visualstudio.com/items?itemName=myriad-dreamin.tinymist)（提供 `source.typst` 语法）
- Cursor 或 VS Code ≥ 1.80

## 安装

在本仓库根目录执行：

```powershell
.\install.ps1
```

然后 **Developer: Reload Window** 重载窗口。

可选参数：`-Target Cursor` / `-Target VSCode` / `-Target Both`（默认 Both）。

手动安装：把发布目录（或解压后的 VSIX 内容）复制到：

- Cursor：`%USERPROFILE%\.cursor\extensions\local.typst-buddy-<version>`
- VS Code：`%USERPROFILE%\.vscode\extensions\local.typst-buddy-<version>`

### 打包 VSIX（可选）

```powershell
npm run package
```

生成 `typst-buddy-1.0.0.vsix` 后，在扩展视图选择 **Install from VSIX…**。

## 改颜色

打开设置，搜索 **Typst Buddy**，修改 **Foreground**（带取色器）。

或在 `settings.json` 中：

```json
{
  "typstBuddy.foreground": "#68559E"
}
```

扩展会在打开 `.typ` 时把该颜色同步到 `editor.tokenColorCustomizations`（工作区优先）。

## 开发自检

```powershell
npm install
npm test
```

`tests/` 下的样张（`#snt` / `#nt*` / `#py`）即目标宏约定。

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

## 卸载

删除对应 extensions 目录下的 `local.typst-buddy-*` 文件夹后重载窗口。

## 变更摘要

见 [CHANGELOG.md](CHANGELOG.md)。
