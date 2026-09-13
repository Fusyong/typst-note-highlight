// 样张共用版式：先保证中文可编译，再逐步加复杂版面
// 用法：
//   #import "lib/book-setup.typ": *
//   #show: setup-book

#let fonts = (
  // 正文：宋体系（本机已装 Noto Serif CJK SC）
  song: ("Noto Serif CJK SC", "Noto Serif SC"),
  // 标题：黑体
  hei: ("Noto Sans CJK SC", "Noto Sans SC"),
  // 注释：仿宋；句下译见 #snt（宋体）
  fang: ("FangSong", "STFangsong", "FZFangSong-Z02S", "Noto Serif CJK SC"),
  // 提示语等：楷体
  kai: ("KaiTi", "FZKaiS-Extended", "Noto Serif CJK SC"),
  // 西文衬线（与 CJK 搭配；见 font-cjk / setup-book）
  latin: ("Libertinus Serif", "New Computer Modern", "Times New Roman"),
  // 正文夹注拼音（声调字母需专用字体）
  pinyin: ("Wukong Pinyin Sans", "Gentium Basic", "Arial"),
)

/// 西文优先 + CJK 回退；covers 避免中西文混排时标点抢西文字形
/// 参见 Typst 0.13+ text.font.covers / "latin-in-cjk"
#let font-cjk(cjk) = (
  ..fonts.latin.map(name => (name: name, covers: "latin-in-cjk")),
  ..cjk,
)

/// 相对字号集合（相对当前 text.size；#ntp 内 1em = 古文大字）
/// 改此处即可统一调整 #snt / #nt / #py 等层级，无需逐处改硬编码
#let sizes = (
  /// 古文正文（#ntp）
  body: 2em,
  /// 句下译（#snt 译文）
  yi: 0.5em,
  /// 行上注文、头上拼音（#nt / #py）
  note: 0.44em,
  /// 【注释】区块（#notes）
  notes: 0.88em,
  /// 独立译文区块（#translation）
  translation: 1em,
  /// 文档默认行间空隙（setup-book）。Typst 的 leading 是「上一行底边→下一行顶边」，
  /// 不是基线距。在 top-edge: 1em、bottom-edge: 0em 时：基线距 = 1em + leading。
  /// 取 0.5em → 基线距 1.5em（与段间距 spacing 同值）。
  doc-leading: 0.5em,
  /// 正文行间空隙（相对 body；#ntp 专用，不受文档默认影响）
  /// #ntp 亦固定 top-edge: 1em / bottom-edge: 0pt，故基线距 = 1em + body-leading
  body-leading: 1.2em,
  /// 拼音/注文与底字间距
  note-gap: 0.08em,
  /// 注文多行行距
  note-leading: 0.2em,
)

/// 印刷用 CMYK 色板（正文墨色；#nt 框线仅用 c / g）
#let colors = (
  ink: cmyk(0%, 0%, 0%, 100%),
  c: cmyk(100%, 0%, 0%, 0%),
  m: cmyk(0%, 100%, 0%, 0%),
  y: cmyk(0%, 0%, 100%, 0%),
  g: cmyk(0%, 0%, 0%, 50%),
  chocolate: cmyk(0%, 60%, 0%, 80%),
  olive: cmyk(0%, 0%, 80%, 80%),
  turquoise: cmyk(100%, 0%, 0%, 50%),
  /// #bz 便签浅黄底
  sticky: cmyk(0%, 6%, 28%, 0%),
  /// 练习题隐藏答案（全透明，可透印）
  exercise-hidden: rgb(0%, 0%, 0%, 0%),
  /// 练习题调试色（深红；#exercise-debug 打开时替代隐藏色）
  exercise-debug: cmyk(0%, 95%, 90%, 25%),
)

/// #snt 调试序号（整篇递增，便于 --input snt-debug-i=N 定点）
#let _snt-debug-seq = counter("snt-debug-seq")

/// 译文调试记录累积（assert 模式在文末一次性打出，避免只看到第一条）
#let _snt-debug-log = state("snt-debug-log", ())

/// 译文调试模式（CLI：`--input snt-debug=meta|assert|suspect`）
/// - 0 / 缺省：关闭
/// - meta：写入 metadata，供 `typst query` 导出（不中断编译）
/// - assert：编译结束前用 assert 把全部/筛选后的记录打到控制台
/// - suspect：仅当启发式判定「疑似错位」时 assert
/// 筛选：`--input snt-debug-page=3`、`--input snt-debug-i=5`（可并用）
#let _snt-debug-mode() = {
  let m = sys.inputs.at("snt-debug", default: "0")
  if m == "0" or m == "" or m == "false" or m == "off" { "0" } else { m }
}

#let _snt-debug-on() = _snt-debug-mode() != "0"

#let _fmt-pt(x) = {
  if type(x) == length {
    str(calc.round(x.to-absolute().pt(), digits: 3)) + "pt"
  } else if type(x) == ratio {
    repr(x)
  } else {
    repr(x)
  }
}

#let _fmt-ys(ys) = {
  if ys.len() == 0 {
    "(none)"
  } else {
    ys.map(pt => "p" + str(pt.page) + "@" + _fmt-pt(pt.y)).join(", ")
  }
}

#let _snt-debug-flush() = context {
  let mode = _snt-debug-mode()
  if mode == "assert" or mode == "suspect" {
    let rows = _snt-debug-log.get()
    if rows.len() > 0 {
      let body = rows.join("\n\n==========\n\n")
      assert(
        false,
        message: "snt-debug (" + mode + ") 共 " + str(rows.len()) + " 条：\n\n" + body,
      )
    } else if mode == "assert" {
      assert(
        false,
        message: "snt-debug (assert)：无记录。若用了 snt-debug-page 筛选，请核对页码，或改用 snt-debug=meta。",
      )
    }
    // suspect 且 0 条：视为通过，不中断
  }
}

/// #ntp 流水号（auto id；step 必须进入文档流）
#let _ntp-seq = counter("ntp-seq")

/// 正文区块记录版心几何（提前声明，供 #bz 的 page.background 按 location 读取）
/// - stride：稳定回退行距；续行对齐由 #snt 按 ntp-id query body-y
/// - ntp-id：本段隔离键
#let _snt-region = state(
  "snt-region",
  (left: 0pt, width: 0pt, stride: 0pt, ntp-id: none, line-ys: ()),
)

/// 连线题正解线绘制（页背景用；完整 #lx 在文末再导出）
#import "lx.typ": lx-paint-lines

/// #bz：流内仅 metadata（完全不占位）；由 page.background 绘制
#let _bz-paint-page() = context {
  let page-n = here().page()
  for m in query(metadata) {
    let v = m.value
    if type(v) != dictionary or v.at("kind", default: none) != "bz" {
      continue
    }
    let loc = m.location()
    let pos = loc.position()
    if pos.page != page-n {
      continue
    }
    let region = _snt-region.at(loc)
    let text-left = if region.left > 0pt { region.left } else { pos.x }
    let full-w = if region.width > 1pt {
      region.width
    } else {
      calc.max(page.width - 2 * text-left, 100pt)
    }
    let text-right = text-left + full-w
    let size = v.size
    let size-abs = size.to-absolute()
    // auto → 25×便签字号；显式长度按当前 context 绝对化
    let w = if v.width == auto { 25 * size-abs } else { v.width.to-absolute() }
    let o-abs = v.o.to-absolute()
    let dy-abs = v.dy.to-absolute()
    let styled = {
      set text(
        lang: "zh",
        region: "CN",
        font: font-cjk(fonts.fang),
        size: size,
        fill: colors.ink,
        top-edge: "ascender",
        bottom-edge: "descender",
      )
      set par(leading: 0.35em, justify: false, first-line-indent: 0pt)
      v.body
    }
    let card = box(
      width: w,
      fill: v.fill,
      radius: v.radius,
      inset: v.inset,
      clip: false,
      styled,
    )
    let card-m = measure(card)
    let locked = box(
      width: card-m.width,
      height: card-m.height,
      clip: false,
      {
        set align(top + left)
        card
      },
    )
    // 顶对齐：右缘贴版心右缘；上沿相对锚点（内置 -2em 贴行顶，dy 再调）
    let dx = text-right - page.width + o-abs
    let y = pos.y + dy-abs - 2em.to-absolute()
    place(top + right, dx: dx, dy: y, locked)
  }
}

