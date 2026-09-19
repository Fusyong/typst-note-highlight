/// 选择题（#xzt）
///
/// 用法：
/// ```
/// #xzt[
///   兔*走*触株
///   - 慢慢地走
///   + 奔跑
///   - 蹦跳
/// ]
/// #xzt(cols: 1)[
///   加点字意思不同一项是
///   + *走*马观花
///   - 飞沙*走*石
///   - *走*街串巷
///   - 奔*走*相告
/// ]
/// ```
/// - 题干：选项之前的正文；末尾靠版心右侧自动插入括号
/// - 括号内填正确项序号（A/B/C…），默认透明色（便于透印/校对）
/// - 多选（正确项 ≥2）时，括号后再标「（多选）」
/// - 选项：`-` 干扰项，`+` 正确项（可多个）；版面序号一律 `A. B. C.…`
/// - cols：`1` 分行；`2/3/4…` 等宽分栏；`auto`（默认）尽量多列同行
/// - 答案另以 metadata 记录（kind: "xt"）

#import "exercise.typ": exercise-resolve-fill

/// 收集题干与选项（`+` → enum.item 为正确；`-` → list.item 为干扰）
/// 返回 `(stem, options)`，options 为 `((correct, body), …)`
#let _xt-collect(body) = {
  // 状态：(stem-parts, opts, seen-opt)
  let walk(it, state) = {
    let (stem-parts, opts, seen-opt) = state
    if type(it) != content {
      if seen-opt {
        state
      } else {
        (stem-parts + (it,), opts, false)
      }
    } else if it.func() == enum.item {
      (stem-parts, opts + ((correct: true, body: it.body),), true)
    } else if it.func() == list.item {
      (stem-parts, opts + ((correct: false, body: it.body),), true)
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

/// 题干是否实质为空（仅空白 / 换行）
#let _xt-stem-empty(stem) = {
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

/// 单个选项：序号 + 正文
#let _xt-option(marker, body, marker-width: 1.6em) = {
  set par(first-line-indent: 0pt, justify: false, leading: 0.62em)
  grid(
    columns: (marker-width, 1fr),
    column-gutter: 0.15em,
    align: (right + top, left + top),
    marker, body,
  )
}

/// 按指定列数排选项网格（横向流）
#let _xt-grid(items, cols, col-gutter: 1.2em, row-gutter: 0.45em) = {
  let n = items.len()
  let c = calc.max(1, calc.min(cols, n))
  grid(
    columns: (1fr,) * c,
    column-gutter: col-gutter,
    row-gutter: row-gutter,
    align: top + left,
    ..range(n).map(i => _xt-option(
      numbering("A. ", i + 1),
      items.at(i).body,
    )),
  )
}

/// 测定「带序号的选项」自然宽度（单行、不折行）
#let _xt-natural-width(body, i) = {
  measure({
    set par(first-line-indent: 0pt, justify: false)
    box(grid(
      columns: (1.6em, auto),
      column-gutter: 0.15em,
      align: (right + top, left + top),
      numbering("A. ", i + 1), body,
    ))
  }).width
}

/// 在可用宽度内选取最大可容纳列数
#let _xt-auto-cols(items, avail, col-gutter: 1.2em) = {
  let n = items.len()
  if n <= 1 {
    1
  } else {
    let widths = range(n).map(i => _xt-natural-width(items.at(i).body, i))
    let gutter = col-gutter.to-absolute()
    let best = 1
    for c in range(n, 1, step: -1) {
      let ok = true
      let row = 0
      while row * c < n {
        let start = row * c
        let end = calc.min(start + c, n)
        let row-w = 0pt
        for j in range(start, end) {
          row-w += widths.at(j)
        }
        row-w += gutter * (end - start - 1)
        if row-w > avail + 0.01pt {
          ok = false
          break
        }
        row += 1
      }
      if ok {
        best = c
        break
      }
    }
    best
  }
}

/// 答案字母串（如 "B" / "AC"）；无正确项时用全角空格占位
#let _xt-answer-letters(answers) = {
  if answers.len() == 0 {
    "　"
  } else {
    answers.map(i => numbering("A", i + 1)).join()
  }
}

/// 题干右侧：`（答案）` + 多选时再跟可见的 `（多选）`
/// - 括号与「多选」标签用正文色；答案字母用 answer-fill（默认全透明）
#let _xt-blank(answers, answer-fill: rgb(0%, 0%, 0%, 0%)) = {
  let letters = _xt-answer-letters(answers)
  let multi = answers.len() >= 2
  [
    （ #text(fill: answer-fill, letters) ）#if multi { [（多选）] }
  ]
}

/// 题干行：正文左齐，括号贴版心右缘
#let _xt-stem(stem, blank) = {
  set par(first-line-indent: 0pt, justify: false, leading: 0.65em)
  grid(
    columns: (1fr, auto),
    column-gutter: 0.6em,
    align: (left + horizon, right + horizon),
    stem, blank,
  )
}

/// 选择题
/// - cols：列数；`auto`（默认）尽量多列同行；`1` 分行；`≥2` 等宽分栏
/// - answer-fill：括号内答案色（`auto`＝练习题隐藏/调试色；见 #exercise-debug）
/// - col-gutter / row-gutter：列 / 行间距
#let xzt(
  cols: auto,
  answer-fill: auto,
  col-gutter: 1.2em,
  row-gutter: 0.45em,
  body,
) = context {
  let answer-fill = exercise-resolve-fill(answer-fill)
  let (stem, items) = _xt-collect(body)
  assert(
    items.len() > 0,
    message: "选择题须用 - / + 列出至少一项选项（+ 为正确项）",
  )
  if cols != auto {
    assert(
      type(cols) == int and cols >= 1,
      message: "xt 的 cols 须为 auto 或 ≥1 的整数",
    )
  }

  let answers = range(items.len()).filter(i => items.at(i).correct)
  metadata((
    kind: "xt",
    answers: answers,
    n: items.len(),
    multi: answers.len() >= 2,
  ))

  set par(first-line-indent: 0pt)
  block(
    width: 100%,
    breakable: true,
    inset: (top: 0.1em, bottom: 0.25em),
    {
      // 子块之间不另加段落间距，题干↔选项只用正文行距
      set block(spacing: 0pt)
      if not _xt-stem-empty(stem) {
        _xt-stem(stem, _xt-blank(answers, answer-fill: answer-fill))
        context v(par.leading, weak: true)
      }
      if cols == auto {
        layout(bounds => {
          let c = _xt-auto-cols(items, bounds.width, col-gutter: col-gutter)
          _xt-grid(items, c, col-gutter: col-gutter, row-gutter: row-gutter)
        })
      } else {
        _xt-grid(items, cols, col-gutter: col-gutter, row-gutter: row-gutter)
      }
    },
  )
}
