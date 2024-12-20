import { BitArray, List, UtfCodepoint, CustomType } from "./gleam.mjs";
import Dict from "../gleam_stdlib/dict.mjs";

const origStdoutWrite = process.stdout.write;
const origStderrWrite = process.stderr.write;
export function silence() {
  process.stdout.write = () => {};
  process.stderr.write = () => {};
}

export function unsilence() {
  process.stdout.write = origStdoutWrite;
  process.stderr.write = origStderrWrite;
}

export function float_to_string(float) {
  const string = float.toString().replace("+", "");
  if (string.indexOf(".") >= 0) {
    return string;
  } else {
    const index = string.indexOf("e");
    if (index >= 0) {
      return string.slice(0, index) + ".0" + string.slice(index);
    } else {
      return string + ".0";
    }
  }
}

function getDefaultValues(ctx) {
  const {
    breakLength = typeof process !== undefined && process.stdout.isTTY
      ? process.stdout.columns
      : 80,
  } = ctx;
  return { breakLength };
}

export function inspect(v, ctxArg = {}) {
  const ctx = getDefaultValues(ctxArg);
  const t = typeof v;

  let ret;
  if (v === true) ret = "True";
  else if (v === false) ret = "False";
  else if (v === null) ret = "//js(null)";
  else if (v === undefined) ret = "Nil";
  else if (t === "string") ret = inspectString(v, ctx);
  else if (t === "bigint" || Number.isInteger(v)) ret = v.toString();
  else if (t === "number") ret = float_to_string(v);
  else if (Array.isArray(v))
    ret = inspectArray(v, ctx, { prefix: "#(", suffix: ")" });
  else if (v instanceof List) ret = inspectList(v, ctx);
  else if (v instanceof UtfCodepoint) ret = inspectUtfCodepoint(v, ctx);
  else if (v instanceof BitArray) ret = inspectBitArray(v, ctx);
  else if (v instanceof CustomType) ret = inspectCustomType(v, ctx);
  else if (v instanceof Dict) ret = inspectDict(v, ctx);
  else if (v instanceof Set)
    ret = `//js(Set(${[...v].map(inspect).join(", ")}))`;
  else if (v instanceof RegExp) ret = `//js(${v})`;
  else if (v instanceof Date) ret = `//js(Date("${v.toISOString()}"))`;
  else if (v instanceof Function) {
    const args = [];
    for (const i of Array(v.length).keys())
      args.push(String.fromCharCode(i + 97));
    ret = `//fn(${args.join(", ")}) { ... }`;
  } else ret = inspectObject(v, ctx);

  return ret;
}

function inspectString(str) {
  let new_str = '"';
  for (let i = 0; i < str.length; i++) {
    let char = str[i];
    switch (char) {
      case "\n":
        new_str += "\\n";
        break;
      case "\r":
        new_str += "\\r";
        break;
      case "\t":
        new_str += "\\t";
        break;
      case "\f":
        new_str += "\\f";
        break;
      case "\\":
        new_str += "\\\\";
        break;
      case '"':
        new_str += '\\"';
        break;
      default:
        if (char < " " || (char > "~" && char < "\u{00A0}")) {
          new_str +=
            "\\u{" +
            char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") +
            "}";
        } else {
          new_str += char;
        }
    }
  }
  new_str += '"';
  return new_str;
}

function inspectDict(map, ctxArg) {
  const ctx = getDefaultValues(ctxArg);
  const arr = [];
  map.forEach((value, key) => {
    arr.push([key, value]);
  });
  return inspectArray(arr, ctx, {
    prefix: "dict.from_list([",
    suffix: "])",
  });
}

// function inspectDict(map, ctxArg) {
// const ctx = getDefaultValues(ctxArg);
// let body = "dict.from_list([";
// let first = true;
// map.forEach((value, key) => {
// if (!first) body = body + ", ";
// body = body + "#(" + inspect(key, ctx) + ", " + inspect(value, ctx) + ")";
// first = false;
// });
// return body + "])";
// }

function inspectObject(v, ctxArg) {
  const ctx = getDefaultValues(ctxArg);
  const name = Object.getPrototypeOf(v)?.constructor?.name || "Object";
  const props = [];
  for (const k of Object.keys(v)) {
    props.push(`${inspect(k, ctx)}: ${inspect(v[k], ctx)}`);
  }
  const body = props.length ? " " + props.join(", ") + " " : "";
  const head = name === "Object" ? "" : name + " ";
  return `//js(${head}{${body}})`;
}

function inspectCustomType(record, ctxArg) {
  const ctx = getDefaultValues(ctxArg);
  const props = Object.keys(record)
    .map((label) => {
      const value = inspect(record[label], ctxArg);
      return isNaN(parseInt(label)) ? `${label}: ${value}` : value;
    })
    .join(", ");
  return props
    ? `${record.constructor.name}(${props})`
    : record.constructor.name;
}

export function inspectList(list, ctxArg) {
  return inspectArray(list.toArray(), ctxArg);
}

// TODO: Make sure the prefix/suffix doesn't cause the line to overflow
// and don't iterate multiple times lmao
function inspectArray(arr, ctxArg, fixes = {}) {
  const { prefix = "[", suffix = "]" } = fixes;
  const ctx = getDefaultValues(ctxArg);
  const childCtx = { ...ctx, breakLength: ctx.breakLength - 2 };
  const innerLines = arr
    .reduce(
      ([lines, currLine], item) => {
        const itemLines = `${inspect(item, childCtx)}, `.split("\n");
        const itemStrWidth = Math.max(...itemLines.map((l) => l.length));

        if (itemLines.length === 1) {
          const itemStr = itemLines[0];
          if (itemStrWidth + currLine.length + 3 > ctx.breakLength) {
            return [[...lines, currLine.replace(/, $/, ",")], itemStr];
          } else {
            return [lines, currLine + itemStr];
          }
        } else {
          return [[...lines, currLine, ...itemLines], ""];
        }
      },
      [[], ""]
    )
    .flat()
    .filter((line) => line.trim().length > 0);

  let totalPrefix, totalSuffix, inner;
  if (innerLines.length > 1) {
    inner = innerLines
      .map((line) => `  ${line}`)
      .join("\n")
      .replace(/, $/, ",");
    totalPrefix = `${prefix}\n`;
    totalSuffix = `\n${suffix}`;
  } else {
    totalPrefix = prefix;
    totalSuffix = suffix;
    inner = innerLines[0] ?? "";
  }

  return `${totalPrefix}${inner.replace(/, $/, "")}${totalSuffix}`;
}

export function inspectBitArray(bits) {
  return `<<${Array.from(bits.buffer).join(", ")}>>`;
}

export function inspectUtfCodepoint(codepoint) {
  return `//utfcodepoint(${String.fromCodePoint(codepoint.value)})`;
}