/// 文档设置：纸张、基准字体字号、中文排版默认
/// 用法：`#show: setup-book` 或 `#show: setup-book.with(size: 12pt)`
/// - 默认开本 215×297mm（现样张）；基准 10.5pt（五号），#ntp 2em ≈ 21pt
/// - 边距默认 auto（约页短边的 2.5/21）；可传字典如 `(x: 2cm, y: 2.5cm)`
/// - 默认基线距 1.5em：固定字盒 `top-edge: 1em` / `bottom-edge: 0em`，
///   `par.leading = par.spacing = 0.5em`（见 `sizes.doc-leading`）；`#ntp` 仍用
///   `sizes.body-leading`，不受此影响
#let setup-book(
  width: 210mm,
  height: 297mm,
  margin: auto,
  size: 12pt,
  font: auto,
  lang: "zh",
  region: "CN",
  justify: true,
  leading: auto,
  doc,
) = {
  // 调试时可 `--input page-width=210mm` 覆盖开本宽度，无需改样张
  let width = if "page-width" in sys.inputs {
    eval(sys.inputs.at("page-width"), mode: "code")
  } else {
    width
  }
  let leading = if leading == auto { sizes.doc-leading } else { leading }
  set page(
    width: width,
    height: height,
    margin: margin,
    // #bz 便签 + 连线题正解线画在底层，正文叠其上
    background: {
      _bz-paint-page()
      lx-paint-lines()
    },
  )
  // 固定字盒，使基线距 = 1em + leading，不随字体 metrics 漂移
  // （官方：baseline = top-edge − bottom-edge + leading）
  set text(
    lang: lang,
    region: region,
    size: size,
    font: if font == auto { font-cjk(fonts.song) } else { font },
    cjk-latin-spacing: auto,
    top-edge: 1em,
    bottom-edge: 0em,
  )
  // leading / spacing 同值 → 段内行距与段间距基线距一致；
  // 首行缩进区分段落时，block 间距单独保留默认量级，避免标题等过紧
  set par(
    justify: justify,
    first-line-indent: (amount: 2em, all: true),
    leading: leading,
    spacing: leading,
  )
  set block(spacing: 1.2em)
  // 着重（*…* / strong）改为汉字下加点，西文仍走 strong 默认
  show strong: content => {
    show regex("\p{Hani}"): it => box(
      place(text("·", size: 0.8em), dx: 0.375em, dy: 0.75em) + it,
    )
    content.body
  }
  doc
  // 文末冲刷译文调试日志到控制台（仅 snt-debug=assert|suspect）
  _snt-debug-flush()
}

/// #nt 框线色键：仅 "c" | "g"（其余回退为 g）
#let _nt-stroke-color(c) = {
  if c == "c" { colors.c } else { colors.g }
}

/// #nt 框线样式：solid | dashed | dotted | dash-dotted
#let _nt-stroke-dash(dash) = {
  if dash == "dashed" or dash == "dotted" or dash == "dash-dotted" {
    dash
  } else {
    "solid"
  }
}

/// 确保 block 内形成段落，两端对齐与标点挤压才会生效
#let _as-par(body) = {
  body
  parbreak()
}

/// 正文基线距回退：在 top-edge: 1em / bottom-edge: 0 时 = 1em + par.leading
#let _body-stride() = 1em.to-absolute() + par.leading.to-absolute()

/// 仅 sizes 推得的正文基线距（不含行上注/拼音抬高）
#let _sizes-body-stride() = {
  let from-style = _body-stride()
  let from-sizes = sizes.body.to-absolute() + sizes.body-leading.to-absolute()
  if from-style > 30pt { from-style } else { from-sizes }
}

/// 无实测时的行距回退：按「注文约两行 + 拼音层」估，宁可略松，避免叠进正文
#let _ntp-stride-fallback() = {
  let base = _sizes-body-stride()
  let note-h = measure({
    set text(
      font: fonts.fang,
      size: sizes.note,
      top-edge: "ascender",
      bottom-edge: "descender",
      overhang: false,
    )
    [国]
  }).height
  calc.max(
    base + 2 * note-h + sizes.note-gap.to-absolute() + 0.25 * sizes.body.to-absolute(),
    1.9 * base,
  )
}

/// 从本段 body-y 取典型正间距（同页相邻行中位数；忽略过近伪标记）
#let _stride-from-ys(ys) = {
  let gaps = ()
  if ys.len() >= 2 {
    for i in range(ys.len() - 1) {
      let a = ys.at(i)
      let b = ys.at(i + 1)
      if a.page == b.page {
        let d = b.y - a.y
        // 正文行距通常 > 正文身 + leading；过近多为振荡重复标记
        if d > 55pt {
          gaps.push(d)
        }
      }
    }
  }
  if gaps.len() == 0 {
    none
  } else {
    let sorted = gaps.sorted()
    sorted.at(calc.div-euclid(sorted.len(), 2))
  }
}

/// 译文行距回退（仅首遍尚无 body-y，或续行超出已测行时用）
#let _ntp-stride(ys: ()) = {
  let measured = _stride-from-ys(ys)
  if measured != none { measured } else { _ntp-stride-fallback() }
}

/// 将 body-y 标记列表收成 (page, y) 序列
#let _line-ys-reduce(marks) = {
  // 按行号去重（同一 n 只留首次），并记下页码
  let by-n = (:)
  for m in marks {
    let n = m.value.at("n", default: none)
    if n != none {
      let key = str(n)
      if by-n.at(key, default: none) == none {
        let p = m.location().position()
        by-n.insert(key, (page: p.page, y: p.y))
      }
    }
  }
  let keys = by-n.keys().map(int).sorted()
  let raw = keys.map(k => by-n.at(str(k)))
  // 页内合并过近标记（振荡时常出现 ~40pt 伪行）；换页时 y 变小，绝不能当成「过近」丢掉
  let merge-gap = 55pt
  let ys = ()
  for pt in raw {
    let keep = if ys.len() == 0 {
      true
    } else {
      let prev = ys.last()
      pt.page != prev.page or pt.y - prev.y > merge-gap
    }
    if keep {
      ys.push(pt)
    }
  }
  ys
}

/// 按 ntp-id 取 body-y（同页多段互不串；供译文续行对齐实际行高）
#let _line-ys-from-meta(ntp-id) = {
  if ntp-id == none {
    ()
  } else {
    let marks = query(metadata).filter(m => {
      let v = m.value
      type(v) == dictionary and v.at("kind", default: none) == "body-y" and v.at("id", default: none) == ntp-id
    })
    _line-ys-reduce(marks)
  }
}

/// 在 all-ys 中找当前锚点所在行：优先「不晚于 pos.y」的最近行，避免误配到下一行
#let _yi-line-index(all-ys, page, y) = {
  if all-ys.len() == 0 {
    0
  } else {
    let best = 0
    let best-d = none
    for (j, pt) in all-ys.enumerate() {
      if pt.page != page {
        continue
      }
      // 略低于锚点的行也允许（测量误差）；明显更大的 y 视为下一行
      if pt.y > y + 8pt {
        continue
      }
      let d = calc.abs(pt.y - y)
      if best-d == none or d < best-d {
        best = j
        best-d = d
      }
    }
    if best-d == none {
      // 本页没有 ≤ y 的标记：退回全局最近
      let best2 = 0
      let best-d2 = none
      for (j, pt) in all-ys.enumerate() {
        let d = if pt.page == page { calc.abs(pt.y - y) } else { calc.abs(pt.y - y) + 10000pt }
        if best-d2 == none or d < best-d2 {
          best2 = j
          best-d2 = d
        }
      }
      best2
    } else {
      best
    }
  }
}

/// 译文第 i 行相对锚点的 dy
/// - 第 0 行：恒为 dy0（跟当前活锚点）
/// - 续行：累加 body-y 相邻差分（相对量＝各行正文+注+拼实际总高）；不要求 ys[k]≈pos0
/// - 差分不可用时用偏松的 fallback，避免译文叠进下一行正文
#let _yi-line-dy(all-ys, k, i, pos-y, dy0, fallback-stride) = {
  if i == 0 {
    dy0
  } else {
    let sum = 0pt
    let ok = k + i < all-ys.len()
    if ok {
      for j in range(i) {
        let a = all-ys.at(k + j)
        let b = all-ys.at(k + j + 1)
        if a.page != b.page {
          ok = false
          break
        }
        let d = b.y - a.y
        if d <= 55pt {
          ok = false
          break
        }
        sum += d
      }
    }
    if ok {
      dy0 + sum
    } else {
      i * fallback-stride + dy0
    }
  }
}

