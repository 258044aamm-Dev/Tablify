"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TablifyPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/commands/import.ts
var import_obsidian = require("obsidian");

// src/io/csv.ts
var CSV_CHUNK_SIZE = 64 * 1024;
var CsvStreamParser = class {
  onRow;
  delimiter;
  hadBom = false;
  started = false;
  // Delimiter detection buffer (used until the first record is complete).
  head = "";
  headScanIdx = 0;
  headInQuote = false;
  headDone = false;
  headCommas = 0;
  headSemis = 0;
  // Record state machine.
  state = "FIELD_START";
  row = [];
  field = "";
  skipLF = false;
  line = 1;
  column = 1;
  rowCount = 0;
  failure = null;
  constructor(options) {
    this.onRow = options.onRow;
    this.delimiter = options.delimiter ?? null;
  }
  push(chunk) {
    if (this.failure || chunk.length === 0)
      return;
    if (!this.started) {
      this.started = true;
      if (chunk.charCodeAt(0) === 65279) {
        this.hadBom = true;
        chunk = chunk.slice(1);
      }
    }
    if (this.delimiter === null) {
      this.head += chunk;
      this.scanHead();
      if (!this.headDone)
        return;
      this.delimiter = this.decideDelimiter();
      const buffered = this.head;
      this.head = "";
      this.feed(buffered);
      return;
    }
    this.feed(chunk);
  }
  end() {
    if (this.failure)
      return this.failureResult();
    if (this.delimiter === null) {
      this.delimiter = this.decideDelimiter();
      const buffered = this.head;
      this.head = "";
      this.feed(buffered);
      if (this.failure)
        return this.failureResult();
    }
    if (this.state === "QUOTED") {
      return this.fail("Unterminated quoted field at end of input");
    }
    if (this.state === "QUOTE_SEEN" || this.row.length > 0 || this.field.length > 0 || this.state !== "FIELD_START") {
      this.pushField();
      this.emitRow();
    }
    return { ok: true, delimiter: this.delimiter, hadBom: this.hadBom, rowCount: this.rowCount };
  }
  // ---- delimiter detection -------------------------------------------------
  /** Scan the buffered head until the first record ends (unquoted newline). */
  scanHead() {
    const s = this.head;
    let i = this.headScanIdx;
    while (i < s.length) {
      const c = s.charCodeAt(i);
      if (c === 34) {
        this.headInQuote = !this.headInQuote;
      } else if (!this.headInQuote) {
        if (c === 10 || c === 13) {
          this.headDone = true;
          break;
        }
        if (c === 44)
          this.headCommas++;
        else if (c === 59)
          this.headSemis++;
      }
      i++;
    }
    this.headScanIdx = i;
  }
  decideDelimiter() {
    return this.headSemis > this.headCommas ? ";" : ",";
  }
  // ---- record state machine ------------------------------------------------
  feed(text) {
    const delim = this.delimiter;
    const delimCode = delim.charCodeAt(0);
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (this.skipLF) {
        this.skipLF = false;
        if (c === 10) {
          this.advance(c);
          continue;
        }
      }
      switch (this.state) {
        case "FIELD_START":
          if (c === 34) {
            this.state = "QUOTED";
          } else if (c === delimCode) {
            this.pushField();
          } else if (c === 10 || c === 13) {
            this.endRecord(c);
          } else {
            this.field = text[i];
            this.state = "UNQUOTED";
          }
          break;
        case "UNQUOTED":
          if (c === delimCode) {
            this.pushField();
            this.state = "FIELD_START";
          } else if (c === 10 || c === 13) {
            this.endRecord(c);
            this.state = "FIELD_START";
          } else {
            this.field += text[i];
          }
          break;
        case "QUOTED":
          if (c === 34) {
            this.state = "QUOTE_SEEN";
          } else {
            this.field += text[i];
          }
          break;
        case "QUOTE_SEEN":
          if (c === 34) {
            this.field += '"';
            this.state = "QUOTED";
          } else if (c === delimCode) {
            this.pushField();
            this.state = "FIELD_START";
          } else if (c === 10 || c === 13) {
            this.endRecord(c);
            this.state = "FIELD_START";
          } else {
            this.fail(`Unexpected character after closing quote: "${text[i]}"`);
            return;
          }
          break;
      }
      this.advance(c);
      if (this.failure)
        return;
    }
  }
  advance(c) {
    if (c === 10 || c === 13) {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
  }
  pushField() {
    this.row.push(this.field);
    this.field = "";
  }
  endRecord(c) {
    this.pushField();
    this.emitRow();
    if (c === 13)
      this.skipLF = true;
  }
  emitRow() {
    const row = this.row;
    this.row = [];
    this.rowCount++;
    this.onRow(row);
  }
  fail(error) {
    this.failure = { error, line: this.line, column: this.column };
    return this.failureResult();
  }
  failureResult() {
    const f = this.failure;
    return { ok: false, error: f.error, line: f.line, column: f.column, rowCount: this.rowCount };
  }
};
function parseCsv(input, options = {}) {
  const rows = [];
  const parser = new CsvStreamParser({ ...options, onRow: (r) => rows.push(r) });
  for (let pos = 0; pos < input.length; pos += CSV_CHUNK_SIZE) {
    parser.push(input.slice(pos, pos + CSV_CHUNK_SIZE));
  }
  const res = parser.end();
  if (!res.ok)
    return { ok: false, error: res.error, line: res.line, column: res.column };
  return { ok: true, delimiter: res.delimiter, rows, hadBom: res.hadBom };
}

// node_modules/read-excel-file/modules/xml/xmlBrowser.js
var xmlBrowser_default = {
  createDocument: function createDocument(content) {
    return new DOMParser().parseFromString(content.trim(), "text/xml");
  }
};

// node_modules/fflate/esm/browser.js
var ch2 = {};
var wk = function(c, id, msg, transfer, cb) {
  var w = new Worker(ch2[id] || (ch2[id] = URL.createObjectURL(new Blob([
    c + ';addEventListener("error",function(e){e=e.error;postMessage({$e$:[e.message,e.code,e.stack]})})'
  ], { type: "text/javascript" }))));
  w.onmessage = function(e) {
    var d = e.data, ed = d.$e$;
    if (ed) {
      var err2 = new Error(ed[0]);
      err2["code"] = ed[1];
      err2.stack = ed[2];
      cb(err2, null);
    } else
      cb(null, d);
  };
  w.postMessage(msg, transfer);
  return w;
};
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j = b[i]; j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = function(cd, mb, r) {
  var s = cd.length;
  var i = 0;
  var l = new u16(mb);
  for (; i < s; ++i) {
    if (cd[i])
      ++l[cd[i] - 1];
  }
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l[i - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        var sv = i << 4 | cd[i];
        var r_1 = mb - cd[i];
        var v = le[cd[i] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
      }
    }
  }
  return co;
};
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m)
      m = a[i];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i = sym - 257, b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var wcln = function(fn, fnStr, td2) {
  var dt = fn();
  var st = fn.toString();
  var ks = st.slice(st.indexOf("[") + 1, st.lastIndexOf("]")).replace(/\s+/g, "").split(",");
  for (var i = 0; i < dt.length; ++i) {
    var v = dt[i], k = ks[i];
    if (typeof v == "function") {
      fnStr += ";" + k + "=";
      var st_1 = v.toString();
      if (v.prototype) {
        if (st_1.indexOf("[native code]") != -1) {
          var spInd = st_1.indexOf(" ", 8) + 1;
          fnStr += st_1.slice(spInd, st_1.indexOf("(", spInd));
        } else {
          fnStr += st_1;
          for (var t in v.prototype)
            fnStr += ";" + k + ".prototype." + t + "=" + v.prototype[t].toString();
        }
      } else
        fnStr += st_1;
    } else
      td2[k] = v;
  }
  return fnStr;
};
var ch = [];
var cbfs = function(v) {
  var tl = [];
  for (var k in v) {
    if (v[k].buffer) {
      tl.push((v[k] = new v[k].constructor(v[k])).buffer);
    }
  }
  return tl;
};
var wrkr = function(fns, init, id, cb) {
  if (!ch[id]) {
    var fnStr = "", td_1 = {}, m = fns.length - 1;
    for (var i = 0; i < m; ++i)
      fnStr = wcln(fns[i], fnStr, td_1);
    ch[id] = { c: wcln(fns[m], fnStr, td_1), e: td_1 };
  }
  var td2 = mrg({}, ch[id].e);
  return wk(ch[id].c + ";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage=" + init.toString() + "}", id, td2, cbfs(td2), cb);
};
var bInflt = function() {
  return [u8, u16, i32, fleb, fdeb, clim, fl, fd, flrm, fdrm, rev, ec, hMap, max, bits, bits16, shft, slc, err, inflt, inflateSync, pbf, gopt];
};
var pbf = function(msg) {
  return postMessage(msg, [msg.buffer]);
};
var gopt = function(o) {
  return o && {
    out: o.size && new u8(o.size),
    dictionary: o.dictionary
  };
};
var cbify = function(dat, opts, fns, init, id, cb) {
  var w = wrkr(fns, init, id, function(err2, dat2) {
    w.terminate();
    cb(err2, dat2);
  });
  w.postMessage([dat, opts], opts.consume ? [dat.buffer] : []);
  return function() {
    w.terminate();
  };
};
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
function inflate(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  return cbify(data, opts, [
    bInflt
  ], function(ev) {
    return pbf(inflateSync(ev.data[0], gopt(ev.data[1])));
  }, 1, cb);
}
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i = 0; ; ) {
    var c = d[i++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i + eb > d.length)
      return { s: r, r: slc(d, i - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | d[i++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | d[i++] & 63);
  }
};
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i = 0; i < dat.length; i += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
  var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
};
var z64hs = function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
};
var mt = typeof queueMicrotask == "function" ? queueMicrotask : typeof setTimeout == "function" ? setTimeout : function(fn) {
  fn();
};
function unzip(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  var term = [];
  var tAll = function() {
    for (var i2 = 0; i2 < term.length; ++i2)
      term[i2]();
  };
  var files = {};
  var cbd = function(a, b) {
    mt(function() {
      cb(a, b);
    });
  };
  mt(function() {
    cbd = cb;
  });
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558) {
      cbd(err(13, 0, 1), null);
      return tAll;
    }
  }
  ;
  var lft = b2(data, e + 8);
  if (lft) {
    var c = lft;
    var o = b4(data, e + 16);
    var z = b4(data, e - 20) == 117853008;
    if (z) {
      var ze = b4(data, e - 12);
      z = b4(data, ze) == 101075792;
      if (z) {
        c = lft = b4(data, ze + 32);
        o = b4(data, ze + 48);
      }
    }
    var fltr = opts && opts.filter;
    var _loop_3 = function(i2) {
      var _a2 = zh(data, o, z), c_1 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
      o = no;
      var cbl = function(e2, d) {
        if (e2) {
          tAll();
          cbd(e2, null);
        } else {
          if (d)
            files[fn] = d;
          if (!--lft)
            cbd(null, files);
        }
      };
      if (!fltr || fltr({
        name: fn,
        size: sc,
        originalSize: su,
        compression: c_1
      })) {
        if (!c_1)
          cbl(null, slc(data, b, b + sc));
        else if (c_1 == 8) {
          var infl = data.subarray(b, b + sc);
          if (su < 524288 || sc > 0.8 * su) {
            try {
              cbl(null, inflateSync(infl, { out: new u8(su) }));
            } catch (e2) {
              cbl(e2, null);
            }
          } else
            term.push(inflate(infl, { size: su }, cbl));
        } else
          cbl(err(14, "unknown compression type " + c_1, 1), null);
      } else
        cbl(null, null);
    };
    for (var i = 0; i < c; ++i) {
      _loop_3(i);
    }
  } else
    cbd(null, {});
  return tAll;
}

// node_modules/read-excel-file/modules/zip/unzipFromArrayBuffer.js
function unzipFromArrayBuffer(input, options) {
  return unzipFromArrayBufferUsingFunction(input, options, unzipAsync, true);
}
function unzipFromArrayBufferUsingFunction(input) {
  var _ref = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, _filter = _ref.filter;
  var unzip2 = arguments.length > 2 ? arguments[2] : void 0;
  var isAsync = arguments.length > 3 ? arguments[3] : void 0;
  return unzip2(new Uint8Array(input), {
    // Ignore certain types of files.
    filter: function filter(file) {
      if (_filter) {
        return _filter({
          path: file.name
        });
      }
      return true;
    }
  });
}
function unzipAsync(archive) {
  return new Promise(function(resolve, reject) {
    unzip(archive, function(error, files) {
      if (error) {
        reject(error);
      } else {
        resolve(files);
      }
    });
  });
}

// node_modules/read-excel-file/modules/export/convertValuesFromUint8ArraysToStrings.js
function convertValuesFromUint8ArraysToStrings(entries) {
  var convertedEntries = {};
  for (var _i = 0, _Object$keys = Object.keys(entries); _i < _Object$keys.length; _i++) {
    var key = _Object$keys[_i];
    convertedEntries[key] = strFromU8(entries[key]);
  }
  return convertedEntries;
}

// node_modules/read-excel-file/modules/export/filterZipArchiveEntry.js
function filterZipArchiveEntry(_ref) {
  var path = _ref.path;
  return path.endsWith(".xml") || path.endsWith(".xml.rels");
}

// node_modules/read-excel-file/modules/export/unpackXlsxFileBrowser.js
function unpackXlsxFile(input) {
  if (input instanceof File || input instanceof Blob) {
    return input.arrayBuffer().then(getResultFromArrayBuffer);
  }
  return Promise.resolve(input).then(getResultFromArrayBuffer);
}
function getResultFromArrayBuffer(arrayBuffer) {
  return unzipFromArrayBuffer(arrayBuffer, {
    filter: filterZipArchiveEntry
  }).then(convertValuesFromUint8ArraysToStrings);
}

// node_modules/read-excel-file/modules/xml/dom.js
function findChild(node, tagName) {
  var i = 0;
  while (i < node.childNodes.length) {
    var childNode = node.childNodes[i];
    if (childNode.nodeType === 1 && getTagName(childNode) === tagName) {
      return childNode;
    }
    i++;
  }
}
function findChildren(node, tagName) {
  var results = [];
  var i = 0;
  while (i < node.childNodes.length) {
    var childNode = node.childNodes[i];
    if (childNode.nodeType === 1 && getTagName(childNode) === tagName) {
      results.push(childNode);
    }
    i++;
  }
  return results;
}
function forEach(node, tagName, func) {
  var i = 0;
  while (i < node.childNodes.length) {
    var childNode = node.childNodes[i];
    if (tagName) {
      if (childNode.nodeType === 1 && getTagName(childNode) === tagName) {
        func(childNode, i);
      }
    } else {
      func(childNode, i);
    }
    i++;
  }
}
function map(node, tagName, func) {
  var results = [];
  forEach(node, tagName, function(node2, i) {
    results.push(func(node2, i));
  });
  return results;
}
var NAMESPACE_REG_EXP = /.+\:/;
function getTagName(element) {
  return element.tagName.replace(NAMESPACE_REG_EXP, "");
}
function isElement(node) {
  return node.nodeType === 1;
}
function getFirstElementChild(element) {
  var i = 0;
  while (i < element.childNodes.length) {
    if (isElement(element.childNodes[i])) {
      return element.childNodes[i];
    }
    i++;
  }
}
function getOuterXml(node) {
  if (node.nodeType !== 1) {
    return node.textContent;
  }
  var xml = "<" + getTagName(node);
  var j = 0;
  while (j < node.attributes.length) {
    xml += " " + node.attributes[j].name + '="' + node.attributes[j].value + '"';
    j++;
  }
  xml += ">";
  var i = 0;
  while (i < node.childNodes.length) {
    xml += getOuterXml(node.childNodes[i]);
    i++;
  }
  xml += "</" + getTagName(node) + ">";
  return xml;
}

// node_modules/read-excel-file/modules/xml/xlsx.js
function getCellElements(document2) {
  var worksheet = document2.documentElement;
  var sheetData = findChild(worksheet, "sheetData");
  var cells = [];
  forEach(sheetData, "row", function(row) {
    forEach(row, "c", function(cell) {
      cells.push(cell);
    });
  });
  return cells;
}
function getCellValueElement(document2, element) {
  return findChild(element, "v");
}
function getCellInlineStringValue(document2, element) {
  var firstElementChild = getFirstElementChild(element);
  if (firstElementChild && getTagName(firstElementChild) === "is") {
    var firstElementChildFirstElementChild = getFirstElementChild(firstElementChild);
    if (firstElementChildFirstElementChild && getTagName(firstElementChildFirstElementChild) === "t") {
      return firstElementChildFirstElementChild.textContent;
    }
  }
}
function getDimensions(document2) {
  var worksheet = document2.documentElement;
  var dimensions = findChild(worksheet, "dimension");
  if (dimensions) {
    return dimensions.getAttribute("ref");
  }
}
function getBaseStyles(document2) {
  var styleSheet = document2.documentElement;
  var cellStyleXfs = findChild(styleSheet, "cellStyleXfs");
  if (cellStyleXfs) {
    return findChildren(cellStyleXfs, "xf");
  }
  return [];
}
function getCellStyles(document2) {
  var styleSheet = document2.documentElement;
  var cellXfs = findChild(styleSheet, "cellXfs");
  if (!cellXfs) {
    return [];
  }
  return findChildren(cellXfs, "xf");
}
function getNumberFormats(document2) {
  var styleSheet = document2.documentElement;
  var numberFormats = [];
  var numFmts = findChild(styleSheet, "numFmts");
  if (numFmts) {
    return findChildren(numFmts, "numFmt");
  }
  return [];
}
function getSharedStrings(document2) {
  var sst = document2.documentElement;
  return map(sst, "si", function(string) {
    var t = findChild(string, "t");
    if (t) {
      return t.textContent;
    }
    var value = "";
    forEach(string, "r", function(r) {
      value += findChild(r, "t").textContent;
    });
    return value;
  });
}
function getWorkbookProperties(document2) {
  var workbook = document2.documentElement;
  return findChild(workbook, "workbookPr");
}
function getRelationships(document2) {
  var relationships = document2.documentElement;
  return findChildren(relationships, "Relationship");
}
function getSheets(document2) {
  var workbook = document2.documentElement;
  var sheets = findChild(workbook, "sheets");
  return findChildren(sheets, "sheet");
}

// node_modules/read-excel-file/modules/xlsx/parseSpreadsheetInfo.js
function _createForOfIteratorHelperLoose(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
    if (it)
      o = it;
    var i = 0;
    return function() {
      if (i >= o.length)
        return { done: true };
      return { done: false, value: o[i++] };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray(o, minLen);
}
function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++)
    arr2[i] = arr[i];
  return arr2;
}
function parseSpreadsheetInfo(content, xml) {
  var book = xml.createDocument(content);
  var workbookProperties = getWorkbookProperties(book);
  var epoch1904 = Boolean(workbookProperties) && workbookProperties.getAttribute("date1904") === "1";
  var sheets = [];
  for (var _iterator = _createForOfIteratorHelperLoose(getSheets(book)), _step; !(_step = _iterator()).done; ) {
    var sheet = _step.value;
    if (sheet.getAttribute("name")) {
      sheets.push({
        id: sheet.getAttribute("sheetId"),
        name: sheet.getAttribute("name"),
        relationId: sheet.getAttribute("r:id")
      });
    }
  }
  return {
    epoch1904,
    sheets
  };
}

// node_modules/read-excel-file/modules/xlsx/parseFilePaths.js
function parseFilePaths(content, xml) {
  var document2 = xml.createDocument(content);
  var filePaths = {
    sheets: {},
    sharedStrings: void 0,
    styles: void 0
  };
  var addFilePathInfo = function addFilePathInfo2(relationship) {
    var filePath = relationship.getAttribute("Target");
    var fileType = relationship.getAttribute("Type");
    switch (fileType) {
      case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles":
        filePaths.styles = getFilePath(filePath);
        break;
      case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings":
        filePaths.sharedStrings = getFilePath(filePath);
        break;
      case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet":
        filePaths.sheets[relationship.getAttribute("Id")] = getFilePath(filePath);
        break;
    }
  };
  getRelationships(document2).forEach(addFilePathInfo);
  return filePaths;
}
function getFilePath(path) {
  if (path[0] === "/") {
    return path.slice("/".length);
  }
  return "xl/" + path;
}

// node_modules/read-excel-file/modules/xlsx/parseStyles.js
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
    return typeof o2;
  } : function(o2) {
    return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
  }, _typeof(o);
}
function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r2) {
      return Object.getOwnPropertyDescriptor(e, r2).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), true).forEach(function(r2) {
      _defineProperty(e, r2, t[r2]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r2) {
      Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
    });
  }
  return e;
}
function _defineProperty(obj, key, value) {
  key = _toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _toPropertyKey(arg) {
  var key = _toPrimitive(arg, "string");
  return _typeof(key) === "symbol" ? key : String(key);
}
function _toPrimitive(input, hint) {
  if (_typeof(input) !== "object" || input === null)
    return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== void 0) {
    var res = prim.call(input, hint || "default");
    if (_typeof(res) !== "object")
      return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
function parseStyles(content, xml) {
  if (!content) {
    return {};
  }
  var doc = xml.createDocument(content);
  var baseStyles = getBaseStyles(doc).map(parseCellStyle);
  var numberFormats = getNumberFormats(doc).map(parseNumberFormatStyle).reduce(function(formats, format) {
    formats[format.id] = format;
    return formats;
  }, []);
  var getCellStyle = function getCellStyle2(xf) {
    if (xf.hasAttribute("xfId")) {
      return _objectSpread(_objectSpread({}, baseStyles[xf.xfId]), parseCellStyle(xf, numberFormats));
    }
    return parseCellStyle(xf, numberFormats);
  };
  return getCellStyles(doc).map(getCellStyle);
}
function parseNumberFormatStyle(numFmt) {
  return {
    id: numFmt.getAttribute("numFmtId"),
    template: numFmt.getAttribute("formatCode")
  };
}
function parseCellStyle(xf, numFmts) {
  var style = {};
  if (xf.hasAttribute("numFmtId")) {
    var numberFormatId = xf.getAttribute("numFmtId");
    if (numFmts[numberFormatId]) {
      style.numberFormat = numFmts[numberFormatId];
    } else {
      style.numberFormat = {
        id: numberFormatId
      };
    }
  }
  return style;
}

// node_modules/read-excel-file/modules/xlsx/parseSharedStrings.js
function parseSharedStrings(content, xml) {
  if (!content) {
    return [];
  }
  return getSharedStrings(xml.createDocument(content));
}

// node_modules/read-excel-file/modules/xlsx/parseExcelDate.js
function parseExcelDate(excelSerialDate, options) {
  if (options && options.epoch1904) {
    excelSerialDate += (1904 - 1900) * DAYS_IN_YEAR + JANUARY_0TH_1900_DAY + ERRONEOUS_FEBRUARY_29_1990_DAY;
  }
  var daysBeforeUnixEpoch = JANUARY_0TH_1900_DAY + ERRONEOUS_FEBRUARY_29_1990_DAY + (1970 - 1900) * DAYS_IN_YEAR + NUMBER_OF_LEAP_YEARS_BETWEEN_1900_AND_1970;
  return new Date(Math.floor((excelSerialDate - daysBeforeUnixEpoch) * DAY));
}
var NUMBER_OF_LEAP_YEARS_BETWEEN_1900_AND_1970 = 17;
var JANUARY_0TH_1900_DAY = 1;
var ERRONEOUS_FEBRUARY_29_1990_DAY = 1;
var DAY = 24 * 60 * 60 * 1e3;
var DAYS_IN_YEAR = 365;

// node_modules/read-excel-file/modules/xlsx/isDateFormat.js
function _createForOfIteratorHelperLoose2(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray2(o)) || allowArrayLike && o && typeof o.length === "number") {
    if (it)
      o = it;
    var i = 0;
    return function() {
      if (i >= o.length)
        return { done: true };
      return { done: false, value: o[i++] };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray2(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray2(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray2(o, minLen);
}
function _arrayLikeToArray2(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++)
    arr2[i] = arr[i];
  return arr2;
}
var DATE_FORMAT_SPECIFIC_LOCALE_PREFIX = /^\[\$-[^\]]+\]/;
var DATE_FORMAT_ALLOW_ANY_OTHER_TEXT_SUFFIX = /;@$/;
var CACHE = {};
function isDateFormatCached(template) {
  if (template in CACHE) {
    return CACHE[template];
  }
  var result = isDateFormat(template);
  CACHE[template] = result;
  return result;
}
function isDateFormat(template) {
  template = template.toLowerCase();
  template = template.replace(DATE_FORMAT_SPECIFIC_LOCALE_PREFIX, "");
  template = template.replace(DATE_FORMAT_ALLOW_ANY_OTHER_TEXT_SUFFIX, "");
  var tokens = template.split(/\W+/);
  if (tokens.length < 0) {
    return false;
  }
  for (var _iterator = _createForOfIteratorHelperLoose2(tokens), _step; !(_step = _iterator()).done; ) {
    var token = _step.value;
    if (DATE_TEMPLATE_TOKENS.indexOf(token) < 0) {
      return false;
    }
  }
  return true;
}
var DATE_TEMPLATE_TOKENS = [
  // Seconds (min two digits). Example: "05".
  "ss",
  // Minutes (min two digits). Example: "05". Could also be "Months". Weird.
  "mm",
  // Hours. Example: "1".
  "h",
  // Hours (min two digits). Example: "01".
  "hh",
  // "AM" part of "AM/PM". Lowercased just in case.
  "am",
  // "PM" part of "AM/PM". Lowercased just in case.
  "pm",
  // Day. Example: "1"
  "d",
  // Day (min two digits). Example: "01"
  "dd",
  // Month (numeric). Example: "1".
  "m",
  // Month (numeric, min two digits). Example: "01". Could also be "Minutes". Weird.
  "mm",
  // Month (shortened month name). Example: "Jan".
  "mmm",
  // Month (full month name). Example: "January".
  "mmmm",
  // Two-digit year. Example: "20".
  "yy",
  // Full year. Example: "2020".
  "yyyy",
  // I don't have any idea what "e" means.
  // It's used in "built-in" XLSX formats:
  // * 27 '[$-404]e/m/d';
  // * 36 '[$-404]e/m/d';
  // * 50 '[$-404]e/m/d';
  // * 57 '[$-404]e/m/d';
  "e"
];

// node_modules/read-excel-file/modules/xlsx/isDateFormatStyle.js
function isDateFormatStyle(styleId, styles, options) {
  if (styleId) {
    var style = styles[styleId];
    if (!style) {
      throw new Error("Cell style not found: ".concat(styleId));
    }
    if (!style.numberFormat) {
      return false;
    }
    if (
      // Whether it's a "number format" that's conventionally used for storing date timestamps.
      BUILT_IN_DATE_FORMAT_IDS.indexOf(Number(style.numberFormat.id)) >= 0 || // Whether it's a "number format" that uses a "formatting template"
      // that the developer is certain is a date formatting template.
      options.dateFormat && style.numberFormat.template === options.dateFormat || // Whether the "smart formatting template" feature is not disabled
      // and it has detected that it's a date formatting template by looking at it.
      options.smartDateParser !== false && style.numberFormat.template && isDateFormatCached(style.numberFormat.template)
    ) {
      return true;
    }
  }
}
var LOCALE_INDEPENDENT_BUILT_IN_DATE_FORMAT_IDS = [
  14,
  // mm-dd-yy
  15,
  // d-mmm-yy
  16,
  // d-mmm
  17,
  // mmm-yy
  18,
  // h:mm AM/PM
  19,
  // h:mm:ss AM/PM
  20,
  // h:mm
  21,
  // h:mm:ss
  22,
  // m/d/yy h:mm
  45,
  // mm:ss
  46,
  // [h]:mm:ss
  47
  // mmss.0
];
var MAINLAND_CHINESE_OR_TAIWANESE_LOCALE_BUILT_IN_DATE_FORMAT_IDS = [
  27,
  // [$-404]e/m/d OR yyyy"年"m"月"
  28,
  // [$-404]e"年"m"月"d"日" OR m"月"d"日"
  29,
  // [$-404]e"年"m"月"d"日" OR m"月"d"日"
  30,
  // m/d/yy OR m-d-yy
  31,
  // yyyy"年"m"月"d"日" OR yyyy"年"m"月"d"日"
  32,
  // hh"時"mm"分" OR h"时"mm"分"
  33,
  // hh"時"mm"分"ss"秒" OR h"时"mm"分"ss"秒"
  34,
  // 上午/下午hh"時"mm"分" OR 上午/下午h"时"mm"分"
  35,
  // 上午/下午hh"時"mm"分"ss"秒" OR 上午/下午h"时"mm"分"ss"秒"
  36,
  // [$-404]e/m/d OR yyyy"年"m"月"
  50,
  // [$-404]e/m/d OR yyyy"年"m"月"
  51,
  // [$-404]e"年"m"月"d"日" OR m"月"d"日"
  52,
  // 上午/下午hh"時"mm"分" OR yyyy"年"m"月"
  53,
  // 上午/下午hh"時"mm"分"ss"秒" OR m"月"d"日"
  54,
  // [$-404]e"年"m"月"d"日" OR m"月"d"日"
  55,
  // 上午/下午hh"時"mm"分" OR 上午/下午h"时"mm"分"
  56,
  // 上午/下午hh"時"mm"分"ss"秒" OR 上午/下午h"时"mm"分"ss"秒"
  57,
  // [$-404]e/m/d OR yyyy"年"m"月"
  58
  // [$-404]e"年"m"月"d"日" OR m"月"d"日"
];
var JAPANESE_OR_KOREAN_LOCALE_BUILT_IN_DATE_FORMAT_IDS = [
  27,
  // [$-411]ge.m.d OR yyyy"年" mm"月" dd"日"
  28,
  // [$-411]ggge"年"m"月"d"日" OR mm-dd
  29,
  // [$-411]ggge"年"m"月"d"日" OR mm-dd
  30,
  // m/d/yy OR mm-dd-yy
  31,
  // yyyy"年"m"月"d"日" OR yyyy"년" mm"월" dd"일"
  32,
  // h"時"mm"分" OR h"시" mm"분"
  33,
  // h"時"mm"分"ss"秒" OR h"시" mm"분" ss"초"
  34,
  // yyyy"年"m"月" OR yyyy-mm-dd
  35,
  // m"月"d"日" OR yyyy-mm-dd
  36,
  // [$-411]ge.m.d OR yyyy"年" mm"月" dd"日"
  50,
  // [$-411]ge.m.d OR yyyy"年" mm"月" dd"日"
  51,
  // [$-411]ggge"年"m"月"d"日" OR mm-dd
  52,
  // yyyy"年"m"月" OR yyyy-mm-dd
  53,
  // m"月"d"日" OR yyyy-mm-dd
  54,
  // [$-411]ggge"年"m"月"d"日" OR mm-dd
  55,
  // yyyy"年"m"月" OR yyyy-mm-dd
  56,
  // m"月"d"日" OR yyyy-mm-dd
  57,
  // [$-411]ge.m.d OR yyyy"年" mm"月" dd"日"
  58
  // [$-411]ggge"年"m"月"d"日" OR mm-dd
];
var THAI_LOCALE_BUILT_IN_DATE_FORMAT_IDS = [
  71,
  // ว/ด/ปปปป
  72,
  // ว-ดดด-ปป
  73,
  // ว-ดดด
  74,
  // ดดด-ปป
  75,
  // ช:นน
  76,
  // ช:นน:ทท
  77,
  // ว/ด/ปปปป ช:นน
  78,
  // นน:ทท
  79,
  // [ช]:นน:ทท
  80,
  // นน:ทท.0
  81
  // d/m/bb
];
var BUILT_IN_DATE_FORMAT_IDS = LOCALE_INDEPENDENT_BUILT_IN_DATE_FORMAT_IDS.concat(
  // Add Mainland Chinese or Taiwanese date format IDs that haven't already been added.
  MAINLAND_CHINESE_OR_TAIWANESE_LOCALE_BUILT_IN_DATE_FORMAT_IDS
).concat(
  // Add Japanese or Korean date format IDs that haven't already been added.
  JAPANESE_OR_KOREAN_LOCALE_BUILT_IN_DATE_FORMAT_IDS.filter(function(numberFormatId) {
    return MAINLAND_CHINESE_OR_TAIWANESE_LOCALE_BUILT_IN_DATE_FORMAT_IDS.indexOf(numberFormatId) < 0;
  })
).concat(
  // Add Thai date format IDs that haven't already been added.
  THAI_LOCALE_BUILT_IN_DATE_FORMAT_IDS.filter(function(numberFormatId) {
    return MAINLAND_CHINESE_OR_TAIWANESE_LOCALE_BUILT_IN_DATE_FORMAT_IDS.indexOf(numberFormatId) < 0;
  }).filter(function(numberFormatId) {
    return JAPANESE_OR_KOREAN_LOCALE_BUILT_IN_DATE_FORMAT_IDS.indexOf(numberFormatId) < 0;
  })
);

// node_modules/read-excel-file/modules/xlsx/parseCellValue.js
function parseCellValue(value, type, _ref) {
  var getInlineStringValue = _ref.getInlineStringValue, getInlineStringXml = _ref.getInlineStringXml, getStyleId = _ref.getStyleId, styles = _ref.styles, sharedStrings = _ref.sharedStrings, epoch1904 = _ref.epoch1904, options = _ref.options;
  if (!type) {
    type = "n";
  }
  switch (type) {
    case "str":
      value = parseString(value, options);
      break;
    case "inlineStr":
      value = getInlineStringValue();
      if (value === void 0) {
        throw new Error('Unsupported "inline string" cell value structure: '.concat(getInlineStringXml()));
      }
      value = parseString(value, options);
      break;
    case "s":
      var sharedStringIndex = Number(value);
      if (isNaN(sharedStringIndex)) {
        throw new Error('Invalid "shared" string index: '.concat(value));
      }
      if (sharedStringIndex >= sharedStrings.length) {
        throw new Error('An out-of-bounds "shared" string index: '.concat(value));
      }
      value = sharedStrings[sharedStringIndex];
      value = parseString(value, options);
      break;
    case "b":
      if (value === "1") {
        value = true;
      } else if (value === "0") {
        value = false;
      } else {
        throw new Error('Unsupported "boolean" cell value: '.concat(value));
      }
      break;
    case "z":
      value = void 0;
      break;
    case "e":
      value = decodeError(value);
      break;
    case "d":
      if (value === void 0) {
        break;
      }
      var parsedDate = new Date(value);
      if (isNaN(parsedDate.valueOf())) {
        throw new Error('Unsupported "date" cell value: '.concat(value));
      }
      value = parsedDate;
      break;
    case "n":
      if (value === void 0) {
        break;
      }
      var styleId = getStyleId();
      if (styleId && isDateFormatStyle(styleId, styles, options)) {
        value = parseNumberDefault(value);
        value = parseExcelDate(value, {
          epoch1904
        });
      } else {
        var parseNumber = options.parseNumber || parseNumberDefault;
        value = parseNumber(value);
      }
      break;
    default:
      throw new TypeError("Cell type not supported: ".concat(type));
  }
  if (value === void 0) {
    value = null;
  }
  return value;
}
function decodeError(errorCode) {
  switch (errorCode) {
    case 0:
      return "#NULL!";
    case 7:
      return "#DIV/0!";
    case 15:
      return "#VALUE!";
    case 23:
      return "#REF!";
    case 29:
      return "#NAME?";
    case 36:
      return "#NUM!";
    case 42:
      return "#N/A";
    case 43:
      return "#GETTING_DATA";
    default:
      return "#ERROR_".concat(errorCode);
  }
}
function parseString(value, options) {
  if (options.trim !== false) {
    value = value.trim();
  }
  if (value === "") {
    value = void 0;
  }
  return value;
}
function parseNumberDefault(stringifiedNumber) {
  var parsedNumber = Number(stringifiedNumber);
  if (isNaN(parsedNumber)) {
    throw new Error('Invalid "numeric" cell value: '.concat(stringifiedNumber));
  }
  return parsedNumber;
}

// node_modules/read-excel-file/modules/xlsx/parseCellCoordinates.js
function _slicedToArray(arr, i) {
  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray3(arr, i) || _nonIterableRest();
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray3(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray3(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray3(o, minLen);
}
function _arrayLikeToArray3(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++)
    arr2[i] = arr[i];
  return arr2;
}
function _iterableToArrayLimit(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l) {
        if (Object(t) !== t)
          return;
        f = false;
      } else
        for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true)
          ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u))
          return;
      } finally {
        if (o)
          throw n;
      }
    }
    return a;
  }
}
function _arrayWithHoles(arr) {
  if (Array.isArray(arr))
    return arr;
}
function parseCellCoordinates(coordinatesString) {
  var _coordinatesString$sp = coordinatesString.split(/(\d+)/), _coordinatesString$sp2 = _slicedToArray(_coordinatesString$sp, 2), column = _coordinatesString$sp2[0], row = _coordinatesString$sp2[1];
  return [
    // Row.
    Number(row),
    // Column.
    // It's not clear why would `column` ever be non-trimmed,
    // but if it was added here then perhaps it could hypothetically happen, or smth.
    getColumnNumberFromColumnLetters(column.trim())
  ];
}
var LETTERS = ["", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
function getColumnNumberFromColumnLetters(columnLetters) {
  var n = 0;
  var i = 0;
  while (i < columnLetters.length) {
    n *= 26;
    n += LETTERS.indexOf(columnLetters[i]);
    i++;
  }
  return n;
}

// node_modules/read-excel-file/modules/xlsx/parseCell.js
function parseCell(element, sheetDocument, sharedStrings, styles, epoch1904, options) {
  var coordinates = parseCellCoordinates(element.getAttribute("r"));
  var valueElement = getCellValueElement(sheetDocument, element);
  var value = valueElement && valueElement.textContent;
  var type = element.getAttribute("t");
  return {
    row: coordinates[0],
    column: coordinates[1],
    value: parseCellValue(value, type, {
      getInlineStringValue: function getInlineStringValue() {
        return getCellInlineStringValue(sheetDocument, element);
      },
      getInlineStringXml: function getInlineStringXml() {
        return getOuterXml(element);
      },
      getStyleId: function getStyleId() {
        return element.getAttribute("s");
      },
      styles,
      sharedStrings,
      epoch1904,
      options
    })
  };
}

// node_modules/read-excel-file/modules/xlsx/parseCells.js
function parseCells(sheetDocument, sharedStrings, styles, epoch1904, options) {
  var cells = getCellElements(sheetDocument);
  if (cells.length === 0) {
    return [];
  }
  return cells.map(function(element) {
    return parseCell(element, sheetDocument, sharedStrings, styles, epoch1904, options);
  });
}

// node_modules/read-excel-file/modules/xlsx/parseSheetDimensions.js
function _slicedToArray2(arr, i) {
  return _arrayWithHoles2(arr) || _iterableToArrayLimit2(arr, i) || _unsupportedIterableToArray4(arr, i) || _nonIterableRest2();
}
function _nonIterableRest2() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray4(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray4(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray4(o, minLen);
}
function _arrayLikeToArray4(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++)
    arr2[i] = arr[i];
  return arr2;
}
function _iterableToArrayLimit2(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l) {
        if (Object(t) !== t)
          return;
        f = false;
      } else
        for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true)
          ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u))
          return;
      } finally {
        if (o)
          throw n;
      }
    }
    return a;
  }
}
function _arrayWithHoles2(arr) {
  if (Array.isArray(arr))
    return arr;
}
function parseSheetDimensions(sheetDocument) {
  var dimensions = getDimensions(sheetDocument);
  if (dimensions) {
    dimensions = dimensions.split(":").map(parseCellCoordinates).map(function(_ref) {
      var _ref2 = _slicedToArray2(_ref, 2), row = _ref2[0], column = _ref2[1];
      return {
        row,
        column
      };
    });
    if (dimensions.length === 1) {
      dimensions = [dimensions[0], dimensions[0]];
    }
    return dimensions;
  }
}

// node_modules/read-excel-file/modules/xlsx/reconstructSheetDimensionsFromSheetCells.js
function reconstructSheetDimensionsFromSheetCells(cells) {
  var comparator = function comparator2(a, b) {
    return a - b;
  };
  var allRows = cells.map(function(cell) {
    return cell.row;
  }).sort(comparator);
  var allCols = cells.map(function(cell) {
    return cell.column;
  }).sort(comparator);
  var minRow = allRows[0];
  var maxRow = allRows[allRows.length - 1];
  var minCol = allCols[0];
  var maxCol = allCols[allCols.length - 1];
  return [{
    row: minRow,
    column: minCol
  }, {
    row: maxRow,
    column: maxCol
  }];
}

// node_modules/read-excel-file/modules/xlsx/dropEmptyRows.js
function _createForOfIteratorHelperLoose3(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray5(o)) || allowArrayLike && o && typeof o.length === "number") {
    if (it)
      o = it;
    var i = 0;
    return function() {
      if (i >= o.length)
        return { done: true };
      return { done: false, value: o[i++] };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray5(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray5(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray5(o, minLen);
}
function _arrayLikeToArray5(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++)
    arr2[i] = arr[i];
  return arr2;
}
function dropEmptyRows(data) {
  var _ref = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, rowIndexSourceMap = _ref.rowIndexSourceMap, _ref$accessor = _ref.accessor, accessor = _ref$accessor === void 0 ? function(_) {
    return _;
  } : _ref$accessor, onlyTrimAtTheEnd = _ref.onlyTrimAtTheEnd;
  var i = data.length - 1;
  while (i >= 0) {
    var empty = true;
    for (var _iterator = _createForOfIteratorHelperLoose3(data[i]), _step; !(_step = _iterator()).done; ) {
      var cell = _step.value;
      if (accessor(cell) !== null) {
        empty = false;
        break;
      }
    }
    if (empty) {
      data.splice(i, 1);
      if (rowIndexSourceMap) {
        rowIndexSourceMap.splice(i, 1);
      }
    } else if (onlyTrimAtTheEnd) {
      break;
    }
    i--;
  }
  return data;
}

// node_modules/read-excel-file/modules/xlsx/dropEmptyColumns.js
function _createForOfIteratorHelperLoose4(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray6(o)) || allowArrayLike && o && typeof o.length === "number") {
    if (it)
      o = it;
    var i = 0;
    return function() {
      if (i >= o.length)
        return { done: true };
      return { done: false, value: o[i++] };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray6(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray6(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray6(o, minLen);
}
function _arrayLikeToArray6(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++)
    arr2[i] = arr[i];
  return arr2;
}
function dropEmptyColumns(data) {
  var _ref = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, _ref$accessor = _ref.accessor, accessor = _ref$accessor === void 0 ? function(_) {
    return _;
  } : _ref$accessor, onlyTrimAtTheEnd = _ref.onlyTrimAtTheEnd;
  var i = data[0].length - 1;
  while (i >= 0) {
    var empty = true;
    for (var _iterator = _createForOfIteratorHelperLoose4(data), _step; !(_step = _iterator()).done; ) {
      var row = _step.value;
      if (accessor(row[i]) !== null) {
        empty = false;
        break;
      }
    }
    if (empty) {
      var j = 0;
      while (j < data.length) {
        data[j].splice(i, 1);
        j++;
      }
    } else if (onlyTrimAtTheEnd) {
      break;
    }
    i--;
  }
  return data;
}

// node_modules/read-excel-file/modules/xlsx/convertCellsToData2dArray.js
function _createForOfIteratorHelperLoose5(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray7(o)) || allowArrayLike && o && typeof o.length === "number") {
    if (it)
      o = it;
    var i = 0;
    return function() {
      if (i >= o.length)
        return { done: true };
      return { done: false, value: o[i++] };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _slicedToArray3(arr, i) {
  return _arrayWithHoles3(arr) || _iterableToArrayLimit3(arr, i) || _unsupportedIterableToArray7(arr, i) || _nonIterableRest3();
}
function _nonIterableRest3() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray7(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray7(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray7(o, minLen);
}
function _arrayLikeToArray7(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++)
    arr2[i] = arr[i];
  return arr2;
}
function _iterableToArrayLimit3(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l) {
        if (Object(t) !== t)
          return;
        f = false;
      } else
        for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true)
          ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u))
          return;
      } finally {
        if (o)
          throw n;
      }
    }
    return a;
  }
}
function _arrayWithHoles3(arr) {
  if (Array.isArray(arr))
    return arr;
}
function convertCellsToData2dArray(cells, dimensions) {
  if (cells.length === 0) {
    return [];
  }
  var _dimensions = _slicedToArray3(dimensions, 2), leftTop = _dimensions[0], rightBottom = _dimensions[1];
  var colsCount = rightBottom.column;
  var rowsCount = rightBottom.row;
  var data = new Array(rowsCount);
  var i = 0;
  while (i < rowsCount) {
    data[i] = new Array(colsCount);
    var j = 0;
    while (j < colsCount) {
      data[i][j] = null;
      j++;
    }
    i++;
  }
  for (var _iterator = _createForOfIteratorHelperLoose5(cells), _step; !(_step = _iterator()).done; ) {
    var cell = _step.value;
    var rowIndex = cell.row - 1;
    var columnIndex = cell.column - 1;
    if (columnIndex < colsCount && rowIndex < rowsCount) {
      data[rowIndex][columnIndex] = cell.value;
    }
  }
  data = dropEmptyRows(
    dropEmptyColumns(data, {
      onlyTrimAtTheEnd: true
    }),
    {
      onlyTrimAtTheEnd: true
    }
    // { onlyTrimAtTheEnd: true, rowIndexSourceMap: options.rowIndexSourceMap }
  );
  return data;
}

// node_modules/read-excel-file/modules/xlsx/parseSheet.js
function parseSheet(content, xml, sharedStrings, styles, epoch1904, options) {
  var sheetDocument = xml.createDocument(content);
  var cells = parseCells(sheetDocument, sharedStrings, styles, epoch1904, options);
  var dimensions = parseSheetDimensions(sheetDocument) || reconstructSheetDimensionsFromSheetCells(cells);
  return convertCellsToData2dArray(cells, dimensions);
}

// node_modules/read-excel-file/modules/xlsx/parseSpreadsheetContents.js
function _createForOfIteratorHelperLoose6(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray8(o)) || allowArrayLike && o && typeof o.length === "number") {
    if (it)
      o = it;
    var i = 0;
    return function() {
      if (i >= o.length)
        return { done: true };
      return { done: false, value: o[i++] };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray8(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray8(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray8(o, minLen);
}
function _arrayLikeToArray8(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++)
    arr2[i] = arr[i];
  return arr2;
}
function parseSpreadsheetContents(contents, xml) {
  var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
  var getFileContent = function getFileContent2(filePath) {
    if (!contents[filePath]) {
      throw new Error('"'.concat(filePath, '" file not found inside the *.xlsx file zip archive'));
    }
    return contents[filePath];
  };
  var filePaths = parseFilePaths(getFileContent("xl/_rels/workbook.xml.rels"), xml);
  var sharedStrings = filePaths.sharedStrings ? parseSharedStrings(getFileContent(filePaths.sharedStrings), xml) : [];
  var styles = filePaths.styles ? parseStyles(getFileContent(filePaths.styles), xml) : {};
  var _parseSpreadsheetInfo = parseSpreadsheetInfo(getFileContent("xl/workbook.xml"), xml), sheets = _parseSpreadsheetInfo.sheets, epoch1904 = _parseSpreadsheetInfo.epoch1904;
  var sheetIdsToRead = options.sheets && options.sheets.map(function(sheet) {
    return getSheetId(sheet, sheets);
  });
  var sheetsData = [];
  for (var _i = 0, _Object$keys = Object.keys(filePaths.sheets); _i < _Object$keys.length; _i++) {
    var sheetId = _Object$keys[_i];
    if (sheetIdsToRead && !sheetIdsToRead.includes(sheetId)) {
      continue;
    }
    sheetsData.push({
      sheet: getSheetNameById(sheetId, sheets),
      data: parseSheet(getFileContent(filePaths.sheets[sheetId]), xml, sharedStrings, styles, epoch1904, options)
    });
  }
  return sheetsData;
}
function getSheetId(sheet, sheets) {
  if (typeof sheet === "string") {
    for (var _iterator = _createForOfIteratorHelperLoose6(sheets), _step; !(_step = _iterator()).done; ) {
      var _sheet = _step.value;
      if (_sheet.name === sheet) {
        return _sheet.relationId;
      }
    }
    throw new Error('Sheet "'.concat(sheet, '" not found. Available sheets: ').concat(sheets.map(function(_ref) {
      var name = _ref.name;
      return '"'.concat(name, '"');
    }).join(", ")));
  } else {
    if (sheet <= sheets.length) {
      return sheets[sheet - 1].relationId;
    }
    throw new Error("Sheet number out of bounds: ".concat(sheet, ". Available sheets count: ").concat(sheets.length));
  }
}
function getSheetNameById(sheetId, sheets) {
  for (var _iterator2 = _createForOfIteratorHelperLoose6(sheets), _step2; !(_step2 = _iterator2()).done; ) {
    var sheet = _step2.value;
    if (sheet.relationId === sheetId) {
      return sheet.name;
    }
  }
  throw new Error("Sheet ID not found: ".concat(sheetId));
}

// node_modules/read-excel-file/modules/export/readXlsxFileBrowser.js
function readXlsxFile(input, options) {
  return unpackXlsxFile(input).then(function(contents) {
    return parseSpreadsheetContents(contents, xmlBrowser_default, options);
  });
}

// src/io/import/xlsx.ts
async function readXlsxSheets(data) {
  const all = await readXlsxFile(new Blob([data]), { trim: false });
  return all.map((s) => ({
    name: s.sheet,
    rows: s.data.map((row) => row.map((cell) => cell === void 0 ? null : cell))
  }));
}

// src/io/infer.ts
var NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
var YMD_SLASH_RE = /^(\d{4})\/(\d{2})\/(\d{2})$/;
var NUMERIC_DMY_RE = /^(\d{1,2})([/.])(\d{1,2})\2(\d{4})$/;
var DAY_MONTHNAME_YEAR_RE = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/;
var CHECKBOX_WORDS = /* @__PURE__ */ new Set(["true", "false", "yes", "no", "1", "0"]);
var MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};
function dateOnlyIso(d) {
  if (Number.isNaN(d.getTime()))
    return null;
  if (d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0)
    return null;
  return d.toISOString().slice(0, 10);
}
function cellKey(v) {
  return v instanceof Date ? v.toISOString() : String(v).trim();
}
function isEmptyCell(v) {
  return v === null || v === void 0 || typeof v === "string" && v.trim() === "";
}
function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function validYMD(y, m, d) {
  if (m < 1 || m > 12 || d < 1)
    return false;
  return d <= daysInMonth(y, m);
}
function ymd(y, m, d) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function parseDateText(input) {
  const s = input.trim();
  let m = ISO_RE.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return validYMD(y, mo, d) ? ymd(y, mo, d) : null;
  }
  m = YMD_SLASH_RE.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return validYMD(y, mo, d) ? ymd(y, mo, d) : null;
  }
  m = NUMERIC_DMY_RE.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[3]);
    const y = Number(m[4]);
    let day;
    let month;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    } else {
      return null;
    }
    return validYMD(y, month, day) ? ymd(y, month, day) : null;
  }
  m = DAY_MONTHNAME_YEAR_RE.exec(s);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month === void 0)
      return null;
    const d = Number(m[1]);
    const y = Number(m[3]);
    return validYMD(y, month, d) ? ymd(y, month, d) : null;
  }
  return null;
}
function matchesCheckbox(v) {
  if (typeof v === "boolean")
    return true;
  if (typeof v === "number")
    return v === 0 || v === 1;
  if (typeof v === "string")
    return CHECKBOX_WORDS.has(v.trim().toLowerCase());
  return false;
}
function matchesNumber(v) {
  if (typeof v === "number")
    return Number.isFinite(v);
  if (typeof v === "string") {
    const t = v.trim();
    return NUMBER_RE.test(t) && Number.isFinite(Number(t));
  }
  return false;
}
function matchesDate(v) {
  if (v instanceof Date)
    return dateOnlyIso(v) !== null;
  if (typeof v === "string")
    return parseDateText(v) !== null;
  return false;
}
var MATCHERS = [
  ["checkbox", matchesCheckbox],
  ["number", matchesNumber],
  ["date", matchesDate]
];
function inferColumn(values, options = {}) {
  const tolerance = options.tolerance ?? 0;
  const maxDistinct = options.maxSelectDistinct ?? 20;
  const maxRatio = options.maxSelectRatio ?? 0.5;
  const nonEmptyValues = [];
  for (const v of values)
    if (!isEmptyCell(v))
      nonEmptyValues.push(v);
  const nonEmpty = nonEmptyValues.length;
  const distinctSet = /* @__PURE__ */ new Set();
  const selectOptions = [];
  for (const v of nonEmptyValues) {
    const key = cellKey(v);
    if (!distinctSet.has(key)) {
      distinctSet.add(key);
      selectOptions.push(key);
    }
  }
  const distinct = distinctSet.size;
  if (nonEmpty === 0) {
    return { type: "text", reason: "no non-empty values", nonEmpty, distinct, matchRatio: 1 };
  }
  for (const [type, matches] of MATCHERS) {
    let ok = 0;
    for (const v of nonEmptyValues)
      if (matches(v))
        ok++;
    const ratio = ok / nonEmpty;
    if (ratio >= 1 - tolerance) {
      return {
        type,
        reason: ratio === 1 ? `all ${nonEmpty} non-empty values match ${type}` : `${(ratio * 100).toFixed(1)}% of values match ${type}`,
        nonEmpty,
        distinct,
        matchRatio: ratio
      };
    }
  }
  if (distinct <= maxDistinct && distinct / nonEmpty <= maxRatio) {
    return {
      type: "single_select",
      reason: `${distinct} distinct values (<= ${maxDistinct}) and ${(distinct / nonEmpty * 100).toFixed(0)}% of rows (<= ${maxRatio * 100}%)`,
      nonEmpty,
      distinct,
      matchRatio: 1,
      selectOptions
    };
  }
  return {
    type: "text",
    reason: `no strict type match; ${distinct} distinct values does not qualify for single_select`,
    nonEmpty,
    distinct,
    matchRatio: 1
  };
}
function inferTable(rows, columnCount, options = {}) {
  const out = [];
  for (let c = 0; c < columnCount; c++) {
    const column = new Array(rows.length);
    for (let r = 0; r < rows.length; r++)
      column[r] = rows[r][c];
    out.push(inferColumn(column, options));
  }
  return out;
}

// src/utils/idGen.ts
var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId(prefix, length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}
function generateRowId() {
  return randomId("row_");
}
function generateFieldId() {
  return randomId("fld_");
}
function generateOptionId() {
  return randomId("opt_");
}
function generateTableId() {
  return randomId("tbl_");
}
function generateViewId() {
  return randomId("view_");
}

// src/model/view.ts
var VALID_ROW_HEIGHTS = /* @__PURE__ */ new Set(["small", "medium", "large", "compact", "tall"]);
var VALID_DIRECTIONS = /* @__PURE__ */ new Set(["asc", "desc"]);
function cloneView(view) {
  return {
    id: view.id,
    name: view.name,
    sort: view.sort.map((s) => ({ fieldId: s.fieldId, direction: s.direction })),
    groupBy: view.groupBy,
    hidden: [...view.hidden],
    frozenColumns: view.frozenColumns,
    rowHeight: view.rowHeight,
    columnWidths: { ...view.columnWidths },
    columnOrder: [...view.columnOrder],
    ...view.warnings ? { warnings: [...view.warnings] } : {}
  };
}
function createDefaultView(fields, name = "Default") {
  const columnOrder = fields.map((f) => f.id);
  return {
    id: generateViewId(),
    name,
    sort: [],
    groupBy: null,
    hidden: [],
    frozenColumns: 1,
    rowHeight: "medium",
    columnWidths: {},
    columnOrder,
    warnings: []
  };
}
function validateView(view, fields) {
  const warnings = [];
  const errors = [];
  const fieldIds = new Set(fields.map((f) => f.id));
  const primary = fields.find((f) => f.primary);
  const primaryId = primary?.id;
  const normalized = cloneView(view);
  if (!Array.isArray(normalized.warnings))
    normalized.warnings = [];
  const origSort = Array.isArray(view.sort) ? view.sort : [];
  const cleanSort = [];
  for (const entry of origSort) {
    if (!entry || typeof entry.fieldId !== "string") {
      warnings.push(`sort entry with invalid fieldId ignored`);
      continue;
    }
    if (!fieldIds.has(entry.fieldId)) {
      warnings.push(`sort field "${entry.fieldId}" is unknown \u2014 ignored`);
      continue;
    }
    if (!VALID_DIRECTIONS.has(entry.direction)) {
      warnings.push(`sort direction "${entry.direction}" for field "${entry.fieldId}" invalid \u2014 ignored`);
      continue;
    }
    cleanSort.push({ fieldId: entry.fieldId, direction: entry.direction });
  }
  normalized.sort = cleanSort;
  if (normalized.groupBy !== null && normalized.groupBy !== void 0) {
    if (typeof normalized.groupBy !== "string") {
      warnings.push(`groupBy invalid type \u2014 cleared`);
      normalized.groupBy = null;
    } else if (!fieldIds.has(normalized.groupBy)) {
      warnings.push(`groupBy field "${normalized.groupBy}" is unknown \u2014 cleared`);
      normalized.groupBy = null;
    }
  } else {
    normalized.groupBy = null;
  }
  const origHidden = Array.isArray(view.hidden) ? view.hidden : [];
  const cleanHidden = [];
  for (const hid of origHidden) {
    if (typeof hid !== "string") {
      warnings.push(`hidden entry "${String(hid)}" invalid type \u2014 ignored`);
      continue;
    }
    if (!fieldIds.has(hid)) {
      warnings.push(`hidden field "${hid}" is unknown \u2014 ignored`);
      continue;
    }
    cleanHidden.push(hid);
  }
  if (primaryId && cleanHidden.includes(primaryId)) {
    errors.push(`Primary field "${primary?.name ?? primaryId}" cannot be hidden (R-D13)`);
  }
  normalized.hidden = cleanHidden;
  const origOrder = view.columnOrder;
  if (!Array.isArray(origOrder)) {
    warnings.push(`columnOrder missing \u2014 derived from field order`);
    normalized.columnOrder = fields.map((f) => f.id);
  } else {
    const seen = /* @__PURE__ */ new Set();
    const cleanOrder = [];
    for (const fid of origOrder) {
      if (typeof fid !== "string") {
        warnings.push(`columnOrder entry "${String(fid)}" invalid type \u2014 ignored`);
        continue;
      }
      if (!fieldIds.has(fid)) {
        warnings.push(`columnOrder field "${fid}" is unknown \u2014 ignored`);
        continue;
      }
      if (seen.has(fid)) {
        warnings.push(`columnOrder duplicate field "${fid}" \u2014 ignored`);
        continue;
      }
      seen.add(fid);
      cleanOrder.push(fid);
    }
    const missing = fields.map((f) => f.id).filter((id) => !seen.has(id));
    if (missing.length > 0) {
      warnings.push(`columnOrder missing fields ${missing.join(",")} \u2014 appended`);
      cleanOrder.push(...missing);
    }
    if (cleanOrder.length !== fields.length) {
      warnings.push(`columnOrder length ${origOrder.length} corrected to ${cleanOrder.length}`);
    }
    normalized.columnOrder = cleanOrder;
  }
  const origWidths = view.columnWidths && typeof view.columnWidths === "object" ? view.columnWidths : {};
  const cleanWidths = {};
  for (const [fid, w] of Object.entries(origWidths)) {
    if (!fieldIds.has(fid)) {
      warnings.push(`columnWidths field "${fid}" is unknown \u2014 ignored`);
      continue;
    }
    if (typeof w !== "number" || !Number.isInteger(w) || w < 0) {
      warnings.push(`columnWidths for field "${fid}" has invalid width "${String(w)}" \u2014 ignored`);
      continue;
    }
    if (w < 60) {
      warnings.push(`columnWidths for field "${fid}" width ${w} below minimum 60 \u2014 kept but may be clamped by UI`);
    }
    cleanWidths[fid] = w;
  }
  normalized.columnWidths = cleanWidths;
  let frozen = view.frozenColumns;
  if (typeof frozen !== "number" || !Number.isInteger(frozen)) {
    warnings.push(`frozenColumns invalid type "${String(frozen)}" \u2014 set to 0`);
    frozen = 0;
  }
  if (frozen < 0) {
    warnings.push(`frozenColumns ${frozen} below 0 \u2014 clamped to 0`);
    frozen = 0;
  } else if (frozen > fields.length) {
    warnings.push(`frozenColumns ${frozen} exceeds field count ${fields.length} \u2014 clamped to ${fields.length}`);
    frozen = fields.length;
  }
  normalized.frozenColumns = frozen;
  const rh = view.rowHeight;
  if (!VALID_ROW_HEIGHTS.has(rh)) {
    warnings.push(`rowHeight "${String(rh)}" invalid \u2014 set to "medium"`);
    normalized.rowHeight = "medium";
  } else {
    normalized.rowHeight = rh;
  }
  const allWarnings = [...warnings];
  normalized.warnings = allWarnings;
  const ok = errors.length === 0;
  return { view: normalized, warnings: allWarnings, errors, ok };
}
function sanitizeViewsForSave(views, fields) {
  return views.map((v) => validateView(v, fields).view);
}

// src/format/parse.ts
function parse(input) {
  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const match = msg.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1], 10);
      const { line, column } = offsetToLineCol(input, pos);
      return { ok: false, error: `Invalid JSON: ${msg}`, line, column };
    }
    return { ok: false, error: `Invalid JSON: ${msg}` };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, error: "File must be a JSON object", line: 1, column: 1 };
  }
  const obj = data;
  if (!("formatVersion" in obj)) {
    return { ok: false, error: "Missing required key: formatVersion" };
  }
  if (obj.formatVersion !== 1) {
    return {
      ok: false,
      error: `Unsupported formatVersion: ${JSON.stringify(obj.formatVersion)}. Expected 1.`
    };
  }
  const requiredKeys = ["tableId", "name", "fields", "rows", "views", "syncLink"];
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      return { ok: false, error: `Missing required key: ${key}` };
    }
  }
  if (typeof obj.tableId !== "string") {
    return { ok: false, error: "tableId must be a string" };
  }
  if (typeof obj.name !== "string") {
    return { ok: false, error: "name must be a string" };
  }
  if (!Array.isArray(obj.fields)) {
    return { ok: false, error: "fields must be an array" };
  }
  if (!Array.isArray(obj.rows)) {
    return { ok: false, error: "rows must be an array" };
  }
  if (!Array.isArray(obj.views)) {
    return { ok: false, error: "views must be an array" };
  }
  if (obj.fields.length < 1) {
    return { ok: false, error: "fields must have at least one entry" };
  }
  if (obj.views.length < 1) {
    return { ok: false, error: "views must have at least one entry" };
  }
  for (let i = 0; i < obj.fields.length; i++) {
    const field = obj.fields[i];
    if (typeof field !== "object" || field === null) {
      return { ok: false, error: `fields[${i}] must be an object` };
    }
    if (typeof field.id !== "string") {
      return { ok: false, error: `fields[${i}].id must be a string` };
    }
    if (typeof field.name !== "string") {
      return { ok: false, error: `fields[${i}].name must be a string` };
    }
    if (typeof field.type !== "string") {
      return { ok: false, error: `fields[${i}].type must be a string` };
    }
  }
  for (let i = 0; i < obj.rows.length; i++) {
    const row = obj.rows[i];
    if (typeof row !== "object" || row === null) {
      return { ok: false, error: `rows[${i}] must be an object` };
    }
    if (typeof row.id !== "string") {
      return { ok: false, error: `rows[${i}].id must be a string` };
    }
    if (typeof row.rev !== "number" || !Number.isInteger(row.rev)) {
      return { ok: false, error: `rows[${i}].rev must be an integer` };
    }
    if (typeof row.updatedAt !== "string") {
      return { ok: false, error: `rows[${i}].updatedAt must be a string` };
    }
    if (typeof row.values !== "object" || row.values === null) {
      return { ok: false, error: `rows[${i}].values must be an object` };
    }
    if (row.sync !== null) {
      return { ok: false, error: `rows[${i}].sync must be null in v1` };
    }
  }
  const fieldsForView = obj.fields;
  for (let i = 0; i < obj.views.length; i++) {
    const view = obj.views[i];
    if (typeof view !== "object" || view === null) {
      return { ok: false, error: `views[${i}] must be an object` };
    }
    if (typeof view.id !== "string") {
      return { ok: false, error: `views[${i}].id must be a string` };
    }
  }
  try {
    const normalizedViews = obj.views.map((v, idx) => {
      const viewWithDefaults = {
        id: v.id,
        name: v.name ?? "Default",
        sort: Array.isArray(v.sort) ? v.sort : [],
        groupBy: v.groupBy ?? null,
        hidden: Array.isArray(v.hidden) ? v.hidden : [],
        frozenColumns: typeof v.frozenColumns === "number" ? v.frozenColumns : 0,
        rowHeight: v.rowHeight ?? "medium",
        columnWidths: v.columnWidths && typeof v.columnWidths === "object" ? v.columnWidths : {},
        columnOrder: Array.isArray(v.columnOrder) ? v.columnOrder : fieldsForView.map((f) => f.id),
        warnings: Array.isArray(v.warnings) ? v.warnings : []
      };
      const result = validateView(viewWithDefaults, fieldsForView);
      if (!result.ok && result.errors.length > 0) {
        const primary = fieldsForView.find((f) => f.primary);
        if (primary && result.view.hidden.includes(primary.id)) {
          result.view.hidden = result.view.hidden.filter((id) => id !== primary.id);
          result.view.warnings = [...result.view.warnings ?? [], `Primary field "${primary.name}" cannot be hidden \u2014 removed on load`];
          result.warnings.push(`Primary field "${primary.name}" cannot be hidden \u2014 removed on load`);
          result.errors = result.errors.filter((e) => !e.includes("Primary field"));
          result.ok = result.errors.length === 0;
        }
      }
      const original = obj.views[idx];
      for (const k of Object.keys(original)) {
        if (!(k in result.view)) {
          result.view[k] = original[k];
        }
      }
      return result.view;
    });
    obj.views = normalizedViews;
  } catch {
    return { ok: false, error: "Failed to normalize views" };
  }
  if (obj.syncLink !== null) {
    return { ok: false, error: "syncLink must be null in v1" };
  }
  return { ok: true, data: obj };
}
function offsetToLineCol(text, offset) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

// src/format/serialize.ts
function serialize(file) {
  const ordered = orderTopLevel(file);
  return JSON.stringify(ordered, null, 2) + "\n";
}
var TOP_LEVEL_KEYS = ["formatVersion", "tableId", "name", "fields", "rows", "views", "syncLink"];
var FIELD_KEYS = ["id", "name", "type", "primary", "options", "required", "unique", "min", "max", "regex"];
var ROW_KEYS = ["id", "rev", "createdAt", "updatedAt", "values", "sync"];
var VIEW_KEYS = ["id", "name", "sort", "groupBy", "hidden", "frozenColumns", "rowHeight", "columnWidths", "columnOrder", "warnings"];
var OPTION_KEYS = ["id", "name", "color"];
function orderTopLevel(file) {
  const result = {};
  const sanitizedViews = file.views ? sanitizeViewsForSave(file.views, file.fields) : file.views;
  for (const key of TOP_LEVEL_KEYS) {
    if (key in file) {
      if (key === "fields") {
        result[key] = file.fields.map(orderField);
      } else if (key === "rows") {
        result[key] = file.rows.map(orderRow);
      } else if (key === "views") {
        result[key] = sanitizedViews.map(orderView);
      } else {
        result[key] = file[key];
      }
    }
  }
  for (const key of Object.keys(file)) {
    if (!TOP_LEVEL_KEYS.includes(key)) {
      result[key] = file[key];
    }
  }
  return result;
}
function orderField(field) {
  const result = {};
  for (const key of FIELD_KEYS) {
    if (key in field) {
      if (key === "options" && field.options) {
        result[key] = field.options.map(orderOption);
      } else {
        result[key] = field[key];
      }
    }
  }
  for (const key of Object.keys(field)) {
    if (!FIELD_KEYS.includes(key)) {
      result[key] = field[key];
    }
  }
  return result;
}
function orderRow(row) {
  const result = {};
  for (const key of ROW_KEYS) {
    if (key in row) {
      result[key] = row[key];
    }
  }
  for (const key of Object.keys(row)) {
    if (!ROW_KEYS.includes(key)) {
      result[key] = row[key];
    }
  }
  return result;
}
function orderView(view) {
  const result = {};
  for (const key of VIEW_KEYS) {
    if (key in view) {
      result[key] = view[key];
    }
  }
  for (const key of Object.keys(view)) {
    if (!VIEW_KEYS.includes(key)) {
      result[key] = view[key];
    }
  }
  return result;
}
function orderOption(option) {
  const result = {};
  for (const key of OPTION_KEYS) {
    if (key in option) {
      result[key] = option[key];
    }
  }
  for (const key of Object.keys(option)) {
    if (!OPTION_KEYS.includes(key)) {
      result[key] = option[key];
    }
  }
  return result;
}

// src/model/validation.ts
var REGEX_INPUT_LIMIT = 1e4;
function validateTable(fields, rows) {
  const violations = [];
  for (const field of fields) {
    for (const row of rows) {
      const cellViolations = validateCell(field, row.values[field.id], rows, row.id);
      violations.push(...cellViolations);
    }
  }
  return violations;
}
function validateCell(field, value, allRows, currentRowId) {
  const violations = [];
  const rowId = currentRowId ?? "";
  if (field.required) {
    if (value === null || value === "" || Array.isArray(value) && value.length === 0) {
      violations.push({
        rowId,
        fieldId: field.id,
        rule: "required",
        message: `${field.name} is required`
      });
    }
  }
  if (value === null || value === "")
    return violations;
  if (field.min !== null && field.min !== void 0) {
    if (typeof value === "number" && typeof field.min === "number") {
      if (value < field.min) {
        violations.push({
          rowId,
          fieldId: field.id,
          rule: "min",
          message: `${field.name} must be at least ${field.min}`
        });
      }
    } else if (typeof value === "string" && typeof field.min === "string") {
      if (value < field.min) {
        violations.push({
          rowId,
          fieldId: field.id,
          rule: "min",
          message: `${field.name} must be at least ${field.min}`
        });
      }
    }
  }
  if (field.max !== null && field.max !== void 0) {
    if (typeof value === "number" && typeof field.max === "number") {
      if (value > field.max) {
        violations.push({
          rowId,
          fieldId: field.id,
          rule: "max",
          message: `${field.name} must be at most ${field.max}`
        });
      }
    } else if (typeof value === "string" && typeof field.max === "string") {
      if (value > field.max) {
        violations.push({
          rowId,
          fieldId: field.id,
          rule: "max",
          message: `${field.name} must be at most ${field.max}`
        });
      }
    }
  }
  if (field.regex) {
    const strValue = typeof value === "string" ? value : String(value);
    if (strValue.length > REGEX_INPUT_LIMIT) {
      violations.push({
        rowId,
        fieldId: field.id,
        rule: "regex",
        message: `${field.name} exceeds maximum input length (${REGEX_INPUT_LIMIT})`
      });
    } else {
      try {
        const re = new RegExp(field.regex);
        if (!re.test(strValue)) {
          violations.push({
            rowId,
            fieldId: field.id,
            rule: "regex",
            message: `${field.name} does not match pattern ${field.regex}`
          });
        }
      } catch {
        violations.push({
          rowId,
          fieldId: field.id,
          rule: "regex",
          message: `${field.name} has invalid regex pattern`
        });
      }
    }
  }
  if (field.unique && allRows && allRows.length > 0) {
    const trimmedValue = typeof value === "string" ? value.trim() : value;
    const duplicates = allRows.filter((row) => {
      if (row.id === currentRowId)
        return false;
      const otherValue = row.values[field.id];
      const trimmedOther = typeof otherValue === "string" ? otherValue.trim() : otherValue;
      return trimmedOther === trimmedValue && otherValue !== null;
    });
    if (duplicates.length > 0) {
      violations.push({
        rowId,
        fieldId: field.id,
        rule: "unique",
        message: `${field.name} must be unique`
      });
    }
  }
  return violations;
}

// src/model/fieldTypes/text.ts
var textType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return typeof value === "string" && value.length <= 1e4;
  },
  parse(input) {
    return input.length > 1e4 ? input.slice(0, 1e4) : input;
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};
var longTextType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return typeof value === "string" && value.length <= 1e5;
  },
  parse(input) {
    return input.length > 1e5 ? input.slice(0, 1e5) : input;
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};

// src/model/fieldTypes/number.ts
var numberType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return typeof value === "number" && Number.isFinite(value);
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};
var currencyType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    const cleaned = trimmed.replace(/[^0-9.-]/g, "");
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n))
      return null;
    return Math.round(n * 100);
  },
  format(value) {
    if (value === null)
      return "";
    if (typeof value !== "number")
      return "";
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    const whole = Math.floor(abs / 100);
    const frac = abs % 100;
    return `${sign}${whole}.${String(frac).padStart(2, "0")}`;
  },
  defaultValue() {
    return null;
  }
};
var percentType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    if (trimmed.endsWith("%")) {
      const n2 = parseFloat(trimmed.slice(0, -1));
      if (!Number.isFinite(n2))
        return null;
      return n2 / 100;
    }
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n))
      return null;
    return n;
  },
  format(value) {
    if (value === null)
      return "";
    if (typeof value !== "number")
      return "";
    return `${Math.round(value * 100)}%`;
  },
  defaultValue() {
    return null;
  }
};
var durationType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    const hmsMatch = trimmed.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
    if (hmsMatch) {
      const h = parseInt(hmsMatch[1], 10);
      const m = parseInt(hmsMatch[2], 10);
      const s = parseInt(hmsMatch[3], 10);
      return (h * 3600 + m * 60 + s) * 1e3;
    }
    const hmsMatch2 = trimmed.match(/^(\d+):(\d{1,2})$/);
    if (hmsMatch2) {
      const m = parseInt(hmsMatch2[1], 10);
      const s = parseInt(hmsMatch2[2], 10);
      return (m * 60 + s) * 1e3;
    }
    const humanMatch = trimmed.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i);
    if (humanMatch && (humanMatch[1] || humanMatch[2] || humanMatch[3])) {
      const h = humanMatch[1] ? parseInt(humanMatch[1], 10) : 0;
      const m = humanMatch[2] ? parseInt(humanMatch[2], 10) : 0;
      const s = humanMatch[3] ? parseInt(humanMatch[3], 10) : 0;
      return (h * 3600 + m * 60 + s) * 1e3;
    }
    const n = parseInt(trimmed, 10);
    if (Number.isFinite(n) && n >= 0)
      return n;
    return null;
  },
  format(value) {
    if (value === null)
      return "";
    if (typeof value !== "number")
      return "";
    const totalSeconds = Math.floor(value / 1e3);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor(totalSeconds % 3600 / 60);
    const s = totalSeconds % 60;
    if (h > 0)
      return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    if (m > 0)
      return `${m}m ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
  },
  defaultValue() {
    return null;
  }
};
var ratingType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n))
      return null;
    return Math.max(1, Math.min(10, n));
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};

// src/model/fieldTypes/boolean.ts
var checkboxType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return typeof value === "boolean";
  },
  parse(input) {
    const trimmed = input.trim().toLowerCase();
    if (trimmed === "")
      return null;
    if (["true", "1", "yes", "y", "\u2713", "checked"].includes(trimmed))
      return true;
    if (["false", "0", "no", "n", "", "unchecked"].includes(trimmed))
      return false;
    return null;
  },
  format(value) {
    if (value === null)
      return "";
    return value ? "\u2713" : "";
  },
  defaultValue() {
    return null;
  }
};

// src/model/fieldTypes/date.ts
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(s) {
  const d = /* @__PURE__ */ new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
}
function isValidDateTime(s) {
  const d = new Date(s);
  return !isNaN(d.getTime());
}
var dateType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    if (typeof value !== "string")
      return false;
    return DATE_RE.test(value) && isValidDate(value);
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    if (DATE_RE.test(trimmed) && isValidDate(trimmed))
      return trimmed;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return null;
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};
var dateTimeType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    if (typeof value !== "string")
      return false;
    return isValidDateTime(value);
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    const d = new Date(trimmed);
    if (isNaN(d.getTime()))
      return null;
    return d.toISOString();
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};

// src/model/fieldTypes/string.ts
var URL_RE = /^https?:\/\/.+/i;
var urlType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    if (typeof value !== "string")
      return false;
    if (value === "")
      return true;
    return URL_RE.test(value);
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    return trimmed;
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var emailType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    if (typeof value !== "string")
      return false;
    if (value === "")
      return true;
    return EMAIL_RE.test(value);
  },
  parse(input) {
    const trimmed = input.trim().toLowerCase();
    if (trimmed === "")
      return null;
    return trimmed;
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};
var PHONE_RE = /^\+?[\d\s\-().]{5,20}$/;
var phoneType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    if (typeof value !== "string")
      return false;
    if (value === "")
      return true;
    return PHONE_RE.test(value);
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    return trimmed;
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};

// src/model/fieldTypes/select.ts
var singleSelectType = {
  readOnly: false,
  validate(value, field) {
    if (value === null)
      return true;
    if (typeof value !== "string")
      return false;
    if (!field?.options)
      return false;
    return field.options.some((opt) => opt.id === value);
  },
  parse(input, field) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    if (!field?.options)
      return null;
    const lower = trimmed.toLowerCase();
    const match = field.options.find((opt) => opt.name.trim().toLowerCase() === lower);
    return match ? match.id : null;
  },
  format(value, field) {
    if (value === null)
      return "";
    if (typeof value !== "string" || !field?.options)
      return "";
    const opt = field.options.find((o) => o.id === value);
    return opt ? opt.name : "";
  },
  defaultValue() {
    return null;
  }
};
var multiSelectType = {
  readOnly: false,
  validate(value, field) {
    if (value === null)
      return true;
    if (!Array.isArray(value))
      return false;
    if (!field?.options)
      return value.length === 0;
    const optionIds = new Set(field.options.map((o) => o.id));
    return value.every((v) => typeof v === "string" && optionIds.has(v));
  },
  parse(input, field) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    if (!field?.options)
      return null;
    const parts = trimmed.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    if (parts.length === 0)
      return null;
    const result = [];
    for (const part of parts) {
      const lower = part.toLowerCase();
      const match = field.options.find((opt) => opt.name.trim().toLowerCase() === lower);
      if (match) {
        result.push(match.id);
      }
    }
    return result.length > 0 ? result : null;
  },
  format(value, field) {
    if (value === null || !Array.isArray(value))
      return "";
    if (!field?.options)
      return "";
    return value.map((id) => {
      const opt = field.options.find((o) => o.id === id);
      return opt ? opt.name : "";
    }).filter((s) => s.length > 0).join(", ");
  },
  defaultValue() {
    return null;
  }
};

// src/model/fieldTypes/attachment.ts
var attachmentType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return typeof value === "string";
  },
  parse(input) {
    const trimmed = input.trim();
    if (trimmed === "")
      return null;
    return trimmed;
  },
  format(value) {
    if (value === null)
      return "";
    return String(value);
  },
  defaultValue() {
    return null;
  }
};

// src/model/fieldTypes/system.ts
var autoNumberType = {
  readOnly: true,
  validate(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
  },
  parse(_input) {
    return null;
  },
  format(value) {
    if (typeof value !== "number")
      return "";
    return String(value);
  },
  defaultValue() {
    return 0;
  }
};
var createdTimeType = {
  readOnly: true,
  validate(value) {
    if (typeof value !== "string")
      return false;
    return !isNaN(new Date(value).getTime());
  },
  parse(_input) {
    return (/* @__PURE__ */ new Date()).toISOString();
  },
  format(value) {
    if (typeof value !== "string")
      return "";
    return value;
  },
  defaultValue() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
};
var modifiedTimeType = {
  readOnly: true,
  validate(value) {
    if (typeof value !== "string")
      return false;
    return !isNaN(new Date(value).getTime());
  },
  parse(_input) {
    return (/* @__PURE__ */ new Date()).toISOString();
  },
  format(value) {
    if (typeof value !== "string")
      return "";
    return value;
  },
  defaultValue() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
};

// src/model/fieldTypes/registry.ts
var registry = /* @__PURE__ */ new Map([
  ["text", textType],
  ["long_text", longTextType],
  ["number", numberType],
  ["currency", currencyType],
  ["percent", percentType],
  ["duration", durationType],
  ["rating", ratingType],
  ["checkbox", checkboxType],
  ["date", dateType],
  ["date_time", dateTimeType],
  ["url", urlType],
  ["email", emailType],
  ["phone", phoneType],
  ["single_select", singleSelectType],
  ["multi_select", multiSelectType],
  ["attachment", attachmentType],
  ["auto_number", autoNumberType],
  ["created_time", createdTimeType],
  ["modified_time", modifiedTimeType]
]);
function getFieldType(name) {
  const ft = registry.get(name);
  if (!ft) {
    throw new Error(`Unknown field type: "${name}". Registered types: ${ALL_TYPE_NAMES.join(", ")}`);
  }
  return ft;
}
var ALL_TYPE_NAMES = [
  "text",
  "long_text",
  "number",
  "currency",
  "percent",
  "duration",
  "rating",
  "checkbox",
  "date",
  "date_time",
  "url",
  "email",
  "phone",
  "single_select",
  "multi_select",
  "attachment",
  "auto_number",
  "created_time",
  "modified_time"
];
var TYPE_COUNT = registry.size;

// src/model/types.ts
var OPTION_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red"
];

// src/io/import/build.ts
var TYPE_MAP = {
  text: "text",
  number: "number",
  date: "date",
  checkbox: "checkbox",
  single_select: "single_select"
};
function uniqueFieldNames(headers) {
  const used = /* @__PURE__ */ new Set();
  const out = [];
  headers.forEach((raw, i) => {
    const base = raw.trim() === "" ? `Column ${i + 1}` : raw.trim();
    let name = base;
    let n = 2;
    while (used.has(name))
      name = `${base} ${n++}`;
    used.add(name);
    out.push(name);
  });
  return out;
}
function convertCell(v, field, selectIds) {
  if (isEmptyCell(v))
    return null;
  switch (field.type) {
    case "checkbox": {
      if (typeof v === "boolean")
        return v;
      if (typeof v === "number")
        return v === 1;
      const t = String(v).trim().toLowerCase();
      if (t === "true" || t === "yes" || t === "1")
        return true;
      if (t === "false" || t === "no" || t === "0")
        return false;
      break;
    }
    case "number": {
      if (typeof v === "number")
        return v;
      const n = Number(String(v).trim());
      if (Number.isFinite(n))
        return n;
      break;
    }
    case "date": {
      if (v instanceof Date) {
        const day = dateOnlyIso(v);
        if (day !== null)
          return day;
        break;
      }
      const d = parseDateText(String(v));
      if (d !== null)
        return d;
      break;
    }
    case "single_select": {
      const id = selectIds?.get(cellKey(v));
      if (id !== void 0)
        return id;
      break;
    }
    case "text":
      if (v instanceof Date)
        return v.toISOString();
      return String(v);
  }
  throw new Error(`value "${cellKey(v)}" does not convert to ${field.type}`);
}
function buildTable(source, options = {}) {
  try {
    return buildUnchecked(source, options);
  } catch (e) {
    return { ok: false, error: `Import failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
function buildUnchecked(source, options) {
  const hasHeader = options.hasHeader ?? true;
  const now = options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
  const serialize2 = options.serialize ?? serialize;
  if (source.rows.length === 0 || hasHeader && source.rows.length === 1 && source.rows[0].length === 0) {
    return { ok: false, error: "The file has no rows to import." };
  }
  const headerRow = hasHeader ? source.rows[0] : [];
  const data = hasHeader ? source.rows.slice(1) : source.rows;
  let columnCount = headerRow.length;
  for (const r of data)
    columnCount = Math.max(columnCount, r.length);
  if (columnCount === 0)
    return { ok: false, error: "The file has no columns." };
  const headers = Array.from({ length: columnCount }, (_, i) => {
    const h = headerRow[i];
    return h === void 0 || h === null ? "" : String(h);
  });
  const names = uniqueFieldNames(headers);
  const inferences = inferTable(data, columnCount);
  const fields = [];
  const selectMaps = [];
  const columns = [];
  for (let i = 0; i < columnCount; i++) {
    const inf = inferences[i];
    const type = TYPE_MAP[inf.type];
    const field = { id: generateFieldId(), name: names[i], type };
    if (i === 0)
      field.primary = true;
    if (type === "single_select") {
      const opts = (inf.selectOptions ?? []).map((name, k) => ({
        id: generateOptionId(),
        name,
        color: OPTION_COLORS[k % OPTION_COLORS.length]
      }));
      field.options = opts;
      selectMaps.push(new Map(opts.map((o) => [o.name, o.id])));
    } else {
      selectMaps.push(void 0);
    }
    fields.push(field);
    columns.push({ name: field.name, type, reason: inf.reason });
  }
  const stamp = now();
  const rows = new Array(data.length);
  for (let r = 0; r < data.length; r++) {
    const src = data[r];
    const values = {};
    for (let c = 0; c < fields.length; c++) {
      values[fields[c].id] = convertCell(src[c], fields[c], selectMaps[c]);
    }
    rows[r] = { id: generateRowId(), rev: 1, createdAt: stamp, updatedAt: stamp, values, sync: null };
  }
  const file = {
    formatVersion: 1,
    tableId: generateTableId(),
    name: source.tableName,
    fields,
    rows,
    views: [createDefaultView(fields)],
    syncLink: null
  };
  const violations = validateTable(fields, rows);
  if (violations.length > 0) {
    return { ok: false, error: `Validation failed: ${violations.length} violation(s), first: ${violations[0].message}` };
  }
  for (const field of fields) {
    const ft = getFieldType(field.type);
    for (const row of rows) {
      if (!ft.validate(row.values[field.id] ?? null, field)) {
        return { ok: false, error: `Validation failed: value in column "${field.name}" is not a valid ${field.type}` };
      }
    }
  }
  const content = serialize2(file);
  const parsed = parse(content);
  if (!parsed.ok)
    return { ok: false, error: `Round-trip parse failed: ${parsed.error}` };
  if (parsed.data.rows.length !== rows.length)
    return { ok: false, error: "Round-trip row count mismatch" };
  for (let r = 0; r < rows.length; r++) {
    if (JSON.stringify(parsed.data.rows[r].values) !== JSON.stringify(rows[r].values)) {
      return { ok: false, error: `Round-trip value mismatch at row ${r + 1}` };
    }
  }
  return { ok: true, content, file, report: { rowCount: rows.length, columns } };
}

// src/io/import/importer.ts
var MAX_NAME_ATTEMPTS = 1e4;
function baseNameFrom(fileName) {
  const stripped = fileName.replace(/\.(csv|xlsx)$/i, "");
  const safe = stripped.replace(/[\\/:*?"<>|#^[\]]/g, "-").trim();
  return safe === "" ? "Imported table" : safe;
}
function candidatePath(folder, base, n) {
  const name = n === 1 ? `${base}.tablify` : `${base} ${n}.tablify`;
  return folder === "" ? name : `${folder}/${name}`;
}
function pickFreePath(folder, base, exists) {
  for (let n = 1; n <= MAX_NAME_ATTEMPTS; n++) {
    const p = candidatePath(folder, base, n);
    if (!exists(p))
      return p;
  }
  return null;
}
async function importTable(input) {
  const tableName = baseNameFrom(input.fileName);
  let rows;
  let ignoredSheets = 0;
  let sheetName;
  if (input.kind === "csv") {
    if (typeof input.data !== "string")
      return { ok: false, error: "CSV import needs text." };
    const parsed = parseCsv(input.data);
    if (!parsed.ok)
      return { ok: false, error: `CSV error at line ${parsed.line}, column ${parsed.column}: ${parsed.error}` };
    rows = parsed.rows;
  } else {
    if (typeof input.data === "string")
      return { ok: false, error: "XLSX import needs bytes." };
    let sheets;
    try {
      sheets = await readXlsxSheets(input.data);
    } catch (e) {
      return { ok: false, error: `Could not read the Excel file: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (sheets.length === 0)
      return { ok: false, error: "The Excel file has no sheets." };
    rows = sheets[0].rows;
    sheetName = sheets[0].name;
    ignoredSheets = sheets.length - 1;
  }
  const built = buildTable({ tableName, rows }, input.build);
  if (!built.ok)
    return { ok: false, error: built.error };
  const base = tableName;
  for (let attempt = 0; attempt < 20; attempt++) {
    const path = pickFreePath(input.folder, base, input.adapter.exists);
    if (path === null)
      return { ok: false, error: "No free file name found." };
    try {
      await input.adapter.create(path, built.content);
      return { ok: true, path, report: built.report, ignoredSheets, sheetName };
    } catch (e) {
      if (!input.adapter.exists(path)) {
        return { ok: false, error: `Could not write the file: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
  }
  return { ok: false, error: "Could not find a free file name." };
}

// src/commands/import.ts
var IMPORT_COMMAND_ID = "import-table";
var IMPORT_COMMAND_NAME = "Import CSV / Excel as table";
function registerImportCommand(plugin) {
  plugin.addCommand({
    id: IMPORT_COMMAND_ID,
    name: IMPORT_COMMAND_NAME,
    callback: () => pickFile(plugin.app)
  });
}
function kindOf(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv"))
    return "csv";
  if (lower.endsWith(".xlsx"))
    return "xlsx";
  return null;
}
function pickFile(app) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,.xlsx";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file)
      void readThenChooseFolder(app, file);
  };
  input.click();
}
async function readThenChooseFolder(app, file) {
  const kind = kindOf(file.name);
  if (kind === null) {
    new import_obsidian.Notice("Choose a .csv or .xlsx file.");
    return;
  }
  const data = kind === "csv" ? await file.text() : await file.arrayBuffer();
  new FolderPicker(app, (folder) => void runImport(app, kind, file.name, data, folder)).open();
}
async function runImport(app, kind, fileName, data, folder) {
  const outcome = await importTable({
    kind,
    fileName,
    data,
    folder,
    adapter: {
      exists: (path) => app.vault.getAbstractFileByPath(path) !== null,
      create: async (path, content) => {
        await app.vault.create(path, content);
      }
    }
  });
  if (!outcome.ok) {
    new import_obsidian.Notice(`Import failed. No file was written. ${outcome.error}`);
    return;
  }
  const notes = outcome.ignoredSheets > 0 ? ` Only the first sheet was imported (${outcome.ignoredSheets} other sheet(s) ignored).` : "";
  new import_obsidian.Notice(`Imported ${outcome.report.rowCount} rows to ${outcome.path}.${notes}`);
  const created = app.vault.getAbstractFileByPath(outcome.path);
  if (created instanceof import_obsidian.TFile) {
    await app.workspace.getLeaf(true).openFile(created);
  }
}
var FolderPicker = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, onPick) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder("Choose the folder for the new table");
  }
  getItems() {
    const folders = this.app.vault.getAllLoadedFiles().filter((f) => f instanceof import_obsidian.TFolder && !f.isRoot()).map((f) => f.path).sort();
    return ["", ...folders];
  }
  getItemText(item) {
    return item === "" ? "/ (vault root)" : item;
  }
  onChooseItem(item) {
    this.onPick(item);
  }
};

// src/main.ts
var TablifyPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    this.addCommand({
      id: "tablify-hello",
      name: "Hello from Tablify",
      callback: () => {
        console.log("Tablify plugin loaded successfully");
      }
    });
    registerImportCommand(this);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2NvbW1hbmRzL2ltcG9ydC50cyIsICJzcmMvaW8vY3N2LnRzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL3htbC94bWxCcm93c2VyLmpzIiwgIm5vZGVfbW9kdWxlcy9mZmxhdGUvZXNtL2Jyb3dzZXIuanMiLCAibm9kZV9tb2R1bGVzL3JlYWQtZXhjZWwtZmlsZS9zb3VyY2UvemlwL3VuemlwRnJvbUFycmF5QnVmZmVyLmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL2V4cG9ydC9jb252ZXJ0VmFsdWVzRnJvbVVpbnQ4QXJyYXlzVG9TdHJpbmdzLmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL2V4cG9ydC9maWx0ZXJaaXBBcmNoaXZlRW50cnkuanMiLCAibm9kZV9tb2R1bGVzL3JlYWQtZXhjZWwtZmlsZS9zb3VyY2UvZXhwb3J0L3VucGFja1hsc3hGaWxlQnJvd3Nlci5qcyIsICJub2RlX21vZHVsZXMvcmVhZC1leGNlbC1maWxlL3NvdXJjZS94bWwvZG9tLmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL3htbC94bHN4LmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL3hsc3gvcGFyc2VTcHJlYWRzaGVldEluZm8uanMiLCAibm9kZV9tb2R1bGVzL3JlYWQtZXhjZWwtZmlsZS9zb3VyY2UveGxzeC9wYXJzZUZpbGVQYXRocy5qcyIsICJub2RlX21vZHVsZXMvcmVhZC1leGNlbC1maWxlL3NvdXJjZS94bHN4L3BhcnNlU3R5bGVzLmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL3hsc3gvcGFyc2VTaGFyZWRTdHJpbmdzLmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL3hsc3gvcGFyc2VFeGNlbERhdGUuanMiLCAibm9kZV9tb2R1bGVzL3JlYWQtZXhjZWwtZmlsZS9zb3VyY2UveGxzeC9pc0RhdGVGb3JtYXQuanMiLCAibm9kZV9tb2R1bGVzL3JlYWQtZXhjZWwtZmlsZS9zb3VyY2UveGxzeC9pc0RhdGVGb3JtYXRTdHlsZS5qcyIsICJub2RlX21vZHVsZXMvcmVhZC1leGNlbC1maWxlL3NvdXJjZS94bHN4L3BhcnNlQ2VsbFZhbHVlLmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL3hsc3gvcGFyc2VDZWxsQ29vcmRpbmF0ZXMuanMiLCAibm9kZV9tb2R1bGVzL3JlYWQtZXhjZWwtZmlsZS9zb3VyY2UveGxzeC9wYXJzZUNlbGwuanMiLCAibm9kZV9tb2R1bGVzL3JlYWQtZXhjZWwtZmlsZS9zb3VyY2UveGxzeC9wYXJzZUNlbGxzLmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL3hsc3gvcGFyc2VTaGVldERpbWVuc2lvbnMuanMiLCAibm9kZV9tb2R1bGVzL3JlYWQtZXhjZWwtZmlsZS9zb3VyY2UveGxzeC9yZWNvbnN0cnVjdFNoZWV0RGltZW5zaW9uc0Zyb21TaGVldENlbGxzLmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL3hsc3gvZHJvcEVtcHR5Um93cy5qcyIsICJub2RlX21vZHVsZXMvcmVhZC1leGNlbC1maWxlL3NvdXJjZS94bHN4L2Ryb3BFbXB0eUNvbHVtbnMuanMiLCAibm9kZV9tb2R1bGVzL3JlYWQtZXhjZWwtZmlsZS9zb3VyY2UveGxzeC9jb252ZXJ0Q2VsbHNUb0RhdGEyZEFycmF5LmpzIiwgIm5vZGVfbW9kdWxlcy9yZWFkLWV4Y2VsLWZpbGUvc291cmNlL3hsc3gvcGFyc2VTaGVldC5qcyIsICJub2RlX21vZHVsZXMvcmVhZC1leGNlbC1maWxlL3NvdXJjZS94bHN4L3BhcnNlU3ByZWFkc2hlZXRDb250ZW50cy5qcyIsICJub2RlX21vZHVsZXMvcmVhZC1leGNlbC1maWxlL3NvdXJjZS9leHBvcnQvcmVhZFhsc3hGaWxlQnJvd3Nlci5qcyIsICJzcmMvaW8vaW1wb3J0L3hsc3gudHMiLCAic3JjL2lvL2luZmVyLnRzIiwgInNyYy91dGlscy9pZEdlbi50cyIsICJzcmMvbW9kZWwvdmlldy50cyIsICJzcmMvZm9ybWF0L3BhcnNlLnRzIiwgInNyYy9mb3JtYXQvc2VyaWFsaXplLnRzIiwgInNyYy9tb2RlbC92YWxpZGF0aW9uLnRzIiwgInNyYy9tb2RlbC9maWVsZFR5cGVzL3RleHQudHMiLCAic3JjL21vZGVsL2ZpZWxkVHlwZXMvbnVtYmVyLnRzIiwgInNyYy9tb2RlbC9maWVsZFR5cGVzL2Jvb2xlYW4udHMiLCAic3JjL21vZGVsL2ZpZWxkVHlwZXMvZGF0ZS50cyIsICJzcmMvbW9kZWwvZmllbGRUeXBlcy9zdHJpbmcudHMiLCAic3JjL21vZGVsL2ZpZWxkVHlwZXMvc2VsZWN0LnRzIiwgInNyYy9tb2RlbC9maWVsZFR5cGVzL2F0dGFjaG1lbnQudHMiLCAic3JjL21vZGVsL2ZpZWxkVHlwZXMvc3lzdGVtLnRzIiwgInNyYy9tb2RlbC9maWVsZFR5cGVzL3JlZ2lzdHJ5LnRzIiwgInNyYy9tb2RlbC90eXBlcy50cyIsICJzcmMvaW8vaW1wb3J0L2J1aWxkLnRzIiwgInNyYy9pby9pbXBvcnQvaW1wb3J0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHJlZ2lzdGVySW1wb3J0Q29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvaW1wb3J0LmpzJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGFibGlmeVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG5cdGFzeW5jIG9ubG9hZCgpIHtcblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6ICd0YWJsaWZ5LWhlbGxvJyxcblx0XHRcdG5hbWU6ICdIZWxsbyBmcm9tIFRhYmxpZnknLFxuXHRcdFx0Y2FsbGJhY2s6ICgpID0+IHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ1RhYmxpZnkgcGx1Z2luIGxvYWRlZCBzdWNjZXNzZnVsbHknKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0cmVnaXN0ZXJJbXBvcnRDb21tYW5kKHRoaXMpO1xuXHR9XG59XG4iLCAiLy8gT2JzaWRpYW4gd2lyaW5nIGZvciBcIkltcG9ydCBDU1YgLyBFeGNlbCBhcyB0YWJsZVwiIChQNC0wNCkuIFRoaW4gbGF5ZXI6IHRoZSBsb2dpYyBpcyBpbiBzcmMvaW8vaW1wb3J0Ly5cbi8vIEZsb3c6IGZpbGUgcGlja2VyIFx1MjE5MiBmb2xkZXIgcGlja2VyIFx1MjE5MiBpbXBvcnRUYWJsZSgpIFx1MjE5MiBvcGVuIHRoZSBuZXcgZmlsZSBvbiBzdWNjZXNzLlxuLy8gRmFpbHVyZSBzaG93cyBhIG5vdGljZSBhbmQgd3JpdGVzIG5vdGhpbmcuXG5cbmltcG9ydCB7IEFwcCwgRnV6enlTdWdnZXN0TW9kYWwsIE5vdGljZSwgUGx1Z2luLCBURmlsZSwgVEZvbGRlciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IGltcG9ydFRhYmxlLCB0eXBlIEltcG9ydEtpbmQgfSBmcm9tICcuLi9pby9pbXBvcnQvaW1wb3J0ZXIuanMnO1xuXG5leHBvcnQgY29uc3QgSU1QT1JUX0NPTU1BTkRfSUQgPSAnaW1wb3J0LXRhYmxlJztcbmV4cG9ydCBjb25zdCBJTVBPUlRfQ09NTUFORF9OQU1FID0gJ0ltcG9ydCBDU1YgLyBFeGNlbCBhcyB0YWJsZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckltcG9ydENvbW1hbmQocGx1Z2luOiBQbHVnaW4pOiB2b2lkIHtcbiAgcGx1Z2luLmFkZENvbW1hbmQoe1xuICAgIGlkOiBJTVBPUlRfQ09NTUFORF9JRCxcbiAgICBuYW1lOiBJTVBPUlRfQ09NTUFORF9OQU1FLFxuICAgIGNhbGxiYWNrOiAoKSA9PiBwaWNrRmlsZShwbHVnaW4uYXBwKSxcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGtpbmRPZihuYW1lOiBzdHJpbmcpOiBJbXBvcnRLaW5kIHwgbnVsbCB7XG4gIGNvbnN0IGxvd2VyID0gbmFtZS50b0xvd2VyQ2FzZSgpO1xuICBpZiAobG93ZXIuZW5kc1dpdGgoJy5jc3YnKSkgcmV0dXJuICdjc3YnO1xuICBpZiAobG93ZXIuZW5kc1dpdGgoJy54bHN4JykpIHJldHVybiAneGxzeCc7XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBwaWNrRmlsZShhcHA6IEFwcCk6IHZvaWQge1xuICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gIGlucHV0LnR5cGUgPSAnZmlsZSc7XG4gIGlucHV0LmFjY2VwdCA9ICcuY3N2LC54bHN4JztcbiAgaW5wdXQub25jaGFuZ2UgPSAoKSA9PiB7XG4gICAgY29uc3QgZmlsZSA9IGlucHV0LmZpbGVzPy5bMF07XG4gICAgaWYgKGZpbGUpIHZvaWQgcmVhZFRoZW5DaG9vc2VGb2xkZXIoYXBwLCBmaWxlKTtcbiAgfTtcbiAgaW5wdXQuY2xpY2soKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVhZFRoZW5DaG9vc2VGb2xkZXIoYXBwOiBBcHAsIGZpbGU6IEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qga2luZCA9IGtpbmRPZihmaWxlLm5hbWUpO1xuICBpZiAoa2luZCA9PT0gbnVsbCkge1xuICAgIG5ldyBOb3RpY2UoJ0Nob29zZSBhIC5jc3Ygb3IgLnhsc3ggZmlsZS4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgZGF0YSA9IGtpbmQgPT09ICdjc3YnID8gYXdhaXQgZmlsZS50ZXh0KCkgOiBhd2FpdCBmaWxlLmFycmF5QnVmZmVyKCk7XG4gIG5ldyBGb2xkZXJQaWNrZXIoYXBwLCAoZm9sZGVyKSA9PiB2b2lkIHJ1bkltcG9ydChhcHAsIGtpbmQsIGZpbGUubmFtZSwgZGF0YSwgZm9sZGVyKSkub3BlbigpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBydW5JbXBvcnQoXG4gIGFwcDogQXBwLFxuICBraW5kOiBJbXBvcnRLaW5kLFxuICBmaWxlTmFtZTogc3RyaW5nLFxuICBkYXRhOiBzdHJpbmcgfCBBcnJheUJ1ZmZlcixcbiAgZm9sZGVyOiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgb3V0Y29tZSA9IGF3YWl0IGltcG9ydFRhYmxlKHtcbiAgICBraW5kLFxuICAgIGZpbGVOYW1lLFxuICAgIGRhdGEsXG4gICAgZm9sZGVyLFxuICAgIGFkYXB0ZXI6IHtcbiAgICAgIGV4aXN0czogKHBhdGgpID0+IGFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCkgIT09IG51bGwsXG4gICAgICBjcmVhdGU6IGFzeW5jIChwYXRoLCBjb250ZW50KSA9PiB7XG4gICAgICAgIGF3YWl0IGFwcC52YXVsdC5jcmVhdGUocGF0aCwgY29udGVudCk7XG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghb3V0Y29tZS5vaykge1xuICAgIG5ldyBOb3RpY2UoYEltcG9ydCBmYWlsZWQuIE5vIGZpbGUgd2FzIHdyaXR0ZW4uICR7b3V0Y29tZS5lcnJvcn1gKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBub3RlcyA9IG91dGNvbWUuaWdub3JlZFNoZWV0cyA+IDAgPyBgIE9ubHkgdGhlIGZpcnN0IHNoZWV0IHdhcyBpbXBvcnRlZCAoJHtvdXRjb21lLmlnbm9yZWRTaGVldHN9IG90aGVyIHNoZWV0KHMpIGlnbm9yZWQpLmAgOiAnJztcbiAgbmV3IE5vdGljZShgSW1wb3J0ZWQgJHtvdXRjb21lLnJlcG9ydC5yb3dDb3VudH0gcm93cyB0byAke291dGNvbWUucGF0aH0uJHtub3Rlc31gKTtcblxuICBjb25zdCBjcmVhdGVkID0gYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChvdXRjb21lLnBhdGgpO1xuICBpZiAoY3JlYXRlZCBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgYXdhaXQgYXBwLndvcmtzcGFjZS5nZXRMZWFmKHRydWUpLm9wZW5GaWxlKGNyZWF0ZWQpO1xuICB9XG59XG5cbi8qKiBGb2xkZXIgY2hvb3Nlci4gJycgbWVhbnMgdGhlIHZhdWx0IHJvb3QuICovXG5jbGFzcyBGb2xkZXJQaWNrZXIgZXh0ZW5kcyBGdXp6eVN1Z2dlc3RNb2RhbDxzdHJpbmc+IHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcmVhZG9ubHkgb25QaWNrOiAoZm9sZGVyOiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ0Nob29zZSB0aGUgZm9sZGVyIGZvciB0aGUgbmV3IHRhYmxlJyk7XG4gIH1cblxuICBnZXRJdGVtcygpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgZm9sZGVycyA9IHRoaXMuYXBwLnZhdWx0XG4gICAgICAuZ2V0QWxsTG9hZGVkRmlsZXMoKVxuICAgICAgLmZpbHRlcigoZik6IGYgaXMgVEZvbGRlciA9PiBmIGluc3RhbmNlb2YgVEZvbGRlciAmJiAhZi5pc1Jvb3QoKSlcbiAgICAgIC5tYXAoKGYpID0+IGYucGF0aClcbiAgICAgIC5zb3J0KCk7XG4gICAgcmV0dXJuIFsnJywgLi4uZm9sZGVyc107XG4gIH1cblxuICBnZXRJdGVtVGV4dChpdGVtOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBpdGVtID09PSAnJyA/ICcvICh2YXVsdCByb290KScgOiBpdGVtO1xuICB9XG5cbiAgb25DaG9vc2VJdGVtKGl0ZW06IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMub25QaWNrKGl0ZW0pO1xuICB9XG59XG4iLCAiLy8gUkZDIDQxODAgQ1NWIHBhcnNlciB3aXRoIHN0cmVhbWluZyAoY2h1bmtlZCkgaW5wdXQgXHUyMDE0IG5vIE9ic2lkaWFuIG9yIE5vZGUgaW1wb3J0cy5cbi8vIFN0ZXAgUDQtMDEgKFNBRC0zNikuIFNwZWM6IHNwZWMvc3RlcHMvUDQtMDEubWQsIHNwZWMvZ3VpZGVsaW5lcy5tZCBQNC0wMS5cbi8vXG4vLyBSdWxlcyAocmVjb3JkZWQgZm9yIGV2aWRlbmNlKTpcbi8vICAtIEZpZWxkcyBtYXkgYmUgcXVvdGVkIHdpdGggXCIuLi5cIjsgYSBkb3VibGVkIFwiXCIgaW5zaWRlIGEgcXVvdGVkIGZpZWxkIGlzIG9uZSBcIi5cbi8vICAtIFF1b3RlZCBmaWVsZHMgbWF5IGNvbnRhaW4gZGVsaW1pdGVycywgQ1IsIGFuZCBMRi5cbi8vICAtIFJlY29yZCBlbmRzOiBMRiwgQ1JMRiwgb3IgYSBsb25lIENSIChvdXRzaWRlIHF1b3RlcykuXG4vLyAgLSBBIFVURi04IEJPTSBhdCB0aGUgdmVyeSBzdGFydCBvZiB0aGUgaW5wdXQgaXMgcmVtb3ZlZC5cbi8vICAtIERlbGltaXRlciBpcyAnLCcgb3IgJzsnLCBkZXRlY3RlZCBvbiB0aGUgZmlyc3QgcmVjb3JkOiB0aGUgY2hhcmFjdGVyIHRoYXQgb2NjdXJzXG4vLyAgICBtb3JlIG9mdGVuIG91dHNpZGUgcXVvdGVzIHdpbnM7IGEgdGllIChpbmNsdWRpbmcgemVybyBvZiBib3RoKSBzZWxlY3RzICcsJy5cbi8vICAtIExlbmllbnQ6IGEgJ1wiJyBpbnNpZGUgYW4gdW5xdW90ZWQgZmllbGQgaXMga2VwdCBsaXRlcmFsbHkuXG4vLyAgLSBTdHJpY3Q6IHRleHQgYWZ0ZXIgYSBjbG9zaW5nIHF1b3RlIChvdGhlciB0aGFuIGEgZGVsaW1pdGVyIG9yIG5ld2xpbmUpIGlzIGFuIGVycm9yLlxuLy8gIC0gU3RyaWN0OiBhbiB1bnRlcm1pbmF0ZWQgcXVvdGVkIGZpZWxkIGF0IGVuZCBvZiBpbnB1dCBpcyBhbiBlcnJvci5cbi8vICAtIFJhZ2dlZCByb3dzIChkaWZmZXJlbnQgY29sdW1uIGNvdW50cykgYXJlIHJldHVybmVkIGFzLWlzOyB0aGUgY2FsbGVyIGRlY2lkZXMuXG4vLyAgLSBOZXZlciB0aHJvd3MuIE1hbGZvcm1lZCBpbnB1dCB5aWVsZHMgeyBvazogZmFsc2UsIGVycm9yLCBsaW5lLCBjb2x1bW4gfS5cbi8vICAtIEVtcHR5IGlucHV0IHlpZWxkcyB6ZXJvIHJvd3MuIEEgdHJhaWxpbmcgbmV3bGluZSBkb2VzIG5vdCBjcmVhdGUgYW4gZW1wdHkgcm93LlxuXG5leHBvcnQgdHlwZSBDc3ZEZWxpbWl0ZXIgPSAnLCcgfCAnOyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ3N2UGFyc2VPcHRpb25zIHtcbiAgLyoqIEZvcmNlIGEgZGVsaW1pdGVyIGluc3RlYWQgb2YgZGV0ZWN0aW5nIGl0LiAqL1xuICBkZWxpbWl0ZXI/OiBDc3ZEZWxpbWl0ZXI7XG59XG5cbmV4cG9ydCB0eXBlIENzdlBhcnNlUmVzdWx0ID1cbiAgfCB7IG9rOiB0cnVlOyBkZWxpbWl0ZXI6IENzdkRlbGltaXRlcjsgcm93czogc3RyaW5nW11bXTsgaGFkQm9tOiBib29sZWFuIH1cbiAgfCB7IG9rOiBmYWxzZTsgZXJyb3I6IHN0cmluZzsgbGluZTogbnVtYmVyOyBjb2x1bW46IG51bWJlciB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIENzdlN0cmVhbU9wdGlvbnMgZXh0ZW5kcyBDc3ZQYXJzZU9wdGlvbnMge1xuICAvKiogQ2FsbGVkIG9uY2UgcGVyIHJlY29yZCwgaW4gb3JkZXIuICovXG4gIG9uUm93OiAocm93OiBzdHJpbmdbXSkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IHR5cGUgQ3N2U3RyZWFtUmVzdWx0ID1cbiAgfCB7IG9rOiB0cnVlOyBkZWxpbWl0ZXI6IENzdkRlbGltaXRlcjsgaGFkQm9tOiBib29sZWFuOyByb3dDb3VudDogbnVtYmVyIH1cbiAgfCB7IG9rOiBmYWxzZTsgZXJyb3I6IHN0cmluZzsgbGluZTogbnVtYmVyOyBjb2x1bW46IG51bWJlcjsgcm93Q291bnQ6IG51bWJlciB9O1xuXG4vKiogRGVmYXVsdCBjaHVuayBzaXplIHVzZWQgYnkgcGFyc2VDc3Ygd2hlbiBpdCBmZWVkcyB0aGUgc3RyZWFtaW5nIHBhcnNlci4gKi9cbmV4cG9ydCBjb25zdCBDU1ZfQ0hVTktfU0laRSA9IDY0ICogMTAyNDtcblxudHlwZSBTdGF0ZSA9ICdGSUVMRF9TVEFSVCcgfCAnVU5RVU9URUQnIHwgJ1FVT1RFRCcgfCAnUVVPVEVfU0VFTic7XG5cbi8qKlxuICogU3RyZWFtaW5nIENTViBwYXJzZXIuIEZlZWQgdGV4dCB3aXRoIHB1c2goKSwgdGhlbiBjYWxsIGVuZCgpLlxuICogTWVtb3J5IHVzZSBpcyBib3VuZGVkIGJ5IHRoZSBsb25nZXN0IHJlY29yZCwgbm90IGJ5IHRoZSBpbnB1dCBzaXplLlxuICovXG5leHBvcnQgY2xhc3MgQ3N2U3RyZWFtUGFyc2VyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBvblJvdzogKHJvdzogc3RyaW5nW10pID0+IHZvaWQ7XG4gIHByaXZhdGUgZGVsaW1pdGVyOiBDc3ZEZWxpbWl0ZXIgfCBudWxsO1xuICBwcml2YXRlIGhhZEJvbSA9IGZhbHNlO1xuICBwcml2YXRlIHN0YXJ0ZWQgPSBmYWxzZTtcblxuICAvLyBEZWxpbWl0ZXIgZGV0ZWN0aW9uIGJ1ZmZlciAodXNlZCB1bnRpbCB0aGUgZmlyc3QgcmVjb3JkIGlzIGNvbXBsZXRlKS5cbiAgcHJpdmF0ZSBoZWFkID0gJyc7XG4gIHByaXZhdGUgaGVhZFNjYW5JZHggPSAwO1xuICBwcml2YXRlIGhlYWRJblF1b3RlID0gZmFsc2U7XG4gIHByaXZhdGUgaGVhZERvbmUgPSBmYWxzZTtcbiAgcHJpdmF0ZSBoZWFkQ29tbWFzID0gMDtcbiAgcHJpdmF0ZSBoZWFkU2VtaXMgPSAwO1xuXG4gIC8vIFJlY29yZCBzdGF0ZSBtYWNoaW5lLlxuICBwcml2YXRlIHN0YXRlOiBTdGF0ZSA9ICdGSUVMRF9TVEFSVCc7XG4gIHByaXZhdGUgcm93OiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGZpZWxkID0gJyc7XG4gIHByaXZhdGUgc2tpcExGID0gZmFsc2U7XG4gIHByaXZhdGUgbGluZSA9IDE7XG4gIHByaXZhdGUgY29sdW1uID0gMTtcbiAgcHJpdmF0ZSByb3dDb3VudCA9IDA7XG4gIHByaXZhdGUgZmFpbHVyZTogeyBlcnJvcjogc3RyaW5nOyBsaW5lOiBudW1iZXI7IGNvbHVtbjogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBDc3ZTdHJlYW1PcHRpb25zKSB7XG4gICAgdGhpcy5vblJvdyA9IG9wdGlvbnMub25Sb3c7XG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciA/PyBudWxsO1xuICB9XG5cbiAgcHVzaChjaHVuazogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZmFpbHVyZSB8fCBjaHVuay5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICBpZiAoIXRoaXMuc3RhcnRlZCkge1xuICAgICAgdGhpcy5zdGFydGVkID0gdHJ1ZTtcbiAgICAgIGlmIChjaHVuay5jaGFyQ29kZUF0KDApID09PSAweGZlZmYpIHtcbiAgICAgICAgdGhpcy5oYWRCb20gPSB0cnVlO1xuICAgICAgICBjaHVuayA9IGNodW5rLnNsaWNlKDEpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5kZWxpbWl0ZXIgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuaGVhZCArPSBjaHVuaztcbiAgICAgIHRoaXMuc2NhbkhlYWQoKTtcbiAgICAgIGlmICghdGhpcy5oZWFkRG9uZSkgcmV0dXJuO1xuICAgICAgdGhpcy5kZWxpbWl0ZXIgPSB0aGlzLmRlY2lkZURlbGltaXRlcigpO1xuICAgICAgLy8gRmVlZCBldmVyeXRoaW5nIGJ1ZmZlcmVkIHNvIGZhciwgdGhlbiBjbGVhciB0aGUgYnVmZmVyLlxuICAgICAgY29uc3QgYnVmZmVyZWQgPSB0aGlzLmhlYWQ7XG4gICAgICB0aGlzLmhlYWQgPSAnJztcbiAgICAgIHRoaXMuZmVlZChidWZmZXJlZCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuZmVlZChjaHVuayk7XG4gIH1cblxuICBlbmQoKTogQ3N2U3RyZWFtUmVzdWx0IHtcbiAgICBpZiAodGhpcy5mYWlsdXJlKSByZXR1cm4gdGhpcy5mYWlsdXJlUmVzdWx0KCk7XG4gICAgaWYgKHRoaXMuZGVsaW1pdGVyID09PSBudWxsKSB7XG4gICAgICAvLyBJbnB1dCBlbmRlZCBiZWZvcmUgdGhlIGZpcnN0IHJlY29yZCBmaW5pc2hlZDogZGVjaWRlIG5vdy5cbiAgICAgIHRoaXMuZGVsaW1pdGVyID0gdGhpcy5kZWNpZGVEZWxpbWl0ZXIoKTtcbiAgICAgIGNvbnN0IGJ1ZmZlcmVkID0gdGhpcy5oZWFkO1xuICAgICAgdGhpcy5oZWFkID0gJyc7XG4gICAgICB0aGlzLmZlZWQoYnVmZmVyZWQpO1xuICAgICAgaWYgKHRoaXMuZmFpbHVyZSkgcmV0dXJuIHRoaXMuZmFpbHVyZVJlc3VsdCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gJ1FVT1RFRCcpIHtcbiAgICAgIHJldHVybiB0aGlzLmZhaWwoJ1VudGVybWluYXRlZCBxdW90ZWQgZmllbGQgYXQgZW5kIG9mIGlucHV0Jyk7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0YXRlID09PSAnUVVPVEVfU0VFTicgfHwgdGhpcy5yb3cubGVuZ3RoID4gMCB8fCB0aGlzLmZpZWxkLmxlbmd0aCA+IDAgfHwgdGhpcy5zdGF0ZSAhPT0gJ0ZJRUxEX1NUQVJUJykge1xuICAgICAgdGhpcy5wdXNoRmllbGQoKTtcbiAgICAgIHRoaXMuZW1pdFJvdygpO1xuICAgIH1cbiAgICByZXR1cm4geyBvazogdHJ1ZSwgZGVsaW1pdGVyOiB0aGlzLmRlbGltaXRlciwgaGFkQm9tOiB0aGlzLmhhZEJvbSwgcm93Q291bnQ6IHRoaXMucm93Q291bnQgfTtcbiAgfVxuXG4gIC8vIC0tLS0gZGVsaW1pdGVyIGRldGVjdGlvbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLyoqIFNjYW4gdGhlIGJ1ZmZlcmVkIGhlYWQgdW50aWwgdGhlIGZpcnN0IHJlY29yZCBlbmRzICh1bnF1b3RlZCBuZXdsaW5lKS4gKi9cbiAgcHJpdmF0ZSBzY2FuSGVhZCgpOiB2b2lkIHtcbiAgICBjb25zdCBzID0gdGhpcy5oZWFkO1xuICAgIGxldCBpID0gdGhpcy5oZWFkU2NhbklkeDtcbiAgICB3aGlsZSAoaSA8IHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBjID0gcy5jaGFyQ29kZUF0KGkpO1xuICAgICAgaWYgKGMgPT09IDB4MjIpIHtcbiAgICAgICAgdGhpcy5oZWFkSW5RdW90ZSA9ICF0aGlzLmhlYWRJblF1b3RlO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy5oZWFkSW5RdW90ZSkge1xuICAgICAgICBpZiAoYyA9PT0gMHgwYSB8fCBjID09PSAweDBkKSB7XG4gICAgICAgICAgdGhpcy5oZWFkRG9uZSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGMgPT09IDB4MmMpIHRoaXMuaGVhZENvbW1hcysrO1xuICAgICAgICBlbHNlIGlmIChjID09PSAweDNiKSB0aGlzLmhlYWRTZW1pcysrO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgICB0aGlzLmhlYWRTY2FuSWR4ID0gaTtcbiAgfVxuXG4gIHByaXZhdGUgZGVjaWRlRGVsaW1pdGVyKCk6IENzdkRlbGltaXRlciB7XG4gICAgcmV0dXJuIHRoaXMuaGVhZFNlbWlzID4gdGhpcy5oZWFkQ29tbWFzID8gJzsnIDogJywnO1xuICB9XG5cbiAgLy8gLS0tLSByZWNvcmQgc3RhdGUgbWFjaGluZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICBwcml2YXRlIGZlZWQodGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZGVsaW0gPSB0aGlzLmRlbGltaXRlciBhcyBDc3ZEZWxpbWl0ZXI7XG4gICAgY29uc3QgZGVsaW1Db2RlID0gZGVsaW0uY2hhckNvZGVBdCgwKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGMgPSB0ZXh0LmNoYXJDb2RlQXQoaSk7XG5cbiAgICAgIGlmICh0aGlzLnNraXBMRikge1xuICAgICAgICB0aGlzLnNraXBMRiA9IGZhbHNlO1xuICAgICAgICBpZiAoYyA9PT0gMHgwYSkge1xuICAgICAgICAgIHRoaXMuYWR2YW5jZShjKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgICAgY2FzZSAnRklFTERfU1RBUlQnOlxuICAgICAgICAgIGlmIChjID09PSAweDIyKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1FVT1RFRCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChjID09PSBkZWxpbUNvZGUpIHtcbiAgICAgICAgICAgIHRoaXMucHVzaEZpZWxkKCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChjID09PSAweDBhIHx8IGMgPT09IDB4MGQpIHtcbiAgICAgICAgICAgIHRoaXMuZW5kUmVjb3JkKGMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmZpZWxkID0gdGV4dFtpXTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnVU5RVU9URUQnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdVTlFVT1RFRCc6XG4gICAgICAgICAgaWYgKGMgPT09IGRlbGltQ29kZSkge1xuICAgICAgICAgICAgdGhpcy5wdXNoRmllbGQoKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnRklFTERfU1RBUlQnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gMHgwYSB8fCBjID09PSAweDBkKSB7XG4gICAgICAgICAgICB0aGlzLmVuZFJlY29yZChjKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnRklFTERfU1RBUlQnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmZpZWxkICs9IHRleHRbaV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ1FVT1RFRCc6XG4gICAgICAgICAgaWYgKGMgPT09IDB4MjIpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnUVVPVEVfU0VFTic7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZmllbGQgKz0gdGV4dFtpXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnUVVPVEVfU0VFTic6XG4gICAgICAgICAgaWYgKGMgPT09IDB4MjIpIHtcbiAgICAgICAgICAgIHRoaXMuZmllbGQgKz0gJ1wiJztcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnUVVPVEVEJztcbiAgICAgICAgICB9IGVsc2UgaWYgKGMgPT09IGRlbGltQ29kZSkge1xuICAgICAgICAgICAgdGhpcy5wdXNoRmllbGQoKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnRklFTERfU1RBUlQnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gMHgwYSB8fCBjID09PSAweDBkKSB7XG4gICAgICAgICAgICB0aGlzLmVuZFJlY29yZChjKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnRklFTERfU1RBUlQnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmZhaWwoYFVuZXhwZWN0ZWQgY2hhcmFjdGVyIGFmdGVyIGNsb3NpbmcgcXVvdGU6IFwiJHt0ZXh0W2ldfVwiYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgdGhpcy5hZHZhbmNlKGMpO1xuICAgICAgaWYgKHRoaXMuZmFpbHVyZSkgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWR2YW5jZShjOiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAoYyA9PT0gMHgwYSB8fCBjID09PSAweDBkKSB7XG4gICAgICB0aGlzLmxpbmUrKztcbiAgICAgIHRoaXMuY29sdW1uID0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb2x1bW4rKztcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHB1c2hGaWVsZCgpOiB2b2lkIHtcbiAgICB0aGlzLnJvdy5wdXNoKHRoaXMuZmllbGQpO1xuICAgIHRoaXMuZmllbGQgPSAnJztcbiAgfVxuXG4gIHByaXZhdGUgZW5kUmVjb3JkKGM6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMucHVzaEZpZWxkKCk7XG4gICAgdGhpcy5lbWl0Um93KCk7XG4gICAgaWYgKGMgPT09IDB4MGQpIHRoaXMuc2tpcExGID0gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgZW1pdFJvdygpOiB2b2lkIHtcbiAgICBjb25zdCByb3cgPSB0aGlzLnJvdztcbiAgICB0aGlzLnJvdyA9IFtdO1xuICAgIHRoaXMucm93Q291bnQrKztcbiAgICB0aGlzLm9uUm93KHJvdyk7XG4gIH1cblxuICBwcml2YXRlIGZhaWwoZXJyb3I6IHN0cmluZyk6IENzdlN0cmVhbVJlc3VsdCB7XG4gICAgdGhpcy5mYWlsdXJlID0geyBlcnJvciwgbGluZTogdGhpcy5saW5lLCBjb2x1bW46IHRoaXMuY29sdW1uIH07XG4gICAgcmV0dXJuIHRoaXMuZmFpbHVyZVJlc3VsdCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBmYWlsdXJlUmVzdWx0KCk6IENzdlN0cmVhbVJlc3VsdCB7XG4gICAgY29uc3QgZiA9IHRoaXMuZmFpbHVyZSBhcyB7IGVycm9yOiBzdHJpbmc7IGxpbmU6IG51bWJlcjsgY29sdW1uOiBudW1iZXIgfTtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBmLmVycm9yLCBsaW5lOiBmLmxpbmUsIGNvbHVtbjogZi5jb2x1bW4sIHJvd0NvdW50OiB0aGlzLnJvd0NvdW50IH07XG4gIH1cbn1cblxuLyoqXG4gKiBQYXJzZSBhIGZ1bGwgQ1NWIHN0cmluZy4gSW50ZXJuYWxseSB1c2VzIHRoZSBzdHJlYW1pbmcgcGFyc2VyLCBmZWQgaW5cbiAqIENTVl9DSFVOS19TSVpFIHNsaWNlcywgc28gYm90aCBwYXRocyBzaGFyZSBvbmUgaW1wbGVtZW50YXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNzdihpbnB1dDogc3RyaW5nLCBvcHRpb25zOiBDc3ZQYXJzZU9wdGlvbnMgPSB7fSk6IENzdlBhcnNlUmVzdWx0IHtcbiAgY29uc3Qgcm93czogc3RyaW5nW11bXSA9IFtdO1xuICBjb25zdCBwYXJzZXIgPSBuZXcgQ3N2U3RyZWFtUGFyc2VyKHsgLi4ub3B0aW9ucywgb25Sb3c6IChyKSA9PiByb3dzLnB1c2gocikgfSk7XG4gIGZvciAobGV0IHBvcyA9IDA7IHBvcyA8IGlucHV0Lmxlbmd0aDsgcG9zICs9IENTVl9DSFVOS19TSVpFKSB7XG4gICAgcGFyc2VyLnB1c2goaW5wdXQuc2xpY2UocG9zLCBwb3MgKyBDU1ZfQ0hVTktfU0laRSkpO1xuICB9XG4gIGNvbnN0IHJlcyA9IHBhcnNlci5lbmQoKTtcbiAgaWYgKCFyZXMub2spIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IHJlcy5lcnJvciwgbGluZTogcmVzLmxpbmUsIGNvbHVtbjogcmVzLmNvbHVtbiB9O1xuICByZXR1cm4geyBvazogdHJ1ZSwgZGVsaW1pdGVyOiByZXMuZGVsaW1pdGVyLCByb3dzLCBoYWRCb206IHJlcy5oYWRCb20gfTtcbn1cblxuLyoqIERldGVjdCAnLCcgb3IgJzsnIGZyb20gdGhlIGZpcnN0IHJlY29yZCBvZiBhIHRleHQuIFJldHVybnMgJywnIG9uIGEgdGllLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdERlbGltaXRlcih0ZXh0OiBzdHJpbmcpOiBDc3ZEZWxpbWl0ZXIge1xuICBsZXQgY29tbWFzID0gMDtcbiAgbGV0IHNlbWlzID0gMDtcbiAgbGV0IGluUXVvdGUgPSBmYWxzZTtcbiAgY29uc3QgcyA9IHRleHQuY2hhckNvZGVBdCgwKSA9PT0gMHhmZWZmID8gdGV4dC5zbGljZSgxKSA6IHRleHQ7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGMgPSBzLmNoYXJDb2RlQXQoaSk7XG4gICAgaWYgKGMgPT09IDB4MjIpIGluUXVvdGUgPSAhaW5RdW90ZTtcbiAgICBlbHNlIGlmICghaW5RdW90ZSkge1xuICAgICAgaWYgKGMgPT09IDB4MGEgfHwgYyA9PT0gMHgwZCkgYnJlYWs7XG4gICAgICBpZiAoYyA9PT0gMHgyYykgY29tbWFzKys7XG4gICAgICBlbHNlIGlmIChjID09PSAweDNiKSBzZW1pcysrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc2VtaXMgPiBjb21tYXMgPyAnOycgOiAnLCc7XG59XG4iLCAiZXhwb3J0IGRlZmF1bHQge1xyXG5cdGNyZWF0ZURvY3VtZW50KGNvbnRlbnQpIHtcclxuXHRcdC8vIGlmICghY29udGVudCkge1xyXG5cdFx0Ly8gXHR0aHJvdyBuZXcgRXJyb3IoJ05vICoueG1sIGNvbnRlbnQnKVxyXG5cdFx0Ly8gfVxyXG5cdFx0Ly8gQSB3ZWlyZCBidWc6IGl0IHdvbid0IHBhcnNlIFhNTCB1bmxlc3MgaXQncyB0cmltbWVkLlxyXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL2NhdGFtcGhldGFtaW5lL3JlYWQtZXhjZWwtZmlsZS9pc3N1ZXMvMjFcclxuXHRcdHJldHVybiBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKGNvbnRlbnQudHJpbSgpLCAndGV4dC94bWwnKVxyXG5cdH1cclxufSIsICIvLyBERUZMQVRFIGlzIGEgY29tcGxleCBmb3JtYXQ7IHRvIHJlYWQgdGhpcyBjb2RlLCB5b3Ugc2hvdWxkIHByb2JhYmx5IGNoZWNrIHRoZSBSRkMgZmlyc3Q6XG4vLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMTk1MVxuLy8gWW91IG1heSBhbHNvIHdpc2ggdG8gdGFrZSBhIGxvb2sgYXQgdGhlIGd1aWRlIEkgbWFkZSBhYm91dCB0aGlzIHByb2dyYW06XG4vLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS8xMDFhcnJvd3ovMjUzZjMxZWI1YWJjM2Q5Mjc1YWI5NDMwMDNmZmVjYWRcbi8vIFNvbWUgb2YgdGhlIGZvbGxvd2luZyBjb2RlIGlzIHNpbWlsYXIgdG8gdGhhdCBvZiBVWklQLmpzOlxuLy8gaHR0cHM6Ly9naXRodWIuY29tL3Bob3RvcGVhL1VaSVAuanNcbi8vIEhvd2V2ZXIsIHRoZSB2YXN0IG1ham9yaXR5IG9mIHRoZSBjb2RlYmFzZSBoYXMgZGl2ZXJnZWQgZnJvbSBVWklQLmpzIHRvIGluY3JlYXNlIHBlcmZvcm1hbmNlIGFuZCByZWR1Y2UgYnVuZGxlIHNpemUuXG4vLyBTb21ldGltZXMgMCB3aWxsIGFwcGVhciB3aGVyZSAtMSB3b3VsZCBiZSBtb3JlIGFwcHJvcHJpYXRlLiBUaGlzIGlzIGJlY2F1c2UgdXNpbmcgYSB1aW50XG4vLyBpcyBiZXR0ZXIgZm9yIG1lbW9yeSBpbiBtb3N0IGVuZ2luZXMgKEkgKnRoaW5rKikuXG52YXIgY2gyID0ge307XG52YXIgd2sgPSAoZnVuY3Rpb24gKGMsIGlkLCBtc2csIHRyYW5zZmVyLCBjYikge1xuICAgIHZhciB3ID0gbmV3IFdvcmtlcihjaDJbaWRdIHx8IChjaDJbaWRdID0gVVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgQmxvYihbXG4gICAgICAgIGMgKyAnO2FkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLGZ1bmN0aW9uKGUpe2U9ZS5lcnJvcjtwb3N0TWVzc2FnZSh7JGUkOltlLm1lc3NhZ2UsZS5jb2RlLGUuc3RhY2tdfSl9KSdcbiAgICBdLCB7IHR5cGU6ICd0ZXh0L2phdmFzY3JpcHQnIH0pKSkpO1xuICAgIHcub25tZXNzYWdlID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyIGQgPSBlLmRhdGEsIGVkID0gZC4kZSQ7XG4gICAgICAgIGlmIChlZCkge1xuICAgICAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcihlZFswXSk7XG4gICAgICAgICAgICBlcnJbJ2NvZGUnXSA9IGVkWzFdO1xuICAgICAgICAgICAgZXJyLnN0YWNrID0gZWRbMl07XG4gICAgICAgICAgICBjYihlcnIsIG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIGNiKG51bGwsIGQpO1xuICAgIH07XG4gICAgdy5wb3N0TWVzc2FnZShtc2csIHRyYW5zZmVyKTtcbiAgICByZXR1cm4gdztcbn0pO1xuXG4vLyBhbGlhc2VzIGZvciBzaG9ydGVyIGNvbXByZXNzZWQgY29kZSAobW9zdCBtaW5pZmVycyBkb24ndCBkbyB0aGlzKVxudmFyIHU4ID0gVWludDhBcnJheSwgdTE2ID0gVWludDE2QXJyYXksIGkzMiA9IEludDMyQXJyYXk7XG4vLyBmaXhlZCBsZW5ndGggZXh0cmEgYml0c1xudmFyIGZsZWIgPSBuZXcgdTgoWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDEsIDEsIDEsIDEsIDIsIDIsIDIsIDIsIDMsIDMsIDMsIDMsIDQsIDQsIDQsIDQsIDUsIDUsIDUsIDUsIDAsIC8qIHVudXNlZCAqLyAwLCAwLCAvKiBpbXBvc3NpYmxlICovIDBdKTtcbi8vIGZpeGVkIGRpc3RhbmNlIGV4dHJhIGJpdHNcbnZhciBmZGViID0gbmV3IHU4KFswLCAwLCAwLCAwLCAxLCAxLCAyLCAyLCAzLCAzLCA0LCA0LCA1LCA1LCA2LCA2LCA3LCA3LCA4LCA4LCA5LCA5LCAxMCwgMTAsIDExLCAxMSwgMTIsIDEyLCAxMywgMTMsIC8qIHVudXNlZCAqLyAwLCAwXSk7XG4vLyBjb2RlIGxlbmd0aCBpbmRleCBtYXBcbnZhciBjbGltID0gbmV3IHU4KFsxNiwgMTcsIDE4LCAwLCA4LCA3LCA5LCA2LCAxMCwgNSwgMTEsIDQsIDEyLCAzLCAxMywgMiwgMTQsIDEsIDE1XSk7XG4vLyBnZXQgYmFzZSwgcmV2ZXJzZSBpbmRleCBtYXAgZnJvbSBleHRyYSBiaXRzXG52YXIgZnJlYiA9IGZ1bmN0aW9uIChlYiwgc3RhcnQpIHtcbiAgICB2YXIgYiA9IG5ldyB1MTYoMzEpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMzE7ICsraSkge1xuICAgICAgICBiW2ldID0gc3RhcnQgKz0gMSA8PCBlYltpIC0gMV07XG4gICAgfVxuICAgIC8vIG51bWJlcnMgaGVyZSBhcmUgYXQgbWF4IDE4IGJpdHNcbiAgICB2YXIgciA9IG5ldyBpMzIoYlszMF0pO1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgMzA7ICsraSkge1xuICAgICAgICBmb3IgKHZhciBqID0gYltpXTsgaiA8IGJbaSArIDFdOyArK2opIHtcbiAgICAgICAgICAgIHJbal0gPSAoKGogLSBiW2ldKSA8PCA1KSB8IGk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgYjogYiwgcjogciB9O1xufTtcbnZhciBfYSA9IGZyZWIoZmxlYiwgMiksIGZsID0gX2EuYiwgcmV2ZmwgPSBfYS5yO1xuLy8gd2UgY2FuIGlnbm9yZSB0aGUgZmFjdCB0aGF0IHRoZSBvdGhlciBudW1iZXJzIGFyZSB3cm9uZzsgdGhleSBuZXZlciBoYXBwZW4gYW55d2F5XG5mbFsyOF0gPSAyNTgsIHJldmZsWzI1OF0gPSAyODtcbnZhciBfYiA9IGZyZWIoZmRlYiwgMCksIGZkID0gX2IuYiwgcmV2ZmQgPSBfYi5yO1xuLy8gbWFwIG9mIHZhbHVlIHRvIHJldmVyc2UgKGFzc3VtaW5nIDE2IGJpdHMpXG52YXIgcmV2ID0gbmV3IHUxNigzMjc2OCk7XG5mb3IgKHZhciBpID0gMDsgaSA8IDMyNzY4OyArK2kpIHtcbiAgICAvLyByZXZlcnNlIHRhYmxlIGFsZ29yaXRobSBmcm9tIFNPXG4gICAgdmFyIHggPSAoKGkgJiAweEFBQUEpID4+IDEpIHwgKChpICYgMHg1NTU1KSA8PCAxKTtcbiAgICB4ID0gKCh4ICYgMHhDQ0NDKSA+PiAyKSB8ICgoeCAmIDB4MzMzMykgPDwgMik7XG4gICAgeCA9ICgoeCAmIDB4RjBGMCkgPj4gNCkgfCAoKHggJiAweDBGMEYpIDw8IDQpO1xuICAgIHJldltpXSA9ICgoKHggJiAweEZGMDApID4+IDgpIHwgKCh4ICYgMHgwMEZGKSA8PCA4KSkgPj4gMTtcbn1cbi8vIGNyZWF0ZSBodWZmbWFuIHRyZWUgZnJvbSB1OCBcIm1hcFwiOiBpbmRleCAtPiBjb2RlIGxlbmd0aCBmb3IgY29kZSBpbmRleFxuLy8gbWIgKG1heCBiaXRzKSBtdXN0IGJlIGF0IG1vc3QgMTVcbi8vIFRPRE86IG9wdGltaXplL3NwbGl0IHVwP1xudmFyIGhNYXAgPSAoZnVuY3Rpb24gKGNkLCBtYiwgcikge1xuICAgIHZhciBzID0gY2QubGVuZ3RoO1xuICAgIC8vIGluZGV4XG4gICAgdmFyIGkgPSAwO1xuICAgIC8vIHUxNiBcIm1hcFwiOiBpbmRleCAtPiAjIG9mIGNvZGVzIHdpdGggYml0IGxlbmd0aCA9IGluZGV4XG4gICAgdmFyIGwgPSBuZXcgdTE2KG1iKTtcbiAgICAvLyBsZW5ndGggb2YgY2QgbXVzdCBiZSAyODggKHRvdGFsICMgb2YgY29kZXMpXG4gICAgZm9yICg7IGkgPCBzOyArK2kpIHtcbiAgICAgICAgaWYgKGNkW2ldKVxuICAgICAgICAgICAgKytsW2NkW2ldIC0gMV07XG4gICAgfVxuICAgIC8vIHUxNiBcIm1hcFwiOiBpbmRleCAtPiBtaW5pbXVtIGNvZGUgZm9yIGJpdCBsZW5ndGggPSBpbmRleFxuICAgIHZhciBsZSA9IG5ldyB1MTYobWIpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBtYjsgKytpKSB7XG4gICAgICAgIGxlW2ldID0gKGxlW2kgLSAxXSArIGxbaSAtIDFdKSA8PCAxO1xuICAgIH1cbiAgICB2YXIgY287XG4gICAgaWYgKHIpIHtcbiAgICAgICAgLy8gdTE2IFwibWFwXCI6IGluZGV4IC0+IG51bWJlciBvZiBhY3R1YWwgYml0cywgc3ltYm9sIGZvciBjb2RlXG4gICAgICAgIGNvID0gbmV3IHUxNigxIDw8IG1iKTtcbiAgICAgICAgLy8gYml0cyB0byByZW1vdmUgZm9yIHJldmVyc2VyXG4gICAgICAgIHZhciBydmIgPSAxNSAtIG1iO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgczsgKytpKSB7XG4gICAgICAgICAgICAvLyBpZ25vcmUgMCBsZW5ndGhzXG4gICAgICAgICAgICBpZiAoY2RbaV0pIHtcbiAgICAgICAgICAgICAgICAvLyBudW0gZW5jb2RpbmcgYm90aCBzeW1ib2wgYW5kIGJpdHMgcmVhZFxuICAgICAgICAgICAgICAgIHZhciBzdiA9IChpIDw8IDQpIHwgY2RbaV07XG4gICAgICAgICAgICAgICAgLy8gZnJlZSBiaXRzXG4gICAgICAgICAgICAgICAgdmFyIHJfMSA9IG1iIC0gY2RbaV07XG4gICAgICAgICAgICAgICAgLy8gc3RhcnQgdmFsdWVcbiAgICAgICAgICAgICAgICB2YXIgdiA9IGxlW2NkW2ldIC0gMV0rKyA8PCByXzE7XG4gICAgICAgICAgICAgICAgLy8gbSBpcyBlbmQgdmFsdWVcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBtID0gdiB8ICgoMSA8PCByXzEpIC0gMSk7IHYgPD0gbTsgKyt2KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGV2ZXJ5IDE2IGJpdCB2YWx1ZSBzdGFydGluZyB3aXRoIHRoZSBjb2RlIHlpZWxkcyB0aGUgc2FtZSByZXN1bHRcbiAgICAgICAgICAgICAgICAgICAgY29bcmV2W3ZdID4+IHJ2Yl0gPSBzdjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGNvID0gbmV3IHUxNihzKTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHM7ICsraSkge1xuICAgICAgICAgICAgaWYgKGNkW2ldKSB7XG4gICAgICAgICAgICAgICAgY29baV0gPSByZXZbbGVbY2RbaV0gLSAxXSsrXSA+PiAoMTUgLSBjZFtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvO1xufSk7XG4vLyBmaXhlZCBsZW5ndGggdHJlZVxudmFyIGZsdCA9IG5ldyB1OCgyODgpO1xuZm9yICh2YXIgaSA9IDA7IGkgPCAxNDQ7ICsraSlcbiAgICBmbHRbaV0gPSA4O1xuZm9yICh2YXIgaSA9IDE0NDsgaSA8IDI1NjsgKytpKVxuICAgIGZsdFtpXSA9IDk7XG5mb3IgKHZhciBpID0gMjU2OyBpIDwgMjgwOyArK2kpXG4gICAgZmx0W2ldID0gNztcbmZvciAodmFyIGkgPSAyODA7IGkgPCAyODg7ICsraSlcbiAgICBmbHRbaV0gPSA4O1xuLy8gZml4ZWQgZGlzdGFuY2UgdHJlZVxudmFyIGZkdCA9IG5ldyB1OCgzMik7XG5mb3IgKHZhciBpID0gMDsgaSA8IDMyOyArK2kpXG4gICAgZmR0W2ldID0gNTtcbi8vIGZpeGVkIGxlbmd0aCBtYXBcbnZhciBmbG0gPSAvKiNfX1BVUkVfXyovIGhNYXAoZmx0LCA5LCAwKSwgZmxybSA9IC8qI19fUFVSRV9fKi8gaE1hcChmbHQsIDksIDEpO1xuLy8gZml4ZWQgZGlzdGFuY2UgbWFwXG52YXIgZmRtID0gLyojX19QVVJFX18qLyBoTWFwKGZkdCwgNSwgMCksIGZkcm0gPSAvKiNfX1BVUkVfXyovIGhNYXAoZmR0LCA1LCAxKTtcbi8vIGZpbmQgbWF4IG9mIGFycmF5XG52YXIgbWF4ID0gZnVuY3Rpb24gKGEpIHtcbiAgICB2YXIgbSA9IGFbMF07XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmIChhW2ldID4gbSlcbiAgICAgICAgICAgIG0gPSBhW2ldO1xuICAgIH1cbiAgICByZXR1cm4gbTtcbn07XG4vLyByZWFkIGQsIHN0YXJ0aW5nIGF0IGJpdCBwIGFuZCBtYXNrIHdpdGggbVxudmFyIGJpdHMgPSBmdW5jdGlvbiAoZCwgcCwgbSkge1xuICAgIHZhciBvID0gKHAgLyA4KSB8IDA7XG4gICAgcmV0dXJuICgoZFtvXSB8IChkW28gKyAxXSA8PCA4KSkgPj4gKHAgJiA3KSkgJiBtO1xufTtcbi8vIHJlYWQgZCwgc3RhcnRpbmcgYXQgYml0IHAgY29udGludWluZyBmb3IgYXQgbGVhc3QgMTYgYml0c1xudmFyIGJpdHMxNiA9IGZ1bmN0aW9uIChkLCBwKSB7XG4gICAgdmFyIG8gPSAocCAvIDgpIHwgMDtcbiAgICByZXR1cm4gKChkW29dIHwgKGRbbyArIDFdIDw8IDgpIHwgKGRbbyArIDJdIDw8IDE2KSkgPj4gKHAgJiA3KSk7XG59O1xuLy8gZ2V0IGVuZCBvZiBieXRlXG52YXIgc2hmdCA9IGZ1bmN0aW9uIChwKSB7IHJldHVybiAoKHAgKyA3KSAvIDgpIHwgMDsgfTtcbi8vIHR5cGVkIGFycmF5IHNsaWNlIC0gYWxsb3dzIGdhcmJhZ2UgY29sbGVjdG9yIHRvIGZyZWUgb3JpZ2luYWwgcmVmZXJlbmNlLFxuLy8gd2hpbGUgYmVpbmcgbW9yZSBjb21wYXRpYmxlIHRoYW4gLnNsaWNlXG52YXIgc2xjID0gZnVuY3Rpb24gKHYsIHMsIGUpIHtcbiAgICBpZiAocyA9PSBudWxsIHx8IHMgPCAwKVxuICAgICAgICBzID0gMDtcbiAgICBpZiAoZSA9PSBudWxsIHx8IGUgPiB2Lmxlbmd0aClcbiAgICAgICAgZSA9IHYubGVuZ3RoO1xuICAgIC8vIGNhbid0IHVzZSAuY29uc3RydWN0b3IgaW4gY2FzZSB1c2VyLXN1cHBsaWVkXG4gICAgcmV0dXJuIG5ldyB1OCh2LnN1YmFycmF5KHMsIGUpKTtcbn07XG4vKipcbiAqIENvZGVzIGZvciBlcnJvcnMgZ2VuZXJhdGVkIHdpdGhpbiB0aGlzIGxpYnJhcnlcbiAqL1xuZXhwb3J0IHZhciBGbGF0ZUVycm9yQ29kZSA9IHtcbiAgICBVbmV4cGVjdGVkRU9GOiAwLFxuICAgIEludmFsaWRCbG9ja1R5cGU6IDEsXG4gICAgSW52YWxpZExlbmd0aExpdGVyYWw6IDIsXG4gICAgSW52YWxpZERpc3RhbmNlOiAzLFxuICAgIFN0cmVhbUZpbmlzaGVkOiA0LFxuICAgIE5vU3RyZWFtSGFuZGxlcjogNSxcbiAgICBJbnZhbGlkSGVhZGVyOiA2LFxuICAgIE5vQ2FsbGJhY2s6IDcsXG4gICAgSW52YWxpZFVURjg6IDgsXG4gICAgRXh0cmFGaWVsZFRvb0xvbmc6IDksXG4gICAgSW52YWxpZERhdGU6IDEwLFxuICAgIEZpbGVuYW1lVG9vTG9uZzogMTEsXG4gICAgU3RyZWFtRmluaXNoaW5nOiAxMixcbiAgICBJbnZhbGlkWmlwRGF0YTogMTMsXG4gICAgVW5rbm93bkNvbXByZXNzaW9uTWV0aG9kOiAxNFxufTtcbi8vIGVycm9yIGNvZGVzXG52YXIgZWMgPSBbXG4gICAgJ3VuZXhwZWN0ZWQgRU9GJyxcbiAgICAnaW52YWxpZCBibG9jayB0eXBlJyxcbiAgICAnaW52YWxpZCBsZW5ndGgvbGl0ZXJhbCcsXG4gICAgJ2ludmFsaWQgZGlzdGFuY2UnLFxuICAgICdzdHJlYW0gZmluaXNoZWQnLFxuICAgICdubyBzdHJlYW0gaGFuZGxlcicsXG4gICAgLCAvLyBkZXRlcm1pbmVkIGJ5IGNvbXByZXNzaW9uIGZ1bmN0aW9uXG4gICAgJ25vIGNhbGxiYWNrJyxcbiAgICAnaW52YWxpZCBVVEYtOCBkYXRhJyxcbiAgICAnZXh0cmEgZmllbGQgdG9vIGxvbmcnLFxuICAgICdkYXRlIG5vdCBpbiByYW5nZSAxOTgwLTIwOTknLFxuICAgICdmaWxlbmFtZSB0b28gbG9uZycsXG4gICAgJ3N0cmVhbSBmaW5pc2hpbmcnLFxuICAgICdpbnZhbGlkIHppcCBkYXRhJ1xuICAgIC8vIGRldGVybWluZWQgYnkgdW5rbm93biBjb21wcmVzc2lvbiBtZXRob2Rcbl07XG47XG52YXIgZXJyID0gZnVuY3Rpb24gKGluZCwgbXNnLCBudCkge1xuICAgIHZhciBlID0gbmV3IEVycm9yKG1zZyB8fCBlY1tpbmRdKTtcbiAgICBlLmNvZGUgPSBpbmQ7XG4gICAgaWYgKEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKVxuICAgICAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZShlLCBlcnIpO1xuICAgIGlmICghbnQpXG4gICAgICAgIHRocm93IGU7XG4gICAgcmV0dXJuIGU7XG59O1xuLy8gZXhwYW5kcyByYXcgREVGTEFURSBkYXRhXG52YXIgaW5mbHQgPSBmdW5jdGlvbiAoZGF0LCBzdCwgYnVmLCBkaWN0KSB7XG4gICAgLy8gc291cmNlIGxlbmd0aCAgICAgICBkaWN0IGxlbmd0aFxuICAgIHZhciBzbCA9IGRhdC5sZW5ndGgsIGRsID0gZGljdCA/IGRpY3QubGVuZ3RoIDogMDtcbiAgICBpZiAoIXNsIHx8IHN0LmYgJiYgIXN0LmwpXG4gICAgICAgIHJldHVybiBidWYgfHwgbmV3IHU4KDApO1xuICAgIHZhciBub0J1ZiA9ICFidWY7XG4gICAgLy8gaGF2ZSB0byBlc3RpbWF0ZSBzaXplXG4gICAgdmFyIHJlc2l6ZSA9IG5vQnVmIHx8IHN0LmkgIT0gMjtcbiAgICAvLyBubyBzdGF0ZVxuICAgIHZhciBub1N0ID0gc3QuaTtcbiAgICAvLyBBc3N1bWVzIHJvdWdobHkgMzMlIGNvbXByZXNzaW9uIHJhdGlvIGF2ZXJhZ2VcbiAgICBpZiAobm9CdWYpXG4gICAgICAgIGJ1ZiA9IG5ldyB1OChzbCAqIDMpO1xuICAgIC8vIGVuc3VyZSBidWZmZXIgY2FuIGZpdCBhdCBsZWFzdCBsIGVsZW1lbnRzXG4gICAgdmFyIGNidWYgPSBmdW5jdGlvbiAobCkge1xuICAgICAgICB2YXIgYmwgPSBidWYubGVuZ3RoO1xuICAgICAgICAvLyBuZWVkIHRvIGluY3JlYXNlIHNpemUgdG8gZml0XG4gICAgICAgIGlmIChsID4gYmwpIHtcbiAgICAgICAgICAgIC8vIERvdWJsZSBvciBzZXQgdG8gbmVjZXNzYXJ5LCB3aGljaGV2ZXIgaXMgZ3JlYXRlclxuICAgICAgICAgICAgdmFyIG5idWYgPSBuZXcgdTgoTWF0aC5tYXgoYmwgKiAyLCBsKSk7XG4gICAgICAgICAgICBuYnVmLnNldChidWYpO1xuICAgICAgICAgICAgYnVmID0gbmJ1ZjtcbiAgICAgICAgfVxuICAgIH07XG4gICAgLy8gIGxhc3QgY2h1bmsgICAgICAgICBiaXRwb3MgICAgICAgICAgIGJ5dGVzXG4gICAgdmFyIGZpbmFsID0gc3QuZiB8fCAwLCBwb3MgPSBzdC5wIHx8IDAsIGJ0ID0gc3QuYiB8fCAwLCBsbSA9IHN0LmwsIGRtID0gc3QuZCwgbGJ0ID0gc3QubSwgZGJ0ID0gc3QubjtcbiAgICAvLyB0b3RhbCBiaXRzXG4gICAgdmFyIHRidHMgPSBzbCAqIDg7XG4gICAgZG8ge1xuICAgICAgICBpZiAoIWxtKSB7XG4gICAgICAgICAgICAvLyBCRklOQUwgLSB0aGlzIGlzIG9ubHkgMSB3aGVuIGxhc3QgY2h1bmsgaXMgbmV4dFxuICAgICAgICAgICAgZmluYWwgPSBiaXRzKGRhdCwgcG9zLCAxKTtcbiAgICAgICAgICAgIC8vIHR5cGU6IDAgPSBubyBjb21wcmVzc2lvbiwgMSA9IGZpeGVkIGh1ZmZtYW4sIDIgPSBkeW5hbWljIGh1ZmZtYW5cbiAgICAgICAgICAgIHZhciB0eXBlID0gYml0cyhkYXQsIHBvcyArIDEsIDMpO1xuICAgICAgICAgICAgcG9zICs9IDM7XG4gICAgICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICAgICAgICAvLyBnbyB0byBlbmQgb2YgYnl0ZSBib3VuZGFyeVxuICAgICAgICAgICAgICAgIHZhciBzID0gc2hmdChwb3MpICsgNCwgbCA9IGRhdFtzIC0gNF0gfCAoZGF0W3MgLSAzXSA8PCA4KSwgdCA9IHMgKyBsO1xuICAgICAgICAgICAgICAgIGlmICh0ID4gc2wpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vU3QpXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIoMCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBlbnN1cmUgc2l6ZVxuICAgICAgICAgICAgICAgIGlmIChyZXNpemUpXG4gICAgICAgICAgICAgICAgICAgIGNidWYoYnQgKyBsKTtcbiAgICAgICAgICAgICAgICAvLyBDb3B5IG92ZXIgdW5jb21wcmVzc2VkIGRhdGFcbiAgICAgICAgICAgICAgICBidWYuc2V0KGRhdC5zdWJhcnJheShzLCB0KSwgYnQpO1xuICAgICAgICAgICAgICAgIC8vIEdldCBuZXcgYml0cG9zLCB1cGRhdGUgYnl0ZSBjb3VudFxuICAgICAgICAgICAgICAgIHN0LmIgPSBidCArPSBsLCBzdC5wID0gcG9zID0gdCAqIDgsIHN0LmYgPSBmaW5hbDtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGUgPT0gMSlcbiAgICAgICAgICAgICAgICBsbSA9IGZscm0sIGRtID0gZmRybSwgbGJ0ID0gOSwgZGJ0ID0gNTtcbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGUgPT0gMikge1xuICAgICAgICAgICAgICAgIC8vICBsaXRlcmFsICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxlbmd0aHNcbiAgICAgICAgICAgICAgICB2YXIgaExpdCA9IGJpdHMoZGF0LCBwb3MsIDMxKSArIDI1NywgaGNMZW4gPSBiaXRzKGRhdCwgcG9zICsgMTAsIDE1KSArIDQ7XG4gICAgICAgICAgICAgICAgdmFyIHRsID0gaExpdCArIGJpdHMoZGF0LCBwb3MgKyA1LCAzMSkgKyAxO1xuICAgICAgICAgICAgICAgIHBvcyArPSAxNDtcbiAgICAgICAgICAgICAgICAvLyBsZW5ndGgrZGlzdGFuY2UgdHJlZVxuICAgICAgICAgICAgICAgIHZhciBsZHQgPSBuZXcgdTgodGwpO1xuICAgICAgICAgICAgICAgIC8vIGNvZGUgbGVuZ3RoIHRyZWVcbiAgICAgICAgICAgICAgICB2YXIgY2x0ID0gbmV3IHU4KDE5KTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGhjTGVuOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNlIGluZGV4IG1hcCB0byBnZXQgcmVhbCBjb2RlXG4gICAgICAgICAgICAgICAgICAgIGNsdFtjbGltW2ldXSA9IGJpdHMoZGF0LCBwb3MgKyBpICogMywgNyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBvcyArPSBoY0xlbiAqIDM7XG4gICAgICAgICAgICAgICAgLy8gY29kZSBsZW5ndGhzIGJpdHNcbiAgICAgICAgICAgICAgICB2YXIgY2xiID0gbWF4KGNsdCksIGNsYm1zayA9ICgxIDw8IGNsYikgLSAxO1xuICAgICAgICAgICAgICAgIC8vIGNvZGUgbGVuZ3RocyBtYXBcbiAgICAgICAgICAgICAgICB2YXIgY2xtID0gaE1hcChjbHQsIGNsYiwgMSk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0bDspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHIgPSBjbG1bYml0cyhkYXQsIHBvcywgY2xibXNrKV07XG4gICAgICAgICAgICAgICAgICAgIC8vIGJpdHMgcmVhZFxuICAgICAgICAgICAgICAgICAgICBwb3MgKz0gciAmIDE1O1xuICAgICAgICAgICAgICAgICAgICAvLyBzeW1ib2xcbiAgICAgICAgICAgICAgICAgICAgdmFyIHMgPSByID4+IDQ7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvZGUgbGVuZ3RoIHRvIGNvcHlcbiAgICAgICAgICAgICAgICAgICAgaWYgKHMgPCAxNikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGR0W2krK10gPSBzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gIGNvcHkgICBjb3VudFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGMgPSAwLCBuID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzID09IDE2KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG4gPSAzICsgYml0cyhkYXQsIHBvcywgMyksIHBvcyArPSAyLCBjID0gbGR0W2kgLSAxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHMgPT0gMTcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbiA9IDMgKyBiaXRzKGRhdCwgcG9zLCA3KSwgcG9zICs9IDM7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChzID09IDE4KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG4gPSAxMSArIGJpdHMoZGF0LCBwb3MsIDEyNyksIHBvcyArPSA3O1xuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKG4tLSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZHRbaSsrXSA9IGM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gICAgbGVuZ3RoIHRyZWUgICAgICAgICAgICAgICAgIGRpc3RhbmNlIHRyZWVcbiAgICAgICAgICAgICAgICB2YXIgbHQgPSBsZHQuc3ViYXJyYXkoMCwgaExpdCksIGR0ID0gbGR0LnN1YmFycmF5KGhMaXQpO1xuICAgICAgICAgICAgICAgIC8vIG1heCBsZW5ndGggYml0c1xuICAgICAgICAgICAgICAgIGxidCA9IG1heChsdCk7XG4gICAgICAgICAgICAgICAgLy8gbWF4IGRpc3QgYml0c1xuICAgICAgICAgICAgICAgIGRidCA9IG1heChkdCk7XG4gICAgICAgICAgICAgICAgbG0gPSBoTWFwKGx0LCBsYnQsIDEpO1xuICAgICAgICAgICAgICAgIGRtID0gaE1hcChkdCwgZGJ0LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBlcnIoMSk7XG4gICAgICAgICAgICBpZiAocG9zID4gdGJ0cykge1xuICAgICAgICAgICAgICAgIGlmIChub1N0KVxuICAgICAgICAgICAgICAgICAgICBlcnIoMCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gTWFrZSBzdXJlIHRoZSBidWZmZXIgY2FuIGhvbGQgdGhpcyArIHRoZSBsYXJnZXN0IHBvc3NpYmxlIGFkZGl0aW9uXG4gICAgICAgIC8vIE1heGltdW0gY2h1bmsgc2l6ZSAocHJhY3RpY2FsbHksIHRoZW9yZXRpY2FsbHkgaW5maW5pdGUpIGlzIDJeMTdcbiAgICAgICAgaWYgKHJlc2l6ZSlcbiAgICAgICAgICAgIGNidWYoYnQgKyAxMzEwNzIpO1xuICAgICAgICB2YXIgbG1zID0gKDEgPDwgbGJ0KSAtIDEsIGRtcyA9ICgxIDw8IGRidCkgLSAxO1xuICAgICAgICB2YXIgbHBvcyA9IHBvcztcbiAgICAgICAgZm9yICg7OyBscG9zID0gcG9zKSB7XG4gICAgICAgICAgICAvLyBiaXRzIHJlYWQsIGNvZGVcbiAgICAgICAgICAgIHZhciBjID0gbG1bYml0czE2KGRhdCwgcG9zKSAmIGxtc10sIHN5bSA9IGMgPj4gNDtcbiAgICAgICAgICAgIHBvcyArPSBjICYgMTU7XG4gICAgICAgICAgICBpZiAocG9zID4gdGJ0cykge1xuICAgICAgICAgICAgICAgIGlmIChub1N0KVxuICAgICAgICAgICAgICAgICAgICBlcnIoMCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWMpXG4gICAgICAgICAgICAgICAgZXJyKDIpO1xuICAgICAgICAgICAgaWYgKHN5bSA8IDI1NilcbiAgICAgICAgICAgICAgICBidWZbYnQrK10gPSBzeW07XG4gICAgICAgICAgICBlbHNlIGlmIChzeW0gPT0gMjU2KSB7XG4gICAgICAgICAgICAgICAgbHBvcyA9IHBvcywgbG0gPSBudWxsO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGFkZCA9IHN5bSAtIDI1NDtcbiAgICAgICAgICAgICAgICAvLyBubyBleHRyYSBiaXRzIG5lZWRlZCBpZiBsZXNzXG4gICAgICAgICAgICAgICAgaWYgKHN5bSA+IDI2NCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpbmRleFxuICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IHN5bSAtIDI1NywgYiA9IGZsZWJbaV07XG4gICAgICAgICAgICAgICAgICAgIGFkZCA9IGJpdHMoZGF0LCBwb3MsICgxIDw8IGIpIC0gMSkgKyBmbFtpXTtcbiAgICAgICAgICAgICAgICAgICAgcG9zICs9IGI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGRpc3RcbiAgICAgICAgICAgICAgICB2YXIgZCA9IGRtW2JpdHMxNihkYXQsIHBvcykgJiBkbXNdLCBkc3ltID0gZCA+PiA0O1xuICAgICAgICAgICAgICAgIGlmICghZClcbiAgICAgICAgICAgICAgICAgICAgZXJyKDMpO1xuICAgICAgICAgICAgICAgIHBvcyArPSBkICYgMTU7XG4gICAgICAgICAgICAgICAgdmFyIGR0ID0gZmRbZHN5bV07XG4gICAgICAgICAgICAgICAgaWYgKGRzeW0gPiAzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBiID0gZmRlYltkc3ltXTtcbiAgICAgICAgICAgICAgICAgICAgZHQgKz0gYml0czE2KGRhdCwgcG9zKSAmICgxIDw8IGIpIC0gMSwgcG9zICs9IGI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwb3MgPiB0YnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub1N0KVxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyKDApO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlc2l6ZSlcbiAgICAgICAgICAgICAgICAgICAgY2J1ZihidCArIDEzMTA3Mik7XG4gICAgICAgICAgICAgICAgdmFyIGVuZCA9IGJ0ICsgYWRkO1xuICAgICAgICAgICAgICAgIGlmIChidCA8IGR0KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzaGlmdCA9IGRsIC0gZHQsIGRlbmQgPSBNYXRoLm1pbihkdCwgZW5kKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNoaWZ0ICsgYnQgPCAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyKDMpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKDsgYnQgPCBkZW5kOyArK2J0KVxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmW2J0XSA9IGRpY3Rbc2hpZnQgKyBidF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAoOyBidCA8IGVuZDsgKytidClcbiAgICAgICAgICAgICAgICAgICAgYnVmW2J0XSA9IGJ1ZltidCAtIGR0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdC5sID0gbG0sIHN0LnAgPSBscG9zLCBzdC5iID0gYnQsIHN0LmYgPSBmaW5hbDtcbiAgICAgICAgaWYgKGxtKVxuICAgICAgICAgICAgZmluYWwgPSAxLCBzdC5tID0gbGJ0LCBzdC5kID0gZG0sIHN0Lm4gPSBkYnQ7XG4gICAgfSB3aGlsZSAoIWZpbmFsKTtcbiAgICAvLyBkb24ndCByZWFsbG9jYXRlIGZvciBzdHJlYW1zIG9yIHVzZXIgYnVmZmVyc1xuICAgIHJldHVybiBidCAhPSBidWYubGVuZ3RoICYmIG5vQnVmID8gc2xjKGJ1ZiwgMCwgYnQpIDogYnVmLnN1YmFycmF5KDAsIGJ0KTtcbn07XG4vLyBzdGFydGluZyBhdCBwLCB3cml0ZSB0aGUgbWluaW11bSBudW1iZXIgb2YgYml0cyB0aGF0IGNhbiBob2xkIHYgdG8gZFxudmFyIHdiaXRzID0gZnVuY3Rpb24gKGQsIHAsIHYpIHtcbiAgICB2IDw8PSBwICYgNztcbiAgICB2YXIgbyA9IChwIC8gOCkgfCAwO1xuICAgIGRbb10gfD0gdjtcbiAgICBkW28gKyAxXSB8PSB2ID4+IDg7XG59O1xuLy8gc3RhcnRpbmcgYXQgcCwgd3JpdGUgdGhlIG1pbmltdW0gbnVtYmVyIG9mIGJpdHMgKD44KSB0aGF0IGNhbiBob2xkIHYgdG8gZFxudmFyIHdiaXRzMTYgPSBmdW5jdGlvbiAoZCwgcCwgdikge1xuICAgIHYgPDw9IHAgJiA3O1xuICAgIHZhciBvID0gKHAgLyA4KSB8IDA7XG4gICAgZFtvXSB8PSB2O1xuICAgIGRbbyArIDFdIHw9IHYgPj4gODtcbiAgICBkW28gKyAyXSB8PSB2ID4+IDE2O1xufTtcbi8vIGNyZWF0ZXMgY29kZSBsZW5ndGhzIGZyb20gYSBmcmVxdWVuY3kgdGFibGVcbnZhciBoVHJlZSA9IGZ1bmN0aW9uIChkLCBtYikge1xuICAgIC8vIE5lZWQgZXh0cmEgaW5mbyB0byBtYWtlIGEgdHJlZVxuICAgIHZhciB0ID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmIChkW2ldKVxuICAgICAgICAgICAgdC5wdXNoKHsgczogaSwgZjogZFtpXSB9KTtcbiAgICB9XG4gICAgdmFyIHMgPSB0Lmxlbmd0aDtcbiAgICB2YXIgdDIgPSB0LnNsaWNlKCk7XG4gICAgaWYgKCFzKVxuICAgICAgICByZXR1cm4geyB0OiBldCwgbDogMCB9O1xuICAgIGlmIChzID09IDEpIHtcbiAgICAgICAgdmFyIHYgPSBuZXcgdTgodFswXS5zICsgMSk7XG4gICAgICAgIHZbdFswXS5zXSA9IDE7XG4gICAgICAgIHJldHVybiB7IHQ6IHYsIGw6IDEgfTtcbiAgICB9XG4gICAgdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7IHJldHVybiBhLmYgLSBiLmY7IH0pO1xuICAgIC8vIGFmdGVyIGkyIHJlYWNoZXMgbGFzdCBpbmQsIHdpbGwgYmUgc3RvcHBlZFxuICAgIC8vIGZyZXEgbXVzdCBiZSBncmVhdGVyIHRoYW4gbGFyZ2VzdCBwb3NzaWJsZSBudW1iZXIgb2Ygc3ltYm9sc1xuICAgIHQucHVzaCh7IHM6IC0xLCBmOiAyNTAwMSB9KTtcbiAgICB2YXIgbCA9IHRbMF0sIHIgPSB0WzFdLCBpMCA9IDAsIGkxID0gMSwgaTIgPSAyO1xuICAgIHRbMF0gPSB7IHM6IC0xLCBmOiBsLmYgKyByLmYsIGw6IGwsIHI6IHIgfTtcbiAgICAvLyBlZmZpY2llbnQgYWxnb3JpdGhtIGZyb20gVVpJUC5qc1xuICAgIC8vIGkwIGlzIGxvb2tiZWhpbmQsIGkyIGlzIGxvb2thaGVhZCAtIGFmdGVyIHByb2Nlc3NpbmcgdHdvIGxvdy1mcmVxXG4gICAgLy8gc3ltYm9scyB0aGF0IGNvbWJpbmVkIGhhdmUgaGlnaCBmcmVxLCB3aWxsIHN0YXJ0IHByb2Nlc3NpbmcgaTIgKGhpZ2gtZnJlcSxcbiAgICAvLyBub24tY29tcG9zaXRlKSBzeW1ib2xzIGluc3RlYWRcbiAgICAvLyBzZWUgaHR0cHM6Ly9yZWRkaXQuY29tL3IvcGhvdG9wZWEvY29tbWVudHMvaWtla2h0L3V6aXBqc19xdWVzdGlvbnMvXG4gICAgd2hpbGUgKGkxICE9IHMgLSAxKSB7XG4gICAgICAgIGwgPSB0W3RbaTBdLmYgPCB0W2kyXS5mID8gaTArKyA6IGkyKytdO1xuICAgICAgICByID0gdFtpMCAhPSBpMSAmJiB0W2kwXS5mIDwgdFtpMl0uZiA/IGkwKysgOiBpMisrXTtcbiAgICAgICAgdFtpMSsrXSA9IHsgczogLTEsIGY6IGwuZiArIHIuZiwgbDogbCwgcjogciB9O1xuICAgIH1cbiAgICB2YXIgbWF4U3ltID0gdDJbMF0ucztcbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IHM7ICsraSkge1xuICAgICAgICBpZiAodDJbaV0ucyA+IG1heFN5bSlcbiAgICAgICAgICAgIG1heFN5bSA9IHQyW2ldLnM7XG4gICAgfVxuICAgIC8vIGNvZGUgbGVuZ3Roc1xuICAgIHZhciB0ciA9IG5ldyB1MTYobWF4U3ltICsgMSk7XG4gICAgLy8gbWF4IGJpdHMgaW4gdHJlZVxuICAgIHZhciBtYnQgPSBsbih0W2kxIC0gMV0sIHRyLCAwKTtcbiAgICBpZiAobWJ0ID4gbWIpIHtcbiAgICAgICAgLy8gbW9yZSBhbGdvcml0aG1zIGZyb20gVVpJUC5qc1xuICAgICAgICAvLyBUT0RPOiBmaW5kIG91dCBob3cgdGhpcyBjb2RlIHdvcmtzIChkZWJ0KVxuICAgICAgICAvLyAgaW5kICAgIGRlYnRcbiAgICAgICAgdmFyIGkgPSAwLCBkdCA9IDA7XG4gICAgICAgIC8vICAgIGxlZnQgICAgICAgICAgICBjb3N0XG4gICAgICAgIHZhciBsZnQgPSBtYnQgLSBtYiwgY3N0ID0gMSA8PCBsZnQ7XG4gICAgICAgIHQyLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHsgcmV0dXJuIHRyW2Iuc10gLSB0clthLnNdIHx8IGEuZiAtIGIuZjsgfSk7XG4gICAgICAgIGZvciAoOyBpIDwgczsgKytpKSB7XG4gICAgICAgICAgICB2YXIgaTJfMSA9IHQyW2ldLnM7XG4gICAgICAgICAgICBpZiAodHJbaTJfMV0gPiBtYikge1xuICAgICAgICAgICAgICAgIGR0ICs9IGNzdCAtICgxIDw8IChtYnQgLSB0cltpMl8xXSkpO1xuICAgICAgICAgICAgICAgIHRyW2kyXzFdID0gbWI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgZHQgPj49IGxmdDtcbiAgICAgICAgd2hpbGUgKGR0ID4gMCkge1xuICAgICAgICAgICAgdmFyIGkyXzIgPSB0MltpXS5zO1xuICAgICAgICAgICAgaWYgKHRyW2kyXzJdIDwgbWIpXG4gICAgICAgICAgICAgICAgZHQgLT0gMSA8PCAobWIgLSB0cltpMl8yXSsrIC0gMSk7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgKytpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoOyBpID49IDAgJiYgZHQ7IC0taSkge1xuICAgICAgICAgICAgdmFyIGkyXzMgPSB0MltpXS5zO1xuICAgICAgICAgICAgaWYgKHRyW2kyXzNdID09IG1iKSB7XG4gICAgICAgICAgICAgICAgLS10cltpMl8zXTtcbiAgICAgICAgICAgICAgICArK2R0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG1idCA9IG1iO1xuICAgIH1cbiAgICByZXR1cm4geyB0OiBuZXcgdTgodHIpLCBsOiBtYnQgfTtcbn07XG4vLyBnZXQgdGhlIG1heCBsZW5ndGggYW5kIGFzc2lnbiBsZW5ndGggY29kZXNcbnZhciBsbiA9IGZ1bmN0aW9uIChuLCBsLCBkKSB7XG4gICAgcmV0dXJuIG4ucyA9PSAtMVxuICAgICAgICA/IE1hdGgubWF4KGxuKG4ubCwgbCwgZCArIDEpLCBsbihuLnIsIGwsIGQgKyAxKSlcbiAgICAgICAgOiAobFtuLnNdID0gZCk7XG59O1xuLy8gbGVuZ3RoIGNvZGVzIGdlbmVyYXRpb25cbnZhciBsYyA9IGZ1bmN0aW9uIChjKSB7XG4gICAgdmFyIHMgPSBjLmxlbmd0aDtcbiAgICAvLyBOb3RlIHRoYXQgdGhlIHNlbWljb2xvbiB3YXMgaW50ZW50aW9uYWxcbiAgICB3aGlsZSAocyAmJiAhY1stLXNdKVxuICAgICAgICA7XG4gICAgdmFyIGNsID0gbmV3IHUxNigrK3MpO1xuICAgIC8vICBpbmQgICAgICBudW0gICAgICAgICBzdHJlYWtcbiAgICB2YXIgY2xpID0gMCwgY2xuID0gY1swXSwgY2xzID0gMTtcbiAgICB2YXIgdyA9IGZ1bmN0aW9uICh2KSB7IGNsW2NsaSsrXSA9IHY7IH07XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPD0gczsgKytpKSB7XG4gICAgICAgIGlmIChjW2ldID09IGNsbiAmJiBpICE9IHMpXG4gICAgICAgICAgICArK2NscztcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoIWNsbiAmJiBjbHMgPiAyKSB7XG4gICAgICAgICAgICAgICAgZm9yICg7IGNscyA+IDEzODsgY2xzIC09IDEzOClcbiAgICAgICAgICAgICAgICAgICAgdygzMjc1NCk7XG4gICAgICAgICAgICAgICAgaWYgKGNscyA+IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdyhjbHMgPiAxMCA/ICgoY2xzIC0gMTEpIDw8IDUpIHwgMjg2OTAgOiAoKGNscyAtIDMpIDw8IDUpIHwgMTIzMDUpO1xuICAgICAgICAgICAgICAgICAgICBjbHMgPSAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNscyA+IDMpIHtcbiAgICAgICAgICAgICAgICB3KGNsbiksIC0tY2xzO1xuICAgICAgICAgICAgICAgIGZvciAoOyBjbHMgPiA2OyBjbHMgLT0gNilcbiAgICAgICAgICAgICAgICAgICAgdyg4MzA0KTtcbiAgICAgICAgICAgICAgICBpZiAoY2xzID4gMilcbiAgICAgICAgICAgICAgICAgICAgdygoKGNscyAtIDMpIDw8IDUpIHwgODIwOCksIGNscyA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoY2xzLS0pXG4gICAgICAgICAgICAgICAgdyhjbG4pO1xuICAgICAgICAgICAgY2xzID0gMTtcbiAgICAgICAgICAgIGNsbiA9IGNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgYzogY2wuc3ViYXJyYXkoMCwgY2xpKSwgbjogcyB9O1xufTtcbi8vIGNhbGN1bGF0ZSB0aGUgbGVuZ3RoIG9mIG91dHB1dCBmcm9tIHRyZWUsIGNvZGUgbGVuZ3Roc1xudmFyIGNsZW4gPSBmdW5jdGlvbiAoY2YsIGNsKSB7XG4gICAgdmFyIGwgPSAwO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2wubGVuZ3RoOyArK2kpXG4gICAgICAgIGwgKz0gY2ZbaV0gKiBjbFtpXTtcbiAgICByZXR1cm4gbDtcbn07XG4vLyB3cml0ZXMgYSBmaXhlZCBibG9ja1xuLy8gcmV0dXJucyB0aGUgbmV3IGJpdCBwb3NcbnZhciB3ZmJsayA9IGZ1bmN0aW9uIChvdXQsIHBvcywgZGF0KSB7XG4gICAgLy8gbm8gbmVlZCB0byB3cml0ZSAwMCBhcyB0eXBlOiBUeXBlZEFycmF5IGRlZmF1bHRzIHRvIDBcbiAgICB2YXIgcyA9IGRhdC5sZW5ndGg7XG4gICAgdmFyIG8gPSBzaGZ0KHBvcyArIDIpO1xuICAgIG91dFtvXSA9IHMgJiAyNTU7XG4gICAgb3V0W28gKyAxXSA9IHMgPj4gODtcbiAgICBvdXRbbyArIDJdID0gb3V0W29dIF4gMjU1O1xuICAgIG91dFtvICsgM10gPSBvdXRbbyArIDFdIF4gMjU1O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgczsgKytpKVxuICAgICAgICBvdXRbbyArIGkgKyA0XSA9IGRhdFtpXTtcbiAgICByZXR1cm4gKG8gKyA0ICsgcykgKiA4O1xufTtcbi8vIHdyaXRlcyBhIGJsb2NrXG52YXIgd2JsayA9IGZ1bmN0aW9uIChkYXQsIG91dCwgZmluYWwsIHN5bXMsIGxmLCBkZiwgZWIsIGxpLCBicywgYmwsIHApIHtcbiAgICB3Yml0cyhvdXQsIHArKywgZmluYWwpO1xuICAgICsrbGZbMjU2XTtcbiAgICB2YXIgX2EgPSBoVHJlZShsZiwgMTUpLCBkbHQgPSBfYS50LCBtbGIgPSBfYS5sO1xuICAgIHZhciBfYiA9IGhUcmVlKGRmLCAxNSksIGRkdCA9IF9iLnQsIG1kYiA9IF9iLmw7XG4gICAgdmFyIF9jID0gbGMoZGx0KSwgbGNsdCA9IF9jLmMsIG5sYyA9IF9jLm47XG4gICAgdmFyIF9kID0gbGMoZGR0KSwgbGNkdCA9IF9kLmMsIG5kYyA9IF9kLm47XG4gICAgdmFyIGxjZnJlcSA9IG5ldyB1MTYoMTkpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGNsdC5sZW5ndGg7ICsraSlcbiAgICAgICAgKytsY2ZyZXFbbGNsdFtpXSAmIDMxXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxjZHQubGVuZ3RoOyArK2kpXG4gICAgICAgICsrbGNmcmVxW2xjZHRbaV0gJiAzMV07XG4gICAgdmFyIF9lID0gaFRyZWUobGNmcmVxLCA3KSwgbGN0ID0gX2UudCwgbWxjYiA9IF9lLmw7XG4gICAgdmFyIG5sY2MgPSAxOTtcbiAgICBmb3IgKDsgbmxjYyA+IDQgJiYgIWxjdFtjbGltW25sY2MgLSAxXV07IC0tbmxjYylcbiAgICAgICAgO1xuICAgIHZhciBmbGVuID0gKGJsICsgNSkgPDwgMztcbiAgICB2YXIgZnRsZW4gPSBjbGVuKGxmLCBmbHQpICsgY2xlbihkZiwgZmR0KSArIGViO1xuICAgIHZhciBkdGxlbiA9IGNsZW4obGYsIGRsdCkgKyBjbGVuKGRmLCBkZHQpICsgZWIgKyAxNCArIDMgKiBubGNjICsgY2xlbihsY2ZyZXEsIGxjdCkgKyAyICogbGNmcmVxWzE2XSArIDMgKiBsY2ZyZXFbMTddICsgNyAqIGxjZnJlcVsxOF07XG4gICAgaWYgKGJzID49IDAgJiYgZmxlbiA8PSBmdGxlbiAmJiBmbGVuIDw9IGR0bGVuKVxuICAgICAgICByZXR1cm4gd2ZibGsob3V0LCBwLCBkYXQuc3ViYXJyYXkoYnMsIGJzICsgYmwpKTtcbiAgICB2YXIgbG0sIGxsLCBkbSwgZGw7XG4gICAgd2JpdHMob3V0LCBwLCAxICsgKGR0bGVuIDwgZnRsZW4pKSwgcCArPSAyO1xuICAgIGlmIChkdGxlbiA8IGZ0bGVuKSB7XG4gICAgICAgIGxtID0gaE1hcChkbHQsIG1sYiwgMCksIGxsID0gZGx0LCBkbSA9IGhNYXAoZGR0LCBtZGIsIDApLCBkbCA9IGRkdDtcbiAgICAgICAgdmFyIGxsbSA9IGhNYXAobGN0LCBtbGNiLCAwKTtcbiAgICAgICAgd2JpdHMob3V0LCBwLCBubGMgLSAyNTcpO1xuICAgICAgICB3Yml0cyhvdXQsIHAgKyA1LCBuZGMgLSAxKTtcbiAgICAgICAgd2JpdHMob3V0LCBwICsgMTAsIG5sY2MgLSA0KTtcbiAgICAgICAgcCArPSAxNDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBubGNjOyArK2kpXG4gICAgICAgICAgICB3Yml0cyhvdXQsIHAgKyAzICogaSwgbGN0W2NsaW1baV1dKTtcbiAgICAgICAgcCArPSAzICogbmxjYztcbiAgICAgICAgdmFyIGxjdHMgPSBbbGNsdCwgbGNkdF07XG4gICAgICAgIGZvciAodmFyIGl0ID0gMDsgaXQgPCAyOyArK2l0KSB7XG4gICAgICAgICAgICB2YXIgY2xjdCA9IGxjdHNbaXRdO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjbGN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxlbiA9IGNsY3RbaV0gJiAzMTtcbiAgICAgICAgICAgICAgICB3Yml0cyhvdXQsIHAsIGxsbVtsZW5dKSwgcCArPSBsY3RbbGVuXTtcbiAgICAgICAgICAgICAgICBpZiAobGVuID4gMTUpXG4gICAgICAgICAgICAgICAgICAgIHdiaXRzKG91dCwgcCwgKGNsY3RbaV0gPj4gNSkgJiAxMjcpLCBwICs9IGNsY3RbaV0gPj4gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGxtID0gZmxtLCBsbCA9IGZsdCwgZG0gPSBmZG0sIGRsID0gZmR0O1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpOyArK2kpIHtcbiAgICAgICAgdmFyIHN5bSA9IHN5bXNbaV07XG4gICAgICAgIGlmIChzeW0gPiAyNTUpIHtcbiAgICAgICAgICAgIHZhciBsZW4gPSAoc3ltID4+IDE4KSAmIDMxO1xuICAgICAgICAgICAgd2JpdHMxNihvdXQsIHAsIGxtW2xlbiArIDI1N10pLCBwICs9IGxsW2xlbiArIDI1N107XG4gICAgICAgICAgICBpZiAobGVuID4gNylcbiAgICAgICAgICAgICAgICB3Yml0cyhvdXQsIHAsIChzeW0gPj4gMjMpICYgMzEpLCBwICs9IGZsZWJbbGVuXTtcbiAgICAgICAgICAgIHZhciBkc3QgPSBzeW0gJiAzMTtcbiAgICAgICAgICAgIHdiaXRzMTYob3V0LCBwLCBkbVtkc3RdKSwgcCArPSBkbFtkc3RdO1xuICAgICAgICAgICAgaWYgKGRzdCA+IDMpXG4gICAgICAgICAgICAgICAgd2JpdHMxNihvdXQsIHAsIChzeW0gPj4gNSkgJiA4MTkxKSwgcCArPSBmZGViW2RzdF07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB3Yml0czE2KG91dCwgcCwgbG1bc3ltXSksIHAgKz0gbGxbc3ltXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB3Yml0czE2KG91dCwgcCwgbG1bMjU2XSk7XG4gICAgcmV0dXJuIHAgKyBsbFsyNTZdO1xufTtcbi8vIGRlZmxhdGUgb3B0aW9ucyAobmljZSA8PCAxMykgfCBjaGFpblxudmFyIGRlbyA9IC8qI19fUFVSRV9fKi8gbmV3IGkzMihbNjU1NDAsIDEzMTA4MCwgMTMxMDg4LCAxMzExMDQsIDI2MjE3NiwgMTA0ODcwNCwgMTA0ODgzMiwgMjExNDU2MCwgMjExNzYzMl0pO1xuLy8gZW1wdHlcbnZhciBldCA9IC8qI19fUFVSRV9fKi8gbmV3IHU4KDApO1xuLy8gY29tcHJlc3NlcyBkYXRhIGludG8gYSByYXcgREVGTEFURSBidWZmZXJcbnZhciBkZmx0ID0gZnVuY3Rpb24gKGRhdCwgbHZsLCBwbHZsLCBwcmUsIHBvc3QsIHN0KSB7XG4gICAgdmFyIHMgPSBzdC56IHx8IGRhdC5sZW5ndGg7XG4gICAgdmFyIG8gPSBuZXcgdTgocHJlICsgcyArIDUgKiAoMSArIE1hdGguY2VpbChzIC8gNzAwMCkpICsgcG9zdCk7XG4gICAgLy8gd3JpdGluZyB0byB0aGlzIHdyaXRlcyB0byB0aGUgb3V0cHV0IGJ1ZmZlclxuICAgIHZhciB3ID0gby5zdWJhcnJheShwcmUsIG8ubGVuZ3RoIC0gcG9zdCk7XG4gICAgdmFyIGxzdCA9IHN0Lmw7XG4gICAgdmFyIHBvcyA9IChzdC5yIHx8IDApICYgNztcbiAgICBpZiAobHZsKSB7XG4gICAgICAgIGlmIChwb3MpXG4gICAgICAgICAgICB3WzBdID0gc3QuciA+PiAzO1xuICAgICAgICB2YXIgb3B0ID0gZGVvW2x2bCAtIDFdO1xuICAgICAgICB2YXIgbiA9IG9wdCA+PiAxMywgYyA9IG9wdCAmIDgxOTE7XG4gICAgICAgIHZhciBtc2tfMSA9ICgxIDw8IHBsdmwpIC0gMTtcbiAgICAgICAgLy8gICAgcHJldiAyLWJ5dGUgdmFsIG1hcCAgICBjdXJyIDItYnl0ZSB2YWwgbWFwXG4gICAgICAgIHZhciBwcmV2ID0gc3QucCB8fCBuZXcgdTE2KDMyNzY4KSwgaGVhZCA9IHN0LmggfHwgbmV3IHUxNihtc2tfMSArIDEpO1xuICAgICAgICB2YXIgYnMxXzEgPSBNYXRoLmNlaWwocGx2bCAvIDMpLCBiczJfMSA9IDIgKiBiczFfMTtcbiAgICAgICAgdmFyIGhzaCA9IGZ1bmN0aW9uIChpKSB7IHJldHVybiAoZGF0W2ldIF4gKGRhdFtpICsgMV0gPDwgYnMxXzEpIF4gKGRhdFtpICsgMl0gPDwgYnMyXzEpKSAmIG1za18xOyB9O1xuICAgICAgICAvLyAyNDU3NiBpcyBhbiBhcmJpdHJhcnkgbnVtYmVyIG9mIG1heGltdW0gc3ltYm9scyBwZXIgYmxvY2tcbiAgICAgICAgLy8gNDI0IGJ1ZmZlciBmb3IgbGFzdCBibG9ja1xuICAgICAgICB2YXIgc3ltcyA9IG5ldyBpMzIoMjUwMDApO1xuICAgICAgICAvLyBsZW5ndGgvbGl0ZXJhbCBmcmVxICAgZGlzdGFuY2UgZnJlcVxuICAgICAgICB2YXIgbGYgPSBuZXcgdTE2KDI4OCksIGRmID0gbmV3IHUxNigzMik7XG4gICAgICAgIC8vICBsL2xjbnQgIGV4Yml0cyAgaW5kZXggICAgICAgICAgbC9saW5kICB3YWl0ZHggICAgICAgICAgYmxrcG9zXG4gICAgICAgIHZhciBsY18xID0gMCwgZWIgPSAwLCBpID0gc3QuaSB8fCAwLCBsaSA9IDAsIHdpID0gc3QudyB8fCAwLCBicyA9IDA7XG4gICAgICAgIGZvciAoOyBpICsgMiA8IHM7ICsraSkge1xuICAgICAgICAgICAgLy8gaGFzaCB2YWx1ZVxuICAgICAgICAgICAgdmFyIGh2ID0gaHNoKGkpO1xuICAgICAgICAgICAgLy8gaW5kZXggbW9kIDMyNzY4ICAgIHByZXZpb3VzIGluZGV4IG1vZFxuICAgICAgICAgICAgdmFyIGltb2QgPSBpICYgMzI3NjcsIHBpbW9kID0gaGVhZFtodl07XG4gICAgICAgICAgICBwcmV2W2ltb2RdID0gcGltb2Q7XG4gICAgICAgICAgICBoZWFkW2h2XSA9IGltb2Q7XG4gICAgICAgICAgICAvLyBXZSBhbHdheXMgc2hvdWxkIG1vZGlmeSBoZWFkIGFuZCBwcmV2LCBidXQgb25seSBhZGQgc3ltYm9scyBpZlxuICAgICAgICAgICAgLy8gdGhpcyBkYXRhIGlzIG5vdCB5ZXQgcHJvY2Vzc2VkIChcIndhaXRcIiBmb3Igd2FpdCBpbmRleClcbiAgICAgICAgICAgIGlmICh3aSA8PSBpKSB7XG4gICAgICAgICAgICAgICAgLy8gYnl0ZXMgcmVtYWluaW5nXG4gICAgICAgICAgICAgICAgdmFyIHJlbSA9IHMgLSBpO1xuICAgICAgICAgICAgICAgIGlmICgobGNfMSA+IDcwMDAgfHwgbGkgPiAyNDU3NikgJiYgKHJlbSA+IDQyMyB8fCAhbHN0KSkge1xuICAgICAgICAgICAgICAgICAgICBwb3MgPSB3YmxrKGRhdCwgdywgMCwgc3ltcywgbGYsIGRmLCBlYiwgbGksIGJzLCBpIC0gYnMsIHBvcyk7XG4gICAgICAgICAgICAgICAgICAgIGxpID0gbGNfMSA9IGViID0gMCwgYnMgPSBpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IDI4NjsgKytqKVxuICAgICAgICAgICAgICAgICAgICAgICAgbGZbal0gPSAwO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IDMwOyArK2opXG4gICAgICAgICAgICAgICAgICAgICAgICBkZltqXSA9IDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICBsZW4gICAgZGlzdCAgIGNoYWluXG4gICAgICAgICAgICAgICAgdmFyIGwgPSAyLCBkID0gMCwgY2hfMSA9IGMsIGRpZiA9IGltb2QgLSBwaW1vZCAmIDMyNzY3O1xuICAgICAgICAgICAgICAgIGlmIChyZW0gPiAyICYmIGh2ID09IGhzaChpIC0gZGlmKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWF4biA9IE1hdGgubWluKG4sIHJlbSkgLSAxO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWF4ZCA9IE1hdGgubWluKDMyNzY3LCBpKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gbWF4IHBvc3NpYmxlIGxlbmd0aFxuICAgICAgICAgICAgICAgICAgICAvLyBub3QgY2FwcGVkIGF0IGRpZiBiZWNhdXNlIGRlY29tcHJlc3NvcnMgaW1wbGVtZW50IFwicm9sbGluZ1wiIGluZGV4IHBvcHVsYXRpb25cbiAgICAgICAgICAgICAgICAgICAgdmFyIG1sID0gTWF0aC5taW4oMjU4LCByZW0pO1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoZGlmIDw9IG1heGQgJiYgLS1jaF8xICYmIGltb2QgIT0gcGltb2QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRbaSArIGxdID09IGRhdFtpICsgbCAtIGRpZl0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmwgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoOyBubCA8IG1sICYmIGRhdFtpICsgbmxdID09IGRhdFtpICsgbmwgLSBkaWZdOyArK25sKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5sID4gbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsID0gbmwsIGQgPSBkaWY7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJyZWFrIG91dCBlYXJseSB3aGVuIHdlIHJlYWNoIFwibmljZVwiICh3ZSBhcmUgc2F0aXNmaWVkIGVub3VnaClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5sID4gbWF4bilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBub3csIGZpbmQgdGhlIHJhcmVzdCAyLWJ5dGUgc2VxdWVuY2Ugd2l0aGluIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGVuZ3RoIG9mIGxpdGVyYWxzIGFuZCBzZWFyY2ggZm9yIHRoYXQgaW5zdGVhZC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTXVjaCBmYXN0ZXIgdGhhbiBqdXN0IHVzaW5nIHRoZSBzdGFydFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW1kID0gTWF0aC5taW4oZGlmLCBubCAtIDIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1tZDsgKytqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdGkgPSBpIC0gZGlmICsgaiAmIDMyNzY3O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHB0aSA9IHByZXZbdGldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNkID0gdGkgLSBwdGkgJiAzMjc2NztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjZCA+IG1kKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1kID0gY2QsIHBpbW9kID0gdGk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjaGVjayB0aGUgcHJldmlvdXMgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGltb2QgPSBwaW1vZCwgcGltb2QgPSBwcmV2W2ltb2RdO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGlmICs9IGltb2QgLSBwaW1vZCAmIDMyNzY3O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGQgd2lsbCBiZSBub256ZXJvIG9ubHkgd2hlbiBhIG1hdGNoIHdhcyBmb3VuZFxuICAgICAgICAgICAgICAgIGlmIChkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHN0b3JlIGJvdGggZGlzdCBhbmQgbGVuIGRhdGEgaW4gb25lIGludDMyXG4gICAgICAgICAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGlzIGlzIHJlY29nbml6ZWQgYXMgYSBsZW4vZGlzdCB3aXRoIDI4dGggYml0ICgyXjI4KVxuICAgICAgICAgICAgICAgICAgICBzeW1zW2xpKytdID0gMjY4NDM1NDU2IHwgKHJldmZsW2xdIDw8IDE4KSB8IHJldmZkW2RdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbGluID0gcmV2ZmxbbF0gJiAzMSwgZGluID0gcmV2ZmRbZF0gJiAzMTtcbiAgICAgICAgICAgICAgICAgICAgZWIgKz0gZmxlYltsaW5dICsgZmRlYltkaW5dO1xuICAgICAgICAgICAgICAgICAgICArK2xmWzI1NyArIGxpbl07XG4gICAgICAgICAgICAgICAgICAgICsrZGZbZGluXTtcbiAgICAgICAgICAgICAgICAgICAgd2kgPSBpICsgbDtcbiAgICAgICAgICAgICAgICAgICAgKytsY18xO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3ltc1tsaSsrXSA9IGRhdFtpXTtcbiAgICAgICAgICAgICAgICAgICAgKytsZltkYXRbaV1dO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSBNYXRoLm1heChpLCB3aSk7IGkgPCBzOyArK2kpIHtcbiAgICAgICAgICAgIHN5bXNbbGkrK10gPSBkYXRbaV07XG4gICAgICAgICAgICArK2xmW2RhdFtpXV07XG4gICAgICAgIH1cbiAgICAgICAgcG9zID0gd2JsayhkYXQsIHcsIGxzdCwgc3ltcywgbGYsIGRmLCBlYiwgbGksIGJzLCBpIC0gYnMsIHBvcyk7XG4gICAgICAgIGlmICghbHN0KSB7XG4gICAgICAgICAgICBzdC5yID0gKHBvcyAmIDcpIHwgd1socG9zIC8gOCkgfCAwXSA8PCAzO1xuICAgICAgICAgICAgLy8gc2hmdChwb3MpIG5vdyAxIGxlc3MgaWYgcG9zICYgNyAhPSAwXG4gICAgICAgICAgICBwb3MgLT0gNztcbiAgICAgICAgICAgIHN0LmggPSBoZWFkLCBzdC5wID0gcHJldiwgc3QuaSA9IGksIHN0LncgPSB3aTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IHN0LncgfHwgMDsgaSA8IHMgKyBsc3Q7IGkgKz0gNjU1MzUpIHtcbiAgICAgICAgICAgIC8vIGVuZFxuICAgICAgICAgICAgdmFyIGUgPSBpICsgNjU1MzU7XG4gICAgICAgICAgICBpZiAoZSA+PSBzKSB7XG4gICAgICAgICAgICAgICAgLy8gd3JpdGUgZmluYWwgYmxvY2tcbiAgICAgICAgICAgICAgICB3Wyhwb3MgLyA4KSB8IDBdID0gbHN0O1xuICAgICAgICAgICAgICAgIGUgPSBzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcG9zID0gd2ZibGsodywgcG9zICsgMSwgZGF0LnN1YmFycmF5KGksIGUpKTtcbiAgICAgICAgfVxuICAgICAgICBzdC5pID0gcztcbiAgICB9XG4gICAgcmV0dXJuIHNsYyhvLCAwLCBwcmUgKyBzaGZ0KHBvcykgKyBwb3N0KTtcbn07XG4vLyBDUkMzMiB0YWJsZVxudmFyIGNyY3QgPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHQgPSBuZXcgSW50MzJBcnJheSgyNTYpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMjU2OyArK2kpIHtcbiAgICAgICAgdmFyIGMgPSBpLCBrID0gOTtcbiAgICAgICAgd2hpbGUgKC0taylcbiAgICAgICAgICAgIGMgPSAoKGMgJiAxKSAmJiAtMzA2Njc0OTEyKSBeIChjID4+PiAxKTtcbiAgICAgICAgdFtpXSA9IGM7XG4gICAgfVxuICAgIHJldHVybiB0O1xufSkoKTtcbi8vIENSQzMyXG52YXIgY3JjID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBjID0gLTE7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcDogZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgIC8vIGNsb3N1cmVzIGhhdmUgYXdmdWwgcGVyZm9ybWFuY2VcbiAgICAgICAgICAgIHZhciBjciA9IGM7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGQubGVuZ3RoOyArK2kpXG4gICAgICAgICAgICAgICAgY3IgPSBjcmN0WyhjciAmIDI1NSkgXiBkW2ldXSBeIChjciA+Pj4gOCk7XG4gICAgICAgICAgICBjID0gY3I7XG4gICAgICAgIH0sXG4gICAgICAgIGQ6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIH5jOyB9XG4gICAgfTtcbn07XG4vLyBBZGxlcjMyXG52YXIgYWRsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGEgPSAxLCBiID0gMDtcbiAgICByZXR1cm4ge1xuICAgICAgICBwOiBmdW5jdGlvbiAoZCkge1xuICAgICAgICAgICAgLy8gY2xvc3VyZXMgaGF2ZSBhd2Z1bCBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgdmFyIG4gPSBhLCBtID0gYjtcbiAgICAgICAgICAgIHZhciBsID0gZC5sZW5ndGggfCAwO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgIT0gbDspIHtcbiAgICAgICAgICAgICAgICB2YXIgZSA9IE1hdGgubWluKGkgKyAyNjU1LCBsKTtcbiAgICAgICAgICAgICAgICBmb3IgKDsgaSA8IGU7ICsraSlcbiAgICAgICAgICAgICAgICAgICAgbSArPSBuICs9IGRbaV07XG4gICAgICAgICAgICAgICAgbiA9IChuICYgNjU1MzUpICsgMTUgKiAobiA+PiAxNiksIG0gPSAobSAmIDY1NTM1KSArIDE1ICogKG0gPj4gMTYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYSA9IG4sIGIgPSBtO1xuICAgICAgICB9LFxuICAgICAgICBkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBhICU9IDY1NTIxLCBiICU9IDY1NTIxO1xuICAgICAgICAgICAgcmV0dXJuIChhICYgMjU1KSA8PCAyNCB8IChhICYgMHhGRjAwKSA8PCA4IHwgKGIgJiAyNTUpIDw8IDggfCAoYiA+PiA4KTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuO1xuLy8gZGVmbGF0ZSB3aXRoIG9wdHNcbnZhciBkb3B0ID0gZnVuY3Rpb24gKGRhdCwgb3B0LCBwcmUsIHBvc3QsIHN0KSB7XG4gICAgaWYgKCFzdCkge1xuICAgICAgICBzdCA9IHsgbDogMSB9O1xuICAgICAgICBpZiAob3B0LmRpY3Rpb25hcnkpIHtcbiAgICAgICAgICAgIHZhciBkaWN0ID0gb3B0LmRpY3Rpb25hcnkuc3ViYXJyYXkoLTMyNzY4KTtcbiAgICAgICAgICAgIHZhciBuZXdEYXQgPSBuZXcgdTgoZGljdC5sZW5ndGggKyBkYXQubGVuZ3RoKTtcbiAgICAgICAgICAgIG5ld0RhdC5zZXQoZGljdCk7XG4gICAgICAgICAgICBuZXdEYXQuc2V0KGRhdCwgZGljdC5sZW5ndGgpO1xuICAgICAgICAgICAgZGF0ID0gbmV3RGF0O1xuICAgICAgICAgICAgc3QudyA9IGRpY3QubGVuZ3RoO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkZmx0KGRhdCwgb3B0LmxldmVsID09IG51bGwgPyA2IDogb3B0LmxldmVsLCBvcHQubWVtID09IG51bGwgPyAoc3QubCA/IE1hdGguY2VpbChNYXRoLm1heCg4LCBNYXRoLm1pbigxMywgTWF0aC5sb2coZGF0Lmxlbmd0aCkpKSAqIDEuNSkgOiAyMCkgOiAoMTIgKyBvcHQubWVtKSwgcHJlLCBwb3N0LCBzdCk7XG59O1xuLy8gV2FsbWFydCBvYmplY3Qgc3ByZWFkXG52YXIgbXJnID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgICB2YXIgbyA9IHt9O1xuICAgIGZvciAodmFyIGsgaW4gYSlcbiAgICAgICAgb1trXSA9IGFba107XG4gICAgZm9yICh2YXIgayBpbiBiKVxuICAgICAgICBvW2tdID0gYltrXTtcbiAgICByZXR1cm4gbztcbn07XG4vLyB3b3JrZXIgY2xvbmVcbi8vIFRoaXMgaXMgcG9zc2libHkgdGhlIGNyYXppZXN0IHBhcnQgb2YgdGhlIGVudGlyZSBjb2RlYmFzZSwgZGVzcGl0ZSBob3cgc2ltcGxlIGl0IG1heSBzZWVtLlxuLy8gVGhlIG9ubHkgcGFyYW1ldGVyIHRvIHRoaXMgZnVuY3Rpb24gaXMgYSBjbG9zdXJlIHRoYXQgcmV0dXJucyBhbiBhcnJheSBvZiB2YXJpYWJsZXMgb3V0c2lkZSBvZiB0aGUgZnVuY3Rpb24gc2NvcGUuXG4vLyBXZSdyZSBnb2luZyB0byB0cnkgdG8gZmlndXJlIG91dCB0aGUgdmFyaWFibGUgbmFtZXMgdXNlZCBpbiB0aGUgY2xvc3VyZSBhcyBzdHJpbmdzIGJlY2F1c2UgdGhhdCBpcyBjcnVjaWFsIGZvciB3b3JrZXJpemF0aW9uLlxuLy8gV2Ugd2lsbCByZXR1cm4gYW4gb2JqZWN0IG1hcHBpbmcgb2YgdHJ1ZSB2YXJpYWJsZSBuYW1lIHRvIHZhbHVlIChiYXNpY2FsbHksIHRoZSBjdXJyZW50IHNjb3BlIGFzIGEgSlMgb2JqZWN0KS5cbi8vIFRoZSByZWFzb24gd2UgY2FuJ3QganVzdCB1c2UgdGhlIG9yaWdpbmFsIHZhcmlhYmxlIG5hbWVzIGlzIG1pbmlmaWVycyBtYW5nbGluZyB0aGUgdG9wbGV2ZWwgc2NvcGUuXG4vLyBUaGlzIHRvb2sgbWUgdGhyZWUgd2Vla3MgdG8gZmlndXJlIG91dCBob3cgdG8gZG8uXG52YXIgd2NsbiA9IGZ1bmN0aW9uIChmbiwgZm5TdHIsIHRkKSB7XG4gICAgdmFyIGR0ID0gZm4oKTtcbiAgICB2YXIgc3QgPSBmbi50b1N0cmluZygpO1xuICAgIHZhciBrcyA9IHN0LnNsaWNlKHN0LmluZGV4T2YoJ1snKSArIDEsIHN0Lmxhc3RJbmRleE9mKCddJykpLnJlcGxhY2UoL1xccysvZywgJycpLnNwbGl0KCcsJyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkdC5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgdiA9IGR0W2ldLCBrID0ga3NbaV07XG4gICAgICAgIGlmICh0eXBlb2YgdiA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBmblN0ciArPSAnOycgKyBrICsgJz0nO1xuICAgICAgICAgICAgdmFyIHN0XzEgPSB2LnRvU3RyaW5nKCk7XG4gICAgICAgICAgICBpZiAodi5wcm90b3R5cGUpIHtcbiAgICAgICAgICAgICAgICAvLyBmb3IgZ2xvYmFsIG9iamVjdHNcbiAgICAgICAgICAgICAgICBpZiAoc3RfMS5pbmRleE9mKCdbbmF0aXZlIGNvZGVdJykgIT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNwSW5kID0gc3RfMS5pbmRleE9mKCcgJywgOCkgKyAxO1xuICAgICAgICAgICAgICAgICAgICBmblN0ciArPSBzdF8xLnNsaWNlKHNwSW5kLCBzdF8xLmluZGV4T2YoJygnLCBzcEluZCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZm5TdHIgKz0gc3RfMTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgdCBpbiB2LnByb3RvdHlwZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGZuU3RyICs9ICc7JyArIGsgKyAnLnByb3RvdHlwZS4nICsgdCArICc9JyArIHYucHJvdG90eXBlW3RdLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGZuU3RyICs9IHN0XzE7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGRba10gPSB2O1xuICAgIH1cbiAgICByZXR1cm4gZm5TdHI7XG59O1xudmFyIGNoID0gW107XG4vLyBjbG9uZSBidWZzXG52YXIgY2JmcyA9IGZ1bmN0aW9uICh2KSB7XG4gICAgdmFyIHRsID0gW107XG4gICAgZm9yICh2YXIgayBpbiB2KSB7XG4gICAgICAgIGlmICh2W2tdLmJ1ZmZlcikge1xuICAgICAgICAgICAgdGwucHVzaCgodltrXSA9IG5ldyB2W2tdLmNvbnN0cnVjdG9yKHZba10pKS5idWZmZXIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0bDtcbn07XG4vLyB1c2UgYSB3b3JrZXIgdG8gZXhlY3V0ZSBjb2RlXG52YXIgd3JrciA9IGZ1bmN0aW9uIChmbnMsIGluaXQsIGlkLCBjYikge1xuICAgIGlmICghY2hbaWRdKSB7XG4gICAgICAgIHZhciBmblN0ciA9ICcnLCB0ZF8xID0ge30sIG0gPSBmbnMubGVuZ3RoIC0gMTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtOyArK2kpXG4gICAgICAgICAgICBmblN0ciA9IHdjbG4oZm5zW2ldLCBmblN0ciwgdGRfMSk7XG4gICAgICAgIGNoW2lkXSA9IHsgYzogd2NsbihmbnNbbV0sIGZuU3RyLCB0ZF8xKSwgZTogdGRfMSB9O1xuICAgIH1cbiAgICB2YXIgdGQgPSBtcmcoe30sIGNoW2lkXS5lKTtcbiAgICByZXR1cm4gd2soY2hbaWRdLmMgKyAnO29ubWVzc2FnZT1mdW5jdGlvbihlKXtmb3IodmFyIGsgaW4gZS5kYXRhKXNlbGZba109ZS5kYXRhW2tdO29ubWVzc2FnZT0nICsgaW5pdC50b1N0cmluZygpICsgJ30nLCBpZCwgdGQsIGNiZnModGQpLCBjYik7XG59O1xuLy8gYmFzZSBhc3luYyBpbmZsYXRlIGZuXG52YXIgYkluZmx0ID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gW3U4LCB1MTYsIGkzMiwgZmxlYiwgZmRlYiwgY2xpbSwgZmwsIGZkLCBmbHJtLCBmZHJtLCByZXYsIGVjLCBoTWFwLCBtYXgsIGJpdHMsIGJpdHMxNiwgc2hmdCwgc2xjLCBlcnIsIGluZmx0LCBpbmZsYXRlU3luYywgcGJmLCBnb3B0XTsgfTtcbnZhciBiRGZsdCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFt1OCwgdTE2LCBpMzIsIGZsZWIsIGZkZWIsIGNsaW0sIHJldmZsLCByZXZmZCwgZmxtLCBmbHQsIGZkbSwgZmR0LCByZXYsIGRlbywgZXQsIGhNYXAsIHdiaXRzLCB3Yml0czE2LCBoVHJlZSwgbG4sIGxjLCBjbGVuLCB3ZmJsaywgd2Jsaywgc2hmdCwgc2xjLCBkZmx0LCBkb3B0LCBkZWZsYXRlU3luYywgcGJmXTsgfTtcbi8vIGd6aXAgZXh0cmFcbnZhciBnemUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBbZ3poLCBnemhsLCB3Ynl0ZXMsIGNyYywgY3JjdF07IH07XG4vLyBndW56aXAgZXh0cmFcbnZhciBndXplID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gW2d6cywgZ3psXTsgfTtcbi8vIHpsaWIgZXh0cmFcbnZhciB6bGUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBbemxoLCB3Ynl0ZXMsIGFkbGVyXTsgfTtcbi8vIHVuemxpYiBleHRyYVxudmFyIHp1bGUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBbemxzXTsgfTtcbi8vIHBvc3QgYnVmXG52YXIgcGJmID0gZnVuY3Rpb24gKG1zZykgeyByZXR1cm4gcG9zdE1lc3NhZ2UobXNnLCBbbXNnLmJ1ZmZlcl0pOyB9O1xuLy8gZ2V0IG9wdHNcbnZhciBnb3B0ID0gZnVuY3Rpb24gKG8pIHsgcmV0dXJuIG8gJiYge1xuICAgIG91dDogby5zaXplICYmIG5ldyB1OChvLnNpemUpLFxuICAgIGRpY3Rpb25hcnk6IG8uZGljdGlvbmFyeVxufTsgfTtcbi8vIGFzeW5jIGhlbHBlclxudmFyIGNiaWZ5ID0gZnVuY3Rpb24gKGRhdCwgb3B0cywgZm5zLCBpbml0LCBpZCwgY2IpIHtcbiAgICB2YXIgdyA9IHdya3IoZm5zLCBpbml0LCBpZCwgZnVuY3Rpb24gKGVyciwgZGF0KSB7XG4gICAgICAgIHcudGVybWluYXRlKCk7XG4gICAgICAgIGNiKGVyciwgZGF0KTtcbiAgICB9KTtcbiAgICB3LnBvc3RNZXNzYWdlKFtkYXQsIG9wdHNdLCBvcHRzLmNvbnN1bWUgPyBbZGF0LmJ1ZmZlcl0gOiBbXSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHsgdy50ZXJtaW5hdGUoKTsgfTtcbn07XG4vLyBhdXRvIHN0cmVhbVxudmFyIGFzdHJtID0gZnVuY3Rpb24gKHN0cm0pIHtcbiAgICBzdHJtLm9uZGF0YSA9IGZ1bmN0aW9uIChkYXQsIGZpbmFsKSB7IHJldHVybiBwb3N0TWVzc2FnZShbZGF0LCBmaW5hbF0sIFtkYXQuYnVmZmVyXSk7IH07XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChldikge1xuICAgICAgICBpZiAoZXYuZGF0YVswXSkge1xuICAgICAgICAgICAgc3RybS5wdXNoKGV2LmRhdGFbMF0sIGV2LmRhdGFbMV0pO1xuICAgICAgICAgICAgcG9zdE1lc3NhZ2UoW2V2LmRhdGFbMF0ubGVuZ3RoXSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgc3RybS5mbHVzaChldi5kYXRhWzFdKTtcbiAgICB9O1xufTtcbi8vIGFzeW5jIHN0cmVhbSBhdHRhY2hcbnZhciBhc3RybWlmeSA9IGZ1bmN0aW9uIChmbnMsIHN0cm0sIG9wdHMsIGluaXQsIGlkLCBmbHVzaCwgZXh0KSB7XG4gICAgdmFyIHQ7XG4gICAgdmFyIHcgPSB3cmtyKGZucywgaW5pdCwgaWQsIGZ1bmN0aW9uIChlcnIsIGRhdCkge1xuICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgdy50ZXJtaW5hdGUoKSwgc3RybS5vbmRhdGEuY2FsbChzdHJtLCBlcnIpO1xuICAgICAgICBlbHNlIGlmICghQXJyYXkuaXNBcnJheShkYXQpKVxuICAgICAgICAgICAgZXh0KGRhdCk7XG4gICAgICAgIGVsc2UgaWYgKGRhdC5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgc3RybS5xdWV1ZWRTaXplIC09IGRhdFswXTtcbiAgICAgICAgICAgIGlmIChzdHJtLm9uZHJhaW4pXG4gICAgICAgICAgICAgICAgc3RybS5vbmRyYWluKGRhdFswXSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoZGF0WzFdKVxuICAgICAgICAgICAgICAgIHcudGVybWluYXRlKCk7XG4gICAgICAgICAgICBzdHJtLm9uZGF0YS5jYWxsKHN0cm0sIGVyciwgZGF0WzBdLCBkYXRbMV0pO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgdy5wb3N0TWVzc2FnZShvcHRzKTtcbiAgICBzdHJtLnF1ZXVlZFNpemUgPSAwO1xuICAgIHN0cm0ucHVzaCA9IGZ1bmN0aW9uIChkLCBmKSB7XG4gICAgICAgIGlmICghc3RybS5vbmRhdGEpXG4gICAgICAgICAgICBlcnIoNSk7XG4gICAgICAgIGlmICh0KVxuICAgICAgICAgICAgc3RybS5vbmRhdGEoZXJyKDQsIDAsIDEpLCBudWxsLCAhIWYpO1xuICAgICAgICBzdHJtLnF1ZXVlZFNpemUgKz0gZC5sZW5ndGg7XG4gICAgICAgIC8vIGNhbiBmYWlsIGZvciBjcm9zcy1yZWFsbSBVaW50OEFycmF5LCBidXQgb2sgLSBvbmx5IGEgc21hbGwgcGVyZm9ybWFuY2UgcGVuYWx0eVxuICAgICAgICB3LnBvc3RNZXNzYWdlKFtkLCB0ID0gZl0sIGQuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgPyBbZC5idWZmZXJdIDogW10pO1xuICAgIH07XG4gICAgc3RybS50ZXJtaW5hdGUgPSBmdW5jdGlvbiAoKSB7IHcudGVybWluYXRlKCk7IH07XG4gICAgaWYgKGZsdXNoKSB7XG4gICAgICAgIHN0cm0uZmx1c2ggPSBmdW5jdGlvbiAoc3luYykgeyB3LnBvc3RNZXNzYWdlKFswLCBzeW5jXSk7IH07XG4gICAgfVxufTtcbi8vIHJlYWQgMiBieXRlc1xudmFyIGIyID0gZnVuY3Rpb24gKGQsIGIpIHsgcmV0dXJuIGRbYl0gfCAoZFtiICsgMV0gPDwgOCk7IH07XG4vLyByZWFkIDQgYnl0ZXNcbnZhciBiNCA9IGZ1bmN0aW9uIChkLCBiKSB7IHJldHVybiAoZFtiXSB8IChkW2IgKyAxXSA8PCA4KSB8IChkW2IgKyAyXSA8PCAxNikgfCAoZFtiICsgM10gPDwgMjQpKSA+Pj4gMDsgfTtcbi8vIHJlYWQgOCBieXRlc1xudmFyIGI4ID0gZnVuY3Rpb24gKGQsIGIpIHsgcmV0dXJuIGI0KGQsIGIpICsgKGI0KGQsIGIgKyA0KSAqIDQyOTQ5NjcyOTYpOyB9O1xuLy8gd3JpdGUgYnl0ZXNcbnZhciB3Ynl0ZXMgPSBmdW5jdGlvbiAoZCwgYiwgdikge1xuICAgIGZvciAoOyB2OyArK2IpXG4gICAgICAgIGRbYl0gPSB2LCB2ID4+Pj0gODtcbn07XG4vLyBnemlwIGhlYWRlclxudmFyIGd6aCA9IGZ1bmN0aW9uIChjLCBvKSB7XG4gICAgdmFyIGZuID0gby5maWxlbmFtZTtcbiAgICBjWzBdID0gMzEsIGNbMV0gPSAxMzksIGNbMl0gPSA4LCBjWzhdID0gby5sZXZlbCA8IDIgPyA0IDogby5sZXZlbCA9PSA5ID8gMiA6IDAsIGNbOV0gPSAzOyAvLyBhc3N1bWUgVW5peFxuICAgIGlmIChvLm10aW1lICE9IDApXG4gICAgICAgIHdieXRlcyhjLCA0LCBNYXRoLmZsb29yKG5ldyBEYXRlKG8ubXRpbWUgfHwgRGF0ZS5ub3coKSkgLyAxMDAwKSk7XG4gICAgaWYgKGZuKSB7XG4gICAgICAgIGNbM10gPSA4O1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8PSBmbi5sZW5ndGg7ICsraSlcbiAgICAgICAgICAgIGNbaSArIDEwXSA9IGZuLmNoYXJDb2RlQXQoaSk7XG4gICAgfVxufTtcbi8vIGd6aXAgZm9vdGVyOiAtOCB0byAtNCA9IENSQywgLTQgdG8gLTAgaXMgbGVuZ3RoXG4vLyBnemlwIHN0YXJ0XG52YXIgZ3pzID0gZnVuY3Rpb24gKGQpIHtcbiAgICBpZiAoZFswXSAhPSAzMSB8fCBkWzFdICE9IDEzOSB8fCBkWzJdICE9IDgpXG4gICAgICAgIGVycig2LCAnaW52YWxpZCBnemlwIGRhdGEnKTtcbiAgICB2YXIgZmxnID0gZFszXTtcbiAgICB2YXIgc3QgPSAxMDtcbiAgICBpZiAoZmxnICYgNClcbiAgICAgICAgc3QgKz0gKGRbMTBdIHwgZFsxMV0gPDwgOCkgKyAyO1xuICAgIGZvciAodmFyIHpzID0gKGZsZyA+PiAzICYgMSkgKyAoZmxnID4+IDQgJiAxKTsgenMgPiAwOyB6cyAtPSAhZFtzdCsrXSlcbiAgICAgICAgO1xuICAgIHJldHVybiBzdCArIChmbGcgJiAyKTtcbn07XG4vLyBnemlwIGxlbmd0aFxudmFyIGd6bCA9IGZ1bmN0aW9uIChkKSB7XG4gICAgdmFyIGwgPSBkLmxlbmd0aDtcbiAgICByZXR1cm4gKGRbbCAtIDRdIHwgZFtsIC0gM10gPDwgOCB8IGRbbCAtIDJdIDw8IDE2IHwgZFtsIC0gMV0gPDwgMjQpID4+PiAwO1xufTtcbi8vIGd6aXAgaGVhZGVyIGxlbmd0aFxudmFyIGd6aGwgPSBmdW5jdGlvbiAobykgeyByZXR1cm4gMTAgKyAoby5maWxlbmFtZSA/IG8uZmlsZW5hbWUubGVuZ3RoICsgMSA6IDApOyB9O1xuLy8gemxpYiBoZWFkZXJcbnZhciB6bGggPSBmdW5jdGlvbiAoYywgbykge1xuICAgIHZhciBsdiA9IG8ubGV2ZWwsIGZsID0gbHYgPT0gMCA/IDAgOiBsdiA8IDYgPyAxIDogbHYgPT0gOSA/IDMgOiAyO1xuICAgIGNbMF0gPSAxMjAsIGNbMV0gPSAoZmwgPDwgNikgfCAoby5kaWN0aW9uYXJ5ICYmIDMyKTtcbiAgICBjWzFdIHw9IDMxIC0gKChjWzBdIDw8IDgpIHwgY1sxXSkgJSAzMTtcbiAgICBpZiAoby5kaWN0aW9uYXJ5KSB7XG4gICAgICAgIHZhciBoID0gYWRsZXIoKTtcbiAgICAgICAgaC5wKG8uZGljdGlvbmFyeSk7XG4gICAgICAgIHdieXRlcyhjLCAyLCBoLmQoKSk7XG4gICAgfVxufTtcbi8vIHpsaWIgc3RhcnRcbnZhciB6bHMgPSBmdW5jdGlvbiAoZCwgZGljdCkge1xuICAgIGlmICgoZFswXSAmIDE1KSAhPSA4IHx8IChkWzBdID4+IDQpID4gNyB8fCAoKGRbMF0gPDwgOCB8IGRbMV0pICUgMzEpKVxuICAgICAgICBlcnIoNiwgJ2ludmFsaWQgemxpYiBkYXRhJyk7XG4gICAgaWYgKChkWzFdID4+IDUgJiAxKSA9PSArIWRpY3QpXG4gICAgICAgIGVycig2LCAnaW52YWxpZCB6bGliIGRhdGE6ICcgKyAoZFsxXSAmIDMyID8gJ25lZWQnIDogJ3VuZXhwZWN0ZWQnKSArICcgZGljdGlvbmFyeScpO1xuICAgIHJldHVybiAoZFsxXSA+PiAzICYgNCkgKyAyO1xufTtcbmZ1bmN0aW9uIFN0cm1PcHQob3B0cywgY2IpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgY2IgPSBvcHRzLCBvcHRzID0ge307XG4gICAgdGhpcy5vbmRhdGEgPSBjYjtcbiAgICByZXR1cm4gb3B0cztcbn1cbi8qKlxuICogU3RyZWFtaW5nIERFRkxBVEUgY29tcHJlc3Npb25cbiAqL1xudmFyIERlZmxhdGUgPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gRGVmbGF0ZShvcHRzLCBjYikge1xuICAgICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgICAgIGNiID0gb3B0cywgb3B0cyA9IHt9O1xuICAgICAgICB0aGlzLm9uZGF0YSA9IGNiO1xuICAgICAgICB0aGlzLm8gPSBvcHRzIHx8IHt9O1xuICAgICAgICB0aGlzLnMgPSB7IGw6IDAsIGk6IDMyNzY4LCB3OiAzMjc2OCwgejogMzI3NjggfTtcbiAgICAgICAgLy8gQnVmZmVyIGxlbmd0aCBtdXN0IGFsd2F5cyBiZSAwIG1vZCAzMjc2OCBmb3IgaW5kZXggY2FsY3VsYXRpb25zIHRvIGJlIGNvcnJlY3Qgd2hlbiBtb2RpZnlpbmcgaGVhZCBhbmQgcHJldlxuICAgICAgICAvLyA5ODMwNCA9IDMyNzY4IChsb29rYmFjaykgKyA2NTUzNiAoY29tbW9uIGNodW5rIHNpemUpXG4gICAgICAgIHRoaXMuYiA9IG5ldyB1OCg5ODMwNCk7XG4gICAgICAgIGlmICh0aGlzLm8uZGljdGlvbmFyeSkge1xuICAgICAgICAgICAgdmFyIGRpY3QgPSB0aGlzLm8uZGljdGlvbmFyeS5zdWJhcnJheSgtMzI3NjgpO1xuICAgICAgICAgICAgdGhpcy5iLnNldChkaWN0LCAzMjc2OCAtIGRpY3QubGVuZ3RoKTtcbiAgICAgICAgICAgIHRoaXMucy5pID0gMzI3NjggLSBkaWN0Lmxlbmd0aDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBEZWZsYXRlLnByb3RvdHlwZS5wID0gZnVuY3Rpb24gKGMsIGYpIHtcbiAgICAgICAgdGhpcy5vbmRhdGEoZG9wdChjLCB0aGlzLm8sIDAsIDAsIHRoaXMucyksIGYpO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogUHVzaGVzIGEgY2h1bmsgdG8gYmUgZGVmbGF0ZWRcbiAgICAgKiBAcGFyYW0gY2h1bmsgVGhlIGNodW5rIHRvIHB1c2hcbiAgICAgKiBAcGFyYW0gZmluYWwgV2hldGhlciB0aGlzIGlzIHRoZSBsYXN0IGNodW5rXG4gICAgICovXG4gICAgRGVmbGF0ZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjaHVuaywgZmluYWwpIHtcbiAgICAgICAgaWYgKCF0aGlzLm9uZGF0YSlcbiAgICAgICAgICAgIGVycig1KTtcbiAgICAgICAgaWYgKHRoaXMucy5sKVxuICAgICAgICAgICAgZXJyKDQpO1xuICAgICAgICB2YXIgZW5kTGVuID0gY2h1bmsubGVuZ3RoICsgdGhpcy5zLno7XG4gICAgICAgIGlmIChlbmRMZW4gPiB0aGlzLmIubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoZW5kTGVuID4gMiAqIHRoaXMuYi5sZW5ndGggLSAzMjc2OCkge1xuICAgICAgICAgICAgICAgIHZhciBuZXdCdWYgPSBuZXcgdTgoZW5kTGVuICYgLTMyNzY4KTtcbiAgICAgICAgICAgICAgICBuZXdCdWYuc2V0KHRoaXMuYi5zdWJhcnJheSgwLCB0aGlzLnMueikpO1xuICAgICAgICAgICAgICAgIHRoaXMuYiA9IG5ld0J1ZjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBzcGxpdCA9IHRoaXMuYi5sZW5ndGggLSB0aGlzLnMuejtcbiAgICAgICAgICAgIHRoaXMuYi5zZXQoY2h1bmsuc3ViYXJyYXkoMCwgc3BsaXQpLCB0aGlzLnMueik7XG4gICAgICAgICAgICB0aGlzLnMueiA9IHRoaXMuYi5sZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnAodGhpcy5iLCBmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLmIuc2V0KHRoaXMuYi5zdWJhcnJheSgtMzI3NjgpKTtcbiAgICAgICAgICAgIHRoaXMuYi5zZXQoY2h1bmsuc3ViYXJyYXkoc3BsaXQpLCAzMjc2OCk7XG4gICAgICAgICAgICB0aGlzLnMueiA9IGNodW5rLmxlbmd0aCAtIHNwbGl0ICsgMzI3Njg7XG4gICAgICAgICAgICB0aGlzLnMuaSA9IDMyNzY2LCB0aGlzLnMudyA9IDMyNzY4O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5iLnNldChjaHVuaywgdGhpcy5zLnopO1xuICAgICAgICAgICAgdGhpcy5zLnogKz0gY2h1bmsubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucy5sID0gZmluYWwgJiAxO1xuICAgICAgICBpZiAodGhpcy5zLnogPiB0aGlzLnMudyArIDgxOTEgfHwgZmluYWwpIHtcbiAgICAgICAgICAgIHRoaXMucCh0aGlzLmIsIGZpbmFsIHx8IGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMucy53ID0gdGhpcy5zLmksIHRoaXMucy5pIC09IDI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpbmFsKSB7XG4gICAgICAgICAgICAvLyBjbGVhbnVwIHVubmVlZGVkIGJ1ZmZlcnMvc3RhdGUgdG8gcmVkdWNlIG1lbW9yeSB1c2FnZVxuICAgICAgICAgICAgdGhpcy5zID0gdGhpcy5vID0ge307XG4gICAgICAgICAgICB0aGlzLmIgPSBldDtcbiAgICAgICAgfVxuICAgIH07XG4gICAgLyoqXG4gICAgICogRmx1c2hlcyBidWZmZXJlZCB1bmNvbXByZXNzZWQgZGF0YS4gVXNlZnVsIHRvIGltbWVkaWF0ZWx5IHJldHJpZXZlIHRoZVxuICAgICAqIGRlZmxhdGVkIG91dHB1dCBmb3Igc21hbGwgaW5wdXRzLlxuICAgICAqIEBwYXJhbSBzeW5jIFdoZXRoZXIgdG8gZmx1c2ggdG8gYSBieXRlIGJvdW5kYXJ5LiBBIHN5bmMgZmx1c2ggdGFrZXMgNC01XG4gICAgICogICAgICAgICAgICAgZXh0cmEgYnl0ZXMsIGJ1dCBndWFyYW50ZWVzIGFsbCBwdXNoZWQgZGF0YSBpcyBpbW1lZGlhdGVseVxuICAgICAqICAgICAgICAgICAgIGRlY29tcHJlc3NpYmxlLiBBIHNlcGFyYXRlIERFRkxBVEUgc3RyZWFtIG1heSBiZSBjb25jYXRlbmF0ZWRcbiAgICAgKiAgICAgICAgICAgICB3aXRoIHRoZSBjdXJyZW50IG91dHB1dCBhZnRlciBhIHN5bmMgZmx1c2guXG4gICAgICovXG4gICAgRGVmbGF0ZS5wcm90b3R5cGUuZmx1c2ggPSBmdW5jdGlvbiAoc3luYykge1xuICAgICAgICBpZiAoIXRoaXMub25kYXRhKVxuICAgICAgICAgICAgZXJyKDUpO1xuICAgICAgICBpZiAodGhpcy5zLmwpXG4gICAgICAgICAgICBlcnIoNCk7XG4gICAgICAgIHRoaXMucCh0aGlzLmIsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5zLncgPSB0aGlzLnMuaSwgdGhpcy5zLmkgLT0gMjtcbiAgICAgICAgLy8gY291bGQgdGVjaG5pY2FsbHkgc2tpcCB3cml0aW5nIHRoZSB0eXBlLTAgYmxvY2sgZm9yICh0aGlzLnMuciAmIDcpID09IDAsXG4gICAgICAgIC8vIGJ1dCB0aGUgZGV0ZXJtaW5pc3RpYyB0cmFpbGVyICgwMCAwMCBGRiBGRikgaXMgdXNlZnVsIGluIHNvbWUgc2l0dWF0aW9uc1xuICAgICAgICBpZiAoc3luYykge1xuICAgICAgICAgICAgdmFyIGMgPSBuZXcgdTgoNik7XG4gICAgICAgICAgICBjWzBdID0gdGhpcy5zLnIgPj4gMztcbiAgICAgICAgICAgIC8vIHdyaXRlIGVtcHR5LCBub24tZmluYWwgdHlwZS0wIGJsb2NrXG4gICAgICAgICAgICB2YXIgZXAgPSB3ZmJsayhjLCB0aGlzLnMuciwgZXQpO1xuICAgICAgICAgICAgdGhpcy5zLnIgPSAwO1xuICAgICAgICAgICAgdGhpcy5vbmRhdGEoYy5zdWJhcnJheSgwLCBlcCA+PiAzKSwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4gRGVmbGF0ZTtcbn0oKSk7XG5leHBvcnQgeyBEZWZsYXRlIH07XG4vKipcbiAqIEFzeW5jaHJvbm91cyBzdHJlYW1pbmcgREVGTEFURSBjb21wcmVzc2lvblxuICovXG52YXIgQXN5bmNEZWZsYXRlID0gLyojX19QVVJFX18qLyAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEFzeW5jRGVmbGF0ZShvcHRzLCBjYikge1xuICAgICAgICBhc3RybWlmeShbXG4gICAgICAgICAgICBiRGZsdCxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgpIHsgcmV0dXJuIFthc3RybSwgRGVmbGF0ZV07IH1cbiAgICAgICAgXSwgdGhpcywgU3RybU9wdC5jYWxsKHRoaXMsIG9wdHMsIGNiKSwgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc3RybSA9IG5ldyBEZWZsYXRlKGV2LmRhdGEpO1xuICAgICAgICAgICAgb25tZXNzYWdlID0gYXN0cm0oc3RybSk7XG4gICAgICAgIH0sIDYsIDEpO1xuICAgIH1cbiAgICByZXR1cm4gQXN5bmNEZWZsYXRlO1xufSgpKTtcbmV4cG9ydCB7IEFzeW5jRGVmbGF0ZSB9O1xuZXhwb3J0IGZ1bmN0aW9uIGRlZmxhdGUoZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAoIWNiKVxuICAgICAgICBjYiA9IG9wdHMsIG9wdHMgPSB7fTtcbiAgICBpZiAodHlwZW9mIGNiICE9ICdmdW5jdGlvbicpXG4gICAgICAgIGVycig3KTtcbiAgICByZXR1cm4gY2JpZnkoZGF0YSwgb3B0cywgW1xuICAgICAgICBiRGZsdCxcbiAgICBdLCBmdW5jdGlvbiAoZXYpIHsgcmV0dXJuIHBiZihkZWZsYXRlU3luYyhldi5kYXRhWzBdLCBldi5kYXRhWzFdKSk7IH0sIDAsIGNiKTtcbn1cbi8qKlxuICogQ29tcHJlc3NlcyBkYXRhIHdpdGggREVGTEFURSB3aXRob3V0IGFueSB3cmFwcGVyXG4gKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSB0byBjb21wcmVzc1xuICogQHBhcmFtIG9wdHMgVGhlIGNvbXByZXNzaW9uIG9wdGlvbnNcbiAqIEByZXR1cm5zIFRoZSBkZWZsYXRlZCB2ZXJzaW9uIG9mIHRoZSBkYXRhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWZsYXRlU3luYyhkYXRhLCBvcHRzKSB7XG4gICAgcmV0dXJuIGRvcHQoZGF0YSwgb3B0cyB8fCB7fSwgMCwgMCk7XG59XG4vKipcbiAqIFN0cmVhbWluZyBERUZMQVRFIGRlY29tcHJlc3Npb25cbiAqL1xudmFyIEluZmxhdGUgPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gSW5mbGF0ZShvcHRzLCBjYikge1xuICAgICAgICAvLyBubyBTdHJtT3B0IGhlcmUgdG8gYXZvaWQgYWRkaW5nIHRvIHdvcmtlcml6ZXJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpXG4gICAgICAgICAgICBjYiA9IG9wdHMsIG9wdHMgPSB7fTtcbiAgICAgICAgdGhpcy5vbmRhdGEgPSBjYjtcbiAgICAgICAgdmFyIGRpY3QgPSBvcHRzICYmIG9wdHMuZGljdGlvbmFyeSAmJiBvcHRzLmRpY3Rpb25hcnkuc3ViYXJyYXkoLTMyNzY4KTtcbiAgICAgICAgdGhpcy5zID0geyBpOiAwLCBiOiBkaWN0ID8gZGljdC5sZW5ndGggOiAwIH07XG4gICAgICAgIHRoaXMubyA9IG5ldyB1OCgzMjc2OCk7XG4gICAgICAgIHRoaXMucCA9IG5ldyB1OCgwKTtcbiAgICAgICAgaWYgKGRpY3QpXG4gICAgICAgICAgICB0aGlzLm8uc2V0KGRpY3QpO1xuICAgIH1cbiAgICBJbmZsYXRlLnByb3RvdHlwZS5lID0gZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgaWYgKCF0aGlzLm9uZGF0YSlcbiAgICAgICAgICAgIGVycig1KTtcbiAgICAgICAgaWYgKHRoaXMuZClcbiAgICAgICAgICAgIGVycig0KTtcbiAgICAgICAgaWYgKCF0aGlzLnAubGVuZ3RoKVxuICAgICAgICAgICAgdGhpcy5wID0gYztcbiAgICAgICAgZWxzZSBpZiAoYy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBuID0gbmV3IHU4KHRoaXMucC5sZW5ndGggKyBjLmxlbmd0aCk7XG4gICAgICAgICAgICBuLnNldCh0aGlzLnApLCBuLnNldChjLCB0aGlzLnAubGVuZ3RoKSwgdGhpcy5wID0gbjtcbiAgICAgICAgfVxuICAgIH07XG4gICAgSW5mbGF0ZS5wcm90b3R5cGUuYyA9IGZ1bmN0aW9uIChmaW5hbCkge1xuICAgICAgICB0aGlzLnMuaSA9ICsodGhpcy5kID0gZmluYWwgfHwgZmFsc2UpO1xuICAgICAgICB2YXIgYnRzID0gdGhpcy5zLmI7XG4gICAgICAgIHZhciBkdCA9IGluZmx0KHRoaXMucCwgdGhpcy5zLCB0aGlzLm8pO1xuICAgICAgICB0aGlzLm9uZGF0YShzbGMoZHQsIGJ0cywgdGhpcy5zLmIpLCB0aGlzLmQpO1xuICAgICAgICB0aGlzLm8gPSBzbGMoZHQsIHRoaXMucy5iIC0gMzI3NjgpLCB0aGlzLnMuYiA9IHRoaXMuby5sZW5ndGg7XG4gICAgICAgIHRoaXMucCA9IHNsYyh0aGlzLnAsICh0aGlzLnMucCAvIDgpIHwgMCksIHRoaXMucy5wICY9IDc7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBQdXNoZXMgYSBjaHVuayB0byBiZSBpbmZsYXRlZFxuICAgICAqIEBwYXJhbSBjaHVuayBUaGUgY2h1bmsgdG8gcHVzaFxuICAgICAqIEBwYXJhbSBmaW5hbCBXaGV0aGVyIHRoaXMgaXMgdGhlIGZpbmFsIGNodW5rXG4gICAgICovXG4gICAgSW5mbGF0ZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjaHVuaywgZmluYWwpIHtcbiAgICAgICAgdGhpcy5lKGNodW5rKSwgdGhpcy5jKGZpbmFsKTtcbiAgICB9O1xuICAgIHJldHVybiBJbmZsYXRlO1xufSgpKTtcbmV4cG9ydCB7IEluZmxhdGUgfTtcbi8qKlxuICogQXN5bmNocm9ub3VzIHN0cmVhbWluZyBERUZMQVRFIGRlY29tcHJlc3Npb25cbiAqL1xudmFyIEFzeW5jSW5mbGF0ZSA9IC8qI19fUFVSRV9fKi8gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBBc3luY0luZmxhdGUob3B0cywgY2IpIHtcbiAgICAgICAgYXN0cm1pZnkoW1xuICAgICAgICAgICAgYkluZmx0LFxuICAgICAgICAgICAgZnVuY3Rpb24gKCkgeyByZXR1cm4gW2FzdHJtLCBJbmZsYXRlXTsgfVxuICAgICAgICBdLCB0aGlzLCBTdHJtT3B0LmNhbGwodGhpcywgb3B0cywgY2IpLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzdHJtID0gbmV3IEluZmxhdGUoZXYuZGF0YSk7XG4gICAgICAgICAgICBvbm1lc3NhZ2UgPSBhc3RybShzdHJtKTtcbiAgICAgICAgfSwgNywgMCk7XG4gICAgfVxuICAgIHJldHVybiBBc3luY0luZmxhdGU7XG59KCkpO1xuZXhwb3J0IHsgQXN5bmNJbmZsYXRlIH07XG5leHBvcnQgZnVuY3Rpb24gaW5mbGF0ZShkYXRhLCBvcHRzLCBjYikge1xuICAgIGlmICghY2IpXG4gICAgICAgIGNiID0gb3B0cywgb3B0cyA9IHt9O1xuICAgIGlmICh0eXBlb2YgY2IgIT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgZXJyKDcpO1xuICAgIHJldHVybiBjYmlmeShkYXRhLCBvcHRzLCBbXG4gICAgICAgIGJJbmZsdFxuICAgIF0sIGZ1bmN0aW9uIChldikgeyByZXR1cm4gcGJmKGluZmxhdGVTeW5jKGV2LmRhdGFbMF0sIGdvcHQoZXYuZGF0YVsxXSkpKTsgfSwgMSwgY2IpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGluZmxhdGVTeW5jKGRhdGEsIG9wdHMpIHtcbiAgICByZXR1cm4gaW5mbHQoZGF0YSwgeyBpOiAyIH0sIG9wdHMgJiYgb3B0cy5vdXQsIG9wdHMgJiYgb3B0cy5kaWN0aW9uYXJ5KTtcbn1cbi8vIGJlZm9yZSB5b3UgeWVsbCBhdCBtZSBmb3Igbm90IGp1c3QgdXNpbmcgZXh0ZW5kcywgbXkgcmVhc29uIGlzIHRoYXQgVFMgaW5oZXJpdGFuY2UgaXMgaGFyZCB0byB3b3JrZXJpemUuXG4vKipcbiAqIFN0cmVhbWluZyBHWklQIGNvbXByZXNzaW9uXG4gKi9cbnZhciBHemlwID0gLyojX19QVVJFX18qLyAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEd6aXAob3B0cywgY2IpIHtcbiAgICAgICAgdGhpcy5jID0gY3JjKCk7XG4gICAgICAgIHRoaXMubCA9IDA7XG4gICAgICAgIHRoaXMudiA9IDE7XG4gICAgICAgIERlZmxhdGUuY2FsbCh0aGlzLCBvcHRzLCBjYik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFB1c2hlcyBhIGNodW5rIHRvIGJlIEdaSVBwZWRcbiAgICAgKiBAcGFyYW0gY2h1bmsgVGhlIGNodW5rIHRvIHB1c2hcbiAgICAgKiBAcGFyYW0gZmluYWwgV2hldGhlciB0aGlzIGlzIHRoZSBsYXN0IGNodW5rXG4gICAgICovXG4gICAgR3ppcC5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjaHVuaywgZmluYWwpIHtcbiAgICAgICAgdGhpcy5jLnAoY2h1bmspO1xuICAgICAgICB0aGlzLmwgKz0gY2h1bmsubGVuZ3RoO1xuICAgICAgICBEZWZsYXRlLnByb3RvdHlwZS5wdXNoLmNhbGwodGhpcywgY2h1bmssIGZpbmFsKTtcbiAgICB9O1xuICAgIEd6aXAucHJvdG90eXBlLnAgPSBmdW5jdGlvbiAoYywgZikge1xuICAgICAgICB2YXIgcmF3ID0gZG9wdChjLCB0aGlzLm8sIHRoaXMudiAmJiBnemhsKHRoaXMubyksIGYgJiYgOCwgdGhpcy5zKTtcbiAgICAgICAgaWYgKHRoaXMudilcbiAgICAgICAgICAgIGd6aChyYXcsIHRoaXMubyksIHRoaXMudiA9IDA7XG4gICAgICAgIGlmIChmKVxuICAgICAgICAgICAgd2J5dGVzKHJhdywgcmF3Lmxlbmd0aCAtIDgsIHRoaXMuYy5kKCkpLCB3Ynl0ZXMocmF3LCByYXcubGVuZ3RoIC0gNCwgdGhpcy5sKTtcbiAgICAgICAgdGhpcy5vbmRhdGEocmF3LCBmKTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEZsdXNoZXMgYnVmZmVyZWQgdW5jb21wcmVzc2VkIGRhdGEuIFVzZWZ1bCB0byBpbW1lZGlhdGVseSByZXRyaWV2ZSB0aGVcbiAgICAgKiBHWklQcGVkIG91dHB1dCBmb3Igc21hbGwgaW5wdXRzLlxuICAgICAqIEBwYXJhbSBzeW5jIFdoZXRoZXIgdG8gZmx1c2ggdG8gYSBieXRlIGJvdW5kYXJ5LiBBIHN5bmMgZmx1c2ggdGFrZXMgNC01XG4gICAgICogICAgICAgICAgICAgZXh0cmEgYnl0ZXMsIGJ1dCBndWFyYW50ZWVzIGFsbCBwdXNoZWQgZGF0YSBpcyBpbW1lZGlhdGVseVxuICAgICAqICAgICAgICAgICAgIGRlY29tcHJlc3NpYmxlLlxuICAgICAqL1xuICAgIEd6aXAucHJvdG90eXBlLmZsdXNoID0gZnVuY3Rpb24gKHN5bmMpIHtcbiAgICAgICAgRGVmbGF0ZS5wcm90b3R5cGUuZmx1c2guY2FsbCh0aGlzLCBzeW5jKTtcbiAgICB9O1xuICAgIHJldHVybiBHemlwO1xufSgpKTtcbmV4cG9ydCB7IEd6aXAgfTtcbi8qKlxuICogQXN5bmNocm9ub3VzIHN0cmVhbWluZyBHWklQIGNvbXByZXNzaW9uXG4gKi9cbnZhciBBc3luY0d6aXAgPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gQXN5bmNHemlwKG9wdHMsIGNiKSB7XG4gICAgICAgIGFzdHJtaWZ5KFtcbiAgICAgICAgICAgIGJEZmx0LFxuICAgICAgICAgICAgZ3plLFxuICAgICAgICAgICAgZnVuY3Rpb24gKCkgeyByZXR1cm4gW2FzdHJtLCBEZWZsYXRlLCBHemlwXTsgfVxuICAgICAgICBdLCB0aGlzLCBTdHJtT3B0LmNhbGwodGhpcywgb3B0cywgY2IpLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzdHJtID0gbmV3IEd6aXAoZXYuZGF0YSk7XG4gICAgICAgICAgICBvbm1lc3NhZ2UgPSBhc3RybShzdHJtKTtcbiAgICAgICAgfSwgOCwgMSk7XG4gICAgfVxuICAgIHJldHVybiBBc3luY0d6aXA7XG59KCkpO1xuZXhwb3J0IHsgQXN5bmNHemlwIH07XG5leHBvcnQgZnVuY3Rpb24gZ3ppcChkYXRhLCBvcHRzLCBjYikge1xuICAgIGlmICghY2IpXG4gICAgICAgIGNiID0gb3B0cywgb3B0cyA9IHt9O1xuICAgIGlmICh0eXBlb2YgY2IgIT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgZXJyKDcpO1xuICAgIHJldHVybiBjYmlmeShkYXRhLCBvcHRzLCBbXG4gICAgICAgIGJEZmx0LFxuICAgICAgICBnemUsXG4gICAgICAgIGZ1bmN0aW9uICgpIHsgcmV0dXJuIFtnemlwU3luY107IH1cbiAgICBdLCBmdW5jdGlvbiAoZXYpIHsgcmV0dXJuIHBiZihnemlwU3luYyhldi5kYXRhWzBdLCBldi5kYXRhWzFdKSk7IH0sIDIsIGNiKTtcbn1cbi8qKlxuICogQ29tcHJlc3NlcyBkYXRhIHdpdGggR1pJUFxuICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gY29tcHJlc3NcbiAqIEBwYXJhbSBvcHRzIFRoZSBjb21wcmVzc2lvbiBvcHRpb25zXG4gKiBAcmV0dXJucyBUaGUgZ3ppcHBlZCB2ZXJzaW9uIG9mIHRoZSBkYXRhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnemlwU3luYyhkYXRhLCBvcHRzKSB7XG4gICAgaWYgKCFvcHRzKVxuICAgICAgICBvcHRzID0ge307XG4gICAgdmFyIGMgPSBjcmMoKSwgbCA9IGRhdGEubGVuZ3RoO1xuICAgIGMucChkYXRhKTtcbiAgICB2YXIgZCA9IGRvcHQoZGF0YSwgb3B0cywgZ3pobChvcHRzKSwgOCksIHMgPSBkLmxlbmd0aDtcbiAgICByZXR1cm4gZ3poKGQsIG9wdHMpLCB3Ynl0ZXMoZCwgcyAtIDgsIGMuZCgpKSwgd2J5dGVzKGQsIHMgLSA0LCBsKSwgZDtcbn1cbi8qKlxuICogU3RyZWFtaW5nIHNpbmdsZSBvciBtdWx0aS1tZW1iZXIgR1pJUCBkZWNvbXByZXNzaW9uXG4gKi9cbnZhciBHdW56aXAgPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gR3VuemlwKG9wdHMsIGNiKSB7XG4gICAgICAgIHRoaXMudiA9IDE7XG4gICAgICAgIHRoaXMuciA9IDA7XG4gICAgICAgIEluZmxhdGUuY2FsbCh0aGlzLCBvcHRzLCBjYik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFB1c2hlcyBhIGNodW5rIHRvIGJlIEdVTlpJUHBlZFxuICAgICAqIEBwYXJhbSBjaHVuayBUaGUgY2h1bmsgdG8gcHVzaFxuICAgICAqIEBwYXJhbSBmaW5hbCBXaGV0aGVyIHRoaXMgaXMgdGhlIGxhc3QgY2h1bmtcbiAgICAgKi9cbiAgICBHdW56aXAucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoY2h1bmssIGZpbmFsKSB7XG4gICAgICAgIEluZmxhdGUucHJvdG90eXBlLmUuY2FsbCh0aGlzLCBjaHVuayk7XG4gICAgICAgIHRoaXMuciArPSBjaHVuay5sZW5ndGg7XG4gICAgICAgIGlmICh0aGlzLnYpIHtcbiAgICAgICAgICAgIHZhciBwID0gdGhpcy5wLnN1YmFycmF5KHRoaXMudiAtIDEpO1xuICAgICAgICAgICAgdmFyIHMgPSBwLmxlbmd0aCA+IDMgPyBnenMocCkgOiA0O1xuICAgICAgICAgICAgaWYgKHMgPiBwLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmICghZmluYWwpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMudiA+IDEgJiYgdGhpcy5vbm1lbWJlcikge1xuICAgICAgICAgICAgICAgIHRoaXMub25tZW1iZXIodGhpcy5yIC0gcC5sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5wID0gcC5zdWJhcnJheShzKSwgdGhpcy52ID0gMDtcbiAgICAgICAgfVxuICAgICAgICAvLyBuZWNlc3NhcnkgdG8gcHJldmVudCBUUyBmcm9tIHVzaW5nIHRoZSBjbG9zdXJlIHZhbHVlXG4gICAgICAgIC8vIFRoaXMgYWxsb3dzIGZvciB3b3JrZXJpemF0aW9uIHRvIGZ1bmN0aW9uIGNvcnJlY3RseVxuICAgICAgICBJbmZsYXRlLnByb3RvdHlwZS5jLmNhbGwodGhpcywgMCk7XG4gICAgICAgIC8vIHByb2Nlc3MgY29uY2F0ZW5hdGVkIEdaSVBcbiAgICAgICAgaWYgKHRoaXMucy5mICYmICF0aGlzLnMubCkge1xuICAgICAgICAgICAgdGhpcy52ID0gc2hmdCh0aGlzLnMucCkgKyA5O1xuICAgICAgICAgICAgdGhpcy5zID0geyBpOiAwIH07XG4gICAgICAgICAgICB0aGlzLm8gPSBuZXcgdTgoMCk7XG4gICAgICAgICAgICB0aGlzLnB1c2gobmV3IHU4KDApLCBmaW5hbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZmluYWwpIHtcbiAgICAgICAgICAgIEluZmxhdGUucHJvdG90eXBlLmMuY2FsbCh0aGlzLCBmaW5hbCk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHJldHVybiBHdW56aXA7XG59KCkpO1xuZXhwb3J0IHsgR3VuemlwIH07XG4vKipcbiAqIEFzeW5jaHJvbm91cyBzdHJlYW1pbmcgc2luZ2xlIG9yIG11bHRpLW1lbWJlciBHWklQIGRlY29tcHJlc3Npb25cbiAqL1xudmFyIEFzeW5jR3VuemlwID0gLyojX19QVVJFX18qLyAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEFzeW5jR3VuemlwKG9wdHMsIGNiKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGFzdHJtaWZ5KFtcbiAgICAgICAgICAgIGJJbmZsdCxcbiAgICAgICAgICAgIGd1emUsXG4gICAgICAgICAgICBmdW5jdGlvbiAoKSB7IHJldHVybiBbYXN0cm0sIEluZmxhdGUsIEd1bnppcF07IH1cbiAgICAgICAgXSwgdGhpcywgU3RybU9wdC5jYWxsKHRoaXMsIG9wdHMsIGNiKSwgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc3RybSA9IG5ldyBHdW56aXAoZXYuZGF0YSk7XG4gICAgICAgICAgICBzdHJtLm9ubWVtYmVyID0gZnVuY3Rpb24gKG9mZnNldCkgeyByZXR1cm4gcG9zdE1lc3NhZ2Uob2Zmc2V0KTsgfTtcbiAgICAgICAgICAgIG9ubWVzc2FnZSA9IGFzdHJtKHN0cm0pO1xuICAgICAgICB9LCA5LCAwLCBmdW5jdGlvbiAob2Zmc2V0KSB7IHJldHVybiBfdGhpcy5vbm1lbWJlciAmJiBfdGhpcy5vbm1lbWJlcihvZmZzZXQpOyB9KTtcbiAgICB9XG4gICAgcmV0dXJuIEFzeW5jR3VuemlwO1xufSgpKTtcbmV4cG9ydCB7IEFzeW5jR3VuemlwIH07XG5leHBvcnQgZnVuY3Rpb24gZ3VuemlwKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKCFjYilcbiAgICAgICAgY2IgPSBvcHRzLCBvcHRzID0ge307XG4gICAgaWYgKHR5cGVvZiBjYiAhPSAnZnVuY3Rpb24nKVxuICAgICAgICBlcnIoNyk7XG4gICAgcmV0dXJuIGNiaWZ5KGRhdGEsIG9wdHMsIFtcbiAgICAgICAgYkluZmx0LFxuICAgICAgICBndXplLFxuICAgICAgICBmdW5jdGlvbiAoKSB7IHJldHVybiBbZ3VuemlwU3luY107IH1cbiAgICBdLCBmdW5jdGlvbiAoZXYpIHsgcmV0dXJuIHBiZihndW56aXBTeW5jKGV2LmRhdGFbMF0sIGV2LmRhdGFbMV0pKTsgfSwgMywgY2IpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGd1bnppcFN5bmMoZGF0YSwgb3B0cykge1xuICAgIHZhciBzdCA9IGd6cyhkYXRhKTtcbiAgICBpZiAoc3QgKyA4ID4gZGF0YS5sZW5ndGgpXG4gICAgICAgIGVycig2LCAnaW52YWxpZCBnemlwIGRhdGEnKTtcbiAgICByZXR1cm4gaW5mbHQoZGF0YS5zdWJhcnJheShzdCwgLTgpLCB7IGk6IDIgfSwgb3B0cyAmJiBvcHRzLm91dCB8fCBuZXcgdTgoZ3psKGRhdGEpKSwgb3B0cyAmJiBvcHRzLmRpY3Rpb25hcnkpO1xufVxuLyoqXG4gKiBTdHJlYW1pbmcgWmxpYiBjb21wcmVzc2lvblxuICovXG52YXIgWmxpYiA9IC8qI19fUFVSRV9fKi8gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBabGliKG9wdHMsIGNiKSB7XG4gICAgICAgIHRoaXMuYyA9IGFkbGVyKCk7XG4gICAgICAgIHRoaXMudiA9IDE7XG4gICAgICAgIERlZmxhdGUuY2FsbCh0aGlzLCBvcHRzLCBjYik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFB1c2hlcyBhIGNodW5rIHRvIGJlIHpsaWJiZWRcbiAgICAgKiBAcGFyYW0gY2h1bmsgVGhlIGNodW5rIHRvIHB1c2hcbiAgICAgKiBAcGFyYW0gZmluYWwgV2hldGhlciB0aGlzIGlzIHRoZSBsYXN0IGNodW5rXG4gICAgICovXG4gICAgWmxpYi5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjaHVuaywgZmluYWwpIHtcbiAgICAgICAgdGhpcy5jLnAoY2h1bmspO1xuICAgICAgICBEZWZsYXRlLnByb3RvdHlwZS5wdXNoLmNhbGwodGhpcywgY2h1bmssIGZpbmFsKTtcbiAgICB9O1xuICAgIFpsaWIucHJvdG90eXBlLnAgPSBmdW5jdGlvbiAoYywgZikge1xuICAgICAgICB2YXIgcmF3ID0gZG9wdChjLCB0aGlzLm8sIHRoaXMudiAmJiAodGhpcy5vLmRpY3Rpb25hcnkgPyA2IDogMiksIGYgJiYgNCwgdGhpcy5zKTtcbiAgICAgICAgaWYgKHRoaXMudilcbiAgICAgICAgICAgIHpsaChyYXcsIHRoaXMubyksIHRoaXMudiA9IDA7XG4gICAgICAgIGlmIChmKVxuICAgICAgICAgICAgd2J5dGVzKHJhdywgcmF3Lmxlbmd0aCAtIDQsIHRoaXMuYy5kKCkpO1xuICAgICAgICB0aGlzLm9uZGF0YShyYXcsIGYpO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogRmx1c2hlcyBidWZmZXJlZCB1bmNvbXByZXNzZWQgZGF0YS4gVXNlZnVsIHRvIGltbWVkaWF0ZWx5IHJldHJpZXZlIHRoZVxuICAgICAqIHpsaWJiZWQgb3V0cHV0IGZvciBzbWFsbCBpbnB1dHMuXG4gICAgICogQHBhcmFtIHN5bmMgV2hldGhlciB0byBmbHVzaCB0byBhIGJ5dGUgYm91bmRhcnkuIEEgc3luYyBmbHVzaCB0YWtlcyA0LTVcbiAgICAgKiAgICAgICAgICAgICBleHRyYSBieXRlcywgYnV0IGd1YXJhbnRlZXMgYWxsIHB1c2hlZCBkYXRhIGlzIGltbWVkaWF0ZWx5XG4gICAgICogICAgICAgICAgICAgZGVjb21wcmVzc2libGUuXG4gICAgICovXG4gICAgWmxpYi5wcm90b3R5cGUuZmx1c2ggPSBmdW5jdGlvbiAoc3luYykge1xuICAgICAgICBEZWZsYXRlLnByb3RvdHlwZS5mbHVzaC5jYWxsKHRoaXMsIHN5bmMpO1xuICAgIH07XG4gICAgcmV0dXJuIFpsaWI7XG59KCkpO1xuZXhwb3J0IHsgWmxpYiB9O1xuLyoqXG4gKiBBc3luY2hyb25vdXMgc3RyZWFtaW5nIFpsaWIgY29tcHJlc3Npb25cbiAqL1xudmFyIEFzeW5jWmxpYiA9IC8qI19fUFVSRV9fKi8gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBBc3luY1psaWIob3B0cywgY2IpIHtcbiAgICAgICAgYXN0cm1pZnkoW1xuICAgICAgICAgICAgYkRmbHQsXG4gICAgICAgICAgICB6bGUsXG4gICAgICAgICAgICBmdW5jdGlvbiAoKSB7IHJldHVybiBbYXN0cm0sIERlZmxhdGUsIFpsaWJdOyB9XG4gICAgICAgIF0sIHRoaXMsIFN0cm1PcHQuY2FsbCh0aGlzLCBvcHRzLCBjYiksIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHN0cm0gPSBuZXcgWmxpYihldi5kYXRhKTtcbiAgICAgICAgICAgIG9ubWVzc2FnZSA9IGFzdHJtKHN0cm0pO1xuICAgICAgICB9LCAxMCwgMSk7XG4gICAgfVxuICAgIHJldHVybiBBc3luY1psaWI7XG59KCkpO1xuZXhwb3J0IHsgQXN5bmNabGliIH07XG5leHBvcnQgZnVuY3Rpb24gemxpYihkYXRhLCBvcHRzLCBjYikge1xuICAgIGlmICghY2IpXG4gICAgICAgIGNiID0gb3B0cywgb3B0cyA9IHt9O1xuICAgIGlmICh0eXBlb2YgY2IgIT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgZXJyKDcpO1xuICAgIHJldHVybiBjYmlmeShkYXRhLCBvcHRzLCBbXG4gICAgICAgIGJEZmx0LFxuICAgICAgICB6bGUsXG4gICAgICAgIGZ1bmN0aW9uICgpIHsgcmV0dXJuIFt6bGliU3luY107IH1cbiAgICBdLCBmdW5jdGlvbiAoZXYpIHsgcmV0dXJuIHBiZih6bGliU3luYyhldi5kYXRhWzBdLCBldi5kYXRhWzFdKSk7IH0sIDQsIGNiKTtcbn1cbi8qKlxuICogQ29tcHJlc3MgZGF0YSB3aXRoIFpsaWJcbiAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIHRvIGNvbXByZXNzXG4gKiBAcGFyYW0gb3B0cyBUaGUgY29tcHJlc3Npb24gb3B0aW9uc1xuICogQHJldHVybnMgVGhlIHpsaWItY29tcHJlc3NlZCB2ZXJzaW9uIG9mIHRoZSBkYXRhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB6bGliU3luYyhkYXRhLCBvcHRzKSB7XG4gICAgaWYgKCFvcHRzKVxuICAgICAgICBvcHRzID0ge307XG4gICAgdmFyIGEgPSBhZGxlcigpO1xuICAgIGEucChkYXRhKTtcbiAgICB2YXIgZCA9IGRvcHQoZGF0YSwgb3B0cywgb3B0cy5kaWN0aW9uYXJ5ID8gNiA6IDIsIDQpO1xuICAgIHJldHVybiB6bGgoZCwgb3B0cyksIHdieXRlcyhkLCBkLmxlbmd0aCAtIDQsIGEuZCgpKSwgZDtcbn1cbi8qKlxuICogU3RyZWFtaW5nIFpsaWIgZGVjb21wcmVzc2lvblxuICovXG52YXIgVW56bGliID0gLyojX19QVVJFX18qLyAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIFVuemxpYihvcHRzLCBjYikge1xuICAgICAgICBJbmZsYXRlLmNhbGwodGhpcywgb3B0cywgY2IpO1xuICAgICAgICB0aGlzLnYgPSBvcHRzICYmIG9wdHMuZGljdGlvbmFyeSA/IDIgOiAxO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBQdXNoZXMgYSBjaHVuayB0byBiZSB1bnpsaWJiZWRcbiAgICAgKiBAcGFyYW0gY2h1bmsgVGhlIGNodW5rIHRvIHB1c2hcbiAgICAgKiBAcGFyYW0gZmluYWwgV2hldGhlciB0aGlzIGlzIHRoZSBsYXN0IGNodW5rXG4gICAgICovXG4gICAgVW56bGliLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKGNodW5rLCBmaW5hbCkge1xuICAgICAgICBJbmZsYXRlLnByb3RvdHlwZS5lLmNhbGwodGhpcywgY2h1bmspO1xuICAgICAgICBpZiAodGhpcy52KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wLmxlbmd0aCA8IDYgJiYgIWZpbmFsKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMucCA9IHRoaXMucC5zdWJhcnJheSh6bHModGhpcy5wLCB0aGlzLnYgLSAxKSksIHRoaXMudiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpbmFsKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wLmxlbmd0aCA8IDQpXG4gICAgICAgICAgICAgICAgZXJyKDYsICdpbnZhbGlkIHpsaWIgZGF0YScpO1xuICAgICAgICAgICAgdGhpcy5wID0gdGhpcy5wLnN1YmFycmF5KDAsIC00KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBuZWNlc3NhcnkgdG8gcHJldmVudCBUUyBmcm9tIHVzaW5nIHRoZSBjbG9zdXJlIHZhbHVlXG4gICAgICAgIC8vIFRoaXMgYWxsb3dzIGZvciB3b3JrZXJpemF0aW9uIHRvIGZ1bmN0aW9uIGNvcnJlY3RseVxuICAgICAgICBJbmZsYXRlLnByb3RvdHlwZS5jLmNhbGwodGhpcywgZmluYWwpO1xuICAgIH07XG4gICAgcmV0dXJuIFVuemxpYjtcbn0oKSk7XG5leHBvcnQgeyBVbnpsaWIgfTtcbi8qKlxuICogQXN5bmNocm9ub3VzIHN0cmVhbWluZyBabGliIGRlY29tcHJlc3Npb25cbiAqL1xudmFyIEFzeW5jVW56bGliID0gLyojX19QVVJFX18qLyAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEFzeW5jVW56bGliKG9wdHMsIGNiKSB7XG4gICAgICAgIGFzdHJtaWZ5KFtcbiAgICAgICAgICAgIGJJbmZsdCxcbiAgICAgICAgICAgIHp1bGUsXG4gICAgICAgICAgICBmdW5jdGlvbiAoKSB7IHJldHVybiBbYXN0cm0sIEluZmxhdGUsIFVuemxpYl07IH1cbiAgICAgICAgXSwgdGhpcywgU3RybU9wdC5jYWxsKHRoaXMsIG9wdHMsIGNiKSwgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc3RybSA9IG5ldyBVbnpsaWIoZXYuZGF0YSk7XG4gICAgICAgICAgICBvbm1lc3NhZ2UgPSBhc3RybShzdHJtKTtcbiAgICAgICAgfSwgMTEsIDApO1xuICAgIH1cbiAgICByZXR1cm4gQXN5bmNVbnpsaWI7XG59KCkpO1xuZXhwb3J0IHsgQXN5bmNVbnpsaWIgfTtcbmV4cG9ydCBmdW5jdGlvbiB1bnpsaWIoZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAoIWNiKVxuICAgICAgICBjYiA9IG9wdHMsIG9wdHMgPSB7fTtcbiAgICBpZiAodHlwZW9mIGNiICE9ICdmdW5jdGlvbicpXG4gICAgICAgIGVycig3KTtcbiAgICByZXR1cm4gY2JpZnkoZGF0YSwgb3B0cywgW1xuICAgICAgICBiSW5mbHQsXG4gICAgICAgIHp1bGUsXG4gICAgICAgIGZ1bmN0aW9uICgpIHsgcmV0dXJuIFt1bnpsaWJTeW5jXTsgfVxuICAgIF0sIGZ1bmN0aW9uIChldikgeyByZXR1cm4gcGJmKHVuemxpYlN5bmMoZXYuZGF0YVswXSwgZ29wdChldi5kYXRhWzFdKSkpOyB9LCA1LCBjYik7XG59XG5leHBvcnQgZnVuY3Rpb24gdW56bGliU3luYyhkYXRhLCBvcHRzKSB7XG4gICAgcmV0dXJuIGluZmx0KGRhdGEuc3ViYXJyYXkoemxzKGRhdGEsIG9wdHMgJiYgb3B0cy5kaWN0aW9uYXJ5KSwgLTQpLCB7IGk6IDIgfSwgb3B0cyAmJiBvcHRzLm91dCwgb3B0cyAmJiBvcHRzLmRpY3Rpb25hcnkpO1xufVxuLy8gRGVmYXVsdCBhbGdvcml0aG0gZm9yIGNvbXByZXNzaW9uICh1c2VkIGJlY2F1c2UgaGF2aW5nIGEga25vd24gb3V0cHV0IHNpemUgYWxsb3dzIGZhc3RlciBkZWNvbXByZXNzaW9uKVxuZXhwb3J0IHsgZ3ppcCBhcyBjb21wcmVzcywgQXN5bmNHemlwIGFzIEFzeW5jQ29tcHJlc3MgfTtcbmV4cG9ydCB7IGd6aXBTeW5jIGFzIGNvbXByZXNzU3luYywgR3ppcCBhcyBDb21wcmVzcyB9O1xuLyoqXG4gKiBTdHJlYW1pbmcgR1pJUCwgWmxpYiwgb3IgcmF3IERFRkxBVEUgZGVjb21wcmVzc2lvblxuICovXG52YXIgRGVjb21wcmVzcyA9IC8qI19fUFVSRV9fKi8gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBEZWNvbXByZXNzKG9wdHMsIGNiKSB7XG4gICAgICAgIHRoaXMubyA9IFN0cm1PcHQuY2FsbCh0aGlzLCBvcHRzLCBjYikgfHwge307XG4gICAgICAgIHRoaXMuRyA9IEd1bnppcDtcbiAgICAgICAgdGhpcy5JID0gSW5mbGF0ZTtcbiAgICAgICAgdGhpcy5aID0gVW56bGliO1xuICAgIH1cbiAgICAvLyBpbml0IHN1YnN0cmVhbVxuICAgIC8vIG92ZXJyaWRlbiBieSBBc3luY0RlY29tcHJlc3NcbiAgICBEZWNvbXByZXNzLnByb3RvdHlwZS5pID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB0aGlzLnMub25kYXRhID0gZnVuY3Rpb24gKGRhdCwgZmluYWwpIHtcbiAgICAgICAgICAgIF90aGlzLm9uZGF0YShkYXQsIGZpbmFsKTtcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIFB1c2hlcyBhIGNodW5rIHRvIGJlIGRlY29tcHJlc3NlZFxuICAgICAqIEBwYXJhbSBjaHVuayBUaGUgY2h1bmsgdG8gcHVzaFxuICAgICAqIEBwYXJhbSBmaW5hbCBXaGV0aGVyIHRoaXMgaXMgdGhlIGxhc3QgY2h1bmtcbiAgICAgKi9cbiAgICBEZWNvbXByZXNzLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKGNodW5rLCBmaW5hbCkge1xuICAgICAgICBpZiAoIXRoaXMub25kYXRhKVxuICAgICAgICAgICAgZXJyKDUpO1xuICAgICAgICBpZiAoIXRoaXMucykge1xuICAgICAgICAgICAgaWYgKHRoaXMucCAmJiB0aGlzLnAubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmFyIG4gPSBuZXcgdTgodGhpcy5wLmxlbmd0aCArIGNodW5rLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgbi5zZXQodGhpcy5wKSwgbi5zZXQoY2h1bmssIHRoaXMucC5sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHRoaXMucCA9IGNodW5rO1xuICAgICAgICAgICAgaWYgKHRoaXMucC5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zID0gKHRoaXMucFswXSA9PSAzMSAmJiB0aGlzLnBbMV0gPT0gMTM5ICYmIHRoaXMucFsyXSA9PSA4KVxuICAgICAgICAgICAgICAgICAgICA/IG5ldyB0aGlzLkcodGhpcy5vKVxuICAgICAgICAgICAgICAgICAgICA6ICgodGhpcy5wWzBdICYgMTUpICE9IDggfHwgKHRoaXMucFswXSA+PiA0KSA+IDcgfHwgKCh0aGlzLnBbMF0gPDwgOCB8IHRoaXMucFsxXSkgJSAzMSkpXG4gICAgICAgICAgICAgICAgICAgICAgICA/IG5ldyB0aGlzLkkodGhpcy5vKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBuZXcgdGhpcy5aKHRoaXMubyk7XG4gICAgICAgICAgICAgICAgdGhpcy5pKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zLnB1c2godGhpcy5wLCBmaW5hbCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLnMucHVzaChjaHVuaywgZmluYWwpO1xuICAgIH07XG4gICAgcmV0dXJuIERlY29tcHJlc3M7XG59KCkpO1xuZXhwb3J0IHsgRGVjb21wcmVzcyB9O1xuLyoqXG4gKiBBc3luY2hyb25vdXMgc3RyZWFtaW5nIEdaSVAsIFpsaWIsIG9yIHJhdyBERUZMQVRFIGRlY29tcHJlc3Npb25cbiAqL1xudmFyIEFzeW5jRGVjb21wcmVzcyA9IC8qI19fUFVSRV9fKi8gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBBc3luY0RlY29tcHJlc3Mob3B0cywgY2IpIHtcbiAgICAgICAgRGVjb21wcmVzcy5jYWxsKHRoaXMsIG9wdHMsIGNiKTtcbiAgICAgICAgdGhpcy5xdWV1ZWRTaXplID0gMDtcbiAgICAgICAgdGhpcy5HID0gQXN5bmNHdW56aXA7XG4gICAgICAgIHRoaXMuSSA9IEFzeW5jSW5mbGF0ZTtcbiAgICAgICAgdGhpcy5aID0gQXN5bmNVbnpsaWI7XG4gICAgfVxuICAgIEFzeW5jRGVjb21wcmVzcy5wcm90b3R5cGUuaSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdGhpcy5zLm9uZGF0YSA9IGZ1bmN0aW9uIChlcnIsIGRhdCwgZmluYWwpIHtcbiAgICAgICAgICAgIF90aGlzLm9uZGF0YShlcnIsIGRhdCwgZmluYWwpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLnMub25kcmFpbiA9IGZ1bmN0aW9uIChzaXplKSB7XG4gICAgICAgICAgICBfdGhpcy5xdWV1ZWRTaXplIC09IHNpemU7XG4gICAgICAgICAgICBpZiAoX3RoaXMub25kcmFpbilcbiAgICAgICAgICAgICAgICBfdGhpcy5vbmRyYWluKHNpemUpO1xuICAgICAgICB9O1xuICAgIH07XG4gICAgLyoqXG4gICAgICogUHVzaGVzIGEgY2h1bmsgdG8gYmUgZGVjb21wcmVzc2VkXG4gICAgICogQHBhcmFtIGNodW5rIFRoZSBjaHVuayB0byBwdXNoXG4gICAgICogQHBhcmFtIGZpbmFsIFdoZXRoZXIgdGhpcyBpcyB0aGUgbGFzdCBjaHVua1xuICAgICAqL1xuICAgIEFzeW5jRGVjb21wcmVzcy5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjaHVuaywgZmluYWwpIHtcbiAgICAgICAgdGhpcy5xdWV1ZWRTaXplICs9IGNodW5rLmxlbmd0aDtcbiAgICAgICAgRGVjb21wcmVzcy5wcm90b3R5cGUucHVzaC5jYWxsKHRoaXMsIGNodW5rLCBmaW5hbCk7XG4gICAgfTtcbiAgICByZXR1cm4gQXN5bmNEZWNvbXByZXNzO1xufSgpKTtcbmV4cG9ydCB7IEFzeW5jRGVjb21wcmVzcyB9O1xuZXhwb3J0IGZ1bmN0aW9uIGRlY29tcHJlc3MoZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAoIWNiKVxuICAgICAgICBjYiA9IG9wdHMsIG9wdHMgPSB7fTtcbiAgICBpZiAodHlwZW9mIGNiICE9ICdmdW5jdGlvbicpXG4gICAgICAgIGVycig3KTtcbiAgICByZXR1cm4gKGRhdGFbMF0gPT0gMzEgJiYgZGF0YVsxXSA9PSAxMzkgJiYgZGF0YVsyXSA9PSA4KVxuICAgICAgICA/IGd1bnppcChkYXRhLCBvcHRzLCBjYilcbiAgICAgICAgOiAoKGRhdGFbMF0gJiAxNSkgIT0gOCB8fCAoZGF0YVswXSA+PiA0KSA+IDcgfHwgKChkYXRhWzBdIDw8IDggfCBkYXRhWzFdKSAlIDMxKSlcbiAgICAgICAgICAgID8gaW5mbGF0ZShkYXRhLCBvcHRzLCBjYilcbiAgICAgICAgICAgIDogdW56bGliKGRhdGEsIG9wdHMsIGNiKTtcbn1cbi8qKlxuICogRXhwYW5kcyBjb21wcmVzc2VkIEdaSVAsIFpsaWIsIG9yIHJhdyBERUZMQVRFIGRhdGEsIGF1dG9tYXRpY2FsbHkgZGV0ZWN0aW5nIHRoZSBmb3JtYXRcbiAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIHRvIGRlY29tcHJlc3NcbiAqIEBwYXJhbSBvcHRzIFRoZSBkZWNvbXByZXNzaW9uIG9wdGlvbnNcbiAqIEByZXR1cm5zIFRoZSBkZWNvbXByZXNzZWQgdmVyc2lvbiBvZiB0aGUgZGF0YVxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVjb21wcmVzc1N5bmMoZGF0YSwgb3B0cykge1xuICAgIHJldHVybiAoZGF0YVswXSA9PSAzMSAmJiBkYXRhWzFdID09IDEzOSAmJiBkYXRhWzJdID09IDgpXG4gICAgICAgID8gZ3VuemlwU3luYyhkYXRhLCBvcHRzKVxuICAgICAgICA6ICgoZGF0YVswXSAmIDE1KSAhPSA4IHx8IChkYXRhWzBdID4+IDQpID4gNyB8fCAoKGRhdGFbMF0gPDwgOCB8IGRhdGFbMV0pICUgMzEpKVxuICAgICAgICAgICAgPyBpbmZsYXRlU3luYyhkYXRhLCBvcHRzKVxuICAgICAgICAgICAgOiB1bnpsaWJTeW5jKGRhdGEsIG9wdHMpO1xufVxuLy8gZmxhdHRlbiBhIGRpcmVjdG9yeSBzdHJ1Y3R1cmVcbnZhciBmbHRuID0gZnVuY3Rpb24gKGQsIHAsIHQsIG8pIHtcbiAgICBmb3IgKHZhciBrIGluIGQpIHtcbiAgICAgICAgdmFyIHZhbCA9IGRba10sIG4gPSBwICsgaywgb3AgPSBvO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWwpKVxuICAgICAgICAgICAgb3AgPSBtcmcobywgdmFsWzFdKSwgdmFsID0gdmFsWzBdO1xuICAgICAgICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KHZhbCkpXG4gICAgICAgICAgICB0W25dID0gW3ZhbCwgb3BdO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRbbiArPSAnLyddID0gW25ldyB1OCgwKSwgb3BdO1xuICAgICAgICAgICAgZmx0bih2YWwsIG4sIHQsIG8pO1xuICAgICAgICB9XG4gICAgfVxufTtcbi8vIHRleHQgZW5jb2RlclxudmFyIHRlID0gdHlwZW9mIFRleHRFbmNvZGVyICE9ICd1bmRlZmluZWQnICYmIC8qI19fUFVSRV9fKi8gbmV3IFRleHRFbmNvZGVyKCk7XG4vLyB0ZXh0IGRlY29kZXJcbnZhciB0ZCA9IHR5cGVvZiBUZXh0RGVjb2RlciAhPSAndW5kZWZpbmVkJyAmJiAvKiNfX1BVUkVfXyovIG5ldyBUZXh0RGVjb2RlcigpO1xuLy8gdGV4dCBkZWNvZGVyIHN0cmVhbVxudmFyIHRkcyA9IDA7XG50cnkge1xuICAgIHRkLmRlY29kZShldCwgeyBzdHJlYW06IHRydWUgfSk7XG4gICAgdGRzID0gMTtcbn1cbmNhdGNoIChlKSB7IH1cbi8vIGRlY29kZSBVVEY4XG52YXIgZHV0ZjggPSBmdW5jdGlvbiAoZCkge1xuICAgIGZvciAodmFyIHIgPSAnJywgaSA9IDA7Oykge1xuICAgICAgICB2YXIgYyA9IGRbaSsrXTtcbiAgICAgICAgdmFyIGViID0gKGMgPiAxMjcpICsgKGMgPiAyMjMpICsgKGMgPiAyMzkpO1xuICAgICAgICBpZiAoaSArIGViID4gZC5sZW5ndGgpXG4gICAgICAgICAgICByZXR1cm4geyBzOiByLCByOiBzbGMoZCwgaSAtIDEpIH07XG4gICAgICAgIGlmICghZWIpXG4gICAgICAgICAgICByICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYyk7XG4gICAgICAgIGVsc2UgaWYgKGViID09IDMpIHtcbiAgICAgICAgICAgIGMgPSAoKGMgJiAxNSkgPDwgMTggfCAoZFtpKytdICYgNjMpIDw8IDEyIHwgKGRbaSsrXSAmIDYzKSA8PCA2IHwgKGRbaSsrXSAmIDYzKSkgLSA2NTUzNixcbiAgICAgICAgICAgICAgICByICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoNTUyOTYgfCAoYyA+PiAxMCksIDU2MzIwIHwgKGMgJiAxMDIzKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZWIgJiAxKVxuICAgICAgICAgICAgciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKChjICYgMzEpIDw8IDYgfCAoZFtpKytdICYgNjMpKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKChjICYgMTUpIDw8IDEyIHwgKGRbaSsrXSAmIDYzKSA8PCA2IHwgKGRbaSsrXSAmIDYzKSk7XG4gICAgfVxufTtcbi8qKlxuICogU3RyZWFtaW5nIFVURi04IGRlY29kaW5nXG4gKi9cbnZhciBEZWNvZGVVVEY4ID0gLyojX19QVVJFX18qLyAoZnVuY3Rpb24gKCkge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBVVEYtOCBkZWNvZGluZyBzdHJlYW1cbiAgICAgKiBAcGFyYW0gY2IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgd2hlbmV2ZXIgZGF0YSBpcyBkZWNvZGVkXG4gICAgICovXG4gICAgZnVuY3Rpb24gRGVjb2RlVVRGOChjYikge1xuICAgICAgICB0aGlzLm9uZGF0YSA9IGNiO1xuICAgICAgICBpZiAodGRzKVxuICAgICAgICAgICAgdGhpcy50ID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMucCA9IGV0O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBQdXNoZXMgYSBjaHVuayB0byBiZSBkZWNvZGVkIGZyb20gVVRGLTggYmluYXJ5XG4gICAgICogQHBhcmFtIGNodW5rIFRoZSBjaHVuayB0byBwdXNoXG4gICAgICogQHBhcmFtIGZpbmFsIFdoZXRoZXIgdGhpcyBpcyB0aGUgbGFzdCBjaHVua1xuICAgICAqL1xuICAgIERlY29kZVVURjgucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoY2h1bmssIGZpbmFsKSB7XG4gICAgICAgIGlmICghdGhpcy5vbmRhdGEpXG4gICAgICAgICAgICBlcnIoNSk7XG4gICAgICAgIGZpbmFsID0gISFmaW5hbDtcbiAgICAgICAgaWYgKHRoaXMudCkge1xuICAgICAgICAgICAgdGhpcy5vbmRhdGEodGhpcy50LmRlY29kZShjaHVuaywgeyBzdHJlYW06IHRydWUgfSksIGZpbmFsKTtcbiAgICAgICAgICAgIGlmIChmaW5hbCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnQuZGVjb2RlKCkubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICBlcnIoOCk7XG4gICAgICAgICAgICAgICAgdGhpcy50ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMucClcbiAgICAgICAgICAgIGVycig0KTtcbiAgICAgICAgdmFyIGRhdCA9IG5ldyB1OCh0aGlzLnAubGVuZ3RoICsgY2h1bmsubGVuZ3RoKTtcbiAgICAgICAgZGF0LnNldCh0aGlzLnApO1xuICAgICAgICBkYXQuc2V0KGNodW5rLCB0aGlzLnAubGVuZ3RoKTtcbiAgICAgICAgdmFyIF9hID0gZHV0ZjgoZGF0KSwgcyA9IF9hLnMsIHIgPSBfYS5yO1xuICAgICAgICBpZiAoZmluYWwpIHtcbiAgICAgICAgICAgIGlmIChyLmxlbmd0aClcbiAgICAgICAgICAgICAgICBlcnIoOCk7XG4gICAgICAgICAgICB0aGlzLnAgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMucCA9IHI7XG4gICAgICAgIHRoaXMub25kYXRhKHMsIGZpbmFsKTtcbiAgICB9O1xuICAgIHJldHVybiBEZWNvZGVVVEY4O1xufSgpKTtcbmV4cG9ydCB7IERlY29kZVVURjggfTtcbi8qKlxuICogU3RyZWFtaW5nIFVURi04IGVuY29kaW5nXG4gKi9cbnZhciBFbmNvZGVVVEY4ID0gLyojX19QVVJFX18qLyAoZnVuY3Rpb24gKCkge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBVVEYtOCBkZWNvZGluZyBzdHJlYW1cbiAgICAgKiBAcGFyYW0gY2IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgd2hlbmV2ZXIgZGF0YSBpcyBlbmNvZGVkXG4gICAgICovXG4gICAgZnVuY3Rpb24gRW5jb2RlVVRGOChjYikge1xuICAgICAgICB0aGlzLm9uZGF0YSA9IGNiO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBQdXNoZXMgYSBjaHVuayB0byBiZSBlbmNvZGVkIHRvIFVURi04XG4gICAgICogQHBhcmFtIGNodW5rIFRoZSBzdHJpbmcgZGF0YSB0byBwdXNoXG4gICAgICogQHBhcmFtIGZpbmFsIFdoZXRoZXIgdGhpcyBpcyB0aGUgbGFzdCBjaHVua1xuICAgICAqL1xuICAgIEVuY29kZVVURjgucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoY2h1bmssIGZpbmFsKSB7XG4gICAgICAgIGlmICghdGhpcy5vbmRhdGEpXG4gICAgICAgICAgICBlcnIoNSk7XG4gICAgICAgIGlmICh0aGlzLmQpXG4gICAgICAgICAgICBlcnIoNCk7XG4gICAgICAgIHRoaXMub25kYXRhKHN0clRvVTgoY2h1bmspLCB0aGlzLmQgPSBmaW5hbCB8fCBmYWxzZSk7XG4gICAgfTtcbiAgICByZXR1cm4gRW5jb2RlVVRGODtcbn0oKSk7XG5leHBvcnQgeyBFbmNvZGVVVEY4IH07XG4vKipcbiAqIENvbnZlcnRzIGEgc3RyaW5nIGludG8gYSBVaW50OEFycmF5IGZvciB1c2Ugd2l0aCBjb21wcmVzc2lvbi9kZWNvbXByZXNzaW9uIG1ldGhvZHNcbiAqIEBwYXJhbSBzdHIgVGhlIHN0cmluZyB0byBlbmNvZGVcbiAqIEBwYXJhbSBsYXRpbjEgV2hldGhlciBvciBub3QgdG8gaW50ZXJwcmV0IHRoZSBkYXRhIGFzIExhdGluLTEuIFRoaXMgc2hvdWxkXG4gKiAgICAgICAgICAgICAgIG5vdCBuZWVkIHRvIGJlIHRydWUgdW5sZXNzIGRlY29kaW5nIGEgYmluYXJ5IHN0cmluZy5cbiAqIEByZXR1cm5zIFRoZSBzdHJpbmcgZW5jb2RlZCBpbiBVVEYtOC9MYXRpbi0xIGJpbmFyeVxuICovXG5leHBvcnQgZnVuY3Rpb24gc3RyVG9VOChzdHIsIGxhdGluMSkge1xuICAgIGlmIChsYXRpbjEpIHtcbiAgICAgICAgdmFyIGFyXzEgPSBuZXcgdTgoc3RyLmxlbmd0aCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKVxuICAgICAgICAgICAgYXJfMVtpXSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgICAgICByZXR1cm4gYXJfMTtcbiAgICB9XG4gICAgaWYgKHRlKVxuICAgICAgICByZXR1cm4gdGUuZW5jb2RlKHN0cik7XG4gICAgdmFyIGwgPSBzdHIubGVuZ3RoO1xuICAgIHZhciBhciA9IG5ldyB1OChzdHIubGVuZ3RoICsgKHN0ci5sZW5ndGggPj4gMSkpO1xuICAgIHZhciBhaSA9IDA7XG4gICAgdmFyIHcgPSBmdW5jdGlvbiAodikgeyBhclthaSsrXSA9IHY7IH07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgaWYgKGFpICsgNSA+IGFyLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIG4gPSBuZXcgdTgoYWkgKyA4ICsgKChsIC0gaSkgPDwgMSkpO1xuICAgICAgICAgICAgbi5zZXQoYXIpO1xuICAgICAgICAgICAgYXIgPSBuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgIGlmIChjIDwgMTI4IHx8IGxhdGluMSlcbiAgICAgICAgICAgIHcoYyk7XG4gICAgICAgIGVsc2UgaWYgKGMgPCAyMDQ4KVxuICAgICAgICAgICAgdygxOTIgfCAoYyA+PiA2KSksIHcoMTI4IHwgKGMgJiA2MykpO1xuICAgICAgICBlbHNlIGlmIChjID4gNTUyOTUgJiYgYyA8IDU3MzQ0KVxuICAgICAgICAgICAgYyA9IDY1NTM2ICsgKGMgJiAxMDIzIDw8IDEwKSB8IChzdHIuY2hhckNvZGVBdCgrK2kpICYgMTAyMyksXG4gICAgICAgICAgICAgICAgdygyNDAgfCAoYyA+PiAxOCkpLCB3KDEyOCB8ICgoYyA+PiAxMikgJiA2MykpLCB3KDEyOCB8ICgoYyA+PiA2KSAmIDYzKSksIHcoMTI4IHwgKGMgJiA2MykpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB3KDIyNCB8IChjID4+IDEyKSksIHcoMTI4IHwgKChjID4+IDYpICYgNjMpKSwgdygxMjggfCAoYyAmIDYzKSk7XG4gICAgfVxuICAgIHJldHVybiBzbGMoYXIsIDAsIGFpKTtcbn1cbi8qKlxuICogQ29udmVydHMgYSBVaW50OEFycmF5IHRvIGEgc3RyaW5nXG4gKiBAcGFyYW0gZGF0IFRoZSBkYXRhIHRvIGRlY29kZSB0byBzdHJpbmdcbiAqIEBwYXJhbSBsYXRpbjEgV2hldGhlciBvciBub3QgdG8gaW50ZXJwcmV0IHRoZSBkYXRhIGFzIExhdGluLTEuIFRoaXMgc2hvdWxkXG4gKiAgICAgICAgICAgICAgIG5vdCBuZWVkIHRvIGJlIHRydWUgdW5sZXNzIGVuY29kaW5nIHRvIGJpbmFyeSBzdHJpbmcuXG4gKiBAcmV0dXJucyBUaGUgb3JpZ2luYWwgVVRGLTgvTGF0aW4tMSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0ckZyb21VOChkYXQsIGxhdGluMSkge1xuICAgIGlmIChsYXRpbjEpIHtcbiAgICAgICAgdmFyIHIgPSAnJztcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXQubGVuZ3RoOyBpICs9IDE2Mzg0KVxuICAgICAgICAgICAgciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIGRhdC5zdWJhcnJheShpLCBpICsgMTYzODQpKTtcbiAgICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICAgIGVsc2UgaWYgKHRkKSB7XG4gICAgICAgIHJldHVybiB0ZC5kZWNvZGUoZGF0KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciBfYSA9IGR1dGY4KGRhdCksIHMgPSBfYS5zLCByID0gX2EucjtcbiAgICAgICAgaWYgKHIubGVuZ3RoKVxuICAgICAgICAgICAgZXJyKDgpO1xuICAgICAgICByZXR1cm4gcztcbiAgICB9XG59XG47XG4vLyBkZWZsYXRlIGJpdCBmbGFnXG52YXIgZGJmID0gZnVuY3Rpb24gKGwpIHsgcmV0dXJuIGwgPT0gMSA/IDMgOiBsIDwgNiA/IDIgOiBsID09IDkgPyAxIDogMDsgfTtcbi8vIHNraXAgbG9jYWwgemlwIGhlYWRlclxudmFyIHNsemggPSBmdW5jdGlvbiAoZCwgYikgeyByZXR1cm4gYiArIDMwICsgYjIoZCwgYiArIDI2KSArIGIyKGQsIGIgKyAyOCk7IH07XG4vLyByZWFkIHppcCBoZWFkZXJcbnZhciB6aCA9IGZ1bmN0aW9uIChkLCBiLCB6KSB7XG4gICAgdmFyIGZubCA9IGIyKGQsIGIgKyAyOCksIGVmbCA9IGIyKGQsIGIgKyAzMCksIGZuID0gc3RyRnJvbVU4KGQuc3ViYXJyYXkoYiArIDQ2LCBiICsgNDYgKyBmbmwpLCAhKGIyKGQsIGIgKyA4KSAmIDIwNDgpKSwgZXMgPSBiICsgNDYgKyBmbmw7XG4gICAgdmFyIF9hID0gejY0aHMoZCwgZXMsIGVmbCwgeiwgYjQoZCwgYiArIDIwKSwgYjQoZCwgYiArIDI0KSwgYjQoZCwgYiArIDQyKSksIHNjID0gX2FbMF0sIHN1ID0gX2FbMV0sIG9mZiA9IF9hWzJdO1xuICAgIHJldHVybiBbYjIoZCwgYiArIDEwKSwgc2MsIHN1LCBmbiwgZXMgKyBlZmwgKyBiMihkLCBiICsgMzIpLCBvZmZdO1xufTtcbi8vIHJlYWQgemlwNjQgaGVhZGVyIHNpemVzXG52YXIgejY0aHMgPSBmdW5jdGlvbiAoZCwgYiwgbCwgeiwgc2MsIHN1LCBvZmYpIHtcbiAgICB2YXIgbnNjID0gc2MgPT0gNDI5NDk2NzI5NSwgbnN1ID0gc3UgPT0gNDI5NDk2NzI5NSwgbm9mZiA9IG9mZiA9PSA0Mjk0OTY3Mjk1LCBlID0gYiArIGw7XG4gICAgdmFyIG5mID0gbnNjICsgbnN1ICsgbm9mZjtcbiAgICBpZiAoeiAmJiBuZikge1xuICAgICAgICBmb3IgKDsgYiArIDQgPCBlOyBiICs9IDQgKyBiMihkLCBiICsgMikpIHtcbiAgICAgICAgICAgIGlmIChiMihkLCBiKSA9PSAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICAgICAgbnNjID8gYjgoZCwgYiArIDQgKyA4ICogbnN1KSA6IHNjLFxuICAgICAgICAgICAgICAgICAgICBuc3UgPyBiOChkLCBiICsgNCkgOiBzdSxcbiAgICAgICAgICAgICAgICAgICAgbm9mZiA/IGI4KGQsIGIgKyA0ICsgOCAqIChuc3UgKyBuc2MpKSA6IG9mZixcbiAgICAgICAgICAgICAgICAgICAgMVxuICAgICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8geiA9PSAyIGZvciB1bmtub3duIHdoZXRoZXIgb3Igbm90IHppcDY0XG4gICAgICAgIGlmICh6IDwgMilcbiAgICAgICAgICAgIGVycigxMyk7XG4gICAgfVxuICAgIHJldHVybiBbc2MsIHN1LCBvZmYsIDBdO1xufTtcbi8vIGV4dHJhIGZpZWxkIGxlbmd0aFxudmFyIGV4ZmwgPSBmdW5jdGlvbiAoZXgpIHtcbiAgICB2YXIgbGUgPSAwO1xuICAgIGlmIChleCkge1xuICAgICAgICBmb3IgKHZhciBrIGluIGV4KSB7XG4gICAgICAgICAgICB2YXIgbCA9IGV4W2tdLmxlbmd0aDtcbiAgICAgICAgICAgIGlmIChsID4gNjU1MzUpXG4gICAgICAgICAgICAgICAgZXJyKDkpO1xuICAgICAgICAgICAgbGUgKz0gbCArIDQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGxlO1xufTtcbi8vIHdyaXRlIHppcCBoZWFkZXJcbnZhciB3emggPSBmdW5jdGlvbiAoZCwgYiwgZiwgZm4sIHUsIGMsIGNlLCBjbykge1xuICAgIHZhciBmbCA9IGZuLmxlbmd0aCwgZXggPSBmLmV4dHJhLCBjb2wgPSBjbyAmJiBjby5sZW5ndGg7XG4gICAgdmFyIGV4bCA9IGV4ZmwoZXgpO1xuICAgIHdieXRlcyhkLCBiLCBjZSAhPSBudWxsID8gMHgyMDE0QjUwIDogMHg0MDM0QjUwKSwgYiArPSA0O1xuICAgIGlmIChjZSAhPSBudWxsKVxuICAgICAgICBkW2IrK10gPSAyMCwgZFtiKytdID0gZi5vcztcbiAgICBkW2JdID0gMjAsIGIgKz0gMjsgLy8gc3BlYyBjb21wbGlhbmNlPyB3aGF0J3MgdGhhdD9cbiAgICBkW2IrK10gPSAoZi5mbGFnIDw8IDEpIHwgKGMgPCAwICYmIDgpLCBkW2IrK10gPSB1ICYmIDg7XG4gICAgZFtiKytdID0gZi5jb21wcmVzc2lvbiAmIDI1NSwgZFtiKytdID0gZi5jb21wcmVzc2lvbiA+PiA4O1xuICAgIHZhciBkdCA9IG5ldyBEYXRlKGYubXRpbWUgPT0gbnVsbCA/IERhdGUubm93KCkgOiBmLm10aW1lKSwgeSA9IGR0LmdldEZ1bGxZZWFyKCkgLSAxOTgwO1xuICAgIGlmICh5IDwgMCB8fCB5ID4gMTE5KVxuICAgICAgICBlcnIoMTApO1xuICAgIHdieXRlcyhkLCBiLCAoeSA8PCAyNSkgfCAoKGR0LmdldE1vbnRoKCkgKyAxKSA8PCAyMSkgfCAoZHQuZ2V0RGF0ZSgpIDw8IDE2KSB8IChkdC5nZXRIb3VycygpIDw8IDExKSB8IChkdC5nZXRNaW51dGVzKCkgPDwgNSkgfCAoZHQuZ2V0U2Vjb25kcygpID4+IDEpKSwgYiArPSA0O1xuICAgIGlmIChjICE9IC0xKSB7XG4gICAgICAgIHdieXRlcyhkLCBiLCBmLmNyYyk7XG4gICAgICAgIHdieXRlcyhkLCBiICsgNCwgYyA8IDAgPyAtYyAtIDIgOiBjKTtcbiAgICAgICAgd2J5dGVzKGQsIGIgKyA4LCBmLnNpemUpO1xuICAgIH1cbiAgICB3Ynl0ZXMoZCwgYiArIDEyLCBmbCk7XG4gICAgd2J5dGVzKGQsIGIgKyAxNCwgZXhsKSwgYiArPSAxNjtcbiAgICBpZiAoY2UgIT0gbnVsbCkge1xuICAgICAgICB3Ynl0ZXMoZCwgYiwgY29sKTtcbiAgICAgICAgd2J5dGVzKGQsIGIgKyA2LCBmLmF0dHJzKTtcbiAgICAgICAgd2J5dGVzKGQsIGIgKyAxMCwgY2UpLCBiICs9IDE0O1xuICAgIH1cbiAgICBkLnNldChmbiwgYik7XG4gICAgYiArPSBmbDtcbiAgICBpZiAoZXhsKSB7XG4gICAgICAgIGZvciAodmFyIGsgaW4gZXgpIHtcbiAgICAgICAgICAgIHZhciBleGYgPSBleFtrXSwgbCA9IGV4Zi5sZW5ndGg7XG4gICAgICAgICAgICB3Ynl0ZXMoZCwgYiwgK2spO1xuICAgICAgICAgICAgd2J5dGVzKGQsIGIgKyAyLCBsKTtcbiAgICAgICAgICAgIGQuc2V0KGV4ZiwgYiArIDQpLCBiICs9IDQgKyBsO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChjb2wpXG4gICAgICAgIGQuc2V0KGNvLCBiKSwgYiArPSBjb2w7XG4gICAgcmV0dXJuIGI7XG59O1xuLy8gd3JpdGUgemlwIGZvb3RlciAoZW5kIG9mIGNlbnRyYWwgZGlyZWN0b3J5KVxudmFyIHd6ZiA9IGZ1bmN0aW9uIChvLCBiLCBjLCBkLCBlKSB7XG4gICAgd2J5dGVzKG8sIGIsIDB4NjA1NEI1MCk7IC8vIHNraXAgZGlza1xuICAgIHdieXRlcyhvLCBiICsgOCwgYyk7XG4gICAgd2J5dGVzKG8sIGIgKyAxMCwgYyk7XG4gICAgd2J5dGVzKG8sIGIgKyAxMiwgZCk7XG4gICAgd2J5dGVzKG8sIGIgKyAxNiwgZSk7XG59O1xuLyoqXG4gKiBBIHBhc3MtdGhyb3VnaCBzdHJlYW0gdG8ga2VlcCBkYXRhIHVuY29tcHJlc3NlZCBpbiBhIFpJUCBhcmNoaXZlLlxuICovXG52YXIgWmlwUGFzc1Rocm91Z2ggPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHBhc3MtdGhyb3VnaCBzdHJlYW0gdGhhdCBjYW4gYmUgYWRkZWQgdG8gWklQIGFyY2hpdmVzXG4gICAgICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmaWxlbmFtZSB0byBhc3NvY2lhdGUgd2l0aCB0aGlzIGRhdGEgc3RyZWFtXG4gICAgICovXG4gICAgZnVuY3Rpb24gWmlwUGFzc1Rocm91Z2goZmlsZW5hbWUpIHtcbiAgICAgICAgdGhpcy5maWxlbmFtZSA9IGZpbGVuYW1lO1xuICAgICAgICB0aGlzLmMgPSBjcmMoKTtcbiAgICAgICAgdGhpcy5zaXplID0gMDtcbiAgICAgICAgdGhpcy5jb21wcmVzc2lvbiA9IDA7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFByb2Nlc3NlcyBhIGNodW5rIGFuZCBwdXNoZXMgdG8gdGhlIG91dHB1dCBzdHJlYW0uIFlvdSBjYW4gb3ZlcnJpZGUgdGhpc1xuICAgICAqIG1ldGhvZCBpbiBhIHN1YmNsYXNzIGZvciBjdXN0b20gYmVoYXZpb3IsIGJ1dCBieSBkZWZhdWx0IHRoaXMgcGFzc2VzXG4gICAgICogdGhlIGRhdGEgdGhyb3VnaC4gWW91IG11c3QgY2FsbCB0aGlzLm9uZGF0YShlcnIsIGNodW5rLCBmaW5hbCkgYXQgc29tZVxuICAgICAqIHBvaW50IGluIHRoaXMgbWV0aG9kLlxuICAgICAqIEBwYXJhbSBjaHVuayBUaGUgY2h1bmsgdG8gcHJvY2Vzc1xuICAgICAqIEBwYXJhbSBmaW5hbCBXaGV0aGVyIHRoaXMgaXMgdGhlIGxhc3QgY2h1bmtcbiAgICAgKi9cbiAgICBaaXBQYXNzVGhyb3VnaC5wcm90b3R5cGUucHJvY2VzcyA9IGZ1bmN0aW9uIChjaHVuaywgZmluYWwpIHtcbiAgICAgICAgdGhpcy5vbmRhdGEobnVsbCwgY2h1bmssIGZpbmFsKTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIFB1c2hlcyBhIGNodW5rIHRvIGJlIGFkZGVkLiBJZiB5b3UgYXJlIHN1YmNsYXNzaW5nIHRoaXMgd2l0aCBhIGN1c3RvbVxuICAgICAqIGNvbXByZXNzaW9uIGFsZ29yaXRobSwgbm90ZSB0aGF0IHlvdSBtdXN0IHB1c2ggZGF0YSBmcm9tIHRoZSBzb3VyY2VcbiAgICAgKiBmaWxlIG9ubHksIHByZS1jb21wcmVzc2lvbi5cbiAgICAgKiBAcGFyYW0gY2h1bmsgVGhlIGNodW5rIHRvIHB1c2hcbiAgICAgKiBAcGFyYW0gZmluYWwgV2hldGhlciB0aGlzIGlzIHRoZSBsYXN0IGNodW5rXG4gICAgICovXG4gICAgWmlwUGFzc1Rocm91Z2gucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoY2h1bmssIGZpbmFsKSB7XG4gICAgICAgIGlmICghdGhpcy5vbmRhdGEpXG4gICAgICAgICAgICBlcnIoNSk7XG4gICAgICAgIHRoaXMuYy5wKGNodW5rKTtcbiAgICAgICAgdGhpcy5zaXplICs9IGNodW5rLmxlbmd0aDtcbiAgICAgICAgaWYgKGZpbmFsKVxuICAgICAgICAgICAgdGhpcy5jcmMgPSB0aGlzLmMuZCgpO1xuICAgICAgICAvLyB3ZSBzaG91bGRuJ3QgcmVhbGx5IGRvIHRoaXMgY2FzdCwgYnV0IHByb3Blcmx5IGhhbmRsaW5nIEFycmF5QnVmZmVyTGlrZVxuICAgICAgICAvLyBtYWtlcyB0aGUgQVBJIHVuZXJnb25vbWljIHdpdGggQnVmZmVyXG4gICAgICAgIHRoaXMucHJvY2VzcyhjaHVuaywgZmluYWwgfHwgZmFsc2UpO1xuICAgIH07XG4gICAgcmV0dXJuIFppcFBhc3NUaHJvdWdoO1xufSgpKTtcbmV4cG9ydCB7IFppcFBhc3NUaHJvdWdoIH07XG4vLyBJIGRvbid0IGV4dGVuZCBiZWNhdXNlIFR5cGVTY3JpcHQgZXh0ZW5zaW9uIGFkZHMgMWtCIG9mIHJ1bnRpbWUgYmxvYXRcbi8qKlxuICogU3RyZWFtaW5nIERFRkxBVEUgY29tcHJlc3Npb24gZm9yIFpJUCBhcmNoaXZlcy4gUHJlZmVyIHVzaW5nIEFzeW5jWmlwRGVmbGF0ZVxuICogZm9yIGJldHRlciBwZXJmb3JtYW5jZVxuICovXG52YXIgWmlwRGVmbGF0ZSA9IC8qI19fUFVSRV9fKi8gKGZ1bmN0aW9uICgpIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgREVGTEFURSBzdHJlYW0gdGhhdCBjYW4gYmUgYWRkZWQgdG8gWklQIGFyY2hpdmVzXG4gICAgICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmaWxlbmFtZSB0byBhc3NvY2lhdGUgd2l0aCB0aGlzIGRhdGEgc3RyZWFtXG4gICAgICogQHBhcmFtIG9wdHMgVGhlIGNvbXByZXNzaW9uIG9wdGlvbnNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBaaXBEZWZsYXRlKGZpbGVuYW1lLCBvcHRzKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGlmICghb3B0cylcbiAgICAgICAgICAgIG9wdHMgPSB7fTtcbiAgICAgICAgWmlwUGFzc1Rocm91Z2guY2FsbCh0aGlzLCBmaWxlbmFtZSk7XG4gICAgICAgIHRoaXMuZCA9IG5ldyBEZWZsYXRlKG9wdHMsIGZ1bmN0aW9uIChkYXQsIGZpbmFsKSB7XG4gICAgICAgICAgICBfdGhpcy5vbmRhdGEobnVsbCwgZGF0LCBmaW5hbCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmNvbXByZXNzaW9uID0gODtcbiAgICAgICAgdGhpcy5mbGFnID0gZGJmKG9wdHMubGV2ZWwpO1xuICAgIH1cbiAgICBaaXBEZWZsYXRlLnByb3RvdHlwZS5wcm9jZXNzID0gZnVuY3Rpb24gKGNodW5rLCBmaW5hbCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5kLnB1c2goY2h1bmssIGZpbmFsKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5vbmRhdGEoZSwgbnVsbCwgZmluYWwpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBQdXNoZXMgYSBjaHVuayB0byBiZSBkZWZsYXRlZFxuICAgICAqIEBwYXJhbSBjaHVuayBUaGUgY2h1bmsgdG8gcHVzaFxuICAgICAqIEBwYXJhbSBmaW5hbCBXaGV0aGVyIHRoaXMgaXMgdGhlIGxhc3QgY2h1bmtcbiAgICAgKi9cbiAgICBaaXBEZWZsYXRlLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKGNodW5rLCBmaW5hbCkge1xuICAgICAgICBaaXBQYXNzVGhyb3VnaC5wcm90b3R5cGUucHVzaC5jYWxsKHRoaXMsIGNodW5rLCBmaW5hbCk7XG4gICAgfTtcbiAgICByZXR1cm4gWmlwRGVmbGF0ZTtcbn0oKSk7XG5leHBvcnQgeyBaaXBEZWZsYXRlIH07XG4vKipcbiAqIEFzeW5jaHJvbm91cyBzdHJlYW1pbmcgREVGTEFURSBjb21wcmVzc2lvbiBmb3IgWklQIGFyY2hpdmVzXG4gKi9cbnZhciBBc3luY1ppcERlZmxhdGUgPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBhc3luY2hyb25vdXMgREVGTEFURSBzdHJlYW0gdGhhdCBjYW4gYmUgYWRkZWQgdG8gWklQIGFyY2hpdmVzXG4gICAgICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmaWxlbmFtZSB0byBhc3NvY2lhdGUgd2l0aCB0aGlzIGRhdGEgc3RyZWFtXG4gICAgICogQHBhcmFtIG9wdHMgVGhlIGNvbXByZXNzaW9uIG9wdGlvbnNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBBc3luY1ppcERlZmxhdGUoZmlsZW5hbWUsIG9wdHMpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgaWYgKCFvcHRzKVxuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICBaaXBQYXNzVGhyb3VnaC5jYWxsKHRoaXMsIGZpbGVuYW1lKTtcbiAgICAgICAgdGhpcy5kID0gbmV3IEFzeW5jRGVmbGF0ZShvcHRzLCBmdW5jdGlvbiAoZXJyLCBkYXQsIGZpbmFsKSB7XG4gICAgICAgICAgICBfdGhpcy5vbmRhdGEoZXJyLCBkYXQsIGZpbmFsKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29tcHJlc3Npb24gPSA4O1xuICAgICAgICB0aGlzLmZsYWcgPSBkYmYob3B0cy5sZXZlbCk7XG4gICAgICAgIHRoaXMudGVybWluYXRlID0gdGhpcy5kLnRlcm1pbmF0ZTtcbiAgICB9XG4gICAgQXN5bmNaaXBEZWZsYXRlLnByb3RvdHlwZS5wcm9jZXNzID0gZnVuY3Rpb24gKGNodW5rLCBmaW5hbCkge1xuICAgICAgICB0aGlzLmQucHVzaChjaHVuaywgZmluYWwpO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogUHVzaGVzIGEgY2h1bmsgdG8gYmUgZGVmbGF0ZWRcbiAgICAgKiBAcGFyYW0gY2h1bmsgVGhlIGNodW5rIHRvIHB1c2hcbiAgICAgKiBAcGFyYW0gZmluYWwgV2hldGhlciB0aGlzIGlzIHRoZSBsYXN0IGNodW5rXG4gICAgICovXG4gICAgQXN5bmNaaXBEZWZsYXRlLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKGNodW5rLCBmaW5hbCkge1xuICAgICAgICBaaXBQYXNzVGhyb3VnaC5wcm90b3R5cGUucHVzaC5jYWxsKHRoaXMsIGNodW5rLCBmaW5hbCk7XG4gICAgfTtcbiAgICByZXR1cm4gQXN5bmNaaXBEZWZsYXRlO1xufSgpKTtcbmV4cG9ydCB7IEFzeW5jWmlwRGVmbGF0ZSB9O1xuLy8gVE9ETzogQmV0dGVyIHRyZWUgc2hha2luZ1xuLyoqXG4gKiBBIHppcHBhYmxlIGFyY2hpdmUgdG8gd2hpY2ggZmlsZXMgY2FuIGluY3JlbWVudGFsbHkgYmUgYWRkZWRcbiAqL1xudmFyIFppcCA9IC8qI19fUFVSRV9fKi8gKGZ1bmN0aW9uICgpIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGVtcHR5IFpJUCBhcmNoaXZlIHRvIHdoaWNoIGZpbGVzIGNhbiBiZSBhZGRlZFxuICAgICAqIEBwYXJhbSBjYiBUaGUgY2FsbGJhY2sgdG8gY2FsbCB3aGVuZXZlciBkYXRhIGZvciB0aGUgZ2VuZXJhdGVkIFpJUCBhcmNoaXZlXG4gICAgICogICAgICAgICAgIGlzIGF2YWlsYWJsZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFppcChjYikge1xuICAgICAgICB0aGlzLm9uZGF0YSA9IGNiO1xuICAgICAgICB0aGlzLnUgPSBbXTtcbiAgICAgICAgdGhpcy5kID0gMTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQWRkcyBhIGZpbGUgdG8gdGhlIFpJUCBhcmNoaXZlXG4gICAgICogQHBhcmFtIGZpbGUgVGhlIGZpbGUgc3RyZWFtIHRvIGFkZFxuICAgICAqL1xuICAgIFppcC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKGZpbGUpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgaWYgKCF0aGlzLm9uZGF0YSlcbiAgICAgICAgICAgIGVycig1KTtcbiAgICAgICAgLy8gZmluaXNoaW5nIG9yIGZpbmlzaGVkXG4gICAgICAgIGlmICh0aGlzLmQgJiAyKVxuICAgICAgICAgICAgdGhpcy5vbmRhdGEoZXJyKDQgKyAodGhpcy5kICYgMSkgKiA4LCAwLCAxKSwgbnVsbCwgZmFsc2UpO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBmID0gc3RyVG9VOChmaWxlLmZpbGVuYW1lKSwgZmxfMSA9IGYubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIGNvbSA9IGZpbGUuY29tbWVudCwgbyA9IGNvbSAmJiBzdHJUb1U4KGNvbSk7XG4gICAgICAgICAgICB2YXIgdSA9IGZsXzEgIT0gZmlsZS5maWxlbmFtZS5sZW5ndGggfHwgKG8gJiYgKGNvbS5sZW5ndGggIT0gby5sZW5ndGgpKTtcbiAgICAgICAgICAgIHZhciBobF8xID0gZmxfMSArIGV4ZmwoZmlsZS5leHRyYSkgKyAzMDtcbiAgICAgICAgICAgIGlmIChmbF8xID4gNjU1MzUpXG4gICAgICAgICAgICAgICAgdGhpcy5vbmRhdGEoZXJyKDExLCAwLCAxKSwgbnVsbCwgZmFsc2UpO1xuICAgICAgICAgICAgdmFyIGhlYWRlciA9IG5ldyB1OChobF8xKTtcbiAgICAgICAgICAgIHd6aChoZWFkZXIsIDAsIGZpbGUsIGYsIHUsIC0xKTtcbiAgICAgICAgICAgIHZhciBjaGtzXzEgPSBbaGVhZGVyXTtcbiAgICAgICAgICAgIHZhciBwQWxsXzEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBjaGtzXzIgPSBjaGtzXzE7IF9pIDwgY2hrc18yLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2hrID0gY2hrc18yW19pXTtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMub25kYXRhKG51bGwsIGNoaywgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjaGtzXzEgPSBbXTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgdHJfMSA9IHRoaXMuZDtcbiAgICAgICAgICAgIHRoaXMuZCA9IDA7XG4gICAgICAgICAgICB2YXIgaW5kXzEgPSB0aGlzLnUubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIHVmXzEgPSBtcmcoZmlsZSwge1xuICAgICAgICAgICAgICAgIGY6IGYsXG4gICAgICAgICAgICAgICAgdTogdSxcbiAgICAgICAgICAgICAgICBvOiBvLFxuICAgICAgICAgICAgICAgIHQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGUudGVybWluYXRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS50ZXJtaW5hdGUoKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcEFsbF8xKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0cl8xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbnh0ID0gX3RoaXMudVtpbmRfMSArIDFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG54dClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBueHQucigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLmQgPSAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRyXzEgPSAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIGNsXzEgPSAwO1xuICAgICAgICAgICAgZmlsZS5vbmRhdGEgPSBmdW5jdGlvbiAoZXJyLCBkYXQsIGZpbmFsKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5vbmRhdGEoZXJyLCBkYXQsIGZpbmFsKTtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMudGVybWluYXRlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjbF8xICs9IGRhdC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIGNoa3NfMS5wdXNoKGRhdCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaW5hbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRkID0gbmV3IHU4KDE2KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdieXRlcyhkZCwgMCwgMHg4MDc0QjUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdieXRlcyhkZCwgNCwgZmlsZS5jcmMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgd2J5dGVzKGRkLCA4LCBjbF8xKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdieXRlcyhkZCwgMTIsIGZpbGUuc2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGtzXzEucHVzaChkZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB1Zl8xLmMgPSBjbF8xLCB1Zl8xLmIgPSBobF8xICsgY2xfMSArIDE2LCB1Zl8xLmNyYyA9IGZpbGUuY3JjLCB1Zl8xLnNpemUgPSBmaWxlLnNpemU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHJfMSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1Zl8xLnIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyXzEgPSAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRyXzEpXG4gICAgICAgICAgICAgICAgICAgICAgICBwQWxsXzEoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy51LnB1c2godWZfMSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEVuZHMgdGhlIHByb2Nlc3Mgb2YgYWRkaW5nIGZpbGVzIGFuZCBwcmVwYXJlcyB0byBlbWl0IHRoZSBmaW5hbCBjaHVua3MuXG4gICAgICogVGhpcyAqbXVzdCogYmUgY2FsbGVkIGFmdGVyIGFkZGluZyBhbGwgZGVzaXJlZCBmaWxlcyBmb3IgdGhlIHJlc3VsdGluZ1xuICAgICAqIFpJUCBmaWxlIHRvIHdvcmsgcHJvcGVybHkuXG4gICAgICovXG4gICAgWmlwLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGlmICh0aGlzLmQgJiAyKSB7XG4gICAgICAgICAgICB0aGlzLm9uZGF0YShlcnIoNCArICh0aGlzLmQgJiAxKSAqIDgsIDAsIDEpLCBudWxsLCB0cnVlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5kKVxuICAgICAgICAgICAgdGhpcy5lKCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMudS5wdXNoKHtcbiAgICAgICAgICAgICAgICByOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghKF90aGlzLmQgJiAxKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMudS5zcGxpY2UoLTEsIDEpO1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5lKCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB0OiBmdW5jdGlvbiAoKSB7IH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB0aGlzLmQgPSAzO1xuICAgIH07XG4gICAgWmlwLnByb3RvdHlwZS5lID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYnQgPSAwLCBsID0gMCwgdGwgPSAwO1xuICAgICAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0gdGhpcy51OyBfaSA8IF9hLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgdmFyIGYgPSBfYVtfaV07XG4gICAgICAgICAgICB0bCArPSA0NiArIGYuZi5sZW5ndGggKyBleGZsKGYuZXh0cmEpICsgKGYubyA/IGYuby5sZW5ndGggOiAwKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgb3V0ID0gbmV3IHU4KHRsICsgMjIpO1xuICAgICAgICBmb3IgKHZhciBfYiA9IDAsIF9jID0gdGhpcy51OyBfYiA8IF9jLmxlbmd0aDsgX2IrKykge1xuICAgICAgICAgICAgdmFyIGYgPSBfY1tfYl07XG4gICAgICAgICAgICB3emgob3V0LCBidCwgZiwgZi5mLCBmLnUsIC1mLmMgLSAyLCBsLCBmLm8pO1xuICAgICAgICAgICAgYnQgKz0gNDYgKyBmLmYubGVuZ3RoICsgZXhmbChmLmV4dHJhKSArIChmLm8gPyBmLm8ubGVuZ3RoIDogMCksIGwgKz0gZi5iO1xuICAgICAgICB9XG4gICAgICAgIHd6ZihvdXQsIGJ0LCB0aGlzLnUubGVuZ3RoLCB0bCwgbCk7XG4gICAgICAgIHRoaXMub25kYXRhKG51bGwsIG91dCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuZCA9IDI7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBBIG1ldGhvZCB0byB0ZXJtaW5hdGUgYW55IGludGVybmFsIHdvcmtlcnMgdXNlZCBieSB0aGUgc3RyZWFtLiBTdWJzZXF1ZW50XG4gICAgICogY2FsbHMgdG8gYWRkKCkgd2lsbCBmYWlsLlxuICAgICAqL1xuICAgIFppcC5wcm90b3R5cGUudGVybWluYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0gdGhpcy51OyBfaSA8IF9hLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgdmFyIGYgPSBfYVtfaV07XG4gICAgICAgICAgICBmLnQoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmQgPSAyO1xuICAgIH07XG4gICAgcmV0dXJuIFppcDtcbn0oKSk7XG5leHBvcnQgeyBaaXAgfTtcbmV4cG9ydCBmdW5jdGlvbiB6aXAoZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAoIWNiKVxuICAgICAgICBjYiA9IG9wdHMsIG9wdHMgPSB7fTtcbiAgICBpZiAodHlwZW9mIGNiICE9ICdmdW5jdGlvbicpXG4gICAgICAgIGVycig3KTtcbiAgICB2YXIgciA9IHt9O1xuICAgIGZsdG4oZGF0YSwgJycsIHIsIG9wdHMpO1xuICAgIHZhciBrID0gT2JqZWN0LmtleXMocik7XG4gICAgdmFyIGxmdCA9IGsubGVuZ3RoLCBvID0gMCwgdG90ID0gMDtcbiAgICB2YXIgc2xmdCA9IGxmdCwgZmlsZXMgPSBuZXcgQXJyYXkobGZ0KTtcbiAgICB2YXIgdGVybSA9IFtdO1xuICAgIHZhciB0QWxsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRlcm0ubGVuZ3RoOyArK2kpXG4gICAgICAgICAgICB0ZXJtW2ldKCk7XG4gICAgfTtcbiAgICB2YXIgY2JkID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgbXQoZnVuY3Rpb24gKCkgeyBjYihhLCBiKTsgfSk7XG4gICAgfTtcbiAgICBtdChmdW5jdGlvbiAoKSB7IGNiZCA9IGNiOyB9KTtcbiAgICB2YXIgY2JmID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgb3V0ID0gbmV3IHU4KHRvdCArIDIyKSwgb2UgPSBvLCBjZGwgPSB0b3QgLSBvO1xuICAgICAgICB0b3QgPSAwO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsZnQ7ICsraSkge1xuICAgICAgICAgICAgdmFyIGYgPSBmaWxlc1tpXTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdmFyIGwgPSBmLmMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHd6aChvdXQsIHRvdCwgZiwgZi5mLCBmLnUsIGwpO1xuICAgICAgICAgICAgICAgIHZhciBiYWRkID0gMzAgKyBmLmYubGVuZ3RoICsgZXhmbChmLmV4dHJhKTtcbiAgICAgICAgICAgICAgICB2YXIgbG9jID0gdG90ICsgYmFkZDtcbiAgICAgICAgICAgICAgICBvdXQuc2V0KGYuYywgbG9jKTtcbiAgICAgICAgICAgICAgICB3emgob3V0LCBvLCBmLCBmLmYsIGYudSwgbCwgdG90LCBmLm0pLCBvICs9IDE2ICsgYmFkZCArIChmLm0gPyBmLm0ubGVuZ3RoIDogMCksIHRvdCA9IGxvYyArIGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYmQoZSwgbnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgd3pmKG91dCwgbywgZmlsZXMubGVuZ3RoLCBjZGwsIG9lKTtcbiAgICAgICAgY2JkKG51bGwsIG91dCk7XG4gICAgfTtcbiAgICBpZiAoIWxmdClcbiAgICAgICAgY2JmKCk7XG4gICAgdmFyIF9sb29wXzEgPSBmdW5jdGlvbiAoaSkge1xuICAgICAgICB2YXIgZm4gPSBrW2ldO1xuICAgICAgICB2YXIgX2EgPSByW2ZuXSwgZmlsZSA9IF9hWzBdLCBwID0gX2FbMV07XG4gICAgICAgIHZhciBjID0gY3JjKCksIHNpemUgPSBmaWxlLmxlbmd0aDtcbiAgICAgICAgYy5wKGZpbGUpO1xuICAgICAgICB2YXIgZiA9IHN0clRvVTgoZm4pLCBzID0gZi5sZW5ndGg7XG4gICAgICAgIHZhciBjb20gPSBwLmNvbW1lbnQsIG0gPSBjb20gJiYgc3RyVG9VOChjb20pLCBtcyA9IG0gJiYgbS5sZW5ndGg7XG4gICAgICAgIHZhciBleGwgPSBleGZsKHAuZXh0cmEpO1xuICAgICAgICB2YXIgY29tcHJlc3Npb24gPSBwLmxldmVsID09IDAgPyAwIDogODtcbiAgICAgICAgdmFyIGNibCA9IGZ1bmN0aW9uIChlLCBkKSB7XG4gICAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgICAgIHRBbGwoKTtcbiAgICAgICAgICAgICAgICBjYmQoZSwgbnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgbCA9IGQubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZpbGVzW2ldID0gbXJnKHAsIHtcbiAgICAgICAgICAgICAgICAgICAgc2l6ZTogc2l6ZSxcbiAgICAgICAgICAgICAgICAgICAgY3JjOiBjLmQoKSxcbiAgICAgICAgICAgICAgICAgICAgYzogZCxcbiAgICAgICAgICAgICAgICAgICAgZjogZixcbiAgICAgICAgICAgICAgICAgICAgbTogbSxcbiAgICAgICAgICAgICAgICAgICAgdTogcyAhPSBmbi5sZW5ndGggfHwgKG0gJiYgKGNvbS5sZW5ndGggIT0gbXMpKSxcbiAgICAgICAgICAgICAgICAgICAgY29tcHJlc3Npb246IGNvbXByZXNzaW9uXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbyArPSAzMCArIHMgKyBleGwgKyBsO1xuICAgICAgICAgICAgICAgIHRvdCArPSA3NiArIDIgKiAocyArIGV4bCkgKyAobXMgfHwgMCkgKyBsO1xuICAgICAgICAgICAgICAgIGlmICghLS1sZnQpXG4gICAgICAgICAgICAgICAgICAgIGNiZigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBpZiAocyA+IDY1NTM1KVxuICAgICAgICAgICAgY2JsKGVycigxMSwgMCwgMSksIG51bGwpO1xuICAgICAgICBpZiAoIWNvbXByZXNzaW9uKVxuICAgICAgICAgICAgY2JsKG51bGwsIGZpbGUpO1xuICAgICAgICBlbHNlIGlmIChzaXplIDwgMTYwMDAwKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNibChudWxsLCBkZWZsYXRlU3luYyhmaWxlLCBwKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNibChlLCBudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0ZXJtLnB1c2goZGVmbGF0ZShmaWxlLCBwLCBjYmwpKTtcbiAgICB9O1xuICAgIC8vIENhbm5vdCB1c2UgbGZ0IGJlY2F1c2UgaXQgY2FuIGRlY3JlYXNlXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGZ0OyArK2kpIHtcbiAgICAgICAgX2xvb3BfMShpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRBbGw7XG59XG4vKipcbiAqIFN5bmNocm9ub3VzbHkgY3JlYXRlcyBhIFpJUCBmaWxlLiBQcmVmZXIgdXNpbmcgYHppcGAgZm9yIGJldHRlciBwZXJmb3JtYW5jZVxuICogd2l0aCBtb3JlIHRoYW4gb25lIGZpbGUuXG4gKiBAcGFyYW0gZGF0YSBUaGUgZGlyZWN0b3J5IHN0cnVjdHVyZSBmb3IgdGhlIFpJUCBhcmNoaXZlXG4gKiBAcGFyYW0gb3B0cyBUaGUgbWFpbiBvcHRpb25zLCBtZXJnZWQgd2l0aCBwZXItZmlsZSBvcHRpb25zXG4gKiBAcmV0dXJucyBUaGUgZ2VuZXJhdGVkIFpJUCBhcmNoaXZlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB6aXBTeW5jKGRhdGEsIG9wdHMpIHtcbiAgICBpZiAoIW9wdHMpXG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICB2YXIgciA9IHt9O1xuICAgIHZhciBmaWxlcyA9IFtdO1xuICAgIGZsdG4oZGF0YSwgJycsIHIsIG9wdHMpO1xuICAgIHZhciBvID0gMDtcbiAgICB2YXIgdG90ID0gMDtcbiAgICBmb3IgKHZhciBmbiBpbiByKSB7XG4gICAgICAgIHZhciBfYSA9IHJbZm5dLCBmaWxlID0gX2FbMF0sIHAgPSBfYVsxXTtcbiAgICAgICAgdmFyIGNvbXByZXNzaW9uID0gcC5sZXZlbCA9PSAwID8gMCA6IDg7XG4gICAgICAgIHZhciBmID0gc3RyVG9VOChmbiksIHMgPSBmLmxlbmd0aDtcbiAgICAgICAgdmFyIGNvbSA9IHAuY29tbWVudCwgbSA9IGNvbSAmJiBzdHJUb1U4KGNvbSksIG1zID0gbSAmJiBtLmxlbmd0aDtcbiAgICAgICAgdmFyIGV4bCA9IGV4ZmwocC5leHRyYSk7XG4gICAgICAgIGlmIChzID4gNjU1MzUpXG4gICAgICAgICAgICBlcnIoMTEpO1xuICAgICAgICB2YXIgZCA9IGNvbXByZXNzaW9uID8gZGVmbGF0ZVN5bmMoZmlsZSwgcCkgOiBmaWxlLCBsID0gZC5sZW5ndGg7XG4gICAgICAgIHZhciBjID0gY3JjKCk7XG4gICAgICAgIGMucChmaWxlKTtcbiAgICAgICAgZmlsZXMucHVzaChtcmcocCwge1xuICAgICAgICAgICAgc2l6ZTogZmlsZS5sZW5ndGgsXG4gICAgICAgICAgICBjcmM6IGMuZCgpLFxuICAgICAgICAgICAgYzogZCxcbiAgICAgICAgICAgIGY6IGYsXG4gICAgICAgICAgICBtOiBtLFxuICAgICAgICAgICAgdTogcyAhPSBmbi5sZW5ndGggfHwgKG0gJiYgKGNvbS5sZW5ndGggIT0gbXMpKSxcbiAgICAgICAgICAgIG86IG8sXG4gICAgICAgICAgICBjb21wcmVzc2lvbjogY29tcHJlc3Npb25cbiAgICAgICAgfSkpO1xuICAgICAgICBvICs9IDMwICsgcyArIGV4bCArIGw7XG4gICAgICAgIHRvdCArPSA3NiArIDIgKiAocyArIGV4bCkgKyAobXMgfHwgMCkgKyBsO1xuICAgIH1cbiAgICB2YXIgb3V0ID0gbmV3IHU4KHRvdCArIDIyKSwgb2UgPSBvLCBjZGwgPSB0b3QgLSBvO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGYgPSBmaWxlc1tpXTtcbiAgICAgICAgd3poKG91dCwgZi5vLCBmLCBmLmYsIGYudSwgZi5jLmxlbmd0aCk7XG4gICAgICAgIHZhciBiYWRkID0gMzAgKyBmLmYubGVuZ3RoICsgZXhmbChmLmV4dHJhKTtcbiAgICAgICAgb3V0LnNldChmLmMsIGYubyArIGJhZGQpO1xuICAgICAgICB3emgob3V0LCBvLCBmLCBmLmYsIGYudSwgZi5jLmxlbmd0aCwgZi5vLCBmLm0pLCBvICs9IDE2ICsgYmFkZCArIChmLm0gPyBmLm0ubGVuZ3RoIDogMCk7XG4gICAgfVxuICAgIHd6ZihvdXQsIG8sIGZpbGVzLmxlbmd0aCwgY2RsLCBvZSk7XG4gICAgcmV0dXJuIG91dDtcbn1cbi8qKlxuICogU3RyZWFtaW5nIHBhc3MtdGhyb3VnaCBkZWNvbXByZXNzaW9uIGZvciBaSVAgYXJjaGl2ZXNcbiAqL1xudmFyIFVuemlwUGFzc1Rocm91Z2ggPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gVW56aXBQYXNzVGhyb3VnaCgpIHtcbiAgICB9XG4gICAgVW56aXBQYXNzVGhyb3VnaC5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjaHVuaywgZmluYWwpIHtcbiAgICAgICAgLy8gc2FtZSBhcyBaaXBQYXNzVGhyb3VnaDogY2FzdCB0byByZXRhaW4gQnVmZmVyIGVyZ29ub21pY3NcbiAgICAgICAgdGhpcy5vbmRhdGEobnVsbCwgY2h1bmssIGZpbmFsKTtcbiAgICB9O1xuICAgIFVuemlwUGFzc1Rocm91Z2guY29tcHJlc3Npb24gPSAwO1xuICAgIHJldHVybiBVbnppcFBhc3NUaHJvdWdoO1xufSgpKTtcbmV4cG9ydCB7IFVuemlwUGFzc1Rocm91Z2ggfTtcbi8qKlxuICogU3RyZWFtaW5nIERFRkxBVEUgZGVjb21wcmVzc2lvbiBmb3IgWklQIGFyY2hpdmVzLiBQcmVmZXIgQXN5bmNaaXBJbmZsYXRlIGZvclxuICogYmV0dGVyIHBlcmZvcm1hbmNlLlxuICovXG52YXIgVW56aXBJbmZsYXRlID0gLyojX19QVVJFX18qLyAoZnVuY3Rpb24gKCkge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBERUZMQVRFIGRlY29tcHJlc3Npb24gdGhhdCBjYW4gYmUgdXNlZCBpbiBaSVAgYXJjaGl2ZXNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBVbnppcEluZmxhdGUoKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIHRoaXMuaSA9IG5ldyBJbmZsYXRlKGZ1bmN0aW9uIChkYXQsIGZpbmFsKSB7XG4gICAgICAgICAgICBfdGhpcy5vbmRhdGEobnVsbCwgZGF0LCBmaW5hbCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBVbnppcEluZmxhdGUucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoY2h1bmssIGZpbmFsKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmkucHVzaChjaHVuaywgZmluYWwpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aGlzLm9uZGF0YShlLCBudWxsLCBmaW5hbCk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFVuemlwSW5mbGF0ZS5jb21wcmVzc2lvbiA9IDg7XG4gICAgcmV0dXJuIFVuemlwSW5mbGF0ZTtcbn0oKSk7XG5leHBvcnQgeyBVbnppcEluZmxhdGUgfTtcbi8qKlxuICogQXN5bmNocm9ub3VzIHN0cmVhbWluZyBERUZMQVRFIGRlY29tcHJlc3Npb24gZm9yIFpJUCBhcmNoaXZlc1xuICovXG52YXIgQXN5bmNVbnppcEluZmxhdGUgPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIERFRkxBVEUgZGVjb21wcmVzc2lvbiB0aGF0IGNhbiBiZSB1c2VkIGluIFpJUCBhcmNoaXZlc1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIEFzeW5jVW56aXBJbmZsYXRlKF8sIHN6KSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGlmIChzeiA8IDMyMDAwMCkge1xuICAgICAgICAgICAgdGhpcy5pID0gbmV3IEluZmxhdGUoZnVuY3Rpb24gKGRhdCwgZmluYWwpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5vbmRhdGEobnVsbCwgZGF0LCBmaW5hbCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaSA9IG5ldyBBc3luY0luZmxhdGUoZnVuY3Rpb24gKGVyciwgZGF0LCBmaW5hbCkge1xuICAgICAgICAgICAgICAgIF90aGlzLm9uZGF0YShlcnIsIGRhdCwgZmluYWwpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnRlcm1pbmF0ZSA9IHRoaXMuaS50ZXJtaW5hdGU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgQXN5bmNVbnppcEluZmxhdGUucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoY2h1bmssIGZpbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLmkudGVybWluYXRlKVxuICAgICAgICAgICAgY2h1bmsgPSBzbGMoY2h1bmssIDApO1xuICAgICAgICB0aGlzLmkucHVzaChjaHVuaywgZmluYWwpO1xuICAgIH07XG4gICAgQXN5bmNVbnppcEluZmxhdGUuY29tcHJlc3Npb24gPSA4O1xuICAgIHJldHVybiBBc3luY1VuemlwSW5mbGF0ZTtcbn0oKSk7XG5leHBvcnQgeyBBc3luY1VuemlwSW5mbGF0ZSB9O1xuLyoqXG4gKiBBIFpJUCBhcmNoaXZlIGRlY29tcHJlc3Npb24gc3RyZWFtIHRoYXQgZW1pdHMgZmlsZXMgYXMgdGhleSBhcmUgZGlzY292ZXJlZFxuICovXG52YXIgVW56aXAgPSAvKiNfX1BVUkVfXyovIChmdW5jdGlvbiAoKSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIFpJUCBkZWNvbXByZXNzaW9uIHN0cmVhbVxuICAgICAqIEBwYXJhbSBjYiBUaGUgY2FsbGJhY2sgdG8gY2FsbCB3aGVuZXZlciBhIGZpbGUgaW4gdGhlIFpJUCBhcmNoaXZlIGlzIGZvdW5kXG4gICAgICovXG4gICAgZnVuY3Rpb24gVW56aXAoY2IpIHtcbiAgICAgICAgdGhpcy5vbmZpbGUgPSBjYjtcbiAgICAgICAgdGhpcy5rID0gW107XG4gICAgICAgIHRoaXMubyA9IHtcbiAgICAgICAgICAgIDA6IFVuemlwUGFzc1Rocm91Z2hcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5wID0gZXQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFB1c2hlcyBhIGNodW5rIHRvIGJlIHVuemlwcGVkXG4gICAgICogQHBhcmFtIGNodW5rIFRoZSBjaHVuayB0byBwdXNoXG4gICAgICogQHBhcmFtIGZpbmFsIFdoZXRoZXIgdGhpcyBpcyB0aGUgbGFzdCBjaHVua1xuICAgICAqL1xuICAgIFVuemlwLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKGNodW5rLCBmaW5hbCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAoIXRoaXMub25maWxlKVxuICAgICAgICAgICAgZXJyKDUpO1xuICAgICAgICBpZiAoIXRoaXMucClcbiAgICAgICAgICAgIGVycig0KTtcbiAgICAgICAgaWYgKHRoaXMuYyA+IDApIHtcbiAgICAgICAgICAgIHZhciBsZW4gPSBNYXRoLm1pbih0aGlzLmMsIGNodW5rLmxlbmd0aCk7XG4gICAgICAgICAgICB2YXIgdG9BZGQgPSBjaHVuay5zdWJhcnJheSgwLCBsZW4pO1xuICAgICAgICAgICAgdGhpcy5jIC09IGxlbjtcbiAgICAgICAgICAgIGlmICh0aGlzLmQpXG4gICAgICAgICAgICAgICAgdGhpcy5kLnB1c2godG9BZGQsICF0aGlzLmMpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHRoaXMua1swXS5wdXNoKHRvQWRkKTtcbiAgICAgICAgICAgIGNodW5rID0gY2h1bmsuc3ViYXJyYXkobGVuKTtcbiAgICAgICAgICAgIGlmIChjaHVuay5sZW5ndGgpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucHVzaChjaHVuaywgZmluYWwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIGYgPSAwLCBpID0gMCwgaXMgPSB2b2lkIDAsIGJ1ZiA9IHZvaWQgMDtcbiAgICAgICAgICAgIGlmICghdGhpcy5wLmxlbmd0aClcbiAgICAgICAgICAgICAgICBidWYgPSBjaHVuaztcbiAgICAgICAgICAgIGVsc2UgaWYgKCFjaHVuay5sZW5ndGgpXG4gICAgICAgICAgICAgICAgYnVmID0gdGhpcy5wO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYnVmID0gbmV3IHU4KHRoaXMucC5sZW5ndGggKyBjaHVuay5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIGJ1Zi5zZXQodGhpcy5wKSwgYnVmLnNldChjaHVuaywgdGhpcy5wLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgbCA9IGJ1Zi5sZW5ndGgsIG9jID0gdGhpcy5jLCBhZGQgPSBvYyAmJiB0aGlzLmQ7XG4gICAgICAgICAgICB2YXIgX2xvb3BfMiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2lnID0gYjQoYnVmLCBpKTtcbiAgICAgICAgICAgICAgICBpZiAoc2lnID09IDB4NDAzNEI1MCkge1xuICAgICAgICAgICAgICAgICAgICBmID0gMSwgaXMgPSBpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzXzEuZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNfMS5jID0gMDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJmID0gYjIoYnVmLCBpICsgNiksIGNtcF8xID0gYjIoYnVmLCBpICsgOCksIHUgPSBiZiAmIDIwNDgsIGRkID0gYmYgJiA4LCBmbmwgPSBiMihidWYsIGkgKyAyNiksIGVzID0gYjIoYnVmLCBpICsgMjgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobCA+IGkgKyAzMCArIGZubCArIGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2hrc18zID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzXzEuay51bnNoaWZ0KGNoa3NfMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmID0gMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsc2MgPSBiNChidWYsIGkgKyAxOCksIGxzdSA9IGI0KGJ1ZiwgaSArIDIyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmbl8xID0gc3RyRnJvbVU4KGJ1Zi5zdWJhcnJheShpICsgMzAsIGkgKz0gMzAgKyBmbmwpLCAhdSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgX2EgPSB6NjRocyhidWYsIGksIGVzLCAyLCBsc2MsIGxzdSwgMCksIHNjXzEgPSBfYVswXSwgc3VfMSA9IF9hWzFdLCB6NjQgPSBfYVszXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY18xID0gLTEgLSB6NjQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpICs9IGVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc18xLmMgPSBzY18xO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRfMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmaWxlXzEgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogZm5fMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wcmVzc2lvbjogY21wXzEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmaWxlXzEub25kYXRhKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyKDUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNjXzEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlXzEub25kYXRhKG51bGwsIGV0LCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3RyID0gX3RoaXMub1tjbXBfMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWN0cilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlXzEub25kYXRhKGVycigxNCwgJ3Vua25vd24gY29tcHJlc3Npb24gdHlwZSAnICsgY21wXzEsIDEpLCBudWxsLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkXzEgPSBzY18xIDwgMCA/IG5ldyBjdHIoZm5fMSkgOiBuZXcgY3RyKGZuXzEsIHNjXzEsIHN1XzEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZF8xLm9uZGF0YSA9IGZ1bmN0aW9uIChlcnIsIGRhdCwgZmluYWwpIHsgZmlsZV8xLm9uZGF0YShlcnIsIGRhdCwgZmluYWwpOyB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBjaGtzXzQgPSBjaGtzXzM7IF9pIDwgY2hrc180Lmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkYXQgPSBjaGtzXzRbX2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRfMS5wdXNoKGRhdCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF90aGlzLmtbMF0gPT0gY2hrc18zICYmIF90aGlzLmMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuZCA9IGRfMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkXzEucHVzaChldCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRlcm1pbmF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZF8xICYmIGRfMS50ZXJtaW5hdGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkXzEudGVybWluYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzY18xID49IDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZV8xLnNpemUgPSBzY18xLCBmaWxlXzEub3JpZ2luYWxTaXplID0gc3VfMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNfMS5vbmZpbGUoZmlsZV8xKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJicmVha1wiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChvYykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2lnID09IDB4ODA3NEI1MCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXMgPSBpICs9IDEyICsgKG9jID09IC0yICYmIDgpLCBmID0gMywgdGhpc18xLmMgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiYnJlYWtcIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChzaWcgPT0gMHgyMDE0QjUwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpcyA9IGkgLT0gNCwgZiA9IDMsIHRoaXNfMS5jID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcImJyZWFrXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIHRoaXNfMSA9IHRoaXM7XG4gICAgICAgICAgICBmb3IgKDsgaSA8IGwgLSA0OyArK2kpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RhdGVfMSA9IF9sb29wXzIoKTtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdGVfMSA9PT0gXCJicmVha1wiKVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucCA9IGV0O1xuICAgICAgICAgICAgaWYgKG9jIDwgMCkge1xuICAgICAgICAgICAgICAgIHZhciBkYXQgPSBmID8gYnVmLnN1YmFycmF5KDAsIGlzIC0gMTIgLSAob2MgPT0gLTIgJiYgOCkgLSAoYjQoYnVmLCBpcyAtIDE2KSA9PSAweDgwNzRCNTAgJiYgNCkpIDogYnVmLnN1YmFycmF5KDAsIGkpO1xuICAgICAgICAgICAgICAgIGlmIChhZGQpXG4gICAgICAgICAgICAgICAgICAgIGFkZC5wdXNoKGRhdCwgISFmKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMua1srKGYgPT0gMildLnB1c2goZGF0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmICYgMilcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wdXNoKGJ1Zi5zdWJhcnJheShpKSwgZmluYWwpO1xuICAgICAgICAgICAgdGhpcy5wID0gYnVmLnN1YmFycmF5KGkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmaW5hbCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuYylcbiAgICAgICAgICAgICAgICBlcnIoMTMpO1xuICAgICAgICAgICAgdGhpcy5wID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH07XG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXJzIGEgZGVjb2RlciB3aXRoIHRoZSBzdHJlYW0sIGFsbG93aW5nIGZvciBmaWxlcyBjb21wcmVzc2VkIHdpdGhcbiAgICAgKiB0aGUgY29tcHJlc3Npb24gdHlwZSBwcm92aWRlZCB0byBiZSBleHBhbmRlZCBjb3JyZWN0bHlcbiAgICAgKiBAcGFyYW0gZGVjb2RlciBUaGUgZGVjb2RlciBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIFVuemlwLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uIChkZWNvZGVyKSB7XG4gICAgICAgIHRoaXMub1tkZWNvZGVyLmNvbXByZXNzaW9uXSA9IGRlY29kZXI7XG4gICAgfTtcbiAgICByZXR1cm4gVW56aXA7XG59KCkpO1xuZXhwb3J0IHsgVW56aXAgfTtcbnZhciBtdCA9IHR5cGVvZiBxdWV1ZU1pY3JvdGFzayA9PSAnZnVuY3Rpb24nID8gcXVldWVNaWNyb3Rhc2sgOiB0eXBlb2Ygc2V0VGltZW91dCA9PSAnZnVuY3Rpb24nID8gc2V0VGltZW91dCA6IGZ1bmN0aW9uIChmbikgeyBmbigpOyB9O1xuZXhwb3J0IGZ1bmN0aW9uIHVuemlwKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKCFjYilcbiAgICAgICAgY2IgPSBvcHRzLCBvcHRzID0ge307XG4gICAgaWYgKHR5cGVvZiBjYiAhPSAnZnVuY3Rpb24nKVxuICAgICAgICBlcnIoNyk7XG4gICAgdmFyIHRlcm0gPSBbXTtcbiAgICB2YXIgdEFsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0ZXJtLmxlbmd0aDsgKytpKVxuICAgICAgICAgICAgdGVybVtpXSgpO1xuICAgIH07XG4gICAgdmFyIGZpbGVzID0ge307XG4gICAgdmFyIGNiZCA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIG10KGZ1bmN0aW9uICgpIHsgY2IoYSwgYik7IH0pO1xuICAgIH07XG4gICAgbXQoZnVuY3Rpb24gKCkgeyBjYmQgPSBjYjsgfSk7XG4gICAgdmFyIGUgPSBkYXRhLmxlbmd0aCAtIDIyO1xuICAgIGZvciAoOyBiNChkYXRhLCBlKSAhPSAweDYwNTRCNTA7IC0tZSkge1xuICAgICAgICBpZiAoIWUgfHwgZGF0YS5sZW5ndGggLSBlID4gNjU1NTgpIHtcbiAgICAgICAgICAgIGNiZChlcnIoMTMsIDAsIDEpLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybiB0QWxsO1xuICAgICAgICB9XG4gICAgfVxuICAgIDtcbiAgICB2YXIgbGZ0ID0gYjIoZGF0YSwgZSArIDgpO1xuICAgIGlmIChsZnQpIHtcbiAgICAgICAgdmFyIGMgPSBsZnQ7XG4gICAgICAgIHZhciBvID0gYjQoZGF0YSwgZSArIDE2KTtcbiAgICAgICAgdmFyIHogPSBiNChkYXRhLCBlIC0gMjApID09IDB4NzA2NEI1MDtcbiAgICAgICAgaWYgKHopIHtcbiAgICAgICAgICAgIHZhciB6ZSA9IGI0KGRhdGEsIGUgLSAxMik7XG4gICAgICAgICAgICB6ID0gYjQoZGF0YSwgemUpID09IDB4NjA2NEI1MDtcbiAgICAgICAgICAgIGlmICh6KSB7XG4gICAgICAgICAgICAgICAgYyA9IGxmdCA9IGI0KGRhdGEsIHplICsgMzIpO1xuICAgICAgICAgICAgICAgIG8gPSBiNChkYXRhLCB6ZSArIDQ4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgZmx0ciA9IG9wdHMgJiYgb3B0cy5maWx0ZXI7XG4gICAgICAgIHZhciBfbG9vcF8zID0gZnVuY3Rpb24gKGkpIHtcbiAgICAgICAgICAgIHZhciBfYSA9IHpoKGRhdGEsIG8sIHopLCBjXzEgPSBfYVswXSwgc2MgPSBfYVsxXSwgc3UgPSBfYVsyXSwgZm4gPSBfYVszXSwgbm8gPSBfYVs0XSwgb2ZmID0gX2FbNV0sIGIgPSBzbHpoKGRhdGEsIG9mZik7XG4gICAgICAgICAgICBvID0gbm87XG4gICAgICAgICAgICB2YXIgY2JsID0gZnVuY3Rpb24gKGUsIGQpIHtcbiAgICAgICAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgICAgICAgICB0QWxsKCk7XG4gICAgICAgICAgICAgICAgICAgIGNiZChlLCBudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkKVxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNbZm5dID0gZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEtLWxmdClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiZChudWxsLCBmaWxlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghZmx0ciB8fCBmbHRyKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBmbixcbiAgICAgICAgICAgICAgICBzaXplOiBzYyxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFNpemU6IHN1LFxuICAgICAgICAgICAgICAgIGNvbXByZXNzaW9uOiBjXzFcbiAgICAgICAgICAgIH0pKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjXzEpXG4gICAgICAgICAgICAgICAgICAgIGNibChudWxsLCBzbGMoZGF0YSwgYiwgYiArIHNjKSk7XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY18xID09IDgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZmwgPSBkYXRhLnN1YmFycmF5KGIsIGIgKyBzYyk7XG4gICAgICAgICAgICAgICAgICAgIC8vIFN5bmNocm9ub3VzbHkgZGVjb21wcmVzcyB1bmRlciA1MTJLQiwgb3IgYmFyZWx5LWNvbXByZXNzZWQgZGF0YVxuICAgICAgICAgICAgICAgICAgICBpZiAoc3UgPCA1MjQyODggfHwgc2MgPiAwLjggKiBzdSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYmwobnVsbCwgaW5mbGF0ZVN5bmMoaW5mbCwgeyBvdXQ6IG5ldyB1OChzdSkgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYmwoZSwgbnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGVybS5wdXNoKGluZmxhdGUoaW5mbCwgeyBzaXplOiBzdSB9LCBjYmwpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBjYmwoZXJyKDE0LCAndW5rbm93biBjb21wcmVzc2lvbiB0eXBlICcgKyBjXzEsIDEpLCBudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBjYmwobnVsbCwgbnVsbCk7XG4gICAgICAgIH07XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYzsgKytpKSB7XG4gICAgICAgICAgICBfbG9vcF8zKGkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICAgICAgY2JkKG51bGwsIHt9KTtcbiAgICByZXR1cm4gdEFsbDtcbn1cbi8qKlxuICogU3luY2hyb25vdXNseSBkZWNvbXByZXNzZXMgYSBaSVAgYXJjaGl2ZS4gUHJlZmVyIHVzaW5nIGB1bnppcGAgZm9yIGJldHRlclxuICogcGVyZm9ybWFuY2Ugd2l0aCBtb3JlIHRoYW4gb25lIGZpbGUuXG4gKiBAcGFyYW0gZGF0YSBUaGUgcmF3IGNvbXByZXNzZWQgWklQIGZpbGVcbiAqIEBwYXJhbSBvcHRzIFRoZSBaSVAgZXh0cmFjdGlvbiBvcHRpb25zXG4gKiBAcmV0dXJucyBUaGUgZGVjb21wcmVzc2VkIGZpbGVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bnppcFN5bmMoZGF0YSwgb3B0cykge1xuICAgIHZhciBmaWxlcyA9IHt9O1xuICAgIHZhciBlID0gZGF0YS5sZW5ndGggLSAyMjtcbiAgICBmb3IgKDsgYjQoZGF0YSwgZSkgIT0gMHg2MDU0QjUwOyAtLWUpIHtcbiAgICAgICAgaWYgKCFlIHx8IGRhdGEubGVuZ3RoIC0gZSA+IDY1NTU4KVxuICAgICAgICAgICAgZXJyKDEzKTtcbiAgICB9XG4gICAgO1xuICAgIHZhciBjID0gYjIoZGF0YSwgZSArIDgpO1xuICAgIGlmICghYylcbiAgICAgICAgcmV0dXJuIHt9O1xuICAgIHZhciBvID0gYjQoZGF0YSwgZSArIDE2KTtcbiAgICB2YXIgeiA9IGI0KGRhdGEsIGUgLSAyMCkgPT0gMHg3MDY0QjUwO1xuICAgIGlmICh6KSB7XG4gICAgICAgIHZhciB6ZSA9IGI0KGRhdGEsIGUgLSAxMik7XG4gICAgICAgIHogPSBiNChkYXRhLCB6ZSkgPT0gMHg2MDY0QjUwO1xuICAgICAgICBpZiAoeikge1xuICAgICAgICAgICAgYyA9IGI0KGRhdGEsIHplICsgMzIpO1xuICAgICAgICAgICAgbyA9IGI0KGRhdGEsIHplICsgNDgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHZhciBmbHRyID0gb3B0cyAmJiBvcHRzLmZpbHRlcjtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGM7ICsraSkge1xuICAgICAgICB2YXIgX2EgPSB6aChkYXRhLCBvLCB6KSwgY18yID0gX2FbMF0sIHNjID0gX2FbMV0sIHN1ID0gX2FbMl0sIGZuID0gX2FbM10sIG5vID0gX2FbNF0sIG9mZiA9IF9hWzVdLCBiID0gc2x6aChkYXRhLCBvZmYpO1xuICAgICAgICBvID0gbm87XG4gICAgICAgIGlmICghZmx0ciB8fCBmbHRyKHtcbiAgICAgICAgICAgIG5hbWU6IGZuLFxuICAgICAgICAgICAgc2l6ZTogc2MsXG4gICAgICAgICAgICBvcmlnaW5hbFNpemU6IHN1LFxuICAgICAgICAgICAgY29tcHJlc3Npb246IGNfMlxuICAgICAgICB9KSkge1xuICAgICAgICAgICAgaWYgKCFjXzIpXG4gICAgICAgICAgICAgICAgZmlsZXNbZm5dID0gc2xjKGRhdGEsIGIsIGIgKyBzYyk7XG4gICAgICAgICAgICBlbHNlIGlmIChjXzIgPT0gOClcbiAgICAgICAgICAgICAgICBmaWxlc1tmbl0gPSBpbmZsYXRlU3luYyhkYXRhLnN1YmFycmF5KGIsIGIgKyBzYyksIHsgb3V0OiBuZXcgdTgoc3UpIH0pO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGVycigxNCwgJ3Vua25vd24gY29tcHJlc3Npb24gdHlwZSAnICsgY18yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmlsZXM7XG59XG4iLCAiLy8gYGZmbGF0ZWAgcmVhZG1lIGlzIHRvbyBjb21wbGljYXRlZDpcclxuLy8gaHR0cHM6Ly9naXRodWIuY29tLzEwMWFycm93ei9mZmxhdGUvaXNzdWVzLzI1MVxyXG4vLyBJIGp1c3QgdXNlZCB3aGF0ZXZlciBhcHByb2FjaCBzZWVtZWQgdG8gd29yay5cclxuLy9cclxuLy8gSXQgd2FzIGEgY2hvaWNlIGJldHdlZW4gXCJzeW5jcmhvbm91c1wiIChibG9ja2luZykgdW56aXAgdmlhIGB1bnppcFN5bmMoKWBcclxuLy8gYW5kIFwiYXN5bmNocm9ub3VzXCIgKG5vbi1ibG9ja2luZykgdW56aXAgdmlhIGB1bnppcCgpYC5cclxuLy9cclxuLy8gSW4gdGhlIHJlYWRtZSB0aGV5IHNheSB0aGF0IHVzaW5nIFwiYXN5bmNocm9ub3VzXCIgQVBJICB3aWxsIGNhdXNlIHRoZSBjb21wcmVzc2lvbiBvciBkZWNvbXByZXNzaW9uXHJcbi8vIHJ1biBpbiBhIHNlcGFyYXRlIHRocmVhZCBieSB1c2luZyBXZWIgKG9yIE5vZGUpIFdvcmtlcnMsIHNvIGl0IHdvbid0IGJsb2NrIHRoZSBtYWluIHRocmVhZC5cclxuLy8gWWV0LCB0aGV5IGFsc28gc2F5IHRoYXQgdGhlcmUgaXMgYW4gaW5pdGlhbCBvdmVyaGVhZCB0byB1c2luZyB3b3JrZXJzIG9mIGFib3V0IDUwbXMgZm9yIGVhY2hcclxuLy8gYXN5bmNocm9ub3VzIGZ1bmN0aW9uLiBGb3Igc21hbGwgKHVuZGVyIGFib3V0IDUwa0IpIHBheWxvYWRzLCB0aGV5IHNheSB0aGF0IHRoZSBcImFzeW5jaHJvbm91c1wiIEFQSVxyXG4vLyB3aWxsIGJlIG11Y2ggc2xvd2VyIGNvbXBhcmVkIHRvIHRoZSBcInN5bmNocm9ub3VzXCIgb25lLiBIb3dldmVyLCB3aGVuIGNvbXByZXNzaW5nIGxhcmdlciBmaWxlc1xyXG4vLyBvciBtdWx0aXBsZSBmaWxlcyBhdCBvbmNlLCB0aGUgXCJzeW5jaHJvbm91c1wiIEFQSSBjYXVzZXMgdGhlIG1haW4gdGhyZWFkIHRvIGhhbmcgZm9yIHRvbyBsb25nLFxyXG4vLyBhbmQgdGhlIFwiYXN5bmNocm9ub3VzXCIgQVBJIGlzIGFuIG9yZGVyIG9mIG1hZ25pdHVkZSBiZXR0ZXIuXHJcbi8vXHJcbmltcG9ydCB7IHVuemlwIH0gZnJvbSAnZmZsYXRlJ1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGAqLnppcGAgZmlsZSBjb250ZW50cy4gSWdub3JlcyBhbnl0aGluZyBiZXNpZGVzIGAueG1sYCBvciBgLnhtbC5yZWxzYCBmaWxlcy5cclxuICogQHBhcmFtICB7QXJyYXlCdWZmZXJ9IGlucHV0XHJcbiAqIEByZXR1cm4ge1Byb21pc2U8UmVjb3JkPHN0cmluZyxVaW50OEFycmF5Pj59IFJlc29sdmVzIHRvIGFuIG9iamVjdCBob2xkaW5nIGAqLnppcGAgZmlsZSBlbnRyaWVzLlxyXG4gKi9cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdW56aXBGcm9tQXJyYXlCdWZmZXIoaW5wdXQsIG9wdGlvbnMpIHtcclxuXHRyZXR1cm4gdW56aXBGcm9tQXJyYXlCdWZmZXJVc2luZ0Z1bmN0aW9uKGlucHV0LCBvcHRpb25zLCB1bnppcEFzeW5jLCB0cnVlKVxyXG59XHJcblxyXG4vKipcclxuICogUmVhZHMgYCouemlwYCBmaWxlIGNvbnRlbnRzLiBJZ25vcmVzIGFueXRoaW5nIGJlc2lkZXMgYC54bWxgIG9yIGAueG1sLnJlbHNgIGZpbGVzLlxyXG4gKiBAcGFyYW0gIHtBcnJheUJ1ZmZlcn0gaW5wdXRcclxuICogQHBhcmFtICB7KEFycmF5QnVmZmVyKSA9PiBSZWNvcmQ8c3RyaW5nLCBVaW50OEFycmF5PiB8IFByb21pc2U8UmVjb3JkPHN0cmluZywgVWludDhBcnJheT4+fSB1bnppcFxyXG4gKiBAcGFyYW0gIHtib29sZWFufSBpc0FzeW5jIOKAlMKgU2hvdWxkIGJlIGB0cnVlYCB3aGVuIGB1bnppcCgpYCByZXR1cm5zIGEgYFByb21pc2VgLCBgZmFsc2VgIG90aGVyd2lzZS5cclxuICogQHJldHVybiB7UHJvbWlzZTxSZWNvcmQ8c3RyaW5nLFVpbnQ4QXJyYXk+PnxSZWNvcmQ8c3RyaW5nLFVpbnQ4QXJyYXk+fSBSZXNvbHZlcyB0byBhbiBvYmplY3QgaG9sZGluZyBgKi56aXBgIGZpbGUgZW50cmllcy5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB1bnppcEZyb21BcnJheUJ1ZmZlclVzaW5nRnVuY3Rpb24oaW5wdXQsIHsgZmlsdGVyIH0gPSB7fSwgdW56aXAsIGlzQXN5bmMpIHtcclxuXHQvLyBSZWFkIHRoZSBgLnppcGAgYXJjaGl2ZS5cclxuXHQvLyBgcmVzdWx0YCBpcyBlaXRoZXIgYG9iamVjdGAgb3IgYFByb21pc2U8b2JqZWN0PmBcclxuXHRyZXR1cm4gdW56aXAobmV3IFVpbnQ4QXJyYXkoaW5wdXQpLCB7XHJcblx0XHQvLyBJZ25vcmUgY2VydGFpbiB0eXBlcyBvZiBmaWxlcy5cclxuXHRcdGZpbHRlcjogKGZpbGUpID0+IHtcclxuXHRcdFx0aWYgKGZpbHRlcikge1xyXG5cdFx0XHRcdHJldHVybiBmaWx0ZXIoe1xyXG5cdFx0XHRcdFx0cGF0aDogZmlsZS5uYW1lXHJcblx0XHRcdFx0fSlcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZVxyXG5cdFx0fVxyXG5cdH0pXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVuemlwQXN5bmMoYXJjaGl2ZSkge1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHQvLyBgdW56aXAoKWAgd2lsbCByZXNvcnQgdG8gXCJzeW5jaHJvbm91c1wiIGRlY29tcHJlc3Npb24gaW4gdHdvIGVkZ2UgY2FzZXM6XHJcbiAgICAvLyAqIFdoZW4gdGhlIGFyY2hpdmUgc2l6ZSBpcyBsZXNzIHRoYW4gYDUxMktCYC5cclxuICAgIC8vICogV2hlbiB0aGUgZGF0YSBpcyBiYXJlbHkgY29tcHJlc3NlZCwgaS5lLiB0aGUgY29tcHJlc3Npb24gcmF0aW8gaXMgbGVzcyB0aGFuIDIwJSByZWR1Y3Rpb24gaW4gc2l6ZS5cclxuICAgIHVuemlwKGFyY2hpdmUsIChlcnJvciwgZmlsZXMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgcmVqZWN0KGVycm9yKVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJlc29sdmUoZmlsZXMpXHJcbiAgICAgIH1cclxuICAgIH0pXHJcbiAgfSlcclxufSIsICJpbXBvcnQgeyBzdHJGcm9tVTggfSBmcm9tICdmZmxhdGUnXHJcblxyXG4vKipcclxuICogQHBhcmFtIHtSZWNvcmQ8c3RyaW5nLFVpbnQ4QXJyYXl9IGVudHJpZXNcclxuICogQHJldHVybnMge1JlY29yZDxzdHJpbmcsc3RyaW5nPn1cclxuICovXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNvbnZlcnRWYWx1ZXNGcm9tVWludDhBcnJheXNUb1N0cmluZ3MoZW50cmllcykge1xyXG5cdGNvbnN0IGNvbnZlcnRlZEVudHJpZXMgPSB7fVxyXG5cdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGVudHJpZXMpKSB7XHJcblx0XHRjb252ZXJ0ZWRFbnRyaWVzW2tleV0gPSBzdHJGcm9tVTgoZW50cmllc1trZXldKVxyXG5cdH1cclxuXHRyZXR1cm4gY29udmVydGVkRW50cmllc1xyXG59IiwgIi8vIEFuIGAueGxzeGAgYC56aXBgIGFyY2hpdmUgY291bGQgY29udGFpbiBhbGwga2luZHMgb2YgZmlsZXMsXHJcbi8vIHN1Y2ggYXMgYC5iaW5gIHByaW50ZXIgc2V0dGluZ3Mgb3IgYC5wbmdgIGltYWdlcywgZXRjLlxyXG4vL1xyXG4vLyBCZWNhdXNlIGByZWFkLWV4Y2VsLWZpbGVgIGRvZXNuJ3Qgc3VwcG9ydCByZXR1cm5pbmcgYW55IG9mIHRob3NlIHR5cGVzIG9mIGRhdGEsXHJcbi8vIHRoZXJlJ3Mgbm8gbmVlZCB0byByZWFkIHRob3NlIGZpbGVzIGZyb20gdGhlIGAueGxzeGAgYC56aXBgIGFyY2hpdmUsXHJcbi8vIG9wdGltaXppbmcgdGhlIHVucGFja2luZyBwcm9jZXNzIGEgbGl0dGxlIGJpdC5cclxuLy9cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVyWmlwQXJjaGl2ZUVudHJ5KHsgcGF0aCB9KSB7XHJcblx0cmV0dXJuIHBhdGguZW5kc1dpdGgoJy54bWwnKSB8fCBwYXRoLmVuZHNXaXRoKCcueG1sLnJlbHMnKVxyXG59IiwgIi8vIFVzZXMgYW4gXCJhc3luY1wiIGZ1bmN0aW9uIG9mIHRoZSB1bnppcHBlciBmdW5jdGlvblxyXG4vLyBqdXN0IGJlY2F1c2UgaXQgZmVlbHMgbW9yZSBjb3JyZWN0IHRvIHVzZSBpdCBvdmVyIHRoZSBcInN5bmNcIiBvbmVcclxuLy8gYmVjYXVzZSBpdCBpc24ndCBzdXBwb3NlZCB0byBldmVyIGZyZWV6ZSB0aGUgXCJtYWluIHRocmVhZFwiIChHVUkpLlxyXG4vL1xyXG4vLyBpbXBvcnQgdW56aXBGcm9tQXJyYXlCdWZmZXJTeW5jIGZyb20gJy4uL3ppcC91bnppcEZyb21BcnJheUJ1ZmZlclN5bmMuanMnXHJcbmltcG9ydCB1bnppcEZyb21BcnJheUJ1ZmZlciBmcm9tICcuLi96aXAvdW56aXBGcm9tQXJyYXlCdWZmZXIuanMnXHJcblxyXG5pbXBvcnQgY29udmVydFZhbHVlc0Zyb21VaW50OEFycmF5c1RvU3RyaW5ncyBmcm9tICcuL2NvbnZlcnRWYWx1ZXNGcm9tVWludDhBcnJheXNUb1N0cmluZ3MuanMnXHJcbmltcG9ydCBmaWx0ZXJaaXBBcmNoaXZlRW50cnkgZnJvbSAnLi9maWx0ZXJaaXBBcmNoaXZlRW50cnkuanMnXHJcblxyXG4vKipcclxuICogVW5wYWNrcyBgKi54bHN4YCBmaWxlIGNvbnRlbnRzLlxyXG4gKiBBbiBgLnhsc3hgIGZpbGUgaXMgcmVhbGx5IGp1c3QgYSBgLnppcGAgYXJjaGl2ZSB3aXRoIGAueG1sYCBmaWxlcyBpbnNpZGUuXHJcbiAqIEBwYXJhbSAgeyhGaWxlfEJsb2J8QXJyYXlCdWZmZXIpfSBpbnB1dFxyXG4gKiBAcmV0dXJuIHtQcm9taXNlPFJlY29yZDxzdHJpbmcsc3RyaW5nPn0gUmVzb2x2ZXMgdG8gYW4gb2JqZWN0IGhvbGRpbmcgYCoueGxzeGAgZmlsZSBlbnRyaWVzLlxyXG4gKi9cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdW5wYWNrWGxzeEZpbGUoaW5wdXQpIHtcclxuXHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBGaWxlIHx8IGlucHV0IGluc3RhbmNlb2YgQmxvYikge1xyXG5cdFx0cmV0dXJuIGlucHV0LmFycmF5QnVmZmVyKCkudGhlbihnZXRSZXN1bHRGcm9tQXJyYXlCdWZmZXIpXHJcblx0fVxyXG5cdHJldHVybiBQcm9taXNlLnJlc29sdmUoaW5wdXQpLnRoZW4oZ2V0UmVzdWx0RnJvbUFycmF5QnVmZmVyKVxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRSZXN1bHRGcm9tQXJyYXlCdWZmZXIoYXJyYXlCdWZmZXIpIHtcclxuXHRyZXR1cm4gdW56aXBGcm9tQXJyYXlCdWZmZXIoYXJyYXlCdWZmZXIsIHsgZmlsdGVyOiBmaWx0ZXJaaXBBcmNoaXZlRW50cnkgfSkudGhlbihcclxuXHRcdGNvbnZlcnRWYWx1ZXNGcm9tVWludDhBcnJheXNUb1N0cmluZ3NcclxuXHQpXHJcbn1cclxuXHJcbi8vIGZ1bmN0aW9uIGdldFJlc3VsdEZyb21BcnJheUJ1ZmZlclN5bmMoYXJyYXlCdWZmZXIpIHtcclxuLy8gIGNvbnN0IHJlc3VsdCA9IHVuemlwRnJvbUFycmF5QnVmZmVyU3luYyhhcnJheUJ1ZmZlciwgeyBmaWx0ZXI6IGZpbHRlclppcEFyY2hpdmVFbnRyeSB9KVxyXG4vLyBcdHJldHVybiBjb252ZXJ0VmFsdWVzRnJvbVVpbnQ4QXJyYXlzVG9TdHJpbmdzKHJlc3VsdClcclxuLy8gfSIsICJleHBvcnQgZnVuY3Rpb24gZmluZENoaWxkKG5vZGUsIHRhZ05hbWUpIHtcclxuXHRsZXQgaSA9IDBcclxuXHR3aGlsZSAoaSA8IG5vZGUuY2hpbGROb2Rlcy5sZW5ndGgpIHtcclxuXHRcdGNvbnN0IGNoaWxkTm9kZSA9IG5vZGUuY2hpbGROb2Rlc1tpXVxyXG5cdFx0Ly8gYG5vZGVUeXBlOiAxYCBtZWFucyBcIkVsZW1lbnRcIi5cclxuXHRcdC8vIGh0dHBzOi8vd3d3Lnczc2Nob29scy5jb20veG1sL3Byb3BfZWxlbWVudF9ub2RldHlwZS5hc3BcclxuXHRcdGlmIChjaGlsZE5vZGUubm9kZVR5cGUgPT09IDEgJiYgZ2V0VGFnTmFtZShjaGlsZE5vZGUpID09PSB0YWdOYW1lKSB7XHJcblx0XHRcdHJldHVybiBjaGlsZE5vZGVcclxuXHRcdH1cclxuXHRcdGkrK1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRDaGlsZHJlbihub2RlLCB0YWdOYW1lKSB7XHJcblx0Y29uc3QgcmVzdWx0cyA9IFtdXHJcblx0bGV0IGkgPSAwXHJcblx0d2hpbGUgKGkgPCBub2RlLmNoaWxkTm9kZXMubGVuZ3RoKSB7XHJcblx0XHRjb25zdCBjaGlsZE5vZGUgPSBub2RlLmNoaWxkTm9kZXNbaV1cclxuXHRcdC8vIGBub2RlVHlwZTogMWAgbWVhbnMgXCJFbGVtZW50XCIuXHJcblx0XHQvLyBodHRwczovL3d3dy53M3NjaG9vbHMuY29tL3htbC9wcm9wX2VsZW1lbnRfbm9kZXR5cGUuYXNwXHJcblx0XHRpZiAoY2hpbGROb2RlLm5vZGVUeXBlID09PSAxICYmIGdldFRhZ05hbWUoY2hpbGROb2RlKSA9PT0gdGFnTmFtZSkge1xyXG5cdFx0XHRyZXN1bHRzLnB1c2goY2hpbGROb2RlKVxyXG5cdFx0fVxyXG5cdFx0aSsrXHJcblx0fVxyXG5cdHJldHVybiByZXN1bHRzXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBmb3JFYWNoKG5vZGUsIHRhZ05hbWUsIGZ1bmMpIHtcclxuXHQvLyBpZiAodHlwZW9mIHRhZ05hbWUgPT09ICdmdW5jdGlvbicpIHtcclxuXHQvLyBcdGZ1bmMgPSB0YWdOYW1lXHJcblx0Ly8gXHR0YWdOYW1lID0gdW5kZWZpbmVkXHJcblx0Ly8gfVxyXG5cdGxldCBpID0gMFxyXG5cdHdoaWxlIChpIDwgbm9kZS5jaGlsZE5vZGVzLmxlbmd0aCkge1xyXG5cdFx0Y29uc3QgY2hpbGROb2RlID0gbm9kZS5jaGlsZE5vZGVzW2ldXHJcblx0XHRpZiAodGFnTmFtZSkge1xyXG5cdFx0XHQvLyBgbm9kZVR5cGU6IDFgIG1lYW5zIFwiRWxlbWVudFwiLlxyXG5cdFx0XHQvLyBodHRwczovL3d3dy53M3NjaG9vbHMuY29tL3htbC9wcm9wX2VsZW1lbnRfbm9kZXR5cGUuYXNwXHJcblx0XHRcdGlmIChjaGlsZE5vZGUubm9kZVR5cGUgPT09IDEgJiYgZ2V0VGFnTmFtZShjaGlsZE5vZGUpID09PSB0YWdOYW1lKSB7XHJcblx0XHRcdFx0ZnVuYyhjaGlsZE5vZGUsIGkpXHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGZ1bmMoY2hpbGROb2RlLCBpKVxyXG5cdFx0fVxyXG5cdFx0aSsrXHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWFwKG5vZGUsIHRhZ05hbWUsIGZ1bmMpIHtcclxuXHRjb25zdCByZXN1bHRzID0gW11cclxuXHRmb3JFYWNoKG5vZGUsIHRhZ05hbWUsIChub2RlLCBpKSA9PiB7XHJcblx0XHRyZXN1bHRzLnB1c2goZnVuYyhub2RlLCBpKSlcclxuXHR9KVxyXG5cdHJldHVybiByZXN1bHRzXHJcbn1cclxuXHJcbmNvbnN0IE5BTUVTUEFDRV9SRUdfRVhQID0gLy4rXFw6L1xyXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGFnTmFtZShlbGVtZW50KSB7XHJcblx0Ly8gRm9yIHNvbWUgd2VpcmQgcmVhc29uLCBpZiBhbiBlbGVtZW50IGlzIGRlY2xhcmVkIGFzLFxyXG5cdC8vIGZvciBleGFtcGxlLCBgPHg6c2hlZXRzLz5gLCB0aGVuIGl0cyBgLnRhZ05hbWVgIHdpbGwgYmVcclxuXHQvLyBcIng6c2hlZXRzXCIgaW5zdGVhZCBvZiBqdXN0IFwic2hlZXRzXCIuXHJcblx0Ly8gaHR0cHM6Ly9naXRsYWIuY29tL2NhdGFtcGhldGFtaW5lL3JlYWQtZXhjZWwtZmlsZS8tL2lzc3Vlcy8yNVxyXG5cdC8vIEl0cyBub3QgY2xlYXIgaG93IHRvIHRlbGwgaXQgdG8gaWdub3JlIGFueSBuYW1lc3BhY2VzXHJcblx0Ly8gd2hlbiBnZXR0aW5nIGAudGFnTmFtZWAsIHNvIGp1c3QgcmVwbGFjaW5nIGFueXRoaW5nXHJcblx0Ly8gYmVmb3JlIGEgY29sb24sIGlmIGFueS5cclxuXHRyZXR1cm4gZWxlbWVudC50YWdOYW1lLnJlcGxhY2UoTkFNRVNQQUNFX1JFR19FWFAsICcnKVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaXNFbGVtZW50KG5vZGUpIHtcclxuXHQvLyBgbm9kZVR5cGU6IDFgIG1lYW5zIFwiRWxlbWVudFwiLlxyXG5cdC8vIGh0dHBzOi8vd3d3Lnczc2Nob29scy5jb20veG1sL3Byb3BfZWxlbWVudF9ub2RldHlwZS5hc3BcclxuXHRyZXR1cm4gbm9kZS5ub2RlVHlwZSA9PT0gMVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0Rmlyc3RFbGVtZW50Q2hpbGQoZWxlbWVudCkge1xyXG4gIGxldCBpID0gMFxyXG4gIHdoaWxlIChpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCkge1xyXG4gIFx0aWYgKGlzRWxlbWVudChlbGVtZW50LmNoaWxkTm9kZXNbaV0pKSB7XHJcblx0XHRcdHJldHVybiBlbGVtZW50LmNoaWxkTm9kZXNbaV1cclxuXHRcdH1cclxuICAgIGkrK1xyXG4gIH1cclxufVxyXG5cclxuLy8gVGhpcyBmdW5jdGlvbiBpcyBvbmx5IHVzZWQgZm9yIG9jY2FzaW9uYWwgZGVidWcgbWVzc2FnZXMuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRPdXRlclhtbChub2RlKSB7XHJcblx0Ly8gYG5vZGVUeXBlOiAxYCBtZWFucyBcIkVsZW1lbnRcIi5cclxuXHQvLyBodHRwczovL3d3dy53M3NjaG9vbHMuY29tL3htbC9wcm9wX2VsZW1lbnRfbm9kZXR5cGUuYXNwXHJcblx0aWYgKG5vZGUubm9kZVR5cGUgIT09IDEpIHtcclxuXHRcdHJldHVybiBub2RlLnRleHRDb250ZW50XHJcblx0fVxyXG5cclxuICBsZXQgeG1sID0gJzwnICsgZ2V0VGFnTmFtZShub2RlKVxyXG5cclxuICBsZXQgaiA9IDBcclxuICB3aGlsZSAoaiA8IG5vZGUuYXR0cmlidXRlcy5sZW5ndGgpIHtcclxuICAgIHhtbCArPSAnICcgKyBub2RlLmF0dHJpYnV0ZXNbal0ubmFtZSArICc9JyArICdcIicgKyBub2RlLmF0dHJpYnV0ZXNbal0udmFsdWUgKyAnXCInXHJcbiAgICBqKytcclxuICB9XHJcblxyXG4gIHhtbCArPSAnPidcclxuXHJcbiAgbGV0IGkgPSAwXHJcbiAgd2hpbGUgKGkgPCBub2RlLmNoaWxkTm9kZXMubGVuZ3RoKSB7XHJcbiAgXHR4bWwgKz0gZ2V0T3V0ZXJYbWwobm9kZS5jaGlsZE5vZGVzW2ldKVxyXG4gICAgaSsrXHJcbiAgfVxyXG5cclxuICB4bWwgKz0gJzwvJyArIGdldFRhZ05hbWUobm9kZSkgKyAnPidcclxuXHJcbiAgcmV0dXJuIHhtbFxyXG59IiwgImltcG9ydCB7IGZpbmRDaGlsZCwgZmluZENoaWxkcmVuLCBmb3JFYWNoLCBtYXAsIGdldEZpcnN0RWxlbWVudENoaWxkLCBnZXRUYWdOYW1lIH0gZnJvbSAnLi9kb20uanMnXHJcblxyXG4vLyBSZXR1cm5zIGFuIGFycmF5IG9mIGNlbGxzLFxyXG4vLyBlYWNoIGVsZW1lbnQgYmVpbmcgYW4gWE1MIERPTSBlbGVtZW50IHJlcHJlc2VudGluZyBhIGNlbGwuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRDZWxsRWxlbWVudHMoZG9jdW1lbnQpIHtcclxuICBjb25zdCB3b3Jrc2hlZXQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcclxuICBjb25zdCBzaGVldERhdGEgPSBmaW5kQ2hpbGQod29ya3NoZWV0LCAnc2hlZXREYXRhJylcclxuXHJcbiAgY29uc3QgY2VsbHMgPSBbXVxyXG4gIGZvckVhY2goc2hlZXREYXRhLCAncm93JywgKHJvdykgPT4ge1xyXG4gICAgZm9yRWFjaChyb3csICdjJywgKGNlbGwpID0+IHtcclxuICAgICAgY2VsbHMucHVzaChjZWxsKVxyXG4gICAgfSlcclxuICB9KVxyXG4gIHJldHVybiBjZWxsc1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWVyZ2VkQ2VsbENvb3JkaW5hdGVzKGRvY3VtZW50KSB7XHJcbiAgY29uc3Qgd29ya3NoZWV0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XHJcbiAgY29uc3QgbWVyZ2VkQ2VsbHMgPSBmaW5kQ2hpbGQod29ya3NoZWV0LCAnbWVyZ2VDZWxscycpXHJcbiAgY29uc3QgbWVyZ2VkQ2VsbHNJbmZvID0gW11cclxuICBpZiAobWVyZ2VkQ2VsbHMpIHtcclxuICAgIGZvckVhY2gobWVyZ2VkQ2VsbHMsICdtZXJnZUNlbGwnLCAobWVyZ2VkQ2VsbCkgPT4ge1xyXG4gICAgICBtZXJnZWRDZWxsc0luZm8ucHVzaChtZXJnZWRDZWxsLmdldEF0dHJpYnV0ZSgncmVmJykpXHJcbiAgICB9KVxyXG4gIH1cclxuICByZXR1cm4gbWVyZ2VkQ2VsbHNJbmZvXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRDZWxsVmFsdWVFbGVtZW50KGRvY3VtZW50LCBlbGVtZW50KSB7XHJcbiAgcmV0dXJuIGZpbmRDaGlsZChlbGVtZW50LCAndicpXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRDZWxsSW5saW5lU3RyaW5nVmFsdWUoZG9jdW1lbnQsIGVsZW1lbnQpIHtcclxuICAvLyBJdCBzZWVtcyBhcyBpZiBpbiBzb21lIHdlaXJkbHktb3V0cHV0IFwiKi54bHN4XCIgZmlsZXNcclxuICAvLyB0aGVyZSdyZSBub24tZWxlbWVudCBub2RlcyBvZiBzb21lIHdlaXJkIG5hdHVyZS5cclxuICAvLyBodHRwczovL2dpdGxhYi5jb20vY2F0YW1waGV0YW1pbmUvcmVhZC1leGNlbC1maWxlLy0vaXNzdWVzLzEwOVxyXG4gIC8vIFRoaXMgY29kZSBmaWx0ZXJzIG91dCBzdWNoIHdlaXJkIG5vbi1lbGVtZW50IG5vZGVzLlxyXG4gIGNvbnN0IGZpcnN0RWxlbWVudENoaWxkID0gZ2V0Rmlyc3RFbGVtZW50Q2hpbGQoZWxlbWVudClcclxuICBpZiAoZmlyc3RFbGVtZW50Q2hpbGQgJiYgZ2V0VGFnTmFtZShmaXJzdEVsZW1lbnRDaGlsZCkgPT09ICdpcycpIHtcclxuICAgIGNvbnN0IGZpcnN0RWxlbWVudENoaWxkRmlyc3RFbGVtZW50Q2hpbGQgPSBnZXRGaXJzdEVsZW1lbnRDaGlsZChmaXJzdEVsZW1lbnRDaGlsZClcclxuICAgIGlmIChmaXJzdEVsZW1lbnRDaGlsZEZpcnN0RWxlbWVudENoaWxkICYmIGdldFRhZ05hbWUoZmlyc3RFbGVtZW50Q2hpbGRGaXJzdEVsZW1lbnRDaGlsZCkgPT09ICd0Jykge1xyXG4gICAgICByZXR1cm4gZmlyc3RFbGVtZW50Q2hpbGRGaXJzdEVsZW1lbnRDaGlsZC50ZXh0Q29udGVudFxyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldERpbWVuc2lvbnMoZG9jdW1lbnQpIHtcclxuICBjb25zdCB3b3Jrc2hlZXQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcclxuICBjb25zdCBkaW1lbnNpb25zID0gZmluZENoaWxkKHdvcmtzaGVldCwgJ2RpbWVuc2lvbicpXHJcbiAgaWYgKGRpbWVuc2lvbnMpIHtcclxuICAgIHJldHVybiBkaW1lbnNpb25zLmdldEF0dHJpYnV0ZSgncmVmJylcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRCYXNlU3R5bGVzKGRvY3VtZW50KSB7XHJcbiAgY29uc3Qgc3R5bGVTaGVldCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxyXG4gIGNvbnN0IGNlbGxTdHlsZVhmcyA9IGZpbmRDaGlsZChzdHlsZVNoZWV0LCAnY2VsbFN0eWxlWGZzJylcclxuICBpZiAoY2VsbFN0eWxlWGZzKSB7XHJcbiAgICByZXR1cm4gZmluZENoaWxkcmVuKGNlbGxTdHlsZVhmcywgJ3hmJylcclxuICB9XHJcbiAgcmV0dXJuIFtdXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRDZWxsU3R5bGVzKGRvY3VtZW50KSB7XHJcbiAgY29uc3Qgc3R5bGVTaGVldCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxyXG4gIGNvbnN0IGNlbGxYZnMgPSBmaW5kQ2hpbGQoc3R5bGVTaGVldCwgJ2NlbGxYZnMnKVxyXG4gIGlmICghY2VsbFhmcykge1xyXG4gICAgcmV0dXJuIFtdXHJcbiAgfVxyXG4gIHJldHVybiBmaW5kQ2hpbGRyZW4oY2VsbFhmcywgJ3hmJylcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldE51bWJlckZvcm1hdHMoZG9jdW1lbnQpIHtcclxuICBjb25zdCBzdHlsZVNoZWV0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XHJcbiAgbGV0IG51bWJlckZvcm1hdHMgPSBbXVxyXG4gIGNvbnN0IG51bUZtdHMgPSBmaW5kQ2hpbGQoc3R5bGVTaGVldCwgJ251bUZtdHMnKVxyXG4gIGlmIChudW1GbXRzKSB7XHJcbiAgICByZXR1cm4gZmluZENoaWxkcmVuKG51bUZtdHMsICdudW1GbXQnKVxyXG4gIH1cclxuICByZXR1cm4gW11cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFNoYXJlZFN0cmluZ3MoZG9jdW1lbnQpIHtcclxuXHQvLyBBbiBgPHNpLz5gIGVsZW1lbnQgY2FuIGNvbnRhaW4gYSBgPHQvPmAgKHNpbXBsZXN0IGNhc2UpIG9yIGEgc2V0IG9mIGA8ci8+YCAoXCJyaWNoIGZvcm1hdHRpbmdcIikgZWxlbWVudHMgaGF2aW5nIGA8dC8+YC5cclxuXHQvL8KgaHR0cHM6Ly9kb2NzLm1pY3Jvc29mdC5jb20vZW4tdXMvZG90bmV0L2FwaS9kb2N1bWVudGZvcm1hdC5vcGVueG1sLnNwcmVhZHNoZWV0LnNoYXJlZHN0cmluZ2l0ZW0/cmVkaXJlY3RlZGZyb209TVNETiZ2aWV3PW9wZW54bWwtMi44LjFcclxuXHQvL8KgaHR0cDovL3d3dy5kYXR5cGljLmNvbS9zYy9vb3htbC9lLXNzbWxfc2ktMS5odG1sXHJcblxyXG4gIGNvbnN0IHNzdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxyXG4gIHJldHVybiBtYXAoc3N0LCAnc2knLCBzdHJpbmcgPT4ge1xyXG4gICAgY29uc3QgdCA9IGZpbmRDaGlsZChzdHJpbmcsICd0JylcclxuICAgIGlmICh0KSB7XHJcbiAgICAgIHJldHVybiB0LnRleHRDb250ZW50XHJcbiAgICB9XHJcbiAgICBsZXQgdmFsdWUgPSAnJ1xyXG4gICAgZm9yRWFjaChzdHJpbmcsICdyJywgKHIpID0+IHtcclxuICAgICAgdmFsdWUgKz0gZmluZENoaWxkKHIsICd0JykudGV4dENvbnRlbnRcclxuICAgIH0pXHJcbiAgICByZXR1cm4gdmFsdWVcclxuICB9KVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ya2Jvb2tQcm9wZXJ0aWVzKGRvY3VtZW50KSB7XHJcbiAgY29uc3Qgd29ya2Jvb2sgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcclxuICByZXR1cm4gZmluZENoaWxkKHdvcmtib29rLCAnd29ya2Jvb2tQcicpXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRSZWxhdGlvbnNoaXBzKGRvY3VtZW50KSB7XHJcbiAgY29uc3QgcmVsYXRpb25zaGlwcyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxyXG4gIHJldHVybiBmaW5kQ2hpbGRyZW4ocmVsYXRpb25zaGlwcywgJ1JlbGF0aW9uc2hpcCcpXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRTaGVldHMoZG9jdW1lbnQpIHtcclxuICBjb25zdCB3b3JrYm9vayA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxyXG4gIGNvbnN0IHNoZWV0cyA9IGZpbmRDaGlsZCh3b3JrYm9vaywgJ3NoZWV0cycpXHJcbiAgcmV0dXJuIGZpbmRDaGlsZHJlbihzaGVldHMsICdzaGVldCcpXHJcbn0iLCAiaW1wb3J0IHtcclxuICBnZXRXb3JrYm9va1Byb3BlcnRpZXMsXHJcbiAgZ2V0U2hlZXRzXHJcbn0gZnJvbSAnLi4veG1sL3hsc3guanMnXHJcblxyXG4vLyBJIGd1ZXNzIGB4bC93b3JrYm9vay54bWxgIGZpbGUgc2hvdWxkIGFsd2F5cyBiZSBwcmVzZW50IGluc2lkZSB0aGUgKi54bHN4IGFyY2hpdmUuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBhcnNlU3ByZWFkc2hlZXRJbmZvKGNvbnRlbnQsIHhtbCkge1xyXG4gIGNvbnN0IGJvb2sgPSB4bWwuY3JlYXRlRG9jdW1lbnQoY29udGVudClcclxuXHJcbiAgLy8gUmVhZCBgPHdvcmtib29rUHIvPmAgZWxlbWVudCB0byBkZXRlY3Qgd2hldGhlciBkYXRlcyBhcmUgMTkwMC1iYXNlZCBvciAxOTA0LWJhc2VkLlxyXG4gIC8vIGh0dHBzOi8vc3VwcG9ydC5taWNyb3NvZnQuY29tL2VuLWdiL2hlbHAvMjE0MzMwL2RpZmZlcmVuY2VzLWJldHdlZW4tdGhlLTE5MDAtYW5kLXRoZS0xOTA0LWRhdGUtc3lzdGVtLWluLWV4Y2VsXHJcbiAgLy8gaHR0cDovL3dlYmFwcC5kb2N4NGphdmEub3JnL09ubGluZURlbW8vZWNtYTM3Ni9TcHJlYWRzaGVldE1ML3dvcmtib29rUHIuaHRtbFxyXG4gIGNvbnN0IHdvcmtib29rUHJvcGVydGllcyA9IGdldFdvcmtib29rUHJvcGVydGllcyhib29rKVxyXG4gIGNvbnN0IGVwb2NoMTkwNCA9IEJvb2xlYW4od29ya2Jvb2tQcm9wZXJ0aWVzKSAmJiB3b3JrYm9va1Byb3BlcnRpZXMuZ2V0QXR0cmlidXRlKCdkYXRlMTkwNCcpID09PSAnMSdcclxuXHJcbiAgLy8gRXhhbXBsZSBvZiBgPHNoZWV0cy8+YCBlbGVtZW50OlxyXG4gIC8vXHJcbiAgLy8gPHNoZWV0cz5cclxuICAvLyAgIDxzaGVldFxyXG4gIC8vICAgICB4bWxuczpucz1cImh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHNcIlxyXG4gIC8vICAgICBuYW1lPVwiU2hlZXQxXCJcclxuICAvLyAgICAgc2hlZXRJZD1cIjFcIlxyXG4gIC8vICAgICBuczppZD1cInJJZDNcIi8+XHJcbiAgLy8gPC9zaGVldHM+XHJcblxyXG4gIGNvbnN0IHNoZWV0cyA9IFtdXHJcbiAgZm9yIChjb25zdCBzaGVldCBvZiBnZXRTaGVldHMoYm9vaykpIHtcclxuICAgIGlmIChzaGVldC5nZXRBdHRyaWJ1dGUoJ25hbWUnKSkge1xyXG4gICAgICBzaGVldHMucHVzaCh7XHJcbiAgICAgICAgaWQ6IHNoZWV0LmdldEF0dHJpYnV0ZSgnc2hlZXRJZCcpLFxyXG4gICAgICAgIG5hbWU6IHNoZWV0LmdldEF0dHJpYnV0ZSgnbmFtZScpLFxyXG4gICAgICAgIHJlbGF0aW9uSWQ6IHNoZWV0LmdldEF0dHJpYnV0ZSgncjppZCcpXHJcbiAgICAgIH0pXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgZXBvY2gxOTA0LFxyXG4gICAgc2hlZXRzXHJcbiAgfVxyXG59IiwgImltcG9ydCB7XHJcbiAgZ2V0UmVsYXRpb25zaGlwc1xyXG59IGZyb20gJy4uL3htbC94bHN4LmpzJ1xyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgc2hlZXQgZmlsZSBwYXRocy5cclxuICogU2VlbXMgdGhhdCB0aGUgY29ycmVjdCBwbGFjZSB0byBsb29rIGZvciB0aGUgYHNoZWV0SWRgIC0+IGBmaWxlbmFtZWAgbWFwcGluZ1xyXG4gKiBpcyBgeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNgIGZpbGUuXHJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS90aWR5dmVyc2UvcmVhZHhsL2lzc3Vlcy8xMDRcclxuICogQHBhcmFtICB7c3RyaW5nfSBjb250ZW50IOKAlCBgeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNgIGZpbGUgY29udGVudHMuXHJcbiAqIEBwYXJhbSAge29iamVjdH0geG1sXHJcbiAqIEByZXR1cm4ge29iamVjdH1cclxuICovXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBhcnNlRmlsZVBhdGhzKGNvbnRlbnQsIHhtbCkge1xyXG4gIC8vIEV4YW1wbGU6XHJcbiAgLy8gPFJlbGF0aW9uc2hpcHMgeG1sbnM9XCJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHNcIj5cclxuICAvLyAgIC4uLlxyXG4gIC8vICAgPFJlbGF0aW9uc2hpcFxyXG4gIC8vICAgICBJZD1cInJJZDNcIlxyXG4gIC8vICAgICBUeXBlPVwiaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy93b3Jrc2hlZXRcIlxyXG4gIC8vICAgICBUYXJnZXQ9XCJ3b3Jrc2hlZXRzL3NoZWV0MS54bWxcIi8+XHJcbiAgLy8gPC9SZWxhdGlvbnNoaXBzPlxyXG4gIGNvbnN0IGRvY3VtZW50ID0geG1sLmNyZWF0ZURvY3VtZW50KGNvbnRlbnQpXHJcblxyXG4gIGNvbnN0IGZpbGVQYXRocyA9IHtcclxuICAgIHNoZWV0czoge30sXHJcbiAgICBzaGFyZWRTdHJpbmdzOiB1bmRlZmluZWQsXHJcbiAgICBzdHlsZXM6IHVuZGVmaW5lZFxyXG4gIH1cclxuXHJcbiAgY29uc3QgYWRkRmlsZVBhdGhJbmZvID0gKHJlbGF0aW9uc2hpcCkgPT4ge1xyXG4gICAgY29uc3QgZmlsZVBhdGggPSByZWxhdGlvbnNoaXAuZ2V0QXR0cmlidXRlKCdUYXJnZXQnKVxyXG4gICAgY29uc3QgZmlsZVR5cGUgPSByZWxhdGlvbnNoaXAuZ2V0QXR0cmlidXRlKCdUeXBlJylcclxuICAgIHN3aXRjaCAoZmlsZVR5cGUpIHtcclxuICAgICAgY2FzZSAnaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9zdHlsZXMnOlxyXG4gICAgICAgIGZpbGVQYXRocy5zdHlsZXMgPSBnZXRGaWxlUGF0aChmaWxlUGF0aClcclxuICAgICAgICBicmVha1xyXG4gICAgICBjYXNlICdodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL3NoYXJlZFN0cmluZ3MnOlxyXG4gICAgICAgIGZpbGVQYXRocy5zaGFyZWRTdHJpbmdzID0gZ2V0RmlsZVBhdGgoZmlsZVBhdGgpXHJcbiAgICAgICAgYnJlYWtcclxuICAgICAgY2FzZSAnaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy93b3Jrc2hlZXQnOlxyXG4gICAgICAgIGZpbGVQYXRocy5zaGVldHNbcmVsYXRpb25zaGlwLmdldEF0dHJpYnV0ZSgnSWQnKV0gPSBnZXRGaWxlUGF0aChmaWxlUGF0aClcclxuICAgICAgICBicmVha1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZ2V0UmVsYXRpb25zaGlwcyhkb2N1bWVudCkuZm9yRWFjaChhZGRGaWxlUGF0aEluZm8pXHJcblxyXG4gIC8vIFNlZW1zIGxpa2UgXCJzaGFyZWRTdHJpbmdzLnhtbFwiIGlzIG5vdCByZXF1aXJlZCB0byBleGlzdC5cclxuICAvLyBGb3IgZXhhbXBsZSwgd2hlbiB0aGUgc3ByZWFkc2hlZXQgZG9lc24ndCBjb250YWluIGFueSBzdHJpbmdzLlxyXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9jYXRhbXBoZXRhbWluZS9yZWFkLWV4Y2VsLWZpbGUvaXNzdWVzLzg1XHJcbiAgLy8gaWYgKCFmaWxlUGF0aHMuc2hhcmVkU3RyaW5ncykge1xyXG4gIC8vICAgdGhyb3cgbmV3IEVycm9yKCdcInNoYXJlZFN0cmluZ3MueG1sXCIgZmlsZSBub3QgZm91bmQgaW4gdGhlICoueGxzeCBmaWxlJylcclxuICAvLyB9XHJcblxyXG4gIHJldHVybiBmaWxlUGF0aHNcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0RmlsZVBhdGgocGF0aCkge1xyXG4gIC8vIE5vcm1hbGx5LCBgcGF0aGAgaXMgYSByZWxhdGl2ZSBwYXRoIGluc2lkZSB0aGUgWklQIGFyY2hpdmUsXHJcbiAgLy8gbGlrZSBcIndvcmtzaGVldHMvc2hlZXQxLnhtbFwiLCBvciBcInNoYXJlZFN0cmluZ3MueG1sXCIsIG9yIFwic3R5bGVzLnhtbFwiLlxyXG4gIC8vIFRoZXJlIGhhcyBiZWVuIG9uZSB3ZWlyZCBjYXNlIHdoZW4gZmlsZSBwYXRoIHdhcyBhbiBhYnNvbHV0ZSBwYXRoLFxyXG4gIC8vIGxpa2UgXCIveGwvd29ya3NoZWV0cy9zaGVldDEueG1sXCIgKHNwZWNpZmljYWxseSBmb3Igc2hlZXRzKTpcclxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vY2F0YW1waGV0YW1pbmUvcmVhZC1leGNlbC1maWxlL3B1bGwvOTVcclxuICAvLyBPdGhlciBsaWJyYXJpZXMgKGxpa2UgYHhsc3hgKSBhbmQgc29mdHdhcmUgKGxpa2UgR29vZ2xlIERvY3MpXHJcbiAgLy8gc2VlbSB0byBzdXBwb3J0IHN1Y2ggYWJzb2x1dGUgZmlsZSBwYXRocywgc28gdGhpcyBsaWJyYXJ5IGRvZXMgdG9vLlxyXG4gIGlmIChwYXRoWzBdID09PSAnLycpIHtcclxuICAgIHJldHVybiBwYXRoLnNsaWNlKCcvJy5sZW5ndGgpXHJcbiAgfVxyXG4gIC8vIC8vIFNlZW1zIGxpa2UgYSBwYXRoIGNvdWxkIGFsc28gYmUgYSBVUkwuXHJcbiAgLy8gLy8gaHR0cDovL29mZmljZW9wZW54bWwuY29tL2FuYXRvbXlvZk9PWE1MLXhsc3gucGhwXHJcbiAgLy8gaWYgKC9eW2Etel0rXFw6XFwvXFwvLy50ZXN0KHBhdGgpKSB7XHJcbiAgLy8gICByZXR1cm4gcGF0aFxyXG4gIC8vIH1cclxuICByZXR1cm4gJ3hsLycgKyBwYXRoXHJcbn0iLCAiaW1wb3J0IHtcclxuICBnZXRCYXNlU3R5bGVzLFxyXG4gIGdldENlbGxTdHlsZXMsXHJcbiAgZ2V0TnVtYmVyRm9ybWF0c1xyXG59IGZyb20gJy4uL3htbC94bHN4LmpzJ1xyXG5cclxuLy8gaHR0cDovL29mZmljZW9wZW54bWwuY29tL1NTc3R5bGVzLnBocFxyXG4vLyBSZXR1cm5zIGFuIGFycmF5IG9mIGNlbGwgc3R5bGVzLlxyXG4vLyBBIGNlbGwgc3R5bGUgaW5kZXggaXMgaXRzIElELlxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYXJzZVN0eWxlcyhjb250ZW50LCB4bWwpIHtcclxuICBpZiAoIWNvbnRlbnQpIHtcclxuICAgIHJldHVybiB7fVxyXG4gIH1cclxuXHJcbiAgLy8gaHR0cHM6Ly9zb2NpYWwubXNkbi5taWNyb3NvZnQuY29tL0ZvcnVtcy9zcWxzZXJ2ZXIvZW4tVVMvNzA4OTc4YWYtYjU5OC00NWM0LWE1OTgtZDM1MThhNWEwOWYwL2hvd3doZW4taXMtY2VsbHN0eWxleGZzLXZzLWNlbGx4ZnMtYXBwbGllZC10by1hLWNlbGw/Zm9ydW09b3NfYmluYXJ5ZmlsZVxyXG4gIC8vIGh0dHBzOi8vd3d3Lm9mZmljZS1mb3J1bXMuY29tL3RocmVhZHMvY2VsbHhmcy1jZWxsc3R5bGV4ZnMuMjE2MzUxOS9cclxuICBjb25zdCBkb2MgPSB4bWwuY3JlYXRlRG9jdW1lbnQoY29udGVudClcclxuXHJcbiAgY29uc3QgYmFzZVN0eWxlcyA9IGdldEJhc2VTdHlsZXMoZG9jKVxyXG4gICAgLm1hcChwYXJzZUNlbGxTdHlsZSlcclxuXHJcbiAgY29uc3QgbnVtYmVyRm9ybWF0cyA9IGdldE51bWJlckZvcm1hdHMoZG9jKVxyXG4gICAgLm1hcChwYXJzZU51bWJlckZvcm1hdFN0eWxlKVxyXG4gICAgLnJlZHVjZSgoZm9ybWF0cywgZm9ybWF0KSA9PiB7XHJcbiAgICAgIC8vIEZvcm1hdCBJRCBpcyBhIG51bWVyaWMgaW5kZXguXHJcbiAgICAgIC8vIFRoZXJlJ3JlIHNvbWUgc3RhbmRhcmQgXCJidWlsdC1pblwiIGZvcm1hdHMgKGluIEV4Y2VsKSB1cCB0byBhYm91dCBgMTAwYC5cclxuICAgICAgZm9ybWF0c1tmb3JtYXQuaWRdID0gZm9ybWF0XHJcbiAgICAgIHJldHVybiBmb3JtYXRzXHJcbiAgICB9LCBbXSlcclxuXHJcbiAgY29uc3QgZ2V0Q2VsbFN0eWxlID0gKHhmKSA9PiB7XHJcbiAgICBpZiAoeGYuaGFzQXR0cmlidXRlKCd4ZklkJykpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICAuLi5iYXNlU3R5bGVzW3hmLnhmSWRdLFxyXG4gICAgICAgIC4uLnBhcnNlQ2VsbFN0eWxlKHhmLCBudW1iZXJGb3JtYXRzKVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGFyc2VDZWxsU3R5bGUoeGYsIG51bWJlckZvcm1hdHMpXHJcbiAgfVxyXG5cclxuICByZXR1cm4gZ2V0Q2VsbFN0eWxlcyhkb2MpLm1hcChnZXRDZWxsU3R5bGUpXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlTnVtYmVyRm9ybWF0U3R5bGUobnVtRm10KSB7XHJcbiAgcmV0dXJuIHtcclxuICAgIGlkOiBudW1GbXQuZ2V0QXR0cmlidXRlKCdudW1GbXRJZCcpLFxyXG4gICAgdGVtcGxhdGU6IG51bUZtdC5nZXRBdHRyaWJ1dGUoJ2Zvcm1hdENvZGUnKVxyXG4gIH1cclxufVxyXG5cclxuLy8gaHR0cDovL3d3dy5kYXR5cGljLmNvbS9zYy9vb3htbC9lLXNzbWxfeGYtMi5odG1sXHJcbmZ1bmN0aW9uIHBhcnNlQ2VsbFN0eWxlKHhmLCBudW1GbXRzKSB7XHJcbiAgY29uc3Qgc3R5bGUgPSB7fVxyXG4gIGlmICh4Zi5oYXNBdHRyaWJ1dGUoJ251bUZtdElkJykpIHtcclxuICAgIGNvbnN0IG51bWJlckZvcm1hdElkID0geGYuZ2V0QXR0cmlidXRlKCdudW1GbXRJZCcpXHJcbiAgICAvLyBCdWlsdC1pbiBudW1iZXIgZm9ybWF0cyBkb24ndCBoYXZlIGEgYDxudW1GbXQvPmAgZWxlbWVudCBpbiBgc3R5bGVzLnhtbGAuXHJcbiAgICAvLyBodHRwczovL2hleGRvY3MucG0veGxzeGlyL251bWJlcl9zdHlsZXMuaHRtbFxyXG4gICAgaWYgKG51bUZtdHNbbnVtYmVyRm9ybWF0SWRdKSB7XHJcbiAgICAgIHN0eWxlLm51bWJlckZvcm1hdCA9IG51bUZtdHNbbnVtYmVyRm9ybWF0SWRdXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzdHlsZS5udW1iZXJGb3JtYXQgPSB7IGlkOiBudW1iZXJGb3JtYXRJZCB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBzdHlsZVxyXG59IiwgImltcG9ydCB7XHJcbiAgZ2V0U2hhcmVkU3RyaW5nc1xyXG59IGZyb20gJy4uL3htbC94bHN4LmpzJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcGFyc2VTaGFyZWRTdHJpbmdzKGNvbnRlbnQsIHhtbCkge1xyXG4gIGlmICghY29udGVudCkge1xyXG4gICAgcmV0dXJuIFtdXHJcbiAgfVxyXG4gIHJldHVybiBnZXRTaGFyZWRTdHJpbmdzKHhtbC5jcmVhdGVEb2N1bWVudChjb250ZW50KSlcclxufSIsICIvLyBQYXJzZXMgYW4gRXhjZWwgRGF0ZSAocmVwcmVzZW50ZWQgYnkgYSBcInNlcmlhbFwiIGZsb2F0aW5nLXBvaW50IG51bWJlcilcclxuLy8gaW50byBhIGphdmFzY3JpcHQgYERhdGVgIGluIFVUQyswIHRpbWV6b25lICh3aXRoIHRpbWUgaXMgc2V0IHRvIDAwOjAwKS5cclxuLy9cclxuLy8gaHR0cHM6Ly93d3cucGN3b3JsZC5jb20vYXJ0aWNsZS8zMDYzNjIyL3NvZnR3YXJlL21hc3RlcmluZy1leGNlbC1kYXRlLXRpbWUtc2VyaWFsLW51bWJlcnMtbmV0d29ya2RheXMtZGF0ZXZhbHVlLWFuZC1tb3JlLmh0bWxcclxuLy8gXCJJZiB5b3UgbmVlZCB0byBjYWxjdWxhdGUgZGF0ZXMgaW4geW91ciBzcHJlYWRzaGVldHMsXHJcbi8vICBFeGNlbCB1c2VzIGl0cyBvd24gdW5pcXVlIHN5c3RlbSwgd2hpY2ggaXQgY2FsbHMgU2VyaWFsIE51bWJlcnNcIi5cclxuLy9cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcGFyc2VFeGNlbERhdGUoZXhjZWxTZXJpYWxEYXRlLCBvcHRpb25zKSB7XHJcbiAgLy8gV2luZG93cyBvcGVyYXRpbmcgc3lzdGVtIHVzZXMgZmxvYXRpbmctcG9pbnQgbnVtYmVycyB0byByZXByZXNlbnQgZGF0ZXMsXHJcbiAgLy8gd2hlcmUgdGhlIG51bWJlciByZXByZXNlbnRzIHRoZSBjb3VudCBvZiBkYXlzIGVsYXBzZWQgc2luY2UgSmFudWFyeSAwdGgsIDE5MDAuXHJcbiAgLy9cclxuICAvLyBUaGlzIGFsc28gbWVhbnMgdGhhdCB0aGVyZSdyZSAyIGFzcGVjdHMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgY2hvaWNlOlxyXG4gIC8vXHJcbiAgLy8gKiBKYW51YXJ5IDFzdCwgMTkwMCwgMDA6MDAgaXMgcmVwcmVzZW50ZWQgYnkgYDFgIHJhdGhlciB0aGFuIGAwYCwgd2hpY2ggbG9va3MgYSBiaXQgd2VpcmQuXHJcbiAgLy8gKiAxOTAwIGlzIGEgc3BlY2lhbCB5ZWFyIGJlY2F1c2UgaXQncyBhIFwib25lIGluIGEgMTAwIHllYXJzXCIgb2NjYXNpb24gd2hlbiBpdCdzIG5vdCBhIGxlYXAgeWVhci5cclxuICAvL1xyXG4gIC8vIFRvIHdvcmsgYXJvdW5kIHRob3NlIHR3byBhc3BlY3RzLCBNYWMgT1MgY2hvc2UgYW5vdGhlciBiYXNlbGluZSDigJQgSmFudWFyeSAxc3QsIDE5MDAuXHJcbiAgLy8gQWx0aG91Z2gsIHRoYXQgb25seSBwb3N0cG9uZWQgdGhlIHNlY29uZCBpc3N1ZSBiZWNhdXNlIDIxMDAgaXMgZ29pbmcgdG8gYmUgdGhlIG5leHQgXCJzcGVjaWFMXCIgeWVhclxyXG4gIC8vIHdoaWNoIGlzIG5vdCBnb2luZyB0byBiZSBhIFwibGVhcFwiIG9uZS5cclxuICAvL1xyXG4gIC8vIE9sZGVyIHZlcnNpb25zIG9mIEV4Y2VsIG9uIE1hYyBPUyB1c2VkIHllYXIgMTkwNCBhcyB0aGUgZGVmYXVsdCBiYXNlbGluZSBmb3IgbnVtZXJpYyBkYXRlcy5cclxuICAvLyBTaW5jZSAyMDExLCBNaWNyb3NvZnQgRXhjZWwgb24gTWFjIE9TIHVzZXMgeWVhciAxOTAwIGFzIHRoZSBkZWZhdWx0IGJhc2VsaW5lIGZvciBjcm9zcy1wbGF0Zm9ybSBjb25zaXN0ZW5jeS5cclxuICAvLyBodHRwczovL3N1cHBvcnQubWljcm9zb2Z0LmNvbS9lbi11cy9vZmZpY2UvZGF0ZS1zeXN0ZW1zLWluLWV4Y2VsLWU3ZmU3MTY3LTQ4YTktNGI5Ni1iYjUzLTU2MTJhODAwYjQ4N1xyXG4gIC8vXHJcbiAgLy8gU28gdGhlIDE5MDQgYmFzZWxpbmUgaXMgbm93IGRlcHJlY2F0ZWQsIGFsdGhvdWdoIHN0aWxsIGF2YWlsYWJsZSB0byBiZSBjb25maWd1cmVkIG1hbnVhbGx5LlxyXG4gIC8vIFNvIGl0IHN0aWxsIG1pZ2h0IGJlIGVuY291bnRlcmVkIGluIEV4Y2VsIGZpbGVzIGNyZWF0ZWQgb24gTWFjT1MuXHJcbiAgLy8gSW4gdGhhdCBjYXNlLCB0aGUgRXhjZWwgZmlsZSBjb250YWlucyBhIHNwZWNpYWwgZmxhZyDigJQgYDx3b3JrYm9vaz48d29ya2Jvb2tQciBkYXRlMTkwND1cIjFcIi8+Li4uYCDigJRcclxuICAvLyB0aGF0IHRlbGxzIHRoZSBhcHBsaWNhdGlvbiB3aGljaCBiYXNlbGluZSBpcyBiZWluZyB1c2VkIGZvciBudW1lcmljIGRhdGUgdGltZXN0YW1wcy5cclxuICAvL1xyXG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZXBvY2gxOTA0KSB7XHJcbiAgICAvLyBDb252ZXJ0IHRoZSBudW1lcmljIGRhdGUgdGltZXN0YW1wIGZyb20gMTkwNCBiYXNlbGluZSB0byAxOTAwIGJhc2VsaW5lLlxyXG4gICAgZXhjZWxTZXJpYWxEYXRlICs9ICgxOTA0IC0gMTkwMCkgKiBEQVlTX0lOX1lFQVIgKyBKQU5VQVJZXzBUSF8xOTAwX0RBWSArIEVSUk9ORU9VU19GRUJSVUFSWV8yOV8xOTkwX0RBWVxyXG4gIH1cclxuXHJcbiAgY29uc3QgZGF5c0JlZm9yZVVuaXhFcG9jaCA9IEpBTlVBUllfMFRIXzE5MDBfREFZICsgRVJST05FT1VTX0ZFQlJVQVJZXzI5XzE5OTBfREFZICsgKDE5NzAgLSAxOTAwKSAqIERBWVNfSU5fWUVBUiArIE5VTUJFUl9PRl9MRUFQX1lFQVJTX0JFVFdFRU5fMTkwMF9BTkRfMTk3MFxyXG5cclxuICByZXR1cm4gbmV3IERhdGUoTWF0aC5mbG9vcigoZXhjZWxTZXJpYWxEYXRlIC0gZGF5c0JlZm9yZVVuaXhFcG9jaCkgKiBEQVkpKVxyXG59XHJcblxyXG4vLyBcIkV4Y2VsIHNlcmlhbCBkYXRlXCIgaXMganVzdCBhIChmcmFjdGlvbmFsKSBjb3VudCBvZiBkYXlzIHBhc3NlZCBzaW5jZSBgMDAvMDEvMTkwMGAuXHJcbi8vXHJcbi8vIEluIGNvbnRyYXN0LCBcIlVuaXggdGltZXN0YW1wc1wiIHVzZSBgMDEvMDEvMTk3MGAgYXMgdGhlIGJhc2VsaW5lIGZvciBudW1lcmljIGRhdGVzLlxyXG4vL1xyXG4vLyBJbiBvcmRlciB0byBjb252ZXJ0IG9uZSBpbnRvIGFub3RoZXIsIGl0IHNob3VsZCBjYWxjdWxhdGUgdGhlIGNvdW50IG9mIGRheXMgZWxhcHNlZFxyXG4vLyBzaW5jZSBgMDAvMDEvMTkwMGAgKEV4Y2VsIGVwb2NoKSB0aWxsIGAwMS8wMS8xOTcwYCAoVW5peCBlcG9jaCksIG9yIHRoZSBjb3VudCBvZiBkYXlzXHJcbi8vIGJldHdlZW4geWVhciBgMTkwMGAgYW5kIHllYXIgYDE5NzBgLCBwbHVzIG9uZSBkYXkuXHJcbi8vXHJcbi8vIEl0IGFsc28gc2hvdWxkIGFjY291bnQgZm9yIHRoZSBudW1iZXIgb2YgXCJsZWFwIHllYXJzXCIgYmV0d2VlbiB5ZWFyIGAxOTAwYCBhbmQgeWVhciBgMTk3MGAsXHJcbi8vIHdoaWNoIGlzIDE3IG9mIHRoZW0uIGh0dHBzOi8va2FsZW5kZXItMzY1LmRlL2xlYXAteWVhcnMucGhwXHJcbi8vXHJcbi8vIFwiT25lIHllYXIgaGFzIHRoZSBsZW5ndGggb2YgMzY1IGRheXMsIDUgaG91cnMsIDQ4IG1pbnV0ZXMgYW5kIDQ1IHNlY29uZHMuXHJcbi8vICBUaGVzZSBhcmUgMzY1LjI0MjE4NzUgZGF5cy4gVGhpcyBpcyBoYXJkIHRvIGNhbGN1bGF0ZSB3aXRoLCBzbyBmb3IgcHJhY3RpY2FsIHJlYXNvbnNcclxuLy8gIGEgbm9ybWFsIHllYXIgaGFzIGJlZW4gZ2l2ZW4gMzY1IGRheXMgYW5kIGEgbGVhcCB5ZWFyIDM2NiBkYXlzLiBJbiBsZWFwIHllYXJzLFxyXG4vLyAgRmVicnVhcnkgMjl0aCBpcyBhZGRlZCBhcyBsZWFwIGRheSwgd2hpY2ggZG9lc24ndCBleGlzdCBpbiBhIG5vcm1hbCB5ZWFyLlxyXG4vLyAgQSBsZWFwIHllYXIgaXMgZXZlcnkgNCB5ZWFycywgYnV0IG5vdCBldmVyeSAxMDAgeWVhcnMsIHRoZW4gYWdhaW4gZXZlcnkgNDAwIHllYXJzLlxyXG4vLyAgU28gdGhlIHllYXIgMTkwMCB3YXNuJ3QgYSBsZWFwIHllYXIsIGJ1dCAyMDAwIHdhc1wiLlxyXG4vL1xyXG4vLyBBbmQgYWxzbywgRXhjZWwgaGFzIGEgaGlzdG9yaWNhbCBidWcgd2hlbiBpdCBpbmNvcnJlY3RseSBhc3N1bWVzIHllYXIgYDE5MDBgIHRvIGJlIGEgbGVhcCB5ZWFyLFxyXG4vLyBhbmQsIGFzIGEgcmVzdWx0LCBhbGwgRXhjZWwgc2VyaWFsIGRhdGVzIHN0YXJ0aW5nIGZyb20gTWFyY2ggMXN0LCAxOTAwIGxhZyAxIGRheSBiZWhpbmRcclxuLy8gYW5kIHJlcXVpcmUgYW4gYWRkaXRpb25hbCAxIGRheSB0byBiZSBhZGRlZCB0byB0aGVtIGluIG9yZGVyIHRvIGJlIGNvbnZlcnRlZCB0byBhIHByb3BlciB0aW1lc3RhbXAuXHJcbi8vXHJcbi8vIGh0dHBzOi8vbGVhcm4ubWljcm9zb2Z0LmNvbS9lbi11cy9hbnN3ZXJzL3F1ZXN0aW9ucy81MjQ5MzIyL3doeS1kb2VzLW1pY3Jvc29mdC1leGNlbC1jb25zaWRlcnMtMjktMDItMTkwMC10by1iP2ZvcnVtPW1zb2ZmaWNlLWFsbCZyZWZlcnJlcj1hbnN3ZXJzIzp+OnRleHQ9VGhpcyUyMG1hZGUlMjBpdCUyMGVhc2llciUyMGZvcixvdGhlciUyMHByb2dyYW1zJTIwdGhhdCUyMHVzZSUyMGRhdGVzLlxyXG4vL1xyXG4vLyBcIldoZW4gTG90dXMgMS0yLTMgd2FzIGZpcnN0IHJlbGVhc2VkLCB0aGUgcHJvZ3JhbSBhc3N1bWVkIHRoYXQgdGhlIHllYXIgMTkwMCB3YXMgYSBsZWFwIHllYXIsXHJcbi8vICBldmVuIHRob3VnaCBpdCBhY3R1YWxseSB3YXMgbm90IGEgbGVhcCB5ZWFyLiBUaGlzIG1hZGUgaXQgZWFzaWVyIGZvciB0aGUgcHJvZ3JhbSB0byBoYW5kbGVcclxuLy8gIGxlYXAgeWVhcnMgYW5kIGNhdXNlZCBubyBoYXJtIHRvIGFsbW9zdCBhbGwgZGF0ZSBjYWxjdWxhdGlvbnMgaW4gTG90dXMgMS0yLTMuXHJcbi8vXHJcbi8vICBXaGVuIE1pY3Jvc29mdCBNdWx0aXBsYW4gYW5kIE1pY3Jvc29mdCBFeGNlbCB3ZXJlIHJlbGVhc2VkLCB0aGV5IGFsc28gYXNzdW1lZCB0aGF0IDE5MDBcclxuLy8gIHdhcyBhIGxlYXAgeWVhci4gVGhpcyBhc3N1bXB0aW9uIGFsbG93ZWQgTWljcm9zb2Z0IE11bHRpcGxhbiBhbmQgTWljcm9zb2Z0IEV4Y2VsIHRvIHVzZVxyXG4vLyAgdGhlIHNhbWUgc2VyaWFsIGRhdGUgc3lzdGVtIHVzZWQgYnkgTG90dXMgMS0yLTMgYW5kIHByb3ZpZGUgZ3JlYXRlciBjb21wYXRpYmlsaXR5IHdpdGggTG90dXMgMS0yLTMuXHJcbi8vICBUcmVhdGluZyAxOTAwIGFzIGEgbGVhcCB5ZWFyIGFsc28gbWFkZSBpdCBlYXNpZXIgZm9yIHVzZXJzIHRvIG1vdmUgd29ya3NoZWV0cyBmcm9tIG9uZSBwcm9ncmFtXHJcbi8vICB0byB0aGUgb3RoZXJcIi5cclxuLy9cclxuLy8gU28gdGhlIGhpc3RvcmljYWwgYnVnIGlzIGJhc2ljYWxseSB0aGF0IEV4Y2VsIHRoaW5rcyB0aGF0IEZlYnJ1YXJ5IDI5dGgsIDE5MDAgZXhpc3RlZFxyXG4vLyB3aGlsZSBpbiByZWFsaXR5IGl0IGRpZG4ndC4gVGhhdCdzIHdoeSBpdCdzIGFjdHVhbGx5IDEgZGF5IG9mZiBmb3IgYW55IGRhdGUgYWZ0ZXIgdGhhdCBvbmUuXHJcbi8vXHJcbmNvbnN0IE5VTUJFUl9PRl9MRUFQX1lFQVJTX0JFVFdFRU5fMTkwMF9BTkRfMTk3MCA9IDE3XHJcbmNvbnN0IEpBTlVBUllfMFRIXzE5MDBfREFZID0gMVxyXG5jb25zdCBFUlJPTkVPVVNfRkVCUlVBUllfMjlfMTk5MF9EQVkgPSAxXHJcblxyXG4vLyBBbiBhcHByb3hpbWF0ZSBjb3VudCBvZiBzZWNvbmRzIGluIGEgZGF5IGlzOlxyXG4vLyAyNCBob3VycyAqIDYwIG1pbnV0ZXMgaW4gYW4gaG91ciAqIDYwIHNlY29uZHMgaW4gYSBtaW51dGVcclxuLy9cclxuLy8gSXQgaXMgYXBwcm94aW1hdGUgYmVjYXVzZSBhIG1pbnV0ZSBjb3VsZCBiZSBsb25nZXIgdGhhbiA2MCBzZWNvbmRzLCBkdWUgdG8gXCJsZWFwIHNlY29uZHNcIi5cclxuLy9cclxuLy8gU3RpbGwsIGphdmFzY3JpcHQgYERhdGVgLCBhbmQgVU5JWCB0aW1lIGluIGdlbmVyYWwsIGludGVudGlvbmFsbHlcclxuLy8gZHJvcCB0aGUgY29uY2VwdCBvZiBcImxlYXAgc2Vjb25kc1wiIGluIG9yZGVyIHRvIG1ha2UgdGhpbmdzIHNpbXBsZXIuXHJcbi8vIFNvIHRoaXMgYXBwcm94aW1hdGlvbiBpcyB2YWxpZCBhbmQgZG9lc24ndCByZXN1bHQgaW4gYW55IGJ1Z3MuXHJcbi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzUzMDE5NzI2L3doZXJlLWFyZS10aGUtbGVhcC1zZWNvbmRzLWluLWphdmFzY3JpcHRcclxuLy9cclxuLy8gXCJUaGUgSmF2YVNjcmlwdCBEYXRlIG9iamVjdCBzcGVjaWZpY2FsbHkgYWRoZXJlcyB0byB0aGUgY29uY2VwdCBvZiBVbml4IFRpbWVcclxuLy8gIChhbGJlaXQgd2l0aCBoaWdoZXIgcHJlY2lzaW9uKS4gVGhpcyBpcyBwYXJ0IG9mIHRoZSBQT1NJWCBzcGVjaWZpY2F0aW9uLFxyXG4vLyAgYW5kIHRodXMgaXMgc29tZXRpbWVzIGNhbGxlZCBcIlBPU0lYIFRpbWVcIi4gSXQgZG9lcyBub3QgY291bnQgbGVhcCBzZWNvbmRzLFxyXG4vLyAgYnV0IHJhdGhlciBhc3N1bWVzIGV2ZXJ5IGRheSBoYWQgZXhhY3RseSA4Niw0MDAgc2Vjb25kcy4gWW91IGNhbiByZWFkIGFib3V0XHJcbi8vICB0aGlzIGluIHNlY3Rpb24gMjAuMy4xLjEgb2YgdGhlIGN1cnJlbnQgRUNNQVNjcmlwdCBzcGVjaWZpY2F0aW9uLCB3aGljaCBzdGF0ZXM6XHJcbi8vXHJcbi8vICBcIlRpbWUgaXMgbWVhc3VyZWQgaW4gRUNNQVNjcmlwdCBpbiBtaWxsaXNlY29uZHMgc2luY2UgMDEgSmFudWFyeSwgMTk3MCBVVEMuXHJcbi8vICAgSW4gdGltZSB2YWx1ZXMgbGVhcCBzZWNvbmRzIGFyZSBpZ25vcmVkLiBJdCBpcyBhc3N1bWVkIHRoYXQgdGhlcmUgYXJlIGV4YWN0bHlcclxuLy8gICA4Niw0MDAsMDAwIG1pbGxpc2Vjb25kcyBwZXIgZGF5LlwiXHJcbi8vXHJcbi8vIFRoZSByZWFzb24gaXMgdGhhdCB0aGUgdW5wcmVkaWN0YWJsZSBuYXR1cmUgb2YgbGVhcCBzZWNvbmRzIG1ha2VzIHRoZW0gdmVyeVxyXG4vLyBkaWZmaWN1bHQgdG8gd29yayB3aXRoIGluIEFQSXMuIE9uZSBjYW4ndCBnZW5lcmFsbHkgcGFzcyB0aW1lc3RhbXBzIGFyb3VuZFxyXG4vLyB0aGF0IG5lZWQgbGVhcCBzZWNvbmRzIHRhYmxlcyB0byBiZSBpbnRlcnByZXRlZCBjb3JyZWN0bHksIGFuZCBleHBlY3QgdGhhdFxyXG4vLyBvbmUgc3lzdGVtIHdpbGwgaW50ZXJwcmV0IHRoZW0gdGhlIHNhbWUgYXMgYW5vdGhlci4gRm9yIGV4YW1wbGUsIGEgdGltZXN0YW1wXHJcbi8vIGAxNDgzMjI4ODI2YCB0aGF0IGFjY291bnRzIGZvciBcImxlYXAgc2Vjb25kc1wiIHNob3VsZCd2ZSBiZWVuIGludGVycHJldGVkIGFzXHJcbi8vIFwiMjAxNy0wMS0wMVQwMDowMDowMFpcIiwgYnV0IGlmIHRoZSByZWNlaXZlciBkb2Vzbid0IGFjY291bnQgZm9yIFwibGVhcCBzZWNvbmRzXCIsXHJcbi8vIHRoZXkgd291bGQgaW50ZXJwcmV0IGl0IGFzIFwiMjAxNy0wMS0wMVQwMDowMDoyNlpcIiAoZS5nLiBQT1NJWC1iYXNlZCBzeXN0ZW1zIGxpa2UgTGludXgpLFxyXG4vLyBTbyBcImxlYXAgc2Vjb25kc1wiIGFyZW4ndCByZWFsbHkgcG9ydGFibGUuXHJcbi8vIEV2ZW4gb24gc3lzdGVtcyB0aGF0IGhhdmUgZnVsbCBmcmVxdWVudGx5LXVwZGF0ZWQgXCJsZWFwIHNlY29uZFwiIHRhYmxlcyxcclxuLy8gdGhlcmUncyBubyB0ZWxsaW5nIHdoYXQgYWRqdXN0bWVudHMgdGhvc2UgdGFibGVzIHdpbGwgY29udGFpbiBpbiB0aGUgZnV0dXJlXHJcbi8vIChpLmUuIGJleW9uZCB0aGUgNi1tb250aCBJRVJTIGFubm91bmNlbWVudCBwZXJpb2QpIGJlY2F1c2UgXCJsZWFwIHNlY29uZHNcIiBjYW4ndCBiZVxyXG4vLyBkZXRlcm1pbmVkIGJ5IGEgZml4ZWQgbWF0aGVtYXRpY2FsIGZvcm11bGEgb3Igc29tZXRoaW5nIGxpa2UgdGhhdC4gSW5zdGVhZCxcclxuLy8gc2NpZW50aXN0cyBpbnRyb2R1Y2UgdGhlbSBhcyBuZWVkZWQgYmFzZWQgb24gdGhlIG9ic2VydmVkIEVhcnRoJ3Mgcm90YXRpb24gYXJvdW5kIHRoZSBzdW4uXHJcbi8vXHJcbi8vIFwiQmVjYXVzZSB0aGUgRWFydGgncyByb3RhdGlvbmFsIHNwZWVkIHZhcmllcyBpbiByZXNwb25zZSB0byBjbGltYXRpYyBhbmQgZ2VvbG9naWNhbCBldmVudHMsXHJcbi8vICBVVEMgbGVhcCBzZWNvbmRzIGFyZSBpcnJlZ3VsYXJseSBzcGFjZWQgYW5kIG5vdCBwcmVjaXNlbHkgcHJlZGljdGFibGUuIFRoZSBkZWNpc2lvbiB0byBpbnNlcnRcclxuLy8gYSBsZWFwIHNlY29uZCBpcyBtYWRlIGJ5IHRoZSBJbnRlcm5hdGlvbmFsIEVhcnRoIFJvdGF0aW9uIGFuZCBSZWZlcmVuY2UgU3lzdGVtcyBTZXJ2aWNlIChJRVJTKSxcclxuLy8gdHlwaWNhbGx5IGFib3V0IHNpeCBtb250aHMgaW4gYWR2YW5jZSwgdG8gZW5zdXJlIHRoYXQgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBVVEMgYW5kIFVUMVxyXG4vLyBkb2VzIG5vdCBleGNlZWQgwrEwLjkgc2Vjb25kcy5cIlxyXG4vL1xyXG4vLyBPbmUgZXhhbXBsZSBpcyB5ZWFyIGAxOTAwYCB3aGljaCBpcyBcImV2ZXJ5IGZvdXJ0aCB5ZWFyXCIgYnV0IGl0IHN0aWxsIGlzIG5vdCBhIFwibGVhcCB5ZWFyXCIuXHJcbi8vXHJcbi8vIFRvIHJlaXRlcmF0ZTogdG8gc3VwcG9ydCBsZWFwIHNlY29uZHMgaW4gYSBwcm9ncmFtbWluZyBsYW5ndWFnZSwgdGhlIGltcGxlbWVudGF0aW9uXHJcbi8vIG11c3QgZ28gb3V0IG9mIGl0cyB3YXkgdG8gZG8gc28sIGFuZCBtdXN0IG1ha2UgdHJhZGVvZmZzIHRoYXQgYXJlIG5vdCBhbHdheXMgYWNjZXB0YWJsZS5cclxuLy8gVGhvdWdoIHRoZXJlIGFyZSBleGNlcHRpb25zLCB0aGUgZ2VuZXJhbCBwb3NpdGlvbiBpcyB0byBub3Qgc3VwcG9ydCB0aGVtIC0gbm90IGJlY2F1c2VcclxuLy8gb2YgYW55IHN1YnZlcnNpb24gb3IgYWN0aXZlIGNvdW50ZXJtZWFzdXJlcywgYnV0IGJlY2F1c2Ugc3VwcG9ydGluZyB0aGVtIHByb3Blcmx5IGlzIG11Y2gsXHJcbi8vIG11Y2ggaGFyZGVyLlxyXG4vL1xyXG4vLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Vbml4X3RpbWUjTGVhcF9zZWNvbmRzXHJcbi8vIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0xlYXBfeWVhclxyXG4vLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9MZWFwX3NlY29uZFxyXG4vL1xyXG5jb25zdCBEQVkgPSAyNCAqIDYwICogNjAgKiAxMDAwXHJcbmNvbnN0IERBWVNfSU5fWUVBUiA9IDM2NVxyXG4iLCAiLy8gT24gc29tZSBkYXRlIGZvcm1hdHMsIHRoZXJlJ3MgYSBcIlskLS4uLl1cIiBwcmVmaXggdGhhdCBsb2NrcyB0aGUgbG9jYWxlXHJcbi8vIHRvIGJlIGEgc3BlY2lmaWMgb25lIHdoZW4gZm9ybWF0dGluZyBhIGRhdGUgdXNpbmcgdGhpcyBmb3JtYXQuXHJcbi8vXHJcbi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQ3MzAxNTIvd2hhdC1pbmRpY2F0ZXMtYW4tb2ZmaWNlLW9wZW4teG1sLWNlbGwtY29udGFpbnMtYS1kYXRlLXRpbWUtdmFsdWVcclxuLy9cclxuLy8gRm9ybWF0IGV4YW1wbGVzOlxyXG4vL1xyXG4vLyAqIFwiWyQtNDA0XWUvbS9kXCJcclxuLy8gKiBcIlskLTQxNF1tbW1tXFwgeXl5eTtAXCJcclxuLy8gKiBcIlskLXJ1LVJVXWRkLm1tLnl5eXk7QFwiXHJcbi8vICogXCJbJC14LXN5c2RhdGVdZGRkZCwgbW1tbSBkZCwgeXl5eVwiXHJcbi8vXHJcbmNvbnN0IERBVEVfRk9STUFUX1NQRUNJRklDX0xPQ0FMRV9QUkVGSVggPSAvXlxcW1xcJC1bXlxcXV0rXFxdL1xyXG5cclxuLy8gT24gc29tZSBkYXRlIGZvcm1hdHMsIHRoZXJlJ3MgYSBcIjtAXCIgc3VmZml4LlxyXG4vLyBJdCBpbnN0cnVjdHMgdGhlIHNwcmVhZHNoZWV0IGVkaXRvciBhcHBsaWNhdGlvbiB0byBkaXNwbGF5IGFueSBub24tbnVtZXJpY1xyXG4vLyB2YWx1ZSBhcyBpcyBpbnN0ZWFkIG9mIGhpZGluZyBpdCBvciBzb21ldGhpbmcgbGlrZSB0aGF0LlxyXG4vL1xyXG4vLyBGb3IgZXhhbXBsZSwgaWYgb25lIGlucHV0cyBcIlNvbWUgdGV4dFwiIGluc3RlYWQgb2YgYSBkYXRlIGluIHN1Y2ggY2VsbCxcclxuLy8gaXQgd2lsbCBzdGlsbCBzaG93IFwiU29tZSB0ZXh0XCIgaW5zdGVhZCBvZiBhbiBlbXB0eSBjZWxsLCBldmVuIHRob3VnaFxyXG4vLyB0aGUgdmFsdWUgaXMgc3RyaWN0bHktc3BlYWtpbmcgaW52YWxpZC5cclxuLy9cclxuLy8gU3BlY2lmaWNhbGx5LCBcIjtcIiBtZWFucyBcImFueXRoaW5nIGJlZm9yZSB0aGlzIGFwcGxpZXMgb25seSB0byBhIG51bWVyaWMgdmFsdWUsXHJcbi8vIHdoaWxlIGFueXRoaW5nIGFmdGVyIGl0IGFwcGxpZXMgdG8gYSB0ZXh0IHZhbHVlXCIuIEFuZCBhIGZvbGxvdy11cCBcIkBcIiBtZWFuc1xyXG4vLyBcImZvciBhIHRleHQgdmFsdWUsIGp1c3Qgb3V0cHV0IGl0IGFzIGlzXCIuXHJcbi8vXHJcbi8vIEl0J3Mgbm90IHJlYWxseSBjbGVhciB3aHkgd291bGQgYW55b25lIGFkZCBzdWNoIGEgZmVhdHVyZSB0byBhIGZvcm1hdC5cclxuLy8gUGVyaGFwcyBpdCBmZWVscyBtb3JlIFwidXNlci1mcmllbmRseVwiIHRvd2FyZHMgYSBub24tXCJ0ZWNoLXNhdnZ5XCIgdXNlclxyXG4vLyBvZiBhIHNwcmVhZHNoZWV0IGVkaXRvciBhcHBsaWNhdGlvbi5cclxuLy9cclxuLy8gRm9ybWF0IGV4YW1wbGVzOlxyXG4vL1xyXG4vLyAqIFwibS9kL3l5eXk7QFwiXHJcbi8vICogXCJbJC00MTRdbW1tbVxcIHl5eXk7QFwiXHJcbi8vXHJcbmNvbnN0IERBVEVfRk9STUFUX0FMTE9XX0FOWV9PVEhFUl9URVhUX1NVRkZJWCA9IC87QCQvXHJcblxyXG5jb25zdCBDQUNIRSA9IHt9XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpc0RhdGVGb3JtYXRDYWNoZWQodGVtcGxhdGUpIHtcclxuXHRpZiAodGVtcGxhdGUgaW4gQ0FDSEUpIHtcclxuXHRcdHJldHVybiBDQUNIRVt0ZW1wbGF0ZV1cclxuXHR9XHJcblx0Y29uc3QgcmVzdWx0ID0gaXNEYXRlRm9ybWF0KHRlbXBsYXRlKVxyXG5cdENBQ0hFW3RlbXBsYXRlXSA9IHJlc3VsdFxyXG5cdHJldHVybiByZXN1bHRcclxufVxyXG5cclxuZnVuY3Rpb24gaXNEYXRlRm9ybWF0KHRlbXBsYXRlKSB7XHJcbiAgLy8gRGF0ZSBmb3JtYXQgdG9rZW5zIGNvdWxkIGJlIGluIHVwcGVyIGNhc2Ugb3IgaW4gbG93ZXIgY2FzZS5cclxuICAvLyBUaGVyZSBzZWVtcyB0byBiZSBubyBzaW5nbGUgc3RhbmRhcmQuXHJcbiAgLy8gU28gdGhlIHRlbXBsYXRlIGlzIGxvd2VyY2FzZWQgZmlyc3QuXHJcbiAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS50b0xvd2VyQ2FzZSgpXHJcblxyXG4gIC8vIE9uIHNvbWUgZGF0ZSBmb3JtYXRzLCB0aGVyZSdzIGFuIFwiWyQtLi4uXVwiIHByZWZpeC5cclxuICAvLyBJdCBmb3JjZXMgYSBzcGVjaWZpYyBsb2NhbGUgdG8gYmUgdXNlZCB3aGVuIGZvcm1hdHRpbmcgYSBkYXRlLlxyXG4gIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShEQVRFX0ZPUk1BVF9TUEVDSUZJQ19MT0NBTEVfUFJFRklYLCAnJylcclxuXHJcbiAgLy8gT24gc29tZSBkYXRlIGZvcm1hdHMsIHRoZXJlJ3MgYW4gXCI7QFwiIHN1ZmZpeC5cclxuICAvLyBJdCdzIG5vdCBjbGVhciB3aHkgd291bGQgYW55b25lIG5lZWQgaXQgaW4gYSBkYXRlIGZvcm1hdCB0ZW1wbGF0ZS5cclxuXHQvLyBTdGlsbCwgYmVjYXVzZSBpdCBvY2N1cnMgdGhlcmUsIGl0IHNob3VsZCBiZSBzdHJpcHBlZC5cclxuICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoREFURV9GT1JNQVRfQUxMT1dfQU5ZX09USEVSX1RFWFRfU1VGRklYLCAnJylcclxuXHJcbiAgLy8gRXh0cmFjdCBhbGwgYWxwaGFiZXRpYyBwYXJ0cyBmcm9tIHdoYXQncyBsZWZ0IGZyb20gdGhlIHRlbXBsYXRlIHN0cmluZy5cclxuICAvLyBFeGFtcGxlOiBcIm1tL2RkL3l5eXlcIiDihpIgW1wibW1cIiwgXCJkZFwiLCBcInl5eXlcIl1cclxuICBjb25zdCB0b2tlbnMgPSB0ZW1wbGF0ZS5zcGxpdCgvXFxXKy8pXHJcblxyXG4gIC8vIElmIG5vIGFscGhhYmV0aWMgcGFydHMgYXJlIHByZXNlbnQgaW4gd2hhdCdzIGxlZnQgZnJvbSB0aGUgdGVtcGxhdGUgc3RyaW5nXHJcbiAgLy8gdGhlbiBpdCBjb3VsZCBiZSBhbnkga2luZCBvZiB0ZW1wbGF0ZSBzdWNoIGFzIGEgZ2VuZXJpYyBudW1lcmljIHRlbXBsYXRlXHJcbiAgLy8gc3VjaCBhcyBcIiQjLCMjMC4wMFwiIGN1cnJlbmN5IHRlbXBsYXRlIG9yIFwiMC4wJVwiIHBlcmNlbnRhZ2UgdGVtcGxhdGUuXHJcbiAgaWYgKHRva2Vucy5sZW5ndGggPCAwKSB7XHJcbiAgICByZXR1cm4gZmFsc2VcclxuICB9XHJcblxyXG4gIGZvciAoY29uc3QgdG9rZW4gb2YgdG9rZW5zKSB7XHJcbiAgICAvLyBJZiBhIG5vbi1kYXRlLWZvcm1hdC1zcGVjaWZpYyBhbHBoYWJldGljIHN1YnN0cmluZyBpcyBmb3VuZCxcclxuICAgIC8vIHRoaXMgbWlnaHQgbm90IG5lY2Vzc2FyaWx5IGJlIGEgZGF0ZSBmb3JtYXQuXHJcbiAgICBpZiAoREFURV9URU1QTEFURV9UT0tFTlMuaW5kZXhPZih0b2tlbikgPCAwKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHRydWVcclxufVxyXG5cclxuLy8gVGhlc2UgdG9rZW5zIGNvdWxkIGJlIGluIHVwcGVyIGNhc2Ugb3IgaW4gbG93ZXIgY2FzZS5cclxuLy8gVGhlcmUgc2VlbXMgdG8gYmUgbm8gc2luZ2xlIHN0YW5kYXJkLCBzbyB1c2luZyBsb3dlciBjYXNlLlxyXG5jb25zdCBEQVRFX1RFTVBMQVRFX1RPS0VOUyA9IFtcclxuICAvLyBTZWNvbmRzIChtaW4gdHdvIGRpZ2l0cykuIEV4YW1wbGU6IFwiMDVcIi5cclxuICAnc3MnLFxyXG4gIC8vIE1pbnV0ZXMgKG1pbiB0d28gZGlnaXRzKS4gRXhhbXBsZTogXCIwNVwiLiBDb3VsZCBhbHNvIGJlIFwiTW9udGhzXCIuIFdlaXJkLlxyXG4gICdtbScsXHJcbiAgLy8gSG91cnMuIEV4YW1wbGU6IFwiMVwiLlxyXG4gICdoJyxcclxuICAvLyBIb3VycyAobWluIHR3byBkaWdpdHMpLiBFeGFtcGxlOiBcIjAxXCIuXHJcbiAgJ2hoJyxcclxuICAvLyBcIkFNXCIgcGFydCBvZiBcIkFNL1BNXCIuIExvd2VyY2FzZWQganVzdCBpbiBjYXNlLlxyXG4gICdhbScsXHJcbiAgLy8gXCJQTVwiIHBhcnQgb2YgXCJBTS9QTVwiLiBMb3dlcmNhc2VkIGp1c3QgaW4gY2FzZS5cclxuICAncG0nLFxyXG4gIC8vIERheS4gRXhhbXBsZTogXCIxXCJcclxuICAnZCcsXHJcbiAgLy8gRGF5IChtaW4gdHdvIGRpZ2l0cykuIEV4YW1wbGU6IFwiMDFcIlxyXG4gICdkZCcsXHJcbiAgLy8gTW9udGggKG51bWVyaWMpLiBFeGFtcGxlOiBcIjFcIi5cclxuICAnbScsXHJcbiAgLy8gTW9udGggKG51bWVyaWMsIG1pbiB0d28gZGlnaXRzKS4gRXhhbXBsZTogXCIwMVwiLiBDb3VsZCBhbHNvIGJlIFwiTWludXRlc1wiLiBXZWlyZC5cclxuICAnbW0nLFxyXG4gIC8vIE1vbnRoIChzaG9ydGVuZWQgbW9udGggbmFtZSkuIEV4YW1wbGU6IFwiSmFuXCIuXHJcbiAgJ21tbScsXHJcbiAgLy8gTW9udGggKGZ1bGwgbW9udGggbmFtZSkuIEV4YW1wbGU6IFwiSmFudWFyeVwiLlxyXG4gICdtbW1tJyxcclxuICAvLyBUd28tZGlnaXQgeWVhci4gRXhhbXBsZTogXCIyMFwiLlxyXG4gICd5eScsXHJcbiAgLy8gRnVsbCB5ZWFyLiBFeGFtcGxlOiBcIjIwMjBcIi5cclxuICAneXl5eScsXHJcblxyXG4gIC8vIEkgZG9uJ3QgaGF2ZSBhbnkgaWRlYSB3aGF0IFwiZVwiIG1lYW5zLlxyXG4gIC8vIEl0J3MgdXNlZCBpbiBcImJ1aWx0LWluXCIgWExTWCBmb3JtYXRzOlxyXG4gIC8vICogMjcgJ1skLTQwNF1lL20vZCc7XHJcbiAgLy8gKiAzNiAnWyQtNDA0XWUvbS9kJztcclxuICAvLyAqIDUwICdbJC00MDRdZS9tL2QnO1xyXG4gIC8vICogNTcgJ1skLTQwNF1lL20vZCc7XHJcbiAgJ2UnXHJcbl07IiwgIi8vIFhMU1ggZG9lcyBoYXZlIFwiZFwiIHR5cGUgZm9yIGRhdGVzLCBidXQgaXQncyBub3QgY29tbW9ubHkgdXNlZC5cclxuLy8gSW5zdGVhZCwgaXQgcHJlZmVycyB1c2luZyBcIm5cIiB0eXBlIGZvciBzdG9yaW5nIGRhdGVzIGFzIHRpbWVzdGFtcHMuXHJcbi8vXHJcbi8vIFdoZXRoZXIgYSBudW1lcmljIHZhbHVlIGlzIGEgbnVtYmVyIG9yIGEgZGF0ZSB0aW1lc3RhbXAsIGl0IHNvbWV0aW1lcyBjb3VsZCBiZVxyXG4vLyBkZXRlY3RlZCBieSBsb29raW5nIGF0IHRoZSB2YWx1ZSBcImZvcm1hdFwiIGFuZCBzZWVpbmcgaWYgaXQncyBhIGRhdGUtc3BlY2lmaWMgb25lLlxyXG5cclxuaW1wb3J0IGlzRGF0ZUZvcm1hdCBmcm9tICcuL2lzRGF0ZUZvcm1hdC5qcydcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGlzRGF0ZUZvcm1hdFN0eWxlKHN0eWxlSWQsIHN0eWxlcywgb3B0aW9ucykge1xyXG4gIGlmIChzdHlsZUlkKSB7XHJcbiAgICBjb25zdCBzdHlsZSA9IHN0eWxlc1tzdHlsZUlkXVxyXG4gICAgaWYgKCFzdHlsZSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENlbGwgc3R5bGUgbm90IGZvdW5kOiAke3N0eWxlSWR9YClcclxuICAgIH1cclxuICAgIGlmICghc3R5bGUubnVtYmVyRm9ybWF0KSB7XHJcbiAgICAgIHJldHVybiBmYWxzZVxyXG4gICAgfVxyXG4gICAgaWYgKFxyXG4gICAgICAvLyBXaGV0aGVyIGl0J3MgYSBcIm51bWJlciBmb3JtYXRcIiB0aGF0J3MgY29udmVudGlvbmFsbHkgdXNlZCBmb3Igc3RvcmluZyBkYXRlIHRpbWVzdGFtcHMuXHJcbiAgICAgIEJVSUxUX0lOX0RBVEVfRk9STUFUX0lEUy5pbmRleE9mKE51bWJlcihzdHlsZS5udW1iZXJGb3JtYXQuaWQpKSA+PSAwIHx8XHJcbiAgICAgIC8vIFdoZXRoZXIgaXQncyBhIFwibnVtYmVyIGZvcm1hdFwiIHRoYXQgdXNlcyBhIFwiZm9ybWF0dGluZyB0ZW1wbGF0ZVwiXHJcbiAgICAgIC8vIHRoYXQgdGhlIGRldmVsb3BlciBpcyBjZXJ0YWluIGlzIGEgZGF0ZSBmb3JtYXR0aW5nIHRlbXBsYXRlLlxyXG4gICAgICAob3B0aW9ucy5kYXRlRm9ybWF0ICYmIHN0eWxlLm51bWJlckZvcm1hdC50ZW1wbGF0ZSA9PT0gb3B0aW9ucy5kYXRlRm9ybWF0KSB8fFxyXG4gICAgICAvLyBXaGV0aGVyIHRoZSBcInNtYXJ0IGZvcm1hdHRpbmcgdGVtcGxhdGVcIiBmZWF0dXJlIGlzIG5vdCBkaXNhYmxlZFxyXG4gICAgICAvLyBhbmQgaXQgaGFzIGRldGVjdGVkIHRoYXQgaXQncyBhIGRhdGUgZm9ybWF0dGluZyB0ZW1wbGF0ZSBieSBsb29raW5nIGF0IGl0LlxyXG4gICAgICAob3B0aW9ucy5zbWFydERhdGVQYXJzZXIgIT09IGZhbHNlICYmIHN0eWxlLm51bWJlckZvcm1hdC50ZW1wbGF0ZSAmJiBpc0RhdGVGb3JtYXQoc3R5bGUubnVtYmVyRm9ybWF0LnRlbXBsYXRlKSlcclxuICAgICApIHtcclxuICAgICAgcmV0dXJuIHRydWVcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbi8vIEJ1aWx0LWluIGZvcm1hdHMgaGF2ZSBJRCA8IDE2NC5cclxuLy8gU29tZSBvZiB0aG9zZSBmb3JtYXRzIGFyZSBpbnRlbmRlZCB0byB1c2Ugd2hlbiBkaXNwbGF5aW5nIGRhdGVzLlxyXG4vL1xyXG4vLyBEZXBlbmRpbmcgb24gdGhlIFwibG9jYWxlXCIgdXNlZCBieSB0aGUgc3ByZWFkc2hlZXQgdmlld2luZyBhcHBsaWNhdGlvbixcclxuLy8gZGlmZmVyZW50IGJ1aWx0LWluIGZvcm1hdCBJRHMgbWlnaHQgY29ycmVzcG9uZCB0byBkaWZmZXJlbnQgdGVtcGxhdGVzLlxyXG4vLyBodHRwczovL2xlYXJuLm1pY3Jvc29mdC5jb20vZW4tdXMvZG90bmV0L2FwaS9kb2N1bWVudGZvcm1hdC5vcGVueG1sLnNwcmVhZHNoZWV0Lm51bWJlcmluZ2Zvcm1hdD92aWV3PW9wZW54bWwtMi44LjFcclxuLy9cclxuLy8gSGVyZSdzIGEgbGlzdCBvZiBcImxvY2FsZVwiLWluZGVwZW5kZW50IGJ1aWx0LWluIGZvcm1hdCBJRHMgdGhhdCdyZSBrbm93biB0byByZXByZXNlbnQgZGF0ZXMuXHJcbi8vXHJcbmNvbnN0IExPQ0FMRV9JTkRFUEVOREVOVF9CVUlMVF9JTl9EQVRFX0ZPUk1BVF9JRFMgPSBbXHJcbiAgMTQsIC8vIG1tLWRkLXl5XHJcbiAgMTUsIC8vIGQtbW1tLXl5XHJcbiAgMTYsIC8vIGQtbW1tXHJcbiAgMTcsIC8vIG1tbS15eVxyXG4gIDE4LCAvLyBoOm1tIEFNL1BNXHJcbiAgMTksIC8vIGg6bW06c3MgQU0vUE1cclxuICAyMCwgLy8gaDptbVxyXG4gIDIxLCAvLyBoOm1tOnNzXHJcbiAgMjIsIC8vIG0vZC95eSBoOm1tXHJcbiAgNDUsIC8vIG1tOnNzXHJcbiAgNDYsIC8vIFtoXTptbTpzc1xyXG4gIDQ3ICAvLyBtbXNzLjBcclxuXVxyXG5cclxuLy8gXCJ6aC10d1wiIE9SIFwiemgtY25cIiBsb2NhbGVzLlxyXG4vLyBMYW5ndWFnZSBnbHlwaHMgKGFrYSBcImhpZXJvZ2x5cGhzXCIpIGFyZSBub3QgcmVwbGFjZWQgd2l0aCB0aGVpciByZXNwZWN0aXZlIHVuaWNvZGUgdmFsdWVzIGhlcmUuXHJcbmNvbnN0IE1BSU5MQU5EX0NISU5FU0VfT1JfVEFJV0FORVNFX0xPQ0FMRV9CVUlMVF9JTl9EQVRFX0ZPUk1BVF9JRFMgPSBbXHJcbiAgMjcsIC8vIFskLTQwNF1lL20vZCBPUiB5eXl5XCLlubRcIm1cIuaciFwiXHJcbiAgMjgsIC8vIFskLTQwNF1lXCLlubRcIm1cIuaciFwiZFwi5pelXCIgT1IgbVwi5pyIXCJkXCLml6VcIlxyXG4gIDI5LCAvLyBbJC00MDRdZVwi5bm0XCJtXCLmnIhcImRcIuaXpVwiIE9SIG1cIuaciFwiZFwi5pelXCJcclxuICAzMCwgLy8gbS9kL3l5IE9SIG0tZC15eVxyXG4gIDMxLCAvLyB5eXl5XCLlubRcIm1cIuaciFwiZFwi5pelXCIgT1IgeXl5eVwi5bm0XCJtXCLmnIhcImRcIuaXpVwiXHJcbiAgMzIsIC8vIGhoXCLmmYJcIm1tXCLliIZcIiBPUiBoXCLml7ZcIm1tXCLliIZcIlxyXG4gIDMzLCAvLyBoaFwi5pmCXCJtbVwi5YiGXCJzc1wi56eSXCIgT1IgaFwi5pe2XCJtbVwi5YiGXCJzc1wi56eSXCJcclxuICAzNCwgLy8g5LiK5Y2IL+S4i+WNiGhoXCLmmYJcIm1tXCLliIZcIiBPUiDkuIrljYgv5LiL5Y2IaFwi5pe2XCJtbVwi5YiGXCJcclxuICAzNSwgLy8g5LiK5Y2IL+S4i+WNiGhoXCLmmYJcIm1tXCLliIZcInNzXCLnp5JcIiBPUiDkuIrljYgv5LiL5Y2IaFwi5pe2XCJtbVwi5YiGXCJzc1wi56eSXCJcclxuICAzNiwgLy8gWyQtNDA0XWUvbS9kIE9SIHl5eXlcIuW5tFwibVwi5pyIXCJcclxuICA1MCwgLy8gWyQtNDA0XWUvbS9kIE9SIHl5eXlcIuW5tFwibVwi5pyIXCJcclxuICA1MSwgLy8gWyQtNDA0XWVcIuW5tFwibVwi5pyIXCJkXCLml6VcIiBPUiBtXCLmnIhcImRcIuaXpVwiXHJcbiAgNTIsIC8vIOS4iuWNiC/kuIvljYhoaFwi5pmCXCJtbVwi5YiGXCIgT1IgeXl5eVwi5bm0XCJtXCLmnIhcIlxyXG4gIDUzLCAvLyDkuIrljYgv5LiL5Y2IaGhcIuaZglwibW1cIuWIhlwic3NcIuenklwiIE9SIG1cIuaciFwiZFwi5pelXCJcclxuICA1NCwgLy8gWyQtNDA0XWVcIuW5tFwibVwi5pyIXCJkXCLml6VcIiBPUiBtXCLmnIhcImRcIuaXpVwiXHJcbiAgNTUsIC8vIOS4iuWNiC/kuIvljYhoaFwi5pmCXCJtbVwi5YiGXCIgT1Ig5LiK5Y2IL+S4i+WNiGhcIuaXtlwibW1cIuWIhlwiXHJcbiAgNTYsIC8vIOS4iuWNiC/kuIvljYhoaFwi5pmCXCJtbVwi5YiGXCJzc1wi56eSXCIgT1Ig5LiK5Y2IL+S4i+WNiGhcIuaXtlwibW1cIuWIhlwic3NcIuenklwiXHJcbiAgNTcsIC8vIFskLTQwNF1lL20vZCBPUiB5eXl5XCLlubRcIm1cIuaciFwiXHJcbiAgNTggIC8vIFskLTQwNF1lXCLlubRcIm1cIuaciFwiZFwi5pelXCIgT1IgbVwi5pyIXCJkXCLml6VcIlxyXG5dXHJcblxyXG4vLyBcImphLWpwXCIgT1IgXCJrby1rclwiIGxvY2FsZXMuXHJcbi8vIExhbmd1YWdlIGdseXBocyAoYWthIFwiaGllcm9nbHlwaHNcIikgYXJlIG5vdCByZXBsYWNlZCB3aXRoIHRoZWlyIHJlc3BlY3RpdmUgdW5pY29kZSB2YWx1ZXMgaGVyZS5cclxuY29uc3QgSkFQQU5FU0VfT1JfS09SRUFOX0xPQ0FMRV9CVUlMVF9JTl9EQVRFX0ZPUk1BVF9JRFMgPSBbXHJcbiAgMjcsIC8vIFskLTQxMV1nZS5tLmQgT1IgeXl5eVwi5bm0XCIgbW1cIuaciFwiIGRkXCLml6VcIlxyXG4gIDI4LCAvLyBbJC00MTFdZ2dnZVwi5bm0XCJtXCLmnIhcImRcIuaXpVwiIE9SIG1tLWRkXHJcbiAgMjksIC8vIFskLTQxMV1nZ2dlXCLlubRcIm1cIuaciFwiZFwi5pelXCIgT1IgbW0tZGRcclxuICAzMCwgLy8gbS9kL3l5IE9SIG1tLWRkLXl5XHJcbiAgMzEsIC8vIHl5eXlcIuW5tFwibVwi5pyIXCJkXCLml6VcIiBPUiB5eXl5XCLrhYRcIiBtbVwi7JuUXCIgZGRcIuydvFwiXHJcbiAgMzIsIC8vIGhcIuaZglwibW1cIuWIhlwiIE9SIGhcIuyLnFwiIG1tXCLrtoRcIlxyXG4gIDMzLCAvLyBoXCLmmYJcIm1tXCLliIZcInNzXCLnp5JcIiBPUiBoXCLsi5xcIiBtbVwi67aEXCIgc3NcIuy0iFwiXHJcbiAgMzQsIC8vIHl5eXlcIuW5tFwibVwi5pyIXCIgT1IgeXl5eS1tbS1kZFxyXG4gIDM1LCAvLyBtXCLmnIhcImRcIuaXpVwiIE9SIHl5eXktbW0tZGRcclxuICAzNiwgLy8gWyQtNDExXWdlLm0uZCBPUiB5eXl5XCLlubRcIiBtbVwi5pyIXCIgZGRcIuaXpVwiXHJcbiAgNTAsIC8vIFskLTQxMV1nZS5tLmQgT1IgeXl5eVwi5bm0XCIgbW1cIuaciFwiIGRkXCLml6VcIlxyXG4gIDUxLCAvLyBbJC00MTFdZ2dnZVwi5bm0XCJtXCLmnIhcImRcIuaXpVwiIE9SIG1tLWRkXHJcbiAgNTIsIC8vIHl5eXlcIuW5tFwibVwi5pyIXCIgT1IgeXl5eS1tbS1kZFxyXG4gIDUzLCAvLyBtXCLmnIhcImRcIuaXpVwiIE9SIHl5eXktbW0tZGRcclxuICA1NCwgLy8gWyQtNDExXWdnZ2VcIuW5tFwibVwi5pyIXCJkXCLml6VcIiBPUiBtbS1kZFxyXG4gIDU1LCAvLyB5eXl5XCLlubRcIm1cIuaciFwiIE9SIHl5eXktbW0tZGRcclxuICA1NiwgLy8gbVwi5pyIXCJkXCLml6VcIiBPUiB5eXl5LW1tLWRkXHJcbiAgNTcsIC8vIFskLTQxMV1nZS5tLmQgT1IgeXl5eVwi5bm0XCIgbW1cIuaciFwiIGRkXCLml6VcIlxyXG4gIDU4ICAvLyBbJC00MTFdZ2dnZVwi5bm0XCJtXCLmnIhcImRcIuaXpVwiIE9SIG1tLWRkXHJcbl1cclxuXHJcbi8vIFwidGgtdGhcIiBsb2NhbGUuXHJcbi8vIExhbmd1YWdlIGdseXBocyAoYWthIFwiaGllcm9nbHlwaHNcIikgYXJlIG5vdCByZXBsYWNlZCB3aXRoIHRoZWlyIHJlc3BlY3RpdmUgdW5pY29kZSB2YWx1ZXMgaGVyZS5cclxuY29uc3QgVEhBSV9MT0NBTEVfQlVJTFRfSU5fREFURV9GT1JNQVRfSURTID0gW1xyXG4gIDcxLCAvLyDguKcv4LiUL+C4m+C4m+C4m+C4m1xyXG4gIDcyLCAvLyDguKct4LiU4LiU4LiULeC4m+C4m1xyXG4gIDczLCAvLyDguKct4LiU4LiU4LiUXHJcbiAgNzQsIC8vIOC4lOC4lOC4lC3guJvguJtcclxuICA3NSwgLy8g4LiKOuC4meC4mVxyXG4gIDc2LCAvLyDguIo64LiZ4LiZOuC4l+C4l1xyXG4gIDc3LCAvLyDguKcv4LiUL+C4m+C4m+C4m+C4myDguIo64LiZ4LiZXHJcbiAgNzgsIC8vIOC4meC4mTrguJfguJdcclxuICA3OSwgLy8gW+C4il064LiZ4LiZOuC4l+C4l1xyXG4gIDgwLCAvLyDguJnguJk64LiX4LiXLjBcclxuICA4MSAgLy8gZC9tL2JiXHJcbl1cclxuXHJcbi8vIFN0YXJ0IHdpdGggbGFuZ3VhZ2UtYWdub3N0aWMgZGF0ZSBmb3JtYXQgSURzLlxyXG5jb25zdCBCVUlMVF9JTl9EQVRFX0ZPUk1BVF9JRFMgPSBMT0NBTEVfSU5ERVBFTkRFTlRfQlVJTFRfSU5fREFURV9GT1JNQVRfSURTLmNvbmNhdChcclxuICAvLyBBZGQgTWFpbmxhbmQgQ2hpbmVzZSBvciBUYWl3YW5lc2UgZGF0ZSBmb3JtYXQgSURzIHRoYXQgaGF2ZW4ndCBhbHJlYWR5IGJlZW4gYWRkZWQuXHJcbiAgTUFJTkxBTkRfQ0hJTkVTRV9PUl9UQUlXQU5FU0VfTE9DQUxFX0JVSUxUX0lOX0RBVEVfRk9STUFUX0lEU1xyXG4pLmNvbmNhdChcclxuICAvLyBBZGQgSmFwYW5lc2Ugb3IgS29yZWFuIGRhdGUgZm9ybWF0IElEcyB0aGF0IGhhdmVuJ3QgYWxyZWFkeSBiZWVuIGFkZGVkLlxyXG4gIEpBUEFORVNFX09SX0tPUkVBTl9MT0NBTEVfQlVJTFRfSU5fREFURV9GT1JNQVRfSURTLmZpbHRlcihcclxuICAgIG51bWJlckZvcm1hdElkID0+IE1BSU5MQU5EX0NISU5FU0VfT1JfVEFJV0FORVNFX0xPQ0FMRV9CVUlMVF9JTl9EQVRFX0ZPUk1BVF9JRFMuaW5kZXhPZihudW1iZXJGb3JtYXRJZCkgPCAwXHJcbiAgKVxyXG4pLmNvbmNhdChcclxuICAvLyBBZGQgVGhhaSBkYXRlIGZvcm1hdCBJRHMgdGhhdCBoYXZlbid0IGFscmVhZHkgYmVlbiBhZGRlZC5cclxuICBUSEFJX0xPQ0FMRV9CVUlMVF9JTl9EQVRFX0ZPUk1BVF9JRFMuZmlsdGVyKFxyXG4gICAgbnVtYmVyRm9ybWF0SWQgPT4gTUFJTkxBTkRfQ0hJTkVTRV9PUl9UQUlXQU5FU0VfTE9DQUxFX0JVSUxUX0lOX0RBVEVfRk9STUFUX0lEUy5pbmRleE9mKG51bWJlckZvcm1hdElkKSA8IDBcclxuICApLmZpbHRlcihcclxuICAgIG51bWJlckZvcm1hdElkID0+IEpBUEFORVNFX09SX0tPUkVBTl9MT0NBTEVfQlVJTFRfSU5fREFURV9GT1JNQVRfSURTLmluZGV4T2YobnVtYmVyRm9ybWF0SWQpIDwgMFxyXG4gIClcclxuKVxyXG4iLCAiaW1wb3J0IHBhcnNlRXhjZWxEYXRlIGZyb20gJy4vcGFyc2VFeGNlbERhdGUuanMnXHJcbmltcG9ydCBpc0RhdGVGb3JtYXRTdHlsZSBmcm9tICcuL2lzRGF0ZUZvcm1hdFN0eWxlLmpzJ1xyXG5cclxuLy8gUGFyc2VzIGEgc3RyaW5nIGB2YWx1ZWAgb2YgYSBjZWxsLlxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYXJzZUNlbGxWYWx1ZSh2YWx1ZSwgdHlwZSwge1xyXG4gIGdldElubGluZVN0cmluZ1ZhbHVlLFxyXG4gIGdldElubGluZVN0cmluZ1htbCxcclxuICBnZXRTdHlsZUlkLFxyXG4gIHN0eWxlcyxcclxuICBzaGFyZWRTdHJpbmdzLFxyXG4gIGVwb2NoMTkwNCxcclxuICBvcHRpb25zXHJcbn0pIHtcclxuICBpZiAoIXR5cGUpIHtcclxuICAgIC8vIERlZmF1bHQgY2VsbCB0eXBlIGlzIFwiblwiIChudW1lcmljKS5cclxuICAgIC8vIGh0dHA6Ly93d3cuZGF0eXBpYy5jb20vc2Mvb294bWwvdC1zc21sX0NUX0NlbGwuaHRtbFxyXG4gICAgdHlwZSA9ICduJ1xyXG4gIH1cclxuXHJcbiAgLy8gQXZhaWxhYmxlIEV4Y2VsIGNlbGwgdHlwZXM6XHJcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL1NoZWV0SlMvc2hlZXRqcy9ibG9iLzE5NjIwZGEzMGJlMmE3ZDdiOTgwMTkzOGEwYjliMWZkM2M0YzRiMDAvZG9jYml0cy81Ml9kYXRhdHlwZS5tZFxyXG4gIC8vXHJcbiAgLy8gU29tZSBvdGhlciBkb2N1bWVudCAoc2VlbXMgdG8gYmUgb2xkKTpcclxuICAvLyBodHRwOi8vd2ViYXBwLmRvY3g0amF2YS5vcmcvT25saW5lRGVtby9lY21hMzc2L1NwcmVhZHNoZWV0TUwvU1RfQ2VsbFR5cGUuaHRtbFxyXG4gIC8vXHJcbiAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAvLyBYTFNYIHRlbmRzIHRvIHN0b3JlIGFsbCBzdHJpbmdzIGFzIFwic2hhcmVkXCIgKGluZGV4ZWQpIG9uZXNcclxuICAgIC8vIHVzaW5nIFwic1wiIGNlbGwgdHlwZSAoZm9yIHNhdmluZyBvbiBzdHJhZ2Ugc3BhY2UpLlxyXG4gICAgLy8gXCJzdHJcIiBjZWxsIHR5cGUgaXMgdGhlbiBnZW5lcmFsbHkgb25seSB1c2VkIGZvciBzdG9yaW5nXHJcbiAgICAvLyBmb3JtdWxhLXByZS1jYWxjdWxhdGVkIGNlbGwgdmFsdWVzLlxyXG4gICAgY2FzZSAnc3RyJzpcclxuICAgICAgdmFsdWUgPSBwYXJzZVN0cmluZyh2YWx1ZSwgb3B0aW9ucylcclxuICAgICAgYnJlYWtcclxuXHJcbiAgICAvLyBTb21ldGltZXMsIFhMU1ggc3RvcmVzIHN0cmluZ3MgYXMgXCJpbmxpbmVcIiBzdHJpbmdzIHJhdGhlciB0aGFuIFwic2hhcmVkXCIgKGluZGV4ZWQpIG9uZXMuXHJcbiAgICAvLyBQZXJoYXBzIHRoZSBzcGVjaWZpY2F0aW9uIGRvZXNuJ3QgZm9yY2UgaXQgdG8gdXNlIG9uZSBvciBhbm90aGVyLlxyXG4gICAgLy8gRXhhbXBsZTogYDxzaGVldERhdGE+PHJvdyByPVwiMVwiPjxjIHI9XCJBMVwiIHM9XCIxXCIgdD1cImlubGluZVN0clwiPjxpcz48dD5UZXN0IDEyMzwvdD48L2lzPjwvYz48L3Jvdz48L3NoZWV0RGF0YT5gLlxyXG4gICAgY2FzZSAnaW5saW5lU3RyJzpcclxuICAgICAgdmFsdWUgPSBnZXRJbmxpbmVTdHJpbmdWYWx1ZSgpXHJcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBcImlubGluZSBzdHJpbmdcIiBjZWxsIHZhbHVlIHN0cnVjdHVyZTogJHtnZXRJbmxpbmVTdHJpbmdYbWwoKX1gKVxyXG4gICAgICB9XHJcbiAgICAgIHZhbHVlID0gcGFyc2VTdHJpbmcodmFsdWUsIG9wdGlvbnMpXHJcbiAgICAgIGJyZWFrXHJcblxyXG4gICAgLy8gWExTWCB0ZW5kcyB0byBzdG9yZSBzdHJpbmcgdmFsdWVzIGFzIFwic2hhcmVkXCIgKGluZGV4ZWQpIG9uZXMuXHJcbiAgICAvLyBcIlNoYXJlZFwiIHN0cmluZ3MgaXMgYSB3YXkgZm9yIGFuIEV4Y2VsIGVkaXRvciB0byByZWR1Y2VcclxuICAgIC8vIHRoZSBmaWxlIHNpemUgYnkgc3RvcmluZyBcImNvbW1vbmx5IHVzZWRcIiBzdHJpbmdzIGluIGEgZGljdGlvbmFyeVxyXG4gICAgLy8gYW5kIHRoZW4gcmVmZXJyaW5nIHRvIHN1Y2ggc3RyaW5ncyBieSB0aGVpciBpbmRleCBpbiB0aGF0IGRpY3Rpb25hcnkuXHJcbiAgICAvLyBFeGFtcGxlOiBgPHNoZWV0RGF0YT48cm93IHI9XCIxXCI+PGMgcj1cIkExXCIgcz1cIjFcIiB0PVwic1wiPjx2PjA8L3Y+PC9jPjwvcm93Pjwvc2hlZXREYXRhPmAuXHJcbiAgICBjYXNlICdzJzpcclxuICAgICAgLy8gSWYgYSBjZWxsIGhhcyBubyB2YWx1ZSB0aGVuIHRoZXJlJ3Mgbm8gYDxjLz5gIGVsZW1lbnQgZm9yIGl0LlxyXG4gICAgICAvLyBJZiBhIGA8Yy8+YCBlbGVtZW50IGV4aXN0cyB0aGVuIGl0J3Mgbm90IGVtcHR5LlxyXG4gICAgICAvLyBUaGUgYDx2Lz5gYWx1ZSBpcyBhIGtleSBpbiB0aGUgXCJzaGFyZWQgc3RyaW5nc1wiIGRpY3Rpb25hcnkgb2YgdGhlXHJcbiAgICAgIC8vIFhMU1ggZmlsZSwgc28gbG9vayBpdCB1cCBpbiB0aGUgYHNoYXJlZFN0cmluZ3NgIGRpY3Rpb25hcnkgYnkgdGhlIG51bWVyaWMga2V5LlxyXG4gICAgICBjb25zdCBzaGFyZWRTdHJpbmdJbmRleCA9IE51bWJlcih2YWx1ZSlcclxuICAgICAgaWYgKGlzTmFOKHNoYXJlZFN0cmluZ0luZGV4KSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBcInNoYXJlZFwiIHN0cmluZyBpbmRleDogJHt2YWx1ZX1gKVxyXG4gICAgICB9XHJcbiAgICAgIGlmIChzaGFyZWRTdHJpbmdJbmRleCA+PSBzaGFyZWRTdHJpbmdzLmxlbmd0aCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQW4gb3V0LW9mLWJvdW5kcyBcInNoYXJlZFwiIHN0cmluZyBpbmRleDogJHt2YWx1ZX1gKVxyXG4gICAgICB9XHJcbiAgICAgIHZhbHVlID0gc2hhcmVkU3RyaW5nc1tzaGFyZWRTdHJpbmdJbmRleF1cclxuICAgICAgdmFsdWUgPSBwYXJzZVN0cmluZyh2YWx1ZSwgb3B0aW9ucylcclxuICAgICAgYnJlYWtcclxuXHJcbiAgICAvLyBCb29sZWFuIChUUlVFL0ZBTFNFKSB2YWx1ZXMgYXJlIHN0b3JlZCBhcyBlaXRoZXIgXCIxXCIgb3IgXCIwXCJcclxuICAgIC8vIGluIGNlbGxzIG9mIHR5cGUgXCJiXCIuXHJcbiAgICBjYXNlICdiJzpcclxuICAgICAgaWYgKHZhbHVlID09PSAnMScpIHtcclxuICAgICAgICB2YWx1ZSA9IHRydWVcclxuICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gJzAnKSB7XHJcbiAgICAgICAgdmFsdWUgPSBmYWxzZVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgXCJib29sZWFuXCIgY2VsbCB2YWx1ZTogJHt2YWx1ZX1gKVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrXHJcblxyXG4gICAgLy8gWExTWCBzcGVjaWZpY2F0aW9uIHNlZW1zIHRvIHN1cHBvcnQgY2VsbHMgb2YgdHlwZSBcInpcIjpcclxuICAgIC8vIGJsYW5rIFwic3R1YlwiIGNlbGxzIHRoYXQgc2hvdWxkIGJlIGlnbm9yZWQgYnkgZGF0YSBwcm9jZXNzaW5nIHV0aWxpdGllcy5cclxuICAgIGNhc2UgJ3onOlxyXG4gICAgICB2YWx1ZSA9IHVuZGVmaW5lZFxyXG4gICAgICBicmVha1xyXG5cclxuICAgIC8vIFhMU1ggc3BlY2lmaWNhdGlvbiBhbHNvIGRlZmluZXMgY2VsbHMgb2YgdHlwZSBcImVcIiBjb250YWluaW5nIGEgbnVtZXJpYyBcImVycm9yXCIgY29kZS5cclxuICAgIC8vIEl0J3Mgbm90IGNsZWFyIHdoYXQgdGhhdCBtZWFucyB0aG91Z2guXHJcbiAgICAvLyBUaGV5IGFsc28gd3JvdGU6IFwiYW5kIGB3YCBwcm9wZXJ0eSBzdG9yZXMgaXRzIGNvbW1vbiBuYW1lXCIuXHJcbiAgICAvLyBJdCdzIHVuY2xlYXIgd2hhdCB0aGV5IG1lYW50IGJ5IHRoYXQuXHJcbiAgICBjYXNlICdlJzpcclxuICAgICAgdmFsdWUgPSBkZWNvZGVFcnJvcih2YWx1ZSlcclxuICAgICAgYnJlYWtcclxuXHJcbiAgICAvLyBYTFNYIHN1cHBvcnRzIGRhdGUgY2VsbHMgb2YgdHlwZSBcImRcIiwgdGhvdWdoIHNlZW1zIGxpa2UgaXQgKGFsbW9zdD8pIG5ldmVyXHJcbiAgICAvLyB1c2VzIGl0IGZvciBzdG9yaW5nIGRhdGVzLCBwcmVmZXJyaW5nIFwiblwiIG51bWVyaWMgdGltZXN0YW1wIGNlbGxzIGluc3RlYWQuXHJcbiAgICAvLyBUaGUgdmFsdWUgb2YgYSBcImRcIiBjZWxsIGlzIHN1cHBvc2VkbHkgYSBzdHJpbmcgaW4gXCJJU08gODYwMVwiIGZvcm1hdC5cclxuICAgIC8vIEkgaGF2ZW4ndCBzZWVuIGFuIFhMU1ggZmlsZSBoYXZpbmcgc3VjaCBjZWxscy5cclxuICAgIC8vIEV4YW1wbGU6IGA8c2hlZXREYXRhPjxyb3cgcj1cIjFcIj48YyByPVwiQTFcIiBzPVwiMVwiIHQ9XCJkXCI+PHY+MjAyMS0wNi0xMFQwMDo0Nzo0NS43MDBaPC92PjwvYz48L3Jvdz48L3NoZWV0RGF0YT5gLlxyXG4gICAgY2FzZSAnZCc6XHJcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgYnJlYWtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBwYXJzZWREYXRlID0gbmV3IERhdGUodmFsdWUpXHJcbiAgICAgIGlmIChpc05hTihwYXJzZWREYXRlLnZhbHVlT2YoKSkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIFwiZGF0ZVwiIGNlbGwgdmFsdWU6ICR7dmFsdWV9YClcclxuICAgICAgfVxyXG4gICAgICB2YWx1ZSA9IHBhcnNlZERhdGVcclxuICAgICAgYnJlYWtcclxuXHJcbiAgICAvLyBOdW1lcmljIGNlbGxzIGhhdmUgdHlwZSBcIm5cIi5cclxuICAgIGNhc2UgJ24nOlxyXG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIGJyZWFrXHJcbiAgICAgIH1cclxuICAgICAgLy8gWExTWCBkb2VzIGhhdmUgXCJkXCIgdHlwZSBmb3IgZGF0ZXMsIGJ1dCBpdCdzIG5vdCBjb21tb25seSB1c2VkLlxyXG4gICAgICAvLyBJbnN0ZWFkLCBpdCBwcmVmZXJzIHVzaW5nIFwiblwiIHR5cGUgZm9yIHN0b3JpbmcgZGF0ZXMgYXMgdGltZXN0YW1wcy5cclxuICAgICAgY29uc3Qgc3R5bGVJZCA9IGdldFN0eWxlSWQoKVxyXG4gICAgICBpZiAoc3R5bGVJZCAmJiBpc0RhdGVGb3JtYXRTdHlsZShzdHlsZUlkLCBzdHlsZXMsIG9wdGlvbnMpKSB7XHJcbiAgICAgICAgLy8gUGFyc2UgdGhlIG51bWJlciBmcm9tIHN0cmluZy5cclxuICAgICAgICB2YWx1ZSA9IHBhcnNlTnVtYmVyRGVmYXVsdCh2YWx1ZSlcclxuICAgICAgICAvLyBQYXJzZSB0aGUgbnVtYmVyIGFzIGEgZGF0ZSB0aW1lc3RhbXAuXHJcbiAgICAgICAgdmFsdWUgPSBwYXJzZUV4Y2VsRGF0ZSh2YWx1ZSwgeyBlcG9jaDE5MDQgfSlcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBQYXJzZSB0aGUgbnVtYmVyIGZyb20gc3RyaW5nLlxyXG4gICAgICAgIC8vIFN1cHBvcnRzIGN1c3RvbSBwYXJzaW5nIGZ1bmN0aW9uIHRvIHdvcmsgYXJvdW5kIGphdmFzY3JpcHQgbnVtYmVyIGVuY29kaW5nIHByZWNpc2lvbiBpc3N1ZXMuXHJcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRsYWIuY29tL2NhdGFtcGhldGFtaW5lL3JlYWQtZXhjZWwtZmlsZS8tL2lzc3Vlcy84NVxyXG4gICAgICAgIGNvbnN0IHBhcnNlTnVtYmVyID0gb3B0aW9ucy5wYXJzZU51bWJlciB8fCBwYXJzZU51bWJlckRlZmF1bHRcclxuICAgICAgICB2YWx1ZSA9IHBhcnNlTnVtYmVyKHZhbHVlKVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrXHJcblxyXG4gICAgZGVmYXVsdDpcclxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgQ2VsbCB0eXBlIG5vdCBzdXBwb3J0ZWQ6ICR7dHlwZX1gKVxyXG4gIH1cclxuXHJcbiAgLy8gQ29udmVydCBlbXB0eSB2YWx1ZXMgdG8gYG51bGxgLlxyXG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICB2YWx1ZSA9IG51bGxcclxuICB9XHJcblxyXG4gIHJldHVybiB2YWx1ZVxyXG59XHJcblxyXG4vLyBEZWNvZGVzIG51bWVyaWMgZXJyb3IgY29kZSB0byBhIHN0cmluZyBjb2RlLlxyXG4vLyBodHRwczovL2dpdGh1Yi5jb20vU2hlZXRKUy9zaGVldGpzL2Jsb2IvMTk2MjBkYTMwYmUyYTdkN2I5ODAxOTM4YTBiOWIxZmQzYzRjNGIwMC9kb2NiaXRzLzUyX2RhdGF0eXBlLm1kXHJcbmZ1bmN0aW9uIGRlY29kZUVycm9yKGVycm9yQ29kZSkge1xyXG4gIC8vIFdoaWxlIHRoZSBlcnJvciB2YWx1ZXMgYXJlIGRldGVybWluZWQgYnkgdGhlIGFwcGxpY2F0aW9uLFxyXG4gIC8vIHRoZSBmb2xsb3dpbmcgYXJlIHNvbWUgZXhhbXBsZSBlcnJvciB2YWx1ZXMgdGhhdCBjb3VsZCBiZSB1c2VkOlxyXG4gIHN3aXRjaCAoZXJyb3JDb2RlKSB7XHJcbiAgICBjYXNlIDB4MDA6XHJcbiAgICAgIHJldHVybiAnI05VTEwhJ1xyXG4gICAgY2FzZSAweDA3OlxyXG4gICAgICByZXR1cm4gJyNESVYvMCEnXHJcbiAgICBjYXNlIDB4MEY6XHJcbiAgICAgIHJldHVybiAnI1ZBTFVFISdcclxuICAgIGNhc2UgMHgxNzpcclxuICAgICAgcmV0dXJuICcjUkVGISdcclxuICAgIGNhc2UgMHgxRDpcclxuICAgICAgcmV0dXJuICcjTkFNRT8nXHJcbiAgICBjYXNlIDB4MjQ6XHJcbiAgICAgIHJldHVybiAnI05VTSEnXHJcbiAgICBjYXNlIDB4MkE6XHJcbiAgICAgIHJldHVybiAnI04vQSdcclxuICAgIGNhc2UgMHgyQjpcclxuICAgICAgcmV0dXJuICcjR0VUVElOR19EQVRBJ1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgLy8gU3VjaCBlcnJvciBjb2RlIGRvZXNuJ3QgZXhpc3QuIEkgbWFkZSBpdCB1cC5cclxuICAgICAgcmV0dXJuIGAjRVJST1JfJHtlcnJvckNvZGV9YFxyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VTdHJpbmcodmFsdWUsIG9wdGlvbnMpIHtcclxuICAvLyBJbiBzb21lIHdlaXJkIGNhc2VzLCBhIGRldmVsb3BlciBtaWdodCB3YW50IHRvIGRpc2FibGVcclxuICAvLyB0aGUgYXV0b21hdGljIHRyaW1taW5nIG9mIGFsbCBzdHJpbmdzLlxyXG4gIC8vIEZvciBleGFtcGxlLCBsZWFkaW5nIHNwYWNlcyBtaWdodCBleHByZXNzIGEgdHJlZS1saWtlIGhpZXJhcmNoeS5cclxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vY2F0YW1waGV0YW1pbmUvcmVhZC1leGNlbC1maWxlL3B1bGwvMTA2I2lzc3VlY29tbWVudC0xMTM2MDYyOTE3XHJcbiAgaWYgKG9wdGlvbnMudHJpbSAhPT0gZmFsc2UpIHtcclxuICAgIHZhbHVlID0gdmFsdWUudHJpbSgpXHJcbiAgfVxyXG4gIGlmICh2YWx1ZSA9PT0gJycpIHtcclxuICAgIHZhbHVlID0gdW5kZWZpbmVkXHJcbiAgfVxyXG4gIHJldHVybiB2YWx1ZVxyXG59XHJcblxyXG4vLyBQYXJzZXMgYSBudW1iZXIgZnJvbSBzdHJpbmcuXHJcbi8vIFRocm93cyBhbiBlcnJvciBpZiB0aGUgbnVtYmVyIGNvdWxkbid0IGJlIHBhcnNlZC5cclxuLy8gV2hlbiBwYXJzaW5nIGZsb2F0aW5nLXBvaW50IG51bWJlciwgaXMgYWZmZWN0ZWQgYnlcclxuLy8gdGhlIGphdmFzY3JpcHQgbnVtYmVyIGVuY29kaW5nIHByZWNpc2lvbiBpc3N1ZXM6XHJcbi8vIGh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL3dhdGNoP3Y9MmdJeGJUbjdHU2NcclxuLy8gaHR0cHM6Ly93d3cuYXZpb2NvbnN1bHRpbmcuY29tL2Jsb2cvb3ZlcmNvbWluZy1qYXZhc2NyaXB0LW51bWVyaWMtcHJlY2lzaW9uLWlzc3Vlc1xyXG5mdW5jdGlvbiBwYXJzZU51bWJlckRlZmF1bHQoc3RyaW5naWZpZWROdW1iZXIpIHtcclxuICBjb25zdCBwYXJzZWROdW1iZXIgPSBOdW1iZXIoc3RyaW5naWZpZWROdW1iZXIpXHJcbiAgaWYgKGlzTmFOKHBhcnNlZE51bWJlcikpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBcIm51bWVyaWNcIiBjZWxsIHZhbHVlOiAke3N0cmluZ2lmaWVkTnVtYmVyfWApXHJcbiAgfVxyXG4gIHJldHVybiBwYXJzZWROdW1iZXJcclxufSIsICJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYXJzZUNlbGxDb29yZGluYXRlcyhjb29yZGluYXRlc1N0cmluZykge1xyXG4gIC8vIENvb3JkaW5hdGUgZXhhbXBsZXM6IFwiQUEyMDkxXCIsIFwiUjk4OFwiLCBcIkIxXCIuXHJcbiAgY29uc3QgW2NvbHVtbiwgcm93XSA9IGNvb3JkaW5hdGVzU3RyaW5nLnNwbGl0KC8oXFxkKykvKVxyXG4gIHJldHVybiBbXHJcbiAgICAvLyBSb3cuXHJcbiAgICBOdW1iZXIocm93KSxcclxuICAgIC8vIENvbHVtbi5cclxuXHRcdC8vIEl0J3Mgbm90IGNsZWFyIHdoeSB3b3VsZCBgY29sdW1uYCBldmVyIGJlIG5vbi10cmltbWVkLFxyXG5cdFx0Ly8gYnV0IGlmIGl0IHdhcyBhZGRlZCBoZXJlIHRoZW4gcGVyaGFwcyBpdCBjb3VsZCBoeXBvdGhldGljYWxseSBoYXBwZW4sIG9yIHNtdGguXHJcbiAgICBnZXRDb2x1bW5OdW1iZXJGcm9tQ29sdW1uTGV0dGVycyhjb2x1bW4udHJpbSgpKVxyXG4gIF1cclxufVxyXG5cclxuLy8gTWFwcyBcIkExXCItbGlrZSBjb29yZGluYXRlcyB0byBgeyByb3csIGNvbHVtbiB9YCBudW1lcmljIGNvb3JkaW5hdGVzLlxyXG5jb25zdCBMRVRURVJTID0gW1wiXCIsIFwiQVwiLCBcIkJcIiwgXCJDXCIsIFwiRFwiLCBcIkVcIiwgXCJGXCIsIFwiR1wiLCBcIkhcIiwgXCJJXCIsIFwiSlwiLCBcIktcIiwgXCJMXCIsIFwiTVwiLCBcIk5cIiwgXCJPXCIsIFwiUFwiLCBcIlFcIiwgXCJSXCIsIFwiU1wiLCBcIlRcIiwgXCJVXCIsIFwiVlwiLCBcIldcIiwgXCJYXCIsIFwiWVwiLCBcIlpcIl1cclxuXHJcbi8vIENvbnZlcnRzIGEgbGV0dGVyIGNvb3JkaW5hdGUgdG8gYSBkaWdpdCBjb29yZGluYXRlLlxyXG4vLyBFeGFtcGxlczogXCJBXCIgLT4gMSwgXCJCXCIgLT4gMiwgXCJaXCIgLT4gMjYsIFwiQUFcIiAtPiAyNywgZXRjLlxyXG5mdW5jdGlvbiBnZXRDb2x1bW5OdW1iZXJGcm9tQ29sdW1uTGV0dGVycyhjb2x1bW5MZXR0ZXJzKSB7XHJcbiAgLy8gYGZvciAuLi4gb2YgLi4uYCB3b3VsZCByZXF1aXJlIEJhYmVsIHBvbHlmaWxsIGZvciBpdGVyYXRpbmcgYSBzdHJpbmcuXHJcbiAgbGV0IG4gPSAwXHJcbiAgbGV0IGkgPSAwXHJcbiAgd2hpbGUgKGkgPCBjb2x1bW5MZXR0ZXJzLmxlbmd0aCkge1xyXG4gICAgbiAqPSAyNlxyXG4gICAgbiArPSBMRVRURVJTLmluZGV4T2YoY29sdW1uTGV0dGVyc1tpXSlcclxuICAgIGkrK1xyXG4gIH1cclxuICByZXR1cm4gblxyXG59XHJcbiIsICJpbXBvcnQgcGFyc2VDZWxsVmFsdWUgZnJvbSAnLi9wYXJzZUNlbGxWYWx1ZS5qcydcclxuaW1wb3J0IHBhcnNlQ2VsbENvb3JkaW5hdGVzIGZyb20gJy4vcGFyc2VDZWxsQ29vcmRpbmF0ZXMuanMnXHJcblxyXG5pbXBvcnQge1xyXG4gIGdldENlbGxWYWx1ZUVsZW1lbnQsXHJcbiAgZ2V0Q2VsbElubGluZVN0cmluZ1ZhbHVlXHJcbn0gZnJvbSAnLi4veG1sL3hsc3guanMnXHJcblxyXG5pbXBvcnQge1xyXG4gIGdldE91dGVyWG1sXHJcbn0gZnJvbSAnLi4veG1sL2RvbS5qcydcclxuXHJcbi8vIEV4YW1wbGUgb2YgYSBgPGMvPmBlbGwgZWxlbWVudDpcclxuLy9cclxuLy8gPGM+XHJcbi8vICAgIDxmPnN0cmluZzwvZj4g4oCUIGZvcm11bGEuXHJcbi8vICAgIDx2PnN0cmluZzwvdj4g4oCUIGZvcm11bGEgcHJlLWNvbXB1dGVkIHZhbHVlLlxyXG4vLyAgICA8aXM+XHJcbi8vICAgICAgIDx0PnN0cmluZzwvdD4g4oCUIGFuIGBpbmxpbmVTdHJgIHN0cmluZyAocmF0aGVyIHRoYW4gYSBcImNvbW1vbiBzdHJpbmdcIiBmcm9tIGEgZGljdGlvbmFyeSkuXHJcbi8vICAgICAgIDxyPlxyXG4vLyAgICAgICAgICA8clByPlxyXG4vLyAgICAgICAgICAgIC4uLlxyXG4vLyAgICAgICAgICA8L3JQcj5cclxuLy8gICAgICAgICAgPHQ+c3RyaW5nPC90PlxyXG4vLyAgICAgICA8L3I+XHJcbi8vICAgICAgIDxyUGggc2I9XCIxXCIgZWI9XCIxXCI+XHJcbi8vICAgICAgICAgIDx0PnN0cmluZzwvdD5cclxuLy8gICAgICAgPC9yUGg+XHJcbi8vICAgICAgIDxwaG9uZXRpY1ByIGZvbnRJZD1cIjFcIi8+XHJcbi8vICAgIDwvaXM+XHJcbi8vICAgIDxleHRMc3Q+XHJcbi8vICAgICAgIDxleHQ+XHJcbi8vICAgICAgICAgIDwhLS1hbnkgZWxlbWVudC0tPlxyXG4vLyAgICAgICA8L2V4dD5cclxuLy8gICAgPC9leHRMc3Q+XHJcbi8vIDwvYz5cclxuLy9cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcGFyc2VDZWxsKGVsZW1lbnQsIHNoZWV0RG9jdW1lbnQsIHNoYXJlZFN0cmluZ3MsIHN0eWxlcywgZXBvY2gxOTA0LCBvcHRpb25zKSB7XHJcbiAgY29uc3QgY29vcmRpbmF0ZXMgPSBwYXJzZUNlbGxDb29yZGluYXRlcyhlbGVtZW50LmdldEF0dHJpYnV0ZSgncicpKVxyXG4gIGNvbnN0IHZhbHVlRWxlbWVudCA9IGdldENlbGxWYWx1ZUVsZW1lbnQoc2hlZXREb2N1bWVudCwgZWxlbWVudClcclxuXHJcbiAgLy8gV2hlbiB0aGUgdmFsdWUgZWxlbWVudCBkb2Vzbid0IGV4aXN0LCBpdCB3b3VsZCBiZSByZXR1cm5lZCBhcyBgdW5kZWZpbmVkYFxyXG4gIC8vIHdoZW4gdXNpbmcgYHhwYXRoYCBhbmQgYXMgYG51bGxgIHdoZW4gdXNpbmcgYERPTVBhcnNlcmAuXHJcbiAgLy8gU28gaGVyZSBpdCB1c2VzIGB2YWx1ZSAmJiAuLi5gIHN5bnRheCBpbnN0ZWFkIG9mIGBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkgeyAuLi4gfWBcclxuICAvLyBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIGJvdGggYHhwYXRoYCBhbmQgYERPTVBhcnNlcmAuXHJcbiAgY29uc3QgdmFsdWUgPSB2YWx1ZUVsZW1lbnQgJiYgdmFsdWVFbGVtZW50LnRleHRDb250ZW50XHJcbiAgY29uc3QgdHlwZSA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0JylcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIHJvdzogY29vcmRpbmF0ZXNbMF0sXHJcbiAgICBjb2x1bW46IGNvb3JkaW5hdGVzWzFdLFxyXG4gICAgdmFsdWU6IHBhcnNlQ2VsbFZhbHVlKHZhbHVlLCB0eXBlLCB7XHJcbiAgICAgIGdldElubGluZVN0cmluZ1ZhbHVlOiAoKSA9PiBnZXRDZWxsSW5saW5lU3RyaW5nVmFsdWUoc2hlZXREb2N1bWVudCwgZWxlbWVudCksXHJcbiAgICAgIGdldElubGluZVN0cmluZ1htbDogKCkgPT4gZ2V0T3V0ZXJYbWwoZWxlbWVudCksXHJcbiAgICAgIGdldFN0eWxlSWQ6ICgpID0+IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdzJyksXHJcbiAgICAgIHN0eWxlcyxcclxuICAgICAgc2hhcmVkU3RyaW5ncyxcclxuICAgICAgZXBvY2gxOTA0LFxyXG4gICAgICBvcHRpb25zXHJcbiAgICB9KVxyXG4gIH1cclxufSIsICJpbXBvcnQgeyBnZXRDZWxsRWxlbWVudHMgfSBmcm9tICcuLi94bWwveGxzeC5qcydcclxuXHJcbmltcG9ydCBwYXJzZUNlbGwgZnJvbSAnLi9wYXJzZUNlbGwuanMnXHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYXJzZUNlbGxzKHNoZWV0RG9jdW1lbnQsIHNoYXJlZFN0cmluZ3MsIHN0eWxlcywgZXBvY2gxOTA0LCBvcHRpb25zKSB7XHJcbiAgY29uc3QgY2VsbHMgPSBnZXRDZWxsRWxlbWVudHMoc2hlZXREb2N1bWVudClcclxuXHJcbiAgaWYgKGNlbGxzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgcmV0dXJuIFtdXHJcbiAgfVxyXG5cclxuICAvLyBJdCBzZWVtcyBsaWtlIHRoZSBpZGVhIG9mIHBhcnNpbmcgXCJtZXJnZWQgY2VsbHNcIiB3YXMgYWJhbmRvbmVkIHdpdGhvdXQgYmVpbmcgZmluaXNoZWQuXHJcbiAgLy8gSGVyZSwgaXQgc2VlbXMgdG8ganVzdCBnZXQgdG8gdGhlIHN0YWdlIG9mIHBhcnNpbmcgbWVyZ2VkIGNlbGwgY29vcmRpbmF0ZXMuXHJcbiAgLy8gUGVyaGFwcyBpdCdzIGJlY2F1c2UgaXQncyBub3QgY2xlYXIgaG93IHdvdWxkIHRoZSBwYWNrYWdlIHJldHVybiBtZXJnZWQgY2VsbCByZXN1bHRzLlxyXG4gIC8vIEkuZS4gc2hvdWxkIGl0IGp1c3QgZHVwbGljYXRlIHRoZSB2YWx1ZSBpbiBlYWNoIG9uZSBvZiB0aGUgbWVyZ2VkIGNlbGxzP1xyXG4gIC8vIE9yIHNob3VsZCBpdCBrZWVwIHRoZSBleGlzdGluZyBiZWhhdmlvciBvZiBvbmx5IHJldHVybmluZyB0aGUgdmFsdWUgb2YgdGhlIHRvcC1tb3N0IGxlZnQtbW9zdCBjZWxsXHJcbiAgLy8gYW5kIHRoZW4gcmV0dXJuIGBudWxsYCBmb3IgdGhlIG90aGVyIG9uZXM/XHJcbiAgLy8gUGVyaGFwcyB0aGUgbGF0dGVyIChleGlzdGluZykgYXBwcm9hY2ggd2FzIGZvdW5kIHRvIGJlIHRoZSBtb3N0IHNlbnNpYmxlLlxyXG4gIC8vXHJcbiAgLy8gY29uc3QgbWVyZ2VkQ2VsbHMgPSBnZXRNZXJnZWRDZWxsQ29vcmRpbmF0ZXMoc2hlZXREb2N1bWVudClcclxuICAvLyBmb3IgKGNvbnN0IG1lcmdlZENlbGwgb2YgbWVyZ2VkQ2VsbHMpIHtcclxuICAvLyAgIGNvbnN0IFtmcm9tLCB0b10gPSBtZXJnZWRDZWxsLnNwbGl0KCc6JykubWFwKHBhcnNlQ2VsbENvb3JkaW5hdGVzKVxyXG4gIC8vICAgY29uc29sZS5sb2coJ01lcmdlZCBDZWxsLicsICdGcm9tOicsIGZyb20sICdUbzonLCB0bylcclxuICAvLyB9XHJcblxyXG4gIHJldHVybiBjZWxscy5tYXAoKGVsZW1lbnQpID0+IHtcclxuICAgIHJldHVybiBwYXJzZUNlbGwoZWxlbWVudCwgc2hlZXREb2N1bWVudCwgc2hhcmVkU3RyaW5ncywgc3R5bGVzLCBlcG9jaDE5MDQsIG9wdGlvbnMpXHJcbiAgfSlcclxufSIsICJpbXBvcnQgcGFyc2VDZWxsQ29vcmRpbmF0ZXMgZnJvbSAnLi9wYXJzZUNlbGxDb29yZGluYXRlcy5qcydcclxuXHJcbmltcG9ydCB7IGdldERpbWVuc2lvbnMgfSBmcm9tICcuLi94bWwveGxzeC5qcydcclxuXHJcbi8vIGBkaW1lbnNpb25zYCBkZWZpbmVzIHRoZSBzcHJlYWRzaGVldCBhcmVhIGNvbnRhaW5pbmcgYWxsIG5vbi1lbXB0eSBjZWxscy5cclxuLy8gaHR0cHM6Ly9kb2NzLm1pY3Jvc29mdC5jb20vZW4tdXMvZG90bmV0L2FwaS9kb2N1bWVudGZvcm1hdC5vcGVueG1sLnNwcmVhZHNoZWV0LnNoZWV0ZGltZW5zaW9uP3ZpZXc9b3BlbnhtbC0yLjguMVxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYXJzZVNoZWV0RGltZW5zaW9ucyhzaGVldERvY3VtZW50KSB7XHJcbiAgbGV0IGRpbWVuc2lvbnMgPSBnZXREaW1lbnNpb25zKHNoZWV0RG9jdW1lbnQpXHJcbiAgaWYgKGRpbWVuc2lvbnMpIHtcclxuICAgIGRpbWVuc2lvbnMgPSBkaW1lbnNpb25zLnNwbGl0KCc6JykubWFwKHBhcnNlQ2VsbENvb3JkaW5hdGVzKS5tYXAoKFtyb3csIGNvbHVtbl0pID0+ICh7XHJcbiAgICAgIHJvdyxcclxuICAgICAgY29sdW1uXHJcbiAgICB9KSlcclxuICAgIC8vIFNvbWV0aW1lcyB0aGVyZSBjYW4gYmUganVzdCBhIHNpbmdsZSBjZWxsIGFzIGEgc3ByZWFkc2hlZXQncyBcImRpbWVuc2lvbnNcIi5cclxuICAgIC8vIEZvciBleGFtcGxlLCB0aGUgZGVmYXVsdCBcImRpbWVuc2lvbnNcIiBpbiBBcGFjaGUgUE9JIGxpYnJhcnkgaXMgXCJBMVwiLFxyXG4gICAgLy8gbWVhbmluZyB0aGF0IG9ubHkgdGhlIGZpcnN0IGNlbGwgaW4gdGhlIHNwcmVhZHNoZWV0IGlzIHVzZWQuXHJcbiAgICAvL1xyXG4gICAgLy8gQSBxdW90ZSBmcm9tIEFwYWNoZSBQT0kgbGlicmFyeTpcclxuICAgIC8vIFwiU2luZ2xlIGNlbGwgcmFuZ2VzIGFyZSBmb3JtYXR0ZWQgbGlrZSBzaW5nbGUgY2VsbCByZWZlcmVuY2VzIChlLmcuICdBMScgaW5zdGVhZCBvZiAnQTE6QTEnKS5cIlxyXG4gICAgLy9cclxuICAgIGlmIChkaW1lbnNpb25zLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICBkaW1lbnNpb25zID0gW2RpbWVuc2lvbnNbMF0sIGRpbWVuc2lvbnNbMF1dXHJcbiAgICB9XHJcbiAgICByZXR1cm4gZGltZW5zaW9uc1xyXG4gIH1cclxufVxyXG4iLCAiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmVjb25zdHJ1Y3RTaGVldERpbWVuc2lvbnNGcm9tU2hlZXRDZWxscyhjZWxscykge1xyXG4gIGNvbnN0IGNvbXBhcmF0b3IgPSAoYSwgYikgPT4gYSAtIGJcclxuICBjb25zdCBhbGxSb3dzID0gY2VsbHMubWFwKGNlbGwgPT4gY2VsbC5yb3cpLnNvcnQoY29tcGFyYXRvcilcclxuICBjb25zdCBhbGxDb2xzID0gY2VsbHMubWFwKGNlbGwgPT4gY2VsbC5jb2x1bW4pLnNvcnQoY29tcGFyYXRvcilcclxuICBjb25zdCBtaW5Sb3cgPSBhbGxSb3dzWzBdXHJcbiAgY29uc3QgbWF4Um93ID0gYWxsUm93c1thbGxSb3dzLmxlbmd0aCAtIDFdXHJcbiAgY29uc3QgbWluQ29sID0gYWxsQ29sc1swXVxyXG4gIGNvbnN0IG1heENvbCA9IGFsbENvbHNbYWxsQ29scy5sZW5ndGggLSAxXVxyXG4gIHJldHVybiBbXHJcbiAgICB7IHJvdzogbWluUm93LCBjb2x1bW46IG1pbkNvbCB9LFxyXG4gICAgeyByb3c6IG1heFJvdywgY29sdW1uOiBtYXhDb2wgfVxyXG4gIF1cclxufVxyXG4iLCAiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZHJvcEVtcHR5Um93cyhkYXRhLCB7XHJcbiAgcm93SW5kZXhTb3VyY2VNYXAsXHJcbiAgYWNjZXNzb3IgPSBfID0+IF8sXHJcbiAgb25seVRyaW1BdFRoZUVuZFxyXG59ID0ge30pIHtcclxuICAvLyBEcm9wIGVtcHR5IHJvd3MuXHJcbiAgbGV0IGkgPSBkYXRhLmxlbmd0aCAtIDFcclxuICB3aGlsZSAoaSA+PSAwKSB7XHJcbiAgICAvLyBDaGVjayBpZiB0aGUgcm93IGlzIGVtcHR5LlxyXG4gICAgbGV0IGVtcHR5ID0gdHJ1ZVxyXG4gICAgZm9yIChjb25zdCBjZWxsIG9mIGRhdGFbaV0pIHtcclxuICAgICAgaWYgKGFjY2Vzc29yKGNlbGwpICE9PSBudWxsKSB7XHJcbiAgICAgICAgZW1wdHkgPSBmYWxzZVxyXG4gICAgICAgIGJyZWFrXHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIFJlbW92ZSB0aGUgZW1wdHkgcm93LlxyXG4gICAgaWYgKGVtcHR5KSB7XHJcbiAgICAgIGRhdGEuc3BsaWNlKGksIDEpXHJcbiAgICAgIGlmIChyb3dJbmRleFNvdXJjZU1hcCkge1xyXG4gICAgICAgIHJvd0luZGV4U291cmNlTWFwLnNwbGljZShpLCAxKVxyXG4gICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKG9ubHlUcmltQXRUaGVFbmQpIHtcclxuICAgICAgYnJlYWtcclxuICAgIH1cclxuICAgIGktLVxyXG4gIH1cclxuICByZXR1cm4gZGF0YVxyXG59IiwgImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGRyb3BFbXB0eUNvbHVtbnMoZGF0YSwge1xyXG4gIGFjY2Vzc29yID0gXyA9PiBfLFxyXG4gIG9ubHlUcmltQXRUaGVFbmRcclxufSA9IHt9KSB7XHJcbiAgbGV0IGkgPSBkYXRhWzBdLmxlbmd0aCAtIDFcclxuICB3aGlsZSAoaSA+PSAwKSB7XHJcbiAgICBsZXQgZW1wdHkgPSB0cnVlXHJcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiBkYXRhKSB7XHJcbiAgICAgIGlmIChhY2Nlc3Nvcihyb3dbaV0pICE9PSBudWxsKSB7XHJcbiAgICAgICAgZW1wdHkgPSBmYWxzZVxyXG4gICAgICAgIGJyZWFrXHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChlbXB0eSkge1xyXG4gICAgICBsZXQgaiA9IDA7XHJcbiAgICAgIHdoaWxlIChqIDwgZGF0YS5sZW5ndGgpIHtcclxuICAgICAgICBkYXRhW2pdLnNwbGljZShpLCAxKVxyXG4gICAgICAgIGorK1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKG9ubHlUcmltQXRUaGVFbmQpIHtcclxuICAgICAgYnJlYWtcclxuICAgIH1cclxuICAgIGktLVxyXG4gIH1cclxuICByZXR1cm4gZGF0YVxyXG59IiwgImltcG9ydCBkcm9wRW1wdHlSb3dzIGZyb20gJy4vZHJvcEVtcHR5Um93cy5qcydcclxuaW1wb3J0IGRyb3BFbXB0eUNvbHVtbnMgZnJvbSAnLi9kcm9wRW1wdHlDb2x1bW5zLmpzJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gY29udmVydENlbGxzVG9EYXRhMmRBcnJheShjZWxscywgZGltZW5zaW9ucykge1xyXG4gIC8vIElmIHRoZSBzaGVldCBpcyBlbXB0eS5cclxuICBpZiAoY2VsbHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICByZXR1cm4gW11cclxuICB9XHJcblxyXG4gIGNvbnN0IFtsZWZ0VG9wLCByaWdodEJvdHRvbV0gPSBkaW1lbnNpb25zXHJcblxyXG4gIC8vIERvbid0IGRpc2NhcmQgZW1wdHkgcm93cyBvciBjb2x1bW5zIGF0IHRoZSBzdGFydCBvZiB0aGUgc3ByZWFkc2hlZXQsXHJcbiAgLy8gZXZlbiB3aGVuIHRoZSBgKi54bHN4YCBmaWxlIGl0c2VsZiB0ZWxscyB0aGF0IHRoZSBjb250ZW50IHN0YXJ0cyBhdCBhbiBvZmZzZXQuXHJcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2NhdGFtcGhldGFtaW5lL3JlYWQtZXhjZWwtZmlsZS9pc3N1ZXMvMTAyXHJcbiAgLy8gY29uc3QgY29sc0NvdW50ID0gKHJpZ2h0Qm90dG9tLmNvbHVtbiAtIGxlZnRUb3AuY29sdW1uKSArIDFcclxuICAvLyBjb25zdCByb3dzQ291bnQgPSAocmlnaHRCb3R0b20ucm93IC0gbGVmdFRvcC5yb3cpICsgMVxyXG5cclxuICBjb25zdCBjb2xzQ291bnQgPSByaWdodEJvdHRvbS5jb2x1bW5cclxuICBjb25zdCByb3dzQ291bnQgPSByaWdodEJvdHRvbS5yb3dcclxuXHJcbiAgLy8gSW5pdGlhbGl6ZSBzcHJlYWRzaGVldCBkYXRhIHN0cnVjdHVyZS5cclxuICBsZXQgZGF0YSA9IG5ldyBBcnJheShyb3dzQ291bnQpXHJcbiAgbGV0IGkgPSAwXHJcbiAgd2hpbGUgKGkgPCByb3dzQ291bnQpIHtcclxuICAgIGRhdGFbaV0gPSBuZXcgQXJyYXkoY29sc0NvdW50KVxyXG4gICAgbGV0IGogPSAwXHJcbiAgICB3aGlsZSAoaiA8IGNvbHNDb3VudCkge1xyXG4gICAgICBkYXRhW2ldW2pdID0gbnVsbFxyXG4gICAgICBqKytcclxuICAgIH1cclxuICAgIGkrK1xyXG4gIH1cclxuXHJcbiAgLy8gRmlsbCBpbiBzcHJlYWRzaGVldCBgZGF0YWAuXHJcbiAgLy8gKHRoaXMgY29kZSBpbXBsaWVzIHRoYXQgYGNlbGxzYCBhcmVuJ3QgbmVjZXNzYXJpbHkgc29ydGVkIGJ5IHJvdyBhbmQgY29sdW1uOlxyXG4gIC8vICBtYXliZSB0aGF0J3Mgbm90IGNvcnJlY3QsIHRoaXMgcGllY2UgY29kZSB3YXMgaW5pdGlhbGx5IGNvcHktcGFzdGVkXHJcbiAgLy8gIGZyb20gc29tZSBvdGhlciBsaWJyYXJ5IHRoYXQgdXNlZCBgWFBhdGhgKVxyXG4gIGZvciAoY29uc3QgY2VsbCBvZiBjZWxscykge1xyXG4gICAgLy8gRG9uJ3QgZGlzY2FyZCBlbXB0eSByb3dzIG9yIGNvbHVtbnMgYXQgdGhlIHN0YXJ0IG9mIHRoZSBzcHJlYWRzaGVldCxcclxuICAgIC8vIGV2ZW4gd2hlbiB0aGUgYCoueGxzeGAgZmlsZSBpdHNlbGYgdGVsbHMgdGhhdCB0aGUgY29udGVudCBzdGFydHMgYXQgYW4gb2Zmc2V0LlxyXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2NhdGFtcGhldGFtaW5lL3JlYWQtZXhjZWwtZmlsZS9pc3N1ZXMvMTAyXHJcbiAgICAvLyBjb25zdCByb3dJbmRleCA9IGNlbGwucm93IC0gbGVmdFRvcC5yb3dcclxuICAgIC8vIGNvbnN0IGNvbHVtbkluZGV4ID0gY2VsbC5jb2x1bW4gLSBsZWZ0VG9wLmNvbHVtblxyXG4gICAgY29uc3Qgcm93SW5kZXggPSBjZWxsLnJvdyAtIDFcclxuICAgIGNvbnN0IGNvbHVtbkluZGV4ID0gY2VsbC5jb2x1bW4gLSAxXHJcbiAgICAvLyBJZ25vcmUgdGhlIGRhdGEgaW4gdGhlIGNlbGwgaWYgaXQncyBvdXRzaWRlIG9mIHRoZSBzcHJlYWRzaGVldCdzIFwiZGltZW5zaW9uc1wiLlxyXG4gICAgaWYgKGNvbHVtbkluZGV4IDwgY29sc0NvdW50ICYmIHJvd0luZGV4IDwgcm93c0NvdW50KSB7XHJcbiAgICAgIGRhdGFbcm93SW5kZXhdW2NvbHVtbkluZGV4XSA9IGNlbGwudmFsdWVcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIC8vIEZpbGwgaW4gdGhlIHJvdyBtYXAsIGlmIHRoZSByb3cgbWFwIHdhcyBwYXNzZWQuXHJcbiAgLy8gaWYgKG9wdGlvbnMucm93SW5kZXhTb3VyY2VNYXApIHtcclxuICAvLyAgIGxldCBpID0gMFxyXG4gIC8vICAgd2hpbGUgKGkgPCBkYXRhLmxlbmd0aCkge1xyXG4gIC8vICAgICBvcHRpb25zLnJvd0luZGV4U291cmNlTWFwW2ldID0gaVxyXG4gIC8vICAgICBpKytcclxuICAvLyAgIH1cclxuICAvLyB9XHJcblxyXG4gIC8vIERyb3AgKGRpc2NhcmQpIGVtcHR5IGNvbHVtbnMgYXQgdGhlIHJpZ2h0IHNpZGUuXHJcbiAgLy8gRHJvcCAoZGlzY2FyZCkgZW1wdHkgcm93cyBhdCB0aGUgYm90dG9tLlxyXG4gIGRhdGEgPSBkcm9wRW1wdHlSb3dzKFxyXG4gICAgZHJvcEVtcHR5Q29sdW1ucyhkYXRhLCB7IG9ubHlUcmltQXRUaGVFbmQ6IHRydWUgfSksXHJcbiAgICB7IG9ubHlUcmltQXRUaGVFbmQ6IHRydWUgfSAvLyB7IG9ubHlUcmltQXRUaGVFbmQ6IHRydWUsIHJvd0luZGV4U291cmNlTWFwOiBvcHRpb25zLnJvd0luZGV4U291cmNlTWFwIH1cclxuICApXHJcblxyXG4gIHJldHVybiBkYXRhXHJcbn0iLCAiaW1wb3J0IHBhcnNlQ2VsbHMgZnJvbSAnLi9wYXJzZUNlbGxzLmpzJ1xyXG5pbXBvcnQgcGFyc2VTaGVldERpbWVuc2lvbnMgZnJvbSAnLi9wYXJzZVNoZWV0RGltZW5zaW9ucy5qcydcclxuaW1wb3J0IHJlY29uc3RydWN0U2hlZXREaW1lbnNpb25zRnJvbVNoZWV0Q2VsbHMgZnJvbSAnLi9yZWNvbnN0cnVjdFNoZWV0RGltZW5zaW9uc0Zyb21TaGVldENlbGxzLmpzJ1xyXG5pbXBvcnQgY29udmVydFNoZWV0VG9EYXRhMmRBcnJheSBmcm9tICcuL2NvbnZlcnRDZWxsc1RvRGF0YTJkQXJyYXkuanMnXHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYXJzZVNoZWV0KGNvbnRlbnQsIHhtbCwgc2hhcmVkU3RyaW5ncywgc3R5bGVzLCBlcG9jaDE5MDQsIG9wdGlvbnMpIHtcclxuICBjb25zdCBzaGVldERvY3VtZW50ID0geG1sLmNyZWF0ZURvY3VtZW50KGNvbnRlbnQpXHJcblxyXG4gIGNvbnN0IGNlbGxzID0gcGFyc2VDZWxscyhzaGVldERvY3VtZW50LCBzaGFyZWRTdHJpbmdzLCBzdHlsZXMsIGVwb2NoMTkwNCwgb3B0aW9ucylcclxuXHJcbiAgLy8gYGRpbWVuc2lvbnNgIGRlZmluZXMgdGhlIHNwcmVhZHNoZWV0IGFyZWEgZW5jbG9zaW5nIGFsbCBub24tZW1wdHkgY2VsbHMuXHJcbiAgLy8gaHR0cHM6Ly9kb2NzLm1pY3Jvc29mdC5jb20vZW4tdXMvZG90bmV0L2FwaS9kb2N1bWVudGZvcm1hdC5vcGVueG1sLnNwcmVhZHNoZWV0LnNoZWV0ZGltZW5zaW9uP3ZpZXc9b3BlbnhtbC0yLjguMVxyXG4gIGNvbnN0IGRpbWVuc2lvbnMgPSBwYXJzZVNoZWV0RGltZW5zaW9ucyhzaGVldERvY3VtZW50KSB8fCByZWNvbnN0cnVjdFNoZWV0RGltZW5zaW9uc0Zyb21TaGVldENlbGxzKGNlbGxzKVxyXG5cclxuICByZXR1cm4gY29udmVydFNoZWV0VG9EYXRhMmRBcnJheShjZWxscywgZGltZW5zaW9ucylcclxufSIsICJpbXBvcnQgcGFyc2VTcHJlYWRzaGVldEluZm8gZnJvbSAnLi9wYXJzZVNwcmVhZHNoZWV0SW5mby5qcydcclxuaW1wb3J0IHBhcnNlRmlsZVBhdGhzIGZyb20gJy4vcGFyc2VGaWxlUGF0aHMuanMnXHJcbmltcG9ydCBwYXJzZVN0eWxlcyBmcm9tICcuL3BhcnNlU3R5bGVzLmpzJ1xyXG5pbXBvcnQgcGFyc2VTaGFyZWRTdHJpbmdzIGZyb20gJy4vcGFyc2VTaGFyZWRTdHJpbmdzLmpzJ1xyXG5pbXBvcnQgcGFyc2VTaGVldCBmcm9tICcuL3BhcnNlU2hlZXQuanMnXHJcblxyXG4vLyBGb3IgYW4gaW50cm9kdWN0aW9uIGluIHJlYWRpbmcgYC54bHN4YCBmaWxlcyBzZWUgXCJUaGUgbWluaW11bSB2aWFibGUgWExTWCByZWFkZXJcIjpcclxuLy8gaHR0cHM6Ly93d3cuYnJlbmRhbmxvbmcuY29tL3RoZS1taW5pbXVtLXZpYWJsZS14bHN4LXJlYWRlci5odG1sXHJcblxyXG4vKipcclxuICogUmVhZHMgZGF0YSBmcm9tIGFuIGAueGxzeGAgZmlsZS5cclxuICogQHBhcmFtICB7UmVjb3JkPHN0cmluZyxzdHJpbmc+fSBjb250ZW50cyAtIEEgbWFwIG9mIGAueG1sYCBmaWxlcyBpbnNpZGUgdGhlIGAueGxzeGAgZmlsZSAod2hpY2ggaXRzZWxmIGlzIGp1c3QgYSB6aXBwZWQgZGlyZWN0b3J5KS5cclxuICogQHBhcmFtICB7b2JqZWN0fSB4bWwg4oCUIEFuIG9iamVjdCBoYXZpbmcgYSBzaW5nbGUgcHJvcGVydHkg4oCUIGBjcmVhdGVEb2N1bWVudChzdHJpbmcpYCBmdW5jdGlvbi5cclxuICogQHBhcmFtICB7b2JqZWN0fSBbb3B0aW9uc11cclxuICogQHJldHVybiB7UmVhZEZpbGVSZXN1bHR9XHJcbiAqL1xyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYXJzZVNwcmVhZHNoZWV0Q29udGVudHMoY29udGVudHMsIHhtbCwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgY29uc3QgZ2V0RmlsZUNvbnRlbnQgPSAoZmlsZVBhdGgpID0+IHtcclxuICAgIGlmICghY29udGVudHNbZmlsZVBhdGhdKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgXCIke2ZpbGVQYXRofVwiIGZpbGUgbm90IGZvdW5kIGluc2lkZSB0aGUgKi54bHN4IGZpbGUgemlwIGFyY2hpdmVgKVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGNvbnRlbnRzW2ZpbGVQYXRoXVxyXG4gIH1cclxuXHJcbiAgLy8gUmVhZCB0aGUgcGF0aHMgdG8gY2VydGFpbiBmaWxlcyBpbnNpZGUgdGhlIGAueGxzeGAgZmlsZSwgd2hpY2ggaXMgaXRzZWxmIGp1c3QgYSBgLnppcGAgYXJjaGl2ZS5cclxuICAvLyBUaGVzZSBwYXRocyBhcmVuJ3Qgc3RhbmRhcmRpemVkIGJldHdlZW4gZGlmZmVyZW50IHNwcmVhZHNoZWV0IGVkaXRvcnMuXHJcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RpZHl2ZXJzZS9yZWFkeGwvaXNzdWVzLzEwNFxyXG4gIGNvbnN0IGZpbGVQYXRocyA9IHBhcnNlRmlsZVBhdGhzKGdldEZpbGVDb250ZW50KCd4bC9fcmVscy93b3JrYm9vay54bWwucmVscycpLCB4bWwpXHJcblxyXG4gIC8vIFRoZSB1c3VhbCBmaWxlIHBhdGggZm9yIFwic2hhcmVkIHN0cmluZ3NcIiBpcyBcInhsL3NoYXJlZFN0cmluZ3MueG1sXCIuXHJcbiAgY29uc3Qgc2hhcmVkU3RyaW5ncyA9IGZpbGVQYXRocy5zaGFyZWRTdHJpbmdzXHJcbiAgICA/IHBhcnNlU2hhcmVkU3RyaW5ncyhnZXRGaWxlQ29udGVudChmaWxlUGF0aHMuc2hhcmVkU3RyaW5ncyksIHhtbClcclxuICAgIDogW11cclxuXHJcbiAgLy8gVGhlIHVzdWFsIGZpbGUgcGF0aCBmb3IgXCJzdHlsZXNcIiBpcyBcInhsL3N0eWxlcy54bWxcIi5cclxuICBjb25zdCBzdHlsZXMgPSBmaWxlUGF0aHMuc3R5bGVzXHJcbiAgICA/IHBhcnNlU3R5bGVzKGdldEZpbGVDb250ZW50KGZpbGVQYXRocy5zdHlsZXMpLCB4bWwpXHJcbiAgICA6IHt9XHJcblxyXG4gIGNvbnN0IHsgc2hlZXRzLCBlcG9jaDE5MDQgfSA9IHBhcnNlU3ByZWFkc2hlZXRJbmZvKGdldEZpbGVDb250ZW50KCd4bC93b3JrYm9vay54bWwnKSwgeG1sKVxyXG5cclxuICBjb25zdCBzaGVldElkc1RvUmVhZCA9IG9wdGlvbnMuc2hlZXRzICYmIG9wdGlvbnMuc2hlZXRzLm1hcChzaGVldCA9PiBnZXRTaGVldElkKHNoZWV0LCBzaGVldHMpKVxyXG5cclxuICAvLyBQYXJzZSBzaGVldHMgZGF0YS5cclxuXHJcbiAgY29uc3Qgc2hlZXRzRGF0YSA9IFtdXHJcblxyXG4gIGZvciAoY29uc3Qgc2hlZXRJZCBvZiBPYmplY3Qua2V5cyhmaWxlUGF0aHMuc2hlZXRzKSkge1xyXG4gICAgaWYgKHNoZWV0SWRzVG9SZWFkICYmICFzaGVldElkc1RvUmVhZC5pbmNsdWRlcyhzaGVldElkKSkge1xyXG4gICAgICBjb250aW51ZVxyXG4gICAgfVxyXG5cclxuICAgIHNoZWV0c0RhdGEucHVzaCh7XHJcbiAgICAgIHNoZWV0OiBnZXRTaGVldE5hbWVCeUlkKHNoZWV0SWQsIHNoZWV0cyksXHJcbiAgICAgIGRhdGE6IHBhcnNlU2hlZXQoXHJcbiAgICAgICAgZ2V0RmlsZUNvbnRlbnQoZmlsZVBhdGhzLnNoZWV0c1tzaGVldElkXSksXHJcbiAgICAgICAgeG1sLFxyXG4gICAgICAgIHNoYXJlZFN0cmluZ3MsXHJcbiAgICAgICAgc3R5bGVzLFxyXG4gICAgICAgIGVwb2NoMTkwNCxcclxuICAgICAgICBvcHRpb25zXHJcbiAgICAgIClcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICAvLyBSZXR1cm4gc3ByZWFkc2hlZXQgZGF0YS5cclxuICByZXR1cm4gc2hlZXRzRGF0YVxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRTaGVldElkKHNoZWV0LCBzaGVldHMpIHtcclxuICBpZiAodHlwZW9mIHNoZWV0ID09PSAnc3RyaW5nJykge1xyXG4gICAgZm9yIChjb25zdCBfc2hlZXQgb2Ygc2hlZXRzKSB7XHJcbiAgICAgIGlmIChfc2hlZXQubmFtZSA9PT0gc2hlZXQpIHtcclxuICAgICAgICByZXR1cm4gX3NoZWV0LnJlbGF0aW9uSWRcclxuICAgICAgfVxyXG4gICAgfVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBTaGVldCBcIiR7c2hlZXR9XCIgbm90IGZvdW5kLiBBdmFpbGFibGUgc2hlZXRzOiAke3NoZWV0cy5tYXAoKHsgbmFtZSB9KSA9PiBgXCIke25hbWV9XCJgKS5qb2luKCcsICcpfWApXHJcbiAgfSBlbHNlIHtcclxuXHRcdGlmIChzaGVldCA8PSBzaGVldHMubGVuZ3RoKSB7XHJcbiAgICAgIHJldHVybiBzaGVldHNbc2hlZXQgLSAxXS5yZWxhdGlvbklkXHJcbiAgICB9XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFNoZWV0IG51bWJlciBvdXQgb2YgYm91bmRzOiAke3NoZWV0fS4gQXZhaWxhYmxlIHNoZWV0cyBjb3VudDogJHtzaGVldHMubGVuZ3RofWApXHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRTaGVldE5hbWVCeUlkKHNoZWV0SWQsIHNoZWV0cykge1xyXG4gIGZvciAoY29uc3Qgc2hlZXQgb2Ygc2hlZXRzKSB7XHJcbiAgICBpZiAoc2hlZXQucmVsYXRpb25JZCA9PT0gc2hlZXRJZCkge1xyXG4gICAgICByZXR1cm4gc2hlZXQubmFtZVxyXG4gICAgfVxyXG4gIH1cclxuICB0aHJvdyBuZXcgRXJyb3IoYFNoZWV0IElEIG5vdCBmb3VuZDogJHtzaGVldElkfWApXHJcbn0iLCAiaW1wb3J0IHhtbCBmcm9tICcuLi94bWwveG1sQnJvd3Nlci5qcydcclxuXHJcbmltcG9ydCB1bnBhY2tYbHN4RmlsZSBmcm9tICcuL3VucGFja1hsc3hGaWxlQnJvd3Nlci5qcydcclxuaW1wb3J0IHBhcnNlU3ByZWFkc2hlZXRDb250ZW50cyBmcm9tICcuLi94bHN4L3BhcnNlU3ByZWFkc2hlZXRDb250ZW50cy5qcydcclxuXHJcbi8qKlxyXG4gKiBSZWFkcyBhbiBgLnhsc3hgIGZpbGUuXHJcbiAqIEBwYXJhbSAgeyhGaWxlfEJsb2J8QXJyYXlCdWZmZXIpfSBpbnB1dFxyXG4gKiBAcGFyYW0gIHtvYmplY3R9IFtvcHRpb25zXVxyXG4gKiBAcmV0dXJuIHtQcm9taXNlPFJlYWRGaWxlUmVzdWx0Pn1cclxuICovXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJlYWRYbHN4RmlsZShpbnB1dCwgb3B0aW9ucykge1xyXG5cdHJldHVybiB1bnBhY2tYbHN4RmlsZShpbnB1dClcclxuXHRcdC50aGVuKChjb250ZW50cykgPT4gcGFyc2VTcHJlYWRzaGVldENvbnRlbnRzKGNvbnRlbnRzLCB4bWwsIG9wdGlvbnMpKVxyXG59IiwgIi8vIFhMU1ggcmVhZGluZyBmb3IgaW1wb3J0LiBVc2VzIHJlYWQtZXhjZWwtZmlsZSAoYnJvd3NlciBidWlsZCwgY2FuZGlkYXRlIEEgZnJvbSBQNC0wMikuXG4vLyB0cmltOmZhbHNlIGtlZXBzIGNlbGwgdGV4dCBleGFjdC4gRGF0ZXMgY29tZSBiYWNrIGFzIERhdGUgb2JqZWN0cyAoc2VlIGRvY3MvZGVjaXNpb25zL3hsc3gubWQgRjIpLlxuaW1wb3J0IHJlYWRYbHN4RmlsZSBmcm9tICdyZWFkLWV4Y2VsLWZpbGUvYnJvd3Nlcic7XG5pbXBvcnQgdHlwZSB7IElucHV0Q2VsbCB9IGZyb20gJy4uL2luZmVyLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBYbHN4U2hlZXQge1xuICBuYW1lOiBzdHJpbmc7XG4gIHJvd3M6IElucHV0Q2VsbFtdW107XG59XG5cbi8qKiBSZWFkIGV2ZXJ5IHNoZWV0LiByZWFkLWV4Y2VsLWZpbGUgdjggcmV0dXJucyBhbGwgc2hlZXRzOyB0aGUgY2FsbGVyIHBpY2tzIG9uZS4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkWGxzeFNoZWV0cyhkYXRhOiBBcnJheUJ1ZmZlcik6IFByb21pc2U8WGxzeFNoZWV0W10+IHtcbiAgY29uc3QgYWxsID0gYXdhaXQgcmVhZFhsc3hGaWxlKG5ldyBCbG9iKFtkYXRhXSksIHsgdHJpbTogZmFsc2UgfSk7XG4gIHJldHVybiBhbGwubWFwKChzKSA9PiAoe1xuICAgIG5hbWU6IHMuc2hlZXQsXG4gICAgcm93czogcy5kYXRhLm1hcCgocm93KSA9PiByb3cubWFwKChjZWxsKSA9PiAoY2VsbCA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IChjZWxsIGFzIElucHV0Q2VsbCkpKSksXG4gIH0pKTtcbn1cbiIsICIvLyBDb2x1bW4gdHlwZSBpbmZlcmVuY2UgZm9yIENTViBhbmQgWExTWCBpbXBvcnQgXHUyMDE0IHB1cmUgbG9naWMsIG5vIE9ic2lkaWFuIG9yIE5vZGUgaW1wb3J0cy5cbi8vIFN0ZXAgUDQtMDMgKFNBRC0zOCkuIFNwZWM6IHNwZWMvc3RlcHMvUDQtMDMubWQsIHNwZWMvZ3VpZGVsaW5lcy5tZCBQNC0wMyBhbmQgRy1QMywgRy1BNS5cbi8vXG4vLyBSdWxlcyAocmVjb3JkZWQgZm9yIGV2aWRlbmNlOyBhcHBsaWVkIGluIHRoaXMgb3JkZXIsIGZpcnN0IG1hdGNoIHdpbnMpOlxuLy8gIDAuIEVtcHR5IHZhbHVlcyAobnVsbCwgdW5kZWZpbmVkLCBlbXB0eSBvciB3aGl0ZXNwYWNlLW9ubHkgdGV4dCkgYXJlIGlnbm9yZWQuXG4vLyAgICAgQSBjb2x1bW4gd2l0aCBubyBub24tZW1wdHkgdmFsdWVzIGlzIHRleHQuXG4vLyAgMS4gY2hlY2tib3ggXHUyMDE0IGV2ZXJ5IG5vbi1lbXB0eSB2YWx1ZSBpcyBhIGJvb2xlYW4sIG9yIHRleHQgdHJ1ZS9mYWxzZS95ZXMvbm8vMS8wXG4vLyAgICAgKGNhc2UtaW5zZW5zaXRpdmUsIHRyaW1tZWQpLCBvciB0aGUgbnVtYmVyIDAgb3IgMS4gU3BlYyB3b3JkIGxpc3Q7IFkvTiBpcyBOT1QgaW5jbHVkZWQuXG4vLyAgMi4gbnVtYmVyICAgXHUyMDE0IGV2ZXJ5IG5vbi1lbXB0eSB2YWx1ZSBpcyBhIGZpbml0ZSBudW1iZXIsIG9yIHRleHQgbWF0Y2hpbmdcbi8vICAgICBbKy1dPyhkaWdpdHNbLmRpZ2l0cz9dIHwgLmRpZ2l0cykoW2VFXVsrLV0/ZGlnaXRzKT8gIChkZWNpbWFsIHBvaW50IG9ubHksIEctQTUpLlxuLy8gICAgIFwiMSw1XCIsIFwiMSwwMDBcIiwgXCJOYU5cIiwgXCJJbmZpbml0eVwiIGFyZSBub3QgbnVtYmVycy5cbi8vICAzLiBkYXRlICAgICBcdTIwMTQgZXZlcnkgbm9uLWVtcHR5IHZhbHVlIGlzIGEgRGF0ZSAoVVRDIGNvbXBvbmVudHMgdXNlZCksIG9yIHRleHQgaW4gb25lIG9mOlxuLy8gICAgIC0gWVlZWS1NTS1ERCAgICAgICAgICAgICAgICAgICAgKElTTywgYWx3YXlzIHVuYW1iaWd1b3VzKVxuLy8gICAgIC0gWVlZWS9NTS9ERCAgICAgICAgICAgICAgICAgICAgKHllYXIgZmlyc3QsIGFsd2F5cyB1bmFtYmlndW91cylcbi8vICAgICAtIEQgTW9uIFlZWVkgLyBEIE1vbnRoIFlZWVkgICAgIChFbmdsaXNoIG1vbnRoIG5hbWUsIGFsd2F5cyB1bmFtYmlndW91cylcbi8vICAgICAtIEEvQi9ZWVlZIG9yIEEuQi5ZWVlZICAgICAgICAgIChvbmUgcGFydCA+IDEyIGRlY2lkZXMgZGF5IHZzIG1vbnRoO1xuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIGJvdGggcGFydHMgPD0gMTIgdGhlIHZhbHVlIGlzIEFNQklHVU9VUyBhbmQgbm90IGEgZGF0ZSlcbi8vICAgICBBbGwgZGF0ZXMgbXVzdCBiZSB2YWxpZCBjYWxlbmRhciBkYXRlcyAoZS5nLiAyMDI2LTAyLTMwIGlzIG5vdCBhIGRhdGUpLlxuLy8gIDQuIHNpbmdsZV9zZWxlY3QgXHUyMDE0IHRoZSBjb2x1bW4gaXMgbm90IGNoZWNrYm94LCBudW1iZXIsIG9yIGRhdGUsIEFORCB0aGUgbnVtYmVyIG9mIGRpc3RpbmN0XG4vLyAgICAgbm9uLWVtcHR5IHZhbHVlcyBpcyA8PSAyMCBBTkQgZGlzdGluY3QgLyBub24tZW1wdHkgcm93cyA8PSAwLjUuIFRocmVzaG9sZHMgYXJlICpwcm9wb3NlZCpcbi8vICAgICAoRy1QMykgYW5kIHJlY29yZGVkIGluIHRoZSBkZWNpc2lvbiBsb2cuIFZhbHVlcyBhcmUgY29tcGFyZWQgYWZ0ZXIgdHJpbW1pbmcuXG4vLyAgNS4gdGV4dCAgICAgXHUyMDE0IGV2ZXJ5dGhpbmcgZWxzZSwgaW5jbHVkaW5nIGFsbCBhbWJpZ3VvdXMgY29sdW1ucyAoRy1QMykuXG4vL1xuLy8gVG9sZXJhbmNlOiBieSBkZWZhdWx0IGEgdHlwZSBhcHBsaWVzIG9ubHkgd2hlbiAxMDAlIG9mIG5vbi1lbXB0eSB2YWx1ZXMgbWF0Y2ggKG5vIGNlbGxcbi8vIHdvdWxkIGJlIGxvc3Qgb3IgYWx0ZXJlZCBvbiBpbXBvcnQpLiBBbiBvcHRpb25hbCBgdG9sZXJhbmNlYCAoZS5nLiAwLjA1KSBhbGxvd3MgdGhhdFxuLy8gZnJhY3Rpb24gb2Ygbm9uLW1hdGNoaW5nIHZhbHVlcy4gVGhvc2UgY2VsbHMgd291bGQgdGhlbiBiZSBsb3N0IG9uIGltcG9ydCwgc28gdGhpcyBpc1xuLy8gZm9yIGFjY3VyYWN5IHNlbnNpdGl2aXR5IGFuYWx5c2lzIG9ubHkgYW5kIGlzIE5PVCB0aGUgZGVmYXVsdC5cblxuZXhwb3J0IHR5cGUgSW5mZXJyZWRUeXBlID0gJ3RleHQnIHwgJ251bWJlcicgfCAnZGF0ZScgfCAnY2hlY2tib3gnIHwgJ3NpbmdsZV9zZWxlY3QnO1xuXG4vKiogQSByYXcgY2VsbCBhcyByZWFkIGZyb20gQ1NWIChzdHJpbmcpIG9yIFhMU1ggKG51bWJlciwgYm9vbGVhbiwgRGF0ZSwgc3RyaW5nLCBudWxsKS4gKi9cbmV4cG9ydCB0eXBlIElucHV0Q2VsbCA9IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gfCBEYXRlIHwgbnVsbCB8IHVuZGVmaW5lZDtcblxuZXhwb3J0IGludGVyZmFjZSBJbmZlcmVuY2VPcHRpb25zIHtcbiAgLyoqIEZyYWN0aW9uIG9mIG5vbi1lbXB0eSB2YWx1ZXMgYWxsb3dlZCB0byBub3QgbWF0Y2guIERlZmF1bHQgMCAoc3RyaWN0KS4gKi9cbiAgdG9sZXJhbmNlPzogbnVtYmVyO1xuICAvKiogTWF4IGRpc3RpbmN0IHZhbHVlcyBmb3Igc2luZ2xlX3NlbGVjdC4gRGVmYXVsdCAyMCAocHJvcG9zZWQpLiAqL1xuICBtYXhTZWxlY3REaXN0aW5jdD86IG51bWJlcjtcbiAgLyoqIE1heCBkaXN0aW5jdCAvIG5vbi1lbXB0eSByYXRpbyBmb3Igc2luZ2xlX3NlbGVjdC4gRGVmYXVsdCAwLjUgKHByb3Bvc2VkKS4gKi9cbiAgbWF4U2VsZWN0UmF0aW8/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29sdW1uSW5mZXJlbmNlIHtcbiAgdHlwZTogSW5mZXJyZWRUeXBlO1xuICAvKiogSHVtYW4tcmVhZGFibGUgcmVhc29uLCBmb3IgdGhlIGltcG9ydCByZXBvcnQuICovXG4gIHJlYXNvbjogc3RyaW5nO1xuICAvKiogTm9uLWVtcHR5IHZhbHVlcyBjb25zaWRlcmVkLiAqL1xuICBub25FbXB0eTogbnVtYmVyO1xuICAvKiogRGlzdGluY3QgdHJpbW1lZCBzdHJpbmcgdmFsdWVzIGFtb25nIG5vbi1lbXB0eSBjZWxscy4gKi9cbiAgZGlzdGluY3Q6IG51bWJlcjtcbiAgLyoqIEZyYWN0aW9uIG9mIG5vbi1lbXB0eSB2YWx1ZXMgdGhhdCBtYXRjaGVkIHRoZSBjaG9zZW4gdHlwZSAoMSB3aGVuIHN0cmljdCkuICovXG4gIG1hdGNoUmF0aW86IG51bWJlcjtcbiAgLyoqIERpc3RpbmN0IHRyaW1tZWQgdmFsdWVzLCBpbiBmaXJzdC1zZWVuIG9yZGVyLiBPbmx5IHNldCBmb3Igc2luZ2xlX3NlbGVjdC4gKi9cbiAgc2VsZWN0T3B0aW9ucz86IHN0cmluZ1tdO1xufVxuXG5jb25zdCBOVU1CRVJfUkUgPSAvXlsrLV0/KFxcZCsoXFwuXFxkKik/fFxcLlxcZCspKFtlRV1bKy1dP1xcZCspPyQvO1xuY29uc3QgSVNPX1JFID0gL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvO1xuY29uc3QgWU1EX1NMQVNIX1JFID0gL14oXFxkezR9KVxcLyhcXGR7Mn0pXFwvKFxcZHsyfSkkLztcbmNvbnN0IE5VTUVSSUNfRE1ZX1JFID0gL14oXFxkezEsMn0pKFsvLl0pKFxcZHsxLDJ9KVxcMihcXGR7NH0pJC87XG5jb25zdCBEQVlfTU9OVEhOQU1FX1lFQVJfUkUgPSAvXihcXGR7MSwyfSkgKFtBLVphLXpdKykgKFxcZHs0fSkkLztcbmNvbnN0IENIRUNLQk9YX1dPUkRTOiBSZWFkb25seVNldDxzdHJpbmc+ID0gbmV3IFNldChbJ3RydWUnLCAnZmFsc2UnLCAneWVzJywgJ25vJywgJzEnLCAnMCddKTtcbmNvbnN0IE1PTlRIUzogUmVhZG9ubHk8UmVjb3JkPHN0cmluZywgbnVtYmVyPj4gPSB7XG4gIGphbnVhcnk6IDEsIGZlYnJ1YXJ5OiAyLCBtYXJjaDogMywgYXByaWw6IDQsIG1heTogNSwganVuZTogNixcbiAganVseTogNywgYXVndXN0OiA4LCBzZXB0ZW1iZXI6IDksIG9jdG9iZXI6IDEwLCBub3ZlbWJlcjogMTEsIGRlY2VtYmVyOiAxMixcbiAgamFuOiAxLCBmZWI6IDIsIG1hcjogMywgYXByOiA0LCBqdW46IDYsIGp1bDogNywgYXVnOiA4LCBzZXA6IDksIG9jdDogMTAsIG5vdjogMTEsIGRlYzogMTIsXG59O1xuXG4vKipcbiAqIENhbGVuZGFyIGRheSAoVVRDKSBvZiBhIERhdGUgdGhhdCBpcyBleGFjdGx5IFVUQyBtaWRuaWdodCwgb3IgbnVsbC5cbiAqIHJlYWQtZXhjZWwtZmlsZSByZXR1cm5zIGludGVnZXIgRXhjZWwgZGF0ZSBzZXJpYWxzIGFzIFVUQyBtaWRuaWdodCBpbiBldmVyeSB0aW1lIHpvbmUgKHZlcmlmaWVkIGluXG4gKiBVVEMsIEFzaWEvRGhha2EsIEFtZXJpY2EvTG9zX0FuZ2VsZXMpLiBBIERhdGUgd2l0aCBhIHRpbWUtb2YtZGF5IGlzIG5vdCBkYXRlLW9ubHk6IGltcG9ydGluZyBpdFxuICogd291bGQgc2lsZW50bHkgZHJvcCB0aGUgdGltZSwgc28gaXQgaXMgbm90IGEgZGF0ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRhdGVPbmx5SXNvKGQ6IERhdGUpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKE51bWJlci5pc05hTihkLmdldFRpbWUoKSkpIHJldHVybiBudWxsO1xuICBpZiAoZC5nZXRVVENIb3VycygpICE9PSAwIHx8IGQuZ2V0VVRDTWludXRlcygpICE9PSAwIHx8IGQuZ2V0VVRDU2Vjb25kcygpICE9PSAwIHx8IGQuZ2V0VVRDTWlsbGlzZWNvbmRzKCkgIT09IDApIHJldHVybiBudWxsO1xuICByZXR1cm4gZC50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKTtcbn1cblxuLyoqIEtleSB1c2VkIGZvciBkaXN0aW5jdCBjb3VudGluZyBhbmQgc2VsZWN0IG9wdGlvbiBtYXRjaGluZzogdHJpbW1lZCB0ZXh0LCBvciBJU08gZm9yIERhdGVzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNlbGxLZXkodjogSW5wdXRDZWxsKTogc3RyaW5nIHtcbiAgcmV0dXJuIHYgaW5zdGFuY2VvZiBEYXRlID8gdi50b0lTT1N0cmluZygpIDogU3RyaW5nKHYpLnRyaW0oKTtcbn1cblxuLyoqIFRydWUgZm9yIG51bGwsIHVuZGVmaW5lZCwgYW5kIGVtcHR5IG9yIHdoaXRlc3BhY2Utb25seSB0ZXh0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRW1wdHlDZWxsKHY6IElucHV0Q2VsbCk6IGJvb2xlYW4ge1xuICByZXR1cm4gdiA9PT0gbnVsbCB8fCB2ID09PSB1bmRlZmluZWQgfHwgKHR5cGVvZiB2ID09PSAnc3RyaW5nJyAmJiB2LnRyaW0oKSA9PT0gJycpO1xufVxuXG5mdW5jdGlvbiBkYXlzSW5Nb250aCh5OiBudW1iZXIsIG06IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiBuZXcgRGF0ZShEYXRlLlVUQyh5LCBtLCAwKSkuZ2V0VVRDRGF0ZSgpO1xufVxuXG5mdW5jdGlvbiB2YWxpZFlNRCh5OiBudW1iZXIsIG06IG51bWJlciwgZDogbnVtYmVyKTogYm9vbGVhbiB7XG4gIGlmIChtIDwgMSB8fCBtID4gMTIgfHwgZCA8IDEpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIGQgPD0gZGF5c0luTW9udGgoeSwgbSk7XG59XG5cbmZ1bmN0aW9uIHltZCh5OiBudW1iZXIsIG06IG51bWJlciwgZDogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke1N0cmluZyh5KS5wYWRTdGFydCg0LCAnMCcpfS0ke1N0cmluZyhtKS5wYWRTdGFydCgyLCAnMCcpfS0ke1N0cmluZyhkKS5wYWRTdGFydCgyLCAnMCcpfWA7XG59XG5cbi8qKlxuICogUGFyc2UgYSBkYXRlIHRleHQgdW5kZXIgdGhlIGFjY2VwdGVkIGZvcm1hdHMuIFJldHVybnMgWVlZWS1NTS1ERCBvciBudWxsLlxuICogUmV0dXJucyBudWxsIGZvciBhbWJpZ3VvdXMgbnVtZXJpYyBkYXRlcyAoYm90aCBwYXJ0cyA8PSAxMikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZURhdGVUZXh0KGlucHV0OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgcyA9IGlucHV0LnRyaW0oKTtcbiAgbGV0IG0gPSBJU09fUkUuZXhlYyhzKTtcbiAgaWYgKG0pIHtcbiAgICBjb25zdCBbeSwgbW8sIGRdID0gW051bWJlcihtWzFdKSwgTnVtYmVyKG1bMl0pLCBOdW1iZXIobVszXSldO1xuICAgIHJldHVybiB2YWxpZFlNRCh5LCBtbywgZCkgPyB5bWQoeSwgbW8sIGQpIDogbnVsbDtcbiAgfVxuICBtID0gWU1EX1NMQVNIX1JFLmV4ZWMocyk7XG4gIGlmIChtKSB7XG4gICAgY29uc3QgW3ksIG1vLCBkXSA9IFtOdW1iZXIobVsxXSksIE51bWJlcihtWzJdKSwgTnVtYmVyKG1bM10pXTtcbiAgICByZXR1cm4gdmFsaWRZTUQoeSwgbW8sIGQpID8geW1kKHksIG1vLCBkKSA6IG51bGw7XG4gIH1cbiAgbSA9IE5VTUVSSUNfRE1ZX1JFLmV4ZWMocyk7XG4gIGlmIChtKSB7XG4gICAgY29uc3QgYSA9IE51bWJlcihtWzFdKTtcbiAgICBjb25zdCBiID0gTnVtYmVyKG1bM10pO1xuICAgIGNvbnN0IHkgPSBOdW1iZXIobVs0XSk7XG4gICAgbGV0IGRheTogbnVtYmVyO1xuICAgIGxldCBtb250aDogbnVtYmVyO1xuICAgIGlmIChhID4gMTIgJiYgYiA8PSAxMikge1xuICAgICAgZGF5ID0gYTtcbiAgICAgIG1vbnRoID0gYjtcbiAgICB9IGVsc2UgaWYgKGIgPiAxMiAmJiBhIDw9IDEyKSB7XG4gICAgICBkYXkgPSBiO1xuICAgICAgbW9udGggPSBhO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDsgLy8gYW1iaWd1b3VzIChib3RoIDw9IDEyKSBvciBpbXBvc3NpYmxlIChib3RoID4gMTIpXG4gICAgfVxuICAgIHJldHVybiB2YWxpZFlNRCh5LCBtb250aCwgZGF5KSA/IHltZCh5LCBtb250aCwgZGF5KSA6IG51bGw7XG4gIH1cbiAgbSA9IERBWV9NT05USE5BTUVfWUVBUl9SRS5leGVjKHMpO1xuICBpZiAobSkge1xuICAgIGNvbnN0IG1vbnRoID0gTU9OVEhTW21bMl0udG9Mb3dlckNhc2UoKV07XG4gICAgaWYgKG1vbnRoID09PSB1bmRlZmluZWQpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IGQgPSBOdW1iZXIobVsxXSk7XG4gICAgY29uc3QgeSA9IE51bWJlcihtWzNdKTtcbiAgICByZXR1cm4gdmFsaWRZTUQoeSwgbW9udGgsIGQpID8geW1kKHksIG1vbnRoLCBkKSA6IG51bGw7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXNDaGVja2JveCh2OiBJbnB1dENlbGwpOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiB2ID09PSAnYm9vbGVhbicpIHJldHVybiB0cnVlO1xuICBpZiAodHlwZW9mIHYgPT09ICdudW1iZXInKSByZXR1cm4gdiA9PT0gMCB8fCB2ID09PSAxO1xuICBpZiAodHlwZW9mIHYgPT09ICdzdHJpbmcnKSByZXR1cm4gQ0hFQ0tCT1hfV09SRFMuaGFzKHYudHJpbSgpLnRvTG93ZXJDYXNlKCkpO1xuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXNOdW1iZXIodjogSW5wdXRDZWxsKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicpIHJldHVybiBOdW1iZXIuaXNGaW5pdGUodik7XG4gIGlmICh0eXBlb2YgdiA9PT0gJ3N0cmluZycpIHtcbiAgICBjb25zdCB0ID0gdi50cmltKCk7XG4gICAgcmV0dXJuIE5VTUJFUl9SRS50ZXN0KHQpICYmIE51bWJlci5pc0Zpbml0ZShOdW1iZXIodCkpO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gbWF0Y2hlc0RhdGUodjogSW5wdXRDZWxsKTogYm9vbGVhbiB7XG4gIGlmICh2IGluc3RhbmNlb2YgRGF0ZSkgcmV0dXJuIGRhdGVPbmx5SXNvKHYpICE9PSBudWxsO1xuICBpZiAodHlwZW9mIHYgPT09ICdzdHJpbmcnKSByZXR1cm4gcGFyc2VEYXRlVGV4dCh2KSAhPT0gbnVsbDtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5jb25zdCBNQVRDSEVSUzogUmVhZG9ubHlBcnJheTxyZWFkb25seSBbSW5mZXJyZWRUeXBlLCAodjogSW5wdXRDZWxsKSA9PiBib29sZWFuXT4gPSBbXG4gIFsnY2hlY2tib3gnLCBtYXRjaGVzQ2hlY2tib3hdLFxuICBbJ251bWJlcicsIG1hdGNoZXNOdW1iZXJdLFxuICBbJ2RhdGUnLCBtYXRjaGVzRGF0ZV0sXG5dO1xuXG4vKiogSW5mZXIgdGhlIHR5cGUgb2Ygb25lIGNvbHVtbiBmcm9tIGl0cyByYXcgY2VsbCB2YWx1ZXMuICovXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJDb2x1bW4odmFsdWVzOiByZWFkb25seSBJbnB1dENlbGxbXSwgb3B0aW9uczogSW5mZXJlbmNlT3B0aW9ucyA9IHt9KTogQ29sdW1uSW5mZXJlbmNlIHtcbiAgY29uc3QgdG9sZXJhbmNlID0gb3B0aW9ucy50b2xlcmFuY2UgPz8gMDtcbiAgY29uc3QgbWF4RGlzdGluY3QgPSBvcHRpb25zLm1heFNlbGVjdERpc3RpbmN0ID8/IDIwO1xuICBjb25zdCBtYXhSYXRpbyA9IG9wdGlvbnMubWF4U2VsZWN0UmF0aW8gPz8gMC41O1xuXG4gIGNvbnN0IG5vbkVtcHR5VmFsdWVzOiBJbnB1dENlbGxbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHYgb2YgdmFsdWVzKSBpZiAoIWlzRW1wdHlDZWxsKHYpKSBub25FbXB0eVZhbHVlcy5wdXNoKHYpO1xuICBjb25zdCBub25FbXB0eSA9IG5vbkVtcHR5VmFsdWVzLmxlbmd0aDtcblxuICBjb25zdCBkaXN0aW5jdFNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBzZWxlY3RPcHRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHYgb2Ygbm9uRW1wdHlWYWx1ZXMpIHtcbiAgICBjb25zdCBrZXkgPSBjZWxsS2V5KHYpO1xuICAgIGlmICghZGlzdGluY3RTZXQuaGFzKGtleSkpIHtcbiAgICAgIGRpc3RpbmN0U2V0LmFkZChrZXkpO1xuICAgICAgc2VsZWN0T3B0aW9ucy5wdXNoKGtleSk7XG4gICAgfVxuICB9XG4gIGNvbnN0IGRpc3RpbmN0ID0gZGlzdGluY3RTZXQuc2l6ZTtcblxuICBpZiAobm9uRW1wdHkgPT09IDApIHtcbiAgICByZXR1cm4geyB0eXBlOiAndGV4dCcsIHJlYXNvbjogJ25vIG5vbi1lbXB0eSB2YWx1ZXMnLCBub25FbXB0eSwgZGlzdGluY3QsIG1hdGNoUmF0aW86IDEgfTtcbiAgfVxuXG4gIGZvciAoY29uc3QgW3R5cGUsIG1hdGNoZXNdIG9mIE1BVENIRVJTKSB7XG4gICAgbGV0IG9rID0gMDtcbiAgICBmb3IgKGNvbnN0IHYgb2Ygbm9uRW1wdHlWYWx1ZXMpIGlmIChtYXRjaGVzKHYpKSBvaysrO1xuICAgIGNvbnN0IHJhdGlvID0gb2sgLyBub25FbXB0eTtcbiAgICBpZiAocmF0aW8gPj0gMSAtIHRvbGVyYW5jZSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgcmVhc29uOiByYXRpbyA9PT0gMSA/IGBhbGwgJHtub25FbXB0eX0gbm9uLWVtcHR5IHZhbHVlcyBtYXRjaCAke3R5cGV9YCA6IGAkeyhyYXRpbyAqIDEwMCkudG9GaXhlZCgxKX0lIG9mIHZhbHVlcyBtYXRjaCAke3R5cGV9YCxcbiAgICAgICAgbm9uRW1wdHksXG4gICAgICAgIGRpc3RpbmN0LFxuICAgICAgICBtYXRjaFJhdGlvOiByYXRpbyxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgaWYgKGRpc3RpbmN0IDw9IG1heERpc3RpbmN0ICYmIGRpc3RpbmN0IC8gbm9uRW1wdHkgPD0gbWF4UmF0aW8pIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ3NpbmdsZV9zZWxlY3QnLFxuICAgICAgcmVhc29uOiBgJHtkaXN0aW5jdH0gZGlzdGluY3QgdmFsdWVzICg8PSAke21heERpc3RpbmN0fSkgYW5kICR7KGRpc3RpbmN0IC8gbm9uRW1wdHkgKiAxMDApLnRvRml4ZWQoMCl9JSBvZiByb3dzICg8PSAke21heFJhdGlvICogMTAwfSUpYCxcbiAgICAgIG5vbkVtcHR5LFxuICAgICAgZGlzdGluY3QsXG4gICAgICBtYXRjaFJhdGlvOiAxLFxuICAgICAgc2VsZWN0T3B0aW9ucyxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAndGV4dCcsXG4gICAgcmVhc29uOiBgbm8gc3RyaWN0IHR5cGUgbWF0Y2g7ICR7ZGlzdGluY3R9IGRpc3RpbmN0IHZhbHVlcyBkb2VzIG5vdCBxdWFsaWZ5IGZvciBzaW5nbGVfc2VsZWN0YCxcbiAgICBub25FbXB0eSxcbiAgICBkaXN0aW5jdCxcbiAgICBtYXRjaFJhdGlvOiAxLFxuICB9O1xufVxuXG4vKiogSW5mZXIgZXZlcnkgY29sdW1uIG9mIGEgcm93LW1ham9yIHRhYmxlLiBSb3dzIG1heSBiZSByYWdnZWQ7IG1pc3NpbmcgY2VsbHMgY291bnQgYXMgZW1wdHkuICovXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJUYWJsZShyb3dzOiByZWFkb25seSAocmVhZG9ubHkgSW5wdXRDZWxsW10pW10sIGNvbHVtbkNvdW50OiBudW1iZXIsIG9wdGlvbnM6IEluZmVyZW5jZU9wdGlvbnMgPSB7fSk6IENvbHVtbkluZmVyZW5jZVtdIHtcbiAgY29uc3Qgb3V0OiBDb2x1bW5JbmZlcmVuY2VbXSA9IFtdO1xuICBmb3IgKGxldCBjID0gMDsgYyA8IGNvbHVtbkNvdW50OyBjKyspIHtcbiAgICBjb25zdCBjb2x1bW46IElucHV0Q2VsbFtdID0gbmV3IEFycmF5PElucHV0Q2VsbD4ocm93cy5sZW5ndGgpO1xuICAgIGZvciAobGV0IHIgPSAwOyByIDwgcm93cy5sZW5ndGg7IHIrKykgY29sdW1uW3JdID0gcm93c1tyXVtjXTtcbiAgICBvdXQucHVzaChpbmZlckNvbHVtbihjb2x1bW4sIG9wdGlvbnMpKTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuIiwgIi8vIERldGVybWluaXN0aWMgSUQgZ2VuZXJhdGlvbiB1c2luZyBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKCkuXG4vLyBJRHMgdXNlIHByZWZpeGVzIGFuZCBhdCBsZWFzdCA4MCBiaXRzIG9mIHJhbmRvbW5lc3MgKEctQTYpLlxuXG5jb25zdCBDSEFSUyA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSc7XG5cbmZ1bmN0aW9uIHJhbmRvbUlkKHByZWZpeDogc3RyaW5nLCBsZW5ndGg6IG51bWJlciA9IDE2KTogc3RyaW5nIHtcbiAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuICBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKGJ5dGVzKTtcbiAgbGV0IHJlc3VsdCA9IHByZWZpeDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHJlc3VsdCArPSBDSEFSU1tieXRlc1tpXSAlIENIQVJTLmxlbmd0aF07XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlUm93SWQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJhbmRvbUlkKCdyb3dfJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUZpZWxkSWQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJhbmRvbUlkKCdmbGRfJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZU9wdGlvbklkKCk6IHN0cmluZyB7XG4gIHJldHVybiByYW5kb21JZCgnb3B0XycpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVUYWJsZUlkKCk6IHN0cmluZyB7XG4gIHJldHVybiByYW5kb21JZCgndGJsXycpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVWaWV3SWQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJhbmRvbUlkKCd2aWV3XycpO1xufVxuIiwgIi8vIFB1cmUgdmlldyBzdGF0ZSBsb2dpYyBcdTIwMTQgbm8gT2JzaWRpYW4gaW1wb3J0cy5cbi8vIEltcGxlbWVudHMgUDItMDM6IHZpZXcgb2JqZWN0IGRlZmluZSwgdmFsaWRhdGUsIHBlcnNpc3QsIGhhbmRsZSBkZWxldGVkIGZpZWxkcy5cbi8vIFNlZSBzcGVjL2ZlYXR1cmVzLm1kIFx1MDBBNzIuNywgc3BlYy9ndWlkZWxpbmVzLm1kIFAyLTAzLCBzcGVjL3BoYXNlcy9QMi5tZC5cblxuaW1wb3J0IHR5cGUgeyBGaWVsZERlZmluaXRpb24sIFZpZXdEZWZpbml0aW9uLCBTb3J0RW50cnksIFJvd0hlaWdodCB9IGZyb20gJy4vdHlwZXMuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVWaWV3SWQgfSBmcm9tICcuLi91dGlscy9pZEdlbi5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlld1ZhbGlkYXRpb25SZXN1bHQge1xuICB2aWV3OiBWaWV3RGVmaW5pdGlvbjtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICBvazogYm9vbGVhbjtcbn1cblxuY29uc3QgVkFMSURfUk9XX0hFSUdIVFM6IFJlYWRvbmx5U2V0PHN0cmluZz4gPSBuZXcgU2V0KFsnc21hbGwnLCAnbWVkaXVtJywgJ2xhcmdlJywgJ2NvbXBhY3QnLCAndGFsbCddKTtcbmNvbnN0IFZBTElEX0RJUkVDVElPTlM6IFJlYWRvbmx5U2V0PHN0cmluZz4gPSBuZXcgU2V0KFsnYXNjJywgJ2Rlc2MnXSk7XG5cbmZ1bmN0aW9uIGNsb25lVmlldyh2aWV3OiBWaWV3RGVmaW5pdGlvbik6IFZpZXdEZWZpbml0aW9uIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogdmlldy5pZCxcbiAgICBuYW1lOiB2aWV3Lm5hbWUsXG4gICAgc29ydDogdmlldy5zb3J0Lm1hcCgocykgPT4gKHsgZmllbGRJZDogcy5maWVsZElkLCBkaXJlY3Rpb246IHMuZGlyZWN0aW9uIH0pKSxcbiAgICBncm91cEJ5OiB2aWV3Lmdyb3VwQnksXG4gICAgaGlkZGVuOiBbLi4udmlldy5oaWRkZW5dLFxuICAgIGZyb3plbkNvbHVtbnM6IHZpZXcuZnJvemVuQ29sdW1ucyxcbiAgICByb3dIZWlnaHQ6IHZpZXcucm93SGVpZ2h0LFxuICAgIGNvbHVtbldpZHRoczogeyAuLi52aWV3LmNvbHVtbldpZHRocyB9LFxuICAgIGNvbHVtbk9yZGVyOiBbLi4udmlldy5jb2x1bW5PcmRlcl0sXG4gICAgLi4uKHZpZXcud2FybmluZ3MgPyB7IHdhcm5pbmdzOiBbLi4udmlldy53YXJuaW5nc10gfSA6IHt9KSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdFZpZXcoZmllbGRzOiBGaWVsZERlZmluaXRpb25bXSwgbmFtZSA9ICdEZWZhdWx0Jyk6IFZpZXdEZWZpbml0aW9uIHtcbiAgY29uc3QgY29sdW1uT3JkZXIgPSBmaWVsZHMubWFwKChmKSA9PiBmLmlkKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogZ2VuZXJhdGVWaWV3SWQoKSxcbiAgICBuYW1lLFxuICAgIHNvcnQ6IFtdLFxuICAgIGdyb3VwQnk6IG51bGwsXG4gICAgaGlkZGVuOiBbXSxcbiAgICBmcm96ZW5Db2x1bW5zOiAxLFxuICAgIHJvd0hlaWdodDogJ21lZGl1bScsXG4gICAgY29sdW1uV2lkdGhzOiB7fSxcbiAgICBjb2x1bW5PcmRlcixcbiAgICB3YXJuaW5nczogW10sXG4gIH07XG59XG5cbi8qKlxuICogVmFsaWRhdGUgYW5kIG5vcm1hbGl6ZSBhIHZpZXcgYWdhaW5zdCB0aGUgY3VycmVudCBmaWVsZCBsaXN0LlxuICogLSBVbmtub3duIGZpZWxkIElEcyBhcmUgcmVtb3ZlZCB3aXRoIGEgd2FybmluZyAobm90IGFuIGVycm9yKS5cbiAqIC0gSGlkaW5nIHRoZSBwcmltYXJ5IGZpZWxkIGlzIGFuIGVycm9yIChSLUQxMykgXHUyMDE0IHZpZXcgbm90IGFwcGxpZWQuXG4gKiAtIGNvbHVtbk9yZGVyIG1pc3Npbmcgb3Igbm90IGEgcGVybXV0YXRpb24gXHUyMTkyIGRlcml2ZWQgZnJvbSBmaWVsZCBvcmRlciB3aXRoIHdhcm5pbmcuXG4gKiAtIGZyb3plbkNvbHVtbnMgY2xhbXBlZCB0byAwLi5maWVsZHMubGVuZ3RoIHdpdGggd2FybmluZyBpZiBvdXQgb2YgcmFuZ2UuXG4gKiAtIGNvbHVtbldpZHRocyBlbnRyaWVzIHdpdGggdW5rbm93biBmaWVsZCBvciBub24taW50ZWdlci9uZWdhdGl2ZSBkcm9wcGVkIHdpdGggd2FybmluZy5cbiAqIC0gc29ydCBlbnRyaWVzIHdpdGggdW5rbm93biBmaWVsZCBkcm9wcGVkIHdpdGggd2FybmluZzsgZGlyZWN0aW9uIGludmFsaWQgXHUyMTkyIGRyb3BwZWQuXG4gKiAtIGdyb3VwQnkgdW5rbm93biBcdTIxOTIgY2xlYXJlZCB3aXRoIHdhcm5pbmcuXG4gKiAtIHJvd0hlaWdodCBpbnZhbGlkIFx1MjE5MiBzZXQgdG8gJ21lZGl1bScgd2l0aCB3YXJuaW5nLlxuICogTmV2ZXIgdGhyb3dzIFx1MjAxNCBhbHdheXMgcmV0dXJucyBWaWV3VmFsaWRhdGlvblJlc3VsdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlVmlldyh2aWV3OiBWaWV3RGVmaW5pdGlvbiwgZmllbGRzOiBGaWVsZERlZmluaXRpb25bXSk6IFZpZXdWYWxpZGF0aW9uUmVzdWx0IHtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZmllbGRJZHMgPSBuZXcgU2V0KGZpZWxkcy5tYXAoKGYpID0+IGYuaWQpKTtcbiAgY29uc3QgcHJpbWFyeSA9IGZpZWxkcy5maW5kKChmKSA9PiBmLnByaW1hcnkpO1xuICBjb25zdCBwcmltYXJ5SWQgPSBwcmltYXJ5Py5pZDtcblxuICAvLyBEZWVwIGNvcHkgdG8gYXZvaWQgbXV0YXRpbmcgaW5wdXRcbiAgY29uc3Qgbm9ybWFsaXplZDogVmlld0RlZmluaXRpb24gPSBjbG9uZVZpZXcodmlldyk7XG5cbiAgLy8gRW5zdXJlIHdhcm5pbmdzIGFycmF5IGV4aXN0c1xuICBpZiAoIUFycmF5LmlzQXJyYXkobm9ybWFsaXplZC53YXJuaW5ncykpIG5vcm1hbGl6ZWQud2FybmluZ3MgPSBbXTtcblxuICAvLyAtLS0gc29ydCAtLS1cbiAgY29uc3Qgb3JpZ1NvcnQgPSBBcnJheS5pc0FycmF5KHZpZXcuc29ydCkgPyB2aWV3LnNvcnQgOiBbXTtcbiAgY29uc3QgY2xlYW5Tb3J0OiBTb3J0RW50cnlbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGVudHJ5IG9mIG9yaWdTb3J0KSB7XG4gICAgaWYgKCFlbnRyeSB8fCB0eXBlb2YgZW50cnkuZmllbGRJZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goYHNvcnQgZW50cnkgd2l0aCBpbnZhbGlkIGZpZWxkSWQgaWdub3JlZGApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghZmllbGRJZHMuaGFzKGVudHJ5LmZpZWxkSWQpKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKGBzb3J0IGZpZWxkIFwiJHtlbnRyeS5maWVsZElkfVwiIGlzIHVua25vd24gXHUyMDE0IGlnbm9yZWRgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoIVZBTElEX0RJUkVDVElPTlMuaGFzKGVudHJ5LmRpcmVjdGlvbikpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goYHNvcnQgZGlyZWN0aW9uIFwiJHtlbnRyeS5kaXJlY3Rpb259XCIgZm9yIGZpZWxkIFwiJHtlbnRyeS5maWVsZElkfVwiIGludmFsaWQgXHUyMDE0IGlnbm9yZWRgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjbGVhblNvcnQucHVzaCh7IGZpZWxkSWQ6IGVudHJ5LmZpZWxkSWQsIGRpcmVjdGlvbjogZW50cnkuZGlyZWN0aW9uIH0pO1xuICB9XG4gIG5vcm1hbGl6ZWQuc29ydCA9IGNsZWFuU29ydDtcblxuICAvLyAtLS0gZ3JvdXBCeSAtLS1cbiAgaWYgKG5vcm1hbGl6ZWQuZ3JvdXBCeSAhPT0gbnVsbCAmJiBub3JtYWxpemVkLmdyb3VwQnkgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmICh0eXBlb2Ygbm9ybWFsaXplZC5ncm91cEJ5ICE9PSAnc3RyaW5nJykge1xuICAgICAgd2FybmluZ3MucHVzaChgZ3JvdXBCeSBpbnZhbGlkIHR5cGUgXHUyMDE0IGNsZWFyZWRgKTtcbiAgICAgIG5vcm1hbGl6ZWQuZ3JvdXBCeSA9IG51bGw7XG4gICAgfSBlbHNlIGlmICghZmllbGRJZHMuaGFzKG5vcm1hbGl6ZWQuZ3JvdXBCeSkpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goYGdyb3VwQnkgZmllbGQgXCIke25vcm1hbGl6ZWQuZ3JvdXBCeX1cIiBpcyB1bmtub3duIFx1MjAxNCBjbGVhcmVkYCk7XG4gICAgICBub3JtYWxpemVkLmdyb3VwQnkgPSBudWxsO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBub3JtYWxpemVkLmdyb3VwQnkgPSBudWxsO1xuICB9XG5cbiAgLy8gLS0tIGhpZGRlbiAtLS1cbiAgY29uc3Qgb3JpZ0hpZGRlbiA9IEFycmF5LmlzQXJyYXkodmlldy5oaWRkZW4pID8gdmlldy5oaWRkZW4gOiBbXTtcbiAgY29uc3QgY2xlYW5IaWRkZW46IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgaGlkIG9mIG9yaWdIaWRkZW4pIHtcbiAgICBpZiAodHlwZW9mIGhpZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goYGhpZGRlbiBlbnRyeSBcIiR7U3RyaW5nKGhpZCl9XCIgaW52YWxpZCB0eXBlIFx1MjAxNCBpZ25vcmVkYCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCFmaWVsZElkcy5oYXMoaGlkKSkge1xuICAgICAgd2FybmluZ3MucHVzaChgaGlkZGVuIGZpZWxkIFwiJHtoaWR9XCIgaXMgdW5rbm93biBcdTIwMTQgaWdub3JlZGApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNsZWFuSGlkZGVuLnB1c2goaGlkKTtcbiAgfVxuICAvLyBSLUQxMzogcHJpbWFyeSBjYW5ub3QgYmUgaGlkZGVuXG4gIGlmIChwcmltYXJ5SWQgJiYgY2xlYW5IaWRkZW4uaW5jbHVkZXMocHJpbWFyeUlkKSkge1xuICAgIGVycm9ycy5wdXNoKGBQcmltYXJ5IGZpZWxkIFwiJHtwcmltYXJ5Py5uYW1lID8/IHByaW1hcnlJZH1cIiBjYW5ub3QgYmUgaGlkZGVuIChSLUQxMylgKTtcbiAgICAvLyBEbyBub3QgYXBwbHkgaGlkZGVuIGNoYW5nZSBcdTIwMTQga2VlcCBvcmlnaW5hbCBoaWRkZW4/IEJ1dCBzcGVjIHNheXMgXCJSZWplY3QgaGlkaW5nIHRoZSBwcmltYXJ5IGZpZWxkXCIuXG4gICAgLy8gV2UgcmV0dXJuIGVycm9yIGFuZCBrZWVwIHZpZXcgYXMgYmVmb3JlIHZhbGlkYXRpb24gZm9yIGNhbGxlciB0byBkZWNpZGUuXG4gICAgLy8gRm9yIHZhbGlkYXRpb24gcmVzdWx0IHdlIHN0aWxsIHNob3cgY2xlYW5lZCBoaWRkZW4gYnV0IG9rPWZhbHNlIHNpZ25hbHMgcmVqZWN0aW9uLlxuICB9XG4gIG5vcm1hbGl6ZWQuaGlkZGVuID0gY2xlYW5IaWRkZW47XG5cbiAgLy8gLS0tIGNvbHVtbk9yZGVyIC0tLVxuICBjb25zdCBvcmlnT3JkZXIgPSB2aWV3LmNvbHVtbk9yZGVyO1xuICBpZiAoIUFycmF5LmlzQXJyYXkob3JpZ09yZGVyKSkge1xuICAgIHdhcm5pbmdzLnB1c2goYGNvbHVtbk9yZGVyIG1pc3NpbmcgXHUyMDE0IGRlcml2ZWQgZnJvbSBmaWVsZCBvcmRlcmApO1xuICAgIG5vcm1hbGl6ZWQuY29sdW1uT3JkZXIgPSBmaWVsZHMubWFwKChmKSA9PiBmLmlkKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgY2xlYW5PcmRlcjogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGZpZCBvZiBvcmlnT3JkZXIpIHtcbiAgICAgIGlmICh0eXBlb2YgZmlkICE9PSAnc3RyaW5nJykge1xuICAgICAgICB3YXJuaW5ncy5wdXNoKGBjb2x1bW5PcmRlciBlbnRyeSBcIiR7U3RyaW5nKGZpZCl9XCIgaW52YWxpZCB0eXBlIFx1MjAxNCBpZ25vcmVkYCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFmaWVsZElkcy5oYXMoZmlkKSkge1xuICAgICAgICB3YXJuaW5ncy5wdXNoKGBjb2x1bW5PcmRlciBmaWVsZCBcIiR7ZmlkfVwiIGlzIHVua25vd24gXHUyMDE0IGlnbm9yZWRgKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoc2Vlbi5oYXMoZmlkKSkge1xuICAgICAgICB3YXJuaW5ncy5wdXNoKGBjb2x1bW5PcmRlciBkdXBsaWNhdGUgZmllbGQgXCIke2ZpZH1cIiBcdTIwMTQgaWdub3JlZGApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHNlZW4uYWRkKGZpZCk7XG4gICAgICBjbGVhbk9yZGVyLnB1c2goZmlkKTtcbiAgICB9XG4gICAgLy8gQWRkIG1pc3NpbmcgZmllbGRzIHRoYXQgd2VyZSBub3QgaW4gY29sdW1uT3JkZXJcbiAgICBjb25zdCBtaXNzaW5nID0gZmllbGRzLm1hcCgoZikgPT4gZi5pZCkuZmlsdGVyKChpZCkgPT4gIXNlZW4uaGFzKGlkKSk7XG4gICAgaWYgKG1pc3NpbmcubGVuZ3RoID4gMCkge1xuICAgICAgd2FybmluZ3MucHVzaChgY29sdW1uT3JkZXIgbWlzc2luZyBmaWVsZHMgJHttaXNzaW5nLmpvaW4oJywnKX0gXHUyMDE0IGFwcGVuZGVkYCk7XG4gICAgICBjbGVhbk9yZGVyLnB1c2goLi4ubWlzc2luZyk7XG4gICAgfVxuICAgIC8vIElmIG9yaWdpbmFsIGhhZCB1bmtub3duL2R1cCwgYWxyZWFkeSB3YXJuZWQ7IGlmIGxlbmd0aCBtaXNtYXRjaGVkLCB3YXJuXG4gICAgaWYgKGNsZWFuT3JkZXIubGVuZ3RoICE9PSBmaWVsZHMubGVuZ3RoKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKGBjb2x1bW5PcmRlciBsZW5ndGggJHtvcmlnT3JkZXIubGVuZ3RofSBjb3JyZWN0ZWQgdG8gJHtjbGVhbk9yZGVyLmxlbmd0aH1gKTtcbiAgICB9XG4gICAgbm9ybWFsaXplZC5jb2x1bW5PcmRlciA9IGNsZWFuT3JkZXI7XG4gIH1cblxuICAvLyAtLS0gY29sdW1uV2lkdGhzIC0tLVxuICBjb25zdCBvcmlnV2lkdGhzID0gdmlldy5jb2x1bW5XaWR0aHMgJiYgdHlwZW9mIHZpZXcuY29sdW1uV2lkdGhzID09PSAnb2JqZWN0JyA/IHZpZXcuY29sdW1uV2lkdGhzIDoge307XG4gIGNvbnN0IGNsZWFuV2lkdGhzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XG4gIGZvciAoY29uc3QgW2ZpZCwgd10gb2YgT2JqZWN0LmVudHJpZXMob3JpZ1dpZHRocyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikpIHtcbiAgICBpZiAoIWZpZWxkSWRzLmhhcyhmaWQpKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKGBjb2x1bW5XaWR0aHMgZmllbGQgXCIke2ZpZH1cIiBpcyB1bmtub3duIFx1MjAxNCBpZ25vcmVkYCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB3ICE9PSAnbnVtYmVyJyB8fCAhTnVtYmVyLmlzSW50ZWdlcih3KSB8fCB3IDwgMCkge1xuICAgICAgd2FybmluZ3MucHVzaChgY29sdW1uV2lkdGhzIGZvciBmaWVsZCBcIiR7ZmlkfVwiIGhhcyBpbnZhbGlkIHdpZHRoIFwiJHtTdHJpbmcodyl9XCIgXHUyMDE0IGlnbm9yZWRgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBDbGFtcCB3aWR0aCB0byByZWFzb25hYmxlIHJhbmdlIDYwLi44MDAgYnV0IGp1c3Qgd2FybiBpZiA8NjBcbiAgICBpZiAodyA8IDYwKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKGBjb2x1bW5XaWR0aHMgZm9yIGZpZWxkIFwiJHtmaWR9XCIgd2lkdGggJHt3fSBiZWxvdyBtaW5pbXVtIDYwIFx1MjAxNCBrZXB0IGJ1dCBtYXkgYmUgY2xhbXBlZCBieSBVSWApO1xuICAgIH1cbiAgICBjbGVhbldpZHRoc1tmaWRdID0gdztcbiAgfVxuICBub3JtYWxpemVkLmNvbHVtbldpZHRocyA9IGNsZWFuV2lkdGhzO1xuXG4gIC8vIC0tLSBmcm96ZW5Db2x1bW5zIC0tLVxuICBsZXQgZnJvemVuID0gdmlldy5mcm96ZW5Db2x1bW5zO1xuICBpZiAodHlwZW9mIGZyb3plbiAhPT0gJ251bWJlcicgfHwgIU51bWJlci5pc0ludGVnZXIoZnJvemVuKSkge1xuICAgIHdhcm5pbmdzLnB1c2goYGZyb3plbkNvbHVtbnMgaW52YWxpZCB0eXBlIFwiJHtTdHJpbmcoZnJvemVuKX1cIiBcdTIwMTQgc2V0IHRvIDBgKTtcbiAgICBmcm96ZW4gPSAwO1xuICB9XG4gIGlmIChmcm96ZW4gPCAwKSB7XG4gICAgd2FybmluZ3MucHVzaChgZnJvemVuQ29sdW1ucyAke2Zyb3plbn0gYmVsb3cgMCBcdTIwMTQgY2xhbXBlZCB0byAwYCk7XG4gICAgZnJvemVuID0gMDtcbiAgfSBlbHNlIGlmIChmcm96ZW4gPiBmaWVsZHMubGVuZ3RoKSB7XG4gICAgd2FybmluZ3MucHVzaChgZnJvemVuQ29sdW1ucyAke2Zyb3plbn0gZXhjZWVkcyBmaWVsZCBjb3VudCAke2ZpZWxkcy5sZW5ndGh9IFx1MjAxNCBjbGFtcGVkIHRvICR7ZmllbGRzLmxlbmd0aH1gKTtcbiAgICBmcm96ZW4gPSBmaWVsZHMubGVuZ3RoO1xuICB9XG4gIG5vcm1hbGl6ZWQuZnJvemVuQ29sdW1ucyA9IGZyb3plbjtcblxuICAvLyAtLS0gcm93SGVpZ2h0IC0tLVxuICBjb25zdCByaCA9IHZpZXcucm93SGVpZ2h0IGFzIHVua25vd24gYXMgc3RyaW5nO1xuICBpZiAoIVZBTElEX1JPV19IRUlHSFRTLmhhcyhyaCkpIHtcbiAgICB3YXJuaW5ncy5wdXNoKGByb3dIZWlnaHQgXCIke1N0cmluZyhyaCl9XCIgaW52YWxpZCBcdTIwMTQgc2V0IHRvIFwibWVkaXVtXCJgKTtcbiAgICBub3JtYWxpemVkLnJvd0hlaWdodCA9ICdtZWRpdW0nIGFzIFJvd0hlaWdodDtcbiAgfSBlbHNlIHtcbiAgICBub3JtYWxpemVkLnJvd0hlaWdodCA9IHJoIGFzIFJvd0hlaWdodDtcbiAgfVxuXG4gIC8vIFBlcnNpc3Qgd2FybmluZ3MgaW50byB2aWV3IGZvciByZWxvYWQgaW5zcGVjdGlvbiAoc3BlYzogd2FybmluZyByZWNvcmRlZCBpbiB0aGUgdmlldylcbiAgLy8gQXBwZW5kIHRvIHZpZXcud2FybmluZ3MgYnV0IGRlZHVwZSBhZ2FpbnN0IGV4aXN0aW5nIHdhcm5pbmdzIGZyb20gcHJldmlvdXMgc2F2ZXNcbiAgY29uc3QgYWxsV2FybmluZ3MgPSBbLi4ud2FybmluZ3NdO1xuICAvLyBLZWVwIGV4aXN0aW5nIHdhcm5pbmdzIHRoYXQgYXJlIHN0aWxsIHJlbGV2YW50PyBGb3Igc2ltcGxpY2l0eSwgcmVwbGFjZSB3aXRoIGZyZXNoIHdhcm5pbmdzLlxuICBub3JtYWxpemVkLndhcm5pbmdzID0gYWxsV2FybmluZ3M7XG5cbiAgY29uc3Qgb2sgPSBlcnJvcnMubGVuZ3RoID09PSAwO1xuICByZXR1cm4geyB2aWV3OiBub3JtYWxpemVkLCB3YXJuaW5nczogYWxsV2FybmluZ3MsIGVycm9ycywgb2sgfTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgYSByYXcgdmlldyBvYmplY3QgKGZyb20gSlNPTikgYWdhaW5zdCBmaWVsZHMuXG4gKiBIYW5kbGVzIG1pc3Npbmcga2V5cywgd3JvbmcgdHlwZXMsIGFuZCBjYWxscyB2YWxpZGF0ZVZpZXcuXG4gKiByYXcgbWF5IGJlIGFueSB1bmtub3duIEpTT04gdmFsdWUgXHUyMDE0IG5ldmVyIHRocm93cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVZpZXcocmF3OiB1bmtub3duLCBmaWVsZHM6IEZpZWxkRGVmaW5pdGlvbltdKTogVmlld1ZhbGlkYXRpb25SZXN1bHQge1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGlmICh0eXBlb2YgcmF3ICE9PSAnb2JqZWN0JyB8fCByYXcgPT09IG51bGwgfHwgQXJyYXkuaXNBcnJheShyYXcpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZpZXc6IGNyZWF0ZURlZmF1bHRWaWV3KGZpZWxkcyksXG4gICAgICB3YXJuaW5nczogWyd2aWV3IGlzIG5vdCBhbiBvYmplY3QgXHUyMDE0IHJlcGxhY2VkIHdpdGggZGVmYXVsdCB2aWV3J10sXG4gICAgICBlcnJvcnM6IFtdLFxuICAgICAgb2s6IHRydWUsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IG9iaiA9IHJhdyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblxuICAvLyBCdWlsZCBhIFZpZXdEZWZpbml0aW9uIHdpdGggZGVmYXVsdHMgZm9yIG1pc3Npbmcga2V5c1xuICBjb25zdCB2aWV3OiBWaWV3RGVmaW5pdGlvbiA9IHtcbiAgICBpZDogdHlwZW9mIG9iai5pZCA9PT0gJ3N0cmluZycgJiYgb2JqLmlkLmxlbmd0aCA+IDAgPyBvYmouaWQgOiBnZW5lcmF0ZVZpZXdJZCgpLFxuICAgIG5hbWU6IHR5cGVvZiBvYmoubmFtZSA9PT0gJ3N0cmluZycgJiYgb2JqLm5hbWUubGVuZ3RoID4gMCA/IG9iai5uYW1lIDogJ0RlZmF1bHQnLFxuICAgIHNvcnQ6IEFycmF5LmlzQXJyYXkob2JqLnNvcnQpID8gKG9iai5zb3J0IGFzIFNvcnRFbnRyeVtdKSA6IFtdLFxuICAgIGdyb3VwQnk6IChvYmouZ3JvdXBCeSBhcyBzdHJpbmcgfCBudWxsKSA/PyBudWxsLFxuICAgIGhpZGRlbjogQXJyYXkuaXNBcnJheShvYmouaGlkZGVuKSA/IChvYmouaGlkZGVuIGFzIHN0cmluZ1tdKSA6IFtdLFxuICAgIGZyb3plbkNvbHVtbnM6IHR5cGVvZiBvYmouZnJvemVuQ29sdW1ucyA9PT0gJ251bWJlcicgPyBvYmouZnJvemVuQ29sdW1ucyA6IDAsXG4gICAgcm93SGVpZ2h0OiAob2JqLnJvd0hlaWdodCBhcyBSb3dIZWlnaHQpID8/ICdtZWRpdW0nLFxuICAgIGNvbHVtbldpZHRoczogdHlwZW9mIG9iai5jb2x1bW5XaWR0aHMgPT09ICdvYmplY3QnICYmIG9iai5jb2x1bW5XaWR0aHMgIT09IG51bGwgPyAob2JqLmNvbHVtbldpZHRocyBhcyBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+KSA6IHt9LFxuICAgIGNvbHVtbk9yZGVyOiBBcnJheS5pc0FycmF5KG9iai5jb2x1bW5PcmRlcikgPyAob2JqLmNvbHVtbk9yZGVyIGFzIHN0cmluZ1tdKSA6IGZpZWxkcy5tYXAoKGYpID0+IGYuaWQpLFxuICAgIHdhcm5pbmdzOiBBcnJheS5pc0FycmF5KG9iai53YXJuaW5ncykgPyAob2JqLndhcm5pbmdzIGFzIHN0cmluZ1tdKSA6IFtdLFxuICB9O1xuXG4gIGlmICghQXJyYXkuaXNBcnJheShvYmouY29sdW1uT3JkZXIpKSB7XG4gICAgd2FybmluZ3MucHVzaCgnY29sdW1uT3JkZXIgbWlzc2luZyBcdTIwMTQgZGVyaXZlZCBmcm9tIGZpZWxkIG9yZGVyJyk7XG4gIH1cbiAgaWYgKHR5cGVvZiBvYmouaWQgIT09ICdzdHJpbmcnKSB3YXJuaW5ncy5wdXNoKCd2aWV3IGlkIG1pc3Npbmcgb3IgaW52YWxpZCBcdTIwMTQgZ2VuZXJhdGVkJyk7XG4gIGlmICh0eXBlb2Ygb2JqLm5hbWUgIT09ICdzdHJpbmcnKSB3YXJuaW5ncy5wdXNoKCd2aWV3IG5hbWUgbWlzc2luZyBvciBpbnZhbGlkIFx1MjAxNCBzZXQgdG8gRGVmYXVsdCcpO1xuICBpZiAoIUFycmF5LmlzQXJyYXkob2JqLnNvcnQpKSB3YXJuaW5ncy5wdXNoKCd2aWV3IHNvcnQgbWlzc2luZyBcdTIwMTQgc2V0IHRvIFtdJyk7XG4gIGlmICghQXJyYXkuaXNBcnJheShvYmouaGlkZGVuKSkgd2FybmluZ3MucHVzaCgndmlldyBoaWRkZW4gbWlzc2luZyBcdTIwMTQgc2V0IHRvIFtdJyk7XG4gIGlmICh0eXBlb2Ygb2JqLmZyb3plbkNvbHVtbnMgIT09ICdudW1iZXInKSB3YXJuaW5ncy5wdXNoKCd2aWV3IGZyb3plbkNvbHVtbnMgbWlzc2luZyBcdTIwMTQgc2V0IHRvIDAnKTtcbiAgaWYgKHR5cGVvZiBvYmoucm93SGVpZ2h0ICE9PSAnc3RyaW5nJykgd2FybmluZ3MucHVzaCgndmlldyByb3dIZWlnaHQgbWlzc2luZyBcdTIwMTQgc2V0IHRvIG1lZGl1bScpO1xuXG4gIGNvbnN0IHJlc3VsdCA9IHZhbGlkYXRlVmlldyh2aWV3LCBmaWVsZHMpO1xuICAvLyBNZXJnZSBpbml0aWFsIHdhcm5pbmdzXG4gIGNvbnN0IG1lcmdlZFdhcm5pbmdzID0gWy4uLndhcm5pbmdzLCAuLi5yZXN1bHQud2FybmluZ3NdO1xuICByZXN1bHQudmlldy53YXJuaW5ncyA9IG1lcmdlZFdhcm5pbmdzO1xuICByZXN1bHQud2FybmluZ3MgPSBtZXJnZWRXYXJuaW5ncztcbiAgcmVzdWx0LmVycm9ycyA9IFsuLi5lcnJvcnMsIC4uLnJlc3VsdC5lcnJvcnNdO1xuICByZXN1bHQub2sgPSByZXN1bHQuZXJyb3JzLmxlbmd0aCA9PT0gMDtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhbml0aXplVmlld3NGb3JTYXZlKHZpZXdzOiBWaWV3RGVmaW5pdGlvbltdLCBmaWVsZHM6IEZpZWxkRGVmaW5pdGlvbltdKTogVmlld0RlZmluaXRpb25bXSB7XG4gIHJldHVybiB2aWV3cy5tYXAoKHYpID0+IHZhbGlkYXRlVmlldyh2LCBmaWVsZHMpLnZpZXcpO1xufVxuXG5leHBvcnQgeyBjbG9uZVZpZXcsIGNyZWF0ZURlZmF1bHRWaWV3IH07XG4iLCAiaW1wb3J0IHR5cGUgeyBUYWJsaWZ5RmlsZSwgRmllbGREZWZpbml0aW9uLCBWaWV3RGVmaW5pdGlvbiB9IGZyb20gJy4uL21vZGVsL3R5cGVzLmpzJztcbmltcG9ydCB7IHZhbGlkYXRlVmlldyB9IGZyb20gJy4uL21vZGVsL3ZpZXcuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlU3VjY2VzcyB7XG4gIG9rOiB0cnVlO1xuICBkYXRhOiBUYWJsaWZ5RmlsZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQYXJzZUVycm9yIHtcbiAgb2s6IGZhbHNlO1xuICBlcnJvcjogc3RyaW5nO1xuICBsaW5lPzogbnVtYmVyO1xuICBjb2x1bW4/OiBudW1iZXI7XG59XG5cbmV4cG9ydCB0eXBlIFBhcnNlUmVzdWx0ID0gUGFyc2VTdWNjZXNzIHwgUGFyc2VFcnJvcjtcblxuLyoqXG4gKiBQYXJzZSBhIC50YWJsaWZ5IGZpbGUgc3RyaW5nIGludG8gYSBUYWJsaWZ5RmlsZS5cbiAqIFJlcG9ydHMgdGhlIGZpcnN0IGVycm9yIHdpdGggYXBwcm94aW1hdGUgbGluZSBhbmQgY29sdW1uLlxuICogTmV2ZXIgdGhyb3dzIFx1MjAxNCBhbHdheXMgcmV0dXJucyBhIFBhcnNlUmVzdWx0LlxuICogVW5rbm93biBrZXlzIGFyZSBwcmVzZXJ2ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZShpbnB1dDogc3RyaW5nKTogUGFyc2VSZXN1bHQge1xuICAvLyBTdGVwIDE6IFBhcnNlIEpTT05cbiAgbGV0IGRhdGE6IHVua25vd247XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UoaW5wdXQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc3QgbXNnID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpO1xuICAgIC8vIFRyeSB0byBleHRyYWN0IGxpbmUvY29sdW1uIGZyb20gdGhlIGVycm9yIG1lc3NhZ2VcbiAgICBjb25zdCBtYXRjaCA9IG1zZy5tYXRjaCgvcG9zaXRpb24gKFxcZCspLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjb25zdCBwb3MgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgY29uc3QgeyBsaW5lLCBjb2x1bW4gfSA9IG9mZnNldFRvTGluZUNvbChpbnB1dCwgcG9zKTtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGBJbnZhbGlkIEpTT046ICR7bXNnfWAsIGxpbmUsIGNvbHVtbiB9O1xuICAgIH1cbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBgSW52YWxpZCBKU09OOiAke21zZ31gIH07XG4gIH1cblxuICAvLyBTdGVwIDI6IE11c3QgYmUgYW4gb2JqZWN0XG4gIGlmICh0eXBlb2YgZGF0YSAhPT0gJ29iamVjdCcgfHwgZGF0YSA9PT0gbnVsbCB8fCBBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ0ZpbGUgbXVzdCBiZSBhIEpTT04gb2JqZWN0JywgbGluZTogMSwgY29sdW1uOiAxIH07XG4gIH1cblxuICBjb25zdCBvYmogPSBkYXRhIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuXG4gIC8vIFN0ZXAgMzogQ2hlY2sgZm9ybWF0VmVyc2lvbiBGSVJTVFxuICBpZiAoISgnZm9ybWF0VmVyc2lvbicgaW4gb2JqKSkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICdNaXNzaW5nIHJlcXVpcmVkIGtleTogZm9ybWF0VmVyc2lvbicgfTtcbiAgfVxuICBpZiAob2JqLmZvcm1hdFZlcnNpb24gIT09IDEpIHtcbiAgICByZXR1cm4ge1xuICAgICAgb2s6IGZhbHNlLFxuICAgICAgZXJyb3I6IGBVbnN1cHBvcnRlZCBmb3JtYXRWZXJzaW9uOiAke0pTT04uc3RyaW5naWZ5KG9iai5mb3JtYXRWZXJzaW9uKX0uIEV4cGVjdGVkIDEuYCxcbiAgICB9O1xuICB9XG5cbiAgLy8gU3RlcCA0OiBDaGVjayByZXF1aXJlZCB0b3AtbGV2ZWwga2V5c1xuICBjb25zdCByZXF1aXJlZEtleXMgPSBbJ3RhYmxlSWQnLCAnbmFtZScsICdmaWVsZHMnLCAncm93cycsICd2aWV3cycsICdzeW5jTGluayddO1xuICBmb3IgKGNvbnN0IGtleSBvZiByZXF1aXJlZEtleXMpIHtcbiAgICBpZiAoIShrZXkgaW4gb2JqKSkge1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogYE1pc3NpbmcgcmVxdWlyZWQga2V5OiAke2tleX1gIH07XG4gICAgfVxuICB9XG5cbiAgLy8gU3RlcCA1OiBUeXBlIGNoZWNrc1xuICBpZiAodHlwZW9mIG9iai50YWJsZUlkICE9PSAnc3RyaW5nJykge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICd0YWJsZUlkIG11c3QgYmUgYSBzdHJpbmcnIH07XG4gIH1cbiAgaWYgKHR5cGVvZiBvYmoubmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiAnbmFtZSBtdXN0IGJlIGEgc3RyaW5nJyB9O1xuICB9XG4gIGlmICghQXJyYXkuaXNBcnJheShvYmouZmllbGRzKSkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICdmaWVsZHMgbXVzdCBiZSBhbiBhcnJheScgfTtcbiAgfVxuICBpZiAoIUFycmF5LmlzQXJyYXkob2JqLnJvd3MpKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ3Jvd3MgbXVzdCBiZSBhbiBhcnJheScgfTtcbiAgfVxuICBpZiAoIUFycmF5LmlzQXJyYXkob2JqLnZpZXdzKSkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICd2aWV3cyBtdXN0IGJlIGFuIGFycmF5JyB9O1xuICB9XG4gIGlmIChvYmouZmllbGRzLmxlbmd0aCA8IDEpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiAnZmllbGRzIG11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgZW50cnknIH07XG4gIH1cbiAgaWYgKG9iai52aWV3cy5sZW5ndGggPCAxKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ3ZpZXdzIG11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgZW50cnknIH07XG4gIH1cblxuICAvLyBTdGVwIDY6IFZhbGlkYXRlIGZpZWxkc1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG9iai5maWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBmaWVsZCA9IG9iai5maWVsZHNbaV0gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgaWYgKHR5cGVvZiBmaWVsZCAhPT0gJ29iamVjdCcgfHwgZmllbGQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGBmaWVsZHNbJHtpfV0gbXVzdCBiZSBhbiBvYmplY3RgIH07XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZmllbGQuaWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBgZmllbGRzWyR7aX1dLmlkIG11c3QgYmUgYSBzdHJpbmdgIH07XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZmllbGQubmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGBmaWVsZHNbJHtpfV0ubmFtZSBtdXN0IGJlIGEgc3RyaW5nYCB9O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGZpZWxkLnR5cGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBgZmllbGRzWyR7aX1dLnR5cGUgbXVzdCBiZSBhIHN0cmluZ2AgfTtcbiAgICB9XG4gIH1cblxuICAvLyBTdGVwIDc6IFZhbGlkYXRlIHJvd3NcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBvYmoucm93cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHJvdyA9IG9iai5yb3dzW2ldIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgIGlmICh0eXBlb2Ygcm93ICE9PSAnb2JqZWN0JyB8fCByb3cgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGByb3dzWyR7aX1dIG11c3QgYmUgYW4gb2JqZWN0YCB9O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHJvdy5pZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGByb3dzWyR7aX1dLmlkIG11c3QgYmUgYSBzdHJpbmdgIH07XG4gICAgfVxuICAgIGlmICh0eXBlb2Ygcm93LnJldiAhPT0gJ251bWJlcicgfHwgIU51bWJlci5pc0ludGVnZXIocm93LnJldikpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGByb3dzWyR7aX1dLnJldiBtdXN0IGJlIGFuIGludGVnZXJgIH07XG4gICAgfVxuICAgIGlmICh0eXBlb2Ygcm93LnVwZGF0ZWRBdCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGByb3dzWyR7aX1dLnVwZGF0ZWRBdCBtdXN0IGJlIGEgc3RyaW5nYCB9O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHJvdy52YWx1ZXMgIT09ICdvYmplY3QnIHx8IHJvdy52YWx1ZXMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGByb3dzWyR7aX1dLnZhbHVlcyBtdXN0IGJlIGFuIG9iamVjdGAgfTtcbiAgICB9XG4gICAgaWYgKHJvdy5zeW5jICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBgcm93c1ske2l9XS5zeW5jIG11c3QgYmUgbnVsbCBpbiB2MWAgfTtcbiAgICB9XG4gIH1cblxuICAvLyBTdGVwIDg6IFZhbGlkYXRlIHZpZXdzIChiYXNpYyBzaGFwZSArIHZpZXctc3BlY2lmaWMgbm9ybWFsaXphdGlvbilcbiAgY29uc3QgZmllbGRzRm9yVmlldyA9IG9iai5maWVsZHMgYXMgdW5rbm93biBhcyBGaWVsZERlZmluaXRpb25bXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBvYmoudmlld3MubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB2aWV3ID0gb2JqLnZpZXdzW2ldIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgIGlmICh0eXBlb2YgdmlldyAhPT0gJ29iamVjdCcgfHwgdmlldyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogYHZpZXdzWyR7aX1dIG11c3QgYmUgYW4gb2JqZWN0YCB9O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZpZXcuaWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBgdmlld3NbJHtpfV0uaWQgbXVzdCBiZSBhIHN0cmluZ2AgfTtcbiAgICB9XG4gIH1cblxuICAvLyBOb3JtYWxpemUgdmlld3M6IHVua25vd24gZmllbGQgSURzIGlnbm9yZWQgd2l0aCB3YXJuaW5nLCBub3QgZXJyb3IuXG4gIC8vIFdlIHVzZSB2YWxpZGF0ZVZpZXcgdG8gZGVyaXZlIHdhcm5pbmdzIGFuZCBjb2x1bW5PcmRlciBkZWZhdWx0cy5cbiAgLy8gUGFyc2luZyBuZXZlciBmYWlscyBiZWNhdXNlIG9mIHVua25vd24gZmllbGQgSURzIGluIGEgdmlldyBcdTIwMTQgdGhleSBhcmUgc3RyaXBwZWQuXG4gIHRyeSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZFZpZXdzID0gKG9iai52aWV3cyBhcyB1bmtub3duIGFzIFZpZXdEZWZpbml0aW9uW10pLm1hcCgodiwgaWR4KSA9PiB7XG4gICAgICAvLyBFbnN1cmUgbWluaW1hbCBkZWZhdWx0cyBiZWZvcmUgdmFsaWRhdGlvbiB0byBhdm9pZCBjcmFzaGVzIG9uIG1pc3Npbmcga2V5c1xuICAgICAgY29uc3Qgdmlld1dpdGhEZWZhdWx0cyA9IHtcbiAgICAgICAgaWQ6IHYuaWQsXG4gICAgICAgIG5hbWU6IHYubmFtZSA/PyAnRGVmYXVsdCcsXG4gICAgICAgIHNvcnQ6IEFycmF5LmlzQXJyYXkodi5zb3J0KSA/IHYuc29ydCA6IFtdLFxuICAgICAgICBncm91cEJ5OiB2Lmdyb3VwQnkgPz8gbnVsbCxcbiAgICAgICAgaGlkZGVuOiBBcnJheS5pc0FycmF5KHYuaGlkZGVuKSA/IHYuaGlkZGVuIDogW10sXG4gICAgICAgIGZyb3plbkNvbHVtbnM6IHR5cGVvZiB2LmZyb3plbkNvbHVtbnMgPT09ICdudW1iZXInID8gdi5mcm96ZW5Db2x1bW5zIDogMCxcbiAgICAgICAgcm93SGVpZ2h0OiB2LnJvd0hlaWdodCA/PyAnbWVkaXVtJyxcbiAgICAgICAgY29sdW1uV2lkdGhzOiB2LmNvbHVtbldpZHRocyAmJiB0eXBlb2Ygdi5jb2x1bW5XaWR0aHMgPT09ICdvYmplY3QnID8gdi5jb2x1bW5XaWR0aHMgOiB7fSxcbiAgICAgICAgY29sdW1uT3JkZXI6IEFycmF5LmlzQXJyYXkoKHYgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikuY29sdW1uT3JkZXIpXG4gICAgICAgICAgPyAoKHYgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikuY29sdW1uT3JkZXIgYXMgc3RyaW5nW10pXG4gICAgICAgICAgOiBmaWVsZHNGb3JWaWV3Lm1hcCgoZikgPT4gZi5pZCksXG4gICAgICAgIHdhcm5pbmdzOiBBcnJheS5pc0FycmF5KCh2IGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLndhcm5pbmdzKVxuICAgICAgICAgID8gKCh2IGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLndhcm5pbmdzIGFzIHN0cmluZ1tdKVxuICAgICAgICAgIDogW10sXG4gICAgICB9IGFzIHVua25vd24gYXMgVmlld0RlZmluaXRpb247XG4gICAgICBjb25zdCByZXN1bHQgPSB2YWxpZGF0ZVZpZXcodmlld1dpdGhEZWZhdWx0cywgZmllbGRzRm9yVmlldyk7XG4gICAgICAvLyBGb3IgZmlsZSBsb2FkLCBldmVuIGlmIHByaW1hcnkgaGlkZGVuIGVycm9yLCBhdXRvLWZpeCBieSByZW1vdmluZyBwcmltYXJ5IGZyb20gaGlkZGVuICh3YXJuaW5ncylcbiAgICAgIC8vIFRoaXMga2VlcHMgdGhlIGZpbGUgdXNhYmxlIFx1MjAxNCB0aGUgZXJyb3IgaXMgc3VyZmFjZWQgdmlhIHZhbGlkYXRpb24gcmVzdWx0IGJ1dCBub3QgYXMgcGFyc2UgZmFpbHVyZS5cbiAgICAgIGlmICghcmVzdWx0Lm9rICYmIHJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBDaGVjayBpZiBlcnJvciBpcyBwcmltYXJ5IGhpZGRlbiBcdTIxOTIgYXV0by1jb3JyZWN0IHdpdGggd2FybmluZ1xuICAgICAgICBjb25zdCBwcmltYXJ5ID0gZmllbGRzRm9yVmlldy5maW5kKChmKSA9PiBmLnByaW1hcnkpO1xuICAgICAgICBpZiAocHJpbWFyeSAmJiByZXN1bHQudmlldy5oaWRkZW4uaW5jbHVkZXMocHJpbWFyeS5pZCkpIHtcbiAgICAgICAgICByZXN1bHQudmlldy5oaWRkZW4gPSByZXN1bHQudmlldy5oaWRkZW4uZmlsdGVyKChpZCkgPT4gaWQgIT09IHByaW1hcnkuaWQpO1xuICAgICAgICAgIHJlc3VsdC52aWV3Lndhcm5pbmdzID0gWy4uLihyZXN1bHQudmlldy53YXJuaW5ncyA/PyBbXSksIGBQcmltYXJ5IGZpZWxkIFwiJHtwcmltYXJ5Lm5hbWV9XCIgY2Fubm90IGJlIGhpZGRlbiBcdTIwMTQgcmVtb3ZlZCBvbiBsb2FkYF07XG4gICAgICAgICAgcmVzdWx0Lndhcm5pbmdzLnB1c2goYFByaW1hcnkgZmllbGQgXCIke3ByaW1hcnkubmFtZX1cIiBjYW5ub3QgYmUgaGlkZGVuIFx1MjAxNCByZW1vdmVkIG9uIGxvYWRgKTtcbiAgICAgICAgICByZXN1bHQuZXJyb3JzID0gcmVzdWx0LmVycm9ycy5maWx0ZXIoKGUpID0+ICFlLmluY2x1ZGVzKCdQcmltYXJ5IGZpZWxkJykpO1xuICAgICAgICAgIHJlc3VsdC5vayA9IHJlc3VsdC5lcnJvcnMubGVuZ3RoID09PSAwO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBQcmVzZXJ2ZSB1bmtub3duIGtleXMgZnJvbSBvcmlnaW5hbCB2aWV3XG4gICAgICBjb25zdCBvcmlnaW5hbCA9IG9iai52aWV3c1tpZHhdIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgICAgZm9yIChjb25zdCBrIG9mIE9iamVjdC5rZXlzKG9yaWdpbmFsKSkge1xuICAgICAgICBpZiAoIShrIGluIHJlc3VsdC52aWV3KSkge1xuICAgICAgICAgIChyZXN1bHQudmlldyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba10gPSBvcmlnaW5hbFtrXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdC52aWV3O1xuICAgIH0pO1xuICAgIG9iai52aWV3cyA9IG5vcm1hbGl6ZWRWaWV3cyBhcyB1bmtub3duIGFzIHR5cGVvZiBvYmoudmlld3M7XG4gIH0gY2F0Y2gge1xuICAgIC8vIElmIHZpZXcgbm9ybWFsaXphdGlvbiB0aHJvd3MsIG5ldmVyIGZhaWwgcGFyc2Ugd2l0aCBleGNlcHRpb24gXHUyMDE0IHJldHVybiBlcnJvclxuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICdGYWlsZWQgdG8gbm9ybWFsaXplIHZpZXdzJyB9O1xuICB9XG5cbiAgLy8gU3RlcCA5OiBzeW5jTGluayBtdXN0IGJlIG51bGxcbiAgaWYgKG9iai5zeW5jTGluayAhPT0gbnVsbCkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICdzeW5jTGluayBtdXN0IGJlIG51bGwgaW4gdjEnIH07XG4gIH1cblxuICAvLyBBbGwgY2hlY2tzIHBhc3NlZCBcdTIwMTQgcmV0dXJuIHRoZSBkYXRhIGFzIFRhYmxpZnlGaWxlXG4gIHJldHVybiB7IG9rOiB0cnVlLCBkYXRhOiBvYmogYXMgdW5rbm93biBhcyBUYWJsaWZ5RmlsZSB9O1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSBjaGFyYWN0ZXIgb2Zmc2V0IHRvIGxpbmUgYW5kIGNvbHVtbiAoMS1iYXNlZCkuXG4gKi9cbmZ1bmN0aW9uIG9mZnNldFRvTGluZUNvbCh0ZXh0OiBzdHJpbmcsIG9mZnNldDogbnVtYmVyKTogeyBsaW5lOiBudW1iZXI7IGNvbHVtbjogbnVtYmVyIH0ge1xuICBsZXQgbGluZSA9IDE7XG4gIGxldCBjb2x1bW4gPSAxO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG9mZnNldCAmJiBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuICAgIGlmICh0ZXh0W2ldID09PSAnXFxuJykge1xuICAgICAgbGluZSsrO1xuICAgICAgY29sdW1uID0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29sdW1uKys7XG4gICAgfVxuICB9XG4gIHJldHVybiB7IGxpbmUsIGNvbHVtbiB9O1xufVxuIiwgImltcG9ydCB0eXBlIHsgVGFibGlmeUZpbGUsIEZpZWxkRGVmaW5pdGlvbiwgUm93LCBWaWV3RGVmaW5pdGlvbiwgU2VsZWN0T3B0aW9uIH0gZnJvbSAnLi4vbW9kZWwvdHlwZXMuanMnO1xuaW1wb3J0IHsgc2FuaXRpemVWaWV3c0ZvclNhdmUgfSBmcm9tICcuLi9tb2RlbC92aWV3LmpzJztcblxuLyoqXG4gKiBTZXJpYWxpemUgYSBUYWJsaWZ5RmlsZSB0byBhIGZvcm1hdHRlZCBKU09OIHN0cmluZy5cbiAqIEtleXMgYXJlIGluIHRoZSBvcmRlciBkZWZpbmVkIGJ5IEZPUk1BVF9TUEVDLm1kLlxuICogVXNlcyAyLXNwYWNlIGluZGVudCwgTEYgbGluZSBlbmRpbmdzLCB0cmFpbGluZyBuZXdsaW5lLlxuICogVW5rbm93biBrZXlzIGFyZSBwcmVzZXJ2ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemUoZmlsZTogVGFibGlmeUZpbGUpOiBzdHJpbmcge1xuICBjb25zdCBvcmRlcmVkID0gb3JkZXJUb3BMZXZlbChmaWxlKTtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG9yZGVyZWQsIG51bGwsIDIpICsgJ1xcbic7XG59XG5cbi8qKiBUb3AtbGV2ZWwga2V5IG9yZGVyIHBlciBGT1JNQVRfU1BFQy5tZCBcdTAwQTcyLiAqL1xuY29uc3QgVE9QX0xFVkVMX0tFWVMgPSBbJ2Zvcm1hdFZlcnNpb24nLCAndGFibGVJZCcsICduYW1lJywgJ2ZpZWxkcycsICdyb3dzJywgJ3ZpZXdzJywgJ3N5bmNMaW5rJ10gYXMgY29uc3Q7XG5cbi8qKiBGaWVsZCBrZXkgb3JkZXIgcGVyIEZPUk1BVF9TUEVDLm1kIFx1MDBBNzMuICovXG5jb25zdCBGSUVMRF9LRVlTID0gWydpZCcsICduYW1lJywgJ3R5cGUnLCAncHJpbWFyeScsICdvcHRpb25zJywgJ3JlcXVpcmVkJywgJ3VuaXF1ZScsICdtaW4nLCAnbWF4JywgJ3JlZ2V4J10gYXMgY29uc3Q7XG5cbi8qKiBSb3cga2V5IG9yZGVyIHBlciBGT1JNQVRfU1BFQy5tZCBcdTAwQTc0LiAqL1xuY29uc3QgUk9XX0tFWVMgPSBbJ2lkJywgJ3JldicsICdjcmVhdGVkQXQnLCAndXBkYXRlZEF0JywgJ3ZhbHVlcycsICdzeW5jJ10gYXMgY29uc3Q7XG5cbi8qKiBWaWV3IGtleSBvcmRlciBwZXIgRk9STUFUX1NQRUMubWQgXHUwMEE3NS4gKi9cbmNvbnN0IFZJRVdfS0VZUyA9IFsnaWQnLCAnbmFtZScsICdzb3J0JywgJ2dyb3VwQnknLCAnaGlkZGVuJywgJ2Zyb3plbkNvbHVtbnMnLCAncm93SGVpZ2h0JywgJ2NvbHVtbldpZHRocycsICdjb2x1bW5PcmRlcicsICd3YXJuaW5ncyddIGFzIGNvbnN0O1xuXG4vKiogT3B0aW9uIGtleSBvcmRlciBwZXIgRk9STUFUX1NQRUMubWQgXHUwMEE3My4yLiAqL1xuY29uc3QgT1BUSU9OX0tFWVMgPSBbJ2lkJywgJ25hbWUnLCAnY29sb3InXSBhcyBjb25zdDtcblxuZnVuY3Rpb24gb3JkZXJUb3BMZXZlbChmaWxlOiBUYWJsaWZ5RmlsZSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICAvLyBTYW5pdGl6ZSB2aWV3cyBvbiBzYXZlIFx1MjAxNCB1bmtub3duIGZpZWxkIElEcyBzdHJpcHBlZCB3aXRoIHdhcm5pbmdzLCBwcmltYXJ5IGhpZGRlbiByZWplY3RlZCwgZXRjLlxuICBjb25zdCBzYW5pdGl6ZWRWaWV3cyA9IGZpbGUudmlld3MgPyBzYW5pdGl6ZVZpZXdzRm9yU2F2ZShmaWxlLnZpZXdzIGFzIFZpZXdEZWZpbml0aW9uW10sIGZpbGUuZmllbGRzIGFzIEZpZWxkRGVmaW5pdGlvbltdKSA6IGZpbGUudmlld3M7XG4gIGZvciAoY29uc3Qga2V5IG9mIFRPUF9MRVZFTF9LRVlTKSB7XG4gICAgaWYgKGtleSBpbiBmaWxlKSB7XG4gICAgICBpZiAoa2V5ID09PSAnZmllbGRzJykge1xuICAgICAgICByZXN1bHRba2V5XSA9IChmaWxlLmZpZWxkcyBhcyBGaWVsZERlZmluaXRpb25bXSkubWFwKG9yZGVyRmllbGQpO1xuICAgICAgfSBlbHNlIGlmIChrZXkgPT09ICdyb3dzJykge1xuICAgICAgICByZXN1bHRba2V5XSA9IChmaWxlLnJvd3MgYXMgUm93W10pLm1hcChvcmRlclJvdyk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ3ZpZXdzJykge1xuICAgICAgICByZXN1bHRba2V5XSA9IChzYW5pdGl6ZWRWaWV3cyBhcyBWaWV3RGVmaW5pdGlvbltdKS5tYXAob3JkZXJWaWV3KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gZmlsZVtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBQcmVzZXJ2ZSB1bmtub3duIGtleXNcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoZmlsZSkpIHtcbiAgICBpZiAoIShUT1BfTEVWRUxfS0VZUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMoa2V5KSkge1xuICAgICAgcmVzdWx0W2tleV0gPSBmaWxlW2tleV07XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIG9yZGVyRmllbGQoZmllbGQ6IEZpZWxkRGVmaW5pdGlvbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICBmb3IgKGNvbnN0IGtleSBvZiBGSUVMRF9LRVlTKSB7XG4gICAgaWYgKGtleSBpbiBmaWVsZCkge1xuICAgICAgaWYgKGtleSA9PT0gJ29wdGlvbnMnICYmIGZpZWxkLm9wdGlvbnMpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSBmaWVsZC5vcHRpb25zLm1hcChvcmRlck9wdGlvbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHRba2V5XSA9IGZpZWxkW2tleSBhcyBrZXlvZiBGaWVsZERlZmluaXRpb25dO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBQcmVzZXJ2ZSB1bmtub3duIGtleXMgaW4gZmllbGRcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoZmllbGQpKSB7XG4gICAgaWYgKCEoRklFTERfS0VZUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMoa2V5KSkge1xuICAgICAgcmVzdWx0W2tleV0gPSAoZmllbGQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pW2tleV07XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIG9yZGVyUm93KHJvdzogUm93KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGZvciAoY29uc3Qga2V5IG9mIFJPV19LRVlTKSB7XG4gICAgaWYgKGtleSBpbiByb3cpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gKHJvdyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XTtcbiAgICB9XG4gIH1cbiAgLy8gUHJlc2VydmUgdW5rbm93biBrZXlzIGluIHJvd1xuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhyb3cpKSB7XG4gICAgaWYgKCEoUk9XX0tFWVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gKHJvdyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gb3JkZXJWaWV3KHZpZXc6IFZpZXdEZWZpbml0aW9uKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGZvciAoY29uc3Qga2V5IG9mIFZJRVdfS0VZUykge1xuICAgIGlmIChrZXkgaW4gdmlldykge1xuICAgICAgcmVzdWx0W2tleV0gPSAodmlldyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XTtcbiAgICB9XG4gIH1cbiAgLy8gUHJlc2VydmUgdW5rbm93biBrZXlzIGluIHZpZXdcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXModmlldykpIHtcbiAgICBpZiAoIShWSUVXX0tFWVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gKHZpZXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pW2tleV07XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIG9yZGVyT3B0aW9uKG9wdGlvbjogU2VsZWN0T3B0aW9uKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGZvciAoY29uc3Qga2V5IG9mIE9QVElPTl9LRVlTKSB7XG4gICAgaWYgKGtleSBpbiBvcHRpb24pIHtcbiAgICAgIHJlc3VsdFtrZXldID0gKG9wdGlvbiBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XTtcbiAgICB9XG4gIH1cbiAgLy8gUHJlc2VydmUgdW5rbm93biBrZXlzXG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9wdGlvbikpIHtcbiAgICBpZiAoIShPUFRJT05fS0VZUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMoa2V5KSkge1xuICAgICAgcmVzdWx0W2tleV0gPSAob3B0aW9uIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrZXldO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuIiwgImltcG9ydCB0eXBlIHsgQ2VsbFZhbHVlLCBGaWVsZERlZmluaXRpb24sIFJvdyB9IGZyb20gJy4vdHlwZXMuanMnO1xuXG5leHBvcnQgdHlwZSBSdWxlTmFtZSA9ICdyZXF1aXJlZCcgfCAndW5pcXVlJyB8ICdtaW4nIHwgJ21heCcgfCAncmVnZXgnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRpb25WaW9sYXRpb24ge1xuICByb3dJZDogc3RyaW5nO1xuICBmaWVsZElkOiBzdHJpbmc7XG4gIHJ1bGU6IFJ1bGVOYW1lO1xuICBtZXNzYWdlOiBzdHJpbmc7XG59XG5cbi8qKiBSZWdleCBpbnB1dCBsZW5ndGggY2FwIHRvIHByZXZlbnQgUmVEb1MuICovXG5jb25zdCBSRUdFWF9JTlBVVF9MSU1JVCA9IDEwXzAwMDtcblxuLyoqXG4gKiBWYWxpZGF0ZSBhbGwgcm93cyBhZ2FpbnN0IGFsbCBmaWVsZCBydWxlcy5cbiAqIFJldHVybnMgYSBsaXN0IG9mIHZpb2xhdGlvbnMuIERvZXMgbm90IG1vZGlmeSBkYXRhLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVUYWJsZShcbiAgZmllbGRzOiBGaWVsZERlZmluaXRpb25bXSxcbiAgcm93czogUm93W11cbik6IFZhbGlkYXRpb25WaW9sYXRpb25bXSB7XG4gIGNvbnN0IHZpb2xhdGlvbnM6IFZhbGlkYXRpb25WaW9sYXRpb25bXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgZmllbGQgb2YgZmllbGRzKSB7XG4gICAgZm9yIChjb25zdCByb3cgb2Ygcm93cykge1xuICAgICAgY29uc3QgY2VsbFZpb2xhdGlvbnMgPSB2YWxpZGF0ZUNlbGwoZmllbGQsIHJvdy52YWx1ZXNbZmllbGQuaWRdLCByb3dzLCByb3cuaWQpO1xuICAgICAgdmlvbGF0aW9ucy5wdXNoKC4uLmNlbGxWaW9sYXRpb25zKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdmlvbGF0aW9ucztcbn1cblxuLyoqXG4gKiBWYWxpZGF0ZSBhIHNpbmdsZSBjZWxsIHZhbHVlIGFnYWluc3QgaXRzIGZpZWxkIHJ1bGVzLlxuICogRm9yIHRoZSAndW5pcXVlJyBydWxlLCBwYXNzIGFsbCByb3dzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVDZWxsKFxuICBmaWVsZDogRmllbGREZWZpbml0aW9uLFxuICB2YWx1ZTogQ2VsbFZhbHVlLFxuICBhbGxSb3dzPzogUm93W10sXG4gIGN1cnJlbnRSb3dJZD86IHN0cmluZ1xuKTogVmFsaWRhdGlvblZpb2xhdGlvbltdIHtcbiAgY29uc3QgdmlvbGF0aW9uczogVmFsaWRhdGlvblZpb2xhdGlvbltdID0gW107XG4gIGNvbnN0IHJvd0lkID0gY3VycmVudFJvd0lkID8/ICcnO1xuXG4gIC8vIFJlcXVpcmVkIGNoZWNrXG4gIGlmIChmaWVsZC5yZXF1aXJlZCkge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gJycgfHwgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkpIHtcbiAgICAgIHZpb2xhdGlvbnMucHVzaCh7XG4gICAgICAgIHJvd0lkLFxuICAgICAgICBmaWVsZElkOiBmaWVsZC5pZCxcbiAgICAgICAgcnVsZTogJ3JlcXVpcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7ZmllbGQubmFtZX0gaXMgcmVxdWlyZWRgLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gU2tpcCBmdXJ0aGVyIGNoZWNrcyBpZiB2YWx1ZSBpcyBudWxsL2VtcHR5ICh1bmxlc3MgcmVxdWlyZWQgY2hlY2sgYWxyZWFkeSBmYWlsZWQpXG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gJycpIHJldHVybiB2aW9sYXRpb25zO1xuXG4gIC8vIE1pbiBjaGVja1xuICBpZiAoZmllbGQubWluICE9PSBudWxsICYmIGZpZWxkLm1pbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGZpZWxkLm1pbiA9PT0gJ251bWJlcicpIHtcbiAgICAgIGlmICh2YWx1ZSA8IGZpZWxkLm1pbikge1xuICAgICAgICB2aW9sYXRpb25zLnB1c2goe1xuICAgICAgICAgIHJvd0lkLFxuICAgICAgICAgIGZpZWxkSWQ6IGZpZWxkLmlkLFxuICAgICAgICAgIHJ1bGU6ICdtaW4nLFxuICAgICAgICAgIG1lc3NhZ2U6IGAke2ZpZWxkLm5hbWV9IG11c3QgYmUgYXQgbGVhc3QgJHtmaWVsZC5taW59YCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBmaWVsZC5taW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICBpZiAodmFsdWUgPCBmaWVsZC5taW4pIHtcbiAgICAgICAgdmlvbGF0aW9ucy5wdXNoKHtcbiAgICAgICAgICByb3dJZCxcbiAgICAgICAgICBmaWVsZElkOiBmaWVsZC5pZCxcbiAgICAgICAgICBydWxlOiAnbWluJyxcbiAgICAgICAgICBtZXNzYWdlOiBgJHtmaWVsZC5uYW1lfSBtdXN0IGJlIGF0IGxlYXN0ICR7ZmllbGQubWlufWAsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIE1heCBjaGVja1xuICBpZiAoZmllbGQubWF4ICE9PSBudWxsICYmIGZpZWxkLm1heCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGZpZWxkLm1heCA9PT0gJ251bWJlcicpIHtcbiAgICAgIGlmICh2YWx1ZSA+IGZpZWxkLm1heCkge1xuICAgICAgICB2aW9sYXRpb25zLnB1c2goe1xuICAgICAgICAgIHJvd0lkLFxuICAgICAgICAgIGZpZWxkSWQ6IGZpZWxkLmlkLFxuICAgICAgICAgIHJ1bGU6ICdtYXgnLFxuICAgICAgICAgIG1lc3NhZ2U6IGAke2ZpZWxkLm5hbWV9IG11c3QgYmUgYXQgbW9zdCAke2ZpZWxkLm1heH1gLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGZpZWxkLm1heCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGlmICh2YWx1ZSA+IGZpZWxkLm1heCkge1xuICAgICAgICB2aW9sYXRpb25zLnB1c2goe1xuICAgICAgICAgIHJvd0lkLFxuICAgICAgICAgIGZpZWxkSWQ6IGZpZWxkLmlkLFxuICAgICAgICAgIHJ1bGU6ICdtYXgnLFxuICAgICAgICAgIG1lc3NhZ2U6IGAke2ZpZWxkLm5hbWV9IG11c3QgYmUgYXQgbW9zdCAke2ZpZWxkLm1heH1gLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBSZWdleCBjaGVja1xuICBpZiAoZmllbGQucmVnZXgpIHtcbiAgICBjb25zdCBzdHJWYWx1ZSA9IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyB2YWx1ZSA6IFN0cmluZyh2YWx1ZSk7XG4gICAgaWYgKHN0clZhbHVlLmxlbmd0aCA+IFJFR0VYX0lOUFVUX0xJTUlUKSB7XG4gICAgICB2aW9sYXRpb25zLnB1c2goe1xuICAgICAgICByb3dJZCxcbiAgICAgICAgZmllbGRJZDogZmllbGQuaWQsXG4gICAgICAgIHJ1bGU6ICdyZWdleCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke2ZpZWxkLm5hbWV9IGV4Y2VlZHMgbWF4aW11bSBpbnB1dCBsZW5ndGggKCR7UkVHRVhfSU5QVVRfTElNSVR9KWAsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmUgPSBuZXcgUmVnRXhwKGZpZWxkLnJlZ2V4KTtcbiAgICAgICAgaWYgKCFyZS50ZXN0KHN0clZhbHVlKSkge1xuICAgICAgICAgIHZpb2xhdGlvbnMucHVzaCh7XG4gICAgICAgICAgICByb3dJZCxcbiAgICAgICAgICAgIGZpZWxkSWQ6IGZpZWxkLmlkLFxuICAgICAgICAgICAgcnVsZTogJ3JlZ2V4JyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2ZpZWxkLm5hbWV9IGRvZXMgbm90IG1hdGNoIHBhdHRlcm4gJHtmaWVsZC5yZWdleH1gLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gSW52YWxpZCByZWdleCBcdTIwMTQgc2hvdWxkbid0IGhhcHBlbiBpZiB2YWxpZGF0ZWQgYXQgY29uZmlnIHRpbWVcbiAgICAgICAgdmlvbGF0aW9ucy5wdXNoKHtcbiAgICAgICAgICByb3dJZCxcbiAgICAgICAgICBmaWVsZElkOiBmaWVsZC5pZCxcbiAgICAgICAgICBydWxlOiAncmVnZXgnLFxuICAgICAgICAgIG1lc3NhZ2U6IGAke2ZpZWxkLm5hbWV9IGhhcyBpbnZhbGlkIHJlZ2V4IHBhdHRlcm5gLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBVbmlxdWUgY2hlY2sgKGNhc2Utc2Vuc2l0aXZlIGJ5IGRlZmF1bHQpXG4gIGlmIChmaWVsZC51bmlxdWUgJiYgYWxsUm93cyAmJiBhbGxSb3dzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCB0cmltbWVkVmFsdWUgPSB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnID8gdmFsdWUudHJpbSgpIDogdmFsdWU7XG4gICAgY29uc3QgZHVwbGljYXRlcyA9IGFsbFJvd3MuZmlsdGVyKHJvdyA9PiB7XG4gICAgICBpZiAocm93LmlkID09PSBjdXJyZW50Um93SWQpIHJldHVybiBmYWxzZTtcbiAgICAgIGNvbnN0IG90aGVyVmFsdWUgPSByb3cudmFsdWVzW2ZpZWxkLmlkXTtcbiAgICAgIGNvbnN0IHRyaW1tZWRPdGhlciA9IHR5cGVvZiBvdGhlclZhbHVlID09PSAnc3RyaW5nJyA/IG90aGVyVmFsdWUudHJpbSgpIDogb3RoZXJWYWx1ZTtcbiAgICAgIHJldHVybiB0cmltbWVkT3RoZXIgPT09IHRyaW1tZWRWYWx1ZSAmJiBvdGhlclZhbHVlICE9PSBudWxsO1xuICAgIH0pO1xuICAgIGlmIChkdXBsaWNhdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHZpb2xhdGlvbnMucHVzaCh7XG4gICAgICAgIHJvd0lkLFxuICAgICAgICBmaWVsZElkOiBmaWVsZC5pZCxcbiAgICAgICAgcnVsZTogJ3VuaXF1ZScsXG4gICAgICAgIG1lc3NhZ2U6IGAke2ZpZWxkLm5hbWV9IG11c3QgYmUgdW5pcXVlYCxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB2aW9sYXRpb25zO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGEgcmVnZXggcGF0dGVybiBhdCBjb25maWcgdGltZS5cbiAqIFRocm93cyBpZiB0aGUgcGF0dGVybiBpcyBpbnZhbGlkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVSZWdleFBhdHRlcm4ocGF0dGVybjogc3RyaW5nKTogdm9pZCB7XG4gIHRyeSB7XG4gICAgbmV3IFJlZ0V4cChwYXR0ZXJuKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCByZWdleCBwYXR0ZXJuOiBcIiR7cGF0dGVybn1cImAsIHsgY2F1c2U6IGUgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBUZXN0IGlmIGEgcmVnZXggcGF0dGVybiBpcyBzYWZlIChkb2Vzbid0IGNhdXNlIFJlRG9TKS5cbiAqIFVzZXMgYSBib3VuZGVkIHRlc3Q6IGlmIHRoZSBwYXR0ZXJuIHRha2VzIG1vcmUgdGhhbiB0aGUgbGltaXQgb24gYSBrbm93bi1kYW5nZXJvdXMgaW5wdXQsIGl0J3MgdW5zYWZlLlxuICogTm90ZTogSW4gTm9kZS5qcywgd2UgY2Fubm90IGVhc2lseSB0aW1lb3V0IGEgcmVnZXguIEluc3RlYWQgd2UgdXNlIGEgc2hvcnQsIGtub3duLWRhbmdlcm91cyBpbnB1dFxuICogYW5kIGNoZWNrIGlmIGl0IGNvbXBsZXRlcyBxdWlja2x5LiBGb3IgcHJvZHVjdGlvbiwgY29uc2lkZXIgYSByZWdleCBzYWZldHkgYW5hbHlzaXMgbGlicmFyeS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUmVnZXhTYWZlKHBhdHRlcm46IHN0cmluZyk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlID0gbmV3IFJlZ0V4cChwYXR0ZXJuKTtcbiAgICAvLyBUZXN0IHdpdGggYSBzaG9ydCBidXQgcG90ZW50aWFsbHkgZGFuZ2Vyb3VzIGlucHV0XG4gICAgY29uc3Qgc3RhcnQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICByZS50ZXN0KCdhJy5yZXBlYXQoMjApICsgJ2InKTtcbiAgICBjb25zdCBlbGFwc2VkID0gcGVyZm9ybWFuY2Uubm93KCkgLSBzdGFydDtcbiAgICByZXR1cm4gZWxhcHNlZCA8IDEwMDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBDZWxsVmFsdWUgfSBmcm9tICcuLi90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7IEZpZWxkVHlwZSB9IGZyb20gJy4vaW50ZXJmYWNlLmpzJztcblxuLyoqIHRleHQgXHUyMDE0IHNob3J0IHRleHQsIG1heCAxMCwwMDAgY2hhcmFjdGVycyAqL1xuZXhwb3J0IGNvbnN0IHRleHRUeXBlOiBGaWVsZFR5cGUgPSB7XG4gIHJlYWRPbmx5OiBmYWxzZSxcblxuICB2YWxpZGF0ZSh2YWx1ZTogQ2VsbFZhbHVlKTogYm9vbGVhbiB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPD0gMTBfMDAwO1xuICB9LFxuXG4gIHBhcnNlKGlucHV0OiBzdHJpbmcpOiBDZWxsVmFsdWUge1xuICAgIHJldHVybiBpbnB1dC5sZW5ndGggPiAxMF8wMDAgPyBpbnB1dC5zbGljZSgwLCAxMF8wMDApIDogaW5wdXQ7XG4gIH0sXG5cbiAgZm9ybWF0KHZhbHVlOiBDZWxsVmFsdWUpOiBzdHJpbmcge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkgcmV0dXJuICcnO1xuICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICB9LFxuXG4gIGRlZmF1bHRWYWx1ZSgpOiBDZWxsVmFsdWUge1xuICAgIHJldHVybiBudWxsO1xuICB9LFxufTtcblxuLyoqIGxvbmdfdGV4dCBcdTIwMTQgbXVsdGlsaW5lIHRleHQsIG1heCAxMDAsMDAwIGNoYXJhY3RlcnMgKi9cbmV4cG9ydCBjb25zdCBsb25nVGV4dFR5cGU6IEZpZWxkVHlwZSA9IHtcbiAgcmVhZE9ubHk6IGZhbHNlLFxuXG4gIHZhbGlkYXRlKHZhbHVlOiBDZWxsVmFsdWUpOiBib29sZWFuIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLmxlbmd0aCA8PSAxMDBfMDAwO1xuICB9LFxuXG4gIHBhcnNlKGlucHV0OiBzdHJpbmcpOiBDZWxsVmFsdWUge1xuICAgIHJldHVybiBpbnB1dC5sZW5ndGggPiAxMDBfMDAwID8gaW5wdXQuc2xpY2UoMCwgMTAwXzAwMCkgOiBpbnB1dDtcbiAgfSxcblxuICBmb3JtYXQodmFsdWU6IENlbGxWYWx1ZSk6IHN0cmluZyB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gIH0sXG5cbiAgZGVmYXVsdFZhbHVlKCk6IENlbGxWYWx1ZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG59O1xuIiwgImltcG9ydCB0eXBlIHsgQ2VsbFZhbHVlIH0gZnJvbSAnLi4vdHlwZXMuanMnO1xuaW1wb3J0IHR5cGUgeyBGaWVsZFR5cGUgfSBmcm9tICcuL2ludGVyZmFjZS5qcyc7XG5cbi8qKiBudW1iZXIgXHUyMDE0IGZpbml0ZSBudW1iZXIsIG51bGxhYmxlICovXG5leHBvcnQgY29uc3QgbnVtYmVyVHlwZTogRmllbGRUeXBlID0ge1xuICByZWFkT25seTogZmFsc2UsXG5cbiAgdmFsaWRhdGUodmFsdWU6IENlbGxWYWx1ZSk6IGJvb2xlYW4ge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKHZhbHVlKTtcbiAgfSxcblxuICBwYXJzZShpbnB1dDogc3RyaW5nKTogQ2VsbFZhbHVlIHtcbiAgICBjb25zdCB0cmltbWVkID0gaW5wdXQudHJpbSgpO1xuICAgIGlmICh0cmltbWVkID09PSAnJykgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgbiA9IE51bWJlcih0cmltbWVkKTtcbiAgICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKG4pID8gbiA6IG51bGw7XG4gIH0sXG5cbiAgZm9ybWF0KHZhbHVlOiBDZWxsVmFsdWUpOiBzdHJpbmcge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkgcmV0dXJuICcnO1xuICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICB9LFxuXG4gIGRlZmF1bHRWYWx1ZSgpOiBDZWxsVmFsdWUge1xuICAgIHJldHVybiBudWxsO1xuICB9LFxufTtcblxuLyoqXG4gKiBjdXJyZW5jeSBcdTIwMTQgc3RvcmVkIGFzIGludGVnZXIgbWlub3IgdW5pdHMgKGUuZy4sIGNlbnRzKS5cbiAqIE5vIGN1cnJlbmN5IGNvZGUgaW4gdjEuIEFzc3VtcHRpb246IDIgZGVjaW1hbCBwbGFjZXMuXG4gKi9cbmV4cG9ydCBjb25zdCBjdXJyZW5jeVR5cGU6IEZpZWxkVHlwZSA9IHtcbiAgcmVhZE9ubHk6IGZhbHNlLFxuXG4gIHZhbGlkYXRlKHZhbHVlOiBDZWxsVmFsdWUpOiBib29sZWFuIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIE51bWJlci5pc0ludGVnZXIodmFsdWUpICYmIHZhbHVlID49IDA7XG4gIH0sXG5cbiAgcGFyc2UoaW5wdXQ6IHN0cmluZyk6IENlbGxWYWx1ZSB7XG4gICAgY29uc3QgdHJpbW1lZCA9IGlucHV0LnRyaW0oKTtcbiAgICBpZiAodHJpbW1lZCA9PT0gJycpIHJldHVybiBudWxsO1xuICAgIC8vIFJlbW92ZSBjdXJyZW5jeSBzeW1ib2xzIGFuZCBjb21tYXNcbiAgICBjb25zdCBjbGVhbmVkID0gdHJpbW1lZC5yZXBsYWNlKC9bXjAtOS4tXS9nLCAnJyk7XG4gICAgY29uc3QgbiA9IHBhcnNlRmxvYXQoY2xlYW5lZCk7XG4gICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUobikpIHJldHVybiBudWxsO1xuICAgIC8vIENvbnZlcnQgdG8gbWlub3IgdW5pdHMgKGNlbnRzKVxuICAgIHJldHVybiBNYXRoLnJvdW5kKG4gKiAxMDApO1xuICB9LFxuXG4gIGZvcm1hdCh2YWx1ZTogQ2VsbFZhbHVlKTogc3RyaW5nIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiAnJztcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJykgcmV0dXJuICcnO1xuICAgIC8vIENvbnZlcnQgZnJvbSBtaW5vciB1bml0cyBiYWNrIHRvIGRpc3BsYXlcbiAgICBjb25zdCBzaWduID0gdmFsdWUgPCAwID8gJy0nIDogJyc7XG4gICAgY29uc3QgYWJzID0gTWF0aC5hYnModmFsdWUpO1xuICAgIGNvbnN0IHdob2xlID0gTWF0aC5mbG9vcihhYnMgLyAxMDApO1xuICAgIGNvbnN0IGZyYWMgPSBhYnMgJSAxMDA7XG4gICAgcmV0dXJuIGAke3NpZ259JHt3aG9sZX0uJHtTdHJpbmcoZnJhYykucGFkU3RhcnQoMiwgJzAnKX1gO1xuICB9LFxuXG4gIGRlZmF1bHRWYWx1ZSgpOiBDZWxsVmFsdWUge1xuICAgIHJldHVybiBudWxsO1xuICB9LFxufTtcblxuLyoqIHBlcmNlbnQgXHUyMDE0IHN0b3JlZCBhcyBkZWNpbWFsICgwLjc1ID0gNzUlKSwgcmFuZ2UgMFx1MjAxMzEgKi9cbmV4cG9ydCBjb25zdCBwZXJjZW50VHlwZTogRmllbGRUeXBlID0ge1xuICByZWFkT25seTogZmFsc2UsXG5cbiAgdmFsaWRhdGUodmFsdWU6IENlbGxWYWx1ZSk6IGJvb2xlYW4ge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKHZhbHVlKSAmJiB2YWx1ZSA+PSAwICYmIHZhbHVlIDw9IDE7XG4gIH0sXG5cbiAgcGFyc2UoaW5wdXQ6IHN0cmluZyk6IENlbGxWYWx1ZSB7XG4gICAgY29uc3QgdHJpbW1lZCA9IGlucHV0LnRyaW0oKTtcbiAgICBpZiAodHJpbW1lZCA9PT0gJycpIHJldHVybiBudWxsO1xuICAgIC8vIFN1cHBvcnQgXCI3NSVcIiBmb3JtYXRcbiAgICBpZiAodHJpbW1lZC5lbmRzV2l0aCgnJScpKSB7XG4gICAgICBjb25zdCBuID0gcGFyc2VGbG9hdCh0cmltbWVkLnNsaWNlKDAsIC0xKSk7XG4gICAgICBpZiAoIU51bWJlci5pc0Zpbml0ZShuKSkgcmV0dXJuIG51bGw7XG4gICAgICByZXR1cm4gbiAvIDEwMDtcbiAgICB9XG4gICAgY29uc3QgbiA9IHBhcnNlRmxvYXQodHJpbW1lZCk7XG4gICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUobikpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBuO1xuICB9LFxuXG4gIGZvcm1hdCh2YWx1ZTogQ2VsbFZhbHVlKTogc3RyaW5nIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiAnJztcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJykgcmV0dXJuICcnO1xuICAgIHJldHVybiBgJHtNYXRoLnJvdW5kKHZhbHVlICogMTAwKX0lYDtcbiAgfSxcblxuICBkZWZhdWx0VmFsdWUoKTogQ2VsbFZhbHVlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbn07XG5cbi8qKiBkdXJhdGlvbiBcdTIwMTQgc3RvcmVkIGFzIGludGVnZXIgbWlsbGlzZWNvbmRzICovXG5leHBvcnQgY29uc3QgZHVyYXRpb25UeXBlOiBGaWVsZFR5cGUgPSB7XG4gIHJlYWRPbmx5OiBmYWxzZSxcblxuICB2YWxpZGF0ZSh2YWx1ZTogQ2VsbFZhbHVlKTogYm9vbGVhbiB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKSAmJiB2YWx1ZSA+PSAwO1xuICB9LFxuXG4gIHBhcnNlKGlucHV0OiBzdHJpbmcpOiBDZWxsVmFsdWUge1xuICAgIGNvbnN0IHRyaW1tZWQgPSBpbnB1dC50cmltKCk7XG4gICAgaWYgKHRyaW1tZWQgPT09ICcnKSByZXR1cm4gbnVsbDtcblxuICAgIC8vIFRyeSBISDpNTTpTUyBmb3JtYXRcbiAgICBjb25zdCBobXNNYXRjaCA9IHRyaW1tZWQubWF0Y2goL14oXFxkKyk6KFxcZHsxLDJ9KTooXFxkezEsMn0pJC8pO1xuICAgIGlmIChobXNNYXRjaCkge1xuICAgICAgY29uc3QgaCA9IHBhcnNlSW50KGhtc01hdGNoWzFdLCAxMCk7XG4gICAgICBjb25zdCBtID0gcGFyc2VJbnQoaG1zTWF0Y2hbMl0sIDEwKTtcbiAgICAgIGNvbnN0IHMgPSBwYXJzZUludChobXNNYXRjaFszXSwgMTApO1xuICAgICAgcmV0dXJuIChoICogMzYwMCArIG0gKiA2MCArIHMpICogMTAwMDtcbiAgICB9XG5cbiAgICAvLyBUcnkgSDpNTTpTUyBmb3JtYXRcbiAgICBjb25zdCBobXNNYXRjaDIgPSB0cmltbWVkLm1hdGNoKC9eKFxcZCspOihcXGR7MSwyfSkkLyk7XG4gICAgaWYgKGhtc01hdGNoMikge1xuICAgICAgY29uc3QgbSA9IHBhcnNlSW50KGhtc01hdGNoMlsxXSwgMTApO1xuICAgICAgY29uc3QgcyA9IHBhcnNlSW50KGhtc01hdGNoMlsyXSwgMTApO1xuICAgICAgcmV0dXJuIChtICogNjAgKyBzKSAqIDEwMDA7XG4gICAgfVxuXG4gICAgLy8gVHJ5IFwiWGggWW1cIiBvciBcIlhoIFltIFpzXCIgZm9ybWF0XG4gICAgY29uc3QgaHVtYW5NYXRjaCA9IHRyaW1tZWQubWF0Y2goL14oPzooXFxkKylcXHMqaCk/XFxzKig/OihcXGQrKVxccyptKT9cXHMqKD86KFxcZCspXFxzKnMpPyQvaSk7XG4gICAgaWYgKGh1bWFuTWF0Y2ggJiYgKGh1bWFuTWF0Y2hbMV0gfHwgaHVtYW5NYXRjaFsyXSB8fCBodW1hbk1hdGNoWzNdKSkge1xuICAgICAgY29uc3QgaCA9IGh1bWFuTWF0Y2hbMV0gPyBwYXJzZUludChodW1hbk1hdGNoWzFdLCAxMCkgOiAwO1xuICAgICAgY29uc3QgbSA9IGh1bWFuTWF0Y2hbMl0gPyBwYXJzZUludChodW1hbk1hdGNoWzJdLCAxMCkgOiAwO1xuICAgICAgY29uc3QgcyA9IGh1bWFuTWF0Y2hbM10gPyBwYXJzZUludChodW1hbk1hdGNoWzNdLCAxMCkgOiAwO1xuICAgICAgcmV0dXJuIChoICogMzYwMCArIG0gKiA2MCArIHMpICogMTAwMDtcbiAgICB9XG5cbiAgICAvLyBUcnkgcmF3IG1pbGxpc2Vjb25kc1xuICAgIGNvbnN0IG4gPSBwYXJzZUludCh0cmltbWVkLCAxMCk7XG4gICAgaWYgKE51bWJlci5pc0Zpbml0ZShuKSAmJiBuID49IDApIHJldHVybiBuO1xuXG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgZm9ybWF0KHZhbHVlOiBDZWxsVmFsdWUpOiBzdHJpbmcge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkgcmV0dXJuICcnO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInKSByZXR1cm4gJyc7XG4gICAgY29uc3QgdG90YWxTZWNvbmRzID0gTWF0aC5mbG9vcih2YWx1ZSAvIDEwMDApO1xuICAgIGNvbnN0IGggPSBNYXRoLmZsb29yKHRvdGFsU2Vjb25kcyAvIDM2MDApO1xuICAgIGNvbnN0IG0gPSBNYXRoLmZsb29yKCh0b3RhbFNlY29uZHMgJSAzNjAwKSAvIDYwKTtcbiAgICBjb25zdCBzID0gdG90YWxTZWNvbmRzICUgNjA7XG4gICAgaWYgKGggPiAwKSByZXR1cm4gYCR7aH1oICR7U3RyaW5nKG0pLnBhZFN0YXJ0KDIsICcwJyl9bSAke1N0cmluZyhzKS5wYWRTdGFydCgyLCAnMCcpfXNgO1xuICAgIGlmIChtID4gMCkgcmV0dXJuIGAke219bSAke1N0cmluZyhzKS5wYWRTdGFydCgyLCAnMCcpfXNgO1xuICAgIHJldHVybiBgJHtzfXNgO1xuICB9LFxuXG4gIGRlZmF1bHRWYWx1ZSgpOiBDZWxsVmFsdWUge1xuICAgIHJldHVybiBudWxsO1xuICB9LFxufTtcblxuLyoqIHJhdGluZyBcdTIwMTQgaW50ZWdlciAxXHUyMDEzMTAgKi9cbmV4cG9ydCBjb25zdCByYXRpbmdUeXBlOiBGaWVsZFR5cGUgPSB7XG4gIHJlYWRPbmx5OiBmYWxzZSxcblxuICB2YWxpZGF0ZSh2YWx1ZTogQ2VsbFZhbHVlKTogYm9vbGVhbiB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKSAmJiB2YWx1ZSA+PSAxICYmIHZhbHVlIDw9IDEwO1xuICB9LFxuXG4gIHBhcnNlKGlucHV0OiBzdHJpbmcpOiBDZWxsVmFsdWUge1xuICAgIGNvbnN0IHRyaW1tZWQgPSBpbnB1dC50cmltKCk7XG4gICAgaWYgKHRyaW1tZWQgPT09ICcnKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBuID0gcGFyc2VJbnQodHJpbW1lZCwgMTApO1xuICAgIGlmICghTnVtYmVyLmlzRmluaXRlKG4pKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gTWF0aC5tYXgoMSwgTWF0aC5taW4oMTAsIG4pKTtcbiAgfSxcblxuICBmb3JtYXQodmFsdWU6IENlbGxWYWx1ZSk6IHN0cmluZyB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gIH0sXG5cbiAgZGVmYXVsdFZhbHVlKCk6IENlbGxWYWx1ZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG59O1xuIiwgImltcG9ydCB0eXBlIHsgQ2VsbFZhbHVlIH0gZnJvbSAnLi4vdHlwZXMuanMnO1xuaW1wb3J0IHR5cGUgeyBGaWVsZFR5cGUgfSBmcm9tICcuL2ludGVyZmFjZS5qcyc7XG5cbi8qKiBjaGVja2JveCBcdTIwMTQgYm9vbGVhbiwgbnVsbGFibGUgKi9cbmV4cG9ydCBjb25zdCBjaGVja2JveFR5cGU6IEZpZWxkVHlwZSA9IHtcbiAgcmVhZE9ubHk6IGZhbHNlLFxuXG4gIHZhbGlkYXRlKHZhbHVlOiBDZWxsVmFsdWUpOiBib29sZWFuIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbiAgfSxcblxuICBwYXJzZShpbnB1dDogc3RyaW5nKTogQ2VsbFZhbHVlIHtcbiAgICBjb25zdCB0cmltbWVkID0gaW5wdXQudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKHRyaW1tZWQgPT09ICcnKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoWyd0cnVlJywgJzEnLCAneWVzJywgJ3knLCAnXHUyNzEzJywgJ2NoZWNrZWQnXS5pbmNsdWRlcyh0cmltbWVkKSkgcmV0dXJuIHRydWU7XG4gICAgaWYgKFsnZmFsc2UnLCAnMCcsICdubycsICduJywgJycsICd1bmNoZWNrZWQnXS5pbmNsdWRlcyh0cmltbWVkKSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIGZvcm1hdCh2YWx1ZTogQ2VsbFZhbHVlKTogc3RyaW5nIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiAnJztcbiAgICByZXR1cm4gdmFsdWUgPyAnXHUyNzEzJyA6ICcnO1xuICB9LFxuXG4gIGRlZmF1bHRWYWx1ZSgpOiBDZWxsVmFsdWUge1xuICAgIHJldHVybiBudWxsO1xuICB9LFxufTtcbiIsICJpbXBvcnQgdHlwZSB7IENlbGxWYWx1ZSB9IGZyb20gJy4uL3R5cGVzLmpzJztcbmltcG9ydCB0eXBlIHsgRmllbGRUeXBlIH0gZnJvbSAnLi9pbnRlcmZhY2UuanMnO1xuXG5jb25zdCBEQVRFX1JFID0gL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvO1xuXG5mdW5jdGlvbiBpc1ZhbGlkRGF0ZShzOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgZCA9IG5ldyBEYXRlKHMgKyAnVDAwOjAwOjAwWicpO1xuICByZXR1cm4gIWlzTmFOKGQuZ2V0VGltZSgpKSAmJiBzID09PSBkLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xufVxuXG5mdW5jdGlvbiBpc1ZhbGlkRGF0ZVRpbWUoczogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZShzKTtcbiAgcmV0dXJuICFpc05hTihkLmdldFRpbWUoKSk7XG59XG5cbi8qKiBkYXRlIFx1MjAxNCBZWVlZLU1NLUREIGZvcm1hdCAqL1xuZXhwb3J0IGNvbnN0IGRhdGVUeXBlOiBGaWVsZFR5cGUgPSB7XG4gIHJlYWRPbmx5OiBmYWxzZSxcblxuICB2YWxpZGF0ZSh2YWx1ZTogQ2VsbFZhbHVlKTogYm9vbGVhbiB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiBEQVRFX1JFLnRlc3QodmFsdWUpICYmIGlzVmFsaWREYXRlKHZhbHVlKTtcbiAgfSxcblxuICBwYXJzZShpbnB1dDogc3RyaW5nKTogQ2VsbFZhbHVlIHtcbiAgICBjb25zdCB0cmltbWVkID0gaW5wdXQudHJpbSgpO1xuICAgIGlmICh0cmltbWVkID09PSAnJykgcmV0dXJuIG51bGw7XG4gICAgLy8gVHJ5IFlZWVktTU0tRERcbiAgICBpZiAoREFURV9SRS50ZXN0KHRyaW1tZWQpICYmIGlzVmFsaWREYXRlKHRyaW1tZWQpKSByZXR1cm4gdHJpbW1lZDtcbiAgICAvLyBUcnkgcGFyc2luZyBhcyBkYXRlIGFuZCBleHRyYWN0aW5nIFlZWVktTU0tRERcbiAgICBjb25zdCBkID0gbmV3IERhdGUodHJpbW1lZCk7XG4gICAgaWYgKCFpc05hTihkLmdldFRpbWUoKSkpIHtcbiAgICAgIHJldHVybiBkLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICBmb3JtYXQodmFsdWU6IENlbGxWYWx1ZSk6IHN0cmluZyB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gIH0sXG5cbiAgZGVmYXVsdFZhbHVlKCk6IENlbGxWYWx1ZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG59O1xuXG4vKiogZGF0ZV90aW1lIFx1MjAxNCBJU08gODYwMSBVVEMgKi9cbmV4cG9ydCBjb25zdCBkYXRlVGltZVR5cGU6IEZpZWxkVHlwZSA9IHtcbiAgcmVhZE9ubHk6IGZhbHNlLFxuXG4gIHZhbGlkYXRlKHZhbHVlOiBDZWxsVmFsdWUpOiBib29sZWFuIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIGlzVmFsaWREYXRlVGltZSh2YWx1ZSk7XG4gIH0sXG5cbiAgcGFyc2UoaW5wdXQ6IHN0cmluZyk6IENlbGxWYWx1ZSB7XG4gICAgY29uc3QgdHJpbW1lZCA9IGlucHV0LnRyaW0oKTtcbiAgICBpZiAodHJpbW1lZCA9PT0gJycpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSh0cmltbWVkKTtcbiAgICBpZiAoaXNOYU4oZC5nZXRUaW1lKCkpKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gZC50b0lTT1N0cmluZygpO1xuICB9LFxuXG4gIGZvcm1hdCh2YWx1ZTogQ2VsbFZhbHVlKTogc3RyaW5nIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiAnJztcbiAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgfSxcblxuICBkZWZhdWx0VmFsdWUoKTogQ2VsbFZhbHVlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbn07XG4iLCAiaW1wb3J0IHR5cGUgeyBDZWxsVmFsdWUgfSBmcm9tICcuLi90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7IEZpZWxkVHlwZSB9IGZyb20gJy4vaW50ZXJmYWNlLmpzJztcblxuLy8gU2ltcGxlIFVSTCB2YWxpZGF0aW9uOiBtdXN0IGhhdmUgcHJvdG9jb2wgYW5kIGhvc3RcbmNvbnN0IFVSTF9SRSA9IC9eaHR0cHM/OlxcL1xcLy4rL2k7XG5cbi8qKiB1cmwgXHUyMDE0IHN0cmluZyB0aGF0IGxvb2tzIGxpa2UgYSBVUkwgKi9cbmV4cG9ydCBjb25zdCB1cmxUeXBlOiBGaWVsZFR5cGUgPSB7XG4gIHJlYWRPbmx5OiBmYWxzZSxcblxuICB2YWxpZGF0ZSh2YWx1ZTogQ2VsbFZhbHVlKTogYm9vbGVhbiB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh2YWx1ZSA9PT0gJycpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBVUkxfUkUudGVzdCh2YWx1ZSk7XG4gIH0sXG5cbiAgcGFyc2UoaW5wdXQ6IHN0cmluZyk6IENlbGxWYWx1ZSB7XG4gICAgY29uc3QgdHJpbW1lZCA9IGlucHV0LnRyaW0oKTtcbiAgICBpZiAodHJpbW1lZCA9PT0gJycpIHJldHVybiBudWxsO1xuICAgIHJldHVybiB0cmltbWVkO1xuICB9LFxuXG4gIGZvcm1hdCh2YWx1ZTogQ2VsbFZhbHVlKTogc3RyaW5nIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiAnJztcbiAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgfSxcblxuICBkZWZhdWx0VmFsdWUoKTogQ2VsbFZhbHVlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbn07XG5cbi8vIFNpbXBsZSBlbWFpbCB2YWxpZGF0aW9uXG5jb25zdCBFTUFJTF9SRSA9IC9eW15cXHNAXStAW15cXHNAXStcXC5bXlxcc0BdKyQvO1xuXG4vKiogZW1haWwgXHUyMDE0IHN0cmluZyBtYXRjaGluZyBlbWFpbCBwYXR0ZXJuICovXG5leHBvcnQgY29uc3QgZW1haWxUeXBlOiBGaWVsZFR5cGUgPSB7XG4gIHJlYWRPbmx5OiBmYWxzZSxcblxuICB2YWxpZGF0ZSh2YWx1ZTogQ2VsbFZhbHVlKTogYm9vbGVhbiB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh2YWx1ZSA9PT0gJycpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBFTUFJTF9SRS50ZXN0KHZhbHVlKTtcbiAgfSxcblxuICBwYXJzZShpbnB1dDogc3RyaW5nKTogQ2VsbFZhbHVlIHtcbiAgICBjb25zdCB0cmltbWVkID0gaW5wdXQudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKHRyaW1tZWQgPT09ICcnKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gdHJpbW1lZDtcbiAgfSxcblxuICBmb3JtYXQodmFsdWU6IENlbGxWYWx1ZSk6IHN0cmluZyB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gIH0sXG5cbiAgZGVmYXVsdFZhbHVlKCk6IENlbGxWYWx1ZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG59O1xuXG4vLyBQaG9uZTogYWxsb3dzIGRpZ2l0cywgc3BhY2VzLCBkYXNoZXMsIHBhcmVudGhlc2VzLCBsZWFkaW5nICtcbmNvbnN0IFBIT05FX1JFID0gL15cXCs/W1xcZFxcc1xcLSgpLl17NSwyMH0kLztcblxuLyoqIHBob25lIFx1MjAxNCBzdHJpbmcgbWF0Y2hpbmcgcGhvbmUgcGF0dGVybiAqL1xuZXhwb3J0IGNvbnN0IHBob25lVHlwZTogRmllbGRUeXBlID0ge1xuICByZWFkT25seTogZmFsc2UsXG5cbiAgdmFsaWRhdGUodmFsdWU6IENlbGxWYWx1ZSk6IGJvb2xlYW4ge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodmFsdWUgPT09ICcnKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gUEhPTkVfUkUudGVzdCh2YWx1ZSk7XG4gIH0sXG5cbiAgcGFyc2UoaW5wdXQ6IHN0cmluZyk6IENlbGxWYWx1ZSB7XG4gICAgY29uc3QgdHJpbW1lZCA9IGlucHV0LnRyaW0oKTtcbiAgICBpZiAodHJpbW1lZCA9PT0gJycpIHJldHVybiBudWxsO1xuICAgIHJldHVybiB0cmltbWVkO1xuICB9LFxuXG4gIGZvcm1hdCh2YWx1ZTogQ2VsbFZhbHVlKTogc3RyaW5nIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiAnJztcbiAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgfSxcblxuICBkZWZhdWx0VmFsdWUoKTogQ2VsbFZhbHVlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbn07XG4iLCAiaW1wb3J0IHR5cGUgeyBDZWxsVmFsdWUsIEZpZWxkRGVmaW5pdGlvbiB9IGZyb20gJy4uL3R5cGVzLmpzJztcbmltcG9ydCB0eXBlIHsgRmllbGRUeXBlIH0gZnJvbSAnLi9pbnRlcmZhY2UuanMnO1xuXG4vKiogc2luZ2xlX3NlbGVjdCBcdTIwMTQgc3RvcmVzIG9wdGlvbiBJRCAoc3RyaW5nKSBvciBudWxsICovXG5leHBvcnQgY29uc3Qgc2luZ2xlU2VsZWN0VHlwZTogRmllbGRUeXBlID0ge1xuICByZWFkT25seTogZmFsc2UsXG5cbiAgdmFsaWRhdGUodmFsdWU6IENlbGxWYWx1ZSwgZmllbGQ/OiBGaWVsZERlZmluaXRpb24pOiBib29sZWFuIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCFmaWVsZD8ub3B0aW9ucykgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiBmaWVsZC5vcHRpb25zLnNvbWUob3B0ID0+IG9wdC5pZCA9PT0gdmFsdWUpO1xuICB9LFxuXG4gIHBhcnNlKGlucHV0OiBzdHJpbmcsIGZpZWxkPzogRmllbGREZWZpbml0aW9uKTogQ2VsbFZhbHVlIHtcbiAgICBjb25zdCB0cmltbWVkID0gaW5wdXQudHJpbSgpO1xuICAgIGlmICh0cmltbWVkID09PSAnJykgcmV0dXJuIG51bGw7XG4gICAgaWYgKCFmaWVsZD8ub3B0aW9ucykgcmV0dXJuIG51bGw7XG5cbiAgICAvLyBNYXRjaCBieSB0cmltbWVkLCBjYXNlLWluc2Vuc2l0aXZlIG5hbWVcbiAgICBjb25zdCBsb3dlciA9IHRyaW1tZWQudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBtYXRjaCA9IGZpZWxkLm9wdGlvbnMuZmluZChvcHQgPT4gb3B0Lm5hbWUudHJpbSgpLnRvTG93ZXJDYXNlKCkgPT09IGxvd2VyKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaC5pZCA6IG51bGw7XG4gIH0sXG5cbiAgZm9ybWF0KHZhbHVlOiBDZWxsVmFsdWUsIGZpZWxkPzogRmllbGREZWZpbml0aW9uKTogc3RyaW5nIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiAnJztcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJyB8fCAhZmllbGQ/Lm9wdGlvbnMpIHJldHVybiAnJztcbiAgICBjb25zdCBvcHQgPSBmaWVsZC5vcHRpb25zLmZpbmQobyA9PiBvLmlkID09PSB2YWx1ZSk7XG4gICAgcmV0dXJuIG9wdCA/IG9wdC5uYW1lIDogJyc7XG4gIH0sXG5cbiAgZGVmYXVsdFZhbHVlKCk6IENlbGxWYWx1ZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG59O1xuXG4vKiogbXVsdGlfc2VsZWN0IFx1MjAxNCBzdG9yZXMgYXJyYXkgb2Ygb3B0aW9uIElEcyBvciBudWxsICovXG5leHBvcnQgY29uc3QgbXVsdGlTZWxlY3RUeXBlOiBGaWVsZFR5cGUgPSB7XG4gIHJlYWRPbmx5OiBmYWxzZSxcblxuICB2YWxpZGF0ZSh2YWx1ZTogQ2VsbFZhbHVlLCBmaWVsZD86IEZpZWxkRGVmaW5pdGlvbik6IGJvb2xlYW4ge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghZmllbGQ/Lm9wdGlvbnMpIHJldHVybiB2YWx1ZS5sZW5ndGggPT09IDA7XG4gICAgY29uc3Qgb3B0aW9uSWRzID0gbmV3IFNldChmaWVsZC5vcHRpb25zLm1hcChvID0+IG8uaWQpKTtcbiAgICByZXR1cm4gdmFsdWUuZXZlcnkodiA9PiB0eXBlb2YgdiA9PT0gJ3N0cmluZycgJiYgb3B0aW9uSWRzLmhhcyh2KSk7XG4gIH0sXG5cbiAgcGFyc2UoaW5wdXQ6IHN0cmluZywgZmllbGQ/OiBGaWVsZERlZmluaXRpb24pOiBDZWxsVmFsdWUge1xuICAgIGNvbnN0IHRyaW1tZWQgPSBpbnB1dC50cmltKCk7XG4gICAgaWYgKHRyaW1tZWQgPT09ICcnKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoIWZpZWxkPy5vcHRpb25zKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHBhcnRzID0gdHJpbW1lZC5zcGxpdCgnLCcpLm1hcChzID0+IHMudHJpbSgpKS5maWx0ZXIocyA9PiBzLmxlbmd0aCA+IDApO1xuICAgIGlmIChwYXJ0cy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgY29uc3QgbG93ZXIgPSBwYXJ0LnRvTG93ZXJDYXNlKCk7XG4gICAgICBjb25zdCBtYXRjaCA9IGZpZWxkLm9wdGlvbnMuZmluZChvcHQgPT4gb3B0Lm5hbWUudHJpbSgpLnRvTG93ZXJDYXNlKCkgPT09IGxvd2VyKTtcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICByZXN1bHQucHVzaChtYXRjaC5pZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQubGVuZ3RoID4gMCA/IHJlc3VsdCA6IG51bGw7XG4gIH0sXG5cbiAgZm9ybWF0KHZhbHVlOiBDZWxsVmFsdWUsIGZpZWxkPzogRmllbGREZWZpbml0aW9uKTogc3RyaW5nIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgIUFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gJyc7XG4gICAgaWYgKCFmaWVsZD8ub3B0aW9ucykgcmV0dXJuICcnO1xuICAgIHJldHVybiB2YWx1ZVxuICAgICAgLm1hcChpZCA9PiB7XG4gICAgICAgIGNvbnN0IG9wdCA9IGZpZWxkLm9wdGlvbnMhLmZpbmQobyA9PiBvLmlkID09PSBpZCk7XG4gICAgICAgIHJldHVybiBvcHQgPyBvcHQubmFtZSA6ICcnO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIocyA9PiBzLmxlbmd0aCA+IDApXG4gICAgICAuam9pbignLCAnKTtcbiAgfSxcblxuICBkZWZhdWx0VmFsdWUoKTogQ2VsbFZhbHVlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbn07XG4iLCAiaW1wb3J0IHR5cGUgeyBDZWxsVmFsdWUgfSBmcm9tICcuLi90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7IEZpZWxkVHlwZSB9IGZyb20gJy4vaW50ZXJmYWNlLmpzJztcblxuLyoqIGF0dGFjaG1lbnQgXHUyMDE0IHZhdWx0LXJlbGF0aXZlIHBhdGggc3RyaW5nICovXG5leHBvcnQgY29uc3QgYXR0YWNobWVudFR5cGU6IEZpZWxkVHlwZSA9IHtcbiAgcmVhZE9ubHk6IGZhbHNlLFxuXG4gIHZhbGlkYXRlKHZhbHVlOiBDZWxsVmFsdWUpOiBib29sZWFuIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xuICB9LFxuXG4gIHBhcnNlKGlucHV0OiBzdHJpbmcpOiBDZWxsVmFsdWUge1xuICAgIGNvbnN0IHRyaW1tZWQgPSBpbnB1dC50cmltKCk7XG4gICAgaWYgKHRyaW1tZWQgPT09ICcnKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gdHJpbW1lZDtcbiAgfSxcblxuICBmb3JtYXQodmFsdWU6IENlbGxWYWx1ZSk6IHN0cmluZyB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gIH0sXG5cbiAgZGVmYXVsdFZhbHVlKCk6IENlbGxWYWx1ZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG59O1xuIiwgImltcG9ydCB0eXBlIHsgQ2VsbFZhbHVlIH0gZnJvbSAnLi4vdHlwZXMuanMnO1xuaW1wb3J0IHR5cGUgeyBGaWVsZFR5cGUgfSBmcm9tICcuL2ludGVyZmFjZS5qcyc7XG5cbi8qKiBhdXRvX251bWJlciBcdTIwMTQgcmVhZC1vbmx5LCBpbnRlZ2VyLCBuZXZlciBudWxsICovXG5leHBvcnQgY29uc3QgYXV0b051bWJlclR5cGU6IEZpZWxkVHlwZSA9IHtcbiAgcmVhZE9ubHk6IHRydWUsXG5cbiAgdmFsaWRhdGUodmFsdWU6IENlbGxWYWx1ZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIE51bWJlci5pc0ludGVnZXIodmFsdWUpICYmIHZhbHVlID49IDA7XG4gIH0sXG5cbiAgcGFyc2UoX2lucHV0OiBzdHJpbmcpOiBDZWxsVmFsdWUge1xuICAgIC8vIFN5c3RlbS1nZW5lcmF0ZWQsIGNhbm5vdCBiZSBwYXJzZWQgZnJvbSB1c2VyIGlucHV0XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgZm9ybWF0KHZhbHVlOiBDZWxsVmFsdWUpOiBzdHJpbmcge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gIH0sXG5cbiAgZGVmYXVsdFZhbHVlKCk6IENlbGxWYWx1ZSB7XG4gICAgcmV0dXJuIDA7XG4gIH0sXG59O1xuXG4vKiogY3JlYXRlZF90aW1lIFx1MjAxNCByZWFkLW9ubHksIElTTyA4NjAxIFVUQywgbmV2ZXIgbnVsbCAqL1xuZXhwb3J0IGNvbnN0IGNyZWF0ZWRUaW1lVHlwZTogRmllbGRUeXBlID0ge1xuICByZWFkT25seTogdHJ1ZSxcblxuICB2YWxpZGF0ZSh2YWx1ZTogQ2VsbFZhbHVlKTogYm9vbGVhbiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gIWlzTmFOKG5ldyBEYXRlKHZhbHVlKS5nZXRUaW1lKCkpO1xuICB9LFxuXG4gIHBhcnNlKF9pbnB1dDogc3RyaW5nKTogQ2VsbFZhbHVlIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICB9LFxuXG4gIGZvcm1hdCh2YWx1ZTogQ2VsbFZhbHVlKTogc3RyaW5nIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykgcmV0dXJuICcnO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfSxcblxuICBkZWZhdWx0VmFsdWUoKTogQ2VsbFZhbHVlIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICB9LFxufTtcblxuLyoqIG1vZGlmaWVkX3RpbWUgXHUyMDE0IHJlYWQtb25seSwgSVNPIDg2MDEgVVRDLCBuZXZlciBudWxsICovXG5leHBvcnQgY29uc3QgbW9kaWZpZWRUaW1lVHlwZTogRmllbGRUeXBlID0ge1xuICByZWFkT25seTogdHJ1ZSxcblxuICB2YWxpZGF0ZSh2YWx1ZTogQ2VsbFZhbHVlKTogYm9vbGVhbiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gIWlzTmFOKG5ldyBEYXRlKHZhbHVlKS5nZXRUaW1lKCkpO1xuICB9LFxuXG4gIHBhcnNlKF9pbnB1dDogc3RyaW5nKTogQ2VsbFZhbHVlIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICB9LFxuXG4gIGZvcm1hdCh2YWx1ZTogQ2VsbFZhbHVlKTogc3RyaW5nIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykgcmV0dXJuICcnO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfSxcblxuICBkZWZhdWx0VmFsdWUoKTogQ2VsbFZhbHVlIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICB9LFxufTtcbiIsICJpbXBvcnQgdHlwZSB7IEZpZWxkVHlwZU5hbWUgfSBmcm9tICcuLi90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7IEZpZWxkVHlwZSB9IGZyb20gJy4vaW50ZXJmYWNlLmpzJztcbmltcG9ydCB7IHRleHRUeXBlLCBsb25nVGV4dFR5cGUgfSBmcm9tICcuL3RleHQuanMnO1xuaW1wb3J0IHsgbnVtYmVyVHlwZSwgY3VycmVuY3lUeXBlLCBwZXJjZW50VHlwZSwgZHVyYXRpb25UeXBlLCByYXRpbmdUeXBlIH0gZnJvbSAnLi9udW1iZXIuanMnO1xuaW1wb3J0IHsgY2hlY2tib3hUeXBlIH0gZnJvbSAnLi9ib29sZWFuLmpzJztcbmltcG9ydCB7IGRhdGVUeXBlLCBkYXRlVGltZVR5cGUgfSBmcm9tICcuL2RhdGUuanMnO1xuaW1wb3J0IHsgdXJsVHlwZSwgZW1haWxUeXBlLCBwaG9uZVR5cGUgfSBmcm9tICcuL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBzaW5nbGVTZWxlY3RUeXBlLCBtdWx0aVNlbGVjdFR5cGUgfSBmcm9tICcuL3NlbGVjdC5qcyc7XG5pbXBvcnQgeyBhdHRhY2htZW50VHlwZSB9IGZyb20gJy4vYXR0YWNobWVudC5qcyc7XG5pbXBvcnQgeyBhdXRvTnVtYmVyVHlwZSwgY3JlYXRlZFRpbWVUeXBlLCBtb2RpZmllZFRpbWVUeXBlIH0gZnJvbSAnLi9zeXN0ZW0uanMnO1xuXG5jb25zdCByZWdpc3RyeSA9IG5ldyBNYXA8RmllbGRUeXBlTmFtZSwgRmllbGRUeXBlPihbXG4gIFsndGV4dCcsIHRleHRUeXBlXSxcbiAgWydsb25nX3RleHQnLCBsb25nVGV4dFR5cGVdLFxuICBbJ251bWJlcicsIG51bWJlclR5cGVdLFxuICBbJ2N1cnJlbmN5JywgY3VycmVuY3lUeXBlXSxcbiAgWydwZXJjZW50JywgcGVyY2VudFR5cGVdLFxuICBbJ2R1cmF0aW9uJywgZHVyYXRpb25UeXBlXSxcbiAgWydyYXRpbmcnLCByYXRpbmdUeXBlXSxcbiAgWydjaGVja2JveCcsIGNoZWNrYm94VHlwZV0sXG4gIFsnZGF0ZScsIGRhdGVUeXBlXSxcbiAgWydkYXRlX3RpbWUnLCBkYXRlVGltZVR5cGVdLFxuICBbJ3VybCcsIHVybFR5cGVdLFxuICBbJ2VtYWlsJywgZW1haWxUeXBlXSxcbiAgWydwaG9uZScsIHBob25lVHlwZV0sXG4gIFsnc2luZ2xlX3NlbGVjdCcsIHNpbmdsZVNlbGVjdFR5cGVdLFxuICBbJ211bHRpX3NlbGVjdCcsIG11bHRpU2VsZWN0VHlwZV0sXG4gIFsnYXR0YWNobWVudCcsIGF0dGFjaG1lbnRUeXBlXSxcbiAgWydhdXRvX251bWJlcicsIGF1dG9OdW1iZXJUeXBlXSxcbiAgWydjcmVhdGVkX3RpbWUnLCBjcmVhdGVkVGltZVR5cGVdLFxuICBbJ21vZGlmaWVkX3RpbWUnLCBtb2RpZmllZFRpbWVUeXBlXSxcbl0pO1xuXG4vKipcbiAqIEdldCB0aGUgRmllbGRUeXBlIGltcGxlbWVudGF0aW9uIGZvciBhIGdpdmVuIHR5cGUgbmFtZS5cbiAqIFRocm93cyBpZiB0aGUgdHlwZSBpcyB1bmtub3duIFx1MjAxNCBuZXZlciByZXR1cm5zIGEgc2lsZW50IGRlZmF1bHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaWVsZFR5cGUobmFtZTogRmllbGRUeXBlTmFtZSk6IEZpZWxkVHlwZSB7XG4gIGNvbnN0IGZ0ID0gcmVnaXN0cnkuZ2V0KG5hbWUpO1xuICBpZiAoIWZ0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGZpZWxkIHR5cGU6IFwiJHtuYW1lfVwiLiBSZWdpc3RlcmVkIHR5cGVzOiAke0FMTF9UWVBFX05BTUVTLmpvaW4oJywgJyl9YCk7XG4gIH1cbiAgcmV0dXJuIGZ0O1xufVxuXG4vKiogVHlwZSBndWFyZDogcmV0dXJucyB0cnVlIGlmIHRoZSBuYW1lIGlzIGEga25vd24gZmllbGQgdHlwZSAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzS25vd25UeXBlKG5hbWU6IHN0cmluZyk6IG5hbWUgaXMgRmllbGRUeXBlTmFtZSB7XG4gIHJldHVybiByZWdpc3RyeS5oYXMobmFtZSBhcyBGaWVsZFR5cGVOYW1lKTtcbn1cblxuLyoqIEFsbCByZWdpc3RlcmVkIHR5cGUgbmFtZXMgKi9cbmV4cG9ydCBjb25zdCBBTExfVFlQRV9OQU1FUzogcmVhZG9ubHkgRmllbGRUeXBlTmFtZVtdID0gW1xuICAndGV4dCcsICdsb25nX3RleHQnLCAnbnVtYmVyJywgJ2N1cnJlbmN5JywgJ3BlcmNlbnQnLFxuICAnZHVyYXRpb24nLCAncmF0aW5nJywgJ2NoZWNrYm94JywgJ2RhdGUnLCAnZGF0ZV90aW1lJyxcbiAgJ3VybCcsICdlbWFpbCcsICdwaG9uZScsXG4gICdzaW5nbGVfc2VsZWN0JywgJ211bHRpX3NlbGVjdCcsICdhdHRhY2htZW50JyxcbiAgJ2F1dG9fbnVtYmVyJywgJ2NyZWF0ZWRfdGltZScsICdtb2RpZmllZF90aW1lJyxcbl07XG5cbi8qKiBOdW1iZXIgb2YgcmVnaXN0ZXJlZCB0eXBlcyAqL1xuZXhwb3J0IGNvbnN0IFRZUEVfQ09VTlQgPSByZWdpc3RyeS5zaXplO1xuIiwgIi8vIFNoYXJlZCB0eXBlIGRlZmluaXRpb25zIGZvciB0aGUgVGFibGlmeSBkYXRhIG1vZGVsLlxuLy8gVGhlc2UgdHlwZXMgY29ycmVzcG9uZCB0byB0aGUgLnRhYmxpZnkgdjEgZm9ybWF0IChGT1JNQVRfU1BFQy5tZCkuXG4vLyBObyBPYnNpZGlhbiBpbXBvcnRzIFx1MjAxNCBwdXJlIGRhdGEgbW9kZWwuXG5cbi8vIC0tLS0gRmllbGQgdHlwZXMgLS0tLVxuXG5leHBvcnQgdHlwZSBGaWVsZFR5cGVOYW1lID1cbiAgfCAndGV4dCcgfCAnbG9uZ190ZXh0JyB8ICdudW1iZXInIHwgJ2N1cnJlbmN5JyB8ICdwZXJjZW50J1xuICB8ICdkdXJhdGlvbicgfCAncmF0aW5nJyB8ICdjaGVja2JveCcgfCAnZGF0ZScgfCAnZGF0ZV90aW1lJ1xuICB8ICd1cmwnIHwgJ2VtYWlsJyB8ICdwaG9uZSdcbiAgfCAnc2luZ2xlX3NlbGVjdCcgfCAnbXVsdGlfc2VsZWN0JyB8ICdhdHRhY2htZW50J1xuICB8ICdhdXRvX251bWJlcicgfCAnY3JlYXRlZF90aW1lJyB8ICdtb2RpZmllZF90aW1lJztcblxuZXhwb3J0IHR5cGUgT3B0aW9uQ29sb3IgPVxuICB8ICdncmF5JyB8ICdicm93bicgfCAnb3JhbmdlJyB8ICd5ZWxsb3cnIHwgJ2dyZWVuJ1xuICB8ICdibHVlJyB8ICdwdXJwbGUnIHwgJ3BpbmsnIHwgJ3JlZCc7XG5cbmV4cG9ydCBjb25zdCBPUFRJT05fQ09MT1JTOiByZWFkb25seSBPcHRpb25Db2xvcltdID0gW1xuICAnZ3JheScsICdicm93bicsICdvcmFuZ2UnLCAneWVsbG93JywgJ2dyZWVuJyxcbiAgJ2JsdWUnLCAncHVycGxlJywgJ3BpbmsnLCAncmVkJyxcbl07XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VsZWN0T3B0aW9uIHtcbiAgaWQ6IHN0cmluZzsgICAgICAgIC8vIHBhdHRlcm46IG9wdF9bQS1aYS16MC05X10rXG4gIG5hbWU6IHN0cmluZztcbiAgY29sb3I6IE9wdGlvbkNvbG9yO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZpZWxkRGVmaW5pdGlvbiB7XG4gIGlkOiBzdHJpbmc7ICAgICAgICAgIC8vIHBhdHRlcm46IGZsZF9bQS1aYS16MC05X10rXG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogRmllbGRUeXBlTmFtZTtcbiAgcHJpbWFyeT86IGJvb2xlYW47XG4gIG9wdGlvbnM/OiBTZWxlY3RPcHRpb25bXTsgICAgLy8gb25seSBmb3Igc2luZ2xlX3NlbGVjdCwgbXVsdGlfc2VsZWN0XG4gIHJlcXVpcmVkPzogYm9vbGVhbjtcbiAgdW5pcXVlPzogYm9vbGVhbjtcbiAgbWluPzogbnVtYmVyIHwgc3RyaW5nIHwgbnVsbDtcbiAgbWF4PzogbnVtYmVyIHwgc3RyaW5nIHwgbnVsbDtcbiAgcmVnZXg/OiBzdHJpbmcgfCBudWxsO1xufVxuXG4vLyAtLS0tIFJvdyB0eXBlcyAtLS0tXG5cbmV4cG9ydCB0eXBlIENlbGxWYWx1ZSA9IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gfCBzdHJpbmdbXSB8IG51bGw7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUm93IHtcbiAgaWQ6IHN0cmluZzsgICAgICAgICAgLy8gcGF0dGVybjogcm93X1tBLVphLXowLTldK1xuICByZXY6IG51bWJlcjtcbiAgY3JlYXRlZEF0Pzogc3RyaW5nOyAgLy8gSVNPIDg2MDFcbiAgdXBkYXRlZEF0OiBzdHJpbmc7ICAgLy8gSVNPIDg2MDFcbiAgdmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBDZWxsVmFsdWU+O1xuICBzeW5jOiBudWxsOyAgICAgICAgICAvLyByZXNlcnZlZCBmb3IgdjEuMVxufVxuXG4vLyAtLS0tIFZpZXcgdHlwZXMgLS0tLVxuXG5leHBvcnQgdHlwZSBTb3J0RGlyZWN0aW9uID0gJ2FzYycgfCAnZGVzYyc7XG5leHBvcnQgdHlwZSBSb3dIZWlnaHQgPSAnc21hbGwnIHwgJ21lZGl1bScgfCAnbGFyZ2UnIHwgJ2NvbXBhY3QnIHwgJ3RhbGwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNvcnRFbnRyeSB7XG4gIGZpZWxkSWQ6IHN0cmluZztcbiAgZGlyZWN0aW9uOiBTb3J0RGlyZWN0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZpZXdEZWZpbml0aW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBzb3J0OiBTb3J0RW50cnlbXTtcbiAgZ3JvdXBCeTogc3RyaW5nIHwgbnVsbDtcbiAgaGlkZGVuOiBzdHJpbmdbXTtcbiAgZnJvemVuQ29sdW1uczogbnVtYmVyO1xuICByb3dIZWlnaHQ6IFJvd0hlaWdodDtcbiAgY29sdW1uV2lkdGhzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+O1xuICBjb2x1bW5PcmRlcjogc3RyaW5nW107XG4gIHdhcm5pbmdzPzogc3RyaW5nW107XG59XG5cbi8vIC0tLS0gVGFibGUgKHRvcC1sZXZlbCkgLS0tLVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYmxpZnlGaWxlIHtcbiAgZm9ybWF0VmVyc2lvbjogMTtcbiAgdGFibGVJZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGZpZWxkczogRmllbGREZWZpbml0aW9uW107XG4gIHJvd3M6IFJvd1tdO1xuICB2aWV3czogVmlld0RlZmluaXRpb25bXTtcbiAgc3luY0xpbms6IG51bGw7XG4gIFt1bmtub3duS2V5OiBzdHJpbmddOiB1bmtub3duO1xufVxuIiwgIi8vIEJ1aWxkIGEgY29tcGxldGUgLnRhYmxpZnkgdGFibGUgaW4gbWVtb3J5IGZyb20gcmF3IHJvd3MgKFA0LTA0LCBTQUQtMzkpLlxuLy8gUHVyZTogbm8gT2JzaWRpYW4sIG5vIGZpbGUgc3lzdGVtLiBPdXRwdXQgaXMgZWl0aGVyIGEgZnVsbHkgdmFsaWRhdGVkLCByb3VuZC10cmlwLWNoZWNrZWRcbi8vIHNlcmlhbGl6ZWQgc3RyaW5nLCBvciBhbiBlcnJvci4gTm90aGluZyBwYXJ0aWFsIGlzIGV2ZXIgcmV0dXJuZWQuXG5cbmltcG9ydCB7IGluZmVyVGFibGUsIGNlbGxLZXksIGRhdGVPbmx5SXNvLCBwYXJzZURhdGVUZXh0LCBpc0VtcHR5Q2VsbCwgdHlwZSBJbnB1dENlbGwsIHR5cGUgSW5mZXJyZWRUeXBlIH0gZnJvbSAnLi4vaW5mZXIuanMnO1xuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VGaWxlIH0gZnJvbSAnLi4vLi4vZm9ybWF0L3BhcnNlLmpzJztcbmltcG9ydCB7IHNlcmlhbGl6ZSBhcyBzZXJpYWxpemVGaWxlIH0gZnJvbSAnLi4vLi4vZm9ybWF0L3NlcmlhbGl6ZS5qcyc7XG5pbXBvcnQgeyB2YWxpZGF0ZVRhYmxlIH0gZnJvbSAnLi4vLi4vbW9kZWwvdmFsaWRhdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRGaWVsZFR5cGUgfSBmcm9tICcuLi8uLi9tb2RlbC9maWVsZFR5cGVzL2luZGV4LmpzJztcbmltcG9ydCB7IGNyZWF0ZURlZmF1bHRWaWV3IH0gZnJvbSAnLi4vLi4vbW9kZWwvdmlldy5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZUZpZWxkSWQsIGdlbmVyYXRlT3B0aW9uSWQsIGdlbmVyYXRlUm93SWQsIGdlbmVyYXRlVGFibGVJZCB9IGZyb20gJy4uLy4uL3V0aWxzL2lkR2VuLmpzJztcbmltcG9ydCB7IE9QVElPTl9DT0xPUlMsIHR5cGUgQ2VsbFZhbHVlLCB0eXBlIEZpZWxkRGVmaW5pdGlvbiwgdHlwZSBGaWVsZFR5cGVOYW1lLCB0eXBlIFJvdywgdHlwZSBTZWxlY3RPcHRpb24sIHR5cGUgVGFibGlmeUZpbGUgfSBmcm9tICcuLi8uLi9tb2RlbC90eXBlcy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW1wb3J0U291cmNlIHtcbiAgLyoqIFRhYmxlIG5hbWUsIHNob3duIGluIHRoZSBmaWxlLiAqL1xuICB0YWJsZU5hbWU6IHN0cmluZztcbiAgLyoqIFJvdy1tYWpvciBjZWxscy4gV2hlbiBoYXNIZWFkZXIgaXMgdHJ1ZSwgcm93c1swXSBpcyB0aGUgaGVhZGVyLiAqL1xuICByb3dzOiByZWFkb25seSAocmVhZG9ubHkgSW5wdXRDZWxsW10pW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRPcHRpb25zIHtcbiAgLyoqIEZpcnN0IHJvdyBpcyB0aGUgaGVhZGVyLiBEZWZhdWx0IHRydWUuICovXG4gIGhhc0hlYWRlcj86IGJvb2xlYW47XG4gIC8qKiBJU08gdGltZXN0YW1wIGZvciBjcmVhdGVkQXQvdXBkYXRlZEF0LiBEZWZhdWx0OiBub3cuICovXG4gIG5vdz86ICgpID0+IHN0cmluZztcbiAgLyoqIFNlcmlhbGl6ZXIuIERlZmF1bHQ6IGZvcm1hdC9zZXJpYWxpemUuIFRlc3QgaG9vayBmb3IgdGhlIGZhaWx1cmUgcGF0aC4gKi9cbiAgc2VyaWFsaXplPzogKGZpbGU6IFRhYmxpZnlGaWxlKSA9PiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29sdW1uUmVwb3J0IHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBGaWVsZFR5cGVOYW1lO1xuICByZWFzb246IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJbXBvcnRSZXBvcnQge1xuICByb3dDb3VudDogbnVtYmVyO1xuICBjb2x1bW5zOiBDb2x1bW5SZXBvcnRbXTtcbn1cblxuZXhwb3J0IHR5cGUgQnVpbGRSZXN1bHQgPVxuICB8IHsgb2s6IHRydWU7IGNvbnRlbnQ6IHN0cmluZzsgZmlsZTogVGFibGlmeUZpbGU7IHJlcG9ydDogSW1wb3J0UmVwb3J0IH1cbiAgfCB7IG9rOiBmYWxzZTsgZXJyb3I6IHN0cmluZyB9O1xuXG5jb25zdCBUWVBFX01BUDogUmVjb3JkPEluZmVycmVkVHlwZSwgRmllbGRUeXBlTmFtZT4gPSB7XG4gIHRleHQ6ICd0ZXh0JyxcbiAgbnVtYmVyOiAnbnVtYmVyJyxcbiAgZGF0ZTogJ2RhdGUnLFxuICBjaGVja2JveDogJ2NoZWNrYm94JyxcbiAgc2luZ2xlX3NlbGVjdDogJ3NpbmdsZV9zZWxlY3QnLFxufTtcblxuLyoqIEZpZWxkIG5hbWVzOiB0cmltbWVkIGhlYWRlcjsgZW1wdHkgXHUyMTkyIFwiQ29sdW1uIE5cIjsgZHVwbGljYXRlcyBcdTIxOTIgXCJOYW1lIDJcIiwgXCJOYW1lIDNcIiwgLi4uICovXG5leHBvcnQgZnVuY3Rpb24gdW5pcXVlRmllbGROYW1lcyhoZWFkZXJzOiByZWFkb25seSBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcbiAgY29uc3QgdXNlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XG4gIGhlYWRlcnMuZm9yRWFjaCgocmF3LCBpKSA9PiB7XG4gICAgY29uc3QgYmFzZSA9IHJhdy50cmltKCkgPT09ICcnID8gYENvbHVtbiAke2kgKyAxfWAgOiByYXcudHJpbSgpO1xuICAgIGxldCBuYW1lID0gYmFzZTtcbiAgICBsZXQgbiA9IDI7XG4gICAgd2hpbGUgKHVzZWQuaGFzKG5hbWUpKSBuYW1lID0gYCR7YmFzZX0gJHtuKyt9YDtcbiAgICB1c2VkLmFkZChuYW1lKTtcbiAgICBvdXQucHVzaChuYW1lKTtcbiAgfSk7XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRDZWxsKHY6IElucHV0Q2VsbCwgZmllbGQ6IEZpZWxkRGVmaW5pdGlvbiwgc2VsZWN0SWRzOiBNYXA8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkKTogQ2VsbFZhbHVlIHtcbiAgaWYgKGlzRW1wdHlDZWxsKHYpKSByZXR1cm4gbnVsbDtcbiAgc3dpdGNoIChmaWVsZC50eXBlKSB7XG4gICAgY2FzZSAnY2hlY2tib3gnOiB7XG4gICAgICBpZiAodHlwZW9mIHYgPT09ICdib29sZWFuJykgcmV0dXJuIHY7XG4gICAgICBpZiAodHlwZW9mIHYgPT09ICdudW1iZXInKSByZXR1cm4gdiA9PT0gMTtcbiAgICAgIGNvbnN0IHQgPSBTdHJpbmcodikudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAodCA9PT0gJ3RydWUnIHx8IHQgPT09ICd5ZXMnIHx8IHQgPT09ICcxJykgcmV0dXJuIHRydWU7XG4gICAgICBpZiAodCA9PT0gJ2ZhbHNlJyB8fCB0ID09PSAnbm8nIHx8IHQgPT09ICcwJykgcmV0dXJuIGZhbHNlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgJ251bWJlcic6IHtcbiAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicpIHJldHVybiB2O1xuICAgICAgY29uc3QgbiA9IE51bWJlcihTdHJpbmcodikudHJpbSgpKTtcbiAgICAgIGlmIChOdW1iZXIuaXNGaW5pdGUobikpIHJldHVybiBuO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgJ2RhdGUnOiB7XG4gICAgICBpZiAodiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgY29uc3QgZGF5ID0gZGF0ZU9ubHlJc28odik7XG4gICAgICAgIGlmIChkYXkgIT09IG51bGwpIHJldHVybiBkYXk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY29uc3QgZCA9IHBhcnNlRGF0ZVRleHQoU3RyaW5nKHYpKTtcbiAgICAgIGlmIChkICE9PSBudWxsKSByZXR1cm4gZDtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlICdzaW5nbGVfc2VsZWN0Jzoge1xuICAgICAgY29uc3QgaWQgPSBzZWxlY3RJZHM/LmdldChjZWxsS2V5KHYpKTtcbiAgICAgIGlmIChpZCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gaWQ7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSAndGV4dCc6XG4gICAgICBpZiAodiBpbnN0YW5jZW9mIERhdGUpIHJldHVybiB2LnRvSVNPU3RyaW5nKCk7XG4gICAgICByZXR1cm4gU3RyaW5nKHYpO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihgdmFsdWUgXCIke2NlbGxLZXkodil9XCIgZG9lcyBub3QgY29udmVydCB0byAke2ZpZWxkLnR5cGV9YCk7XG59XG5cbi8qKlxuICogQnVpbGQgYSB2YWxpZGF0ZWQsIHNlcmlhbGl6YWJsZSB0YWJsZS4gUmV0dXJucyBhbiBlcnJvciAoYW5kIG5vIGNvbnRlbnQpIG9uIGFueSBmYWlsdXJlLlxuICogU3RyaWN0IGluZmVyZW5jZSBtZWFucyBldmVyeSBub24tZW1wdHkgdmFsdWUgb2YgYSB0eXBlZCBjb2x1bW4gY29udmVydHM7IGFueSBtaXNtYXRjaCBpcyBhbiBlcnJvci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkVGFibGUoc291cmNlOiBJbXBvcnRTb3VyY2UsIG9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHt9KTogQnVpbGRSZXN1bHQge1xuICB0cnkge1xuICAgIHJldHVybiBidWlsZFVuY2hlY2tlZChzb3VyY2UsIG9wdGlvbnMpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogYEltcG9ydCBmYWlsZWQ6ICR7ZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpfWAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBidWlsZFVuY2hlY2tlZChzb3VyY2U6IEltcG9ydFNvdXJjZSwgb3B0aW9uczogQnVpbGRPcHRpb25zKTogQnVpbGRSZXN1bHQge1xuICBjb25zdCBoYXNIZWFkZXIgPSBvcHRpb25zLmhhc0hlYWRlciA/PyB0cnVlO1xuICBjb25zdCBub3cgPSBvcHRpb25zLm5vdyA/PyAoKCkgPT4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpKTtcbiAgY29uc3Qgc2VyaWFsaXplID0gb3B0aW9ucy5zZXJpYWxpemUgPz8gc2VyaWFsaXplRmlsZTtcblxuICBpZiAoc291cmNlLnJvd3MubGVuZ3RoID09PSAwIHx8IChoYXNIZWFkZXIgJiYgc291cmNlLnJvd3MubGVuZ3RoID09PSAxICYmIHNvdXJjZS5yb3dzWzBdLmxlbmd0aCA9PT0gMCkpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiAnVGhlIGZpbGUgaGFzIG5vIHJvd3MgdG8gaW1wb3J0LicgfTtcbiAgfVxuXG4gIGNvbnN0IGhlYWRlclJvdzogcmVhZG9ubHkgSW5wdXRDZWxsW10gPSBoYXNIZWFkZXIgPyBzb3VyY2Uucm93c1swXSA6IFtdO1xuICBjb25zdCBkYXRhID0gaGFzSGVhZGVyID8gc291cmNlLnJvd3Muc2xpY2UoMSkgOiBzb3VyY2Uucm93cztcbiAgbGV0IGNvbHVtbkNvdW50ID0gaGVhZGVyUm93Lmxlbmd0aDtcbiAgZm9yIChjb25zdCByIG9mIGRhdGEpIGNvbHVtbkNvdW50ID0gTWF0aC5tYXgoY29sdW1uQ291bnQsIHIubGVuZ3RoKTtcbiAgaWYgKGNvbHVtbkNvdW50ID09PSAwKSByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiAnVGhlIGZpbGUgaGFzIG5vIGNvbHVtbnMuJyB9O1xuXG4gIGNvbnN0IGhlYWRlcnMgPSBBcnJheS5mcm9tKHsgbGVuZ3RoOiBjb2x1bW5Db3VudCB9LCAoXywgaSkgPT4ge1xuICAgIGNvbnN0IGggPSBoZWFkZXJSb3dbaV07XG4gICAgcmV0dXJuIGggPT09IHVuZGVmaW5lZCB8fCBoID09PSBudWxsID8gJycgOiBTdHJpbmcoaCk7XG4gIH0pO1xuICBjb25zdCBuYW1lcyA9IHVuaXF1ZUZpZWxkTmFtZXMoaGVhZGVycyk7XG4gIGNvbnN0IGluZmVyZW5jZXMgPSBpbmZlclRhYmxlKGRhdGEsIGNvbHVtbkNvdW50KTtcblxuICBjb25zdCBmaWVsZHM6IEZpZWxkRGVmaW5pdGlvbltdID0gW107XG4gIGNvbnN0IHNlbGVjdE1hcHM6IChNYXA8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkKVtdID0gW107XG4gIGNvbnN0IGNvbHVtbnM6IENvbHVtblJlcG9ydFtdID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb2x1bW5Db3VudDsgaSsrKSB7XG4gICAgY29uc3QgaW5mID0gaW5mZXJlbmNlc1tpXTtcbiAgICBjb25zdCB0eXBlID0gVFlQRV9NQVBbaW5mLnR5cGVdO1xuICAgIGNvbnN0IGZpZWxkOiBGaWVsZERlZmluaXRpb24gPSB7IGlkOiBnZW5lcmF0ZUZpZWxkSWQoKSwgbmFtZTogbmFtZXNbaV0sIHR5cGUgfTtcbiAgICBpZiAoaSA9PT0gMCkgZmllbGQucHJpbWFyeSA9IHRydWU7XG4gICAgaWYgKHR5cGUgPT09ICdzaW5nbGVfc2VsZWN0Jykge1xuICAgICAgY29uc3Qgb3B0czogU2VsZWN0T3B0aW9uW10gPSAoaW5mLnNlbGVjdE9wdGlvbnMgPz8gW10pLm1hcCgobmFtZSwgaykgPT4gKHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlT3B0aW9uSWQoKSxcbiAgICAgICAgbmFtZSxcbiAgICAgICAgY29sb3I6IE9QVElPTl9DT0xPUlNbayAlIE9QVElPTl9DT0xPUlMubGVuZ3RoXSxcbiAgICAgIH0pKTtcbiAgICAgIGZpZWxkLm9wdGlvbnMgPSBvcHRzO1xuICAgICAgc2VsZWN0TWFwcy5wdXNoKG5ldyBNYXAob3B0cy5tYXAoKG8pID0+IFtvLm5hbWUsIG8uaWRdKSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxlY3RNYXBzLnB1c2godW5kZWZpbmVkKTtcbiAgICB9XG4gICAgZmllbGRzLnB1c2goZmllbGQpO1xuICAgIGNvbHVtbnMucHVzaCh7IG5hbWU6IGZpZWxkLm5hbWUsIHR5cGUsIHJlYXNvbjogaW5mLnJlYXNvbiB9KTtcbiAgfVxuXG4gIGNvbnN0IHN0YW1wID0gbm93KCk7XG4gIGNvbnN0IHJvd3M6IFJvd1tdID0gbmV3IEFycmF5PFJvdz4oZGF0YS5sZW5ndGgpO1xuICBmb3IgKGxldCByID0gMDsgciA8IGRhdGEubGVuZ3RoOyByKyspIHtcbiAgICBjb25zdCBzcmMgPSBkYXRhW3JdO1xuICAgIGNvbnN0IHZhbHVlczogUmVjb3JkPHN0cmluZywgQ2VsbFZhbHVlPiA9IHt9O1xuICAgIGZvciAobGV0IGMgPSAwOyBjIDwgZmllbGRzLmxlbmd0aDsgYysrKSB7XG4gICAgICB2YWx1ZXNbZmllbGRzW2NdLmlkXSA9IGNvbnZlcnRDZWxsKHNyY1tjXSwgZmllbGRzW2NdLCBzZWxlY3RNYXBzW2NdKTtcbiAgICB9XG4gICAgcm93c1tyXSA9IHsgaWQ6IGdlbmVyYXRlUm93SWQoKSwgcmV2OiAxLCBjcmVhdGVkQXQ6IHN0YW1wLCB1cGRhdGVkQXQ6IHN0YW1wLCB2YWx1ZXMsIHN5bmM6IG51bGwgfTtcbiAgfVxuXG4gIGNvbnN0IGZpbGU6IFRhYmxpZnlGaWxlID0ge1xuICAgIGZvcm1hdFZlcnNpb246IDEsXG4gICAgdGFibGVJZDogZ2VuZXJhdGVUYWJsZUlkKCksXG4gICAgbmFtZTogc291cmNlLnRhYmxlTmFtZSxcbiAgICBmaWVsZHMsXG4gICAgcm93cyxcbiAgICB2aWV3czogW2NyZWF0ZURlZmF1bHRWaWV3KGZpZWxkcyldLFxuICAgIHN5bmNMaW5rOiBudWxsLFxuICB9O1xuXG4gIC8vIFZhbGlkYXRlIGJlZm9yZSBzZXJpYWxpemluZy4gUnVsZXMgKHJlcXVpcmVkL3VuaXF1ZS9taW4vbWF4L3JlZ2V4KSBhbmQgcGVyLXR5cGUgY2hlY2tzLlxuICBjb25zdCB2aW9sYXRpb25zID0gdmFsaWRhdGVUYWJsZShmaWVsZHMsIHJvd3MpO1xuICBpZiAodmlvbGF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogYFZhbGlkYXRpb24gZmFpbGVkOiAke3Zpb2xhdGlvbnMubGVuZ3RofSB2aW9sYXRpb24ocyksIGZpcnN0OiAke3Zpb2xhdGlvbnNbMF0ubWVzc2FnZX1gIH07XG4gIH1cbiAgZm9yIChjb25zdCBmaWVsZCBvZiBmaWVsZHMpIHtcbiAgICBjb25zdCBmdCA9IGdldEZpZWxkVHlwZShmaWVsZC50eXBlKTtcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzKSB7XG4gICAgICBpZiAoIWZ0LnZhbGlkYXRlKHJvdy52YWx1ZXNbZmllbGQuaWRdID8/IG51bGwsIGZpZWxkKSkge1xuICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBgVmFsaWRhdGlvbiBmYWlsZWQ6IHZhbHVlIGluIGNvbHVtbiBcIiR7ZmllbGQubmFtZX1cIiBpcyBub3QgYSB2YWxpZCAke2ZpZWxkLnR5cGV9YCB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGNvbnRlbnQgPSBzZXJpYWxpemUoZmlsZSk7XG5cbiAgLy8gUm91bmQtdHJpcCBjaGVjazogd2hhdCB3ZSB3cml0ZSBtdXN0IHBhcnNlIGJhY2sgdG8gdGhlIHNhbWUgZGF0YS5cbiAgY29uc3QgcGFyc2VkID0gcGFyc2VGaWxlKGNvbnRlbnQpO1xuICBpZiAoIXBhcnNlZC5vaykgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogYFJvdW5kLXRyaXAgcGFyc2UgZmFpbGVkOiAke3BhcnNlZC5lcnJvcn1gIH07XG4gIGlmIChwYXJzZWQuZGF0YS5yb3dzLmxlbmd0aCAhPT0gcm93cy5sZW5ndGgpIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICdSb3VuZC10cmlwIHJvdyBjb3VudCBtaXNtYXRjaCcgfTtcbiAgZm9yIChsZXQgciA9IDA7IHIgPCByb3dzLmxlbmd0aDsgcisrKSB7XG4gICAgaWYgKEpTT04uc3RyaW5naWZ5KHBhcnNlZC5kYXRhLnJvd3Nbcl0udmFsdWVzKSAhPT0gSlNPTi5zdHJpbmdpZnkocm93c1tyXS52YWx1ZXMpKSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBgUm91bmQtdHJpcCB2YWx1ZSBtaXNtYXRjaCBhdCByb3cgJHtyICsgMX1gIH07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUsIGNvbnRlbnQsIGZpbGUsIHJlcG9ydDogeyByb3dDb3VudDogcm93cy5sZW5ndGgsIGNvbHVtbnMgfSB9O1xufVxuIiwgIi8vIEltcG9ydCBvcmNoZXN0cmF0aW9uIChQNC0wNCwgU0FELTM5KTogcmVhZCBzb3VyY2UgXHUyMTkyIGJ1aWxkIGluIG1lbW9yeSBcdTIxOTIgdmFsaWRhdGUgXHUyMTkyIHNlcmlhbGl6ZSBcdTIxOTIgd3JpdGUgb25jZS5cbi8vIFRoZSB3cml0ZSBoYXBwZW5zIG9ubHkgYWZ0ZXIgYSBmdWxsIHN1Y2Nlc3NmdWwgYnVpbGQuIFRoZSB0YXJnZXQgbmFtZSBuZXZlciBvdmVyd3JpdGVzIGFuIGV4aXN0aW5nIGZpbGUuXG5cbmltcG9ydCB7IHBhcnNlQ3N2IH0gZnJvbSAnLi4vY3N2LmpzJztcbmltcG9ydCB7IHJlYWRYbHN4U2hlZXRzIH0gZnJvbSAnLi94bHN4LmpzJztcbmltcG9ydCB7IGJ1aWxkVGFibGUsIHR5cGUgQnVpbGRPcHRpb25zLCB0eXBlIEltcG9ydFJlcG9ydCB9IGZyb20gJy4vYnVpbGQuanMnO1xuaW1wb3J0IHR5cGUgeyBJbnB1dENlbGwgfSBmcm9tICcuLi9pbmZlci5qcyc7XG5cbmV4cG9ydCB0eXBlIEltcG9ydEtpbmQgPSAnY3N2JyB8ICd4bHN4JztcblxuLyoqIFRoZSBvbmx5IHZhdWx0IG9wZXJhdGlvbnMgdGhlIGltcG9ydGVyIG5lZWRzLiBjcmVhdGUoKSBtdXN0IGZhaWwgaWYgdGhlIHBhdGggZXhpc3RzLiAqL1xuZXhwb3J0IGludGVyZmFjZSBJbXBvcnRBZGFwdGVyIHtcbiAgZXhpc3RzKHBhdGg6IHN0cmluZyk6IGJvb2xlYW47XG4gIGNyZWF0ZShwYXRoOiBzdHJpbmcsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW1wb3J0SW5wdXQge1xuICBraW5kOiBJbXBvcnRLaW5kO1xuICAvKiogT3JpZ2luYWwgZmlsZSBuYW1lLCBlLmcuIFwiVGFza3MuY3N2XCIuIEV4dGVuc2lvbiBpcyBzdHJpcHBlZC4gKi9cbiAgZmlsZU5hbWU6IHN0cmluZztcbiAgLyoqIENTVjogdGV4dC4gWExTWDogcmF3IGJ5dGVzLiAqL1xuICBkYXRhOiBzdHJpbmcgfCBBcnJheUJ1ZmZlcjtcbiAgLyoqIFRhcmdldCBmb2xkZXIsIHZhdWx0LXJlbGF0aXZlLiBcIlwiIGZvciB0aGUgdmF1bHQgcm9vdC4gKi9cbiAgZm9sZGVyOiBzdHJpbmc7XG4gIGFkYXB0ZXI6IEltcG9ydEFkYXB0ZXI7XG4gIGJ1aWxkPzogQnVpbGRPcHRpb25zO1xufVxuXG5leHBvcnQgdHlwZSBJbXBvcnRPdXRjb21lID1cbiAgfCB7IG9rOiB0cnVlOyBwYXRoOiBzdHJpbmc7IHJlcG9ydDogSW1wb3J0UmVwb3J0OyBpZ25vcmVkU2hlZXRzOiBudW1iZXI7IHNoZWV0TmFtZT86IHN0cmluZyB9XG4gIHwgeyBvazogZmFsc2U7IGVycm9yOiBzdHJpbmcgfTtcblxuY29uc3QgTUFYX05BTUVfQVRURU1QVFMgPSAxMF8wMDA7XG5cbi8qKiBNYWtlIGEgbmFtZSBzYWZlIGZvciBhbiBPYnNpZGlhbiBmaWxlIG5hbWUuICovXG5leHBvcnQgZnVuY3Rpb24gYmFzZU5hbWVGcm9tKGZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBzdHJpcHBlZCA9IGZpbGVOYW1lLnJlcGxhY2UoL1xcLihjc3Z8eGxzeCkkL2ksICcnKTtcbiAgY29uc3Qgc2FmZSA9IHN0cmlwcGVkLnJlcGxhY2UoL1tcXFxcLzoqP1wiPD58I15bXFxdXS9nLCAnLScpLnRyaW0oKTtcbiAgcmV0dXJuIHNhZmUgPT09ICcnID8gJ0ltcG9ydGVkIHRhYmxlJyA6IHNhZmU7XG59XG5cbi8qKiBOYW1lIGZvciB0aGUgTnRoIGF0dGVtcHQ6IFwiVGFza3MudGFibGlmeVwiLCBcIlRhc2tzIDIudGFibGlmeVwiLCBcIlRhc2tzIDMudGFibGlmeVwiLCAuLi4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjYW5kaWRhdGVQYXRoKGZvbGRlcjogc3RyaW5nLCBiYXNlOiBzdHJpbmcsIG46IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IG5hbWUgPSBuID09PSAxID8gYCR7YmFzZX0udGFibGlmeWAgOiBgJHtiYXNlfSAke259LnRhYmxpZnlgO1xuICByZXR1cm4gZm9sZGVyID09PSAnJyA/IG5hbWUgOiBgJHtmb2xkZXJ9LyR7bmFtZX1gO1xufVxuXG4vKiogRmlyc3QgY2FuZGlkYXRlIHBhdGggdGhhdCBkb2VzIG5vdCBleGlzdC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaWNrRnJlZVBhdGgoZm9sZGVyOiBzdHJpbmcsIGJhc2U6IHN0cmluZywgZXhpc3RzOiAocDogc3RyaW5nKSA9PiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XG4gIGZvciAobGV0IG4gPSAxOyBuIDw9IE1BWF9OQU1FX0FUVEVNUFRTOyBuKyspIHtcbiAgICBjb25zdCBwID0gY2FuZGlkYXRlUGF0aChmb2xkZXIsIGJhc2UsIG4pO1xuICAgIGlmICghZXhpc3RzKHApKSByZXR1cm4gcDtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGltcG9ydFRhYmxlKGlucHV0OiBJbXBvcnRJbnB1dCk6IFByb21pc2U8SW1wb3J0T3V0Y29tZT4ge1xuICBjb25zdCB0YWJsZU5hbWUgPSBiYXNlTmFtZUZyb20oaW5wdXQuZmlsZU5hbWUpO1xuXG4gIGxldCByb3dzOiBJbnB1dENlbGxbXVtdO1xuICBsZXQgaWdub3JlZFNoZWV0cyA9IDA7XG4gIGxldCBzaGVldE5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICBpZiAoaW5wdXQua2luZCA9PT0gJ2NzdicpIHtcbiAgICBpZiAodHlwZW9mIGlucHV0LmRhdGEgIT09ICdzdHJpbmcnKSByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiAnQ1NWIGltcG9ydCBuZWVkcyB0ZXh0LicgfTtcbiAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUNzdihpbnB1dC5kYXRhKTtcbiAgICBpZiAoIXBhcnNlZC5vaykgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogYENTViBlcnJvciBhdCBsaW5lICR7cGFyc2VkLmxpbmV9LCBjb2x1bW4gJHtwYXJzZWQuY29sdW1ufTogJHtwYXJzZWQuZXJyb3J9YCB9O1xuICAgIHJvd3MgPSBwYXJzZWQucm93cztcbiAgfSBlbHNlIHtcbiAgICBpZiAodHlwZW9mIGlucHV0LmRhdGEgPT09ICdzdHJpbmcnKSByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiAnWExTWCBpbXBvcnQgbmVlZHMgYnl0ZXMuJyB9O1xuICAgIGxldCBzaGVldHM7XG4gICAgdHJ5IHtcbiAgICAgIHNoZWV0cyA9IGF3YWl0IHJlYWRYbHN4U2hlZXRzKGlucHV0LmRhdGEpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGBDb3VsZCBub3QgcmVhZCB0aGUgRXhjZWwgZmlsZTogJHtlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSl9YCB9O1xuICAgIH1cbiAgICBpZiAoc2hlZXRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ1RoZSBFeGNlbCBmaWxlIGhhcyBubyBzaGVldHMuJyB9O1xuICAgIHJvd3MgPSBzaGVldHNbMF0ucm93cztcbiAgICBzaGVldE5hbWUgPSBzaGVldHNbMF0ubmFtZTtcbiAgICBpZ25vcmVkU2hlZXRzID0gc2hlZXRzLmxlbmd0aCAtIDE7XG4gIH1cblxuICBjb25zdCBidWlsdCA9IGJ1aWxkVGFibGUoeyB0YWJsZU5hbWUsIHJvd3MgfSwgaW5wdXQuYnVpbGQpO1xuICBpZiAoIWJ1aWx0Lm9rKSByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiBidWlsdC5lcnJvciB9O1xuXG4gIC8vIFdyaXRlIG9uY2UsIGFmdGVyIHRoZSBmdWxsIGJ1aWxkIHN1Y2NlZWRlZC4gY3JlYXRlKCkgbXVzdCBmYWlsIG9uIGV4aXN0aW5nIHBhdGhzLCBzbyBubyBvdmVyd3JpdGUuXG4gIGNvbnN0IGJhc2UgPSB0YWJsZU5hbWU7XG4gIGZvciAobGV0IGF0dGVtcHQgPSAwOyBhdHRlbXB0IDwgMjA7IGF0dGVtcHQrKykge1xuICAgIGNvbnN0IHBhdGggPSBwaWNrRnJlZVBhdGgoaW5wdXQuZm9sZGVyLCBiYXNlLCBpbnB1dC5hZGFwdGVyLmV4aXN0cyk7XG4gICAgaWYgKHBhdGggPT09IG51bGwpIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICdObyBmcmVlIGZpbGUgbmFtZSBmb3VuZC4nIH07XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGlucHV0LmFkYXB0ZXIuY3JlYXRlKHBhdGgsIGJ1aWx0LmNvbnRlbnQpO1xuICAgICAgcmV0dXJuIHsgb2s6IHRydWUsIHBhdGgsIHJlcG9ydDogYnVpbHQucmVwb3J0LCBpZ25vcmVkU2hlZXRzLCBzaGVldE5hbWUgfTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoIWlucHV0LmFkYXB0ZXIuZXhpc3RzKHBhdGgpKSB7XG4gICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IGBDb3VsZCBub3Qgd3JpdGUgdGhlIGZpbGU6ICR7ZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpfWAgfTtcbiAgICAgIH1cbiAgICAgIC8vIFNvbWVvbmUgY3JlYXRlZCB0aGUgcGF0aCBiZXR3ZWVuIG91ciBjaGVjayBhbmQgdGhlIHdyaXRlLiBUcnkgdGhlIG5leHQgbmFtZS5cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ0NvdWxkIG5vdCBmaW5kIGEgZnJlZSBmaWxlIG5hbWUuJyB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBQXVCOzs7QUNJdkIsc0JBQXVFOzs7QUNrQ2hFLElBQU0saUJBQWlCLEtBQUs7QUFRNUIsSUFBTSxrQkFBTixNQUFzQjtBQUFBLEVBQ1Y7QUFBQSxFQUNUO0FBQUEsRUFDQSxTQUFTO0FBQUEsRUFDVCxVQUFVO0FBQUE7QUFBQSxFQUdWLE9BQU87QUFBQSxFQUNQLGNBQWM7QUFBQSxFQUNkLGNBQWM7QUFBQSxFQUNkLFdBQVc7QUFBQSxFQUNYLGFBQWE7QUFBQSxFQUNiLFlBQVk7QUFBQTtBQUFBLEVBR1osUUFBZTtBQUFBLEVBQ2YsTUFBZ0IsQ0FBQztBQUFBLEVBQ2pCLFFBQVE7QUFBQSxFQUNSLFNBQVM7QUFBQSxFQUNULE9BQU87QUFBQSxFQUNQLFNBQVM7QUFBQSxFQUNULFdBQVc7QUFBQSxFQUNYLFVBQWtFO0FBQUEsRUFFMUUsWUFBWSxTQUEyQjtBQUNyQyxTQUFLLFFBQVEsUUFBUTtBQUNyQixTQUFLLFlBQVksUUFBUSxhQUFhO0FBQUEsRUFDeEM7QUFBQSxFQUVBLEtBQUssT0FBcUI7QUFDeEIsUUFBSSxLQUFLLFdBQVcsTUFBTSxXQUFXO0FBQUc7QUFDeEMsUUFBSSxDQUFDLEtBQUssU0FBUztBQUNqQixXQUFLLFVBQVU7QUFDZixVQUFJLE1BQU0sV0FBVyxDQUFDLE1BQU0sT0FBUTtBQUNsQyxhQUFLLFNBQVM7QUFDZCxnQkFBUSxNQUFNLE1BQU0sQ0FBQztBQUFBLE1BQ3ZCO0FBQUEsSUFDRjtBQUNBLFFBQUksS0FBSyxjQUFjLE1BQU07QUFDM0IsV0FBSyxRQUFRO0FBQ2IsV0FBSyxTQUFTO0FBQ2QsVUFBSSxDQUFDLEtBQUs7QUFBVTtBQUNwQixXQUFLLFlBQVksS0FBSyxnQkFBZ0I7QUFFdEMsWUFBTSxXQUFXLEtBQUs7QUFDdEIsV0FBSyxPQUFPO0FBQ1osV0FBSyxLQUFLLFFBQVE7QUFDbEI7QUFBQSxJQUNGO0FBQ0EsU0FBSyxLQUFLLEtBQUs7QUFBQSxFQUNqQjtBQUFBLEVBRUEsTUFBdUI7QUFDckIsUUFBSSxLQUFLO0FBQVMsYUFBTyxLQUFLLGNBQWM7QUFDNUMsUUFBSSxLQUFLLGNBQWMsTUFBTTtBQUUzQixXQUFLLFlBQVksS0FBSyxnQkFBZ0I7QUFDdEMsWUFBTSxXQUFXLEtBQUs7QUFDdEIsV0FBSyxPQUFPO0FBQ1osV0FBSyxLQUFLLFFBQVE7QUFDbEIsVUFBSSxLQUFLO0FBQVMsZUFBTyxLQUFLLGNBQWM7QUFBQSxJQUM5QztBQUNBLFFBQUksS0FBSyxVQUFVLFVBQVU7QUFDM0IsYUFBTyxLQUFLLEtBQUssMkNBQTJDO0FBQUEsSUFDOUQ7QUFDQSxRQUFJLEtBQUssVUFBVSxnQkFBZ0IsS0FBSyxJQUFJLFNBQVMsS0FBSyxLQUFLLE1BQU0sU0FBUyxLQUFLLEtBQUssVUFBVSxlQUFlO0FBQy9HLFdBQUssVUFBVTtBQUNmLFdBQUssUUFBUTtBQUFBLElBQ2Y7QUFDQSxXQUFPLEVBQUUsSUFBSSxNQUFNLFdBQVcsS0FBSyxXQUFXLFFBQVEsS0FBSyxRQUFRLFVBQVUsS0FBSyxTQUFTO0FBQUEsRUFDN0Y7QUFBQTtBQUFBO0FBQUEsRUFLUSxXQUFpQjtBQUN2QixVQUFNLElBQUksS0FBSztBQUNmLFFBQUksSUFBSSxLQUFLO0FBQ2IsV0FBTyxJQUFJLEVBQUUsUUFBUTtBQUNuQixZQUFNLElBQUksRUFBRSxXQUFXLENBQUM7QUFDeEIsVUFBSSxNQUFNLElBQU07QUFDZCxhQUFLLGNBQWMsQ0FBQyxLQUFLO0FBQUEsTUFDM0IsV0FBVyxDQUFDLEtBQUssYUFBYTtBQUM1QixZQUFJLE1BQU0sTUFBUSxNQUFNLElBQU07QUFDNUIsZUFBSyxXQUFXO0FBQ2hCO0FBQUEsUUFDRjtBQUNBLFlBQUksTUFBTTtBQUFNLGVBQUs7QUFBQSxpQkFDWixNQUFNO0FBQU0sZUFBSztBQUFBLE1BQzVCO0FBQ0E7QUFBQSxJQUNGO0FBQ0EsU0FBSyxjQUFjO0FBQUEsRUFDckI7QUFBQSxFQUVRLGtCQUFnQztBQUN0QyxXQUFPLEtBQUssWUFBWSxLQUFLLGFBQWEsTUFBTTtBQUFBLEVBQ2xEO0FBQUE7QUFBQSxFQUlRLEtBQUssTUFBb0I7QUFDL0IsVUFBTSxRQUFRLEtBQUs7QUFDbkIsVUFBTSxZQUFZLE1BQU0sV0FBVyxDQUFDO0FBQ3BDLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxRQUFRLEtBQUs7QUFDcEMsWUFBTSxJQUFJLEtBQUssV0FBVyxDQUFDO0FBRTNCLFVBQUksS0FBSyxRQUFRO0FBQ2YsYUFBSyxTQUFTO0FBQ2QsWUFBSSxNQUFNLElBQU07QUFDZCxlQUFLLFFBQVEsQ0FBQztBQUNkO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFFQSxjQUFRLEtBQUssT0FBTztBQUFBLFFBQ2xCLEtBQUs7QUFDSCxjQUFJLE1BQU0sSUFBTTtBQUNkLGlCQUFLLFFBQVE7QUFBQSxVQUNmLFdBQVcsTUFBTSxXQUFXO0FBQzFCLGlCQUFLLFVBQVU7QUFBQSxVQUNqQixXQUFXLE1BQU0sTUFBUSxNQUFNLElBQU07QUFDbkMsaUJBQUssVUFBVSxDQUFDO0FBQUEsVUFDbEIsT0FBTztBQUNMLGlCQUFLLFFBQVEsS0FBSyxDQUFDO0FBQ25CLGlCQUFLLFFBQVE7QUFBQSxVQUNmO0FBQ0E7QUFBQSxRQUVGLEtBQUs7QUFDSCxjQUFJLE1BQU0sV0FBVztBQUNuQixpQkFBSyxVQUFVO0FBQ2YsaUJBQUssUUFBUTtBQUFBLFVBQ2YsV0FBVyxNQUFNLE1BQVEsTUFBTSxJQUFNO0FBQ25DLGlCQUFLLFVBQVUsQ0FBQztBQUNoQixpQkFBSyxRQUFRO0FBQUEsVUFDZixPQUFPO0FBQ0wsaUJBQUssU0FBUyxLQUFLLENBQUM7QUFBQSxVQUN0QjtBQUNBO0FBQUEsUUFFRixLQUFLO0FBQ0gsY0FBSSxNQUFNLElBQU07QUFDZCxpQkFBSyxRQUFRO0FBQUEsVUFDZixPQUFPO0FBQ0wsaUJBQUssU0FBUyxLQUFLLENBQUM7QUFBQSxVQUN0QjtBQUNBO0FBQUEsUUFFRixLQUFLO0FBQ0gsY0FBSSxNQUFNLElBQU07QUFDZCxpQkFBSyxTQUFTO0FBQ2QsaUJBQUssUUFBUTtBQUFBLFVBQ2YsV0FBVyxNQUFNLFdBQVc7QUFDMUIsaUJBQUssVUFBVTtBQUNmLGlCQUFLLFFBQVE7QUFBQSxVQUNmLFdBQVcsTUFBTSxNQUFRLE1BQU0sSUFBTTtBQUNuQyxpQkFBSyxVQUFVLENBQUM7QUFDaEIsaUJBQUssUUFBUTtBQUFBLFVBQ2YsT0FBTztBQUNMLGlCQUFLLEtBQUssOENBQThDLEtBQUssQ0FBQyxDQUFDLEdBQUc7QUFDbEU7QUFBQSxVQUNGO0FBQ0E7QUFBQSxNQUNKO0FBQ0EsV0FBSyxRQUFRLENBQUM7QUFDZCxVQUFJLEtBQUs7QUFBUztBQUFBLElBQ3BCO0FBQUEsRUFDRjtBQUFBLEVBRVEsUUFBUSxHQUFpQjtBQUMvQixRQUFJLE1BQU0sTUFBUSxNQUFNLElBQU07QUFDNUIsV0FBSztBQUNMLFdBQUssU0FBUztBQUFBLElBQ2hCLE9BQU87QUFDTCxXQUFLO0FBQUEsSUFDUDtBQUFBLEVBQ0Y7QUFBQSxFQUVRLFlBQWtCO0FBQ3hCLFNBQUssSUFBSSxLQUFLLEtBQUssS0FBSztBQUN4QixTQUFLLFFBQVE7QUFBQSxFQUNmO0FBQUEsRUFFUSxVQUFVLEdBQWlCO0FBQ2pDLFNBQUssVUFBVTtBQUNmLFNBQUssUUFBUTtBQUNiLFFBQUksTUFBTTtBQUFNLFdBQUssU0FBUztBQUFBLEVBQ2hDO0FBQUEsRUFFUSxVQUFnQjtBQUN0QixVQUFNLE1BQU0sS0FBSztBQUNqQixTQUFLLE1BQU0sQ0FBQztBQUNaLFNBQUs7QUFDTCxTQUFLLE1BQU0sR0FBRztBQUFBLEVBQ2hCO0FBQUEsRUFFUSxLQUFLLE9BQWdDO0FBQzNDLFNBQUssVUFBVSxFQUFFLE9BQU8sTUFBTSxLQUFLLE1BQU0sUUFBUSxLQUFLLE9BQU87QUFDN0QsV0FBTyxLQUFLLGNBQWM7QUFBQSxFQUM1QjtBQUFBLEVBRVEsZ0JBQWlDO0FBQ3ZDLFVBQU0sSUFBSSxLQUFLO0FBQ2YsV0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLEVBQUUsT0FBTyxNQUFNLEVBQUUsTUFBTSxRQUFRLEVBQUUsUUFBUSxVQUFVLEtBQUssU0FBUztBQUFBLEVBQzlGO0FBQ0Y7QUFNTyxTQUFTLFNBQVMsT0FBZSxVQUEyQixDQUFDLEdBQW1CO0FBQ3JGLFFBQU0sT0FBbUIsQ0FBQztBQUMxQixRQUFNLFNBQVMsSUFBSSxnQkFBZ0IsRUFBRSxHQUFHLFNBQVMsT0FBTyxDQUFDLE1BQU0sS0FBSyxLQUFLLENBQUMsRUFBRSxDQUFDO0FBQzdFLFdBQVMsTUFBTSxHQUFHLE1BQU0sTUFBTSxRQUFRLE9BQU8sZ0JBQWdCO0FBQzNELFdBQU8sS0FBSyxNQUFNLE1BQU0sS0FBSyxNQUFNLGNBQWMsQ0FBQztBQUFBLEVBQ3BEO0FBQ0EsUUFBTSxNQUFNLE9BQU8sSUFBSTtBQUN2QixNQUFJLENBQUMsSUFBSTtBQUFJLFdBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTyxJQUFJLE9BQU8sTUFBTSxJQUFJLE1BQU0sUUFBUSxJQUFJLE9BQU87QUFDdEYsU0FBTyxFQUFFLElBQUksTUFBTSxXQUFXLElBQUksV0FBVyxNQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3hFOzs7QUMzUUEsSUFBQSxxQkFBZTtFQUNkQyxnQkFBYyxTQUFBQSxlQUFDQyxTQUFTO0FBTXZCLFdBQU8sSUFBSUMsVUFBVSxFQUFFQyxnQkFBZ0JGLFFBQVFHLEtBQUssR0FBRyxVQUFVO0VBQ2xFO0FBQ0Q7OztBQ0FBLElBQUksTUFBTSxDQUFDO0FBQ1gsSUFBSSxLQUFNLFNBQVUsR0FBRyxJQUFJLEtBQUssVUFBVSxJQUFJO0FBQzFDLE1BQUksSUFBSSxJQUFJLE9BQU8sSUFBSSxFQUFFLE1BQU0sSUFBSSxFQUFFLElBQUksSUFBSSxnQkFBZ0IsSUFBSSxLQUFLO0FBQUEsSUFDbEUsSUFBSTtBQUFBLEVBQ1IsR0FBRyxFQUFFLE1BQU0sa0JBQWtCLENBQUMsQ0FBQyxFQUFFO0FBQ2pDLElBQUUsWUFBWSxTQUFVLEdBQUc7QUFDdkIsUUFBSSxJQUFJLEVBQUUsTUFBTSxLQUFLLEVBQUU7QUFDdkIsUUFBSSxJQUFJO0FBQ0osVUFBSUMsT0FBTSxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDekIsTUFBQUEsS0FBSSxNQUFNLElBQUksR0FBRyxDQUFDO0FBQ2xCLE1BQUFBLEtBQUksUUFBUSxHQUFHLENBQUM7QUFDaEIsU0FBR0EsTUFBSyxJQUFJO0FBQUEsSUFDaEI7QUFFSSxTQUFHLE1BQU0sQ0FBQztBQUFBLEVBQ2xCO0FBQ0EsSUFBRSxZQUFZLEtBQUssUUFBUTtBQUMzQixTQUFPO0FBQ1g7QUFHQSxJQUFJLEtBQUs7QUFBVCxJQUFxQixNQUFNO0FBQTNCLElBQXdDLE1BQU07QUFFOUMsSUFBSSxPQUFPLElBQUksR0FBRztBQUFBLEVBQUM7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUE7QUFBQSxFQUFnQjtBQUFBLEVBQUc7QUFBQTtBQUFBLEVBQW9CO0FBQUMsQ0FBQztBQUVoSixJQUFJLE9BQU8sSUFBSSxHQUFHO0FBQUEsRUFBQztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUE7QUFBQSxFQUFpQjtBQUFBLEVBQUc7QUFBQyxDQUFDO0FBRXZJLElBQUksT0FBTyxJQUFJLEdBQUcsQ0FBQyxJQUFJLElBQUksSUFBSSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFFcEYsSUFBSSxPQUFPLFNBQVUsSUFBSSxPQUFPO0FBQzVCLE1BQUksSUFBSSxJQUFJLElBQUksRUFBRTtBQUNsQixXQUFTLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxHQUFHO0FBQ3pCLE1BQUUsQ0FBQyxJQUFJLFNBQVMsS0FBSyxHQUFHLElBQUksQ0FBQztBQUFBLEVBQ2pDO0FBRUEsTUFBSSxJQUFJLElBQUksSUFBSSxFQUFFLEVBQUUsQ0FBQztBQUNyQixXQUFTLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxHQUFHO0FBQ3pCLGFBQVMsSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHO0FBQ2xDLFFBQUUsQ0FBQyxJQUFNLElBQUksRUFBRSxDQUFDLEtBQU0sSUFBSztBQUFBLElBQy9CO0FBQUEsRUFDSjtBQUNBLFNBQU8sRUFBRSxHQUFNLEVBQUs7QUFDeEI7QUFDQSxJQUFJLEtBQUssS0FBSyxNQUFNLENBQUM7QUFBckIsSUFBd0IsS0FBSyxHQUFHO0FBQWhDLElBQW1DLFFBQVEsR0FBRztBQUU5QyxHQUFHLEVBQUUsSUFBSSxLQUFLLE1BQU0sR0FBRyxJQUFJO0FBQzNCLElBQUksS0FBSyxLQUFLLE1BQU0sQ0FBQztBQUFyQixJQUF3QixLQUFLLEdBQUc7QUFBaEMsSUFBbUMsUUFBUSxHQUFHO0FBRTlDLElBQUksTUFBTSxJQUFJLElBQUksS0FBSztBQUN2QixLQUFTLElBQUksR0FBRyxJQUFJLE9BQU8sRUFBRSxHQUFHO0FBRXhCLE9BQU0sSUFBSSxVQUFXLEtBQU8sSUFBSSxVQUFXO0FBQy9DLE9BQU0sSUFBSSxVQUFXLEtBQU8sSUFBSSxVQUFXO0FBQzNDLE9BQU0sSUFBSSxVQUFXLEtBQU8sSUFBSSxTQUFXO0FBQzNDLE1BQUksQ0FBQyxNQUFPLElBQUksVUFBVyxLQUFPLElBQUksUUFBVyxNQUFPO0FBQzVEO0FBSlE7QUFGQztBQVVULElBQUksT0FBUSxTQUFVLElBQUksSUFBSSxHQUFHO0FBQzdCLE1BQUksSUFBSSxHQUFHO0FBRVgsTUFBSSxJQUFJO0FBRVIsTUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO0FBRWxCLFNBQU8sSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNmLFFBQUksR0FBRyxDQUFDO0FBQ0osUUFBRSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFBQSxFQUNyQjtBQUVBLE1BQUksS0FBSyxJQUFJLElBQUksRUFBRTtBQUNuQixPQUFLLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxHQUFHO0FBQ3JCLE9BQUcsQ0FBQyxJQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBTTtBQUFBLEVBQ3RDO0FBQ0EsTUFBSTtBQUNKLE1BQUksR0FBRztBQUVILFNBQUssSUFBSSxJQUFJLEtBQUssRUFBRTtBQUVwQixRQUFJLE1BQU0sS0FBSztBQUNmLFNBQUssSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLEdBQUc7QUFFcEIsVUFBSSxHQUFHLENBQUMsR0FBRztBQUVQLFlBQUksS0FBTSxLQUFLLElBQUssR0FBRyxDQUFDO0FBRXhCLFlBQUksTUFBTSxLQUFLLEdBQUcsQ0FBQztBQUVuQixZQUFJLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU87QUFFM0IsaUJBQVMsSUFBSSxLQUFNLEtBQUssT0FBTyxHQUFJLEtBQUssR0FBRyxFQUFFLEdBQUc7QUFFNUMsYUFBRyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUk7QUFBQSxRQUN4QjtBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBQUEsRUFDSixPQUNLO0FBQ0QsU0FBSyxJQUFJLElBQUksQ0FBQztBQUNkLFNBQUssSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDcEIsVUFBSSxHQUFHLENBQUMsR0FBRztBQUNQLFdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBTSxLQUFLLEdBQUcsQ0FBQztBQUFBLE1BQzlDO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDQSxTQUFPO0FBQ1g7QUFFQSxJQUFJLE1BQU0sSUFBSSxHQUFHLEdBQUc7QUFDcEIsS0FBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLEVBQUU7QUFDdkIsTUFBSSxDQUFDLElBQUk7QUFESjtBQUVULEtBQVMsSUFBSSxLQUFLLElBQUksS0FBSyxFQUFFO0FBQ3pCLE1BQUksQ0FBQyxJQUFJO0FBREo7QUFFVCxLQUFTLElBQUksS0FBSyxJQUFJLEtBQUssRUFBRTtBQUN6QixNQUFJLENBQUMsSUFBSTtBQURKO0FBRVQsS0FBUyxJQUFJLEtBQUssSUFBSSxLQUFLLEVBQUU7QUFDekIsTUFBSSxDQUFDLElBQUk7QUFESjtBQUdULElBQUksTUFBTSxJQUFJLEdBQUcsRUFBRTtBQUNuQixLQUFTLElBQUksR0FBRyxJQUFJLElBQUksRUFBRTtBQUN0QixNQUFJLENBQUMsSUFBSTtBQURKO0FBR1QsSUFBeUMsT0FBcUIscUJBQUssS0FBSyxHQUFHLENBQUM7QUFFNUUsSUFBeUMsT0FBcUIscUJBQUssS0FBSyxHQUFHLENBQUM7QUFFNUUsSUFBSSxNQUFNLFNBQVUsR0FBRztBQUNuQixNQUFJLElBQUksRUFBRSxDQUFDO0FBQ1gsV0FBUyxJQUFJLEdBQUcsSUFBSSxFQUFFLFFBQVEsRUFBRSxHQUFHO0FBQy9CLFFBQUksRUFBRSxDQUFDLElBQUk7QUFDUCxVQUFJLEVBQUUsQ0FBQztBQUFBLEVBQ2Y7QUFDQSxTQUFPO0FBQ1g7QUFFQSxJQUFJLE9BQU8sU0FBVSxHQUFHLEdBQUcsR0FBRztBQUMxQixNQUFJLElBQUssSUFBSSxJQUFLO0FBQ2xCLFVBQVMsRUFBRSxDQUFDLElBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxPQUFRLElBQUksS0FBTTtBQUNuRDtBQUVBLElBQUksU0FBUyxTQUFVLEdBQUcsR0FBRztBQUN6QixNQUFJLElBQUssSUFBSSxJQUFLO0FBQ2xCLFVBQVMsRUFBRSxDQUFDLElBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxJQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssUUFBUyxJQUFJO0FBQ2hFO0FBRUEsSUFBSSxPQUFPLFNBQVUsR0FBRztBQUFFLFVBQVMsSUFBSSxLQUFLLElBQUs7QUFBRztBQUdwRCxJQUFJLE1BQU0sU0FBVSxHQUFHLEdBQUcsR0FBRztBQUN6QixNQUFJLEtBQUssUUFBUSxJQUFJO0FBQ2pCLFFBQUk7QUFDUixNQUFJLEtBQUssUUFBUSxJQUFJLEVBQUU7QUFDbkIsUUFBSSxFQUFFO0FBRVYsU0FBTyxJQUFJLEdBQUcsRUFBRSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDO0FBc0JBLElBQUksS0FBSztBQUFBLEVBQ0w7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQTtBQUVKO0FBRUEsSUFBSSxNQUFNLFNBQVUsS0FBSyxLQUFLLElBQUk7QUFDOUIsTUFBSSxJQUFJLElBQUksTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDO0FBQ2hDLElBQUUsT0FBTztBQUNULE1BQUksTUFBTTtBQUNOLFVBQU0sa0JBQWtCLEdBQUcsR0FBRztBQUNsQyxNQUFJLENBQUM7QUFDRCxVQUFNO0FBQ1YsU0FBTztBQUNYO0FBRUEsSUFBSSxRQUFRLFNBQVUsS0FBSyxJQUFJLEtBQUssTUFBTTtBQUV0QyxNQUFJLEtBQUssSUFBSSxRQUFRLEtBQUssT0FBTyxLQUFLLFNBQVM7QUFDL0MsTUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRztBQUNuQixXQUFPLE9BQU8sSUFBSSxHQUFHLENBQUM7QUFDMUIsTUFBSSxRQUFRLENBQUM7QUFFYixNQUFJLFNBQVMsU0FBUyxHQUFHLEtBQUs7QUFFOUIsTUFBSSxPQUFPLEdBQUc7QUFFZCxNQUFJO0FBQ0EsVUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDO0FBRXZCLE1BQUksT0FBTyxTQUFVQyxJQUFHO0FBQ3BCLFFBQUksS0FBSyxJQUFJO0FBRWIsUUFBSUEsS0FBSSxJQUFJO0FBRVIsVUFBSSxPQUFPLElBQUksR0FBRyxLQUFLLElBQUksS0FBSyxHQUFHQSxFQUFDLENBQUM7QUFDckMsV0FBSyxJQUFJLEdBQUc7QUFDWixZQUFNO0FBQUEsSUFDVjtBQUFBLEVBQ0o7QUFFQSxNQUFJLFFBQVEsR0FBRyxLQUFLLEdBQUcsTUFBTSxHQUFHLEtBQUssR0FBRyxLQUFLLEdBQUcsS0FBSyxHQUFHLEtBQUssR0FBRyxHQUFHLEtBQUssR0FBRyxHQUFHLE1BQU0sR0FBRyxHQUFHLE1BQU0sR0FBRztBQUVuRyxNQUFJLE9BQU8sS0FBSztBQUNoQixLQUFHO0FBQ0MsUUFBSSxDQUFDLElBQUk7QUFFTCxjQUFRLEtBQUssS0FBSyxLQUFLLENBQUM7QUFFeEIsVUFBSSxPQUFPLEtBQUssS0FBSyxNQUFNLEdBQUcsQ0FBQztBQUMvQixhQUFPO0FBQ1AsVUFBSSxDQUFDLE1BQU07QUFFUCxZQUFJLElBQUksS0FBSyxHQUFHLElBQUksR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDLElBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFJLElBQUksSUFBSTtBQUNuRSxZQUFJLElBQUksSUFBSTtBQUNSLGNBQUk7QUFDQSxnQkFBSSxDQUFDO0FBQ1Q7QUFBQSxRQUNKO0FBRUEsWUFBSTtBQUNBLGVBQUssS0FBSyxDQUFDO0FBRWYsWUFBSSxJQUFJLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxFQUFFO0FBRTlCLFdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLE1BQU0sSUFBSSxHQUFHLEdBQUcsSUFBSTtBQUMzQztBQUFBLE1BQ0osV0FDUyxRQUFRO0FBQ2IsYUFBSyxNQUFNLEtBQUssTUFBTSxNQUFNLEdBQUcsTUFBTTtBQUFBLGVBQ2hDLFFBQVEsR0FBRztBQUVoQixZQUFJLE9BQU8sS0FBSyxLQUFLLEtBQUssRUFBRSxJQUFJLEtBQUssUUFBUSxLQUFLLEtBQUssTUFBTSxJQUFJLEVBQUUsSUFBSTtBQUN2RSxZQUFJLEtBQUssT0FBTyxLQUFLLEtBQUssTUFBTSxHQUFHLEVBQUUsSUFBSTtBQUN6QyxlQUFPO0FBRVAsWUFBSSxNQUFNLElBQUksR0FBRyxFQUFFO0FBRW5CLFlBQUksTUFBTSxJQUFJLEdBQUcsRUFBRTtBQUNuQixpQkFBUyxJQUFJLEdBQUcsSUFBSSxPQUFPLEVBQUUsR0FBRztBQUU1QixjQUFJLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUM7QUFBQSxRQUMzQztBQUNBLGVBQU8sUUFBUTtBQUVmLFlBQUksTUFBTSxJQUFJLEdBQUcsR0FBRyxVQUFVLEtBQUssT0FBTztBQUUxQyxZQUFJLE1BQU0sS0FBSyxLQUFLLEtBQUssQ0FBQztBQUMxQixpQkFBUyxJQUFJLEdBQUcsSUFBSSxNQUFLO0FBQ3JCLGNBQUksSUFBSSxJQUFJLEtBQUssS0FBSyxLQUFLLE1BQU0sQ0FBQztBQUVsQyxpQkFBTyxJQUFJO0FBRVgsY0FBSSxJQUFJLEtBQUs7QUFFYixjQUFJLElBQUksSUFBSTtBQUNSLGdCQUFJLEdBQUcsSUFBSTtBQUFBLFVBQ2YsT0FDSztBQUVELGdCQUFJLElBQUksR0FBRyxJQUFJO0FBQ2YsZ0JBQUksS0FBSztBQUNMLGtCQUFJLElBQUksS0FBSyxLQUFLLEtBQUssQ0FBQyxHQUFHLE9BQU8sR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDO0FBQUEscUJBQzdDLEtBQUs7QUFDVixrQkFBSSxJQUFJLEtBQUssS0FBSyxLQUFLLENBQUMsR0FBRyxPQUFPO0FBQUEscUJBQzdCLEtBQUs7QUFDVixrQkFBSSxLQUFLLEtBQUssS0FBSyxLQUFLLEdBQUcsR0FBRyxPQUFPO0FBQ3pDLG1CQUFPO0FBQ0gsa0JBQUksR0FBRyxJQUFJO0FBQUEsVUFDbkI7QUFBQSxRQUNKO0FBRUEsWUFBSSxLQUFLLElBQUksU0FBUyxHQUFHLElBQUksR0FBRyxLQUFLLElBQUksU0FBUyxJQUFJO0FBRXRELGNBQU0sSUFBSSxFQUFFO0FBRVosY0FBTSxJQUFJLEVBQUU7QUFDWixhQUFLLEtBQUssSUFBSSxLQUFLLENBQUM7QUFDcEIsYUFBSyxLQUFLLElBQUksS0FBSyxDQUFDO0FBQUEsTUFDeEI7QUFFSSxZQUFJLENBQUM7QUFDVCxVQUFJLE1BQU0sTUFBTTtBQUNaLFlBQUk7QUFDQSxjQUFJLENBQUM7QUFDVDtBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBR0EsUUFBSTtBQUNBLFdBQUssS0FBSyxNQUFNO0FBQ3BCLFFBQUksT0FBTyxLQUFLLE9BQU8sR0FBRyxPQUFPLEtBQUssT0FBTztBQUM3QyxRQUFJLE9BQU87QUFDWCxhQUFRLE9BQU8sS0FBSztBQUVoQixVQUFJLElBQUksR0FBRyxPQUFPLEtBQUssR0FBRyxJQUFJLEdBQUcsR0FBRyxNQUFNLEtBQUs7QUFDL0MsYUFBTyxJQUFJO0FBQ1gsVUFBSSxNQUFNLE1BQU07QUFDWixZQUFJO0FBQ0EsY0FBSSxDQUFDO0FBQ1Q7QUFBQSxNQUNKO0FBQ0EsVUFBSSxDQUFDO0FBQ0QsWUFBSSxDQUFDO0FBQ1QsVUFBSSxNQUFNO0FBQ04sWUFBSSxJQUFJLElBQUk7QUFBQSxlQUNQLE9BQU8sS0FBSztBQUNqQixlQUFPLEtBQUssS0FBSztBQUNqQjtBQUFBLE1BQ0osT0FDSztBQUNELFlBQUksTUFBTSxNQUFNO0FBRWhCLFlBQUksTUFBTSxLQUFLO0FBRVgsY0FBSSxJQUFJLE1BQU0sS0FBSyxJQUFJLEtBQUssQ0FBQztBQUM3QixnQkFBTSxLQUFLLEtBQUssTUFBTSxLQUFLLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQztBQUN6QyxpQkFBTztBQUFBLFFBQ1g7QUFFQSxZQUFJLElBQUksR0FBRyxPQUFPLEtBQUssR0FBRyxJQUFJLEdBQUcsR0FBRyxPQUFPLEtBQUs7QUFDaEQsWUFBSSxDQUFDO0FBQ0QsY0FBSSxDQUFDO0FBQ1QsZUFBTyxJQUFJO0FBQ1gsWUFBSSxLQUFLLEdBQUcsSUFBSTtBQUNoQixZQUFJLE9BQU8sR0FBRztBQUNWLGNBQUksSUFBSSxLQUFLLElBQUk7QUFDakIsZ0JBQU0sT0FBTyxLQUFLLEdBQUcsS0FBSyxLQUFLLEtBQUssR0FBRyxPQUFPO0FBQUEsUUFDbEQ7QUFDQSxZQUFJLE1BQU0sTUFBTTtBQUNaLGNBQUk7QUFDQSxnQkFBSSxDQUFDO0FBQ1Q7QUFBQSxRQUNKO0FBQ0EsWUFBSTtBQUNBLGVBQUssS0FBSyxNQUFNO0FBQ3BCLFlBQUksTUFBTSxLQUFLO0FBQ2YsWUFBSSxLQUFLLElBQUk7QUFDVCxjQUFJLFFBQVEsS0FBSyxJQUFJLE9BQU8sS0FBSyxJQUFJLElBQUksR0FBRztBQUM1QyxjQUFJLFFBQVEsS0FBSztBQUNiLGdCQUFJLENBQUM7QUFDVCxpQkFBTyxLQUFLLE1BQU0sRUFBRTtBQUNoQixnQkFBSSxFQUFFLElBQUksS0FBSyxRQUFRLEVBQUU7QUFBQSxRQUNqQztBQUNBLGVBQU8sS0FBSyxLQUFLLEVBQUU7QUFDZixjQUFJLEVBQUUsSUFBSSxJQUFJLEtBQUssRUFBRTtBQUFBLE1BQzdCO0FBQUEsSUFDSjtBQUNBLE9BQUcsSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLEdBQUcsSUFBSSxJQUFJLEdBQUcsSUFBSTtBQUMxQyxRQUFJO0FBQ0EsY0FBUSxHQUFHLEdBQUcsSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLEdBQUcsSUFBSTtBQUFBLEVBQ2pELFNBQVMsQ0FBQztBQUVWLFNBQU8sTUFBTSxJQUFJLFVBQVUsUUFBUSxJQUFJLEtBQUssR0FBRyxFQUFFLElBQUksSUFBSSxTQUFTLEdBQUcsRUFBRTtBQUMzRTtBQW9PQSxJQUFJLEtBQW1CLG9CQUFJLEdBQUcsQ0FBQztBQWdNL0IsSUFBSSxNQUFNLFNBQVUsR0FBRyxHQUFHO0FBQ3RCLE1BQUksSUFBSSxDQUFDO0FBQ1QsV0FBUyxLQUFLO0FBQ1YsTUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ2QsV0FBUyxLQUFLO0FBQ1YsTUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ2QsU0FBTztBQUNYO0FBUUEsSUFBSSxPQUFPLFNBQVUsSUFBSSxPQUFPQyxLQUFJO0FBQ2hDLE1BQUksS0FBSyxHQUFHO0FBQ1osTUFBSSxLQUFLLEdBQUcsU0FBUztBQUNyQixNQUFJLEtBQUssR0FBRyxNQUFNLEdBQUcsUUFBUSxHQUFHLElBQUksR0FBRyxHQUFHLFlBQVksR0FBRyxDQUFDLEVBQUUsUUFBUSxRQUFRLEVBQUUsRUFBRSxNQUFNLEdBQUc7QUFDekYsV0FBUyxJQUFJLEdBQUcsSUFBSSxHQUFHLFFBQVEsRUFBRSxHQUFHO0FBQ2hDLFFBQUksSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQztBQUN2QixRQUFJLE9BQU8sS0FBSyxZQUFZO0FBQ3hCLGVBQVMsTUFBTSxJQUFJO0FBQ25CLFVBQUksT0FBTyxFQUFFLFNBQVM7QUFDdEIsVUFBSSxFQUFFLFdBQVc7QUFFYixZQUFJLEtBQUssUUFBUSxlQUFlLEtBQUssSUFBSTtBQUNyQyxjQUFJLFFBQVEsS0FBSyxRQUFRLEtBQUssQ0FBQyxJQUFJO0FBQ25DLG1CQUFTLEtBQUssTUFBTSxPQUFPLEtBQUssUUFBUSxLQUFLLEtBQUssQ0FBQztBQUFBLFFBQ3ZELE9BQ0s7QUFDRCxtQkFBUztBQUNULG1CQUFTLEtBQUssRUFBRTtBQUNaLHFCQUFTLE1BQU0sSUFBSSxnQkFBZ0IsSUFBSSxNQUFNLEVBQUUsVUFBVSxDQUFDLEVBQUUsU0FBUztBQUFBLFFBQzdFO0FBQUEsTUFDSjtBQUVJLGlCQUFTO0FBQUEsSUFDakI7QUFFSSxNQUFBQSxJQUFHLENBQUMsSUFBSTtBQUFBLEVBQ2hCO0FBQ0EsU0FBTztBQUNYO0FBQ0EsSUFBSSxLQUFLLENBQUM7QUFFVixJQUFJLE9BQU8sU0FBVSxHQUFHO0FBQ3BCLE1BQUksS0FBSyxDQUFDO0FBQ1YsV0FBUyxLQUFLLEdBQUc7QUFDYixRQUFJLEVBQUUsQ0FBQyxFQUFFLFFBQVE7QUFDYixTQUFHLE1BQU0sRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLEdBQUcsTUFBTTtBQUFBLElBQ3REO0FBQUEsRUFDSjtBQUNBLFNBQU87QUFDWDtBQUVBLElBQUksT0FBTyxTQUFVLEtBQUssTUFBTSxJQUFJLElBQUk7QUFDcEMsTUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHO0FBQ1QsUUFBSSxRQUFRLElBQUksT0FBTyxDQUFDLEdBQUcsSUFBSSxJQUFJLFNBQVM7QUFDNUMsYUFBUyxJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFDckIsY0FBUSxLQUFLLElBQUksQ0FBQyxHQUFHLE9BQU8sSUFBSTtBQUNwQyxPQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsS0FBSyxJQUFJLENBQUMsR0FBRyxPQUFPLElBQUksR0FBRyxHQUFHLEtBQUs7QUFBQSxFQUNyRDtBQUNBLE1BQUlBLE1BQUssSUFBSSxDQUFDLEdBQUcsR0FBRyxFQUFFLEVBQUUsQ0FBQztBQUN6QixTQUFPLEdBQUcsR0FBRyxFQUFFLEVBQUUsSUFBSSw0RUFBNEUsS0FBSyxTQUFTLElBQUksS0FBSyxJQUFJQSxLQUFJLEtBQUtBLEdBQUUsR0FBRyxFQUFFO0FBQ2hKO0FBRUEsSUFBSSxTQUFTLFdBQVk7QUFBRSxTQUFPLENBQUMsSUFBSSxLQUFLLEtBQUssTUFBTSxNQUFNLE1BQU0sSUFBSSxJQUFJLE1BQU0sTUFBTSxLQUFLLElBQUksTUFBTSxLQUFLLE1BQU0sUUFBUSxNQUFNLEtBQUssS0FBSyxPQUFPLGFBQWEsS0FBSyxJQUFJO0FBQUc7QUFXekssSUFBSSxNQUFNLFNBQVUsS0FBSztBQUFFLFNBQU8sWUFBWSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUM7QUFBRztBQUVsRSxJQUFJLE9BQU8sU0FBVSxHQUFHO0FBQUUsU0FBTyxLQUFLO0FBQUEsSUFDbEMsS0FBSyxFQUFFLFFBQVEsSUFBSSxHQUFHLEVBQUUsSUFBSTtBQUFBLElBQzVCLFlBQVksRUFBRTtBQUFBLEVBQ2xCO0FBQUc7QUFFSCxJQUFJLFFBQVEsU0FBVSxLQUFLLE1BQU0sS0FBSyxNQUFNLElBQUksSUFBSTtBQUNoRCxNQUFJLElBQUksS0FBSyxLQUFLLE1BQU0sSUFBSSxTQUFVQyxNQUFLQyxNQUFLO0FBQzVDLE1BQUUsVUFBVTtBQUNaLE9BQUdELE1BQUtDLElBQUc7QUFBQSxFQUNmLENBQUM7QUFDRCxJQUFFLFlBQVksQ0FBQyxLQUFLLElBQUksR0FBRyxLQUFLLFVBQVUsQ0FBQyxJQUFJLE1BQU0sSUFBSSxDQUFDLENBQUM7QUFDM0QsU0FBTyxXQUFZO0FBQUUsTUFBRSxVQUFVO0FBQUEsRUFBRztBQUN4QztBQWlEQSxJQUFJLEtBQUssU0FBVSxHQUFHLEdBQUc7QUFBRSxTQUFPLEVBQUUsQ0FBQyxJQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7QUFBSTtBQUUxRCxJQUFJLEtBQUssU0FBVSxHQUFHLEdBQUc7QUFBRSxVQUFRLEVBQUUsQ0FBQyxJQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssSUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLEtBQU8sRUFBRSxJQUFJLENBQUMsS0FBSyxRQUFTO0FBQUc7QUFFeEcsSUFBSSxLQUFLLFNBQVUsR0FBRyxHQUFHO0FBQUUsU0FBTyxHQUFHLEdBQUcsQ0FBQyxJQUFLLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSTtBQUFhO0FBNFBuRSxTQUFTLFFBQVEsTUFBTSxNQUFNLElBQUk7QUFDcEMsTUFBSSxDQUFDO0FBQ0QsU0FBSyxNQUFNLE9BQU8sQ0FBQztBQUN2QixNQUFJLE9BQU8sTUFBTTtBQUNiLFFBQUksQ0FBQztBQUNULFNBQU8sTUFBTSxNQUFNLE1BQU07QUFBQSxJQUNyQjtBQUFBLEVBQ0osR0FBRyxTQUFVLElBQUk7QUFBRSxXQUFPLElBQUksWUFBWSxHQUFHLEtBQUssQ0FBQyxHQUFHLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUFHLEdBQUcsR0FBRyxFQUFFO0FBQ3RGO0FBQ08sU0FBUyxZQUFZLE1BQU0sTUFBTTtBQUNwQyxTQUFPLE1BQU0sTUFBTSxFQUFFLEdBQUcsRUFBRSxHQUFHLFFBQVEsS0FBSyxLQUFLLFFBQVEsS0FBSyxVQUFVO0FBQzFFO0FBdWJBLElBQUksS0FBSyxPQUFPLGVBQWUsZUFBNkIsb0JBQUksWUFBWTtBQUU1RSxJQUFJLE1BQU07QUFDVixJQUFJO0FBQ0EsS0FBRyxPQUFPLElBQUksRUFBRSxRQUFRLEtBQUssQ0FBQztBQUM5QixRQUFNO0FBQ1YsU0FDTyxHQUFHO0FBQUU7QUFFWixJQUFJLFFBQVEsU0FBVSxHQUFHO0FBQ3JCLFdBQVMsSUFBSSxJQUFJLElBQUksT0FBSztBQUN0QixRQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsUUFBSSxNQUFNLElBQUksUUFBUSxJQUFJLFFBQVEsSUFBSTtBQUN0QyxRQUFJLElBQUksS0FBSyxFQUFFO0FBQ1gsYUFBTyxFQUFFLEdBQUcsR0FBRyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsRUFBRTtBQUNwQyxRQUFJLENBQUM7QUFDRCxXQUFLLE9BQU8sYUFBYSxDQUFDO0FBQUEsYUFDckIsTUFBTSxHQUFHO0FBQ2QsWUFBTSxJQUFJLE9BQU8sTUFBTSxFQUFFLEdBQUcsSUFBSSxPQUFPLE1BQU0sRUFBRSxHQUFHLElBQUksT0FBTyxJQUFLLEVBQUUsR0FBRyxJQUFJLE1BQU8sT0FDOUUsS0FBSyxPQUFPLGFBQWEsUUFBUyxLQUFLLElBQUssUUFBUyxJQUFJLElBQUs7QUFBQSxJQUN0RSxXQUNTLEtBQUs7QUFDVixXQUFLLE9BQU8sY0FBYyxJQUFJLE9BQU8sSUFBSyxFQUFFLEdBQUcsSUFBSSxFQUFHO0FBQUE7QUFFdEQsV0FBSyxPQUFPLGNBQWMsSUFBSSxPQUFPLE1BQU0sRUFBRSxHQUFHLElBQUksT0FBTyxJQUFLLEVBQUUsR0FBRyxJQUFJLEVBQUc7QUFBQSxFQUNwRjtBQUNKO0FBNEhPLFNBQVMsVUFBVSxLQUFLLFFBQVE7QUFDbkMsTUFBSSxRQUFRO0FBQ1IsUUFBSSxJQUFJO0FBQ1IsYUFBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLFFBQVEsS0FBSztBQUNqQyxXQUFLLE9BQU8sYUFBYSxNQUFNLE1BQU0sSUFBSSxTQUFTLEdBQUcsSUFBSSxLQUFLLENBQUM7QUFDbkUsV0FBTztBQUFBLEVBQ1gsV0FDUyxJQUFJO0FBQ1QsV0FBTyxHQUFHLE9BQU8sR0FBRztBQUFBLEVBQ3hCLE9BQ0s7QUFDRCxRQUFJQyxNQUFLLE1BQU0sR0FBRyxHQUFHLElBQUlBLElBQUcsR0FBRyxJQUFJQSxJQUFHO0FBQ3RDLFFBQUksRUFBRTtBQUNGLFVBQUksQ0FBQztBQUNULFdBQU87QUFBQSxFQUNYO0FBQ0o7QUFLQSxJQUFJLE9BQU8sU0FBVSxHQUFHLEdBQUc7QUFBRSxTQUFPLElBQUksS0FBSyxHQUFHLEdBQUcsSUFBSSxFQUFFLElBQUksR0FBRyxHQUFHLElBQUksRUFBRTtBQUFHO0FBRTVFLElBQUksS0FBSyxTQUFVLEdBQUcsR0FBRyxHQUFHO0FBQ3hCLE1BQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxFQUFFLEdBQUcsTUFBTSxHQUFHLEdBQUcsSUFBSSxFQUFFLEdBQUcsS0FBSyxVQUFVLEVBQUUsU0FBUyxJQUFJLElBQUksSUFBSSxLQUFLLEdBQUcsR0FBRyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLEdBQUcsS0FBSyxJQUFJLEtBQUs7QUFDdEksTUFBSUMsTUFBSyxNQUFNLEdBQUcsSUFBSSxLQUFLLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJLEVBQUUsR0FBRyxHQUFHLEdBQUcsSUFBSSxFQUFFLENBQUMsR0FBRyxLQUFLQSxJQUFHLENBQUMsR0FBRyxLQUFLQSxJQUFHLENBQUMsR0FBRyxNQUFNQSxJQUFHLENBQUM7QUFDOUcsU0FBTyxDQUFDLEdBQUcsR0FBRyxJQUFJLEVBQUUsR0FBRyxJQUFJLElBQUksSUFBSSxLQUFLLE1BQU0sR0FBRyxHQUFHLElBQUksRUFBRSxHQUFHLEdBQUc7QUFDcEU7QUFFQSxJQUFJLFFBQVEsU0FBVSxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksSUFBSSxLQUFLO0FBQzNDLE1BQUksTUFBTSxNQUFNLFlBQVksTUFBTSxNQUFNLFlBQVksT0FBTyxPQUFPLFlBQVksSUFBSSxJQUFJO0FBQ3RGLE1BQUksS0FBSyxNQUFNLE1BQU07QUFDckIsTUFBSSxLQUFLLElBQUk7QUFDVCxXQUFPLElBQUksSUFBSSxHQUFHLEtBQUssSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUc7QUFDckMsVUFBSSxHQUFHLEdBQUcsQ0FBQyxLQUFLLEdBQUc7QUFDZixlQUFPO0FBQUEsVUFDSCxNQUFNLEdBQUcsR0FBRyxJQUFJLElBQUksSUFBSSxHQUFHLElBQUk7QUFBQSxVQUMvQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSTtBQUFBLFVBQ3JCLE9BQU8sR0FBRyxHQUFHLElBQUksSUFBSSxLQUFLLE1BQU0sSUFBSSxJQUFJO0FBQUEsVUFDeEM7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFFQSxRQUFJLElBQUk7QUFDSixVQUFJLEVBQUU7QUFBQSxFQUNkO0FBQ0EsU0FBTyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUM7QUFDMUI7QUF3ckJBLElBQUksS0FBSyxPQUFPLGtCQUFrQixhQUFhLGlCQUFpQixPQUFPLGNBQWMsYUFBYSxhQUFhLFNBQVUsSUFBSTtBQUFFLEtBQUc7QUFBRztBQUM5SCxTQUFTLE1BQU0sTUFBTSxNQUFNLElBQUk7QUFDbEMsTUFBSSxDQUFDO0FBQ0QsU0FBSyxNQUFNLE9BQU8sQ0FBQztBQUN2QixNQUFJLE9BQU8sTUFBTTtBQUNiLFFBQUksQ0FBQztBQUNULE1BQUksT0FBTyxDQUFDO0FBQ1osTUFBSSxPQUFPLFdBQVk7QUFDbkIsYUFBU0MsS0FBSSxHQUFHQSxLQUFJLEtBQUssUUFBUSxFQUFFQTtBQUMvQixXQUFLQSxFQUFDLEVBQUU7QUFBQSxFQUNoQjtBQUNBLE1BQUksUUFBUSxDQUFDO0FBQ2IsTUFBSSxNQUFNLFNBQVUsR0FBRyxHQUFHO0FBQ3RCLE9BQUcsV0FBWTtBQUFFLFNBQUcsR0FBRyxDQUFDO0FBQUEsSUFBRyxDQUFDO0FBQUEsRUFDaEM7QUFDQSxLQUFHLFdBQVk7QUFBRSxVQUFNO0FBQUEsRUFBSSxDQUFDO0FBQzVCLE1BQUksSUFBSSxLQUFLLFNBQVM7QUFDdEIsU0FBTyxHQUFHLE1BQU0sQ0FBQyxLQUFLLFdBQVcsRUFBRSxHQUFHO0FBQ2xDLFFBQUksQ0FBQyxLQUFLLEtBQUssU0FBUyxJQUFJLE9BQU87QUFDL0IsVUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSTtBQUN2QixhQUFPO0FBQUEsSUFDWDtBQUFBLEVBQ0o7QUFDQTtBQUNBLE1BQUksTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDO0FBQ3hCLE1BQUksS0FBSztBQUNMLFFBQUksSUFBSTtBQUNSLFFBQUksSUFBSSxHQUFHLE1BQU0sSUFBSSxFQUFFO0FBQ3ZCLFFBQUksSUFBSSxHQUFHLE1BQU0sSUFBSSxFQUFFLEtBQUs7QUFDNUIsUUFBSSxHQUFHO0FBQ0gsVUFBSSxLQUFLLEdBQUcsTUFBTSxJQUFJLEVBQUU7QUFDeEIsVUFBSSxHQUFHLE1BQU0sRUFBRSxLQUFLO0FBQ3BCLFVBQUksR0FBRztBQUNILFlBQUksTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFFO0FBQzFCLFlBQUksR0FBRyxNQUFNLEtBQUssRUFBRTtBQUFBLE1BQ3hCO0FBQUEsSUFDSjtBQUNBLFFBQUksT0FBTyxRQUFRLEtBQUs7QUFDeEIsUUFBSSxVQUFVLFNBQVVBLElBQUc7QUFDdkIsVUFBSUMsTUFBSyxHQUFHLE1BQU0sR0FBRyxDQUFDLEdBQUcsTUFBTUEsSUFBRyxDQUFDLEdBQUcsS0FBS0EsSUFBRyxDQUFDLEdBQUcsS0FBS0EsSUFBRyxDQUFDLEdBQUcsS0FBS0EsSUFBRyxDQUFDLEdBQUcsS0FBS0EsSUFBRyxDQUFDLEdBQUcsTUFBTUEsSUFBRyxDQUFDLEdBQUcsSUFBSSxLQUFLLE1BQU0sR0FBRztBQUNySCxVQUFJO0FBQ0osVUFBSSxNQUFNLFNBQVVDLElBQUcsR0FBRztBQUN0QixZQUFJQSxJQUFHO0FBQ0gsZUFBSztBQUNMLGNBQUlBLElBQUcsSUFBSTtBQUFBLFFBQ2YsT0FDSztBQUNELGNBQUk7QUFDQSxrQkFBTSxFQUFFLElBQUk7QUFDaEIsY0FBSSxDQUFDLEVBQUU7QUFDSCxnQkFBSSxNQUFNLEtBQUs7QUFBQSxRQUN2QjtBQUFBLE1BQ0o7QUFDQSxVQUFJLENBQUMsUUFBUSxLQUFLO0FBQUEsUUFDZCxNQUFNO0FBQUEsUUFDTixNQUFNO0FBQUEsUUFDTixjQUFjO0FBQUEsUUFDZCxhQUFhO0FBQUEsTUFDakIsQ0FBQyxHQUFHO0FBQ0EsWUFBSSxDQUFDO0FBQ0QsY0FBSSxNQUFNLElBQUksTUFBTSxHQUFHLElBQUksRUFBRSxDQUFDO0FBQUEsaUJBQ3pCLE9BQU8sR0FBRztBQUNmLGNBQUksT0FBTyxLQUFLLFNBQVMsR0FBRyxJQUFJLEVBQUU7QUFFbEMsY0FBSSxLQUFLLFVBQVUsS0FBSyxNQUFNLElBQUk7QUFDOUIsZ0JBQUk7QUFDQSxrQkFBSSxNQUFNLFlBQVksTUFBTSxFQUFFLEtBQUssSUFBSSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFBQSxZQUNwRCxTQUNPQSxJQUFHO0FBQ04sa0JBQUlBLElBQUcsSUFBSTtBQUFBLFlBQ2Y7QUFBQSxVQUNKO0FBRUksaUJBQUssS0FBSyxRQUFRLE1BQU0sRUFBRSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNsRDtBQUVJLGNBQUksSUFBSSxJQUFJLDhCQUE4QixLQUFLLENBQUMsR0FBRyxJQUFJO0FBQUEsTUFDL0Q7QUFFSSxZQUFJLE1BQU0sSUFBSTtBQUFBLElBQ3RCO0FBQ0EsYUFBUyxJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRztBQUN4QixjQUFRLENBQUM7QUFBQSxJQUNiO0FBQUEsRUFDSjtBQUVJLFFBQUksTUFBTSxDQUFDLENBQUM7QUFDaEIsU0FBTztBQUNYOzs7QUM3akZlLFNBQWYscUJBQTZDQyxPQUFPQyxTQUFTO0FBQzVELFNBQU9DLGtDQUFrQ0YsT0FBT0MsU0FBU0UsWUFBWSxJQUFJO0FBQzFFO0FBU08sU0FBU0Qsa0NBQWtDRixPQUF3QztBQUFBLE1BQUFJLE9BQUFDLFVBQUFDLFNBQUEsS0FBQUQsVUFBQSxDQUFBLE1BQUFFLFNBQUFGLFVBQUEsQ0FBQSxJQUFwQixDQUFDLEdBQVpHLFVBQU1KLEtBQU5JO0FBQU0sTUFBU0MsU0FBS0osVUFBQUMsU0FBQSxJQUFBRCxVQUFBLENBQUEsSUFBQUU7QUFBQSxNQUFFRyxVQUFPTCxVQUFBQyxTQUFBLElBQUFELFVBQUEsQ0FBQSxJQUFBRTtBQUd2RixTQUFPRSxPQUFNLElBQUlFLFdBQVdYLEtBQUssR0FBRzs7SUFFbkNRLFFBQVEsU0FBQUEsT0FBQ0ksTUFBUztBQUNqQixVQUFJSixTQUFRO0FBQ1gsZUFBT0EsUUFBTztVQUNiSyxNQUFNRCxLQUFLRTtRQUNaLENBQUM7TUFDRjtBQUNBLGFBQU87SUFDUjtFQUNELENBQUM7QUFDRjtBQUVBLFNBQVNYLFdBQVdZLFNBQVM7QUFDM0IsU0FBTyxJQUFJQyxRQUFRLFNBQUNDLFNBQVNDLFFBQVc7QUFJdENULFVBQU1NLFNBQVMsU0FBQ0ksT0FBT0MsT0FBVTtBQUMvQixVQUFJRCxPQUFPO0FBQ1RELGVBQU9DLEtBQUs7TUFDZCxPQUFPO0FBQ0xGLGdCQUFRRyxLQUFLO01BQ2Y7SUFDRixDQUFDO0VBQ0gsQ0FBQztBQUNIOzs7QUN4RGUsU0FBZixzQ0FBOERDLFNBQVM7QUFDdEUsTUFBTUMsbUJBQW1CLENBQUM7QUFDMUIsV0FBQUMsS0FBQSxHQUFBQyxlQUFrQkMsT0FBT0MsS0FBS0wsT0FBTyxHQUFDRSxLQUFBQyxhQUFBRyxRQUFBSixNQUFFO0FBQW5DLFFBQU1LLE1BQUdKLGFBQUFELEVBQUE7QUFDYkQscUJBQWlCTSxHQUFHLElBQUlDLFVBQVVSLFFBQVFPLEdBQUcsQ0FBQztFQUMvQztBQUNBLFNBQU9OO0FBQ1I7OztBQ0xlLFNBQWYsc0JBQTZDUSxNQUFXO0FBQUEsTUFBUkMsT0FBSUQsS0FBSkM7QUFDL0MsU0FBT0EsS0FBS0MsU0FBUyxNQUFNLEtBQUtELEtBQUtDLFNBQVMsV0FBVztBQUMxRDs7O0FDT2UsU0FBZixlQUF1Q0MsT0FBTztBQUM3QyxNQUFJQSxpQkFBaUJDLFFBQVFELGlCQUFpQkUsTUFBTTtBQUNuRCxXQUFPRixNQUFNRyxZQUFZLEVBQUVDLEtBQUtDLHdCQUF3QjtFQUN6RDtBQUNBLFNBQU9DLFFBQVFDLFFBQVFQLEtBQUssRUFBRUksS0FBS0Msd0JBQXdCO0FBQzVEO0FBRUEsU0FBU0EseUJBQXlCRixhQUFhO0FBQzlDLFNBQU9LLHFCQUFxQkwsYUFBYTtJQUFFTSxRQUFRQztFQUFzQixDQUFDLEVBQUVOLEtBQzNFTyxxQ0FDRDtBQUNEOzs7QUMzQk8sU0FBU0MsVUFBVUMsTUFBTUMsU0FBUztBQUN4QyxNQUFJQyxJQUFJO0FBQ1IsU0FBT0EsSUFBSUYsS0FBS0csV0FBV0MsUUFBUTtBQUNsQyxRQUFNQyxZQUFZTCxLQUFLRyxXQUFXRCxDQUFDO0FBR25DLFFBQUlHLFVBQVVDLGFBQWEsS0FBS0MsV0FBV0YsU0FBUyxNQUFNSixTQUFTO0FBQ2xFLGFBQU9JO0lBQ1I7QUFDQUg7RUFDRDtBQUNEO0FBRU8sU0FBU00sYUFBYVIsTUFBTUMsU0FBUztBQUMzQyxNQUFNUSxVQUFVLENBQUE7QUFDaEIsTUFBSVAsSUFBSTtBQUNSLFNBQU9BLElBQUlGLEtBQUtHLFdBQVdDLFFBQVE7QUFDbEMsUUFBTUMsWUFBWUwsS0FBS0csV0FBV0QsQ0FBQztBQUduQyxRQUFJRyxVQUFVQyxhQUFhLEtBQUtDLFdBQVdGLFNBQVMsTUFBTUosU0FBUztBQUNsRVEsY0FBUUMsS0FBS0wsU0FBUztJQUN2QjtBQUNBSDtFQUNEO0FBQ0EsU0FBT087QUFDUjtBQUVPLFNBQVNFLFFBQVFYLE1BQU1DLFNBQVNXLE1BQU07QUFLNUMsTUFBSVYsSUFBSTtBQUNSLFNBQU9BLElBQUlGLEtBQUtHLFdBQVdDLFFBQVE7QUFDbEMsUUFBTUMsWUFBWUwsS0FBS0csV0FBV0QsQ0FBQztBQUNuQyxRQUFJRCxTQUFTO0FBR1osVUFBSUksVUFBVUMsYUFBYSxLQUFLQyxXQUFXRixTQUFTLE1BQU1KLFNBQVM7QUFDbEVXLGFBQUtQLFdBQVdILENBQUM7TUFDbEI7SUFDRCxPQUFPO0FBQ05VLFdBQUtQLFdBQVdILENBQUM7SUFDbEI7QUFDQUE7RUFDRDtBQUNEO0FBRU8sU0FBU1csSUFBSWIsTUFBTUMsU0FBU1csTUFBTTtBQUN4QyxNQUFNSCxVQUFVLENBQUE7QUFDaEJFLFVBQVFYLE1BQU1DLFNBQVMsU0FBQ0QsT0FBTUUsR0FBTTtBQUNuQ08sWUFBUUMsS0FBS0UsS0FBS1osT0FBTUUsQ0FBQyxDQUFDO0VBQzNCLENBQUM7QUFDRCxTQUFPTztBQUNSO0FBRUEsSUFBTUssb0JBQW9CO0FBQ25CLFNBQVNQLFdBQVdRLFNBQVM7QUFRbkMsU0FBT0EsUUFBUWQsUUFBUWUsUUFBUUYsbUJBQW1CLEVBQUU7QUFDckQ7QUFFTyxTQUFTRyxVQUFVakIsTUFBTTtBQUcvQixTQUFPQSxLQUFLTSxhQUFhO0FBQzFCO0FBRU8sU0FBU1kscUJBQXFCSCxTQUFTO0FBQzVDLE1BQUliLElBQUk7QUFDUixTQUFPQSxJQUFJYSxRQUFRWixXQUFXQyxRQUFRO0FBQ3JDLFFBQUlhLFVBQVVGLFFBQVFaLFdBQVdELENBQUMsQ0FBQyxHQUFHO0FBQ3RDLGFBQU9hLFFBQVFaLFdBQVdELENBQUM7SUFDNUI7QUFDRUE7RUFDRjtBQUNGO0FBR08sU0FBU2lCLFlBQVluQixNQUFNO0FBR2pDLE1BQUlBLEtBQUtNLGFBQWEsR0FBRztBQUN4QixXQUFPTixLQUFLb0I7RUFDYjtBQUVDLE1BQUlDLE1BQU0sTUFBTWQsV0FBV1AsSUFBSTtBQUUvQixNQUFJc0IsSUFBSTtBQUNSLFNBQU9BLElBQUl0QixLQUFLdUIsV0FBV25CLFFBQVE7QUFDakNpQixXQUFPLE1BQU1yQixLQUFLdUIsV0FBV0QsQ0FBQyxFQUFFRSxPQUFPLE9BQVl4QixLQUFLdUIsV0FBV0QsQ0FBQyxFQUFFRyxRQUFRO0FBQzlFSDtFQUNGO0FBRUFELFNBQU87QUFFUCxNQUFJbkIsSUFBSTtBQUNSLFNBQU9BLElBQUlGLEtBQUtHLFdBQVdDLFFBQVE7QUFDbENpQixXQUFPRixZQUFZbkIsS0FBS0csV0FBV0QsQ0FBQyxDQUFDO0FBQ3BDQTtFQUNGO0FBRUFtQixTQUFPLE9BQU9kLFdBQVdQLElBQUksSUFBSTtBQUVqQyxTQUFPcUI7QUFDVDs7O0FDNUdPLFNBQVNLLGdCQUFnQkMsV0FBVTtBQUN4QyxNQUFNQyxZQUFZRCxVQUFTRTtBQUMzQixNQUFNQyxZQUFZQyxVQUFVSCxXQUFXLFdBQVc7QUFFbEQsTUFBTUksUUFBUSxDQUFBO0FBQ2RDLFVBQVFILFdBQVcsT0FBTyxTQUFDSSxLQUFRO0FBQ2pDRCxZQUFRQyxLQUFLLEtBQUssU0FBQ0MsTUFBUztBQUMxQkgsWUFBTUksS0FBS0QsSUFBSTtJQUNqQixDQUFDO0VBQ0gsQ0FBQztBQUNELFNBQU9IO0FBQ1Q7QUFjTyxTQUFTSyxvQkFBb0JDLFdBQVVDLFNBQVM7QUFDckQsU0FBT0MsVUFBVUQsU0FBUyxHQUFHO0FBQy9CO0FBRU8sU0FBU0UseUJBQXlCSCxXQUFVQyxTQUFTO0FBSzFELE1BQU1HLG9CQUFvQkMscUJBQXFCSixPQUFPO0FBQ3RELE1BQUlHLHFCQUFxQkUsV0FBV0YsaUJBQWlCLE1BQU0sTUFBTTtBQUMvRCxRQUFNRyxxQ0FBcUNGLHFCQUFxQkQsaUJBQWlCO0FBQ2pGLFFBQUlHLHNDQUFzQ0QsV0FBV0Msa0NBQWtDLE1BQU0sS0FBSztBQUNoRyxhQUFPQSxtQ0FBbUNDO0lBQzVDO0VBQ0Y7QUFDRjtBQUVPLFNBQVNDLGNBQWNULFdBQVU7QUFDdEMsTUFBTVUsWUFBWVYsVUFBU1c7QUFDM0IsTUFBTUMsYUFBYVYsVUFBVVEsV0FBVyxXQUFXO0FBQ25ELE1BQUlFLFlBQVk7QUFDZCxXQUFPQSxXQUFXQyxhQUFhLEtBQUs7RUFDdEM7QUFDRjtBQUVPLFNBQVNDLGNBQWNkLFdBQVU7QUFDdEMsTUFBTWUsYUFBYWYsVUFBU1c7QUFDNUIsTUFBTUssZUFBZWQsVUFBVWEsWUFBWSxjQUFjO0FBQ3pELE1BQUlDLGNBQWM7QUFDaEIsV0FBT0MsYUFBYUQsY0FBYyxJQUFJO0VBQ3hDO0FBQ0EsU0FBTyxDQUFBO0FBQ1Q7QUFFTyxTQUFTRSxjQUFjbEIsV0FBVTtBQUN0QyxNQUFNZSxhQUFhZixVQUFTVztBQUM1QixNQUFNUSxVQUFVakIsVUFBVWEsWUFBWSxTQUFTO0FBQy9DLE1BQUksQ0FBQ0ksU0FBUztBQUNaLFdBQU8sQ0FBQTtFQUNUO0FBQ0EsU0FBT0YsYUFBYUUsU0FBUyxJQUFJO0FBQ25DO0FBRU8sU0FBU0MsaUJBQWlCcEIsV0FBVTtBQUN6QyxNQUFNZSxhQUFhZixVQUFTVztBQUM1QixNQUFJVSxnQkFBZ0IsQ0FBQTtBQUNwQixNQUFNQyxVQUFVcEIsVUFBVWEsWUFBWSxTQUFTO0FBQy9DLE1BQUlPLFNBQVM7QUFDWCxXQUFPTCxhQUFhSyxTQUFTLFFBQVE7RUFDdkM7QUFDQSxTQUFPLENBQUE7QUFDVDtBQUVPLFNBQVNDLGlCQUFpQnZCLFdBQVU7QUFLekMsTUFBTXdCLE1BQU14QixVQUFTVztBQUNyQixTQUFPYyxJQUFJRCxLQUFLLE1BQU0sU0FBQUUsUUFBVTtBQUM5QixRQUFNQyxJQUFJekIsVUFBVXdCLFFBQVEsR0FBRztBQUMvQixRQUFJQyxHQUFHO0FBQ0wsYUFBT0EsRUFBRW5CO0lBQ1g7QUFDQSxRQUFJb0IsUUFBUTtBQUNaQyxZQUFRSCxRQUFRLEtBQUssU0FBQ0ksR0FBTTtBQUMxQkYsZUFBUzFCLFVBQVU0QixHQUFHLEdBQUcsRUFBRXRCO0lBQzdCLENBQUM7QUFDRCxXQUFPb0I7RUFDVCxDQUFDO0FBQ0g7QUFFTyxTQUFTRyxzQkFBc0IvQixXQUFVO0FBQzlDLE1BQU1nQyxXQUFXaEMsVUFBU1c7QUFDMUIsU0FBT1QsVUFBVThCLFVBQVUsWUFBWTtBQUN6QztBQUVPLFNBQVNDLGlCQUFpQmpDLFdBQVU7QUFDekMsTUFBTWtDLGdCQUFnQmxDLFVBQVNXO0FBQy9CLFNBQU9NLGFBQWFpQixlQUFlLGNBQWM7QUFDbkQ7QUFFTyxTQUFTQyxVQUFVbkMsV0FBVTtBQUNsQyxNQUFNZ0MsV0FBV2hDLFVBQVNXO0FBQzFCLE1BQU15QixTQUFTbEMsVUFBVThCLFVBQVUsUUFBUTtBQUMzQyxTQUFPZixhQUFhbUIsUUFBUSxPQUFPO0FBQ3JDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUM5R2UsU0FBZixxQkFBNkNDLFNBQVNDLEtBQUs7QUFDekQsTUFBTUMsT0FBT0QsSUFBSUUsZUFBZUgsT0FBTztBQUt2QyxNQUFNSSxxQkFBcUJDLHNCQUFzQkgsSUFBSTtBQUNyRCxNQUFNSSxZQUFZQyxRQUFRSCxrQkFBa0IsS0FBS0EsbUJBQW1CSSxhQUFhLFVBQVUsTUFBTTtBQVlqRyxNQUFNQyxTQUFTLENBQUE7QUFDZixXQUFBQyxZQUFBQyxnQ0FBb0JDLFVBQVVWLElBQUksQ0FBQyxHQUFBVyxPQUFBLEVBQUFBLFFBQUFILFVBQUEsR0FBQUksUUFBRTtBQUFBLFFBQTFCQyxRQUFLRixNQUFBRztBQUNkLFFBQUlELE1BQU1QLGFBQWEsTUFBTSxHQUFHO0FBQzlCQyxhQUFPUSxLQUFLO1FBQ1ZDLElBQUlILE1BQU1QLGFBQWEsU0FBUztRQUNoQ1csTUFBTUosTUFBTVAsYUFBYSxNQUFNO1FBQy9CWSxZQUFZTCxNQUFNUCxhQUFhLE1BQU07TUFDdkMsQ0FBQztJQUNIO0VBQ0Y7QUFFQSxTQUFPO0lBQ0xGO0lBQ0FHO0VBQ0Y7QUFDRjs7O0FDM0JlLFNBQWYsZUFBdUNZLFNBQVNDLEtBQUs7QUFTbkQsTUFBTUMsWUFBV0QsSUFBSUUsZUFBZUgsT0FBTztBQUUzQyxNQUFNSSxZQUFZO0lBQ2hCQyxRQUFRLENBQUM7SUFDVEMsZUFBZUM7SUFDZkMsUUFBUUQ7RUFDVjtBQUVBLE1BQU1FLGtCQUFrQixTQUFsQkEsaUJBQW1CQyxjQUFpQjtBQUN4QyxRQUFNQyxXQUFXRCxhQUFhRSxhQUFhLFFBQVE7QUFDbkQsUUFBTUMsV0FBV0gsYUFBYUUsYUFBYSxNQUFNO0FBQ2pELFlBQVFDLFVBQVE7TUFDZCxLQUFLO0FBQ0hULGtCQUFVSSxTQUFTTSxZQUFZSCxRQUFRO0FBQ3ZDO01BQ0YsS0FBSztBQUNIUCxrQkFBVUUsZ0JBQWdCUSxZQUFZSCxRQUFRO0FBQzlDO01BQ0YsS0FBSztBQUNIUCxrQkFBVUMsT0FBT0ssYUFBYUUsYUFBYSxJQUFJLENBQUMsSUFBSUUsWUFBWUgsUUFBUTtBQUN4RTtJQUNKO0VBQ0Y7QUFFQUksbUJBQWlCYixTQUFRLEVBQUVjLFFBQVFQLGVBQWU7QUFTbEQsU0FBT0w7QUFDVDtBQUVBLFNBQVNVLFlBQVlHLE1BQU07QUFRekIsTUFBSUEsS0FBSyxDQUFDLE1BQU0sS0FBSztBQUNuQixXQUFPQSxLQUFLQyxNQUFNLElBQUlDLE1BQU07RUFDOUI7QUFNQSxTQUFPLFFBQVFGO0FBQ2pCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNsRWUsU0FBZixZQUFvQ0csU0FBU0MsS0FBSztBQUNoRCxNQUFJLENBQUNELFNBQVM7QUFDWixXQUFPLENBQUM7RUFDVjtBQUlBLE1BQU1FLE1BQU1ELElBQUlFLGVBQWVILE9BQU87QUFFdEMsTUFBTUksYUFBYUMsY0FBY0gsR0FBRyxFQUNqQ0ksSUFBSUMsY0FBYztBQUVyQixNQUFNQyxnQkFBZ0JDLGlCQUFpQlAsR0FBRyxFQUN2Q0ksSUFBSUksc0JBQXNCLEVBQzFCQyxPQUFPLFNBQUNDLFNBQVNDLFFBQVc7QUFHM0JELFlBQVFDLE9BQU9DLEVBQUUsSUFBSUQ7QUFDckIsV0FBT0Q7RUFDVCxHQUFHLENBQUEsQ0FBRTtBQUVQLE1BQU1HLGVBQWUsU0FBZkEsY0FBZ0JDLElBQU87QUFDM0IsUUFBSUEsR0FBR0MsYUFBYSxNQUFNLEdBQUc7QUFDM0IsYUFBQUMsY0FBQUEsY0FBQSxDQUFBLEdBQ0tkLFdBQVdZLEdBQUdHLElBQUksQ0FBQyxHQUNuQlosZUFBZVMsSUFBSVIsYUFBYSxDQUFDO0lBRXhDO0FBQ0EsV0FBT0QsZUFBZVMsSUFBSVIsYUFBYTtFQUN6QztBQUVBLFNBQU9ZLGNBQWNsQixHQUFHLEVBQUVJLElBQUlTLFlBQVk7QUFDNUM7QUFFQSxTQUFTTCx1QkFBdUJXLFFBQVE7QUFDdEMsU0FBTztJQUNMUCxJQUFJTyxPQUFPQyxhQUFhLFVBQVU7SUFDbENDLFVBQVVGLE9BQU9DLGFBQWEsWUFBWTtFQUM1QztBQUNGO0FBR0EsU0FBU2YsZUFBZVMsSUFBSVEsU0FBUztBQUNuQyxNQUFNQyxRQUFRLENBQUM7QUFDZixNQUFJVCxHQUFHQyxhQUFhLFVBQVUsR0FBRztBQUMvQixRQUFNUyxpQkFBaUJWLEdBQUdNLGFBQWEsVUFBVTtBQUdqRCxRQUFJRSxRQUFRRSxjQUFjLEdBQUc7QUFDM0JELFlBQU1FLGVBQWVILFFBQVFFLGNBQWM7SUFDN0MsT0FBTztBQUNMRCxZQUFNRSxlQUFlO1FBQUViLElBQUlZO01BQWU7SUFDNUM7RUFDRjtBQUNBLFNBQU9EO0FBQ1Q7OztBQzVEZSxTQUFmLG1CQUEyQ0csU0FBU0MsS0FBSztBQUN2RCxNQUFJLENBQUNELFNBQVM7QUFDWixXQUFPLENBQUE7RUFDVDtBQUNBLFNBQU9FLGlCQUFpQkQsSUFBSUUsZUFBZUgsT0FBTyxDQUFDO0FBQ3JEOzs7QUNGZSxTQUFmLGVBQXVDSSxpQkFBaUJDLFNBQVM7QUFzQi9ELE1BQUlBLFdBQVdBLFFBQVFDLFdBQVc7QUFFaENGLHdCQUFvQixPQUFPLFFBQVFHLGVBQWVDLHVCQUF1QkM7RUFDM0U7QUFFQSxNQUFNQyxzQkFBc0JGLHVCQUF1QkMsa0NBQWtDLE9BQU8sUUFBUUYsZUFBZUk7QUFFbkgsU0FBTyxJQUFJQyxLQUFLQyxLQUFLQyxPQUFPVixrQkFBa0JNLHVCQUF1QkssR0FBRyxDQUFDO0FBQzNFO0FBdUNBLElBQU1KLDZDQUE2QztBQUNuRCxJQUFNSCx1QkFBdUI7QUFDN0IsSUFBTUMsaUNBQWlDO0FBc0R2QyxJQUFNTSxNQUFNLEtBQUssS0FBSyxLQUFLO0FBQzNCLElBQU1SLGVBQWU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ3pIckIsSUFBTVMscUNBQXFDO0FBdUIzQyxJQUFNQywwQ0FBMEM7QUFFaEQsSUFBTUMsUUFBUSxDQUFDO0FBRUEsU0FBZixtQkFBMkNDLFVBQVU7QUFDcEQsTUFBSUEsWUFBWUQsT0FBTztBQUN0QixXQUFPQSxNQUFNQyxRQUFRO0VBQ3RCO0FBQ0EsTUFBTUMsU0FBU0MsYUFBYUYsUUFBUTtBQUNwQ0QsUUFBTUMsUUFBUSxJQUFJQztBQUNsQixTQUFPQTtBQUNSO0FBRUEsU0FBU0MsYUFBYUYsVUFBVTtBQUk5QkEsYUFBV0EsU0FBU0csWUFBWTtBQUloQ0gsYUFBV0EsU0FBU0ksUUFBUVAsb0NBQW9DLEVBQUU7QUFLbEVHLGFBQVdBLFNBQVNJLFFBQVFOLHlDQUF5QyxFQUFFO0FBSXZFLE1BQU1PLFNBQVNMLFNBQVNNLE1BQU0sS0FBSztBQUtuQyxNQUFJRCxPQUFPRSxTQUFTLEdBQUc7QUFDckIsV0FBTztFQUNUO0FBRUEsV0FBQUMsWUFBQUMsaUNBQW9CSixNQUFNLEdBQUFLLE9BQUEsRUFBQUEsUUFBQUYsVUFBQSxHQUFBRyxRQUFFO0FBQUEsUUFBakJDLFFBQUtGLE1BQUFHO0FBR2QsUUFBSUMscUJBQXFCQyxRQUFRSCxLQUFLLElBQUksR0FBRztBQUMzQyxhQUFPO0lBQ1Q7RUFDRjtBQUVBLFNBQU87QUFDVDtBQUlBLElBQU1FLHVCQUF1Qjs7RUFFM0I7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7O0VBRUE7Ozs7Ozs7RUFRQTtBQUFHOzs7QUNuSFUsU0FBZixrQkFBMENFLFNBQVNDLFFBQVFDLFNBQVM7QUFDbEUsTUFBSUYsU0FBUztBQUNYLFFBQU1HLFFBQVFGLE9BQU9ELE9BQU87QUFDNUIsUUFBSSxDQUFDRyxPQUFPO0FBQ1YsWUFBTSxJQUFJQyxNQUFLLHlCQUFBQyxPQUEwQkwsT0FBTyxDQUFFO0lBQ3BEO0FBQ0EsUUFBSSxDQUFDRyxNQUFNRyxjQUFjO0FBQ3ZCLGFBQU87SUFDVDtBQUNBOztNQUVFQyx5QkFBeUJDLFFBQVFDLE9BQU9OLE1BQU1HLGFBQWFJLEVBQUUsQ0FBQyxLQUFLOztNQUdsRVIsUUFBUVMsY0FBY1IsTUFBTUcsYUFBYU0sYUFBYVYsUUFBUVM7O01BRzlEVCxRQUFRVyxvQkFBb0IsU0FBU1YsTUFBTUcsYUFBYU0sWUFBWUUsbUJBQWFYLE1BQU1HLGFBQWFNLFFBQVE7TUFDNUc7QUFDRCxhQUFPO0lBQ1Q7RUFDRjtBQUNGO0FBV0EsSUFBTUcsOENBQThDO0VBQ2xEOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztBQUFJO0FBS04sSUFBTUMsZ0VBQWdFO0VBQ3BFOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztBQUFJO0FBS04sSUFBTUMscURBQXFEO0VBQ3pEOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztBQUFJO0FBS04sSUFBTUMsdUNBQXVDO0VBQzNDOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztFQUNBOztBQUFJO0FBSU4sSUFBTVgsMkJBQTJCUSw0Q0FBNENWOztFQUUzRVc7QUFDRixFQUFFWDs7RUFFQVksbURBQW1ERSxPQUNqRCxTQUFBQyxnQkFBYztBQUFBLFdBQUlKLDhEQUE4RFIsUUFBUVksY0FBYyxJQUFJO0VBQUMsQ0FDN0c7QUFDRixFQUFFZjs7RUFFQWEscUNBQXFDQyxPQUNuQyxTQUFBQyxnQkFBYztBQUFBLFdBQUlKLDhEQUE4RFIsUUFBUVksY0FBYyxJQUFJO0VBQUMsQ0FDN0csRUFBRUQsT0FDQSxTQUFBQyxnQkFBYztBQUFBLFdBQUlILG1EQUFtRFQsUUFBUVksY0FBYyxJQUFJO0VBQUMsQ0FDbEc7QUFDRjs7O0FDcEllLFNBQWYsZUFBdUNDLE9BQU9DLE1BQUlDLE1BUS9DO0FBQUEsTUFQREMsdUJBQW9CRCxLQUFwQkMsc0JBQ0FDLHFCQUFrQkYsS0FBbEJFLG9CQUNBQyxhQUFVSCxLQUFWRyxZQUNBQyxTQUFNSixLQUFOSSxRQUNBQyxnQkFBYUwsS0FBYkssZUFDQUMsWUFBU04sS0FBVE0sV0FDQUMsVUFBT1AsS0FBUE87QUFFQSxNQUFJLENBQUNSLE1BQU07QUFHVEEsV0FBTztFQUNUO0FBUUEsVUFBUUEsTUFBSTtJQUtWLEtBQUs7QUFDSEQsY0FBUVUsWUFBWVYsT0FBT1MsT0FBTztBQUNsQztJQUtGLEtBQUs7QUFDSFQsY0FBUUcscUJBQXFCO0FBQzdCLFVBQUlILFVBQVVXLFFBQVc7QUFDdkIsY0FBTSxJQUFJQyxNQUFLLHFEQUFBQyxPQUFzRFQsbUJBQW1CLENBQUMsQ0FBRTtNQUM3RjtBQUNBSixjQUFRVSxZQUFZVixPQUFPUyxPQUFPO0FBQ2xDO0lBT0YsS0FBSztBQUtILFVBQU1LLG9CQUFvQkMsT0FBT2YsS0FBSztBQUN0QyxVQUFJZ0IsTUFBTUYsaUJBQWlCLEdBQUc7QUFDNUIsY0FBTSxJQUFJRixNQUFLLGtDQUFBQyxPQUFtQ2IsS0FBSyxDQUFFO01BQzNEO0FBQ0EsVUFBSWMscUJBQXFCUCxjQUFjVSxRQUFRO0FBQzdDLGNBQU0sSUFBSUwsTUFBSywyQ0FBQUMsT0FBNENiLEtBQUssQ0FBRTtNQUNwRTtBQUNBQSxjQUFRTyxjQUFjTyxpQkFBaUI7QUFDdkNkLGNBQVFVLFlBQVlWLE9BQU9TLE9BQU87QUFDbEM7SUFJRixLQUFLO0FBQ0gsVUFBSVQsVUFBVSxLQUFLO0FBQ2pCQSxnQkFBUTtNQUNWLFdBQVdBLFVBQVUsS0FBSztBQUN4QkEsZ0JBQVE7TUFDVixPQUFPO0FBQ0wsY0FBTSxJQUFJWSxNQUFLLHFDQUFBQyxPQUFzQ2IsS0FBSyxDQUFFO01BQzlEO0FBQ0E7SUFJRixLQUFLO0FBQ0hBLGNBQVFXO0FBQ1I7SUFNRixLQUFLO0FBQ0hYLGNBQVFrQixZQUFZbEIsS0FBSztBQUN6QjtJQU9GLEtBQUs7QUFDSCxVQUFJQSxVQUFVVyxRQUFXO0FBQ3ZCO01BQ0Y7QUFDQSxVQUFNUSxhQUFhLElBQUlDLEtBQUtwQixLQUFLO0FBQ2pDLFVBQUlnQixNQUFNRyxXQUFXRSxRQUFRLENBQUMsR0FBRztBQUMvQixjQUFNLElBQUlULE1BQUssa0NBQUFDLE9BQW1DYixLQUFLLENBQUU7TUFDM0Q7QUFDQUEsY0FBUW1CO0FBQ1I7SUFHRixLQUFLO0FBQ0gsVUFBSW5CLFVBQVVXLFFBQVc7QUFDdkI7TUFDRjtBQUdBLFVBQU1XLFVBQVVqQixXQUFXO0FBQzNCLFVBQUlpQixXQUFXQyxrQkFBa0JELFNBQVNoQixRQUFRRyxPQUFPLEdBQUc7QUFFMURULGdCQUFRd0IsbUJBQW1CeEIsS0FBSztBQUVoQ0EsZ0JBQVF5QixlQUFlekIsT0FBTztVQUFFUTtRQUFVLENBQUM7TUFDN0MsT0FBTztBQUlMLFlBQU1rQixjQUFjakIsUUFBUWlCLGVBQWVGO0FBQzNDeEIsZ0JBQVEwQixZQUFZMUIsS0FBSztNQUMzQjtBQUNBO0lBRUY7QUFDRSxZQUFNLElBQUkyQixVQUFTLDRCQUFBZCxPQUE2QlosSUFBSSxDQUFFO0VBQzFEO0FBR0EsTUFBSUQsVUFBVVcsUUFBVztBQUN2QlgsWUFBUTtFQUNWO0FBRUEsU0FBT0E7QUFDVDtBQUlBLFNBQVNrQixZQUFZVSxXQUFXO0FBRzlCLFVBQVFBLFdBQVM7SUFDZixLQUFLO0FBQ0gsYUFBTztJQUNULEtBQUs7QUFDSCxhQUFPO0lBQ1QsS0FBSztBQUNILGFBQU87SUFDVCxLQUFLO0FBQ0gsYUFBTztJQUNULEtBQUs7QUFDSCxhQUFPO0lBQ1QsS0FBSztBQUNILGFBQU87SUFDVCxLQUFLO0FBQ0gsYUFBTztJQUNULEtBQUs7QUFDSCxhQUFPO0lBQ1Q7QUFFRSxhQUFBLFVBQUFmLE9BQWlCZSxTQUFTO0VBQzlCO0FBQ0Y7QUFFQSxTQUFTbEIsWUFBWVYsT0FBT1MsU0FBUztBQUtuQyxNQUFJQSxRQUFRb0IsU0FBUyxPQUFPO0FBQzFCN0IsWUFBUUEsTUFBTTZCLEtBQUs7RUFDckI7QUFDQSxNQUFJN0IsVUFBVSxJQUFJO0FBQ2hCQSxZQUFRVztFQUNWO0FBQ0EsU0FBT1g7QUFDVDtBQVFBLFNBQVN3QixtQkFBbUJNLG1CQUFtQjtBQUM3QyxNQUFNQyxlQUFlaEIsT0FBT2UsaUJBQWlCO0FBQzdDLE1BQUlkLE1BQU1lLFlBQVksR0FBRztBQUN2QixVQUFNLElBQUluQixNQUFLLGlDQUFBQyxPQUFrQ2lCLGlCQUFpQixDQUFFO0VBQ3RFO0FBQ0EsU0FBT0M7QUFDVDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNwTWUsU0FBZixxQkFBNkNDLG1CQUFtQjtBQUU5RCxNQUFBQyx3QkFBc0JELGtCQUFrQkUsTUFBTSxPQUFPLEdBQUNDLHlCQUFBQyxlQUFBSCx1QkFBQSxDQUFBLEdBQS9DSSxTQUFNRix1QkFBQSxDQUFBLEdBQUVHLE1BQUdILHVCQUFBLENBQUE7QUFDbEIsU0FBTzs7SUFFTEksT0FBT0QsR0FBRzs7OztJQUlWRSxpQ0FBaUNILE9BQU9JLEtBQUssQ0FBQztFQUFDO0FBRW5EO0FBR0EsSUFBTUMsVUFBVSxDQUFDLElBQUksS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxHQUFHO0FBSXJKLFNBQVNGLGlDQUFpQ0csZUFBZTtBQUV2RCxNQUFJQyxJQUFJO0FBQ1IsTUFBSUMsSUFBSTtBQUNSLFNBQU9BLElBQUlGLGNBQWNHLFFBQVE7QUFDL0JGLFNBQUs7QUFDTEEsU0FBS0YsUUFBUUssUUFBUUosY0FBY0UsQ0FBQyxDQUFDO0FBQ3JDQTtFQUNGO0FBQ0EsU0FBT0Q7QUFDVDs7O0FDU2UsU0FBZixVQUFrQ0ksU0FBU0MsZUFBZUMsZUFBZUMsUUFBUUMsV0FBV0MsU0FBUztBQUNuRyxNQUFNQyxjQUFjQyxxQkFBcUJQLFFBQVFRLGFBQWEsR0FBRyxDQUFDO0FBQ2xFLE1BQU1DLGVBQWVDLG9CQUFvQlQsZUFBZUQsT0FBTztBQU0vRCxNQUFNVyxRQUFRRixnQkFBZ0JBLGFBQWFHO0FBQzNDLE1BQU1DLE9BQU9iLFFBQVFRLGFBQWEsR0FBRztBQUVyQyxTQUFPO0lBQ0xNLEtBQUtSLFlBQVksQ0FBQztJQUNsQlMsUUFBUVQsWUFBWSxDQUFDO0lBQ3JCSyxPQUFPSyxlQUFlTCxPQUFPRSxNQUFNO01BQ2pDSSxzQkFBc0IsU0FBQUEsdUJBQUE7QUFBQSxlQUFNQyx5QkFBeUJqQixlQUFlRCxPQUFPO01BQUM7TUFDNUVtQixvQkFBb0IsU0FBQUEscUJBQUE7QUFBQSxlQUFNQyxZQUFZcEIsT0FBTztNQUFDO01BQzlDcUIsWUFBWSxTQUFBQSxhQUFBO0FBQUEsZUFBTXJCLFFBQVFRLGFBQWEsR0FBRztNQUFDO01BQzNDTDtNQUNBRDtNQUNBRTtNQUNBQztJQUNGLENBQUM7RUFDSDtBQUNGOzs7QUN6RGUsU0FBZixXQUFtQ2lCLGVBQWVDLGVBQWVDLFFBQVFDLFdBQVdDLFNBQVM7QUFDM0YsTUFBTUMsUUFBUUMsZ0JBQWdCTixhQUFhO0FBRTNDLE1BQUlLLE1BQU1FLFdBQVcsR0FBRztBQUN0QixXQUFPLENBQUE7RUFDVDtBQWdCQSxTQUFPRixNQUFNRyxJQUFJLFNBQUNDLFNBQVk7QUFDNUIsV0FBT0MsVUFBVUQsU0FBU1QsZUFBZUMsZUFBZUMsUUFBUUMsV0FBV0MsT0FBTztFQUNwRixDQUFDO0FBQ0g7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDdEJlLFNBQWYscUJBQTZDTyxlQUFlO0FBQzFELE1BQUlDLGFBQWFDLGNBQWNGLGFBQWE7QUFDNUMsTUFBSUMsWUFBWTtBQUNkQSxpQkFBYUEsV0FBV0UsTUFBTSxHQUFHLEVBQUVDLElBQUlDLG9CQUFvQixFQUFFRCxJQUFJLFNBQUFFLE1BQUE7QUFBQSxVQUFBQyxRQUFBQyxnQkFBQUYsTUFBQSxDQUFBLEdBQUVHLE1BQUdGLE1BQUEsQ0FBQSxHQUFFRyxTQUFNSCxNQUFBLENBQUE7QUFBQSxhQUFPO1FBQ25GRTtRQUNBQztNQUNGO0lBQUMsQ0FBQztBQVFGLFFBQUlULFdBQVdVLFdBQVcsR0FBRztBQUMzQlYsbUJBQWEsQ0FBQ0EsV0FBVyxDQUFDLEdBQUdBLFdBQVcsQ0FBQyxDQUFDO0lBQzVDO0FBQ0EsV0FBT0E7RUFDVDtBQUNGOzs7QUN6QmUsU0FBZix5Q0FBaUVXLE9BQU87QUFDdEUsTUFBTUMsYUFBYSxTQUFiQSxZQUFjQyxHQUFHQyxHQUFDO0FBQUEsV0FBS0QsSUFBSUM7RUFBQztBQUNsQyxNQUFNQyxVQUFVSixNQUFNSyxJQUFJLFNBQUFDLE1BQUk7QUFBQSxXQUFJQSxLQUFLQztFQUFHLENBQUEsRUFBRUMsS0FBS1AsVUFBVTtBQUMzRCxNQUFNUSxVQUFVVCxNQUFNSyxJQUFJLFNBQUFDLE1BQUk7QUFBQSxXQUFJQSxLQUFLSTtFQUFNLENBQUEsRUFBRUYsS0FBS1AsVUFBVTtBQUM5RCxNQUFNVSxTQUFTUCxRQUFRLENBQUM7QUFDeEIsTUFBTVEsU0FBU1IsUUFBUUEsUUFBUVMsU0FBUyxDQUFDO0FBQ3pDLE1BQU1DLFNBQVNMLFFBQVEsQ0FBQztBQUN4QixNQUFNTSxTQUFTTixRQUFRQSxRQUFRSSxTQUFTLENBQUM7QUFDekMsU0FBTyxDQUNMO0lBQUVOLEtBQUtJO0lBQVFELFFBQVFJO0VBQU8sR0FDOUI7SUFBRVAsS0FBS0s7SUFBUUYsUUFBUUs7RUFBTyxDQUFDO0FBRW5DOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNaZSxTQUFmLGNBQXNDQyxNQUk5QjtBQUFBLE1BQUFDLE9BQUFDLFVBQUFDLFNBQUEsS0FBQUQsVUFBQSxDQUFBLE1BQUFFLFNBQUFGLFVBQUEsQ0FBQSxJQUFKLENBQUMsR0FISEcsb0JBQWlCSixLQUFqQkksbUJBQWlCQyxnQkFBQUwsS0FDakJNLFVBQUFBLFdBQVFELGtCQUFBLFNBQUcsU0FBQUUsR0FBQztBQUFBLFdBQUlBO0VBQUMsSUFBQUYsZUFDakJHLG1CQUFnQlIsS0FBaEJRO0FBR0EsTUFBSUMsSUFBSVYsS0FBS0csU0FBUztBQUN0QixTQUFPTyxLQUFLLEdBQUc7QUFFYixRQUFJQyxRQUFRO0FBQ1osYUFBQUMsWUFBQUMsaUNBQW1CYixLQUFLVSxDQUFDLENBQUMsR0FBQUksT0FBQSxFQUFBQSxRQUFBRixVQUFBLEdBQUFHLFFBQUU7QUFBQSxVQUFqQkMsT0FBSUYsTUFBQUc7QUFDYixVQUFJVixTQUFTUyxJQUFJLE1BQU0sTUFBTTtBQUMzQkwsZ0JBQVE7QUFDUjtNQUNGO0lBQ0Y7QUFFQSxRQUFJQSxPQUFPO0FBQ1RYLFdBQUtrQixPQUFPUixHQUFHLENBQUM7QUFDaEIsVUFBSUwsbUJBQW1CO0FBQ3JCQSwwQkFBa0JhLE9BQU9SLEdBQUcsQ0FBQztNQUMvQjtJQUNGLFdBQVdELGtCQUFrQjtBQUMzQjtJQUNGO0FBQ0FDO0VBQ0Y7QUFDQSxTQUFPVjtBQUNUOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUM1QmUsU0FBZixpQkFBeUNtQixNQUdqQztBQUFBLE1BQUFDLE9BQUFDLFVBQUFDLFNBQUEsS0FBQUQsVUFBQSxDQUFBLE1BQUFFLFNBQUFGLFVBQUEsQ0FBQSxJQUFKLENBQUMsR0FBQ0csZ0JBQUFKLEtBRkpLLFVBQUFBLFdBQVFELGtCQUFBLFNBQUcsU0FBQUUsR0FBQztBQUFBLFdBQUlBO0VBQUMsSUFBQUYsZUFDakJHLG1CQUFnQlAsS0FBaEJPO0FBRUEsTUFBSUMsSUFBSVQsS0FBSyxDQUFDLEVBQUVHLFNBQVM7QUFDekIsU0FBT00sS0FBSyxHQUFHO0FBQ2IsUUFBSUMsUUFBUTtBQUNaLGFBQUFDLFlBQUFDLGlDQUFrQlosSUFBSSxHQUFBYSxPQUFBLEVBQUFBLFFBQUFGLFVBQUEsR0FBQUcsUUFBRTtBQUFBLFVBQWJDLE1BQUdGLE1BQUFHO0FBQ1osVUFBSVYsU0FBU1MsSUFBSU4sQ0FBQyxDQUFDLE1BQU0sTUFBTTtBQUM3QkMsZ0JBQVE7QUFDUjtNQUNGO0lBQ0Y7QUFDQSxRQUFJQSxPQUFPO0FBQ1QsVUFBSU8sSUFBSTtBQUNSLGFBQU9BLElBQUlqQixLQUFLRyxRQUFRO0FBQ3RCSCxhQUFLaUIsQ0FBQyxFQUFFQyxPQUFPVCxHQUFHLENBQUM7QUFDbkJRO01BQ0Y7SUFDRixXQUFXVCxrQkFBa0I7QUFDM0I7SUFDRjtBQUNBQztFQUNGO0FBQ0EsU0FBT1Q7QUFDVDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDdEJlLFNBQWYsMEJBQWtEbUIsT0FBT0MsWUFBWTtBQUVuRSxNQUFJRCxNQUFNRSxXQUFXLEdBQUc7QUFDdEIsV0FBTyxDQUFBO0VBQ1Q7QUFFQSxNQUFBQyxjQUFBQyxnQkFBK0JILFlBQVUsQ0FBQSxHQUFsQ0ksVUFBT0YsWUFBQSxDQUFBLEdBQUVHLGNBQVdILFlBQUEsQ0FBQTtBQVEzQixNQUFNSSxZQUFZRCxZQUFZRTtBQUM5QixNQUFNQyxZQUFZSCxZQUFZSTtBQUc5QixNQUFJQyxPQUFPLElBQUlDLE1BQU1ILFNBQVM7QUFDOUIsTUFBSUksSUFBSTtBQUNSLFNBQU9BLElBQUlKLFdBQVc7QUFDcEJFLFNBQUtFLENBQUMsSUFBSSxJQUFJRCxNQUFNTCxTQUFTO0FBQzdCLFFBQUlPLElBQUk7QUFDUixXQUFPQSxJQUFJUCxXQUFXO0FBQ3BCSSxXQUFLRSxDQUFDLEVBQUVDLENBQUMsSUFBSTtBQUNiQTtJQUNGO0FBQ0FEO0VBQ0Y7QUFNQSxXQUFBRSxZQUFBQyxpQ0FBbUJoQixLQUFLLEdBQUFpQixPQUFBLEVBQUFBLFFBQUFGLFVBQUEsR0FBQUcsUUFBRTtBQUFBLFFBQWZDLE9BQUlGLE1BQUFHO0FBTWIsUUFBTUMsV0FBV0YsS0FBS1QsTUFBTTtBQUM1QixRQUFNWSxjQUFjSCxLQUFLWCxTQUFTO0FBRWxDLFFBQUljLGNBQWNmLGFBQWFjLFdBQVdaLFdBQVc7QUFDbkRFLFdBQUtVLFFBQVEsRUFBRUMsV0FBVyxJQUFJSCxLQUFLQztJQUNyQztFQUNGO0FBYUFULFNBQU9ZO0lBQ0xDLGlCQUFpQmIsTUFBTTtNQUFFYyxrQkFBa0I7SUFBSyxDQUFDO0lBQ2pEO01BQUVBLGtCQUFrQjtJQUFLOztFQUMzQjtBQUVBLFNBQU9kO0FBQ1Q7OztBQy9EZSxTQUFmLFdBQW1DZSxTQUFTQyxLQUFLQyxlQUFlQyxRQUFRQyxXQUFXQyxTQUFTO0FBQzFGLE1BQU1DLGdCQUFnQkwsSUFBSU0sZUFBZVAsT0FBTztBQUVoRCxNQUFNUSxRQUFRQyxXQUFXSCxlQUFlSixlQUFlQyxRQUFRQyxXQUFXQyxPQUFPO0FBSWpGLE1BQU1LLGFBQWFDLHFCQUFxQkwsYUFBYSxLQUFLTSx5Q0FBeUNKLEtBQUs7QUFFeEcsU0FBT0ssMEJBQTBCTCxPQUFPRSxVQUFVO0FBQ3BEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNDZSxTQUFmLHlCQUFpREksVUFBVUMsS0FBbUI7QUFBQSxNQUFkQyxVQUFPQyxVQUFBQyxTQUFBLEtBQUFELFVBQUEsQ0FBQSxNQUFBRSxTQUFBRixVQUFBLENBQUEsSUFBRyxDQUFDO0FBQ3pFLE1BQU1HLGlCQUFpQixTQUFqQkEsZ0JBQWtCQyxVQUFhO0FBQ25DLFFBQUksQ0FBQ1AsU0FBU08sUUFBUSxHQUFHO0FBQ3ZCLFlBQU0sSUFBSUMsTUFBSyxJQUFBQyxPQUFLRixVQUFRLHFEQUFBLENBQXFEO0lBQ25GO0FBQ0EsV0FBT1AsU0FBU08sUUFBUTtFQUMxQjtBQUtBLE1BQU1HLFlBQVlDLGVBQWVMLGVBQWUsNEJBQTRCLEdBQUdMLEdBQUc7QUFHbEYsTUFBTVcsZ0JBQWdCRixVQUFVRSxnQkFDNUJDLG1CQUFtQlAsZUFBZUksVUFBVUUsYUFBYSxHQUFHWCxHQUFHLElBQy9ELENBQUE7QUFHSixNQUFNYSxTQUFTSixVQUFVSSxTQUNyQkMsWUFBWVQsZUFBZUksVUFBVUksTUFBTSxHQUFHYixHQUFHLElBQ2pELENBQUM7QUFFTCxNQUFBZSx3QkFBOEJDLHFCQUFxQlgsZUFBZSxpQkFBaUIsR0FBR0wsR0FBRyxHQUFqRmlCLFNBQU1GLHNCQUFORSxRQUFRQyxZQUFTSCxzQkFBVEc7QUFFaEIsTUFBTUMsaUJBQWlCbEIsUUFBUWdCLFVBQVVoQixRQUFRZ0IsT0FBT0csSUFBSSxTQUFBQyxPQUFLO0FBQUEsV0FBSUMsV0FBV0QsT0FBT0osTUFBTTtFQUFDLENBQUE7QUFJOUYsTUFBTU0sYUFBYSxDQUFBO0FBRW5CLFdBQUFDLEtBQUEsR0FBQUMsZUFBc0JDLE9BQU9DLEtBQUtsQixVQUFVUSxNQUFNLEdBQUNPLEtBQUFDLGFBQUF0QixRQUFBcUIsTUFBRTtBQUFoRCxRQUFNSSxVQUFPSCxhQUFBRCxFQUFBO0FBQ2hCLFFBQUlMLGtCQUFrQixDQUFDQSxlQUFlVSxTQUFTRCxPQUFPLEdBQUc7QUFDdkQ7SUFDRjtBQUVBTCxlQUFXTyxLQUFLO01BQ2RULE9BQU9VLGlCQUFpQkgsU0FBU1gsTUFBTTtNQUN2Q2UsTUFBTUMsV0FDSjVCLGVBQWVJLFVBQVVRLE9BQU9XLE9BQU8sQ0FBQyxHQUN4QzVCLEtBQ0FXLGVBQ0FFLFFBQ0FLLFdBQ0FqQixPQUNGO0lBQ0YsQ0FBQztFQUNIO0FBR0EsU0FBT3NCO0FBQ1Q7QUFFQSxTQUFTRCxXQUFXRCxPQUFPSixRQUFRO0FBQ2pDLE1BQUksT0FBT0ksVUFBVSxVQUFVO0FBQzdCLGFBQUFhLFlBQUFDLGlDQUFxQmxCLE1BQU0sR0FBQW1CLE9BQUEsRUFBQUEsUUFBQUYsVUFBQSxHQUFBRyxRQUFFO0FBQUEsVUFBbEJDLFNBQU1GLE1BQUFHO0FBQ2YsVUFBSUQsT0FBT0UsU0FBU25CLE9BQU87QUFDekIsZUFBT2lCLE9BQU9HO01BQ2hCO0lBQ0Y7QUFDRixVQUFNLElBQUlsQyxNQUFLLFVBQUFDLE9BQVdhLE9BQUssaUNBQUEsRUFBQWIsT0FBa0NTLE9BQU9HLElBQUksU0FBQXNCLE1BQUE7QUFBQSxVQUFHRixPQUFJRSxLQUFKRjtBQUFJLGFBQUEsSUFBQWhDLE9BQVdnQyxNQUFJLEdBQUE7SUFBQSxDQUFHLEVBQUVHLEtBQUssSUFBSSxDQUFDLENBQUU7RUFDbkgsT0FBTztBQUNQLFFBQUl0QixTQUFTSixPQUFPZCxRQUFRO0FBQ3hCLGFBQU9jLE9BQU9JLFFBQVEsQ0FBQyxFQUFFb0I7SUFDM0I7QUFDQSxVQUFNLElBQUlsQyxNQUFLLCtCQUFBQyxPQUFnQ2EsT0FBSyw0QkFBQSxFQUFBYixPQUE2QlMsT0FBT2QsTUFBTSxDQUFFO0VBQ2xHO0FBQ0Y7QUFFQSxTQUFTNEIsaUJBQWlCSCxTQUFTWCxRQUFRO0FBQ3pDLFdBQUEyQixhQUFBVCxpQ0FBb0JsQixNQUFNLEdBQUE0QixRQUFBLEVBQUFBLFNBQUFELFdBQUEsR0FBQVAsUUFBRTtBQUFBLFFBQWpCaEIsUUFBS3dCLE9BQUFOO0FBQ2QsUUFBSWxCLE1BQU1vQixlQUFlYixTQUFTO0FBQ2hDLGFBQU9QLE1BQU1tQjtJQUNmO0VBQ0Y7QUFDQSxRQUFNLElBQUlqQyxNQUFLLHVCQUFBQyxPQUF3Qm9CLE9BQU8sQ0FBRTtBQUNsRDs7O0FDakZlLFNBQWYsYUFBcUNrQixPQUFPQyxTQUFTO0FBQ3BELFNBQU9DLGVBQWVGLEtBQUssRUFDekJHLEtBQUssU0FBQ0MsVUFBUTtBQUFBLFdBQUtDLHlCQUF5QkQsVUFBVUUsb0JBQUtMLE9BQU87RUFBQyxDQUFBO0FBQ3RFOzs7QUNIQSxlQUFzQixlQUFlLE1BQXlDO0FBQzVFLFFBQU0sTUFBTSxNQUFNLGFBQWEsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUNoRSxTQUFPLElBQUksSUFBSSxDQUFDLE9BQU87QUFBQSxJQUNyQixNQUFNLEVBQUU7QUFBQSxJQUNSLE1BQU0sRUFBRSxLQUFLLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLFNBQVUsU0FBUyxTQUFZLE9BQVEsSUFBbUIsQ0FBQztBQUFBLEVBQ2hHLEVBQUU7QUFDSjs7O0FDdUNBLElBQU0sWUFBWTtBQUNsQixJQUFNLFNBQVM7QUFDZixJQUFNLGVBQWU7QUFDckIsSUFBTSxpQkFBaUI7QUFDdkIsSUFBTSx3QkFBd0I7QUFDOUIsSUFBTSxpQkFBc0Msb0JBQUksSUFBSSxDQUFDLFFBQVEsU0FBUyxPQUFPLE1BQU0sS0FBSyxHQUFHLENBQUM7QUFDNUYsSUFBTSxTQUEyQztBQUFBLEVBQy9DLFNBQVM7QUFBQSxFQUFHLFVBQVU7QUFBQSxFQUFHLE9BQU87QUFBQSxFQUFHLE9BQU87QUFBQSxFQUFHLEtBQUs7QUFBQSxFQUFHLE1BQU07QUFBQSxFQUMzRCxNQUFNO0FBQUEsRUFBRyxRQUFRO0FBQUEsRUFBRyxXQUFXO0FBQUEsRUFBRyxTQUFTO0FBQUEsRUFBSSxVQUFVO0FBQUEsRUFBSSxVQUFVO0FBQUEsRUFDdkUsS0FBSztBQUFBLEVBQUcsS0FBSztBQUFBLEVBQUcsS0FBSztBQUFBLEVBQUcsS0FBSztBQUFBLEVBQUcsS0FBSztBQUFBLEVBQUcsS0FBSztBQUFBLEVBQUcsS0FBSztBQUFBLEVBQUcsS0FBSztBQUFBLEVBQUcsS0FBSztBQUFBLEVBQUksS0FBSztBQUFBLEVBQUksS0FBSztBQUN6RjtBQVFPLFNBQVMsWUFBWSxHQUF3QjtBQUNsRCxNQUFJLE9BQU8sTUFBTSxFQUFFLFFBQVEsQ0FBQztBQUFHLFdBQU87QUFDdEMsTUFBSSxFQUFFLFlBQVksTUFBTSxLQUFLLEVBQUUsY0FBYyxNQUFNLEtBQUssRUFBRSxjQUFjLE1BQU0sS0FBSyxFQUFFLG1CQUFtQixNQUFNO0FBQUcsV0FBTztBQUN4SCxTQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sR0FBRyxFQUFFO0FBQ3BDO0FBR08sU0FBUyxRQUFRLEdBQXNCO0FBQzVDLFNBQU8sYUFBYSxPQUFPLEVBQUUsWUFBWSxJQUFJLE9BQU8sQ0FBQyxFQUFFLEtBQUs7QUFDOUQ7QUFHTyxTQUFTLFlBQVksR0FBdUI7QUFDakQsU0FBTyxNQUFNLFFBQVEsTUFBTSxVQUFjLE9BQU8sTUFBTSxZQUFZLEVBQUUsS0FBSyxNQUFNO0FBQ2pGO0FBRUEsU0FBUyxZQUFZLEdBQVcsR0FBbUI7QUFDakQsU0FBTyxJQUFJLEtBQUssS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxXQUFXO0FBQ2hEO0FBRUEsU0FBUyxTQUFTLEdBQVcsR0FBVyxHQUFvQjtBQUMxRCxNQUFJLElBQUksS0FBSyxJQUFJLE1BQU0sSUFBSTtBQUFHLFdBQU87QUFDckMsU0FBTyxLQUFLLFlBQVksR0FBRyxDQUFDO0FBQzlCO0FBRUEsU0FBUyxJQUFJLEdBQVcsR0FBVyxHQUFtQjtBQUNwRCxTQUFPLEdBQUcsT0FBTyxDQUFDLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDO0FBQ2xHO0FBTU8sU0FBUyxjQUFjLE9BQThCO0FBQzFELFFBQU0sSUFBSSxNQUFNLEtBQUs7QUFDckIsTUFBSSxJQUFJLE9BQU8sS0FBSyxDQUFDO0FBQ3JCLE1BQUksR0FBRztBQUNMLFVBQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDNUQsV0FBTyxTQUFTLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJO0FBQUEsRUFDOUM7QUFDQSxNQUFJLGFBQWEsS0FBSyxDQUFDO0FBQ3ZCLE1BQUksR0FBRztBQUNMLFVBQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDNUQsV0FBTyxTQUFTLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJO0FBQUEsRUFDOUM7QUFDQSxNQUFJLGVBQWUsS0FBSyxDQUFDO0FBQ3pCLE1BQUksR0FBRztBQUNMLFVBQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ3JCLFVBQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ3JCLFVBQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ3JCLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSSxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQ3JCLFlBQU07QUFDTixjQUFRO0FBQUEsSUFDVixXQUFXLElBQUksTUFBTSxLQUFLLElBQUk7QUFDNUIsWUFBTTtBQUNOLGNBQVE7QUFBQSxJQUNWLE9BQU87QUFDTCxhQUFPO0FBQUEsSUFDVDtBQUNBLFdBQU8sU0FBUyxHQUFHLE9BQU8sR0FBRyxJQUFJLElBQUksR0FBRyxPQUFPLEdBQUcsSUFBSTtBQUFBLEVBQ3hEO0FBQ0EsTUFBSSxzQkFBc0IsS0FBSyxDQUFDO0FBQ2hDLE1BQUksR0FBRztBQUNMLFVBQU0sUUFBUSxPQUFPLEVBQUUsQ0FBQyxFQUFFLFlBQVksQ0FBQztBQUN2QyxRQUFJLFVBQVU7QUFBVyxhQUFPO0FBQ2hDLFVBQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ3JCLFVBQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ3JCLFdBQU8sU0FBUyxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSTtBQUFBLEVBQ3BEO0FBQ0EsU0FBTztBQUNUO0FBRUEsU0FBUyxnQkFBZ0IsR0FBdUI7QUFDOUMsTUFBSSxPQUFPLE1BQU07QUFBVyxXQUFPO0FBQ25DLE1BQUksT0FBTyxNQUFNO0FBQVUsV0FBTyxNQUFNLEtBQUssTUFBTTtBQUNuRCxNQUFJLE9BQU8sTUFBTTtBQUFVLFdBQU8sZUFBZSxJQUFJLEVBQUUsS0FBSyxFQUFFLFlBQVksQ0FBQztBQUMzRSxTQUFPO0FBQ1Q7QUFFQSxTQUFTLGNBQWMsR0FBdUI7QUFDNUMsTUFBSSxPQUFPLE1BQU07QUFBVSxXQUFPLE9BQU8sU0FBUyxDQUFDO0FBQ25ELE1BQUksT0FBTyxNQUFNLFVBQVU7QUFDekIsVUFBTSxJQUFJLEVBQUUsS0FBSztBQUNqQixXQUFPLFVBQVUsS0FBSyxDQUFDLEtBQUssT0FBTyxTQUFTLE9BQU8sQ0FBQyxDQUFDO0FBQUEsRUFDdkQ7QUFDQSxTQUFPO0FBQ1Q7QUFFQSxTQUFTLFlBQVksR0FBdUI7QUFDMUMsTUFBSSxhQUFhO0FBQU0sV0FBTyxZQUFZLENBQUMsTUFBTTtBQUNqRCxNQUFJLE9BQU8sTUFBTTtBQUFVLFdBQU8sY0FBYyxDQUFDLE1BQU07QUFDdkQsU0FBTztBQUNUO0FBRUEsSUFBTSxXQUE4RTtBQUFBLEVBQ2xGLENBQUMsWUFBWSxlQUFlO0FBQUEsRUFDNUIsQ0FBQyxVQUFVLGFBQWE7QUFBQSxFQUN4QixDQUFDLFFBQVEsV0FBVztBQUN0QjtBQUdPLFNBQVMsWUFBWSxRQUE4QixVQUE0QixDQUFDLEdBQW9CO0FBQ3pHLFFBQU0sWUFBWSxRQUFRLGFBQWE7QUFDdkMsUUFBTSxjQUFjLFFBQVEscUJBQXFCO0FBQ2pELFFBQU0sV0FBVyxRQUFRLGtCQUFrQjtBQUUzQyxRQUFNLGlCQUE4QixDQUFDO0FBQ3JDLGFBQVcsS0FBSztBQUFRLFFBQUksQ0FBQyxZQUFZLENBQUM7QUFBRyxxQkFBZSxLQUFLLENBQUM7QUFDbEUsUUFBTSxXQUFXLGVBQWU7QUFFaEMsUUFBTSxjQUFjLG9CQUFJLElBQVk7QUFDcEMsUUFBTSxnQkFBMEIsQ0FBQztBQUNqQyxhQUFXLEtBQUssZ0JBQWdCO0FBQzlCLFVBQU0sTUFBTSxRQUFRLENBQUM7QUFDckIsUUFBSSxDQUFDLFlBQVksSUFBSSxHQUFHLEdBQUc7QUFDekIsa0JBQVksSUFBSSxHQUFHO0FBQ25CLG9CQUFjLEtBQUssR0FBRztBQUFBLElBQ3hCO0FBQUEsRUFDRjtBQUNBLFFBQU0sV0FBVyxZQUFZO0FBRTdCLE1BQUksYUFBYSxHQUFHO0FBQ2xCLFdBQU8sRUFBRSxNQUFNLFFBQVEsUUFBUSx1QkFBdUIsVUFBVSxVQUFVLFlBQVksRUFBRTtBQUFBLEVBQzFGO0FBRUEsYUFBVyxDQUFDLE1BQU0sT0FBTyxLQUFLLFVBQVU7QUFDdEMsUUFBSSxLQUFLO0FBQ1QsZUFBVyxLQUFLO0FBQWdCLFVBQUksUUFBUSxDQUFDO0FBQUc7QUFDaEQsVUFBTSxRQUFRLEtBQUs7QUFDbkIsUUFBSSxTQUFTLElBQUksV0FBVztBQUMxQixhQUFPO0FBQUEsUUFDTDtBQUFBLFFBQ0EsUUFBUSxVQUFVLElBQUksT0FBTyxRQUFRLDJCQUEyQixJQUFJLEtBQUssSUFBSSxRQUFRLEtBQUssUUFBUSxDQUFDLENBQUMscUJBQXFCLElBQUk7QUFBQSxRQUM3SDtBQUFBLFFBQ0E7QUFBQSxRQUNBLFlBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxNQUFJLFlBQVksZUFBZSxXQUFXLFlBQVksVUFBVTtBQUM5RCxXQUFPO0FBQUEsTUFDTCxNQUFNO0FBQUEsTUFDTixRQUFRLEdBQUcsUUFBUSx3QkFBd0IsV0FBVyxVQUFVLFdBQVcsV0FBVyxLQUFLLFFBQVEsQ0FBQyxDQUFDLGlCQUFpQixXQUFXLEdBQUc7QUFBQSxNQUNwSTtBQUFBLE1BQ0E7QUFBQSxNQUNBLFlBQVk7QUFBQSxNQUNaO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixRQUFRLHlCQUF5QixRQUFRO0FBQUEsSUFDekM7QUFBQSxJQUNBO0FBQUEsSUFDQSxZQUFZO0FBQUEsRUFDZDtBQUNGO0FBR08sU0FBUyxXQUFXLE1BQXlDLGFBQXFCLFVBQTRCLENBQUMsR0FBc0I7QUFDMUksUUFBTSxNQUF5QixDQUFDO0FBQ2hDLFdBQVMsSUFBSSxHQUFHLElBQUksYUFBYSxLQUFLO0FBQ3BDLFVBQU0sU0FBc0IsSUFBSSxNQUFpQixLQUFLLE1BQU07QUFDNUQsYUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLFFBQVE7QUFBSyxhQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDO0FBQzNELFFBQUksS0FBSyxZQUFZLFFBQVEsT0FBTyxDQUFDO0FBQUEsRUFDdkM7QUFDQSxTQUFPO0FBQ1Q7OztBQ2xQQSxJQUFNLFFBQVE7QUFFZCxTQUFTLFNBQVMsUUFBZ0IsU0FBaUIsSUFBWTtBQUM3RCxRQUFNLFFBQVEsSUFBSSxXQUFXLE1BQU07QUFDbkMsU0FBTyxnQkFBZ0IsS0FBSztBQUM1QixNQUFJLFNBQVM7QUFDYixXQUFTLElBQUksR0FBRyxJQUFJLFFBQVEsS0FBSztBQUMvQixjQUFVLE1BQU0sTUFBTSxDQUFDLElBQUksTUFBTSxNQUFNO0FBQUEsRUFDekM7QUFDQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLGdCQUF3QjtBQUN0QyxTQUFPLFNBQVMsTUFBTTtBQUN4QjtBQUVPLFNBQVMsa0JBQTBCO0FBQ3hDLFNBQU8sU0FBUyxNQUFNO0FBQ3hCO0FBRU8sU0FBUyxtQkFBMkI7QUFDekMsU0FBTyxTQUFTLE1BQU07QUFDeEI7QUFFTyxTQUFTLGtCQUEwQjtBQUN4QyxTQUFPLFNBQVMsTUFBTTtBQUN4QjtBQUVPLFNBQVMsaUJBQXlCO0FBQ3ZDLFNBQU8sU0FBUyxPQUFPO0FBQ3pCOzs7QUNuQkEsSUFBTSxvQkFBeUMsb0JBQUksSUFBSSxDQUFDLFNBQVMsVUFBVSxTQUFTLFdBQVcsTUFBTSxDQUFDO0FBQ3RHLElBQU0sbUJBQXdDLG9CQUFJLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQztBQUVyRSxTQUFTLFVBQVUsTUFBc0M7QUFDdkQsU0FBTztBQUFBLElBQ0wsSUFBSSxLQUFLO0FBQUEsSUFDVCxNQUFNLEtBQUs7QUFBQSxJQUNYLE1BQU0sS0FBSyxLQUFLLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVMsV0FBVyxFQUFFLFVBQVUsRUFBRTtBQUFBLElBQzNFLFNBQVMsS0FBSztBQUFBLElBQ2QsUUFBUSxDQUFDLEdBQUcsS0FBSyxNQUFNO0FBQUEsSUFDdkIsZUFBZSxLQUFLO0FBQUEsSUFDcEIsV0FBVyxLQUFLO0FBQUEsSUFDaEIsY0FBYyxFQUFFLEdBQUcsS0FBSyxhQUFhO0FBQUEsSUFDckMsYUFBYSxDQUFDLEdBQUcsS0FBSyxXQUFXO0FBQUEsSUFDakMsR0FBSSxLQUFLLFdBQVcsRUFBRSxVQUFVLENBQUMsR0FBRyxLQUFLLFFBQVEsRUFBRSxJQUFJLENBQUM7QUFBQSxFQUMxRDtBQUNGO0FBRUEsU0FBUyxrQkFBa0IsUUFBMkIsT0FBTyxXQUEyQjtBQUN0RixRQUFNLGNBQWMsT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUU7QUFDMUMsU0FBTztBQUFBLElBQ0wsSUFBSSxlQUFlO0FBQUEsSUFDbkI7QUFBQSxJQUNBLE1BQU0sQ0FBQztBQUFBLElBQ1AsU0FBUztBQUFBLElBQ1QsUUFBUSxDQUFDO0FBQUEsSUFDVCxlQUFlO0FBQUEsSUFDZixXQUFXO0FBQUEsSUFDWCxjQUFjLENBQUM7QUFBQSxJQUNmO0FBQUEsSUFDQSxVQUFVLENBQUM7QUFBQSxFQUNiO0FBQ0Y7QUFjTyxTQUFTLGFBQWEsTUFBc0IsUUFBaUQ7QUFDbEcsUUFBTSxXQUFxQixDQUFDO0FBQzVCLFFBQU0sU0FBbUIsQ0FBQztBQUMxQixRQUFNLFdBQVcsSUFBSSxJQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7QUFDaEQsUUFBTSxVQUFVLE9BQU8sS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPO0FBQzVDLFFBQU0sWUFBWSxTQUFTO0FBRzNCLFFBQU0sYUFBNkIsVUFBVSxJQUFJO0FBR2pELE1BQUksQ0FBQyxNQUFNLFFBQVEsV0FBVyxRQUFRO0FBQUcsZUFBVyxXQUFXLENBQUM7QUFHaEUsUUFBTSxXQUFXLE1BQU0sUUFBUSxLQUFLLElBQUksSUFBSSxLQUFLLE9BQU8sQ0FBQztBQUN6RCxRQUFNLFlBQXlCLENBQUM7QUFDaEMsYUFBVyxTQUFTLFVBQVU7QUFDNUIsUUFBSSxDQUFDLFNBQVMsT0FBTyxNQUFNLFlBQVksVUFBVTtBQUMvQyxlQUFTLEtBQUsseUNBQXlDO0FBQ3ZEO0FBQUEsSUFDRjtBQUNBLFFBQUksQ0FBQyxTQUFTLElBQUksTUFBTSxPQUFPLEdBQUc7QUFDaEMsZUFBUyxLQUFLLGVBQWUsTUFBTSxPQUFPLDZCQUF3QjtBQUNsRTtBQUFBLElBQ0Y7QUFDQSxRQUFJLENBQUMsaUJBQWlCLElBQUksTUFBTSxTQUFTLEdBQUc7QUFDMUMsZUFBUyxLQUFLLG1CQUFtQixNQUFNLFNBQVMsZ0JBQWdCLE1BQU0sT0FBTywwQkFBcUI7QUFDbEc7QUFBQSxJQUNGO0FBQ0EsY0FBVSxLQUFLLEVBQUUsU0FBUyxNQUFNLFNBQVMsV0FBVyxNQUFNLFVBQVUsQ0FBQztBQUFBLEVBQ3ZFO0FBQ0EsYUFBVyxPQUFPO0FBR2xCLE1BQUksV0FBVyxZQUFZLFFBQVEsV0FBVyxZQUFZLFFBQVc7QUFDbkUsUUFBSSxPQUFPLFdBQVcsWUFBWSxVQUFVO0FBQzFDLGVBQVMsS0FBSyxxQ0FBZ0M7QUFDOUMsaUJBQVcsVUFBVTtBQUFBLElBQ3ZCLFdBQVcsQ0FBQyxTQUFTLElBQUksV0FBVyxPQUFPLEdBQUc7QUFDNUMsZUFBUyxLQUFLLGtCQUFrQixXQUFXLE9BQU8sNkJBQXdCO0FBQzFFLGlCQUFXLFVBQVU7QUFBQSxJQUN2QjtBQUFBLEVBQ0YsT0FBTztBQUNMLGVBQVcsVUFBVTtBQUFBLEVBQ3ZCO0FBR0EsUUFBTSxhQUFhLE1BQU0sUUFBUSxLQUFLLE1BQU0sSUFBSSxLQUFLLFNBQVMsQ0FBQztBQUMvRCxRQUFNLGNBQXdCLENBQUM7QUFDL0IsYUFBVyxPQUFPLFlBQVk7QUFDNUIsUUFBSSxPQUFPLFFBQVEsVUFBVTtBQUMzQixlQUFTLEtBQUssaUJBQWlCLE9BQU8sR0FBRyxDQUFDLCtCQUEwQjtBQUNwRTtBQUFBLElBQ0Y7QUFDQSxRQUFJLENBQUMsU0FBUyxJQUFJLEdBQUcsR0FBRztBQUN0QixlQUFTLEtBQUssaUJBQWlCLEdBQUcsNkJBQXdCO0FBQzFEO0FBQUEsSUFDRjtBQUNBLGdCQUFZLEtBQUssR0FBRztBQUFBLEVBQ3RCO0FBRUEsTUFBSSxhQUFhLFlBQVksU0FBUyxTQUFTLEdBQUc7QUFDaEQsV0FBTyxLQUFLLGtCQUFrQixTQUFTLFFBQVEsU0FBUyw0QkFBNEI7QUFBQSxFQUl0RjtBQUNBLGFBQVcsU0FBUztBQUdwQixRQUFNLFlBQVksS0FBSztBQUN2QixNQUFJLENBQUMsTUFBTSxRQUFRLFNBQVMsR0FBRztBQUM3QixhQUFTLEtBQUsscURBQWdEO0FBQzlELGVBQVcsY0FBYyxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRTtBQUFBLEVBQ2pELE9BQU87QUFDTCxVQUFNLE9BQU8sb0JBQUksSUFBWTtBQUM3QixVQUFNLGFBQXVCLENBQUM7QUFDOUIsZUFBVyxPQUFPLFdBQVc7QUFDM0IsVUFBSSxPQUFPLFFBQVEsVUFBVTtBQUMzQixpQkFBUyxLQUFLLHNCQUFzQixPQUFPLEdBQUcsQ0FBQywrQkFBMEI7QUFDekU7QUFBQSxNQUNGO0FBQ0EsVUFBSSxDQUFDLFNBQVMsSUFBSSxHQUFHLEdBQUc7QUFDdEIsaUJBQVMsS0FBSyxzQkFBc0IsR0FBRyw2QkFBd0I7QUFDL0Q7QUFBQSxNQUNGO0FBQ0EsVUFBSSxLQUFLLElBQUksR0FBRyxHQUFHO0FBQ2pCLGlCQUFTLEtBQUssZ0NBQWdDLEdBQUcsa0JBQWE7QUFDOUQ7QUFBQSxNQUNGO0FBQ0EsV0FBSyxJQUFJLEdBQUc7QUFDWixpQkFBVyxLQUFLLEdBQUc7QUFBQSxJQUNyQjtBQUVBLFVBQU0sVUFBVSxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztBQUNwRSxRQUFJLFFBQVEsU0FBUyxHQUFHO0FBQ3RCLGVBQVMsS0FBSyw4QkFBOEIsUUFBUSxLQUFLLEdBQUcsQ0FBQyxrQkFBYTtBQUMxRSxpQkFBVyxLQUFLLEdBQUcsT0FBTztBQUFBLElBQzVCO0FBRUEsUUFBSSxXQUFXLFdBQVcsT0FBTyxRQUFRO0FBQ3ZDLGVBQVMsS0FBSyxzQkFBc0IsVUFBVSxNQUFNLGlCQUFpQixXQUFXLE1BQU0sRUFBRTtBQUFBLElBQzFGO0FBQ0EsZUFBVyxjQUFjO0FBQUEsRUFDM0I7QUFHQSxRQUFNLGFBQWEsS0FBSyxnQkFBZ0IsT0FBTyxLQUFLLGlCQUFpQixXQUFXLEtBQUssZUFBZSxDQUFDO0FBQ3JHLFFBQU0sY0FBc0MsQ0FBQztBQUM3QyxhQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssT0FBTyxRQUFRLFVBQXFDLEdBQUc7QUFDNUUsUUFBSSxDQUFDLFNBQVMsSUFBSSxHQUFHLEdBQUc7QUFDdEIsZUFBUyxLQUFLLHVCQUF1QixHQUFHLDZCQUF3QjtBQUNoRTtBQUFBLElBQ0Y7QUFDQSxRQUFJLE9BQU8sTUFBTSxZQUFZLENBQUMsT0FBTyxVQUFVLENBQUMsS0FBSyxJQUFJLEdBQUc7QUFDMUQsZUFBUyxLQUFLLDJCQUEyQixHQUFHLHdCQUF3QixPQUFPLENBQUMsQ0FBQyxrQkFBYTtBQUMxRjtBQUFBLElBQ0Y7QUFFQSxRQUFJLElBQUksSUFBSTtBQUNWLGVBQVMsS0FBSywyQkFBMkIsR0FBRyxXQUFXLENBQUMsd0RBQW1EO0FBQUEsSUFDN0c7QUFDQSxnQkFBWSxHQUFHLElBQUk7QUFBQSxFQUNyQjtBQUNBLGFBQVcsZUFBZTtBQUcxQixNQUFJLFNBQVMsS0FBSztBQUNsQixNQUFJLE9BQU8sV0FBVyxZQUFZLENBQUMsT0FBTyxVQUFVLE1BQU0sR0FBRztBQUMzRCxhQUFTLEtBQUssK0JBQStCLE9BQU8sTUFBTSxDQUFDLG1CQUFjO0FBQ3pFLGFBQVM7QUFBQSxFQUNYO0FBQ0EsTUFBSSxTQUFTLEdBQUc7QUFDZCxhQUFTLEtBQUssaUJBQWlCLE1BQU0sOEJBQXlCO0FBQzlELGFBQVM7QUFBQSxFQUNYLFdBQVcsU0FBUyxPQUFPLFFBQVE7QUFDakMsYUFBUyxLQUFLLGlCQUFpQixNQUFNLHdCQUF3QixPQUFPLE1BQU0sc0JBQWlCLE9BQU8sTUFBTSxFQUFFO0FBQzFHLGFBQVMsT0FBTztBQUFBLEVBQ2xCO0FBQ0EsYUFBVyxnQkFBZ0I7QUFHM0IsUUFBTSxLQUFLLEtBQUs7QUFDaEIsTUFBSSxDQUFDLGtCQUFrQixJQUFJLEVBQUUsR0FBRztBQUM5QixhQUFTLEtBQUssY0FBYyxPQUFPLEVBQUUsQ0FBQyxrQ0FBNkI7QUFDbkUsZUFBVyxZQUFZO0FBQUEsRUFDekIsT0FBTztBQUNMLGVBQVcsWUFBWTtBQUFBLEVBQ3pCO0FBSUEsUUFBTSxjQUFjLENBQUMsR0FBRyxRQUFRO0FBRWhDLGFBQVcsV0FBVztBQUV0QixRQUFNLEtBQUssT0FBTyxXQUFXO0FBQzdCLFNBQU8sRUFBRSxNQUFNLFlBQVksVUFBVSxhQUFhLFFBQVEsR0FBRztBQUMvRDtBQXdETyxTQUFTLHFCQUFxQixPQUF5QixRQUE2QztBQUN6RyxTQUFPLE1BQU0sSUFBSSxDQUFDLE1BQU0sYUFBYSxHQUFHLE1BQU0sRUFBRSxJQUFJO0FBQ3REOzs7QUM3UE8sU0FBUyxNQUFNLE9BQTRCO0FBRWhELE1BQUk7QUFDSixNQUFJO0FBQ0YsV0FBTyxLQUFLLE1BQU0sS0FBSztBQUFBLEVBQ3pCLFNBQVMsR0FBRztBQUNWLFVBQU0sTUFBTSxhQUFhLFFBQVEsRUFBRSxVQUFVLE9BQU8sQ0FBQztBQUVyRCxVQUFNLFFBQVEsSUFBSSxNQUFNLGdCQUFnQjtBQUN4QyxRQUFJLE9BQU87QUFDVCxZQUFNLE1BQU0sU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBQ2pDLFlBQU0sRUFBRSxNQUFNLE9BQU8sSUFBSSxnQkFBZ0IsT0FBTyxHQUFHO0FBQ25ELGFBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTyxpQkFBaUIsR0FBRyxJQUFJLE1BQU0sT0FBTztBQUFBLElBQ2xFO0FBQ0EsV0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLGlCQUFpQixHQUFHLEdBQUc7QUFBQSxFQUNwRDtBQUdBLE1BQUksT0FBTyxTQUFTLFlBQVksU0FBUyxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUc7QUFDcEUsV0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLDhCQUE4QixNQUFNLEdBQUcsUUFBUSxFQUFFO0FBQUEsRUFDOUU7QUFFQSxRQUFNLE1BQU07QUFHWixNQUFJLEVBQUUsbUJBQW1CLE1BQU07QUFDN0IsV0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLHNDQUFzQztBQUFBLEVBQ25FO0FBQ0EsTUFBSSxJQUFJLGtCQUFrQixHQUFHO0FBQzNCLFdBQU87QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sOEJBQThCLEtBQUssVUFBVSxJQUFJLGFBQWEsQ0FBQztBQUFBLElBQ3hFO0FBQUEsRUFDRjtBQUdBLFFBQU0sZUFBZSxDQUFDLFdBQVcsUUFBUSxVQUFVLFFBQVEsU0FBUyxVQUFVO0FBQzlFLGFBQVcsT0FBTyxjQUFjO0FBQzlCLFFBQUksRUFBRSxPQUFPLE1BQU07QUFDakIsYUFBTyxFQUFFLElBQUksT0FBTyxPQUFPLHlCQUF5QixHQUFHLEdBQUc7QUFBQSxJQUM1RDtBQUFBLEVBQ0Y7QUFHQSxNQUFJLE9BQU8sSUFBSSxZQUFZLFVBQVU7QUFDbkMsV0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLDJCQUEyQjtBQUFBLEVBQ3hEO0FBQ0EsTUFBSSxPQUFPLElBQUksU0FBUyxVQUFVO0FBQ2hDLFdBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTyx3QkFBd0I7QUFBQSxFQUNyRDtBQUNBLE1BQUksQ0FBQyxNQUFNLFFBQVEsSUFBSSxNQUFNLEdBQUc7QUFDOUIsV0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLDBCQUEwQjtBQUFBLEVBQ3ZEO0FBQ0EsTUFBSSxDQUFDLE1BQU0sUUFBUSxJQUFJLElBQUksR0FBRztBQUM1QixXQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sd0JBQXdCO0FBQUEsRUFDckQ7QUFDQSxNQUFJLENBQUMsTUFBTSxRQUFRLElBQUksS0FBSyxHQUFHO0FBQzdCLFdBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTyx5QkFBeUI7QUFBQSxFQUN0RDtBQUNBLE1BQUksSUFBSSxPQUFPLFNBQVMsR0FBRztBQUN6QixXQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sc0NBQXNDO0FBQUEsRUFDbkU7QUFDQSxNQUFJLElBQUksTUFBTSxTQUFTLEdBQUc7QUFDeEIsV0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLHFDQUFxQztBQUFBLEVBQ2xFO0FBR0EsV0FBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLE9BQU8sUUFBUSxLQUFLO0FBQzFDLFVBQU0sUUFBUSxJQUFJLE9BQU8sQ0FBQztBQUMxQixRQUFJLE9BQU8sVUFBVSxZQUFZLFVBQVUsTUFBTTtBQUMvQyxhQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sVUFBVSxDQUFDLHNCQUFzQjtBQUFBLElBQzlEO0FBQ0EsUUFBSSxPQUFPLE1BQU0sT0FBTyxVQUFVO0FBQ2hDLGFBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTyxVQUFVLENBQUMsd0JBQXdCO0FBQUEsSUFDaEU7QUFDQSxRQUFJLE9BQU8sTUFBTSxTQUFTLFVBQVU7QUFDbEMsYUFBTyxFQUFFLElBQUksT0FBTyxPQUFPLFVBQVUsQ0FBQywwQkFBMEI7QUFBQSxJQUNsRTtBQUNBLFFBQUksT0FBTyxNQUFNLFNBQVMsVUFBVTtBQUNsQyxhQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sVUFBVSxDQUFDLDBCQUEwQjtBQUFBLElBQ2xFO0FBQUEsRUFDRjtBQUdBLFdBQVMsSUFBSSxHQUFHLElBQUksSUFBSSxLQUFLLFFBQVEsS0FBSztBQUN4QyxVQUFNLE1BQU0sSUFBSSxLQUFLLENBQUM7QUFDdEIsUUFBSSxPQUFPLFFBQVEsWUFBWSxRQUFRLE1BQU07QUFDM0MsYUFBTyxFQUFFLElBQUksT0FBTyxPQUFPLFFBQVEsQ0FBQyxzQkFBc0I7QUFBQSxJQUM1RDtBQUNBLFFBQUksT0FBTyxJQUFJLE9BQU8sVUFBVTtBQUM5QixhQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sUUFBUSxDQUFDLHdCQUF3QjtBQUFBLElBQzlEO0FBQ0EsUUFBSSxPQUFPLElBQUksUUFBUSxZQUFZLENBQUMsT0FBTyxVQUFVLElBQUksR0FBRyxHQUFHO0FBQzdELGFBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTyxRQUFRLENBQUMsMkJBQTJCO0FBQUEsSUFDakU7QUFDQSxRQUFJLE9BQU8sSUFBSSxjQUFjLFVBQVU7QUFDckMsYUFBTyxFQUFFLElBQUksT0FBTyxPQUFPLFFBQVEsQ0FBQywrQkFBK0I7QUFBQSxJQUNyRTtBQUNBLFFBQUksT0FBTyxJQUFJLFdBQVcsWUFBWSxJQUFJLFdBQVcsTUFBTTtBQUN6RCxhQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sUUFBUSxDQUFDLDZCQUE2QjtBQUFBLElBQ25FO0FBQ0EsUUFBSSxJQUFJLFNBQVMsTUFBTTtBQUNyQixhQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sUUFBUSxDQUFDLDRCQUE0QjtBQUFBLElBQ2xFO0FBQUEsRUFDRjtBQUdBLFFBQU0sZ0JBQWdCLElBQUk7QUFDMUIsV0FBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQ3pDLFVBQU0sT0FBTyxJQUFJLE1BQU0sQ0FBQztBQUN4QixRQUFJLE9BQU8sU0FBUyxZQUFZLFNBQVMsTUFBTTtBQUM3QyxhQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sU0FBUyxDQUFDLHNCQUFzQjtBQUFBLElBQzdEO0FBQ0EsUUFBSSxPQUFPLEtBQUssT0FBTyxVQUFVO0FBQy9CLGFBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTyxTQUFTLENBQUMsd0JBQXdCO0FBQUEsSUFDL0Q7QUFBQSxFQUNGO0FBS0EsTUFBSTtBQUNGLFVBQU0sa0JBQW1CLElBQUksTUFBc0MsSUFBSSxDQUFDLEdBQUcsUUFBUTtBQUVqRixZQUFNLG1CQUFtQjtBQUFBLFFBQ3ZCLElBQUksRUFBRTtBQUFBLFFBQ04sTUFBTSxFQUFFLFFBQVE7QUFBQSxRQUNoQixNQUFNLE1BQU0sUUFBUSxFQUFFLElBQUksSUFBSSxFQUFFLE9BQU8sQ0FBQztBQUFBLFFBQ3hDLFNBQVMsRUFBRSxXQUFXO0FBQUEsUUFDdEIsUUFBUSxNQUFNLFFBQVEsRUFBRSxNQUFNLElBQUksRUFBRSxTQUFTLENBQUM7QUFBQSxRQUM5QyxlQUFlLE9BQU8sRUFBRSxrQkFBa0IsV0FBVyxFQUFFLGdCQUFnQjtBQUFBLFFBQ3ZFLFdBQVcsRUFBRSxhQUFhO0FBQUEsUUFDMUIsY0FBYyxFQUFFLGdCQUFnQixPQUFPLEVBQUUsaUJBQWlCLFdBQVcsRUFBRSxlQUFlLENBQUM7QUFBQSxRQUN2RixhQUFhLE1BQU0sUUFBUyxFQUF5QyxXQUFXLElBQzFFLEVBQXlDLGNBQzNDLGNBQWMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFO0FBQUEsUUFDakMsVUFBVSxNQUFNLFFBQVMsRUFBeUMsUUFBUSxJQUNwRSxFQUF5QyxXQUMzQyxDQUFDO0FBQUEsTUFDUDtBQUNBLFlBQU0sU0FBUyxhQUFhLGtCQUFrQixhQUFhO0FBRzNELFVBQUksQ0FBQyxPQUFPLE1BQU0sT0FBTyxPQUFPLFNBQVMsR0FBRztBQUUxQyxjQUFNLFVBQVUsY0FBYyxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU87QUFDbkQsWUFBSSxXQUFXLE9BQU8sS0FBSyxPQUFPLFNBQVMsUUFBUSxFQUFFLEdBQUc7QUFDdEQsaUJBQU8sS0FBSyxTQUFTLE9BQU8sS0FBSyxPQUFPLE9BQU8sQ0FBQyxPQUFPLE9BQU8sUUFBUSxFQUFFO0FBQ3hFLGlCQUFPLEtBQUssV0FBVyxDQUFDLEdBQUksT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFJLGtCQUFrQixRQUFRLElBQUksMkNBQXNDO0FBQzdILGlCQUFPLFNBQVMsS0FBSyxrQkFBa0IsUUFBUSxJQUFJLDJDQUFzQztBQUN6RixpQkFBTyxTQUFTLE9BQU8sT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsU0FBUyxlQUFlLENBQUM7QUFDeEUsaUJBQU8sS0FBSyxPQUFPLE9BQU8sV0FBVztBQUFBLFFBQ3ZDO0FBQUEsTUFDRjtBQUVBLFlBQU0sV0FBVyxJQUFJLE1BQU0sR0FBRztBQUM5QixpQkFBVyxLQUFLLE9BQU8sS0FBSyxRQUFRLEdBQUc7QUFDckMsWUFBSSxFQUFFLEtBQUssT0FBTyxPQUFPO0FBQ3ZCLFVBQUMsT0FBTyxLQUFpQyxDQUFDLElBQUksU0FBUyxDQUFDO0FBQUEsUUFDMUQ7QUFBQSxNQUNGO0FBQ0EsYUFBTyxPQUFPO0FBQUEsSUFDaEIsQ0FBQztBQUNELFFBQUksUUFBUTtBQUFBLEVBQ2QsUUFBUTtBQUVOLFdBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTyw0QkFBNEI7QUFBQSxFQUN6RDtBQUdBLE1BQUksSUFBSSxhQUFhLE1BQU07QUFDekIsV0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLDhCQUE4QjtBQUFBLEVBQzNEO0FBR0EsU0FBTyxFQUFFLElBQUksTUFBTSxNQUFNLElBQThCO0FBQ3pEO0FBS0EsU0FBUyxnQkFBZ0IsTUFBYyxRQUFrRDtBQUN2RixNQUFJLE9BQU87QUFDWCxNQUFJLFNBQVM7QUFDYixXQUFTLElBQUksR0FBRyxJQUFJLFVBQVUsSUFBSSxLQUFLLFFBQVEsS0FBSztBQUNsRCxRQUFJLEtBQUssQ0FBQyxNQUFNLE1BQU07QUFDcEI7QUFDQSxlQUFTO0FBQUEsSUFDWCxPQUFPO0FBQ0w7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNBLFNBQU8sRUFBRSxNQUFNLE9BQU87QUFDeEI7OztBQy9NTyxTQUFTLFVBQVUsTUFBMkI7QUFDbkQsUUFBTSxVQUFVLGNBQWMsSUFBSTtBQUNsQyxTQUFPLEtBQUssVUFBVSxTQUFTLE1BQU0sQ0FBQyxJQUFJO0FBQzVDO0FBR0EsSUFBTSxpQkFBaUIsQ0FBQyxpQkFBaUIsV0FBVyxRQUFRLFVBQVUsUUFBUSxTQUFTLFVBQVU7QUFHakcsSUFBTSxhQUFhLENBQUMsTUFBTSxRQUFRLFFBQVEsV0FBVyxXQUFXLFlBQVksVUFBVSxPQUFPLE9BQU8sT0FBTztBQUczRyxJQUFNLFdBQVcsQ0FBQyxNQUFNLE9BQU8sYUFBYSxhQUFhLFVBQVUsTUFBTTtBQUd6RSxJQUFNLFlBQVksQ0FBQyxNQUFNLFFBQVEsUUFBUSxXQUFXLFVBQVUsaUJBQWlCLGFBQWEsZ0JBQWdCLGVBQWUsVUFBVTtBQUdySSxJQUFNLGNBQWMsQ0FBQyxNQUFNLFFBQVEsT0FBTztBQUUxQyxTQUFTLGNBQWMsTUFBNEM7QUFDakUsUUFBTSxTQUFrQyxDQUFDO0FBRXpDLFFBQU0saUJBQWlCLEtBQUssUUFBUSxxQkFBcUIsS0FBSyxPQUEyQixLQUFLLE1BQTJCLElBQUksS0FBSztBQUNsSSxhQUFXLE9BQU8sZ0JBQWdCO0FBQ2hDLFFBQUksT0FBTyxNQUFNO0FBQ2YsVUFBSSxRQUFRLFVBQVU7QUFDcEIsZUFBTyxHQUFHLElBQUssS0FBSyxPQUE2QixJQUFJLFVBQVU7QUFBQSxNQUNqRSxXQUFXLFFBQVEsUUFBUTtBQUN6QixlQUFPLEdBQUcsSUFBSyxLQUFLLEtBQWUsSUFBSSxRQUFRO0FBQUEsTUFDakQsV0FBVyxRQUFRLFNBQVM7QUFDMUIsZUFBTyxHQUFHLElBQUssZUFBb0MsSUFBSSxTQUFTO0FBQUEsTUFDbEUsT0FBTztBQUNMLGVBQU8sR0FBRyxJQUFJLEtBQUssR0FBRztBQUFBLE1BQ3hCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxhQUFXLE9BQU8sT0FBTyxLQUFLLElBQUksR0FBRztBQUNuQyxRQUFJLENBQUUsZUFBcUMsU0FBUyxHQUFHLEdBQUc7QUFDeEQsYUFBTyxHQUFHLElBQUksS0FBSyxHQUFHO0FBQUEsSUFDeEI7QUFBQSxFQUNGO0FBQ0EsU0FBTztBQUNUO0FBRUEsU0FBUyxXQUFXLE9BQWlEO0FBQ25FLFFBQU0sU0FBa0MsQ0FBQztBQUN6QyxhQUFXLE9BQU8sWUFBWTtBQUM1QixRQUFJLE9BQU8sT0FBTztBQUNoQixVQUFJLFFBQVEsYUFBYSxNQUFNLFNBQVM7QUFDdEMsZUFBTyxHQUFHLElBQUksTUFBTSxRQUFRLElBQUksV0FBVztBQUFBLE1BQzdDLE9BQU87QUFDTCxlQUFPLEdBQUcsSUFBSSxNQUFNLEdBQTRCO0FBQUEsTUFDbEQ7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUVBLGFBQVcsT0FBTyxPQUFPLEtBQUssS0FBSyxHQUFHO0FBQ3BDLFFBQUksQ0FBRSxXQUFpQyxTQUFTLEdBQUcsR0FBRztBQUNwRCxhQUFPLEdBQUcsSUFBSyxNQUFrQyxHQUFHO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQ0EsU0FBTztBQUNUO0FBRUEsU0FBUyxTQUFTLEtBQW1DO0FBQ25ELFFBQU0sU0FBa0MsQ0FBQztBQUN6QyxhQUFXLE9BQU8sVUFBVTtBQUMxQixRQUFJLE9BQU8sS0FBSztBQUNkLGFBQU8sR0FBRyxJQUFLLElBQWdDLEdBQUc7QUFBQSxJQUNwRDtBQUFBLEVBQ0Y7QUFFQSxhQUFXLE9BQU8sT0FBTyxLQUFLLEdBQUcsR0FBRztBQUNsQyxRQUFJLENBQUUsU0FBK0IsU0FBUyxHQUFHLEdBQUc7QUFDbEQsYUFBTyxHQUFHLElBQUssSUFBZ0MsR0FBRztBQUFBLElBQ3BEO0FBQUEsRUFDRjtBQUNBLFNBQU87QUFDVDtBQUVBLFNBQVMsVUFBVSxNQUErQztBQUNoRSxRQUFNLFNBQWtDLENBQUM7QUFDekMsYUFBVyxPQUFPLFdBQVc7QUFDM0IsUUFBSSxPQUFPLE1BQU07QUFDZixhQUFPLEdBQUcsSUFBSyxLQUFpQyxHQUFHO0FBQUEsSUFDckQ7QUFBQSxFQUNGO0FBRUEsYUFBVyxPQUFPLE9BQU8sS0FBSyxJQUFJLEdBQUc7QUFDbkMsUUFBSSxDQUFFLFVBQWdDLFNBQVMsR0FBRyxHQUFHO0FBQ25ELGFBQU8sR0FBRyxJQUFLLEtBQWlDLEdBQUc7QUFBQSxJQUNyRDtBQUFBLEVBQ0Y7QUFDQSxTQUFPO0FBQ1Q7QUFFQSxTQUFTLFlBQVksUUFBK0M7QUFDbEUsUUFBTSxTQUFrQyxDQUFDO0FBQ3pDLGFBQVcsT0FBTyxhQUFhO0FBQzdCLFFBQUksT0FBTyxRQUFRO0FBQ2pCLGFBQU8sR0FBRyxJQUFLLE9BQW1DLEdBQUc7QUFBQSxJQUN2RDtBQUFBLEVBQ0Y7QUFFQSxhQUFXLE9BQU8sT0FBTyxLQUFLLE1BQU0sR0FBRztBQUNyQyxRQUFJLENBQUUsWUFBa0MsU0FBUyxHQUFHLEdBQUc7QUFDckQsYUFBTyxHQUFHLElBQUssT0FBbUMsR0FBRztBQUFBLElBQ3ZEO0FBQUEsRUFDRjtBQUNBLFNBQU87QUFDVDs7O0FDN0dBLElBQU0sb0JBQW9CO0FBTW5CLFNBQVMsY0FDZCxRQUNBLE1BQ3VCO0FBQ3ZCLFFBQU0sYUFBb0MsQ0FBQztBQUUzQyxhQUFXLFNBQVMsUUFBUTtBQUMxQixlQUFXLE9BQU8sTUFBTTtBQUN0QixZQUFNLGlCQUFpQixhQUFhLE9BQU8sSUFBSSxPQUFPLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBSSxFQUFFO0FBQzdFLGlCQUFXLEtBQUssR0FBRyxjQUFjO0FBQUEsSUFDbkM7QUFBQSxFQUNGO0FBRUEsU0FBTztBQUNUO0FBTU8sU0FBUyxhQUNkLE9BQ0EsT0FDQSxTQUNBLGNBQ3VCO0FBQ3ZCLFFBQU0sYUFBb0MsQ0FBQztBQUMzQyxRQUFNLFFBQVEsZ0JBQWdCO0FBRzlCLE1BQUksTUFBTSxVQUFVO0FBQ2xCLFFBQUksVUFBVSxRQUFRLFVBQVUsTUFBTyxNQUFNLFFBQVEsS0FBSyxLQUFLLE1BQU0sV0FBVyxHQUFJO0FBQ2xGLGlCQUFXLEtBQUs7QUFBQSxRQUNkO0FBQUEsUUFDQSxTQUFTLE1BQU07QUFBQSxRQUNmLE1BQU07QUFBQSxRQUNOLFNBQVMsR0FBRyxNQUFNLElBQUk7QUFBQSxNQUN4QixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFHQSxNQUFJLFVBQVUsUUFBUSxVQUFVO0FBQUksV0FBTztBQUczQyxNQUFJLE1BQU0sUUFBUSxRQUFRLE1BQU0sUUFBUSxRQUFXO0FBQ2pELFFBQUksT0FBTyxVQUFVLFlBQVksT0FBTyxNQUFNLFFBQVEsVUFBVTtBQUM5RCxVQUFJLFFBQVEsTUFBTSxLQUFLO0FBQ3JCLG1CQUFXLEtBQUs7QUFBQSxVQUNkO0FBQUEsVUFDQSxTQUFTLE1BQU07QUFBQSxVQUNmLE1BQU07QUFBQSxVQUNOLFNBQVMsR0FBRyxNQUFNLElBQUkscUJBQXFCLE1BQU0sR0FBRztBQUFBLFFBQ3RELENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRixXQUFXLE9BQU8sVUFBVSxZQUFZLE9BQU8sTUFBTSxRQUFRLFVBQVU7QUFDckUsVUFBSSxRQUFRLE1BQU0sS0FBSztBQUNyQixtQkFBVyxLQUFLO0FBQUEsVUFDZDtBQUFBLFVBQ0EsU0FBUyxNQUFNO0FBQUEsVUFDZixNQUFNO0FBQUEsVUFDTixTQUFTLEdBQUcsTUFBTSxJQUFJLHFCQUFxQixNQUFNLEdBQUc7QUFBQSxRQUN0RCxDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBR0EsTUFBSSxNQUFNLFFBQVEsUUFBUSxNQUFNLFFBQVEsUUFBVztBQUNqRCxRQUFJLE9BQU8sVUFBVSxZQUFZLE9BQU8sTUFBTSxRQUFRLFVBQVU7QUFDOUQsVUFBSSxRQUFRLE1BQU0sS0FBSztBQUNyQixtQkFBVyxLQUFLO0FBQUEsVUFDZDtBQUFBLFVBQ0EsU0FBUyxNQUFNO0FBQUEsVUFDZixNQUFNO0FBQUEsVUFDTixTQUFTLEdBQUcsTUFBTSxJQUFJLG9CQUFvQixNQUFNLEdBQUc7QUFBQSxRQUNyRCxDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0YsV0FBVyxPQUFPLFVBQVUsWUFBWSxPQUFPLE1BQU0sUUFBUSxVQUFVO0FBQ3JFLFVBQUksUUFBUSxNQUFNLEtBQUs7QUFDckIsbUJBQVcsS0FBSztBQUFBLFVBQ2Q7QUFBQSxVQUNBLFNBQVMsTUFBTTtBQUFBLFVBQ2YsTUFBTTtBQUFBLFVBQ04sU0FBUyxHQUFHLE1BQU0sSUFBSSxvQkFBb0IsTUFBTSxHQUFHO0FBQUEsUUFDckQsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUdBLE1BQUksTUFBTSxPQUFPO0FBQ2YsVUFBTSxXQUFXLE9BQU8sVUFBVSxXQUFXLFFBQVEsT0FBTyxLQUFLO0FBQ2pFLFFBQUksU0FBUyxTQUFTLG1CQUFtQjtBQUN2QyxpQkFBVyxLQUFLO0FBQUEsUUFDZDtBQUFBLFFBQ0EsU0FBUyxNQUFNO0FBQUEsUUFDZixNQUFNO0FBQUEsUUFDTixTQUFTLEdBQUcsTUFBTSxJQUFJLGtDQUFrQyxpQkFBaUI7QUFBQSxNQUMzRSxDQUFDO0FBQUEsSUFDSCxPQUFPO0FBQ0wsVUFBSTtBQUNGLGNBQU0sS0FBSyxJQUFJLE9BQU8sTUFBTSxLQUFLO0FBQ2pDLFlBQUksQ0FBQyxHQUFHLEtBQUssUUFBUSxHQUFHO0FBQ3RCLHFCQUFXLEtBQUs7QUFBQSxZQUNkO0FBQUEsWUFDQSxTQUFTLE1BQU07QUFBQSxZQUNmLE1BQU07QUFBQSxZQUNOLFNBQVMsR0FBRyxNQUFNLElBQUksMkJBQTJCLE1BQU0sS0FBSztBQUFBLFVBQzlELENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRixRQUFRO0FBRU4sbUJBQVcsS0FBSztBQUFBLFVBQ2Q7QUFBQSxVQUNBLFNBQVMsTUFBTTtBQUFBLFVBQ2YsTUFBTTtBQUFBLFVBQ04sU0FBUyxHQUFHLE1BQU0sSUFBSTtBQUFBLFFBQ3hCLENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFHQSxNQUFJLE1BQU0sVUFBVSxXQUFXLFFBQVEsU0FBUyxHQUFHO0FBQ2pELFVBQU0sZUFBZSxPQUFPLFVBQVUsV0FBVyxNQUFNLEtBQUssSUFBSTtBQUNoRSxVQUFNLGFBQWEsUUFBUSxPQUFPLFNBQU87QUFDdkMsVUFBSSxJQUFJLE9BQU87QUFBYyxlQUFPO0FBQ3BDLFlBQU0sYUFBYSxJQUFJLE9BQU8sTUFBTSxFQUFFO0FBQ3RDLFlBQU0sZUFBZSxPQUFPLGVBQWUsV0FBVyxXQUFXLEtBQUssSUFBSTtBQUMxRSxhQUFPLGlCQUFpQixnQkFBZ0IsZUFBZTtBQUFBLElBQ3pELENBQUM7QUFDRCxRQUFJLFdBQVcsU0FBUyxHQUFHO0FBQ3pCLGlCQUFXLEtBQUs7QUFBQSxRQUNkO0FBQUEsUUFDQSxTQUFTLE1BQU07QUFBQSxRQUNmLE1BQU07QUFBQSxRQUNOLFNBQVMsR0FBRyxNQUFNLElBQUk7QUFBQSxNQUN4QixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7OztBQzdKTyxJQUFNLFdBQXNCO0FBQUEsRUFDakMsVUFBVTtBQUFBLEVBRVYsU0FBUyxPQUEyQjtBQUNsQyxRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFdBQU8sT0FBTyxVQUFVLFlBQVksTUFBTSxVQUFVO0FBQUEsRUFDdEQ7QUFBQSxFQUVBLE1BQU0sT0FBMEI7QUFDOUIsV0FBTyxNQUFNLFNBQVMsTUFBUyxNQUFNLE1BQU0sR0FBRyxHQUFNLElBQUk7QUFBQSxFQUMxRDtBQUFBLEVBRUEsT0FBTyxPQUEwQjtBQUMvQixRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFdBQU8sT0FBTyxLQUFLO0FBQUEsRUFDckI7QUFBQSxFQUVBLGVBQTBCO0FBQ3hCLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFHTyxJQUFNLGVBQTBCO0FBQUEsRUFDckMsVUFBVTtBQUFBLEVBRVYsU0FBUyxPQUEyQjtBQUNsQyxRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFdBQU8sT0FBTyxVQUFVLFlBQVksTUFBTSxVQUFVO0FBQUEsRUFDdEQ7QUFBQSxFQUVBLE1BQU0sT0FBMEI7QUFDOUIsV0FBTyxNQUFNLFNBQVMsTUFBVSxNQUFNLE1BQU0sR0FBRyxHQUFPLElBQUk7QUFBQSxFQUM1RDtBQUFBLEVBRUEsT0FBTyxPQUEwQjtBQUMvQixRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFdBQU8sT0FBTyxLQUFLO0FBQUEsRUFDckI7QUFBQSxFQUVBLGVBQTBCO0FBQ3hCLFdBQU87QUFBQSxFQUNUO0FBQ0Y7OztBQzNDTyxJQUFNLGFBQXdCO0FBQUEsRUFDbkMsVUFBVTtBQUFBLEVBRVYsU0FBUyxPQUEyQjtBQUNsQyxRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFdBQU8sT0FBTyxVQUFVLFlBQVksT0FBTyxTQUFTLEtBQUs7QUFBQSxFQUMzRDtBQUFBLEVBRUEsTUFBTSxPQUEwQjtBQUM5QixVQUFNLFVBQVUsTUFBTSxLQUFLO0FBQzNCLFFBQUksWUFBWTtBQUFJLGFBQU87QUFDM0IsVUFBTSxJQUFJLE9BQU8sT0FBTztBQUN4QixXQUFPLE9BQU8sU0FBUyxDQUFDLElBQUksSUFBSTtBQUFBLEVBQ2xDO0FBQUEsRUFFQSxPQUFPLE9BQTBCO0FBQy9CLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsV0FBTyxPQUFPLEtBQUs7QUFBQSxFQUNyQjtBQUFBLEVBRUEsZUFBMEI7QUFDeEIsV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQU1PLElBQU0sZUFBMEI7QUFBQSxFQUNyQyxVQUFVO0FBQUEsRUFFVixTQUFTLE9BQTJCO0FBQ2xDLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsV0FBTyxPQUFPLFVBQVUsWUFBWSxPQUFPLFVBQVUsS0FBSyxLQUFLLFNBQVM7QUFBQSxFQUMxRTtBQUFBLEVBRUEsTUFBTSxPQUEwQjtBQUM5QixVQUFNLFVBQVUsTUFBTSxLQUFLO0FBQzNCLFFBQUksWUFBWTtBQUFJLGFBQU87QUFFM0IsVUFBTSxVQUFVLFFBQVEsUUFBUSxhQUFhLEVBQUU7QUFDL0MsVUFBTSxJQUFJLFdBQVcsT0FBTztBQUM1QixRQUFJLENBQUMsT0FBTyxTQUFTLENBQUM7QUFBRyxhQUFPO0FBRWhDLFdBQU8sS0FBSyxNQUFNLElBQUksR0FBRztBQUFBLEVBQzNCO0FBQUEsRUFFQSxPQUFPLE9BQTBCO0FBQy9CLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsUUFBSSxPQUFPLFVBQVU7QUFBVSxhQUFPO0FBRXRDLFVBQU0sT0FBTyxRQUFRLElBQUksTUFBTTtBQUMvQixVQUFNLE1BQU0sS0FBSyxJQUFJLEtBQUs7QUFDMUIsVUFBTSxRQUFRLEtBQUssTUFBTSxNQUFNLEdBQUc7QUFDbEMsVUFBTSxPQUFPLE1BQU07QUFDbkIsV0FBTyxHQUFHLElBQUksR0FBRyxLQUFLLElBQUksT0FBTyxJQUFJLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQztBQUFBLEVBQ3pEO0FBQUEsRUFFQSxlQUEwQjtBQUN4QixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBR08sSUFBTSxjQUF5QjtBQUFBLEVBQ3BDLFVBQVU7QUFBQSxFQUVWLFNBQVMsT0FBMkI7QUFDbEMsUUFBSSxVQUFVO0FBQU0sYUFBTztBQUMzQixXQUFPLE9BQU8sVUFBVSxZQUFZLE9BQU8sU0FBUyxLQUFLLEtBQUssU0FBUyxLQUFLLFNBQVM7QUFBQSxFQUN2RjtBQUFBLEVBRUEsTUFBTSxPQUEwQjtBQUM5QixVQUFNLFVBQVUsTUFBTSxLQUFLO0FBQzNCLFFBQUksWUFBWTtBQUFJLGFBQU87QUFFM0IsUUFBSSxRQUFRLFNBQVMsR0FBRyxHQUFHO0FBQ3pCLFlBQU1NLEtBQUksV0FBVyxRQUFRLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDekMsVUFBSSxDQUFDLE9BQU8sU0FBU0EsRUFBQztBQUFHLGVBQU87QUFDaEMsYUFBT0EsS0FBSTtBQUFBLElBQ2I7QUFDQSxVQUFNLElBQUksV0FBVyxPQUFPO0FBQzVCLFFBQUksQ0FBQyxPQUFPLFNBQVMsQ0FBQztBQUFHLGFBQU87QUFDaEMsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE9BQU8sT0FBMEI7QUFDL0IsUUFBSSxVQUFVO0FBQU0sYUFBTztBQUMzQixRQUFJLE9BQU8sVUFBVTtBQUFVLGFBQU87QUFDdEMsV0FBTyxHQUFHLEtBQUssTUFBTSxRQUFRLEdBQUcsQ0FBQztBQUFBLEVBQ25DO0FBQUEsRUFFQSxlQUEwQjtBQUN4QixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBR08sSUFBTSxlQUEwQjtBQUFBLEVBQ3JDLFVBQVU7QUFBQSxFQUVWLFNBQVMsT0FBMkI7QUFDbEMsUUFBSSxVQUFVO0FBQU0sYUFBTztBQUMzQixXQUFPLE9BQU8sVUFBVSxZQUFZLE9BQU8sVUFBVSxLQUFLLEtBQUssU0FBUztBQUFBLEVBQzFFO0FBQUEsRUFFQSxNQUFNLE9BQTBCO0FBQzlCLFVBQU0sVUFBVSxNQUFNLEtBQUs7QUFDM0IsUUFBSSxZQUFZO0FBQUksYUFBTztBQUczQixVQUFNLFdBQVcsUUFBUSxNQUFNLDZCQUE2QjtBQUM1RCxRQUFJLFVBQVU7QUFDWixZQUFNLElBQUksU0FBUyxTQUFTLENBQUMsR0FBRyxFQUFFO0FBQ2xDLFlBQU0sSUFBSSxTQUFTLFNBQVMsQ0FBQyxHQUFHLEVBQUU7QUFDbEMsWUFBTSxJQUFJLFNBQVMsU0FBUyxDQUFDLEdBQUcsRUFBRTtBQUNsQyxjQUFRLElBQUksT0FBTyxJQUFJLEtBQUssS0FBSztBQUFBLElBQ25DO0FBR0EsVUFBTSxZQUFZLFFBQVEsTUFBTSxtQkFBbUI7QUFDbkQsUUFBSSxXQUFXO0FBQ2IsWUFBTSxJQUFJLFNBQVMsVUFBVSxDQUFDLEdBQUcsRUFBRTtBQUNuQyxZQUFNLElBQUksU0FBUyxVQUFVLENBQUMsR0FBRyxFQUFFO0FBQ25DLGNBQVEsSUFBSSxLQUFLLEtBQUs7QUFBQSxJQUN4QjtBQUdBLFVBQU0sYUFBYSxRQUFRLE1BQU0scURBQXFEO0FBQ3RGLFFBQUksZUFBZSxXQUFXLENBQUMsS0FBSyxXQUFXLENBQUMsS0FBSyxXQUFXLENBQUMsSUFBSTtBQUNuRSxZQUFNLElBQUksV0FBVyxDQUFDLElBQUksU0FBUyxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUk7QUFDeEQsWUFBTSxJQUFJLFdBQVcsQ0FBQyxJQUFJLFNBQVMsV0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJO0FBQ3hELFlBQU0sSUFBSSxXQUFXLENBQUMsSUFBSSxTQUFTLFdBQVcsQ0FBQyxHQUFHLEVBQUUsSUFBSTtBQUN4RCxjQUFRLElBQUksT0FBTyxJQUFJLEtBQUssS0FBSztBQUFBLElBQ25DO0FBR0EsVUFBTSxJQUFJLFNBQVMsU0FBUyxFQUFFO0FBQzlCLFFBQUksT0FBTyxTQUFTLENBQUMsS0FBSyxLQUFLO0FBQUcsYUFBTztBQUV6QyxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsT0FBTyxPQUEwQjtBQUMvQixRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFFBQUksT0FBTyxVQUFVO0FBQVUsYUFBTztBQUN0QyxVQUFNLGVBQWUsS0FBSyxNQUFNLFFBQVEsR0FBSTtBQUM1QyxVQUFNLElBQUksS0FBSyxNQUFNLGVBQWUsSUFBSTtBQUN4QyxVQUFNLElBQUksS0FBSyxNQUFPLGVBQWUsT0FBUSxFQUFFO0FBQy9DLFVBQU0sSUFBSSxlQUFlO0FBQ3pCLFFBQUksSUFBSTtBQUFHLGFBQU8sR0FBRyxDQUFDLEtBQUssT0FBTyxDQUFDLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLE9BQU8sQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUM7QUFDcEYsUUFBSSxJQUFJO0FBQUcsYUFBTyxHQUFHLENBQUMsS0FBSyxPQUFPLENBQUMsRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDO0FBQ3JELFdBQU8sR0FBRyxDQUFDO0FBQUEsRUFDYjtBQUFBLEVBRUEsZUFBMEI7QUFDeEIsV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUdPLElBQU0sYUFBd0I7QUFBQSxFQUNuQyxVQUFVO0FBQUEsRUFFVixTQUFTLE9BQTJCO0FBQ2xDLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsV0FBTyxPQUFPLFVBQVUsWUFBWSxPQUFPLFVBQVUsS0FBSyxLQUFLLFNBQVMsS0FBSyxTQUFTO0FBQUEsRUFDeEY7QUFBQSxFQUVBLE1BQU0sT0FBMEI7QUFDOUIsVUFBTSxVQUFVLE1BQU0sS0FBSztBQUMzQixRQUFJLFlBQVk7QUFBSSxhQUFPO0FBQzNCLFVBQU0sSUFBSSxTQUFTLFNBQVMsRUFBRTtBQUM5QixRQUFJLENBQUMsT0FBTyxTQUFTLENBQUM7QUFBRyxhQUFPO0FBQ2hDLFdBQU8sS0FBSyxJQUFJLEdBQUcsS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDO0FBQUEsRUFDcEM7QUFBQSxFQUVBLE9BQU8sT0FBMEI7QUFDL0IsUUFBSSxVQUFVO0FBQU0sYUFBTztBQUMzQixXQUFPLE9BQU8sS0FBSztBQUFBLEVBQ3JCO0FBQUEsRUFFQSxlQUEwQjtBQUN4QixXQUFPO0FBQUEsRUFDVDtBQUNGOzs7QUMxTE8sSUFBTSxlQUEwQjtBQUFBLEVBQ3JDLFVBQVU7QUFBQSxFQUVWLFNBQVMsT0FBMkI7QUFDbEMsUUFBSSxVQUFVO0FBQU0sYUFBTztBQUMzQixXQUFPLE9BQU8sVUFBVTtBQUFBLEVBQzFCO0FBQUEsRUFFQSxNQUFNLE9BQTBCO0FBQzlCLFVBQU0sVUFBVSxNQUFNLEtBQUssRUFBRSxZQUFZO0FBQ3pDLFFBQUksWUFBWTtBQUFJLGFBQU87QUFDM0IsUUFBSSxDQUFDLFFBQVEsS0FBSyxPQUFPLEtBQUssVUFBSyxTQUFTLEVBQUUsU0FBUyxPQUFPO0FBQUcsYUFBTztBQUN4RSxRQUFJLENBQUMsU0FBUyxLQUFLLE1BQU0sS0FBSyxJQUFJLFdBQVcsRUFBRSxTQUFTLE9BQU87QUFBRyxhQUFPO0FBQ3pFLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxPQUFPLE9BQTBCO0FBQy9CLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsV0FBTyxRQUFRLFdBQU07QUFBQSxFQUN2QjtBQUFBLEVBRUEsZUFBMEI7QUFDeEIsV0FBTztBQUFBLEVBQ1Q7QUFDRjs7O0FDekJBLElBQU0sVUFBVTtBQUVoQixTQUFTLFlBQVksR0FBb0I7QUFDdkMsUUFBTSxJQUFJLG9CQUFJLEtBQUssSUFBSSxZQUFZO0FBQ25DLFNBQU8sQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLEtBQUssTUFBTSxFQUFFLFlBQVksRUFBRSxNQUFNLEdBQUcsRUFBRTtBQUNqRTtBQUVBLFNBQVMsZ0JBQWdCLEdBQW9CO0FBQzNDLFFBQU0sSUFBSSxJQUFJLEtBQUssQ0FBQztBQUNwQixTQUFPLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQztBQUMzQjtBQUdPLElBQU0sV0FBc0I7QUFBQSxFQUNqQyxVQUFVO0FBQUEsRUFFVixTQUFTLE9BQTJCO0FBQ2xDLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsUUFBSSxPQUFPLFVBQVU7QUFBVSxhQUFPO0FBQ3RDLFdBQU8sUUFBUSxLQUFLLEtBQUssS0FBSyxZQUFZLEtBQUs7QUFBQSxFQUNqRDtBQUFBLEVBRUEsTUFBTSxPQUEwQjtBQUM5QixVQUFNLFVBQVUsTUFBTSxLQUFLO0FBQzNCLFFBQUksWUFBWTtBQUFJLGFBQU87QUFFM0IsUUFBSSxRQUFRLEtBQUssT0FBTyxLQUFLLFlBQVksT0FBTztBQUFHLGFBQU87QUFFMUQsVUFBTSxJQUFJLElBQUksS0FBSyxPQUFPO0FBQzFCLFFBQUksQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLEdBQUc7QUFDdkIsYUFBTyxFQUFFLFlBQVksRUFBRSxNQUFNLEdBQUcsRUFBRTtBQUFBLElBQ3BDO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE9BQU8sT0FBMEI7QUFDL0IsUUFBSSxVQUFVO0FBQU0sYUFBTztBQUMzQixXQUFPLE9BQU8sS0FBSztBQUFBLEVBQ3JCO0FBQUEsRUFFQSxlQUEwQjtBQUN4QixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBR08sSUFBTSxlQUEwQjtBQUFBLEVBQ3JDLFVBQVU7QUFBQSxFQUVWLFNBQVMsT0FBMkI7QUFDbEMsUUFBSSxVQUFVO0FBQU0sYUFBTztBQUMzQixRQUFJLE9BQU8sVUFBVTtBQUFVLGFBQU87QUFDdEMsV0FBTyxnQkFBZ0IsS0FBSztBQUFBLEVBQzlCO0FBQUEsRUFFQSxNQUFNLE9BQTBCO0FBQzlCLFVBQU0sVUFBVSxNQUFNLEtBQUs7QUFDM0IsUUFBSSxZQUFZO0FBQUksYUFBTztBQUMzQixVQUFNLElBQUksSUFBSSxLQUFLLE9BQU87QUFDMUIsUUFBSSxNQUFNLEVBQUUsUUFBUSxDQUFDO0FBQUcsYUFBTztBQUMvQixXQUFPLEVBQUUsWUFBWTtBQUFBLEVBQ3ZCO0FBQUEsRUFFQSxPQUFPLE9BQTBCO0FBQy9CLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsV0FBTyxPQUFPLEtBQUs7QUFBQSxFQUNyQjtBQUFBLEVBRUEsZUFBMEI7QUFDeEIsV0FBTztBQUFBLEVBQ1Q7QUFDRjs7O0FDdEVBLElBQU0sU0FBUztBQUdSLElBQU0sVUFBcUI7QUFBQSxFQUNoQyxVQUFVO0FBQUEsRUFFVixTQUFTLE9BQTJCO0FBQ2xDLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsUUFBSSxPQUFPLFVBQVU7QUFBVSxhQUFPO0FBQ3RDLFFBQUksVUFBVTtBQUFJLGFBQU87QUFDekIsV0FBTyxPQUFPLEtBQUssS0FBSztBQUFBLEVBQzFCO0FBQUEsRUFFQSxNQUFNLE9BQTBCO0FBQzlCLFVBQU0sVUFBVSxNQUFNLEtBQUs7QUFDM0IsUUFBSSxZQUFZO0FBQUksYUFBTztBQUMzQixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsT0FBTyxPQUEwQjtBQUMvQixRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFdBQU8sT0FBTyxLQUFLO0FBQUEsRUFDckI7QUFBQSxFQUVBLGVBQTBCO0FBQ3hCLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFHQSxJQUFNLFdBQVc7QUFHVixJQUFNLFlBQXVCO0FBQUEsRUFDbEMsVUFBVTtBQUFBLEVBRVYsU0FBUyxPQUEyQjtBQUNsQyxRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFFBQUksT0FBTyxVQUFVO0FBQVUsYUFBTztBQUN0QyxRQUFJLFVBQVU7QUFBSSxhQUFPO0FBQ3pCLFdBQU8sU0FBUyxLQUFLLEtBQUs7QUFBQSxFQUM1QjtBQUFBLEVBRUEsTUFBTSxPQUEwQjtBQUM5QixVQUFNLFVBQVUsTUFBTSxLQUFLLEVBQUUsWUFBWTtBQUN6QyxRQUFJLFlBQVk7QUFBSSxhQUFPO0FBQzNCLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxPQUFPLE9BQTBCO0FBQy9CLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsV0FBTyxPQUFPLEtBQUs7QUFBQSxFQUNyQjtBQUFBLEVBRUEsZUFBMEI7QUFDeEIsV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUdBLElBQU0sV0FBVztBQUdWLElBQU0sWUFBdUI7QUFBQSxFQUNsQyxVQUFVO0FBQUEsRUFFVixTQUFTLE9BQTJCO0FBQ2xDLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsUUFBSSxPQUFPLFVBQVU7QUFBVSxhQUFPO0FBQ3RDLFFBQUksVUFBVTtBQUFJLGFBQU87QUFDekIsV0FBTyxTQUFTLEtBQUssS0FBSztBQUFBLEVBQzVCO0FBQUEsRUFFQSxNQUFNLE9BQTBCO0FBQzlCLFVBQU0sVUFBVSxNQUFNLEtBQUs7QUFDM0IsUUFBSSxZQUFZO0FBQUksYUFBTztBQUMzQixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsT0FBTyxPQUEwQjtBQUMvQixRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFdBQU8sT0FBTyxLQUFLO0FBQUEsRUFDckI7QUFBQSxFQUVBLGVBQTBCO0FBQ3hCLFdBQU87QUFBQSxFQUNUO0FBQ0Y7OztBQ3ZGTyxJQUFNLG1CQUE4QjtBQUFBLEVBQ3pDLFVBQVU7QUFBQSxFQUVWLFNBQVMsT0FBa0IsT0FBa0M7QUFDM0QsUUFBSSxVQUFVO0FBQU0sYUFBTztBQUMzQixRQUFJLE9BQU8sVUFBVTtBQUFVLGFBQU87QUFDdEMsUUFBSSxDQUFDLE9BQU87QUFBUyxhQUFPO0FBQzVCLFdBQU8sTUFBTSxRQUFRLEtBQUssU0FBTyxJQUFJLE9BQU8sS0FBSztBQUFBLEVBQ25EO0FBQUEsRUFFQSxNQUFNLE9BQWUsT0FBb0M7QUFDdkQsVUFBTSxVQUFVLE1BQU0sS0FBSztBQUMzQixRQUFJLFlBQVk7QUFBSSxhQUFPO0FBQzNCLFFBQUksQ0FBQyxPQUFPO0FBQVMsYUFBTztBQUc1QixVQUFNLFFBQVEsUUFBUSxZQUFZO0FBQ2xDLFVBQU0sUUFBUSxNQUFNLFFBQVEsS0FBSyxTQUFPLElBQUksS0FBSyxLQUFLLEVBQUUsWUFBWSxNQUFNLEtBQUs7QUFDL0UsV0FBTyxRQUFRLE1BQU0sS0FBSztBQUFBLEVBQzVCO0FBQUEsRUFFQSxPQUFPLE9BQWtCLE9BQWlDO0FBQ3hELFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsUUFBSSxPQUFPLFVBQVUsWUFBWSxDQUFDLE9BQU87QUFBUyxhQUFPO0FBQ3pELFVBQU0sTUFBTSxNQUFNLFFBQVEsS0FBSyxPQUFLLEVBQUUsT0FBTyxLQUFLO0FBQ2xELFdBQU8sTUFBTSxJQUFJLE9BQU87QUFBQSxFQUMxQjtBQUFBLEVBRUEsZUFBMEI7QUFDeEIsV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUdPLElBQU0sa0JBQTZCO0FBQUEsRUFDeEMsVUFBVTtBQUFBLEVBRVYsU0FBUyxPQUFrQixPQUFrQztBQUMzRCxRQUFJLFVBQVU7QUFBTSxhQUFPO0FBQzNCLFFBQUksQ0FBQyxNQUFNLFFBQVEsS0FBSztBQUFHLGFBQU87QUFDbEMsUUFBSSxDQUFDLE9BQU87QUFBUyxhQUFPLE1BQU0sV0FBVztBQUM3QyxVQUFNLFlBQVksSUFBSSxJQUFJLE1BQU0sUUFBUSxJQUFJLE9BQUssRUFBRSxFQUFFLENBQUM7QUFDdEQsV0FBTyxNQUFNLE1BQU0sT0FBSyxPQUFPLE1BQU0sWUFBWSxVQUFVLElBQUksQ0FBQyxDQUFDO0FBQUEsRUFDbkU7QUFBQSxFQUVBLE1BQU0sT0FBZSxPQUFvQztBQUN2RCxVQUFNLFVBQVUsTUFBTSxLQUFLO0FBQzNCLFFBQUksWUFBWTtBQUFJLGFBQU87QUFDM0IsUUFBSSxDQUFDLE9BQU87QUFBUyxhQUFPO0FBRTVCLFVBQU0sUUFBUSxRQUFRLE1BQU0sR0FBRyxFQUFFLElBQUksT0FBSyxFQUFFLEtBQUssQ0FBQyxFQUFFLE9BQU8sT0FBSyxFQUFFLFNBQVMsQ0FBQztBQUM1RSxRQUFJLE1BQU0sV0FBVztBQUFHLGFBQU87QUFFL0IsVUFBTSxTQUFtQixDQUFDO0FBQzFCLGVBQVcsUUFBUSxPQUFPO0FBQ3hCLFlBQU0sUUFBUSxLQUFLLFlBQVk7QUFDL0IsWUFBTSxRQUFRLE1BQU0sUUFBUSxLQUFLLFNBQU8sSUFBSSxLQUFLLEtBQUssRUFBRSxZQUFZLE1BQU0sS0FBSztBQUMvRSxVQUFJLE9BQU87QUFDVCxlQUFPLEtBQUssTUFBTSxFQUFFO0FBQUEsTUFDdEI7QUFBQSxJQUNGO0FBQ0EsV0FBTyxPQUFPLFNBQVMsSUFBSSxTQUFTO0FBQUEsRUFDdEM7QUFBQSxFQUVBLE9BQU8sT0FBa0IsT0FBaUM7QUFDeEQsUUFBSSxVQUFVLFFBQVEsQ0FBQyxNQUFNLFFBQVEsS0FBSztBQUFHLGFBQU87QUFDcEQsUUFBSSxDQUFDLE9BQU87QUFBUyxhQUFPO0FBQzVCLFdBQU8sTUFDSixJQUFJLFFBQU07QUFDVCxZQUFNLE1BQU0sTUFBTSxRQUFTLEtBQUssT0FBSyxFQUFFLE9BQU8sRUFBRTtBQUNoRCxhQUFPLE1BQU0sSUFBSSxPQUFPO0FBQUEsSUFDMUIsQ0FBQyxFQUNBLE9BQU8sT0FBSyxFQUFFLFNBQVMsQ0FBQyxFQUN4QixLQUFLLElBQUk7QUFBQSxFQUNkO0FBQUEsRUFFQSxlQUEwQjtBQUN4QixXQUFPO0FBQUEsRUFDVDtBQUNGOzs7QUMvRU8sSUFBTSxpQkFBNEI7QUFBQSxFQUN2QyxVQUFVO0FBQUEsRUFFVixTQUFTLE9BQTJCO0FBQ2xDLFFBQUksVUFBVTtBQUFNLGFBQU87QUFDM0IsV0FBTyxPQUFPLFVBQVU7QUFBQSxFQUMxQjtBQUFBLEVBRUEsTUFBTSxPQUEwQjtBQUM5QixVQUFNLFVBQVUsTUFBTSxLQUFLO0FBQzNCLFFBQUksWUFBWTtBQUFJLGFBQU87QUFDM0IsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE9BQU8sT0FBMEI7QUFDL0IsUUFBSSxVQUFVO0FBQU0sYUFBTztBQUMzQixXQUFPLE9BQU8sS0FBSztBQUFBLEVBQ3JCO0FBQUEsRUFFQSxlQUEwQjtBQUN4QixXQUFPO0FBQUEsRUFDVDtBQUNGOzs7QUN0Qk8sSUFBTSxpQkFBNEI7QUFBQSxFQUN2QyxVQUFVO0FBQUEsRUFFVixTQUFTLE9BQTJCO0FBQ2xDLFdBQU8sT0FBTyxVQUFVLFlBQVksT0FBTyxVQUFVLEtBQUssS0FBSyxTQUFTO0FBQUEsRUFDMUU7QUFBQSxFQUVBLE1BQU0sUUFBMkI7QUFFL0IsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE9BQU8sT0FBMEI7QUFDL0IsUUFBSSxPQUFPLFVBQVU7QUFBVSxhQUFPO0FBQ3RDLFdBQU8sT0FBTyxLQUFLO0FBQUEsRUFDckI7QUFBQSxFQUVBLGVBQTBCO0FBQ3hCLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFHTyxJQUFNLGtCQUE2QjtBQUFBLEVBQ3hDLFVBQVU7QUFBQSxFQUVWLFNBQVMsT0FBMkI7QUFDbEMsUUFBSSxPQUFPLFVBQVU7QUFBVSxhQUFPO0FBQ3RDLFdBQU8sQ0FBQyxNQUFNLElBQUksS0FBSyxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDekM7QUFBQSxFQUVBLE1BQU0sUUFBMkI7QUFDL0IsWUFBTyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxPQUFPLE9BQTBCO0FBQy9CLFFBQUksT0FBTyxVQUFVO0FBQVUsYUFBTztBQUN0QyxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsZUFBMEI7QUFDeEIsWUFBTyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLEVBQ2hDO0FBQ0Y7QUFHTyxJQUFNLG1CQUE4QjtBQUFBLEVBQ3pDLFVBQVU7QUFBQSxFQUVWLFNBQVMsT0FBMkI7QUFDbEMsUUFBSSxPQUFPLFVBQVU7QUFBVSxhQUFPO0FBQ3RDLFdBQU8sQ0FBQyxNQUFNLElBQUksS0FBSyxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDekM7QUFBQSxFQUVBLE1BQU0sUUFBMkI7QUFDL0IsWUFBTyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxPQUFPLE9BQTBCO0FBQy9CLFFBQUksT0FBTyxVQUFVO0FBQVUsYUFBTztBQUN0QyxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsZUFBMEI7QUFDeEIsWUFBTyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLEVBQ2hDO0FBQ0Y7OztBQzNEQSxJQUFNLFdBQVcsb0JBQUksSUFBOEI7QUFBQSxFQUNqRCxDQUFDLFFBQVEsUUFBUTtBQUFBLEVBQ2pCLENBQUMsYUFBYSxZQUFZO0FBQUEsRUFDMUIsQ0FBQyxVQUFVLFVBQVU7QUFBQSxFQUNyQixDQUFDLFlBQVksWUFBWTtBQUFBLEVBQ3pCLENBQUMsV0FBVyxXQUFXO0FBQUEsRUFDdkIsQ0FBQyxZQUFZLFlBQVk7QUFBQSxFQUN6QixDQUFDLFVBQVUsVUFBVTtBQUFBLEVBQ3JCLENBQUMsWUFBWSxZQUFZO0FBQUEsRUFDekIsQ0FBQyxRQUFRLFFBQVE7QUFBQSxFQUNqQixDQUFDLGFBQWEsWUFBWTtBQUFBLEVBQzFCLENBQUMsT0FBTyxPQUFPO0FBQUEsRUFDZixDQUFDLFNBQVMsU0FBUztBQUFBLEVBQ25CLENBQUMsU0FBUyxTQUFTO0FBQUEsRUFDbkIsQ0FBQyxpQkFBaUIsZ0JBQWdCO0FBQUEsRUFDbEMsQ0FBQyxnQkFBZ0IsZUFBZTtBQUFBLEVBQ2hDLENBQUMsY0FBYyxjQUFjO0FBQUEsRUFDN0IsQ0FBQyxlQUFlLGNBQWM7QUFBQSxFQUM5QixDQUFDLGdCQUFnQixlQUFlO0FBQUEsRUFDaEMsQ0FBQyxpQkFBaUIsZ0JBQWdCO0FBQ3BDLENBQUM7QUFNTSxTQUFTLGFBQWEsTUFBZ0M7QUFDM0QsUUFBTSxLQUFLLFNBQVMsSUFBSSxJQUFJO0FBQzVCLE1BQUksQ0FBQyxJQUFJO0FBQ1AsVUFBTSxJQUFJLE1BQU0sd0JBQXdCLElBQUksd0JBQXdCLGVBQWUsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUFBLEVBQ2pHO0FBQ0EsU0FBTztBQUNUO0FBUU8sSUFBTSxpQkFBMkM7QUFBQSxFQUN0RDtBQUFBLEVBQVE7QUFBQSxFQUFhO0FBQUEsRUFBVTtBQUFBLEVBQVk7QUFBQSxFQUMzQztBQUFBLEVBQVk7QUFBQSxFQUFVO0FBQUEsRUFBWTtBQUFBLEVBQVE7QUFBQSxFQUMxQztBQUFBLEVBQU87QUFBQSxFQUFTO0FBQUEsRUFDaEI7QUFBQSxFQUFpQjtBQUFBLEVBQWdCO0FBQUEsRUFDakM7QUFBQSxFQUFlO0FBQUEsRUFBZ0I7QUFDakM7QUFHTyxJQUFNLGFBQWEsU0FBUzs7O0FDM0M1QixJQUFNLGdCQUF3QztBQUFBLEVBQ25EO0FBQUEsRUFBUTtBQUFBLEVBQVM7QUFBQSxFQUFVO0FBQUEsRUFBVTtBQUFBLEVBQ3JDO0FBQUEsRUFBUTtBQUFBLEVBQVU7QUFBQSxFQUFRO0FBQzVCOzs7QUN3QkEsSUFBTSxXQUFnRDtBQUFBLEVBQ3BELE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxFQUNSLE1BQU07QUFBQSxFQUNOLFVBQVU7QUFBQSxFQUNWLGVBQWU7QUFDakI7QUFHTyxTQUFTLGlCQUFpQixTQUFzQztBQUNyRSxRQUFNLE9BQU8sb0JBQUksSUFBWTtBQUM3QixRQUFNLE1BQWdCLENBQUM7QUFDdkIsVUFBUSxRQUFRLENBQUMsS0FBSyxNQUFNO0FBQzFCLFVBQU0sT0FBTyxJQUFJLEtBQUssTUFBTSxLQUFLLFVBQVUsSUFBSSxDQUFDLEtBQUssSUFBSSxLQUFLO0FBQzlELFFBQUksT0FBTztBQUNYLFFBQUksSUFBSTtBQUNSLFdBQU8sS0FBSyxJQUFJLElBQUk7QUFBRyxhQUFPLEdBQUcsSUFBSSxJQUFJLEdBQUc7QUFDNUMsU0FBSyxJQUFJLElBQUk7QUFDYixRQUFJLEtBQUssSUFBSTtBQUFBLEVBQ2YsQ0FBQztBQUNELFNBQU87QUFDVDtBQUVBLFNBQVMsWUFBWSxHQUFjLE9BQXdCLFdBQXVEO0FBQ2hILE1BQUksWUFBWSxDQUFDO0FBQUcsV0FBTztBQUMzQixVQUFRLE1BQU0sTUFBTTtBQUFBLElBQ2xCLEtBQUssWUFBWTtBQUNmLFVBQUksT0FBTyxNQUFNO0FBQVcsZUFBTztBQUNuQyxVQUFJLE9BQU8sTUFBTTtBQUFVLGVBQU8sTUFBTTtBQUN4QyxZQUFNLElBQUksT0FBTyxDQUFDLEVBQUUsS0FBSyxFQUFFLFlBQVk7QUFDdkMsVUFBSSxNQUFNLFVBQVUsTUFBTSxTQUFTLE1BQU07QUFBSyxlQUFPO0FBQ3JELFVBQUksTUFBTSxXQUFXLE1BQU0sUUFBUSxNQUFNO0FBQUssZUFBTztBQUNyRDtBQUFBLElBQ0Y7QUFBQSxJQUNBLEtBQUssVUFBVTtBQUNiLFVBQUksT0FBTyxNQUFNO0FBQVUsZUFBTztBQUNsQyxZQUFNLElBQUksT0FBTyxPQUFPLENBQUMsRUFBRSxLQUFLLENBQUM7QUFDakMsVUFBSSxPQUFPLFNBQVMsQ0FBQztBQUFHLGVBQU87QUFDL0I7QUFBQSxJQUNGO0FBQUEsSUFDQSxLQUFLLFFBQVE7QUFDWCxVQUFJLGFBQWEsTUFBTTtBQUNyQixjQUFNLE1BQU0sWUFBWSxDQUFDO0FBQ3pCLFlBQUksUUFBUTtBQUFNLGlCQUFPO0FBQ3pCO0FBQUEsTUFDRjtBQUNBLFlBQU0sSUFBSSxjQUFjLE9BQU8sQ0FBQyxDQUFDO0FBQ2pDLFVBQUksTUFBTTtBQUFNLGVBQU87QUFDdkI7QUFBQSxJQUNGO0FBQUEsSUFDQSxLQUFLLGlCQUFpQjtBQUNwQixZQUFNLEtBQUssV0FBVyxJQUFJLFFBQVEsQ0FBQyxDQUFDO0FBQ3BDLFVBQUksT0FBTztBQUFXLGVBQU87QUFDN0I7QUFBQSxJQUNGO0FBQUEsSUFDQSxLQUFLO0FBQ0gsVUFBSSxhQUFhO0FBQU0sZUFBTyxFQUFFLFlBQVk7QUFDNUMsYUFBTyxPQUFPLENBQUM7QUFBQSxFQUNuQjtBQUNBLFFBQU0sSUFBSSxNQUFNLFVBQVUsUUFBUSxDQUFDLENBQUMseUJBQXlCLE1BQU0sSUFBSSxFQUFFO0FBQzNFO0FBTU8sU0FBUyxXQUFXLFFBQXNCLFVBQXdCLENBQUMsR0FBZ0I7QUFDeEYsTUFBSTtBQUNGLFdBQU8sZUFBZSxRQUFRLE9BQU87QUFBQSxFQUN2QyxTQUFTLEdBQUc7QUFDVixXQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sa0JBQWtCLGFBQWEsUUFBUSxFQUFFLFVBQVUsT0FBTyxDQUFDLENBQUMsR0FBRztBQUFBLEVBQzVGO0FBQ0Y7QUFFQSxTQUFTLGVBQWUsUUFBc0IsU0FBb0M7QUFDaEYsUUFBTSxZQUFZLFFBQVEsYUFBYTtBQUN2QyxRQUFNLE1BQU0sUUFBUSxRQUFRLE9BQU0sb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFDekQsUUFBTUMsYUFBWSxRQUFRLGFBQWE7QUFFdkMsTUFBSSxPQUFPLEtBQUssV0FBVyxLQUFNLGFBQWEsT0FBTyxLQUFLLFdBQVcsS0FBSyxPQUFPLEtBQUssQ0FBQyxFQUFFLFdBQVcsR0FBSTtBQUN0RyxXQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sa0NBQWtDO0FBQUEsRUFDL0Q7QUFFQSxRQUFNLFlBQWtDLFlBQVksT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQ3RFLFFBQU0sT0FBTyxZQUFZLE9BQU8sS0FBSyxNQUFNLENBQUMsSUFBSSxPQUFPO0FBQ3ZELE1BQUksY0FBYyxVQUFVO0FBQzVCLGFBQVcsS0FBSztBQUFNLGtCQUFjLEtBQUssSUFBSSxhQUFhLEVBQUUsTUFBTTtBQUNsRSxNQUFJLGdCQUFnQjtBQUFHLFdBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTywyQkFBMkI7QUFFN0UsUUFBTSxVQUFVLE1BQU0sS0FBSyxFQUFFLFFBQVEsWUFBWSxHQUFHLENBQUMsR0FBRyxNQUFNO0FBQzVELFVBQU0sSUFBSSxVQUFVLENBQUM7QUFDckIsV0FBTyxNQUFNLFVBQWEsTUFBTSxPQUFPLEtBQUssT0FBTyxDQUFDO0FBQUEsRUFDdEQsQ0FBQztBQUNELFFBQU0sUUFBUSxpQkFBaUIsT0FBTztBQUN0QyxRQUFNLGFBQWEsV0FBVyxNQUFNLFdBQVc7QUFFL0MsUUFBTSxTQUE0QixDQUFDO0FBQ25DLFFBQU0sYUFBa0QsQ0FBQztBQUN6RCxRQUFNLFVBQTBCLENBQUM7QUFFakMsV0FBUyxJQUFJLEdBQUcsSUFBSSxhQUFhLEtBQUs7QUFDcEMsVUFBTSxNQUFNLFdBQVcsQ0FBQztBQUN4QixVQUFNLE9BQU8sU0FBUyxJQUFJLElBQUk7QUFDOUIsVUFBTSxRQUF5QixFQUFFLElBQUksZ0JBQWdCLEdBQUcsTUFBTSxNQUFNLENBQUMsR0FBRyxLQUFLO0FBQzdFLFFBQUksTUFBTTtBQUFHLFlBQU0sVUFBVTtBQUM3QixRQUFJLFNBQVMsaUJBQWlCO0FBQzVCLFlBQU0sUUFBd0IsSUFBSSxpQkFBaUIsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLE9BQU87QUFBQSxRQUN2RSxJQUFJLGlCQUFpQjtBQUFBLFFBQ3JCO0FBQUEsUUFDQSxPQUFPLGNBQWMsSUFBSSxjQUFjLE1BQU07QUFBQSxNQUMvQyxFQUFFO0FBQ0YsWUFBTSxVQUFVO0FBQ2hCLGlCQUFXLEtBQUssSUFBSSxJQUFJLEtBQUssSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQUEsSUFDMUQsT0FBTztBQUNMLGlCQUFXLEtBQUssTUFBUztBQUFBLElBQzNCO0FBQ0EsV0FBTyxLQUFLLEtBQUs7QUFDakIsWUFBUSxLQUFLLEVBQUUsTUFBTSxNQUFNLE1BQU0sTUFBTSxRQUFRLElBQUksT0FBTyxDQUFDO0FBQUEsRUFDN0Q7QUFFQSxRQUFNLFFBQVEsSUFBSTtBQUNsQixRQUFNLE9BQWMsSUFBSSxNQUFXLEtBQUssTUFBTTtBQUM5QyxXQUFTLElBQUksR0FBRyxJQUFJLEtBQUssUUFBUSxLQUFLO0FBQ3BDLFVBQU0sTUFBTSxLQUFLLENBQUM7QUFDbEIsVUFBTSxTQUFvQyxDQUFDO0FBQzNDLGFBQVMsSUFBSSxHQUFHLElBQUksT0FBTyxRQUFRLEtBQUs7QUFDdEMsYUFBTyxPQUFPLENBQUMsRUFBRSxFQUFFLElBQUksWUFBWSxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQztBQUFBLElBQ3JFO0FBQ0EsU0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLGNBQWMsR0FBRyxLQUFLLEdBQUcsV0FBVyxPQUFPLFdBQVcsT0FBTyxRQUFRLE1BQU0sS0FBSztBQUFBLEVBQ2xHO0FBRUEsUUFBTSxPQUFvQjtBQUFBLElBQ3hCLGVBQWU7QUFBQSxJQUNmLFNBQVMsZ0JBQWdCO0FBQUEsSUFDekIsTUFBTSxPQUFPO0FBQUEsSUFDYjtBQUFBLElBQ0E7QUFBQSxJQUNBLE9BQU8sQ0FBQyxrQkFBa0IsTUFBTSxDQUFDO0FBQUEsSUFDakMsVUFBVTtBQUFBLEVBQ1o7QUFHQSxRQUFNLGFBQWEsY0FBYyxRQUFRLElBQUk7QUFDN0MsTUFBSSxXQUFXLFNBQVMsR0FBRztBQUN6QixXQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sc0JBQXNCLFdBQVcsTUFBTSx5QkFBeUIsV0FBVyxDQUFDLEVBQUUsT0FBTyxHQUFHO0FBQUEsRUFDckg7QUFDQSxhQUFXLFNBQVMsUUFBUTtBQUMxQixVQUFNLEtBQUssYUFBYSxNQUFNLElBQUk7QUFDbEMsZUFBVyxPQUFPLE1BQU07QUFDdEIsVUFBSSxDQUFDLEdBQUcsU0FBUyxJQUFJLE9BQU8sTUFBTSxFQUFFLEtBQUssTUFBTSxLQUFLLEdBQUc7QUFDckQsZUFBTyxFQUFFLElBQUksT0FBTyxPQUFPLHVDQUF1QyxNQUFNLElBQUksb0JBQW9CLE1BQU0sSUFBSSxHQUFHO0FBQUEsTUFDL0c7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUVBLFFBQU0sVUFBVUEsV0FBVSxJQUFJO0FBRzlCLFFBQU0sU0FBUyxNQUFVLE9BQU87QUFDaEMsTUFBSSxDQUFDLE9BQU87QUFBSSxXQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sNEJBQTRCLE9BQU8sS0FBSyxHQUFHO0FBQ3RGLE1BQUksT0FBTyxLQUFLLEtBQUssV0FBVyxLQUFLO0FBQVEsV0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLGdDQUFnQztBQUN4RyxXQUFTLElBQUksR0FBRyxJQUFJLEtBQUssUUFBUSxLQUFLO0FBQ3BDLFFBQUksS0FBSyxVQUFVLE9BQU8sS0FBSyxLQUFLLENBQUMsRUFBRSxNQUFNLE1BQU0sS0FBSyxVQUFVLEtBQUssQ0FBQyxFQUFFLE1BQU0sR0FBRztBQUNqRixhQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sb0NBQW9DLElBQUksQ0FBQyxHQUFHO0FBQUEsSUFDekU7QUFBQSxFQUNGO0FBRUEsU0FBTyxFQUFFLElBQUksTUFBTSxTQUFTLE1BQU0sUUFBUSxFQUFFLFVBQVUsS0FBSyxRQUFRLFFBQVEsRUFBRTtBQUMvRTs7O0FDcExBLElBQU0sb0JBQW9CO0FBR25CLFNBQVMsYUFBYSxVQUEwQjtBQUNyRCxRQUFNLFdBQVcsU0FBUyxRQUFRLGtCQUFrQixFQUFFO0FBQ3RELFFBQU0sT0FBTyxTQUFTLFFBQVEsc0JBQXNCLEdBQUcsRUFBRSxLQUFLO0FBQzlELFNBQU8sU0FBUyxLQUFLLG1CQUFtQjtBQUMxQztBQUdPLFNBQVMsY0FBYyxRQUFnQixNQUFjLEdBQW1CO0FBQzdFLFFBQU0sT0FBTyxNQUFNLElBQUksR0FBRyxJQUFJLGFBQWEsR0FBRyxJQUFJLElBQUksQ0FBQztBQUN2RCxTQUFPLFdBQVcsS0FBSyxPQUFPLEdBQUcsTUFBTSxJQUFJLElBQUk7QUFDakQ7QUFHTyxTQUFTLGFBQWEsUUFBZ0IsTUFBYyxRQUErQztBQUN4RyxXQUFTLElBQUksR0FBRyxLQUFLLG1CQUFtQixLQUFLO0FBQzNDLFVBQU0sSUFBSSxjQUFjLFFBQVEsTUFBTSxDQUFDO0FBQ3ZDLFFBQUksQ0FBQyxPQUFPLENBQUM7QUFBRyxhQUFPO0FBQUEsRUFDekI7QUFDQSxTQUFPO0FBQ1Q7QUFFQSxlQUFzQixZQUFZLE9BQTRDO0FBQzVFLFFBQU0sWUFBWSxhQUFhLE1BQU0sUUFBUTtBQUU3QyxNQUFJO0FBQ0osTUFBSSxnQkFBZ0I7QUFDcEIsTUFBSTtBQUVKLE1BQUksTUFBTSxTQUFTLE9BQU87QUFDeEIsUUFBSSxPQUFPLE1BQU0sU0FBUztBQUFVLGFBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTyx5QkFBeUI7QUFDeEYsVUFBTSxTQUFTLFNBQVMsTUFBTSxJQUFJO0FBQ2xDLFFBQUksQ0FBQyxPQUFPO0FBQUksYUFBTyxFQUFFLElBQUksT0FBTyxPQUFPLHFCQUFxQixPQUFPLElBQUksWUFBWSxPQUFPLE1BQU0sS0FBSyxPQUFPLEtBQUssR0FBRztBQUN4SCxXQUFPLE9BQU87QUFBQSxFQUNoQixPQUFPO0FBQ0wsUUFBSSxPQUFPLE1BQU0sU0FBUztBQUFVLGFBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTywyQkFBMkI7QUFDMUYsUUFBSTtBQUNKLFFBQUk7QUFDRixlQUFTLE1BQU0sZUFBZSxNQUFNLElBQUk7QUFBQSxJQUMxQyxTQUFTLEdBQUc7QUFDVixhQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sa0NBQWtDLGFBQWEsUUFBUSxFQUFFLFVBQVUsT0FBTyxDQUFDLENBQUMsR0FBRztBQUFBLElBQzVHO0FBQ0EsUUFBSSxPQUFPLFdBQVc7QUFBRyxhQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sZ0NBQWdDO0FBQ3BGLFdBQU8sT0FBTyxDQUFDLEVBQUU7QUFDakIsZ0JBQVksT0FBTyxDQUFDLEVBQUU7QUFDdEIsb0JBQWdCLE9BQU8sU0FBUztBQUFBLEVBQ2xDO0FBRUEsUUFBTSxRQUFRLFdBQVcsRUFBRSxXQUFXLEtBQUssR0FBRyxNQUFNLEtBQUs7QUFDekQsTUFBSSxDQUFDLE1BQU07QUFBSSxXQUFPLEVBQUUsSUFBSSxPQUFPLE9BQU8sTUFBTSxNQUFNO0FBR3RELFFBQU0sT0FBTztBQUNiLFdBQVMsVUFBVSxHQUFHLFVBQVUsSUFBSSxXQUFXO0FBQzdDLFVBQU0sT0FBTyxhQUFhLE1BQU0sUUFBUSxNQUFNLE1BQU0sUUFBUSxNQUFNO0FBQ2xFLFFBQUksU0FBUztBQUFNLGFBQU8sRUFBRSxJQUFJLE9BQU8sT0FBTywyQkFBMkI7QUFDekUsUUFBSTtBQUNGLFlBQU0sTUFBTSxRQUFRLE9BQU8sTUFBTSxNQUFNLE9BQU87QUFDOUMsYUFBTyxFQUFFLElBQUksTUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLGVBQWUsVUFBVTtBQUFBLElBQzFFLFNBQVMsR0FBRztBQUNWLFVBQUksQ0FBQyxNQUFNLFFBQVEsT0FBTyxJQUFJLEdBQUc7QUFDL0IsZUFBTyxFQUFFLElBQUksT0FBTyxPQUFPLDZCQUE2QixhQUFhLFFBQVEsRUFBRSxVQUFVLE9BQU8sQ0FBQyxDQUFDLEdBQUc7QUFBQSxNQUN2RztBQUFBLElBRUY7QUFBQSxFQUNGO0FBQ0EsU0FBTyxFQUFFLElBQUksT0FBTyxPQUFPLG1DQUFtQztBQUNoRTs7O0EvQzlGTyxJQUFNLG9CQUFvQjtBQUMxQixJQUFNLHNCQUFzQjtBQUU1QixTQUFTLHNCQUFzQixRQUFzQjtBQUMxRCxTQUFPLFdBQVc7QUFBQSxJQUNoQixJQUFJO0FBQUEsSUFDSixNQUFNO0FBQUEsSUFDTixVQUFVLE1BQU0sU0FBUyxPQUFPLEdBQUc7QUFBQSxFQUNyQyxDQUFDO0FBQ0g7QUFFQSxTQUFTLE9BQU8sTUFBaUM7QUFDL0MsUUFBTSxRQUFRLEtBQUssWUFBWTtBQUMvQixNQUFJLE1BQU0sU0FBUyxNQUFNO0FBQUcsV0FBTztBQUNuQyxNQUFJLE1BQU0sU0FBUyxPQUFPO0FBQUcsV0FBTztBQUNwQyxTQUFPO0FBQ1Q7QUFFQSxTQUFTLFNBQVMsS0FBZ0I7QUFDaEMsUUFBTSxRQUFRLFNBQVMsY0FBYyxPQUFPO0FBQzVDLFFBQU0sT0FBTztBQUNiLFFBQU0sU0FBUztBQUNmLFFBQU0sV0FBVyxNQUFNO0FBQ3JCLFVBQU0sT0FBTyxNQUFNLFFBQVEsQ0FBQztBQUM1QixRQUFJO0FBQU0sV0FBSyxxQkFBcUIsS0FBSyxJQUFJO0FBQUEsRUFDL0M7QUFDQSxRQUFNLE1BQU07QUFDZDtBQUVBLGVBQWUscUJBQXFCLEtBQVUsTUFBMkI7QUFDdkUsUUFBTSxPQUFPLE9BQU8sS0FBSyxJQUFJO0FBQzdCLE1BQUksU0FBUyxNQUFNO0FBQ2pCLFFBQUksdUJBQU8sOEJBQThCO0FBQ3pDO0FBQUEsRUFDRjtBQUNBLFFBQU0sT0FBTyxTQUFTLFFBQVEsTUFBTSxLQUFLLEtBQUssSUFBSSxNQUFNLEtBQUssWUFBWTtBQUN6RSxNQUFJLGFBQWEsS0FBSyxDQUFDLFdBQVcsS0FBSyxVQUFVLEtBQUssTUFBTSxLQUFLLE1BQU0sTUFBTSxNQUFNLENBQUMsRUFBRSxLQUFLO0FBQzdGO0FBRUEsZUFBZSxVQUNiLEtBQ0EsTUFDQSxVQUNBLE1BQ0EsUUFDZTtBQUNmLFFBQU0sVUFBVSxNQUFNLFlBQVk7QUFBQSxJQUNoQztBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsUUFBUSxDQUFDLFNBQVMsSUFBSSxNQUFNLHNCQUFzQixJQUFJLE1BQU07QUFBQSxNQUM1RCxRQUFRLE9BQU8sTUFBTSxZQUFZO0FBQy9CLGNBQU0sSUFBSSxNQUFNLE9BQU8sTUFBTSxPQUFPO0FBQUEsTUFDdEM7QUFBQSxJQUNGO0FBQUEsRUFDRixDQUFDO0FBRUQsTUFBSSxDQUFDLFFBQVEsSUFBSTtBQUNmLFFBQUksdUJBQU8sdUNBQXVDLFFBQVEsS0FBSyxFQUFFO0FBQ2pFO0FBQUEsRUFDRjtBQUVBLFFBQU0sUUFBUSxRQUFRLGdCQUFnQixJQUFJLHVDQUF1QyxRQUFRLGFBQWEsOEJBQThCO0FBQ3BJLE1BQUksdUJBQU8sWUFBWSxRQUFRLE9BQU8sUUFBUSxZQUFZLFFBQVEsSUFBSSxJQUFJLEtBQUssRUFBRTtBQUVqRixRQUFNLFVBQVUsSUFBSSxNQUFNLHNCQUFzQixRQUFRLElBQUk7QUFDNUQsTUFBSSxtQkFBbUIsdUJBQU87QUFDNUIsVUFBTSxJQUFJLFVBQVUsUUFBUSxJQUFJLEVBQUUsU0FBUyxPQUFPO0FBQUEsRUFDcEQ7QUFDRjtBQUdBLElBQU0sZUFBTixjQUEyQixrQ0FBMEI7QUFBQSxFQUNuRCxZQUFZLEtBQTJCLFFBQWtDO0FBQ3ZFLFVBQU0sR0FBRztBQUQ0QjtBQUVyQyxTQUFLLGVBQWUscUNBQXFDO0FBQUEsRUFDM0Q7QUFBQSxFQUVBLFdBQXFCO0FBQ25CLFVBQU0sVUFBVSxLQUFLLElBQUksTUFDdEIsa0JBQWtCLEVBQ2xCLE9BQU8sQ0FBQyxNQUFvQixhQUFhLDJCQUFXLENBQUMsRUFBRSxPQUFPLENBQUMsRUFDL0QsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQ2pCLEtBQUs7QUFDUixXQUFPLENBQUMsSUFBSSxHQUFHLE9BQU87QUFBQSxFQUN4QjtBQUFBLEVBRUEsWUFBWSxNQUFzQjtBQUNoQyxXQUFPLFNBQVMsS0FBSyxtQkFBbUI7QUFBQSxFQUMxQztBQUFBLEVBRUEsYUFBYSxNQUFvQjtBQUMvQixTQUFLLE9BQU8sSUFBSTtBQUFBLEVBQ2xCO0FBQ0Y7OztBRHBHQSxJQUFxQixnQkFBckIsY0FBMkMsd0JBQU87QUFBQSxFQUNqRCxNQUFNLFNBQVM7QUFDZCxTQUFLLFdBQVc7QUFBQSxNQUNmLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTTtBQUNmLGdCQUFRLElBQUksb0NBQW9DO0FBQUEsTUFDakQ7QUFBQSxJQUNELENBQUM7QUFDRCwwQkFBc0IsSUFBSTtBQUFBLEVBQzNCO0FBQ0Q7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJjcmVhdGVEb2N1bWVudCIsICJjb250ZW50IiwgIkRPTVBhcnNlciIsICJwYXJzZUZyb21TdHJpbmciLCAidHJpbSIsICJlcnIiLCAibCIsICJ0ZCIsICJlcnIiLCAiZGF0IiwgIl9hIiwgIl9hIiwgImkiLCAiX2EiLCAiZSIsICJpbnB1dCIsICJvcHRpb25zIiwgInVuemlwRnJvbUFycmF5QnVmZmVyVXNpbmdGdW5jdGlvbiIsICJ1bnppcEFzeW5jIiwgIl9yZWYiLCAiYXJndW1lbnRzIiwgImxlbmd0aCIsICJ1bmRlZmluZWQiLCAiZmlsdGVyIiwgInVuemlwIiwgImlzQXN5bmMiLCAiVWludDhBcnJheSIsICJmaWxlIiwgInBhdGgiLCAibmFtZSIsICJhcmNoaXZlIiwgIlByb21pc2UiLCAicmVzb2x2ZSIsICJyZWplY3QiLCAiZXJyb3IiLCAiZmlsZXMiLCAiZW50cmllcyIsICJjb252ZXJ0ZWRFbnRyaWVzIiwgIl9pIiwgIl9PYmplY3Qka2V5cyIsICJPYmplY3QiLCAia2V5cyIsICJsZW5ndGgiLCAia2V5IiwgInN0ckZyb21VOCIsICJfcmVmIiwgInBhdGgiLCAiZW5kc1dpdGgiLCAiaW5wdXQiLCAiRmlsZSIsICJCbG9iIiwgImFycmF5QnVmZmVyIiwgInRoZW4iLCAiZ2V0UmVzdWx0RnJvbUFycmF5QnVmZmVyIiwgIlByb21pc2UiLCAicmVzb2x2ZSIsICJ1bnppcEZyb21BcnJheUJ1ZmZlciIsICJmaWx0ZXIiLCAiZmlsdGVyWmlwQXJjaGl2ZUVudHJ5IiwgImNvbnZlcnRWYWx1ZXNGcm9tVWludDhBcnJheXNUb1N0cmluZ3MiLCAiZmluZENoaWxkIiwgIm5vZGUiLCAidGFnTmFtZSIsICJpIiwgImNoaWxkTm9kZXMiLCAibGVuZ3RoIiwgImNoaWxkTm9kZSIsICJub2RlVHlwZSIsICJnZXRUYWdOYW1lIiwgImZpbmRDaGlsZHJlbiIsICJyZXN1bHRzIiwgInB1c2giLCAiZm9yRWFjaCIsICJmdW5jIiwgIm1hcCIsICJOQU1FU1BBQ0VfUkVHX0VYUCIsICJlbGVtZW50IiwgInJlcGxhY2UiLCAiaXNFbGVtZW50IiwgImdldEZpcnN0RWxlbWVudENoaWxkIiwgImdldE91dGVyWG1sIiwgInRleHRDb250ZW50IiwgInhtbCIsICJqIiwgImF0dHJpYnV0ZXMiLCAibmFtZSIsICJ2YWx1ZSIsICJnZXRDZWxsRWxlbWVudHMiLCAiZG9jdW1lbnQiLCAid29ya3NoZWV0IiwgImRvY3VtZW50RWxlbWVudCIsICJzaGVldERhdGEiLCAiZmluZENoaWxkIiwgImNlbGxzIiwgImZvckVhY2giLCAicm93IiwgImNlbGwiLCAicHVzaCIsICJnZXRDZWxsVmFsdWVFbGVtZW50IiwgImRvY3VtZW50IiwgImVsZW1lbnQiLCAiZmluZENoaWxkIiwgImdldENlbGxJbmxpbmVTdHJpbmdWYWx1ZSIsICJmaXJzdEVsZW1lbnRDaGlsZCIsICJnZXRGaXJzdEVsZW1lbnRDaGlsZCIsICJnZXRUYWdOYW1lIiwgImZpcnN0RWxlbWVudENoaWxkRmlyc3RFbGVtZW50Q2hpbGQiLCAidGV4dENvbnRlbnQiLCAiZ2V0RGltZW5zaW9ucyIsICJ3b3Jrc2hlZXQiLCAiZG9jdW1lbnRFbGVtZW50IiwgImRpbWVuc2lvbnMiLCAiZ2V0QXR0cmlidXRlIiwgImdldEJhc2VTdHlsZXMiLCAic3R5bGVTaGVldCIsICJjZWxsU3R5bGVYZnMiLCAiZmluZENoaWxkcmVuIiwgImdldENlbGxTdHlsZXMiLCAiY2VsbFhmcyIsICJnZXROdW1iZXJGb3JtYXRzIiwgIm51bWJlckZvcm1hdHMiLCAibnVtRm10cyIsICJnZXRTaGFyZWRTdHJpbmdzIiwgInNzdCIsICJtYXAiLCAic3RyaW5nIiwgInQiLCAidmFsdWUiLCAiZm9yRWFjaCIsICJyIiwgImdldFdvcmtib29rUHJvcGVydGllcyIsICJ3b3JrYm9vayIsICJnZXRSZWxhdGlvbnNoaXBzIiwgInJlbGF0aW9uc2hpcHMiLCAiZ2V0U2hlZXRzIiwgInNoZWV0cyIsICJjb250ZW50IiwgInhtbCIsICJib29rIiwgImNyZWF0ZURvY3VtZW50IiwgIndvcmtib29rUHJvcGVydGllcyIsICJnZXRXb3JrYm9va1Byb3BlcnRpZXMiLCAiZXBvY2gxOTA0IiwgIkJvb2xlYW4iLCAiZ2V0QXR0cmlidXRlIiwgInNoZWV0cyIsICJfaXRlcmF0b3IiLCAiX2NyZWF0ZUZvck9mSXRlcmF0b3JIZWxwZXJMb29zZSIsICJnZXRTaGVldHMiLCAiX3N0ZXAiLCAiZG9uZSIsICJzaGVldCIsICJ2YWx1ZSIsICJwdXNoIiwgImlkIiwgIm5hbWUiLCAicmVsYXRpb25JZCIsICJjb250ZW50IiwgInhtbCIsICJkb2N1bWVudCIsICJjcmVhdGVEb2N1bWVudCIsICJmaWxlUGF0aHMiLCAic2hlZXRzIiwgInNoYXJlZFN0cmluZ3MiLCAidW5kZWZpbmVkIiwgInN0eWxlcyIsICJhZGRGaWxlUGF0aEluZm8iLCAicmVsYXRpb25zaGlwIiwgImZpbGVQYXRoIiwgImdldEF0dHJpYnV0ZSIsICJmaWxlVHlwZSIsICJnZXRGaWxlUGF0aCIsICJnZXRSZWxhdGlvbnNoaXBzIiwgImZvckVhY2giLCAicGF0aCIsICJzbGljZSIsICJsZW5ndGgiLCAiY29udGVudCIsICJ4bWwiLCAiZG9jIiwgImNyZWF0ZURvY3VtZW50IiwgImJhc2VTdHlsZXMiLCAiZ2V0QmFzZVN0eWxlcyIsICJtYXAiLCAicGFyc2VDZWxsU3R5bGUiLCAibnVtYmVyRm9ybWF0cyIsICJnZXROdW1iZXJGb3JtYXRzIiwgInBhcnNlTnVtYmVyRm9ybWF0U3R5bGUiLCAicmVkdWNlIiwgImZvcm1hdHMiLCAiZm9ybWF0IiwgImlkIiwgImdldENlbGxTdHlsZSIsICJ4ZiIsICJoYXNBdHRyaWJ1dGUiLCAiX29iamVjdFNwcmVhZCIsICJ4ZklkIiwgImdldENlbGxTdHlsZXMiLCAibnVtRm10IiwgImdldEF0dHJpYnV0ZSIsICJ0ZW1wbGF0ZSIsICJudW1GbXRzIiwgInN0eWxlIiwgIm51bWJlckZvcm1hdElkIiwgIm51bWJlckZvcm1hdCIsICJjb250ZW50IiwgInhtbCIsICJnZXRTaGFyZWRTdHJpbmdzIiwgImNyZWF0ZURvY3VtZW50IiwgImV4Y2VsU2VyaWFsRGF0ZSIsICJvcHRpb25zIiwgImVwb2NoMTkwNCIsICJEQVlTX0lOX1lFQVIiLCAiSkFOVUFSWV8wVEhfMTkwMF9EQVkiLCAiRVJST05FT1VTX0ZFQlJVQVJZXzI5XzE5OTBfREFZIiwgImRheXNCZWZvcmVVbml4RXBvY2giLCAiTlVNQkVSX09GX0xFQVBfWUVBUlNfQkVUV0VFTl8xOTAwX0FORF8xOTcwIiwgIkRhdGUiLCAiTWF0aCIsICJmbG9vciIsICJEQVkiLCAiREFURV9GT1JNQVRfU1BFQ0lGSUNfTE9DQUxFX1BSRUZJWCIsICJEQVRFX0ZPUk1BVF9BTExPV19BTllfT1RIRVJfVEVYVF9TVUZGSVgiLCAiQ0FDSEUiLCAidGVtcGxhdGUiLCAicmVzdWx0IiwgImlzRGF0ZUZvcm1hdCIsICJ0b0xvd2VyQ2FzZSIsICJyZXBsYWNlIiwgInRva2VucyIsICJzcGxpdCIsICJsZW5ndGgiLCAiX2l0ZXJhdG9yIiwgIl9jcmVhdGVGb3JPZkl0ZXJhdG9ySGVscGVyTG9vc2UiLCAiX3N0ZXAiLCAiZG9uZSIsICJ0b2tlbiIsICJ2YWx1ZSIsICJEQVRFX1RFTVBMQVRFX1RPS0VOUyIsICJpbmRleE9mIiwgInN0eWxlSWQiLCAic3R5bGVzIiwgIm9wdGlvbnMiLCAic3R5bGUiLCAiRXJyb3IiLCAiY29uY2F0IiwgIm51bWJlckZvcm1hdCIsICJCVUlMVF9JTl9EQVRFX0ZPUk1BVF9JRFMiLCAiaW5kZXhPZiIsICJOdW1iZXIiLCAiaWQiLCAiZGF0ZUZvcm1hdCIsICJ0ZW1wbGF0ZSIsICJzbWFydERhdGVQYXJzZXIiLCAiaXNEYXRlRm9ybWF0IiwgIkxPQ0FMRV9JTkRFUEVOREVOVF9CVUlMVF9JTl9EQVRFX0ZPUk1BVF9JRFMiLCAiTUFJTkxBTkRfQ0hJTkVTRV9PUl9UQUlXQU5FU0VfTE9DQUxFX0JVSUxUX0lOX0RBVEVfRk9STUFUX0lEUyIsICJKQVBBTkVTRV9PUl9LT1JFQU5fTE9DQUxFX0JVSUxUX0lOX0RBVEVfRk9STUFUX0lEUyIsICJUSEFJX0xPQ0FMRV9CVUlMVF9JTl9EQVRFX0ZPUk1BVF9JRFMiLCAiZmlsdGVyIiwgIm51bWJlckZvcm1hdElkIiwgInZhbHVlIiwgInR5cGUiLCAiX3JlZiIsICJnZXRJbmxpbmVTdHJpbmdWYWx1ZSIsICJnZXRJbmxpbmVTdHJpbmdYbWwiLCAiZ2V0U3R5bGVJZCIsICJzdHlsZXMiLCAic2hhcmVkU3RyaW5ncyIsICJlcG9jaDE5MDQiLCAib3B0aW9ucyIsICJwYXJzZVN0cmluZyIsICJ1bmRlZmluZWQiLCAiRXJyb3IiLCAiY29uY2F0IiwgInNoYXJlZFN0cmluZ0luZGV4IiwgIk51bWJlciIsICJpc05hTiIsICJsZW5ndGgiLCAiZGVjb2RlRXJyb3IiLCAicGFyc2VkRGF0ZSIsICJEYXRlIiwgInZhbHVlT2YiLCAic3R5bGVJZCIsICJpc0RhdGVGb3JtYXRTdHlsZSIsICJwYXJzZU51bWJlckRlZmF1bHQiLCAicGFyc2VFeGNlbERhdGUiLCAicGFyc2VOdW1iZXIiLCAiVHlwZUVycm9yIiwgImVycm9yQ29kZSIsICJ0cmltIiwgInN0cmluZ2lmaWVkTnVtYmVyIiwgInBhcnNlZE51bWJlciIsICJjb29yZGluYXRlc1N0cmluZyIsICJfY29vcmRpbmF0ZXNTdHJpbmckc3AiLCAic3BsaXQiLCAiX2Nvb3JkaW5hdGVzU3RyaW5nJHNwMiIsICJfc2xpY2VkVG9BcnJheSIsICJjb2x1bW4iLCAicm93IiwgIk51bWJlciIsICJnZXRDb2x1bW5OdW1iZXJGcm9tQ29sdW1uTGV0dGVycyIsICJ0cmltIiwgIkxFVFRFUlMiLCAiY29sdW1uTGV0dGVycyIsICJuIiwgImkiLCAibGVuZ3RoIiwgImluZGV4T2YiLCAiZWxlbWVudCIsICJzaGVldERvY3VtZW50IiwgInNoYXJlZFN0cmluZ3MiLCAic3R5bGVzIiwgImVwb2NoMTkwNCIsICJvcHRpb25zIiwgImNvb3JkaW5hdGVzIiwgInBhcnNlQ2VsbENvb3JkaW5hdGVzIiwgImdldEF0dHJpYnV0ZSIsICJ2YWx1ZUVsZW1lbnQiLCAiZ2V0Q2VsbFZhbHVlRWxlbWVudCIsICJ2YWx1ZSIsICJ0ZXh0Q29udGVudCIsICJ0eXBlIiwgInJvdyIsICJjb2x1bW4iLCAicGFyc2VDZWxsVmFsdWUiLCAiZ2V0SW5saW5lU3RyaW5nVmFsdWUiLCAiZ2V0Q2VsbElubGluZVN0cmluZ1ZhbHVlIiwgImdldElubGluZVN0cmluZ1htbCIsICJnZXRPdXRlclhtbCIsICJnZXRTdHlsZUlkIiwgInNoZWV0RG9jdW1lbnQiLCAic2hhcmVkU3RyaW5ncyIsICJzdHlsZXMiLCAiZXBvY2gxOTA0IiwgIm9wdGlvbnMiLCAiY2VsbHMiLCAiZ2V0Q2VsbEVsZW1lbnRzIiwgImxlbmd0aCIsICJtYXAiLCAiZWxlbWVudCIsICJwYXJzZUNlbGwiLCAic2hlZXREb2N1bWVudCIsICJkaW1lbnNpb25zIiwgImdldERpbWVuc2lvbnMiLCAic3BsaXQiLCAibWFwIiwgInBhcnNlQ2VsbENvb3JkaW5hdGVzIiwgIl9yZWYiLCAiX3JlZjIiLCAiX3NsaWNlZFRvQXJyYXkiLCAicm93IiwgImNvbHVtbiIsICJsZW5ndGgiLCAiY2VsbHMiLCAiY29tcGFyYXRvciIsICJhIiwgImIiLCAiYWxsUm93cyIsICJtYXAiLCAiY2VsbCIsICJyb3ciLCAic29ydCIsICJhbGxDb2xzIiwgImNvbHVtbiIsICJtaW5Sb3ciLCAibWF4Um93IiwgImxlbmd0aCIsICJtaW5Db2wiLCAibWF4Q29sIiwgImRhdGEiLCAiX3JlZiIsICJhcmd1bWVudHMiLCAibGVuZ3RoIiwgInVuZGVmaW5lZCIsICJyb3dJbmRleFNvdXJjZU1hcCIsICJfcmVmJGFjY2Vzc29yIiwgImFjY2Vzc29yIiwgIl8iLCAib25seVRyaW1BdFRoZUVuZCIsICJpIiwgImVtcHR5IiwgIl9pdGVyYXRvciIsICJfY3JlYXRlRm9yT2ZJdGVyYXRvckhlbHBlckxvb3NlIiwgIl9zdGVwIiwgImRvbmUiLCAiY2VsbCIsICJ2YWx1ZSIsICJzcGxpY2UiLCAiZGF0YSIsICJfcmVmIiwgImFyZ3VtZW50cyIsICJsZW5ndGgiLCAidW5kZWZpbmVkIiwgIl9yZWYkYWNjZXNzb3IiLCAiYWNjZXNzb3IiLCAiXyIsICJvbmx5VHJpbUF0VGhlRW5kIiwgImkiLCAiZW1wdHkiLCAiX2l0ZXJhdG9yIiwgIl9jcmVhdGVGb3JPZkl0ZXJhdG9ySGVscGVyTG9vc2UiLCAiX3N0ZXAiLCAiZG9uZSIsICJyb3ciLCAidmFsdWUiLCAiaiIsICJzcGxpY2UiLCAiY2VsbHMiLCAiZGltZW5zaW9ucyIsICJsZW5ndGgiLCAiX2RpbWVuc2lvbnMiLCAiX3NsaWNlZFRvQXJyYXkiLCAibGVmdFRvcCIsICJyaWdodEJvdHRvbSIsICJjb2xzQ291bnQiLCAiY29sdW1uIiwgInJvd3NDb3VudCIsICJyb3ciLCAiZGF0YSIsICJBcnJheSIsICJpIiwgImoiLCAiX2l0ZXJhdG9yIiwgIl9jcmVhdGVGb3JPZkl0ZXJhdG9ySGVscGVyTG9vc2UiLCAiX3N0ZXAiLCAiZG9uZSIsICJjZWxsIiwgInZhbHVlIiwgInJvd0luZGV4IiwgImNvbHVtbkluZGV4IiwgImRyb3BFbXB0eVJvd3MiLCAiZHJvcEVtcHR5Q29sdW1ucyIsICJvbmx5VHJpbUF0VGhlRW5kIiwgImNvbnRlbnQiLCAieG1sIiwgInNoYXJlZFN0cmluZ3MiLCAic3R5bGVzIiwgImVwb2NoMTkwNCIsICJvcHRpb25zIiwgInNoZWV0RG9jdW1lbnQiLCAiY3JlYXRlRG9jdW1lbnQiLCAiY2VsbHMiLCAicGFyc2VDZWxscyIsICJkaW1lbnNpb25zIiwgInBhcnNlU2hlZXREaW1lbnNpb25zIiwgInJlY29uc3RydWN0U2hlZXREaW1lbnNpb25zRnJvbVNoZWV0Q2VsbHMiLCAiY29udmVydFNoZWV0VG9EYXRhMmRBcnJheSIsICJjb250ZW50cyIsICJ4bWwiLCAib3B0aW9ucyIsICJhcmd1bWVudHMiLCAibGVuZ3RoIiwgInVuZGVmaW5lZCIsICJnZXRGaWxlQ29udGVudCIsICJmaWxlUGF0aCIsICJFcnJvciIsICJjb25jYXQiLCAiZmlsZVBhdGhzIiwgInBhcnNlRmlsZVBhdGhzIiwgInNoYXJlZFN0cmluZ3MiLCAicGFyc2VTaGFyZWRTdHJpbmdzIiwgInN0eWxlcyIsICJwYXJzZVN0eWxlcyIsICJfcGFyc2VTcHJlYWRzaGVldEluZm8iLCAicGFyc2VTcHJlYWRzaGVldEluZm8iLCAic2hlZXRzIiwgImVwb2NoMTkwNCIsICJzaGVldElkc1RvUmVhZCIsICJtYXAiLCAic2hlZXQiLCAiZ2V0U2hlZXRJZCIsICJzaGVldHNEYXRhIiwgIl9pIiwgIl9PYmplY3Qka2V5cyIsICJPYmplY3QiLCAia2V5cyIsICJzaGVldElkIiwgImluY2x1ZGVzIiwgInB1c2giLCAiZ2V0U2hlZXROYW1lQnlJZCIsICJkYXRhIiwgInBhcnNlU2hlZXQiLCAiX2l0ZXJhdG9yIiwgIl9jcmVhdGVGb3JPZkl0ZXJhdG9ySGVscGVyTG9vc2UiLCAiX3N0ZXAiLCAiZG9uZSIsICJfc2hlZXQiLCAidmFsdWUiLCAibmFtZSIsICJyZWxhdGlvbklkIiwgIl9yZWYiLCAiam9pbiIsICJfaXRlcmF0b3IyIiwgIl9zdGVwMiIsICJpbnB1dCIsICJvcHRpb25zIiwgInVucGFja1hsc3hGaWxlIiwgInRoZW4iLCAiY29udGVudHMiLCAicGFyc2VTcHJlYWRzaGVldENvbnRlbnRzIiwgInhtbCIsICJuIiwgInNlcmlhbGl6ZSJdCn0K
