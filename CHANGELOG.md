# Changelog

## Unreleased

- 用 TypeScript 重构扩展源码（`src/` → `out/`）
- 加注 / 去注：与 `#snt(notes: …)` 成对编辑；快捷键 `Ctrl+Shift+N`
- `#snt` 轻锚点与 `notes` 条数不一致时给出诊断

## 1.0.0

- 宏名对齐书稿约定：`#tr` → `#snt`（句下译）
- 支持 `#snt(notes: …)` 跨行命名参数；`notes:` 数组内注文一并着色
- `#py` 第二参（拼音）纳入着色
- 安装脚本路径与文档改为仓库根目录；增加 `npm test` / `npm run package`
- 正式版本号 1.0.0

## 0.1.5

- 行上注注文与 `#tr` 译文 / 拼音着色（本地预览版）