/// 注·译·拼集成段落（楷体大字；可含连续段落与 #snt / #nt / #py）
/// - id：默认 auto（内部流水 ntp-N）；也可手写字符串。body-y / region 一律带此 id，同页多段互不串
/// - 版心宽度须用实测 text-left（page.width - 2*text-left），与 #snt 锚点一致；
///   勿改用 page.margin，实测左缘常大于名义边距，用边距会算得过宽导致译文不断行
#let ntp(body, id: auto) = {
  // [#step#context] 保证 counter 步进进入文档流后再 get
  [#_ntp-seq.step()#context {
    let ntp-id = if id == auto {
      "ntp-" + str(_ntp-seq.get().first())
    } else {
      id
    }
    // 上一遍本段 body-y；若本段已有可用缓存则冻结，减轻振荡
    let prev-ys = _line-ys-from-meta(ntp-id)
    set text(
      font: font-cjk(fonts.kai),
      size: sizes.body,
      fill: colors.chocolate,
      top-edge: 1em,
      bottom-edge: 0pt,
    )
    set par(
      justify: true,
      first-line-indent: (amount: 2em, all: true),
      leading: sizes.body-leading,
      spacing: sizes.body-leading,
    )
    let text-left = here().position().x
    let full-w = page.width - 2 * text-left
    let cached = _snt-region.get()
    let line-ys = if (
      cached.at("ntp-id", default: none) == ntp-id
        and cached.at("line-ys", default: ()).len() >= 2
        and prev-ys.len() == cached.line-ys.len()
    ) {
      // 行数不变则冻结，避免 73↔90 间来回抖
      cached.line-ys
    } else if prev-ys.len() >= 2 {
      prev-ys
    } else {
      cached.at("line-ys", default: ())
    }
    let stride0 = {
      let m = _stride-from-ys(line-ys)
      if m != none { m } else { _ntp-stride-fallback() }
    }
    _snt-region.update((
      left: text-left,
      width: full-w,
      stride: stride0,
      ntp-id: ntp-id,
      line-ys: line-ys,
    ))
    if _snt-debug-on() {
      let p = here().position()
      metadata((
        kind: "ntp-debug",
        page: p.page,
        x: p.x,
        y: p.y,
        text-left: text-left,
        full-w: full-w,
        stride: stride0,
        page-w: page.width,
        prev-ys: line-ys,
        prev-ys-len: line-ys.len(),
        id: ntp-id,
      ))
    }
    block(
      width: 100%,
      breakable: true,
      inset: (top: 0.6em, bottom: 0.4em),
      {
        context {
          let block-left = here().position().x
          _snt-region.update(r => (
            left: block-left,
            width: r.width,
            stride: r.stride,
            ntp-id: r.ntp-id,
            line-ys: r.line-ys,
          ))
        }
        set par.line(
          numbering: n => {
            metadata((kind: "body-y", id: ntp-id, n: n))
            []
          },
          number-clearance: 0pt,
        )
        _as-par(body)
      },
    )
  }]
}

/// 注释区块（后文可换成脚注 / 旁注 / 夹注）
#let notes(body) = {
  set text(font: font-cjk(fonts.fang), size: sizes.notes)
  set par(justify: true, first-line-indent: 0pt, leading: 0.7em)
  block(
    width: 100%,
    inset: (top: 0.6em, bottom: 0.4em),
    // stroke: (top: 0.4pt + luma(180)),
    _as-par(body),
  )
}

/// 译文区块
#let translation(body) = {
  set text(font: font-cjk(fonts.fang), size: sizes.translation)
  set par(
    justify: true,
    first-line-indent: (amount: 2em, all: true),
    leading: 0.8em,
  )
  block(width: 100%, inset: (top: 0.4em, bottom: 0.6em), _as-par(body))
}

/// 若 content 为 #py/#nt 节点（metadata 或 metadata+绘制），返回其数据字典。
/// 仅识别「纯」注音/夹注节点；`[#py[应]诏]`、`[#py[辩]#py[慧]]` 等混合序列
/// 不得收成首个子节点，否则会丢掉后续汉字。
#let _annot-payload(it) = {
  if type(it) != content {
    none
  } else if it.func() == metadata {
    let v = it.value
    if type(v) == dictionary {
      let k = v.at("kind", default: none)
      if k == "py" or k == "nt" { v } else { none }
    } else {
      none
    }
  } else if it.has("children") {
    let cs = it.children
    // 仅展开 [#metadata#绘制] 这一对；长度 >2 或首子不是 metadata 则非纯节点
    if cs.len() >= 1 and cs.len() <= 2 and cs.first().func() == metadata {
      let v = _annot-payload(cs.first())
      if v != none and (cs.len() == 1 or _annot-payload(cs.at(1)) == none) {
        v
      } else {
        none
      }
    } else {
      none
    }
  } else {
    none
  }
}

/// 从 content / str 提取纯文本（仅用于测定目标行宽）
#let _plain-text(it) = {
  if type(it) == str {
    it
  } else if it == none {
    ""
  } else if type(it) == content {
    let payload = _annot-payload(it)
    if payload != none {
      // #nt / #py：只取被注词／底字，不含注文；避免与绘制副本重复计数
      _plain-text(payload.word)
    } else if repr(it.func()) == "space" {
      // 源码换行常收成 space；不可丢成 ""，否则拼音行衔接处会黏连
      " "
    } else if it.has("text") {
      it.text
    } else if it.has("children") {
      // 空 content（如注文 []）的 children.join() 为 none，需落成 ""
      let s = it.children.map(_plain-text).join()
      if s == none { "" } else { s }
    } else if it.has("body") {
      _plain-text(it.body)
    } else {
      ""
    }
  } else {
    str(it)
  }
}

/// 行首禁则（避头点）：不可出现在行首的字/标点（与 Typst CJK / CLREQ 常见集对齐）
#let _yi-head-prohibited-chars = "，、。．；：？！%）］｝》」』】〉ゝゞー〞〟’”".clusters()
/// 行末禁则（避尾点）：不可出现在行末的字/标点
#let _yi-end-prohibited-chars = "（［｛《「『【〈“‘".clusters()

#let _yi-atom-clusters(atom) = {
  if type(atom) == str {
    atom.clusters()
  } else {
    _plain-text(atom).clusters()
  }
}

#let _yi-no-break-before(atom) = {
  let cs = _yi-atom-clusters(atom)
  cs.len() > 0 and _yi-head-prohibited-chars.contains(cs.at(0))
}

#let _yi-no-break-after(atom) = {
  let cs = _yi-atom-clusters(atom)
  cs.len() > 0 and _yi-end-prohibited-chars.contains(cs.at(cs.len() - 1))
}

/// 按版心宽把译文原子拆成行（首行可用宽 = full-w - first-indent，其后 full-w）
/// - atoms：字簇（str）可断；#nt 整段不可断
/// - fits-one-line(slice, width)：用 Typst 段落测定「能否单行排下」（与正文同一套折行引擎）
/// - 在测定结果上再应用行首/行末禁则，避免标点落行首（避头点）
/// 返回每行已 join 的 content（可含 #nt）
#let _yi-break-atoms(atoms, fits-one-line, first-indent, full-w) = {
  if atoms.len() == 0 {
    ()
  } else {
    let lines = ()
    let i = 0
    let first = true
    let n = atoms.len()
    while i < n {
      let width = if first {
        calc.max(full-w - first-indent, 1pt)
      } else {
        full-w
      }
      // 用引擎测定贪心拉长：与正文同一套 linebreak（含 CJK 规则）
      let j = i + 1
      while j <= n and fits-one-line(atoms.slice(i, j), width) {
        j += 1
      }
      let end = if j == i + 1 { j } else { j - 1 }

      // 避头点：不可在禁则字前断行——能放下则吸入本行，否则连同前字一并挪到下行
      while end < n and end > i and _yi-no-break-before(atoms.at(end)) {
        let try-end = end + 1
        if fits-one-line(atoms.slice(i, try-end), width) {
          end = try-end
        } else {
          while end > i and _yi-no-break-before(atoms.at(end)) {
            end -= 1
          }
          break
        }
      }

      // 避尾点：行末勿留开括号等
      while end > i + 1 and _yi-no-break-after(atoms.at(end - 1)) {
        end -= 1
      }

      if end <= i {
        end = i + 1
      }

      lines.push(atoms.slice(i, end).join())
      i = end
      first = false
    }
    lines
  }
}

/// 纯文本折行（无 #nt 时的简便入口；内部转成字簇原子）
#let _yi-break-lines(plain, fits-one-line, first-indent, full-w) = {
  let atoms = if type(plain) == str { plain.clusters() } else { () }
  _yi-break-atoms(atoms, fits-one-line, first-indent, full-w)
}

/// 是否为可剥除的空白节点（空格、换行、空段等）
#let _is-blank-node(c) = {
  if c == [ ] or c == [] {
    true
  } else {
    let tag = repr(c)
    tag == "space" or tag.starts-with("linebreak") or tag.starts-with("parbreak")
  }
}

/// 去掉 content / str 开头空白与空行（markup 缩进、块首换行会变成字前空格，导致锚点错位）
#let _trim-start(body) = {
  if type(body) == str {
    body.trim(at: start)
  } else if type(body) == content {
    if body.has("text") {
      body.text.trim(at: start)
    } else if body.has("children") {
      let cs = body.children
      let i = 0
      while i < cs.len() {
        let c = cs.at(i)
        if type(c) == content and c.has("text") {
          let t = c.text.trim(at: start)
          if t.len() == 0 {
            i += 1
          } else if t.len() < c.text.len() {
            return (t, ..cs.slice(i + 1)).join()
          } else {
            break
          }
        } else if _is-blank-node(c) {
          i += 1
        } else {
          break
        }
      }
      if i == 0 {
        body
      } else if i >= cs.len() {
        []
      } else {
        cs.slice(i).join()
      }
    } else if body.has("body") {
      _trim-start(body.body)
    } else {
      body
    }
  } else {
    body
  }
}

