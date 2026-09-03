/// 连线练习题（#lx）
///
/// 用法：
/// ```
/// #lx(seed: 123)[
///   + 白话提问？ | 原文答句
///   + 另一问？ | 另一答
/// ]
/// ```
/// - 行：`+` 枚举项（顺序＝左栏固定顺序）
/// - 栏：英文竖线 `|` 分隔左（问）/ 右（答）；两侧空白会去掉
/// - 右栏按 `seed` 做确定性乱序（默认 123）；编译结果可复现
/// - 正解用透明线连接左右竖条（`#exercise-debug` 打开时为深红色）
/// - 竖条高度随该行文本（含换行）自适应，至少 1em
/// - 版式：左文·导点｜左竖条｜留白｜右竖条｜右文

#import "exercise.typ": exercise-answer-color

/// 从 content 抽纯文本（空格节点 → 空格）
#let _lx-plain(it) = {
  if type(it) == str {
    it
  } else if it == none {
    ""
  } else if type(it) != content {
    str(it)
  } else if it.has("text") {
    it.text
  } else if it.has("children") {
    let s = it.children.map(_lx-plain).join()
    if s == none { "" } else { s }
  } else if it.has("body") {
    _lx-plain(it.body)
  } else {
    let tag = repr(it)
    if tag == "space" { " " } else { "" }
  }
}

/// 收集枚举项正文（兼容裸 item 序列 / enum 包裹 / 外层 sequence）
#let _lx-enum-bodies(body) = {
  let walk(it) = {
    if type(it) != content {
      ()
    } else if it.func() == enum.item {
      (it.body,)
    } else if it.func() == enum {
      it.children.map(walk).join()
    } else if it.has("children") {
      let parts = it.children.map(walk).join()
      if parts == none { () } else { parts }
    } else {
      ()
    }
  }
  walk(body)
}

/// 按首个 sep 切成左右纯文本
#let _lx-split(body, sep: "|") = {
  let plain = _lx-plain(body)
  let parts = plain.split(sep)
  assert(
    parts.len() >= 2,
    message: "连线题每一项须用 \"" + sep + "\" 分成左右两部分，例如：提问？ | 答句",
  )
  let left = parts.at(0).trim()
  let right = parts.slice(1).join(sep).trim()
  assert(left != "", message: "连线题左栏（提问）不能为空")
  assert(right != "", message: "连线题右栏（答句）不能为空")
  (left, right)
}

/// LCG：返回下一个种子（确定性伪随机）
#let _lx-rng-next(seed) = {
  calc.rem(seed * 1664525 + 1013904223, 4294967296)
}

/// Fisher–Yates 乱序；相同 seed + 相同数组 → 相同结果
#let _lx-shuffle(arr, seed) = {
  let n = arr.len()
  if n <= 1 {
    arr
  } else {
    let a = arr
    let s = seed
    if s < 0 { s = -s }
    if s == 0 { s = 1 }
    for i in range(n - 1, -1, step: -1) {
      s = _lx-rng-next(s)
      let j = calc.rem(s, i + 1)
      let ai = a.at(i)
      let aj = a.at(j)
      a = range(n).map(k => {
        if k == i { aj } else if k == j { ai } else { a.at(k) }
      })
    }
    a
  }
}

#let _lx-id-counter = counter("lx-id")
/// 竖条宽度；高度随该行文本（含换行）自适应，至少 1em
#let _lx-bar-width = 0.14em
#let _lx-bar-min-height = 1em

/// 带锚点的连线竖条
/// metadata 落在盒左上角；绘线时用 position + (w/2, h/2) 得中心
#let _lx-bar-anchor(id, side, i, height: auto, to: none) = {
  let h = if height == auto { _lx-bar-min-height } else { height }
  box(
    width: _lx-bar-width,
    height: h,
    fill: luma(160),
    radius: 0.4pt,
    metadata((
      kind: "lx-anchor",
      id: id,
      side: side,
      i: i,
      to: to,
      w: _lx-bar-width,
      h: h,
    )),
  )
}

/// 行末导点（单行时填满文字到竖条之间的空隙）
#let _lx-leaders() = box(
  width: 1fr,
  inset: (left: 0.18em, right: 0.1em, top: 0.45em),
  repeat(text(size: 0.4em, fill: luma(175), [·])),
)

/// 序号 + 正文；`lead` 时在正文后加导点
#let _lx-label(marker, body, marker-width: 1.6em, lead: false) = {
  set par(first-line-indent: 0pt, justify: false, leading: 0.62em)
  grid(
    columns: (marker-width, 1fr),
    column-gutter: 0.1em,
    align: (right + top, left + top),
    marker,
    {
      body
      if lead { _lx-leaders() }
    },
  )
}

/// 测定标签在给定栏宽下的高度（不含 1fr 导点）
#let _lx-measure-label(marker, body, width, marker-width: 1.6em) = {
  measure({
    set par(first-line-indent: 0pt, justify: false, leading: 0.62em)
    block(
      width: width,
      grid(
        columns: (marker-width, 1fr),
        column-gutter: 0.1em,
        align: (right + top, left + top),
        marker,
        body,
      ),
    )
  }).height
}

/// 由锚点位置还原竖条中心（metadata 在盒左上角）
#let _lx-center(pos, w, h) = {
  (
    x: pos.x + w.to-absolute() / 2,
    y: pos.y + h.to-absolute() / 2,
    page: pos.page,
  )
}

