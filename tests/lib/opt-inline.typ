/// 句中选项共用：解析 `[+ 甲 | - 乙]`，排成（甲   乙）
/// 供 #hct / #gzt 使用

#let _oi-seq = [].func()

#let _oi-is-ws(c) = {
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

#let _oi-trim-start(it) = {
  if it == none or it == [] or it == "" {
    []
  } else if type(it) == str {
    let t = it.trim(at: start)
    if t == "" { [] } else { t }
  } else if type(it) != content {
    it
  } else if _oi-is-ws(it) {
    []
  } else if it.has("text") {
    let t = it.text.trim(at: start)
    if t == "" { [] } else { t }
  } else if it.func() == _oi-seq {
    let cs = it.children
    let i = 0
    while i < cs.len() {
      let t = _oi-trim-start(cs.at(i))
      if t == [] {
        i += 1
      } else if i == 0 and t == cs.at(i) {
        return it
      } else {
        return (t, ..cs.slice(i + 1)).join()
      }
    }
    []
  } else if it.has("body") {
    _oi-trim-start(it.body)
  } else {
    it
  }
}

#let _oi-trim-end(it) = {
  if it == none or it == [] or it == "" {
    []
  } else if type(it) == str {
    let t = it.trim(at: end)
    if t == "" { [] } else { t }
  } else if type(it) != content {
    it
  } else if _oi-is-ws(it) {
    []
  } else if it.has("text") {
    let t = it.text.trim(at: end)
    if t == "" { [] } else { t }
  } else if it.func() == _oi-seq {
    let cs = it.children
    let j = cs.len()
    while j > 0 {
      let t = _oi-trim-end(cs.at(j - 1))
      if t == [] {
        j -= 1
      } else if j == cs.len() and t == cs.at(j - 1) {
        return it
      } else {
        return (..cs.slice(0, j - 1), t).join()
      }
    }
    []
  } else if it.has("body") {
    _oi-trim-end(it.body)
  } else {
    it
  }
}

#let _oi-trim(it) = _oi-trim-end(_oi-trim-start(it))

#let _oi-plain(it) = {
  if type(it) == str {
    it
  } else if it == none {
    ""
  } else if type(it) != content {
    str(it)
  } else if it.has("text") {
    it.text
  } else if it.has("children") {
    let s = it.children.map(_oi-plain).join()
    if s == none { "" } else { s }
  } else if it.has("body") {
    _oi-plain(it.body)
  } else if repr(it.func()) == "space" {
    " "
  } else {
    ""
  }
}

#let _oi-empty(it) = _oi-plain(it).trim() == ""

/// 按首个 sep 切开；返回 (found, left, right)
#let _oi-split-once(it, sep: "|") = {
  if type(it) == str {
    let parts = it.split(sep)
    if parts.len() >= 2 {
      (true, parts.at(0), parts.slice(1).join(sep))
    } else {
      (false, it, [])
    }
  } else if type(it) != content {
    (false, it, [])
  } else if it.has("text") {
    let (found, l, r) = _oi-split-once(it.text, sep: sep)
    if found { (true, l, r) } else { (false, it, []) }
  } else if it.func() == _oi-seq {
    let left-acc = ()
    for (i, child) in it.children.enumerate() {
      let (found, l, r) = _oi-split-once(child, sep: sep)
      if found {
        let left = if _oi-empty(l) { left-acc } else { left-acc + (l,) }
        let rest = it.children.slice(i + 1)
        let right = if _oi-empty(r) { rest } else { (r,) + rest }
        let lj = if left.len() == 0 { [] } else { left.join() }
        let rj = if right.len() == 0 { [] } else { right.join() }
        return (true, lj, rj)
      }
      left-acc.push(child)
    }
    (false, it, [])
  } else if it.has("body") {
    _oi-split-once(it.body, sep: sep)
  } else {
    (false, it, [])
  }
}

#let _oi-split-all(it, sep: "|") = {
  let (found, l, r) = _oi-split-once(it, sep: sep)
  if found {
    (_oi-trim(l),) + _oi-split-all(r, sep: sep)
  } else {
    (_oi-trim(it),)
  }
}