/// 去掉 content / str 末尾空白与空行
#let _trim-end(body) = {
  if type(body) == str {
    body.trim(at: end)
  } else if type(body) == content {
    if body.has("text") {
      body.text.trim(at: end)
    } else if body.has("children") {
      let cs = body.children
      let j = cs.len()
      while j > 0 {
        let c = cs.at(j - 1)
        if type(c) == content and c.has("text") {
          let t = c.text.trim(at: end)
          if t.len() == 0 {
            j -= 1
          } else if t.len() < c.text.len() {
            return (..cs.slice(0, j - 1), t).join()
          } else {
            break
          }
        } else if _is-blank-node(c) {
          j -= 1
        } else {
          break
        }
      }
      if j >= cs.len() {
        body
      } else if j == 0 {
        []
      } else {
        cs.slice(0, j).join()
      }
    } else if body.has("body") {
      _trim-end(body.body)
    } else {
      body
    }
  } else {
    body
  }
}

/// 去掉 content / str 首尾空白与空行（正文 / 译文 / 拼音解析共用）
#let _trim(body) = _trim-end(_trim-start(body))

/// 是否为行分隔节点。
/// Typst 常把源码中的单换行收成 space，空行收成 parbreak；均视为行界。
/// 行内音节空格在 text 节点字符串内部，不会变成独立 space 节点。
#let _is-line-sep-node(c) = {
  if type(c) != content {
    false
  } else if c == [] {
    true
  } else {
    let f = repr(c.func())
    f == "space" or f.starts-with("linebreak") or f.starts-with("parbreak")
  }
}

/// 字符串是否仅由空白字符构成（含空格、制表、全角空格等 Unicode 空白）
#let _is-blank-string(s) = {
  type(s) == str and s.match(regex("^\s*$")) != none
}

/// 一行是否为空行（无内容，或仅空白字符）
#let _is-blank-line(piece) = {
  piece == none or piece == [] or _is-blank-string(_plain-text(piece))
}

/// 将 body 按换行拆成行；每行再 _trim；空白行（含仅空白字符的行）丢掉
#let _split-content-lines(body) = {
  if type(body) == str {
    body
      .split(regex("\r\n|\r|\n"))
      .map(l => l.trim())
      .filter(l => not _is-blank-string(l))
  } else if type(body) != content {
    let s = str(body).trim()
    if _is-blank-string(s) { () } else { (s,) }
  } else if body.has("text") {
    body.text
      .split(regex("\r\n|\r|\n"))
      .map(l => l.trim())
      .filter(l => not _is-blank-string(l))
  } else if body.has("children") {
    let lines = ()
    let cur = ()
    for c in body.children {
      if _is-line-sep-node(c) {
        if cur.len() > 0 {
          let piece = _trim(cur.join())
          if not _is-blank-line(piece) {
            lines.push(piece)
          }
          cur = ()
        }
      } else if type(c) == content and c.has("text") and c.text.match(regex("[\r\n]")) != none {
        // 同一 text 节点内含换行：拆开；中间的空白行视为空行
        let parts = c.text.split(regex("\r\n|\r|\n"))
        for (pi, part) in parts.enumerate() {
          if pi > 0 {
            if cur.len() > 0 {
              let piece = _trim(cur.join())
              if not _is-blank-line(piece) {
                lines.push(piece)
              }
              cur = ()
            }
          }
          if not _is-blank-string(part) {
            cur.push(part)
          }
        }
      } else {
        cur.push(c)
      }
    }
    if cur.len() > 0 {
      let piece = _trim(cur.join())
      if not _is-blank-line(piece) {
        lines.push(piece)
      }
    }
    lines
  } else if body.has("body") {
    _split-content-lines(body.body)
  } else {
    if _is-blank-line(body) { () } else { (body,) }
  }
}

/// 先去首尾空行/空白，再将多行拼成一行（仅空白字符的行也视为空行丢掉）
/// - sep: 行与行之间的拼接符；正文/译文用 ""，拼音用 " "
/// - 拼音：每行先去掉首尾空白，再在拼接处加入恰好一个空格
#let _flatten-to-one-line(body, sep: "") = {
  let lines = _split-content-lines(_trim(body))
  if lines.len() == 0 {
    []
  } else if lines.len() == 1 {
    lines.at(0)
  } else if sep == "" {
    lines.join()
  } else {
    // 拼音等：统一成去首尾空白的纯文本，再以单个空格拼接（避免 content join 丢空格）
    lines.map(ln => _plain-text(ln).trim()).filter(s => not _is-blank-string(s)).join(sep)
  }
}

/// 是否为需占拼音槽的汉字（标点、数字、拉丁字母等均跳过）
#let _is-han(ch) = ch.match(regex("\p{Han}")) != none

/// 解析第三参拼音：单空格分音节；连续两空格产生空槽（省略该字拼音）
#let _parse-yin-slots(yin) = {
  if yin == none {
    none
  } else {
    // 多行已在 _flatten-to-one-line 中按空格拼好；此处只规整残余换行
    let s = _plain-text(yin).replace(regex("[\n\t\r]+"), " ").trim()
    if s.len() == 0 {
      ()
    } else {
      s.split(" ")
    }
  }
}

/// 拼音内容：按空格分音节后横向拼接，避免段落在窄宽下把多音节竖折
#let _py-reading-line(reading, size: sizes.note, c: "c") = {
  let reading-color = colors.at(c, default: colors.c)
  let parts = _plain-text(reading).split(" ").filter(s => s != "")
  set text(
    font: fonts.pinyin,
    weight: "light",
    size: size,
    fill: reading-color,
    top-edge: "ascender",
    bottom-edge: "descender",
  )
  {
    for (i, s) in parts.enumerate() {
      if i > 0 { h(0.18em) }
      s
    }
  }
}

/// 头上注音绘制（供 #py 与 #snt 第三参共用）
/// - 零宽锚点叠在汉字前，底字仍走正文流
/// - 拼音与汉字之间 wj 禁止断行；拼音比字宽时左右撑开字距
/// - 多音节拼音同一行横排（放置时固定测定宽度，防止零宽父盒内再竖折）
/// - c：拼音色键，默认 "c"
#let _py-render(
  word,
  reading,
  size: sizes.note,
  gap: sizes.note-gap,
  c: "c",
) = context {
  set par.line(numbering: none)
  let reading-line = _py-reading-line(reading, size: size, c: c)
  let band-h = measure({
    set text(
      font: fonts.fang,
      size: size,
      top-edge: "ascender",
      bottom-edge: "descender",
      overhang: false,
    )
    [国]
  }).height
  // 在无限宽下测定，得到真正的单行宽高
  let reading-m = measure(reading-line)
  let word-m = measure(word)
  let gap-abs = gap.to-absolute()
  let total-h = band-h + gap-abs + word-m.height
  let side = calc.max((reading-m.width - word-m.width) / 2, 0pt)
  let note-dx = side + (word-m.width - reading-m.width) / 2

  // 零宽抬高本行；place 内用固定宽盒子锁住单行，避免继承 0 宽后竖折
  box(width: 0pt, height: total-h, baseline: bottom)[
    #place(
      top + left,
      dx: note-dx,
      dy: (band-h - reading-m.height) / 2,
      box(width: reading-m.width, height: reading-m.height, clip: false, reading-line),
    )
  ]
  sym.wj
  if side > 0pt { h(side) }
  sym.wj
  word
  if side > 0pt { h(side) }
}

/// #py 节点：metadata（供 #snt 遍历）+ 实际绘制（metadata 本身不可见）
#let _py-node(word, reading, size: sizes.note, gap: sizes.note-gap, c: "c") = {
  [#metadata((
      kind: "py",
      word: word,
      reading: reading,
      size: size,
      gap: gap,
      c: c,
    ))#_py-render(word, reading, size: size, gap: gap, c: c)]
}

/// 测定注文排式目标宽度：按指定行数均分自然宽度，并加约 0.75 字余量（禁则）；至少约 2 字宽。
#let _note-flow-width(chars, measure-note, lines: 1) = {
  let n = chars.len()
  if n == 0 {
    0pt
  } else {
    let note-full = measure-note(chars.join()).width
    let line-count = calc.max(1, lines)
    if line-count == 1 {
      note-full
    } else {
      let char-w = measure-note("国").width
      let target = note-full / line-count + 0.75 * char-w
      let min-chars = calc.min(2, n)
      let min-w = measure-note(chars.slice(0, min-chars).join()).width
      calc.max(target, min-w)
    }
  }
}

/// 将夹注被注词展平为 (reading, body, …) 段，供统一描边
#let _nt-frame-parts(word) = {
  let kind-of(it) = {
    let p = _annot-payload(it)
    if p == none { none } else { p.at("kind") }
  }
  let walk(it) = {
    if type(it) == str {
      if it == "" { () } else { ((reading: none, body: it, size: sizes.note, gap: sizes.note-gap, c: "c"),) }
    } else if type(it) != content {
      ((reading: none, body: it, size: sizes.note, gap: sizes.note-gap, c: "c"),)
    } else if kind-of(it) == "py" {
      let v = _annot-payload(it)
      (
        (
          reading: v.reading,
          body: v.word,
          size: v.at("size", default: sizes.note),
          gap: v.at("gap", default: sizes.note-gap),
          c: v.at("c", default: "c"),
        ),
      )
    } else if it.has("text") {
      if it.text == "" { () } else {
        ((reading: none, body: it, size: sizes.note, gap: sizes.note-gap, c: "c"),)
      }
    } else if it.has("children") {
      let out = ()
      let children = it.children
      let j = 0
      while j < children.len() {
        let ch = children.at(j)
        if kind-of(ch) == "py" {
          out += walk(ch)
          j += 1
          if ch.func() == metadata and j < children.len() and kind-of(children.at(j)) == none {
            j += 1
          }
        } else {
          out += walk(ch)
          j += 1
        }
      }
      out
    } else if it.has("body") {
      walk(it.body)
    } else {
      ((reading: none, body: it, size: sizes.note, gap: sizes.note-gap, c: "c"),)
    }
  }
  walk(word)
}