/// 两端水平内缩 inset，保持 y 与竖条中心对齐
#let _lx-inset-horizontal(cl, cr, inset: 0.5em) = {
  let inset-abs = inset.to-absolute()
  let span = cr.x - cl.x
  if span <= 2 * inset-abs {
    let mx = (cl.x + cr.x) / 2
    ((mx, cl.y), (mx, cr.y))
  } else {
    (
      (cl.x + inset-abs, cl.y),
      (cr.x - inset-abs, cr.y),
    )
  }
}

/// 在 page.background 绘制本页连线题正解线（透明或调试深红）
#let lx-paint-lines() = context {
  let page-n = here().page()
  let paint = exercise-answer-color()
  let stroke = 0.65pt + paint
  let marks = query(metadata).filter(m => {
    let v = m.value
    type(v) == dictionary and v.at("kind", default: none) == "lx-anchor"
  })
  let rights = (:)
  for m in marks {
    let v = m.value
    if v.side == "R" {
      let key = str(v.id)
      let bucket = rights.at(key, default: (:))
      bucket.insert(
        str(v.i),
        (
          loc: m.location(),
          w: v.at("w", default: _lx-bar-width),
          h: v.at("h", default: _lx-bar-min-height),
        ),
      )
      rights.insert(key, bucket)
    }
  }
  for m in marks {
    let v = m.value
    if v.side != "L" { continue }
    let to = v.at("to", default: none)
    if to == none { continue }
    let pl = m.location().position()
    if pl.page != page-n { continue }
    let right = rights.at(str(v.id), default: (:)).at(str(to), default: none)
    if right == none { continue }
    let pr = right.loc.position()
    if pr.page != page-n { continue }
    let cl = _lx-center(pl, v.at("w", default: _lx-bar-width), v.at("h", default: _lx-bar-min-height))
    let cr = _lx-center(pr, right.w, right.h)
    let (a, b) = _lx-inset-horizontal(cl, cr, inset: 0.5em)
    place(
      top + left,
      line(start: a, end: b, stroke: stroke),
    )
  }
}

/// 连线练习题
/// - seed：右栏乱序种子，默认 123
/// - sep：左右分隔符，默认 "|"
/// - left-numbering / right-numbering：两侧序号格式
/// - gutter：左右竖条之间的连线留白（默认 4em）
#let lx(
  seed: 123,
  sep: "|",
  left-numbering: "1. ",
  right-numbering: "A. ",
  gutter: 4em,
  body,
) = {
  let raw-items = _lx-enum-bodies(body)
  assert(
    raw-items.len() > 0,
    message: "连线题须用 + 列出至少一项：+ 提问？ | 答句",
  )
  let pairs = raw-items.map(it => _lx-split(it, sep: sep))
  let lefts = pairs.map(p => p.at(0))
  let n = lefts.len()
  let tagged = range(n).map(i => (orig: i, text: pairs.at(i).at(1)))
  let shuffled = _lx-shuffle(tagged, seed)
  let rights = shuffled.map(t => t.text)
  let left-to-right = range(n).map(i => {
    let j = 0
    while j < n {
      if shuffled.at(j).orig == i { break }
      j += 1
    }
    j
  })

  _lx-id-counter.step()
  context {
    let id = _lx-id-counter.get().first()
    set par(first-line-indent: 0pt)
    block(
      width: 100%,
      breakable: true,
      inset: (top: 0.15em, bottom: 0.35em),
      layout(bounds => {
        // 与下方 grid 列宽一致，用于测定换行后的行高
        let g0 = 0.1em.to-absolute()
        let g3 = 0.1em.to-absolute()
        let bar-col = 0.45em.to-absolute()
        let gut = gutter.to-absolute()
        let fixed = g0 + bar-col + gut + bar-col + g3
        let rest = calc.max(bounds.width - fixed, 1pt)
        let left-w = rest * 1.55 / (1.55 + 1.1)
        let right-w = rest * 1.1 / (1.55 + 1.1)
        let min-h = _lx-bar-min-height.to-absolute()
        let row-hs = range(n).map(i => {
          let lh = _lx-measure-label(
            numbering(left-numbering, i + 1),
            lefts.at(i),
            left-w,
          )
          let rh = _lx-measure-label(
            numbering(right-numbering, i + 1),
            rights.at(i),
            right-w,
          )
          calc.max(lh, rh, min-h)
        })
        grid(
          columns: (1.55fr, 0.45em, gutter, 0.45em, 1.1fr),
          column-gutter: (0.1em, 0pt, 0pt, 0.1em),
          row-gutter: 0.6em,
          align: top,
          ..range(n)
            .map(i => (
              _lx-label(numbering(left-numbering, i + 1), lefts.at(i), lead: true),
              grid.cell(
                align: top + center,
                _lx-bar-anchor(
                  id,
                  "L",
                  i,
                  height: row-hs.at(i),
                  to: left-to-right.at(i),
                ),
              ),
              [],
              grid.cell(
                align: top + center,
                _lx-bar-anchor(id, "R", i, height: row-hs.at(i)),
              ),
              _lx-label(numbering(right-numbering, i + 1), rights.at(i)),
            ))
            .flatten(),
        )
      }),
    )
  }
}
