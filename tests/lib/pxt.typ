/// 排序题（#pxt）
///
/// 用法：
/// ```
/// #pxt[
///   因释其耒而守株
///   + 于是
///   + 放下
///   + 他的
///   + 耒
///   + 而
///   + 守着
///   + 树桩
/// ]
/// ```
/// - 题干：选项之前的正文（无右侧答括号；答案在每项前的括号里）
/// - 选项：用 `+` 或 `-` 按**正确顺序**书写；展示时按 `seed` 乱序（默认 123）
/// - 每项前 `（n）`：n 为正确序号（1 起），默认透明色
/// - cols：`auto`（默认）按自然宽横排、满行换行成多行；`1` 每项一行（分行）；`≥2` 等宽分栏
/// - 答案以 metadata 记录（kind: "px"）

#import "exercise.typ": exercise-resolve-fill

/// 收集题干与选项（`+` / `-` 均可；书写顺序＝正确顺序）
/// 返回 `(stem, bodies)`，bodies 为 content 数组
#let _px-collect(body) = {
  let walk(it, state) = {
    let (stem-parts, opts, seen-opt) = state
    if type(it) != content {
      if seen-opt {
        state
      } else {
        (stem-parts + (it,), opts, false)
      }
    } else if it.func() == enum.item or it.func() == list.item {
      (stem-parts, opts + (it.body,), true)
    } else if it.func() == enum or it.func() == list {
      it.children.fold(state, (s, child) => walk(child, s))
    } else if it.has("children") {
      it.children.fold(state, (s, child) => walk(child, s))
    } else if seen-opt {
      state
    } else {
      (stem-parts + (it,), opts, false)
    }
  }

  let (stem-parts, opts, _) = walk(body, ((), (), false))
  let stem = if stem-parts.len() == 0 {
    none
  } else {
    stem-parts.join()
  }
  (stem, opts)
}

#let _px-stem-empty(stem) = {
  if stem == none {
    true
  } else if type(stem) == str {
    stem.trim() == ""
  } else if type(stem) == content {
    if stem.has("text") {
      stem.text.trim() == ""
    } else {
      repr(stem) == "[]" or repr(stem) == "[ ]"
    }
  } else {
    false
  }
}

/// LCG（与 #lx 相同算法，编译可复现）
#let _px-rng-next(seed) = {
  calc.rem(seed * 1664525 + 1013904223, 4294967296)
}

/// Fisher–Yates 乱序
#let _px-shuffle(arr, seed) = {
  let n = arr.len()
  if n <= 1 {
    arr
  } else {
    let a = arr
    let s = seed
    if s < 0 { s = -s }
    if s == 0 { s = 1 }
    for i in range(n - 1, -1, step: -1) {
      s = _px-rng-next(s)
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

/// 单项：`（正确序号）` + 正文；序号用 answer-fill
#let _px-option(
  ord,
  body,
  answer-fill: rgb(0%, 0%, 0%, 0%),
  marker-width: 2.2em,
  compact: false,
) = {
  set par(first-line-indent: 0pt, justify: false, leading: 0.62em)
  let marker = [（ #text(fill: answer-fill, [#str(ord)]) ）]
  if compact {
    // 自然宽：两列 auto，可放入行装箱网格（单元格允许块级正文）
    grid(
      columns: (auto, auto),
      column-gutter: 0.15em,
      align: (right + horizon, left + horizon),
      marker, body,
    )
  } else {
    grid(
      columns: (marker-width, 1fr),
      column-gutter: 0.15em,
      align: (right + top, left + top),
      marker, body,
    )
  }
}

/// 测定 compact 选项自然宽
#let _px-natural-width(it, answer-fill: rgb(0%, 0%, 0%, 0%)) = {
  measure({
    set par(first-line-indent: 0pt, justify: false)
    _px-option(it.ord, it.body, answer-fill: answer-fill, compact: true)
  }).width
}

/// 按可用宽度贪心装箱成多行（每行若干自然宽选项）
#let _px-pack-rows(items, avail, answer-fill: rgb(0%, 0%, 0%, 0%), col-gutter: 1.2em) = {
  let gutter = col-gutter.to-absolute()
  let widths = items.map(it => _px-natural-width(it, answer-fill: answer-fill))
  let rows = ()
  let cur = ()
  let cur-w = 0pt
  for (i, it) in items.enumerate() {
    let w = widths.at(i)
    let need = if cur.len() == 0 { w } else { cur-w + gutter + w }
    if cur.len() > 0 and need > avail + 0.01pt {
      rows.push(cur)
      cur = (it,)
      cur-w = w
    } else {
      cur.push(it)
      cur-w = need
    }
  }
  if cur.len() > 0 {
    rows.push(cur)
  }
  rows
}