/// 给被注词描边：拼音零宽锚点按字宽累加偏移叠在框外，底字一次 highlight 连成一框。
/// 整段包在不可断行 box 内，避免夹注跨行时拼音仍留在上行（与底字错位）。
#let _nt-apply-frame(word, frame) = {
  let parts = _nt-frame-parts(word)
  if parts.len() == 0 {
    word
  } else {
    let base = parts.map(p => p.body).join()
    let has-py = parts.any(p => p.reading != none)
    if not has-py {
      frame(base)
    } else {
      context {
        set par.line(numbering: none)
        let widths = parts.map(p => measure(p.body).width)
        let styled = parts.map(p => {
          if p.reading == none {
            none
          } else {
            let body = _py-reading-line(p.reading, size: p.size, c: p.c)
            let band-h = measure({
              set text(
                font: fonts.fang,
                size: p.size,
                top-edge: "ascender",
                bottom-edge: "descender",
                overhang: false,
              )
              [国]
            }).height
            let rm = measure(body)
            let gap-abs = p.gap.to-absolute()
            let total-h = band-h + gap-abs + measure(p.body).height
            (body: body, rm: rm, band-h: band-h, total-h: total-h)
          }
        })
        let max-h = 0pt
        for s in styled {
          if s != none {
            max-h = calc.max(max-h, s.total-h)
          }
        }
        // 不可断：夹注与其头上拼音整段换行，保持一一对齐
        box({
          box(width: 0pt, height: max-h, baseline: bottom)[
            #let x = 0pt
            #for (i, p) in parts.enumerate() {
              let s = styled.at(i)
              if s != none {
                place(
                  top + left,
                  dx: x + (widths.at(i) - s.rm.width) / 2,
                  dy: (s.band-h - s.rm.height) / 2,
                  box(width: s.rm.width, height: s.rm.height, clip: false, s.body),
                )
              }
              x += widths.at(i)
            }
          ]
          sym.wj
          frame(base)
        })
      }
    }
  }
}

/// 行上注实际绘制
/// 被注词用 highlight 描边（可跨行断框；若内嵌拼音则整段不可断，以免拼音错行），不用不可断行的 box 装框；
/// 注文以零宽锚点叠放：a="l" 锚在词首左侧（注文左缘对齐词首），
/// a="r" 锚在词尾右侧（注文右缘对齐词尾），
/// a="c" 锚在词首左侧并按被注词宽度水平居中；注文内部始终左齐。
/// 锚点与正文之间用 wj 禁止断行。注文为空时只描边、不叠注文、不抬高行。
/// 内嵌 #py / #snt 第三参注音时：拼音叠在框外；整段不可断行以保持拼音与底字对齐。
#let _nt-render(
  word,
  note: [],
  ln: 2,
  a: "l",
  o: 0pt,
  c: "g",
  dash: "solid",
  note-size: sizes.note,
  gap: sizes.note-gap,
  note-leading: sizes.note-leading,
  radius: 0.12em,
  pad: 0pt,
  stroke-width: 0.45pt,
) = context {
  set par.line(numbering: none)
  assert(a == "l" or a == "r" or a == "c", message: "upnote 的 a 仅支持 \"l\"|\"r\"|\"c\"")
  let style-note(body) = {
    set text(
      lang: "zh",
      region: "CN",
      font: fonts.fang,
      size: note-size,
      fill: colors.ink,
      top-edge: "ascender",
      bottom-edge: "descender",
      overhang: false,
    )
    set par(leading: note-leading, justify: false, first-line-indent: 0pt)
    body
  }
  let measure-note(s) = measure(style-note(s))
  // 用纯文本排注文，避免 measure 与版面元素对位导致收敛振荡
  // 空注文 [] → ""；仅空白也视为无注文
  let note-plain = _plain-text(note).trim()
  let has-note = note-plain != ""
  let chars = if has-note { note-plain.clusters() } else { () }

  let stroke-color = _nt-stroke-color(c)
  let stroke-dash = _nt-stroke-dash(dash)
  let o-abs = o.to-absolute()

  let frame(body) = highlight(
    fill: none,
    stroke: (
      paint: stroke-color,
      thickness: stroke-width,
      dash: stroke-dash,
      cap: "round",
      join: "round",
    ),
    radius: radius,
    // extent 只控制左右外扩；正值易贴到邻字，故默认 0
    extent: pad,
    top-edge: "ascender",
    bottom-edge: "descender",
    body,
  )

  let framed = _nt-apply-frame(word, frame)
  if not has-note {
    framed
  } else {
    let note-width = _note-flow-width(chars, measure-note, lines: ln)
    let word-m0 = measure(word)
    // 注文内部始终左齐；a 只决定整块注文相对正文的水平位置
    let note-block = block(
      width: note-width,
      {
        set align(left)
        style-note(note-plain)
      },
    )
    let note-m = measure(note-block)
    let gap-abs = gap.to-absolute()
    let total-h = note-m.height + gap-abs + word-m0.height
    // 先按实宽实高锁死，再经零宽锚点 place，避免零宽父级内再次重排
    let locked = box(width: note-m.width, height: note-m.height, clip: false, note-block)
    let (place-align, dx-note) = if a == "r" {
      (top + right, o-abs)
    } else if a == "c" {
      (top + left, (word-m0.width - note-m.width) / 2 + o-abs)
    } else {
      (top + left, o-abs)
    }
    let anchor = box(width: 0pt, height: total-h, baseline: bottom)[
      #place(place-align, dx: dx-note, locked)
    ]
    if a == "r" {
      // 右锚：正文 + wj + 锚点（禁止锚与词尾断行）
      framed
      sym.wj
      anchor
    } else {
      // 左锚 / 居中：锚点 + wj + 正文（禁止锚与词首断行）
      anchor
      sym.wj
      framed
    }
  }
}

/// #nt 节点：metadata（供 #snt 遍历）+ 实际绘制
/// - from-notes：省略第二块时为 true；#snt(notes: …) 按序填入注文
#let _nt-node(
  word,
  note: [],
  from-notes: false,
  ln: 2,
  a: "l",
  o: 0pt,
  c: "g",
  dash: "solid",
  note-size: sizes.note,
  gap: sizes.note-gap,
  note-leading: sizes.note-leading,
  radius: 0.12em,
  pad: 0pt,
  stroke-width: 0.45pt,
) = {
  [#metadata((
      kind: "nt",
      word: word,
      note: note,
      from-notes: from-notes,
      ln: ln,
      a: a,
      o: o,
      c: c,
      dash: dash,
      note-size: note-size,
      gap: gap,
      note-leading: note-leading,
      radius: radius,
      pad: pad,
      stroke-width: stroke-width,
    ))#_nt-render(
      word,
      note: note,
      ln: ln,
      a: a,
      o: o,
      c: c,
      dash: dash,
      note-size: note-size,
      gap: gap,
      note-leading: note-leading,
      radius: radius,
      pad: pad,
      stroke-width: stroke-width,
    )]
}

#let _meta-kind(it) = {
  let p = _annot-payload(it)
  if p == none { none } else { p.at("kind") }
}

/// 按汉字顺序消耗拼音槽，给纯文本加头上注音
#let _annotate-str(s, slots, i) = {
  let out = ()
  let i = i
  for ch in s.clusters() {
    if _is-han(ch) {
      if i < slots.len() {
        let syl = slots.at(i)
        i += 1
        if syl != "" {
          out.push(_py-node(ch, syl))
        } else {
          out.push(ch)
        }
      } else {
        out.push(ch)
      }
    } else {
      out.push(ch)
    }
  }
  (out.join(), i)
}

/// 按 annotation 数据重建 #nt 节点；可覆盖 note / from-notes
#let _nt-from-payload(v, new-word, note: auto, from-notes: auto) = _nt-node(
  new-word,
  note: if note == auto { v.at("note", default: []) } else { note },
  from-notes: if from-notes == auto {
    v.at("from-notes", default: false)
  } else {
    from-notes
  },
  ln: v.at("ln", default: 2),
  a: v.at("a", default: "l"),
  o: v.at("o", default: 0pt),
  c: v.at("c", default: "g"),
  dash: v.at("dash", default: "solid"),
  note-size: v.at("note-size", default: sizes.note),
  gap: v.at("gap", default: sizes.note-gap),
  note-leading: v.at("note-leading", default: sizes.note-leading),
  radius: v.at("radius", default: 0.12em),
  pad: v.at("pad", default: 0pt),
  stroke-width: v.at("stroke-width", default: 0.45pt),
)

