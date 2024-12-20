import gleam/dict
import gleam/io
import gleam/iterator
import gleam/list
import gleam/regex
import gleam/set
import gleam/string
import gleamy/bench

type Vec {
  Vec(x: Int, y: Int)
}

type VecPair {
  VecPair(v1: Vec, v2: Vec)
}

type Season {
  Spring
  Summer
  Autumn
  Winter
}

@external(erlang, "pretty_debug", "pretty_inspect")
@external(javascript, "./pretty_debug_js.mjs", "inspect")
pub fn pretty_inspect(term: anything) -> String

/// Disable writing to stdout and stderr.
@external(erlang, "pretty_debug", "silence")
@external(javascript, "./pretty_debug_js.mjs", "silence")
fn silence() -> Nil

@external(erlang, "pretty_debug", "unsilence")
@external(javascript, "./pretty_debug_js.mjs", "unsilence")
fn unsilence() -> Nil

pub fn pretty_debug(term: anything) -> anything {
  term |> pretty_inspect |> io.println

  term
}

pub fn main() {
  let to_debug = #(
    #("lists", "implicitly checked"),
    #("tuples", "implicitly checked"),
    #("strings", ["a", "bc", "defg", "😎"]),
    #("ints", [1, 2, 3, 4, -5]),
    #(
      "floats",
      // the 1.0 doesn't display well in JS even with the native debug, likely
      // due to JS not distinguishing between ints and floats. there's not much
      // that can be done here unless we wrap ints/floats :/
      [1.0, 2.1, 3.1415, 4.9999999999999, -5.1],
    ),
    #("enums", [Spring, Summer, Autumn, Winter]),
    #("records 1", [
      iterator.range(0, 10)
      |> iterator.map(fn(i) { Vec(i, i * 2) })
      |> iterator.to_list,
    ]),
    #("records 2", [
      iterator.range(0, 10)
      |> iterator.map(fn(i) { VecPair(Vec(i, i * 2), Vec(i, i)) })
      |> iterator.to_list,
    ]),
    "dicts",
    dict.from_list([#(1, 2), #(3, 4), #(5, 6), #(7, 8), #(9, 10)]),
    dict.from_list(
      iterator.range(0, 5)
      |> iterator.map(fn(i) { #(i, Vec(i, i * 2)) })
      |> iterator.to_list,
    ),
    "sets",
    set.from_list([1, 2, 3, 4, 5]),
    set.from_list(
      iterator.range(0, 10)
      |> iterator.map(fn(i) { #(i, Vec(i, i * 2)) })
      |> iterator.to_list,
    ),
    "iterators",
    iterator.range(0, 10),
    "bools",
    [True, False],
    "bit array",
    [<<0xFF:size(8)>>, <<0xFFFFFFFF:size(32)>>, <<0xDEADBEEF:size(32)>>],
    "functions",
    fn(x) { x + 1 },
    "regex",
    regex.compile("^[0-9]", regex.Options(False, False)),
  )

  io.println(string.repeat("=", 80))
  io.println(string.repeat(" ", 32) <> "Showcase")
  io.println(string.repeat("=", 80))

  io.println("Native debug")
  io.debug(to_debug)
  io.println("")

  io.println("Pretty debug")
  pretty_debug(to_debug)
  io.println("")

  io.println(string.repeat("=", 80))
  io.println(string.repeat(" ", 31) <> "Benchmark")
  io.println(string.repeat("=", 80))
  silence()
  let benchmark =
    bench.run(
      [bench.Input("base", list.repeat(to_debug, 1000))],
      [
        bench.Function("native", io.debug),
        bench.Function("pretty", pretty_debug),
      ],
      [bench.Duration(1000), bench.Warmup(100)],
    )

  unsilence()
  benchmark
  |> bench.table([bench.IPS, bench.Min, bench.P(99)])
  |> io.println

  Nil
}
