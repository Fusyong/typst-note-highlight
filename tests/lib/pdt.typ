/// 判断对错（#pdt）
///
/// 用法：
/// ```
/// #pdt[
///   根据短文判断对错
///   + “走”在文中的意思是奔跑。
///   - 兔子撞上树桩折颈而死，是经常发生的事。
///   + 宋人守株待兔，结果被宋国人嘲笑。
/// ]
/// ```
/// - 题干：选项之前的正文（可选）；末尾自动附加「对的打“✓”，错的打“✗”。」
/// - 选项：`+` 正确（括号内填 ✓），`-` 错误（括号内填 ✗）；序号一律 `A. B. C.…`
/// - 每项一行，括号贴版心右缘；答案默认透明（便于透印/校对）
/// - 答案以 metadata 记录（kind: "pdt"）

#import "exercise.typ": exercise-resolve-fill
#import "xzt.typ": _xt-collect, _xt-stem-empty

#let _pd-plain(it) = {
  if type(it) == str {
    it
  } else if it == none {
    ""
  } else if type(it) != content {
    str(it)
  } else if it.has("text") {
    it.text
  } else if it.has("children") {
    let s = it.children.map(_pd-plain).join()
    if s == none { "" } else { s }
  } else if it.has("body") {
    _pd-plain(it.body)
  } else {
    ""
  }
}

#let _pd-hint(true-mark, false-mark) = [对的打“#true-mark”，错的打“#false-mark”。]

#let _pd-is-ws(c) = {
  if type(c) == str {
    c.trim() == ""
  } else if type(c) != content {
    false
  } else if c.has("text") {
    c.text.trim() == ""
  } else {
    let f = repr(c.func())
    f == "space" or f.starts-with("linebreak") or f.starts-with("parbreak")
  }
}

/// 去掉题干末尾空白 / 换行，避免接说明时多出空格
#let _pd-trim-end(it) = {
  if type(it) == str {
    it.trim(at: end)
  } else if type(it) != content {
    it
  } else if it.has("text") {
    let t = it.text.trim(at: end)
    if t == "" { [] } else { t }
  } else if it.has("children") {
    let cs = it.children
    let j = cs.len()
    while j > 0 and _pd-is-ws(cs.at(j - 1)) {
      j -= 1
    }
    if j <= 0 {
      []
    } else {
      let last-piece = _pd-trim-end(cs.at(j - 1))
      if j == 1 {
        last-piece
      } else {
        cs.slice(0, j - 1).join() + last-piece
      }
    }
  } else {
    it
  }
}

/// 题干末尾接上打钩打叉说明；已写过则不再重复
#let _pd-stem-with-hint(stem, true-mark, false-mark) = {
  set par(first-line-indent: 0pt, justify: false, leading: 0.65em)
  let hint = _pd-hint(true-mark, false-mark)
  if _xt-stem-empty(stem) {
    hint
  } else {
    let stem = _pd-trim-end(stem)
    let plain = _pd-plain(stem).trim()
    if plain.contains("对的打") {
      stem
    } else {
      let last = if plain == "" { "" } else { plain.clusters().at(-1) }
      let punct = "，。、；：！？,.;:!?"
      stem
      if last != "" and not punct.contains(last) { [，] }
      hint
    }
  }
}

/// 单条选项：`A.` + 正文左齐，括号贴右缘
#let _pd-row(
  body,
  correct,
  i,
  answer-fill: rgb(0%, 0%, 0%, 0%),
  true-mark: "✓",
  false-mark: "✗",
) = {
  set par(first-line-indent: 0pt, justify: false, leading: 0.65em)
  let mark = if correct { true-mark } else { false-mark }
  let blank = [（ #text(fill: answer-fill, mark) ）]
  grid(
    columns: (1.6em, 1fr, auto),
    column-gutter: (0.15em, 0.6em),
    align: (right + top, left + horizon, right + horizon),
    numbering("A. ", i + 1), body, blank,
  )
}

/// 判断对错
/// - answer-fill：括号内 ✓/✗ 色（`auto`＝练习题隐藏/调试色；见 #exercise-debug）
/// - true-mark / false-mark：正确 / 错误记号（题干说明与括号内一致）
#let pdt(
  answer-fill: auto,
  true-mark: "✓",
  false-mark: "✗",
  row-gutter: auto,
  body,
) = context {
  let answer-fill = exercise-resolve-fill(answer-fill)
  let (stem, items) = _xt-collect(body)
  assert(
    items.len() > 0,
    message: "判断对错须用 - / + 列出至少一条选项（+ 为正确，- 为错误）",
  )

  let answers = items.map(it => it.correct)
  metadata((
    kind: "pdt",
    answers: answers,
    n: items.len(),
  ))

  let rg = if row-gutter == auto { par.leading } else { row-gutter }
  set par(first-line-indent: 0pt)
  block(
    width: 100%,
    // 选项通常不长，整组题放在一页，避免题干孤行
    breakable: false,
    inset: (top: 0.1em, bottom: 0.25em),
    {
      set block(spacing: 0pt)
      _pd-stem-with-hint(stem, true-mark, false-mark)
      context v(par.leading, weak: true)
      grid(
        columns: (1fr,),
        row-gutter: rg,
        ..range(items.len()).map(i => _pd-row(
          items.at(i).body,
          items.at(i).correct,
          i,
          answer-fill: answer-fill,
          true-mark: true-mark,
          false-mark: false-mark,
        )),
      )
    },
  )
}