/// 将 #snt(notes: ([…], …)) 按序填入正文轻锚点（省略第二块的 #nt／#ntc 等）
/// - 仅处理 from-notes 节点；条数必须与轻锚点数一致，否则 panic
/// - 仅加框：在 notes 中写 [] 占位（推荐）；勿在正文写 #nt[词][]
#let _apply-notes-to-content(body, notes) = {
  let walk(it, i) = {
    if type(it) != content {
      (it, i)
    } else if _meta-kind(it) == "nt" {
      let v = _annot-payload(it)
      if v.at("from-notes", default: false) {
        if i >= notes.len() {
          panic(
            "notes: 条数不足（已用尽 "
              + str(notes.len())
              + " 条，正文中仍有未填的轻锚点 #ntw[词] 等）",
          )
        }
        (
          _nt-from-payload(v, v.word, note: notes.at(i), from-notes: false),
          i + 1,
        )
      } else {
        (_nt-from-payload(v, v.word), i)
      }
    } else if it.has("text") {
      (it, i)
    } else if it.has("children") {
      let out = ()
      let i2 = i
      let children = it.children
      let j = 0
      while j < children.len() {
        let ch = children.at(j)
        let kind = _meta-kind(ch)
        if kind == "nt" {
          let v = _annot-payload(ch)
          if v.at("from-notes", default: false) {
            if i2 >= notes.len() {
              panic(
                "notes: 条数不足（已用尽 "
                  + str(notes.len())
                  + " 条，正文中仍有未填的轻锚点 #ntw[词] 等）",
              )
            }
            out.push(_nt-from-payload(v, v.word, note: notes.at(i2), from-notes: false))
            i2 += 1
          } else {
            out.push(_nt-from-payload(v, v.word))
          }
          j += 1
          if ch.func() == metadata and j < children.len() and _meta-kind(children.at(j)) == none {
            j += 1
          }
        } else if kind == "py" {
          let (piece, next) = walk(ch, i2)
          out.push(piece)
          i2 = next
          j += 1
          if ch.func() == metadata and j < children.len() and _meta-kind(children.at(j)) == none {
            j += 1
          }
        } else {
          let (piece, next) = walk(ch, i2)
          out.push(piece)
          i2 = next
          j += 1
        }
      }
      (out.join(), i2)
    } else if it.has("body") {
      let (new-body, i2) = walk(it.body, i)
      let fields = it.fields()
      let named = (:)
      for (k, v) in fields {
        if k != "body" {
          named.insert(k, v)
        }
      }
      (it.func()(new-body, ..named), i2)
    } else {
      (it, i)
    }
  }
  let (out, used) = walk(body, 0)
  if used != notes.len() {
    panic(
      "notes: 条数过多（提供 "
        + str(notes.len())
        + " 条，正文轻锚点只需 "
        + str(used)
        + " 条）",
    )
  }
  out
}

/// 译文原子序列：字簇可断行；#nt（框／注文）整段不可断；其余压成纯文本
/// 展平的 [#metadata#绘制] 成对识别，只重建一次
#let _yi-atoms(it) = {
  if type(it) == str {
    if it == "" { () } else { it.clusters() }
  } else if it == none {
    ()
  } else if type(it) != content {
    str(it).clusters()
  } else if _meta-kind(it) == "nt" {
    let v = _annot-payload(it)
    // box：译文折行时整段 #nt 不可断（与夹注「有拼音则整段不可断」一致）
    (box(_nt-from-payload(v, v.word)),)
  } else if _meta-kind(it) == "py" {
    _plain-text(it).clusters()
  } else if it.has("text") {
    if it.text == "" { () } else { it.text.clusters() }
  } else if it.has("children") {
    let out = ()
    let children = it.children
    let j = 0
    while j < children.len() {
      let ch = children.at(j)
      let kind = _meta-kind(ch)
      if kind == "nt" {
        let v = _annot-payload(ch)
        out.push(box(_nt-from-payload(v, v.word)))
        j += 1
        if ch.func() == metadata and j < children.len() and _meta-kind(children.at(j)) == none {
          j += 1
        }
      } else if kind == "py" {
        out += _plain-text(ch).clusters()
        j += 1
        if ch.func() == metadata and j < children.len() and _meta-kind(children.at(j)) == none {
          j += 1
        }
      } else {
        out += _yi-atoms(ch)
        j += 1
      }
    }
    out
  } else if it.has("body") {
    _yi-atoms(it.body)
  } else {
    ()
  }
}

/// 译文内容：保留 #nt（框／注文），其余压成纯文本（减 measure 振荡）
#let _yi-content(it) = {
  let s = _yi-atoms(it).join()
  if s == none { "" } else { s }
}

/// 遍历正文 content：#nt 只注被注词；遇 #py 则报错
/// 注意：`[#metadata#绘制]` 在父级 sequence 中常被展平，需成对识别并跳过绘制半段
#let _apply-yin-to-content(body, slots) = {
  let walk(it, i) = {
    if type(it) == str {
      _annotate-str(it, slots, i)
    } else if type(it) != content {
      (it, i)
    } else if _meta-kind(it) == "py" {
      panic("在 #snt 已提供拼音参数时，正文中不能再使用 #py；请删去 #py，改由第三参数统一注音。")
    } else if _meta-kind(it) == "nt" {
      // 未展平的整节点，或单独落到的 metadata
      let v = _annot-payload(it)
      let (new-word, i2) = walk(v.word, i)
      (_nt-from-payload(v, new-word), i2)
    } else if it.has("text") {
      _annotate-str(it.text, slots, i)
    } else if it.has("children") {
      let out = ()
      let i2 = i
      let children = it.children
      let j = 0
      while j < children.len() {
        let ch = children.at(j)
        let kind = _meta-kind(ch)
        if kind == "py" {
          panic("在 #snt 已提供拼音参数时，正文中不能再使用 #py；请删去 #py，改由第三参数统一注音。")
        } else if kind == "nt" {
          let v = _annot-payload(ch)
          let (new-word, next) = walk(v.word, i2)
          out.push(_nt-from-payload(v, new-word))
          i2 = next
          j += 1
          // 仅当本项是裸 metadata 时，跳过紧随的绘制半段；
          // 若已是 [#metadata#绘制] 整段，则不可再跳过下一个正文节点
          if ch.func() == metadata and j < children.len() and _meta-kind(children.at(j)) == none {
            j += 1
          }
        } else {
          let (piece, next) = walk(ch, i2)
          out.push(piece)
          i2 = next
          j += 1
        }
      }
      (out.join(), i2)
    } else if it.has("body") {
      let (new-body, i2) = walk(it.body, i)
      let fields = it.fields()
      let named = (:)
      for (k, v) in fields {
        if k != "body" {
          named.insert(k, v)
        }
      }
      (it.func()(new-body, ..named), i2)
    } else {
      (it, i)
    }
  }
  walk(body, 0).at(0)
}