/// 自动换行多行：选项按自然宽横排，满行则折到下一行
#let _px-flow(
  items,
  answer-fill: rgb(0%, 0%, 0%, 0%),
  col-gutter: 1.2em,
) = context {
  layout(bounds => {
    let rows = _px-pack-rows(
      items,
      bounds.width,
      answer-fill: answer-fill,
      col-gutter: col-gutter,
    )
    stack(
      dir: ttb,
      spacing: par.leading,
      ..rows.map(row => {
        grid(
          columns: (auto,) * row.len(),
          column-gutter: col-gutter,
          align: horizon + left,
          ..row.map(it => _px-option(
            it.ord,
            it.body,
            answer-fill: answer-fill,
            compact: true,
          )),
        )
      }),
    )
  })
}

#let _px-grid(
  items,
  cols,
  answer-fill: rgb(0%, 0%, 0%, 0%),
  col-gutter: 1.2em,
  row-gutter: auto,
) = context {
  let n = items.len()
  let c = calc.max(1, calc.min(cols, n))
  let rg = if row-gutter == auto { par.leading } else { row-gutter }
  grid(
    columns: (1fr,) * c,
    column-gutter: col-gutter,
    row-gutter: rg,
    align: top + left,
    ..items.map(it => _px-option(
      it.ord,
      it.body,
      answer-fill: answer-fill,
    )),
  )
}

#let _px-stem(stem) = {
  set par(first-line-indent: 0pt, justify: false, leading: 0.65em)
  stem
}

/// 排序题
/// - seed：乱序种子，默认 123；书写顺序为正解
/// - cols：`auto` 自然宽多行换行；`1` 分行；`≥2` 等宽分栏
/// - answer-fill：括号内正确序号色（`auto`＝练习题隐藏/调试色；见 #exercise-debug）
#let pxt(
  seed: 123,
  cols: auto,
  answer-fill: auto,
  col-gutter: 1.2em,
  row-gutter: auto,
  body,
) = context {
  let answer-fill = exercise-resolve-fill(answer-fill)
  let (stem, bodies) = _px-collect(body)
  assert(
    bodies.len() > 0,
    message: "排序题须用 + / - 按正确顺序列出至少一项",
  )
  if cols != auto {
    assert(
      type(cols) == int and cols >= 1,
      message: "px 的 cols 须为 auto 或 ≥1 的整数",
    )
  }

  // 带正确序号（1 起），再乱序展示
  let tagged = range(bodies.len()).map(i => (
    ord: i + 1,
    body: bodies.at(i),
  ))
  let shown = _px-shuffle(tagged, seed)

  metadata((
    kind: "px",
    seed: seed,
    n: bodies.len(),
    // 展示顺序下每项的正确序号
    order: shown.map(it => it.ord),
  ))

  set par(first-line-indent: 0pt)
  block(
    width: 100%,
    breakable: true,
    inset: (top: 0.1em, bottom: 0.25em),
    {
      set block(spacing: 0pt)
      if not _px-stem-empty(stem) {
        _px-stem(stem)
        context v(par.leading, weak: true)
      }
      if cols == auto {
        _px-flow(
          shown,
          answer-fill: answer-fill,
          col-gutter: col-gutter,
        )
      } else {
        _px-grid(
          shown,
          cols,
          answer-fill: answer-fill,
          col-gutter: col-gutter,
          row-gutter: row-gutter,
        )
      }
    },
  )
}