/// 从片段开头取 `+` / `-`（含单独成节点的符号）
#let _oi-take-sign(it) = {
  let it = _oi-trim-start(it)
  if it == none or it == [] or it == "" {
    (none, [])
  } else if type(it) == str {
    let rest-of(s) = {
      let cs = s.clusters()
      if cs.len() <= 1 {
        ""
      } else {
        cs.slice(1).join().trim(at: start)
      }
    }
    if it.starts-with("+") {
      ("+", rest-of(it))
    } else if it.starts-with("-") {
      ("-", rest-of(it))
    } else {
      (none, it)
    }
  } else if type(it) != content {
    (none, it)
  } else if it.has("text") {
    _oi-take-sign(it.text)
  } else if it.func() == _oi-seq {
    let cs = it.children
    if cs.len() == 0 {
      (none, [])
    } else {
      let (sign, rest0) = _oi-take-sign(cs.at(0))
      if sign != none {
        let rest = if _oi-empty(rest0) { cs.slice(1) } else { (rest0,) + cs.slice(1) }
        let joined = if rest.len() == 0 { [] } else { rest.join() }
        (sign, _oi-trim-start(joined))
      } else {
        (none, it)
      }
    }
  } else {
    (none, it)
  }
}

#let _oi-sign-and-body(piece, default) = {
  let (sign, rest) = _oi-take-sign(piece)
  let correct = if sign == "+" {
    true
  } else if sign == "-" {
    false
  } else {
    assert(
      default != none,
      message: "选项须以 +（正确）或 -（错误）开头，例如：+ 放下 | - 释放",
    )
    default
  }
  let body = _oi-trim(rest)
  assert(not _oi-empty(body), message: "+ / - 之后的选项文字不能为空")
  (correct: correct, body: body)
}

/// 解析 `[+ 甲 | - 乙]` 或分行列举；`+`＝事实上正确，`-`＝事实上错误
#let _oi-parse(opts) = {
  let from-item(it, first-correct) = {
    _oi-split-all(it.body).enumerate().map(((i, seg)) => {
      _oi-sign-and-body(seg, if i == 0 { first-correct } else { none })
    })
  }
  let walk(it) = {
    if type(it) != content {
      ()
    } else if it.func() == enum.item {
      from-item(it, true)
    } else if it.func() == list.item {
      from-item(it, false)
    } else if it.func() == enum or it.func() == list {
      let parts = it.children.map(walk).join()
      if parts == none { () } else { parts }
    } else if it.has("children") {
      let parts = it.children.map(walk).join()
      if parts == none { () } else { parts }
    } else {
      ()
    }
  }
  let items = walk(opts)
  assert(
    items.len() > 0,
    message: "须用 + / - 列出至少一项，并用 | 分隔，例如：+ 放下 | - 释放",
  )
  items
}

/// 在选项文字上叠记号（place，不改变占位；透明/调试色版面一致）
/// - `\` / ✓：居中叠放（同字号符号，不拉伸）
#let _oi-overlay(body, mark, fill, size: 1.15em) = context {
  let m = measure(body)
  let h = calc.max(m.height, 1em.to-absolute())
  box(
    width: m.width,
    height: h,
    baseline: bottom,
    clip: true,
    {
      body
      place(center + horizon, text(fill: fill, size: size, mark))
    },
  )
}

/// 单项：仅选项文字；overlay 为 none 则不叠记号
#let _oi-option(it, overlay, fill, overlay-size: 1.15em) = {
  if overlay == none {
    it.body
  } else {
    _oi-overlay(it.body, overlay, fill, size: overlay-size)
  }
}

/// 被注词 + 行内选项：`词（甲   乙）`（无序号）
#let _oi-inline(word, items, overlay-of, fill, overlay-size: 1.15em) = {
  word
  h(0.12em)
  [（]
  for (i, it) in items.enumerate() {
    if i > 0 { h(1.2em) }
    _oi-option(it, overlay-of(it), fill, overlay-size: overlay-size)
  }
  [）]
}