/// 句子（句下译）：#snt[古文][译文] 或 #snt[古文][译文][拼音]
/// - 正文／译文／拼音：去首尾空行与空白后，多行拼成一行（拼音拼接处加一空格）
/// - 第三参可选：音节空格分隔；连续两空格表示该汉字省略拼音；标点/数字/拉丁字母不占槽
/// - notes: ([注1], [注2], …) 解释层：按序填入正文中「省略第二块」的轻锚点（#ntw[词] 等）
///   写法：`#snt(notes: ([…], […]))[古文][译文][拼音]`（命名参数须在括号内，不能写在 ] 后）
///   仅加框：在 notes 中写 [] 占位（与轻锚点一一对应）；短注可内嵌 `#ntc[走][跑]`（不消耗 notes）
/// - 正文中 #nt 只对「被注词」注音，注文不参与；此时勿再嵌 #py
/// - 译文中可使用 #nt／#ntc 等（含仅加框；折行保留框，并与正文同用 CJK 禁则／避头点）
/// - 其余标记压成纯文本
/// - 古文楷体、译文宋体；通常可接排、句内自由断行
/// - 译文按本段实测 body-y 逐行放置（行距随该行注/拼实际高度变；无 ys 时回退估计）
/// - 折行条件看本句古文/译文相对本行剩余宽
/// - 译文零宽锚点 + wj 粘合古文；定位用外层 pos0
/// - 第一处对齐位置画一根竖线（高度＝译文行高）；色键 c 同 #nt（默认 c）；译文同色
#let snt(wen, yi, ..args) = context {
  let pos = args.pos()
  let named = args.named()
  let dy = named.at("dy", default: 0.35em)
  let c = named.at("c", default: "c")
  let yin = if pos.len() >= 1 {
    pos.at(0)
  } else {
    named.at("yin", default: none)
  }
  let note-list = named.at("notes", default: none)
  if note-list != none and type(note-list) != array {
    panic("notes: 须为数组，如 notes: ([注1], [注2])")
  }

  // 去首尾空行/空白后，多行拼成一行（拼音拼接处加一空格）
  let wen = _flatten-to-one-line(wen)
  let yi = _flatten-to-one-line(yi)
  let yin = if yin == none { none } else { _flatten-to-one-line(yin, sep: " ") }
  let wen = if note-list != none {
    _apply-notes-to-content(wen, note-list)
  } else {
    wen
  }
  let slots = _parse-yin-slots(yin)
  let wen = if slots != none {
    _apply-yin-to-content(wen, slots)
  } else {
    wen
  }
  let wen = {
    set text(font: font-cjk(fonts.kai))
    wen
  }

  let region = _snt-region.get()
  let text-left = region.left
  // region.width 首遍可能仍是 0；不可把 0 宽块放进零宽锚点（会一字一行）
  let full-w = if region.width > 1pt {
    region.width
  } else {
    let x = if text-left > 0pt { text-left } else { here().position().x }
    calc.max(page.width - 2 * x, 100pt)
  }
  let ntp-id = region.at("ntp-id", default: none)
  // 用 ntp 入口缓存的本段 body-y（实际行高差）；避免每个 snt 现场 query 加剧振荡
  let all-ys = region.at("line-ys", default: ())
  let fallback-stride = {
    let s = if region.stride > 30pt { region.stride } else { _ntp-stride(ys: all-ys) }
    if s > 30pt { s } else { _ntp-stride-fallback() }
  }
  let dy0 = dy.to-absolute()
  let stroke-color = colors.at(c, default: colors.c)
  let tick-w = 1.6pt

  let pos0 = here().position()
  let bottom-m = {
    let m = page.margin
    let raw = if type(m) == dictionary {
      m.at("bottom", default: m.at("y", default: 2cm))
    } else {
      m
    }
    if raw == auto { 2cm } else { raw }
  }
  let remain-y = page.height - bottom-m.to-absolute() - pos0.y
  let near-end = false

  let first-indent = calc.max(pos0.x - text-left, 0pt)
  let remain-x = calc.max(full-w - first-indent, 0pt)

  let yi-line-h = measure({
    set text(
      lang: "zh",
      region: "CN",
      font: font-cjk(fonts.song),
      size: sizes.yi,
      overhang: false,
    )
    [国]
  }).height

  let yi-style(body) = {
    set text(
      lang: "zh",
      region: "CN",
      font: font-cjk(fonts.song),
      size: sizes.yi,
      fill: stroke-color,
      overhang: false,
    )
    set par.line(numbering: none)
    body
  }
  let yi-atoms = _yi-atoms(yi)
  let yi-body = {
    let s = yi-atoms.join()
    if s == none { "" } else { s }
  }
  let yi-nowrap = yi-style(box(yi-body))

  // 与正文相同：用 Typst 段落引擎测定能否单行排下（含 CJK 折行），再叠加禁则
  let fits-yi-slice(slice, width) = {
    if slice.len() == 0 {
      true
    } else {
      let body = slice.join()
      let h = measure(
        width: width,
        yi-style({
          set par(leading: 0pt, spacing: 0pt, justify: false, linebreaks: auto)
          body
        }),
      ).height
      h <= yi-line-h + 1pt
    }
  }
  let measure-yi(body) = measure(yi-style(box(body))).width
  let yi-lines = {
    let lines = _yi-break-atoms(yi-atoms, fits-yi-slice, first-indent, full-w)
    if lines.len() == 0 { ("",) } else { lines }
  }

  // A3：按本句古文/译文相对本行剩余宽决定是否折行
  let wen-w = measure(wen).width
  let yi-nat-w = {
    let probe = yi-style(box(yi-body))
    let m = measure(probe)
    if m.width > 1pt { m.width } else { measure(yi-nowrap).width }
  }
  let wen-spans = wen-w > remain-x + 0.5pt
  let yi-overflow-line = yi-nat-w > remain-x + 0.5pt
  let yi-overflow-page = yi-nat-w > full-w + 0.5pt
  let allow-yi-wrap = wen-spans or yi-overflow-page or yi-overflow-line

  let k = _yi-line-index(all-ys, pos0.page, pos0.y)
  // 调试/回退：到下一正文行的实测距
  let stride = if all-ys.len() > k + 1 and all-ys.at(k).page == all-ys.at(k + 1).page {
    let d = all-ys.at(k + 1).y - all-ys.at(k).y
    if d > 55pt { d } else { fallback-stride }
  } else {
    fallback-stride
  }
  let yi-leading = calc.max(stride - yi-line-h, 0pt)
  let place-dx0 = text-left - pos0.x
  // 调试用：均匀 leading 的对照块（实际绘制改用逐行绝对 dy）
  let yi-wrapped = block(
    width: full-w,
    yi-style({
      set par(
        leading: yi-leading,
        justify: false,
        first-line-indent: (amount: first-indent, all: true),
        linebreaks: auto,
      )
      yi-body
      parbreak()
    }),
  )

  // 逐行绝对放置：第 i 行 dy = (body-y[k+i] - pos0.y) + dy0
  // 行距取自实测相邻正文基线距（已含该行注/拼实际总高），不再用固定倍数
  let yi-line-dys = {
    let out = ()
    for (i, _) in yi-lines.enumerate() {
      out.push(_yi-line-dy(all-ys, k, i, pos0.y, dy0, fallback-stride))
    }
    out
  }

  let yi-placed = if allow-yi-wrap {
    place(
      top + left,
      dx: 0pt,
      dy: 0pt,
      box(width: 0pt, height: 0pt, clip: false, {
        for (i, line) in yi-lines.enumerate() {
          let dx-i = place-dx0 + (if i == 0 { first-indent } else { 0pt })
          let dy-i = yi-line-dys.at(i)
          // 必须锁宽：零宽父级内未锁宽 → 可用宽被压成 0 → 一字一行
          // line 可为含 #nt 的 content（折行仍保留框）
          let piece = yi-style(box(line))
          let pw = {
            let m = measure(piece)
            if m.width > 1pt { m.width } else { measure-yi(line) }
          }
          place(
            top + left,
            dx: dx-i,
            dy: dy-i,
            box(width: calc.max(pw, 1pt), clip: false, piece),
          )
        }
      }),
    )
  } else {
    let probe = yi-style(box(yi-body))
    let m = measure(probe)
    let w = if m.width > 1pt { m.width } else { full-w }
    place(
      top + left,
      dx: 0pt,
      dy: dy0,
      box(width: w, clip: false, yi-nowrap),
    )
  }

  let opt-shift = 0.06em.to-absolute()
  let tick = place(
    top + right,
    dy: dy0 + opt-shift,
    box(width: tick-w, height: yi-line-h, fill: stroke-color),
  )

  // 零宽锚点 + 竖线 + 锁死译文；与古文 wj 粘合（类 #py）
  let yi-anchor = box(width: 0pt, height: 0pt, baseline: bottom, {
    tick
    yi-placed
  })

  // —— 调试 ——
  if _snt-debug-on() {
    let m-wrap = measure(yi-wrapped)
    let m-now = measure(yi-nowrap)
    let approx-lines = if yi-line-h > 0pt {
      calc.max(1, calc.round(m-wrap.height / yi-line-h))
    } else {
      1
    }
    let page-ys = all-ys.filter(pt => pt.page == pos0.page).map(pt => pt.y)
    _snt-debug-seq.step()
    let seq = _snt-debug-seq.get().first() + 1
    let pos-bad = pos0.x == 0pt or pos0.y == 0pt or pos0.x + 0.5pt < text-left
    let page-f = sys.inputs.at("snt-debug-page", default: "")
    let i-f = sys.inputs.at("snt-debug-i", default: "")
    let page-ok = page-f == "" or page-f == str(pos0.page) or pos-bad
    let i-ok = i-f == "" or i-f == str(seq)
    if page-ok and i-ok {
      let yi-plain = _plain-text(yi)
      let yi-preview = if yi-plain.clusters().len() > 24 {
        yi-plain.clusters().slice(0, 24).join() + "…"
      } else {
        yi-plain
      }
      let suspect = (
        pos-bad
          or stride < 30pt
          or (allow-yi-wrap and approx-lines >= 2 and yi-leading < 0.5pt)
          or (not allow-yi-wrap and m-now.width < 1pt)
      )
      let report = (
        "snt#"
          + str(seq)
          + " page="
          + str(pos0.page)
          + " ntp="
          + repr(ntp-id)
          + "\n  pos=("
          + _fmt-pt(pos0.x)
          + ", "
          + _fmt-pt(pos0.y)
          + ")"
          + "\n  text-left="
          + _fmt-pt(text-left)
          + " full-w="
          + _fmt-pt(full-w)
          + " remain-x="
          + _fmt-pt(remain-x)
          + "\n  first-indent="
          + _fmt-pt(first-indent)
          + " place-dx="
          + _fmt-pt(place-dx0)
          + "\n  stride="
          + _fmt-pt(stride)
          + " yi-line-h="
          + _fmt-pt(yi-line-h)
          + " yi-leading="
          + _fmt-pt(yi-leading)
          + "\n  k="
          + str(k)
          + " yi-lines="
          + str(yi-lines.len())
          + " dys=["
          + yi-line-dys.map(_fmt-pt).join(", ")
          + "]"
          + "\n  all-ys=["
          + _fmt-ys(all-ys)
          + "]"
          + "\n  wen-w="
          + _fmt-pt(wen-w)
          + " yi-nat-w="
          + _fmt-pt(yi-nat-w)
          + " wen-spans="
          + repr(wen-spans)
          + "\n  allow-yi-wrap="
          + repr(allow-yi-wrap)
          + " near-end="
          + repr(near-end)
          + " remain-y="
          + _fmt-pt(remain-y)
          + "\n  m-wrap=("
          + _fmt-pt(m-wrap.width)
          + "×"
          + _fmt-pt(m-wrap.height)
          + ")"
          + " approx-lines="
          + str(approx-lines)
          + "\n  suspect="
          + repr(suspect)
          + " pos-bad="
          + repr(pos-bad)
          + "\n  yi≈"
          + repr(yi-preview)
      )
      metadata((
        kind: "snt-debug",
        i: seq,
        page: pos0.page,
        x: pos0.x,
        y: pos0.y,
        ntp-id: ntp-id,
        text-left: text-left,
        full-w: full-w,
        remain-x: remain-x,
        first-indent: first-indent,
        place-dx: place-dx0,
        page-ys: page-ys,
        all-ys-len: all-ys.len(),
        stride: stride,
        yi-line-h: yi-line-h,
        yi-leading: yi-leading,
        wen-w: wen-w,
        yi-nat-w: yi-nat-w,
        wen-spans: wen-spans,
        allow-yi-wrap: allow-yi-wrap,
        near-end: near-end,
        remain-y: remain-y,
        m-wrap-w: m-wrap.width,
        m-wrap-h: m-wrap.height,
        m-nowrap-w: m-now.width,
        m-nowrap-h: m-now.height,
        approx-lines: approx-lines,
        suspect: suspect,
        pos-bad: pos-bad,
        yi: yi-preview,
      ))
      let mode = _snt-debug-mode()
      if mode == "assert" or (mode == "suspect" and suspect) {
        _snt-debug-log.update(log => log + (report,))
      }
    }
  }

  h(0pt, weak: true)
  // 统一粘合：译文锚点 + wj + 古文（类 #py）；不再按页末动态捆盒（易不收敛）
  yi-anchor
  sym.wj
  h(0pt, weak: true)
  wen
}

/// 字词头上注音：#py[琰][yǎn] / #py[踧踖][cù jí]
/// - 零宽锚点居中叠在字词上方；比字宽时自动撑开字距；与底字之间禁止断行
/// - 注音带高度与 #nt 单行注文一致（避免拉丁字体 metrics 撑高，与夹注错行）
/// - 若 #snt 第三参已给拼音，勿在正文中再用 #py
#let py(
  word,
  reading,
  size: sizes.note,
  gap: sizes.note-gap,
  c: "c",
) = _py-node(word, reading, size: size, gap: gap, c: c)

/// 行上注：#nt[被注词][注释正文]；仅加框（无 notes 时）：#nt[被注词]
/// 轻锚点（供 #snt(notes: …)）：#nt[被注词]（省略第二块）；仅加框时在 notes 中写 [] 占位
/// 单行：#nt(ln: 1)[被注词][注释正文]；三行：#nt(ln: 3)[...][...]
/// 右对齐：#nt(a: "r")[被注词][注释正文]；居中：#nt(a: "c")[…][…]；偏置：#nt(o: 0.2em)[…][…]（正右负左）
/// 框线：#nt(c: "c", dash: "dotted")[…][…]；捷径如 #ncd（c 色点线）
/// - 被注词用 highlight 描边（不填色，可跨行断框；内嵌 #py / #snt 注音时底字连成一框、拼音不入框，且整段不中断以免拼音错行）；注文默认 ink 色、零宽叠放
/// - 省略第二块：标记 from-notes，由 #snt(notes: …) 按序填注；未给 notes 时只描边
/// - 第二块有注文则内嵌，不消耗 notes；空／空白注文只描边
/// - ln：注文行数，默认 2；可传 ≥1 的任意整数
/// - a：注文相对正文的对齐，"l"（默认，注文左缘对齐词首）|"r"（注文右缘对齐词尾）|"c"（相对被注词水平居中）；
///   注文内部始终左齐；锚与正文间禁止断行
/// - o：注文水平偏置（默认 0；正值右移、负值左移）
/// - c：框线色键，仅 "c"|"g"（默认 g）；注文固定为 ink 色
/// - dash：框线样式 "solid"|"dashed"|"dotted"|"dash-dotted"（默认 solid）
/// - pad：框线左右外扩（highlight.extent；默认 0；可负值内收）
#let upnote(
  word,
  ln: 2,
  a: "l",
  o: 0pt,
  c: "g",
  dash: "solid",
  note-size: sizes.note,
  gap: sizes.note-gap,
  note-leading: sizes.note-leading,
  radius: 0.12em,
  pad: 0pt,
  stroke-width: 0.45pt,
  ..args,
) = {
  let pos = args.pos()
  assert(args.named().len() == 0, message: "upnote 无此命名参数")
  assert(pos.len() <= 1, message: "upnote 最多两个内容块：被注词、注文")
  // 省略第二块 → 轻锚点（吃 notes:）；有第二块（含内嵌注文）→ 不吃 notes:
  let from-notes = pos.len() == 0
  let note = if from-notes { [] } else { pos.at(0) }
  _nt-node(
    word,
    note: note,
    from-notes: from-notes,
    ln: ln,
    a: a,
    o: o,
    c: c,
    dash: dash,
    note-size: note-size,
    gap: gap,
    note-leading: note-leading,
    radius: radius,
    pad: pad,
    stroke-width: stroke-width,
  )
}

/// #nt 色×线型捷径（n + 色 c/g + 线型；其余参数与 #nt 相同）
/// 线型：s 实线｜x 虚线｜d 点线｜h 点划线
#let ngs = upnote.with(c: "g", dash: "solid")
#let ngx = upnote.with(c: "g", dash: "dashed")
#let ngd = upnote.with(c: "g", dash: "dotted")
#let ngh = upnote.with(c: "g", dash: "dash-dotted")
#let ncs = upnote.with(c: "c", dash: "solid")
#let ncx = upnote.with(c: "c", dash: "dashed")
#let ncd = upnote.with(c: "c", dash: "dotted")
#let nch = upnote.with(c: "c", dash: "dash-dotted")

/// 注释类别
#let nt = ngs // nt 不分类
#let ntc = ncs // ntc 难解词语（文言独有词语和古今异义词语）
#let ntj = ncx // ntj 难解的句子和搭配
#let ntw = nch // ntw 文化常识

/// 版面便签标注（视觉层，非 PDF 标准 Text annotation）
/// 用法：`#bz[此处宜改为……]`；调宽 `#bz(width: 10em)[…]`；偏置 `#bz(o: 1em, dy: -0.5em)[…]`
/// - 流内只有 metadata（无 box / context / state.update），启用与否不改变行距与空行
/// - 便签在 page.background 绘制（正文底层）；顶对齐：上沿贴行顶、右缘贴版心右缘
/// - 默认宽 25em（相对 size）；字号 10.5pt；浅黄底
/// - o：水平偏置，正右负左；dy：相对顶对齐位置再调，正下负上
#let bz(
  body,
  width: auto,
  o: 0pt,
  dy: 0pt,
  size: 10.5pt,
  fill: auto,
  inset: 0.45em,
  radius: 0.12em,
) = {
  let fill = if fill == auto { colors.sticky } else { fill }
  metadata((
    kind: "bz",
    width: width,
    o: o,
    dy: dy,
    size: size,
    fill: fill,
    inset: inset,
    radius: radius,
    body: body,
  ))
}

/// 练习题调试开关与答案色（实现见 exercise.typ）
#import "exercise.typ": exercise-answer-color, exercise-debug, exercise-debug-on

/// 连线练习题（lx-paint-lines 已在前文导入供页背景；此处导出 #lx）
#import "lx.typ": lx

/// 选择题（实现见 xt.typ）；题干+选项；+/- 对错；cols 控制一行/分行
#import "xt.typ": xt

/// 排序题（实现见 px.typ）；书写顺序为正解；seed 乱序；项前括号填透明序号
#import "px.typ": px

/// 田字格抄写（实现见 tzg.typ）；默认楷体底字 + 工程拼音字体 + 品红格线
#import "tzg.typ": tzg as _tzg-core
#let tzg(
  chars,
  yin,
  size: 1.5cm,
  gap: 0pt,
  color: auto,
  pinyin-ratio: 0.30,
) = {
  let color = if color == auto { colors.m } else { color }
  _tzg-core(
    chars,
    yin,
    size: size,
    gap: gap,
    color: color,
    char-font: font-cjk(fonts.kai),
    pinyin-font: fonts.pinyin,
    pinyin-ratio: pinyin-ratio,
  )
}
