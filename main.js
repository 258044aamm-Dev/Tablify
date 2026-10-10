"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/jszip/dist/jszip.min.js
var require_jszip_min = __commonJS({
  "node_modules/jszip/dist/jszip.min.js"(exports, module2) {
    !function(e) {
      if ("object" == typeof exports && "undefined" != typeof module2)
        module2.exports = e();
      else if ("function" == typeof define && define.amd)
        define([], e);
      else {
        ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).JSZip = e();
      }
    }(function() {
      return function s(a, o, h) {
        function u(r, e2) {
          if (!o[r]) {
            if (!a[r]) {
              var t = "function" == typeof require && require;
              if (!e2 && t)
                return t(r, true);
              if (l)
                return l(r, true);
              var n = new Error("Cannot find module '" + r + "'");
              throw n.code = "MODULE_NOT_FOUND", n;
            }
            var i = o[r] = { exports: {} };
            a[r][0].call(i.exports, function(e3) {
              var t2 = a[r][1][e3];
              return u(t2 || e3);
            }, i, i.exports, s, a, o, h);
          }
          return o[r].exports;
        }
        for (var l = "function" == typeof require && require, e = 0; e < h.length; e++)
          u(h[e]);
        return u;
      }({ 1: [function(e, t, r) {
        "use strict";
        var d = e("./utils"), c = e("./support"), p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        r.encode = function(e2) {
          for (var t2, r2, n, i, s, a, o, h = [], u = 0, l = e2.length, f = l, c2 = "string" !== d.getTypeOf(e2); u < e2.length; )
            f = l - u, n = c2 ? (t2 = e2[u++], r2 = u < l ? e2[u++] : 0, u < l ? e2[u++] : 0) : (t2 = e2.charCodeAt(u++), r2 = u < l ? e2.charCodeAt(u++) : 0, u < l ? e2.charCodeAt(u++) : 0), i = t2 >> 2, s = (3 & t2) << 4 | r2 >> 4, a = 1 < f ? (15 & r2) << 2 | n >> 6 : 64, o = 2 < f ? 63 & n : 64, h.push(p.charAt(i) + p.charAt(s) + p.charAt(a) + p.charAt(o));
          return h.join("");
        }, r.decode = function(e2) {
          var t2, r2, n, i, s, a, o = 0, h = 0, u = "data:";
          if (e2.substr(0, u.length) === u)
            throw new Error("Invalid base64 input, it looks like a data url.");
          var l, f = 3 * (e2 = e2.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
          if (e2.charAt(e2.length - 1) === p.charAt(64) && f--, e2.charAt(e2.length - 2) === p.charAt(64) && f--, f % 1 != 0)
            throw new Error("Invalid base64 input, bad content length.");
          for (l = c.uint8array ? new Uint8Array(0 | f) : new Array(0 | f); o < e2.length; )
            t2 = p.indexOf(e2.charAt(o++)) << 2 | (i = p.indexOf(e2.charAt(o++))) >> 4, r2 = (15 & i) << 4 | (s = p.indexOf(e2.charAt(o++))) >> 2, n = (3 & s) << 6 | (a = p.indexOf(e2.charAt(o++))), l[h++] = t2, 64 !== s && (l[h++] = r2), 64 !== a && (l[h++] = n);
          return l;
        };
      }, { "./support": 30, "./utils": 32 }], 2: [function(e, t, r) {
        "use strict";
        var n = e("./external"), i = e("./stream/DataWorker"), s = e("./stream/Crc32Probe"), a = e("./stream/DataLengthProbe");
        function o(e2, t2, r2, n2, i2) {
          this.compressedSize = e2, this.uncompressedSize = t2, this.crc32 = r2, this.compression = n2, this.compressedContent = i2;
        }
        o.prototype = { getContentWorker: function() {
          var e2 = new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")), t2 = this;
          return e2.on("end", function() {
            if (this.streamInfo.data_length !== t2.uncompressedSize)
              throw new Error("Bug : uncompressed data size mismatch");
          }), e2;
        }, getCompressedWorker: function() {
          return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
        } }, o.createWorkerFrom = function(e2, t2, r2) {
          return e2.pipe(new s()).pipe(new a("uncompressedSize")).pipe(t2.compressWorker(r2)).pipe(new a("compressedSize")).withStreamInfo("compression", t2);
        }, t.exports = o;
      }, { "./external": 6, "./stream/Crc32Probe": 25, "./stream/DataLengthProbe": 26, "./stream/DataWorker": 27 }], 3: [function(e, t, r) {
        "use strict";
        var n = e("./stream/GenericWorker");
        r.STORE = { magic: "\0\0", compressWorker: function() {
          return new n("STORE compression");
        }, uncompressWorker: function() {
          return new n("STORE decompression");
        } }, r.DEFLATE = e("./flate");
      }, { "./flate": 7, "./stream/GenericWorker": 28 }], 4: [function(e, t, r) {
        "use strict";
        var n = e("./utils");
        var o = function() {
          for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
            e2 = r2;
            for (var n2 = 0; n2 < 8; n2++)
              e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
            t2[r2] = e2;
          }
          return t2;
        }();
        t.exports = function(e2, t2) {
          return void 0 !== e2 && e2.length ? "string" !== n.getTypeOf(e2) ? function(e3, t3, r2, n2) {
            var i = o, s = n2 + r2;
            e3 ^= -1;
            for (var a = n2; a < s; a++)
              e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3[a])];
            return -1 ^ e3;
          }(0 | t2, e2, e2.length, 0) : function(e3, t3, r2, n2) {
            var i = o, s = n2 + r2;
            e3 ^= -1;
            for (var a = n2; a < s; a++)
              e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3.charCodeAt(a))];
            return -1 ^ e3;
          }(0 | t2, e2, e2.length, 0) : 0;
        };
      }, { "./utils": 32 }], 5: [function(e, t, r) {
        "use strict";
        r.base64 = false, r.binary = false, r.dir = false, r.createFolders = true, r.date = null, r.compression = null, r.compressionOptions = null, r.comment = null, r.unixPermissions = null, r.dosPermissions = null;
      }, {}], 6: [function(e, t, r) {
        "use strict";
        var n = null;
        n = "undefined" != typeof Promise ? Promise : e("lie"), t.exports = { Promise: n };
      }, { lie: 37 }], 7: [function(e, t, r) {
        "use strict";
        var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Uint32Array, i = e("pako"), s = e("./utils"), a = e("./stream/GenericWorker"), o = n ? "uint8array" : "array";
        function h(e2, t2) {
          a.call(this, "FlateWorker/" + e2), this._pako = null, this._pakoAction = e2, this._pakoOptions = t2, this.meta = {};
        }
        r.magic = "\b\0", s.inherits(h, a), h.prototype.processChunk = function(e2) {
          this.meta = e2.meta, null === this._pako && this._createPako(), this._pako.push(s.transformTo(o, e2.data), false);
        }, h.prototype.flush = function() {
          a.prototype.flush.call(this), null === this._pako && this._createPako(), this._pako.push([], true);
        }, h.prototype.cleanUp = function() {
          a.prototype.cleanUp.call(this), this._pako = null;
        }, h.prototype._createPako = function() {
          this._pako = new i[this._pakoAction]({ raw: true, level: this._pakoOptions.level || -1 });
          var t2 = this;
          this._pako.onData = function(e2) {
            t2.push({ data: e2, meta: t2.meta });
          };
        }, r.compressWorker = function(e2) {
          return new h("Deflate", e2);
        }, r.uncompressWorker = function() {
          return new h("Inflate", {});
        };
      }, { "./stream/GenericWorker": 28, "./utils": 32, pako: 38 }], 8: [function(e, t, r) {
        "use strict";
        function A(e2, t2) {
          var r2, n2 = "";
          for (r2 = 0; r2 < t2; r2++)
            n2 += String.fromCharCode(255 & e2), e2 >>>= 8;
          return n2;
        }
        function n(e2, t2, r2, n2, i2, s2) {
          var a, o, h = e2.file, u = e2.compression, l = s2 !== O.utf8encode, f = I.transformTo("string", s2(h.name)), c = I.transformTo("string", O.utf8encode(h.name)), d = h.comment, p = I.transformTo("string", s2(d)), m = I.transformTo("string", O.utf8encode(d)), _ = c.length !== h.name.length, g = m.length !== d.length, b = "", v = "", y = "", w = h.dir, k = h.date, x = { crc32: 0, compressedSize: 0, uncompressedSize: 0 };
          t2 && !r2 || (x.crc32 = e2.crc32, x.compressedSize = e2.compressedSize, x.uncompressedSize = e2.uncompressedSize);
          var S = 0;
          t2 && (S |= 8), l || !_ && !g || (S |= 2048);
          var z = 0, C = 0;
          w && (z |= 16), "UNIX" === i2 ? (C = 798, z |= function(e3, t3) {
            var r3 = e3;
            return e3 || (r3 = t3 ? 16893 : 33204), (65535 & r3) << 16;
          }(h.unixPermissions, w)) : (C = 20, z |= function(e3) {
            return 63 & (e3 || 0);
          }(h.dosPermissions)), a = k.getUTCHours(), a <<= 6, a |= k.getUTCMinutes(), a <<= 5, a |= k.getUTCSeconds() / 2, o = k.getUTCFullYear() - 1980, o <<= 4, o |= k.getUTCMonth() + 1, o <<= 5, o |= k.getUTCDate(), _ && (v = A(1, 1) + A(B(f), 4) + c, b += "up" + A(v.length, 2) + v), g && (y = A(1, 1) + A(B(p), 4) + m, b += "uc" + A(y.length, 2) + y);
          var E = "";
          return E += "\n\0", E += A(S, 2), E += u.magic, E += A(a, 2), E += A(o, 2), E += A(x.crc32, 4), E += A(x.compressedSize, 4), E += A(x.uncompressedSize, 4), E += A(f.length, 2), E += A(b.length, 2), { fileRecord: R.LOCAL_FILE_HEADER + E + f + b, dirRecord: R.CENTRAL_FILE_HEADER + A(C, 2) + E + A(p.length, 2) + "\0\0\0\0" + A(z, 4) + A(n2, 4) + f + b + p };
        }
        var I = e("../utils"), i = e("../stream/GenericWorker"), O = e("../utf8"), B = e("../crc32"), R = e("../signature");
        function s(e2, t2, r2, n2) {
          i.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t2, this.zipPlatform = r2, this.encodeFileName = n2, this.streamFiles = e2, this.accumulate = false, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
        }
        I.inherits(s, i), s.prototype.push = function(e2) {
          var t2 = e2.meta.percent || 0, r2 = this.entriesCount, n2 = this._sources.length;
          this.accumulate ? this.contentBuffer.push(e2) : (this.bytesWritten += e2.data.length, i.prototype.push.call(this, { data: e2.data, meta: { currentFile: this.currentFile, percent: r2 ? (t2 + 100 * (r2 - n2 - 1)) / r2 : 100 } }));
        }, s.prototype.openedSource = function(e2) {
          this.currentSourceOffset = this.bytesWritten, this.currentFile = e2.file.name;
          var t2 = this.streamFiles && !e2.file.dir;
          if (t2) {
            var r2 = n(e2, t2, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            this.push({ data: r2.fileRecord, meta: { percent: 0 } });
          } else
            this.accumulate = true;
        }, s.prototype.closedSource = function(e2) {
          this.accumulate = false;
          var t2 = this.streamFiles && !e2.file.dir, r2 = n(e2, t2, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
          if (this.dirRecords.push(r2.dirRecord), t2)
            this.push({ data: function(e3) {
              return R.DATA_DESCRIPTOR + A(e3.crc32, 4) + A(e3.compressedSize, 4) + A(e3.uncompressedSize, 4);
            }(e2), meta: { percent: 100 } });
          else
            for (this.push({ data: r2.fileRecord, meta: { percent: 0 } }); this.contentBuffer.length; )
              this.push(this.contentBuffer.shift());
          this.currentFile = null;
        }, s.prototype.flush = function() {
          for (var e2 = this.bytesWritten, t2 = 0; t2 < this.dirRecords.length; t2++)
            this.push({ data: this.dirRecords[t2], meta: { percent: 100 } });
          var r2 = this.bytesWritten - e2, n2 = function(e3, t3, r3, n3, i2) {
            var s2 = I.transformTo("string", i2(n3));
            return R.CENTRAL_DIRECTORY_END + "\0\0\0\0" + A(e3, 2) + A(e3, 2) + A(t3, 4) + A(r3, 4) + A(s2.length, 2) + s2;
          }(this.dirRecords.length, r2, e2, this.zipComment, this.encodeFileName);
          this.push({ data: n2, meta: { percent: 100 } });
        }, s.prototype.prepareNextSource = function() {
          this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
        }, s.prototype.registerPrevious = function(e2) {
          this._sources.push(e2);
          var t2 = this;
          return e2.on("data", function(e3) {
            t2.processChunk(e3);
          }), e2.on("end", function() {
            t2.closedSource(t2.previous.streamInfo), t2._sources.length ? t2.prepareNextSource() : t2.end();
          }), e2.on("error", function(e3) {
            t2.error(e3);
          }), this;
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), true) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), true));
        }, s.prototype.error = function(e2) {
          var t2 = this._sources;
          if (!i.prototype.error.call(this, e2))
            return false;
          for (var r2 = 0; r2 < t2.length; r2++)
            try {
              t2[r2].error(e2);
            } catch (e3) {
            }
          return true;
        }, s.prototype.lock = function() {
          i.prototype.lock.call(this);
          for (var e2 = this._sources, t2 = 0; t2 < e2.length; t2++)
            e2[t2].lock();
        }, t.exports = s;
      }, { "../crc32": 4, "../signature": 23, "../stream/GenericWorker": 28, "../utf8": 31, "../utils": 32 }], 9: [function(e, t, r) {
        "use strict";
        var u = e("../compressions"), n = e("./ZipFileWorker");
        r.generateWorker = function(e2, a, t2) {
          var o = new n(a.streamFiles, t2, a.platform, a.encodeFileName), h = 0;
          try {
            e2.forEach(function(e3, t3) {
              h++;
              var r2 = function(e4, t4) {
                var r3 = e4 || t4, n3 = u[r3];
                if (!n3)
                  throw new Error(r3 + " is not a valid compression method !");
                return n3;
              }(t3.options.compression, a.compression), n2 = t3.options.compressionOptions || a.compressionOptions || {}, i = t3.dir, s = t3.date;
              t3._compressWorker(r2, n2).withStreamInfo("file", { name: e3, dir: i, date: s, comment: t3.comment || "", unixPermissions: t3.unixPermissions, dosPermissions: t3.dosPermissions }).pipe(o);
            }), o.entriesCount = h;
          } catch (e3) {
            o.error(e3);
          }
          return o;
        };
      }, { "../compressions": 3, "./ZipFileWorker": 8 }], 10: [function(e, t, r) {
        "use strict";
        function n() {
          if (!(this instanceof n))
            return new n();
          if (arguments.length)
            throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
          this.files = /* @__PURE__ */ Object.create(null), this.comment = null, this.root = "", this.clone = function() {
            var e2 = new n();
            for (var t2 in this)
              "function" != typeof this[t2] && (e2[t2] = this[t2]);
            return e2;
          };
        }
        (n.prototype = e("./object")).loadAsync = e("./load"), n.support = e("./support"), n.defaults = e("./defaults"), n.version = "3.10.2", n.loadAsync = function(e2, t2) {
          return new n().loadAsync(e2, t2);
        }, n.external = e("./external"), t.exports = n;
      }, { "./defaults": 5, "./external": 6, "./load": 11, "./object": 15, "./support": 30 }], 11: [function(e, t, r) {
        "use strict";
        var u = e("./utils"), i = e("./external"), n = e("./utf8"), s = e("./zipEntries"), a = e("./stream/Crc32Probe"), l = e("./nodejsUtils");
        function f(n2) {
          return new i.Promise(function(e2, t2) {
            var r2 = n2.decompressed.getContentWorker().pipe(new a());
            r2.on("error", function(e3) {
              t2(e3);
            }).on("end", function() {
              r2.streamInfo.crc32 !== n2.decompressed.crc32 ? t2(new Error("Corrupted zip : CRC32 mismatch")) : e2();
            }).resume();
          });
        }
        t.exports = function(e2, o) {
          var h = this;
          return o = u.extend(o || {}, { base64: false, checkCRC32: false, optimizedBinaryString: false, createFolders: false, decodeFileName: n.utf8decode }), l.isNode && l.isStream(e2) ? i.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : u.prepareContent("the loaded zip file", e2, true, o.optimizedBinaryString, o.base64).then(function(e3) {
            var t2 = new s(o);
            return t2.load(e3), t2;
          }).then(function(e3) {
            var t2 = [i.Promise.resolve(e3)], r2 = e3.files;
            if (o.checkCRC32)
              for (var n2 = 0; n2 < r2.length; n2++)
                t2.push(f(r2[n2]));
            return i.Promise.all(t2);
          }).then(function(e3) {
            for (var t2 = e3.shift(), r2 = t2.files, n2 = 0; n2 < r2.length; n2++) {
              var i2 = r2[n2], s2 = i2.fileNameStr, a2 = u.resolve(i2.fileNameStr);
              h.file(a2, i2.decompressed, { binary: true, optimizedBinaryString: true, date: i2.date, dir: i2.dir, comment: i2.fileCommentStr.length ? i2.fileCommentStr : null, unixPermissions: i2.unixPermissions, dosPermissions: i2.dosPermissions, createFolders: o.createFolders }), i2.dir || (h.file(a2).unsafeOriginalName = s2);
            }
            return t2.zipComment.length && (h.comment = t2.zipComment), h;
          });
        };
      }, { "./external": 6, "./nodejsUtils": 14, "./stream/Crc32Probe": 25, "./utf8": 31, "./utils": 32, "./zipEntries": 33 }], 12: [function(e, t, r) {
        "use strict";
        var n = e("../utils"), i = e("../stream/GenericWorker");
        function s(e2, t2) {
          i.call(this, "Nodejs stream input adapter for " + e2), this._upstreamEnded = false, this._bindStream(t2);
        }
        n.inherits(s, i), s.prototype._bindStream = function(e2) {
          var t2 = this;
          (this._stream = e2).pause(), e2.on("data", function(e3) {
            t2.push({ data: e3, meta: { percent: 0 } });
          }).on("error", function(e3) {
            t2.isPaused ? this.generatedError = e3 : t2.error(e3);
          }).on("end", function() {
            t2.isPaused ? t2._upstreamEnded = true : t2.end();
          });
        }, s.prototype.pause = function() {
          return !!i.prototype.pause.call(this) && (this._stream.pause(), true);
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), true);
        }, t.exports = s;
      }, { "../stream/GenericWorker": 28, "../utils": 32 }], 13: [function(e, t, r) {
        "use strict";
        var i = e("readable-stream").Readable;
        function n(e2, t2, r2) {
          i.call(this, t2), this._helper = e2;
          var n2 = this;
          e2.on("data", function(e3, t3) {
            n2.push(e3) || n2._helper.pause(), r2 && r2(t3);
          }).on("error", function(e3) {
            n2.emit("error", e3);
          }).on("end", function() {
            n2.push(null);
          });
        }
        e("../utils").inherits(n, i), n.prototype._read = function() {
          this._helper.resume();
        }, t.exports = n;
      }, { "../utils": 32, "readable-stream": 16 }], 14: [function(e, t, r) {
        "use strict";
        t.exports = { isNode: "undefined" != typeof Buffer, newBufferFrom: function(e2, t2) {
          if (Buffer.from && Buffer.from !== Uint8Array.from)
            return Buffer.from(e2, t2);
          if ("number" == typeof e2)
            throw new Error('The "data" argument must not be a number');
          return new Buffer(e2, t2);
        }, allocBuffer: function(e2) {
          if (Buffer.alloc)
            return Buffer.alloc(e2);
          var t2 = new Buffer(e2);
          return t2.fill(0), t2;
        }, isBuffer: function(e2) {
          return Buffer.isBuffer(e2);
        }, isStream: function(e2) {
          return e2 && "function" == typeof e2.on && "function" == typeof e2.pause && "function" == typeof e2.resume;
        } };
      }, {}], 15: [function(e, t, r) {
        "use strict";
        function s(e2, t2, r2) {
          var n2, i2 = u.getTypeOf(t2), s2 = u.extend(r2 || {}, f);
          s2.date = s2.date || /* @__PURE__ */ new Date(), null !== s2.compression && (s2.compression = s2.compression.toUpperCase()), "string" == typeof s2.unixPermissions && (s2.unixPermissions = parseInt(s2.unixPermissions, 8)), s2.unixPermissions && 16384 & s2.unixPermissions && (s2.dir = true), s2.dosPermissions && 16 & s2.dosPermissions && (s2.dir = true), s2.dir && (e2 = g(e2)), s2.createFolders && (n2 = _(e2)) && b.call(this, n2, true);
          var a2 = "string" === i2 && false === s2.binary && false === s2.base64;
          r2 && void 0 !== r2.binary || (s2.binary = !a2), (t2 instanceof c && 0 === t2.uncompressedSize || s2.dir || !t2 || 0 === t2.length) && (s2.base64 = false, s2.binary = true, t2 = "", s2.compression = "STORE", i2 = "string");
          var o2 = null;
          o2 = t2 instanceof c || t2 instanceof l ? t2 : p.isNode && p.isStream(t2) ? new m(e2, t2) : u.prepareContent(e2, t2, s2.binary, s2.optimizedBinaryString, s2.base64);
          var h2 = new d(e2, o2, s2);
          this.files[e2] = h2;
        }
        var i = e("./utf8"), u = e("./utils"), l = e("./stream/GenericWorker"), a = e("./stream/StreamHelper"), f = e("./defaults"), c = e("./compressedObject"), d = e("./zipObject"), o = e("./generate"), p = e("./nodejsUtils"), m = e("./nodejs/NodejsStreamInputAdapter"), _ = function(e2) {
          "/" === e2.slice(-1) && (e2 = e2.substring(0, e2.length - 1));
          var t2 = e2.lastIndexOf("/");
          return 0 < t2 ? e2.substring(0, t2) : "";
        }, g = function(e2) {
          return "/" !== e2.slice(-1) && (e2 += "/"), e2;
        }, b = function(e2, t2) {
          return t2 = void 0 !== t2 ? t2 : f.createFolders, e2 = g(e2), this.files[e2] || s.call(this, e2, null, { dir: true, createFolders: t2 }), this.files[e2];
        };
        function h(e2) {
          return "[object RegExp]" === Object.prototype.toString.call(e2);
        }
        var n = { load: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, forEach: function(e2) {
          var t2, r2, n2;
          for (t2 in this.files)
            n2 = this.files[t2], (r2 = t2.slice(this.root.length, t2.length)) && t2.slice(0, this.root.length) === this.root && e2(r2, n2);
        }, filter: function(r2) {
          var n2 = [];
          return this.forEach(function(e2, t2) {
            r2(e2, t2) && n2.push(t2);
          }), n2;
        }, file: function(e2, t2, r2) {
          if (1 !== arguments.length)
            return e2 = this.root + e2, s.call(this, e2, t2, r2), this;
          if (h(e2)) {
            var n2 = e2;
            return this.filter(function(e3, t3) {
              return !t3.dir && n2.test(e3);
            });
          }
          var i2 = this.files[this.root + e2];
          return i2 && !i2.dir ? i2 : null;
        }, folder: function(r2) {
          if (!r2)
            return this;
          if (h(r2))
            return this.filter(function(e3, t3) {
              return t3.dir && r2.test(e3);
            });
          var e2 = this.root + r2, t2 = b.call(this, e2), n2 = this.clone();
          return n2.root = t2.name, n2;
        }, remove: function(r2) {
          r2 = this.root + r2;
          var e2 = this.files[r2];
          if (e2 || ("/" !== r2.slice(-1) && (r2 += "/"), e2 = this.files[r2]), e2 && !e2.dir)
            delete this.files[r2];
          else
            for (var t2 = this.filter(function(e3, t3) {
              return t3.name.slice(0, r2.length) === r2;
            }), n2 = 0; n2 < t2.length; n2++)
              delete this.files[t2[n2].name];
          return this;
        }, generate: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, generateInternalStream: function(e2) {
          var t2, r2 = {};
          try {
            if ((r2 = u.extend(e2 || {}, { streamFiles: false, compression: "STORE", compressionOptions: null, type: "", platform: "DOS", comment: null, mimeType: "application/zip", encodeFileName: i.utf8encode })).type = r2.type.toLowerCase(), r2.compression = r2.compression.toUpperCase(), "binarystring" === r2.type && (r2.type = "string"), !r2.type)
              throw new Error("No output type specified.");
            u.checkSupport(r2.type), "darwin" !== r2.platform && "freebsd" !== r2.platform && "linux" !== r2.platform && "sunos" !== r2.platform || (r2.platform = "UNIX"), "win32" === r2.platform && (r2.platform = "DOS");
            var n2 = r2.comment || this.comment || "";
            t2 = o.generateWorker(this, r2, n2);
          } catch (e3) {
            (t2 = new l("error")).error(e3);
          }
          return new a(t2, r2.type || "string", r2.mimeType);
        }, generateAsync: function(e2, t2) {
          return this.generateInternalStream(e2).accumulate(t2);
        }, generateNodeStream: function(e2, t2) {
          return (e2 = e2 || {}).type || (e2.type = "nodebuffer"), this.generateInternalStream(e2).toNodejsStream(t2);
        } };
        t.exports = n;
      }, { "./compressedObject": 2, "./defaults": 5, "./generate": 9, "./nodejs/NodejsStreamInputAdapter": 12, "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31, "./utils": 32, "./zipObject": 35 }], 16: [function(e, t, r) {
        "use strict";
        t.exports = e("stream");
      }, { stream: void 0 }], 17: [function(e, t, r) {
        "use strict";
        var n = e("./DataReader");
        function i(e2) {
          n.call(this, e2);
          for (var t2 = 0; t2 < this.data.length; t2++)
            e2[t2] = 255 & e2[t2];
        }
        e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
          return this.data[this.zero + e2];
        }, i.prototype.lastIndexOfSignature = function(e2) {
          for (var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.length - 4; 0 <= s; --s)
            if (this.data[s] === t2 && this.data[s + 1] === r2 && this.data[s + 2] === n2 && this.data[s + 3] === i2)
              return s - this.zero;
          return -1;
        }, i.prototype.readAndCheckSignature = function(e2) {
          var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.readData(4);
          return t2 === s[0] && r2 === s[1] && n2 === s[2] && i2 === s[3];
        }, i.prototype.readData = function(e2) {
          if (this.checkOffset(e2), 0 === e2)
            return [];
          var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./DataReader": 18 }], 18: [function(e, t, r) {
        "use strict";
        var n = e("../utils");
        function i(e2) {
          this.data = e2, this.length = e2.length, this.index = 0, this.zero = 0;
        }
        i.prototype = { checkOffset: function(e2) {
          this.checkIndex(this.index + e2);
        }, checkIndex: function(e2) {
          if (this.length < this.zero + e2 || e2 < 0)
            throw new Error("End of data reached (data length = " + this.length + ", asked index = " + e2 + "). Corrupted zip ?");
        }, setIndex: function(e2) {
          this.checkIndex(e2), this.index = e2;
        }, skip: function(e2) {
          this.setIndex(this.index + e2);
        }, byteAt: function() {
        }, readInt: function(e2) {
          var t2, r2 = 0;
          for (this.checkOffset(e2), t2 = this.index + e2 - 1; t2 >= this.index; t2--)
            r2 = (r2 << 8) + this.byteAt(t2);
          return this.index += e2, r2;
        }, readString: function(e2) {
          return n.transformTo("string", this.readData(e2));
        }, readData: function() {
        }, lastIndexOfSignature: function() {
        }, readAndCheckSignature: function() {
        }, readDate: function() {
          var e2 = this.readInt(4);
          return new Date(Date.UTC(1980 + (e2 >> 25 & 127), (e2 >> 21 & 15) - 1, e2 >> 16 & 31, e2 >> 11 & 31, e2 >> 5 & 63, (31 & e2) << 1));
        } }, t.exports = i;
      }, { "../utils": 32 }], 19: [function(e, t, r) {
        "use strict";
        var n = e("./Uint8ArrayReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
          this.checkOffset(e2);
          var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./Uint8ArrayReader": 21 }], 20: [function(e, t, r) {
        "use strict";
        var n = e("./DataReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
          return this.data.charCodeAt(this.zero + e2);
        }, i.prototype.lastIndexOfSignature = function(e2) {
          return this.data.lastIndexOf(e2) - this.zero;
        }, i.prototype.readAndCheckSignature = function(e2) {
          return e2 === this.readData(4);
        }, i.prototype.readData = function(e2) {
          this.checkOffset(e2);
          var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./DataReader": 18 }], 21: [function(e, t, r) {
        "use strict";
        var n = e("./ArrayReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
          if (this.checkOffset(e2), 0 === e2)
            return new Uint8Array(0);
          var t2 = this.data.subarray(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./ArrayReader": 17 }], 22: [function(e, t, r) {
        "use strict";
        var n = e("../utils"), i = e("../support"), s = e("./ArrayReader"), a = e("./StringReader"), o = e("./NodeBufferReader"), h = e("./Uint8ArrayReader");
        t.exports = function(e2) {
          var t2 = n.getTypeOf(e2);
          return n.checkSupport(t2), "string" !== t2 || i.uint8array ? "nodebuffer" === t2 ? new o(e2) : i.uint8array ? new h(n.transformTo("uint8array", e2)) : new s(n.transformTo("array", e2)) : new a(e2);
        };
      }, { "../support": 30, "../utils": 32, "./ArrayReader": 17, "./NodeBufferReader": 19, "./StringReader": 20, "./Uint8ArrayReader": 21 }], 23: [function(e, t, r) {
        "use strict";
        r.LOCAL_FILE_HEADER = "PK", r.CENTRAL_FILE_HEADER = "PK", r.CENTRAL_DIRECTORY_END = "PK", r.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", r.ZIP64_CENTRAL_DIRECTORY_END = "PK", r.DATA_DESCRIPTOR = "PK\x07\b";
      }, {}], 24: [function(e, t, r) {
        "use strict";
        var n = e("./GenericWorker"), i = e("../utils");
        function s(e2) {
          n.call(this, "ConvertWorker to " + e2), this.destType = e2;
        }
        i.inherits(s, n), s.prototype.processChunk = function(e2) {
          this.push({ data: i.transformTo(this.destType, e2.data), meta: e2.meta });
        }, t.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 25: [function(e, t, r) {
        "use strict";
        var n = e("./GenericWorker"), i = e("../crc32");
        function s() {
          n.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
        }
        e("../utils").inherits(s, n), s.prototype.processChunk = function(e2) {
          this.streamInfo.crc32 = i(e2.data, this.streamInfo.crc32 || 0), this.push(e2);
        }, t.exports = s;
      }, { "../crc32": 4, "../utils": 32, "./GenericWorker": 28 }], 26: [function(e, t, r) {
        "use strict";
        var n = e("../utils"), i = e("./GenericWorker");
        function s(e2) {
          i.call(this, "DataLengthProbe for " + e2), this.propName = e2, this.withStreamInfo(e2, 0);
        }
        n.inherits(s, i), s.prototype.processChunk = function(e2) {
          if (e2) {
            var t2 = this.streamInfo[this.propName] || 0;
            this.streamInfo[this.propName] = t2 + e2.data.length;
          }
          i.prototype.processChunk.call(this, e2);
        }, t.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 27: [function(e, t, r) {
        "use strict";
        var n = e("../utils"), i = e("./GenericWorker");
        function s(e2) {
          i.call(this, "DataWorker");
          var t2 = this;
          this.dataIsReady = false, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = false, e2.then(function(e3) {
            t2.dataIsReady = true, t2.data = e3, t2.max = e3 && e3.length || 0, t2.type = n.getTypeOf(e3), t2.isPaused || t2._tickAndRepeat();
          }, function(e3) {
            t2.error(e3);
          });
        }
        n.inherits(s, i), s.prototype.cleanUp = function() {
          i.prototype.cleanUp.call(this), this.data = null;
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = true, n.delay(this._tickAndRepeat, [], this)), true);
        }, s.prototype._tickAndRepeat = function() {
          this._tickScheduled = false, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (n.delay(this._tickAndRepeat, [], this), this._tickScheduled = true));
        }, s.prototype._tick = function() {
          if (this.isPaused || this.isFinished)
            return false;
          var e2 = null, t2 = Math.min(this.max, this.index + 16384);
          if (this.index >= this.max)
            return this.end();
          switch (this.type) {
            case "string":
              e2 = this.data.substring(this.index, t2);
              break;
            case "uint8array":
              e2 = this.data.subarray(this.index, t2);
              break;
            case "array":
            case "nodebuffer":
              e2 = this.data.slice(this.index, t2);
          }
          return this.index = t2, this.push({ data: e2, meta: { percent: this.max ? this.index / this.max * 100 : 0 } });
        }, t.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 28: [function(e, t, r) {
        "use strict";
        function n(e2) {
          this.name = e2 || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = true, this.isFinished = false, this.isLocked = false, this._listeners = { data: [], end: [], error: [] }, this.previous = null;
        }
        n.prototype = { push: function(e2) {
          this.emit("data", e2);
        }, end: function() {
          if (this.isFinished)
            return false;
          this.flush();
          try {
            this.emit("end"), this.cleanUp(), this.isFinished = true;
          } catch (e2) {
            this.emit("error", e2);
          }
          return true;
        }, error: function(e2) {
          return !this.isFinished && (this.isPaused ? this.generatedError = e2 : (this.isFinished = true, this.emit("error", e2), this.previous && this.previous.error(e2), this.cleanUp()), true);
        }, on: function(e2, t2) {
          return this._listeners[e2].push(t2), this;
        }, cleanUp: function() {
          this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
        }, emit: function(e2, t2) {
          if (this._listeners[e2])
            for (var r2 = 0; r2 < this._listeners[e2].length; r2++)
              this._listeners[e2][r2].call(this, t2);
        }, pipe: function(e2) {
          return e2.registerPrevious(this);
        }, registerPrevious: function(e2) {
          if (this.isLocked)
            throw new Error("The stream '" + this + "' has already been used.");
          this.streamInfo = e2.streamInfo, this.mergeStreamInfo(), this.previous = e2;
          var t2 = this;
          return e2.on("data", function(e3) {
            t2.processChunk(e3);
          }), e2.on("end", function() {
            t2.end();
          }), e2.on("error", function(e3) {
            t2.error(e3);
          }), this;
        }, pause: function() {
          return !this.isPaused && !this.isFinished && (this.isPaused = true, this.previous && this.previous.pause(), true);
        }, resume: function() {
          if (!this.isPaused || this.isFinished)
            return false;
          var e2 = this.isPaused = false;
          return this.generatedError && (this.error(this.generatedError), e2 = true), this.previous && this.previous.resume(), !e2;
        }, flush: function() {
        }, processChunk: function(e2) {
          this.push(e2);
        }, withStreamInfo: function(e2, t2) {
          return this.extraStreamInfo[e2] = t2, this.mergeStreamInfo(), this;
        }, mergeStreamInfo: function() {
          for (var e2 in this.extraStreamInfo)
            Object.prototype.hasOwnProperty.call(this.extraStreamInfo, e2) && (this.streamInfo[e2] = this.extraStreamInfo[e2]);
        }, lock: function() {
          if (this.isLocked)
            throw new Error("The stream '" + this + "' has already been used.");
          this.isLocked = true, this.previous && this.previous.lock();
        }, toString: function() {
          var e2 = "Worker " + this.name;
          return this.previous ? this.previous + " -> " + e2 : e2;
        } }, t.exports = n;
      }, {}], 29: [function(e, t, r) {
        "use strict";
        var h = e("../utils"), i = e("./ConvertWorker"), s = e("./GenericWorker"), u = e("../base64"), n = e("../support"), a = e("../external"), o = null;
        if (n.nodestream)
          try {
            o = e("../nodejs/NodejsStreamOutputAdapter");
          } catch (e2) {
          }
        function l(e2, o2) {
          return new a.Promise(function(t2, r2) {
            var n2 = [], i2 = e2._internalType, s2 = e2._outputType, a2 = e2._mimeType;
            e2.on("data", function(e3, t3) {
              n2.push(e3), o2 && o2(t3);
            }).on("error", function(e3) {
              n2 = [], r2(e3);
            }).on("end", function() {
              try {
                var e3 = function(e4, t3, r3) {
                  switch (e4) {
                    case "blob":
                      return h.newBlob(h.transformTo("arraybuffer", t3), r3);
                    case "base64":
                      return u.encode(t3);
                    default:
                      return h.transformTo(e4, t3);
                  }
                }(s2, function(e4, t3) {
                  var r3, n3 = 0, i3 = null, s3 = 0;
                  for (r3 = 0; r3 < t3.length; r3++)
                    s3 += t3[r3].length;
                  switch (e4) {
                    case "string":
                      return t3.join("");
                    case "array":
                      return Array.prototype.concat.apply([], t3);
                    case "uint8array":
                      for (i3 = new Uint8Array(s3), r3 = 0; r3 < t3.length; r3++)
                        i3.set(t3[r3], n3), n3 += t3[r3].length;
                      return i3;
                    case "nodebuffer":
                      return Buffer.concat(t3);
                    default:
                      throw new Error("concat : unsupported type '" + e4 + "'");
                  }
                }(i2, n2), a2);
                t2(e3);
              } catch (e4) {
                r2(e4);
              }
              n2 = [];
            }).resume();
          });
        }
        function f(e2, t2, r2) {
          var n2 = t2;
          switch (t2) {
            case "blob":
            case "arraybuffer":
              n2 = "uint8array";
              break;
            case "base64":
              n2 = "string";
          }
          try {
            this._internalType = n2, this._outputType = t2, this._mimeType = r2, h.checkSupport(n2), this._worker = e2.pipe(new i(n2)), e2.lock();
          } catch (e3) {
            this._worker = new s("error"), this._worker.error(e3);
          }
        }
        f.prototype = { accumulate: function(e2) {
          return l(this, e2);
        }, on: function(e2, t2) {
          var r2 = this;
          return "data" === e2 ? this._worker.on(e2, function(e3) {
            t2.call(r2, e3.data, e3.meta);
          }) : this._worker.on(e2, function() {
            h.delay(t2, arguments, r2);
          }), this;
        }, resume: function() {
          return h.delay(this._worker.resume, [], this._worker), this;
        }, pause: function() {
          return this._worker.pause(), this;
        }, toNodejsStream: function(e2) {
          if (h.checkSupport("nodestream"), "nodebuffer" !== this._outputType)
            throw new Error(this._outputType + " is not supported by this method");
          return new o(this, { objectMode: "nodebuffer" !== this._outputType }, e2);
        } }, t.exports = f;
      }, { "../base64": 1, "../external": 6, "../nodejs/NodejsStreamOutputAdapter": 13, "../support": 30, "../utils": 32, "./ConvertWorker": 24, "./GenericWorker": 28 }], 30: [function(e, t, r) {
        "use strict";
        if (r.base64 = true, r.array = true, r.string = true, r.arraybuffer = "undefined" != typeof ArrayBuffer && "undefined" != typeof Uint8Array, r.nodebuffer = "undefined" != typeof Buffer, r.uint8array = "undefined" != typeof Uint8Array, "undefined" == typeof ArrayBuffer)
          r.blob = false;
        else {
          var n = new ArrayBuffer(0);
          try {
            r.blob = 0 === new Blob([n], { type: "application/zip" }).size;
          } catch (e2) {
            try {
              var i = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              i.append(n), r.blob = 0 === i.getBlob("application/zip").size;
            } catch (e3) {
              r.blob = false;
            }
          }
        }
        try {
          r.nodestream = !!e("readable-stream").Readable;
        } catch (e2) {
          r.nodestream = false;
        }
      }, { "readable-stream": 16 }], 31: [function(e, t, s) {
        "use strict";
        for (var o = e("./utils"), h = e("./support"), r = e("./nodejsUtils"), n = e("./stream/GenericWorker"), u = new Array(256), i = 0; i < 256; i++)
          u[i] = 252 <= i ? 6 : 248 <= i ? 5 : 240 <= i ? 4 : 224 <= i ? 3 : 192 <= i ? 2 : 1;
        u[254] = u[254] = 1;
        function a() {
          n.call(this, "utf-8 decode"), this.leftOver = null;
        }
        function l() {
          n.call(this, "utf-8 encode");
        }
        s.utf8encode = function(e2) {
          return h.nodebuffer ? r.newBufferFrom(e2, "utf-8") : function(e3) {
            var t2, r2, n2, i2, s2, a2 = e3.length, o2 = 0;
            for (i2 = 0; i2 < a2; i2++)
              55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o2 += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
            for (t2 = h.uint8array ? new Uint8Array(o2) : new Array(o2), i2 = s2 = 0; s2 < o2; i2++)
              55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
            return t2;
          }(e2);
        }, s.utf8decode = function(e2) {
          return h.nodebuffer ? o.transformTo("nodebuffer", e2).toString("utf-8") : function(e3) {
            var t2, r2, n2, i2, s2 = e3.length, a2 = new Array(2 * s2);
            for (t2 = r2 = 0; t2 < s2; )
              if ((n2 = e3[t2++]) < 128)
                a2[r2++] = n2;
              else if (4 < (i2 = u[n2]))
                a2[r2++] = 65533, t2 += i2 - 1;
              else {
                for (n2 &= 2 === i2 ? 31 : 3 === i2 ? 15 : 7; 1 < i2 && t2 < s2; )
                  n2 = n2 << 6 | 63 & e3[t2++], i2--;
                1 < i2 ? a2[r2++] = 65533 : n2 < 65536 ? a2[r2++] = n2 : (n2 -= 65536, a2[r2++] = 55296 | n2 >> 10 & 1023, a2[r2++] = 56320 | 1023 & n2);
              }
            return a2.length !== r2 && (a2.subarray ? a2 = a2.subarray(0, r2) : a2.length = r2), o.applyFromCharCode(a2);
          }(e2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2));
        }, o.inherits(a, n), a.prototype.processChunk = function(e2) {
          var t2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2.data);
          if (this.leftOver && this.leftOver.length) {
            if (h.uint8array) {
              var r2 = t2;
              (t2 = new Uint8Array(r2.length + this.leftOver.length)).set(this.leftOver, 0), t2.set(r2, this.leftOver.length);
            } else
              t2 = this.leftOver.concat(t2);
            this.leftOver = null;
          }
          var n2 = function(e3, t3) {
            var r3;
            for ((t3 = t3 || e3.length) > e3.length && (t3 = e3.length), r3 = t3 - 1; 0 <= r3 && 128 == (192 & e3[r3]); )
              r3--;
            return r3 < 0 ? t3 : 0 === r3 ? t3 : r3 + u[e3[r3]] > t3 ? r3 : t3;
          }(t2), i2 = t2;
          n2 !== t2.length && (h.uint8array ? (i2 = t2.subarray(0, n2), this.leftOver = t2.subarray(n2, t2.length)) : (i2 = t2.slice(0, n2), this.leftOver = t2.slice(n2, t2.length))), this.push({ data: s.utf8decode(i2), meta: e2.meta });
        }, a.prototype.flush = function() {
          this.leftOver && this.leftOver.length && (this.push({ data: s.utf8decode(this.leftOver), meta: {} }), this.leftOver = null);
        }, s.Utf8DecodeWorker = a, o.inherits(l, n), l.prototype.processChunk = function(e2) {
          this.push({ data: s.utf8encode(e2.data), meta: e2.meta });
        }, s.Utf8EncodeWorker = l;
      }, { "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./support": 30, "./utils": 32 }], 32: [function(e, t, a) {
        "use strict";
        var o = e("./support"), h = e("./base64"), r = e("./nodejsUtils"), u = e("./external");
        function n(e2) {
          return e2;
        }
        function l(e2, t2) {
          for (var r2 = 0; r2 < e2.length; ++r2)
            t2[r2] = 255 & e2.charCodeAt(r2);
          return t2;
        }
        e("setimmediate"), a.newBlob = function(t2, r2) {
          a.checkSupport("blob");
          try {
            return new Blob([t2], { type: r2 });
          } catch (e2) {
            try {
              var n2 = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              return n2.append(t2), n2.getBlob(r2);
            } catch (e3) {
              throw new Error("Bug : can't construct the Blob.");
            }
          }
        };
        var i = { stringifyByChunk: function(e2, t2, r2) {
          var n2 = [], i2 = 0, s2 = e2.length;
          if (s2 <= r2)
            return String.fromCharCode.apply(null, e2);
          for (; i2 < s2; )
            "array" === t2 || "nodebuffer" === t2 ? n2.push(String.fromCharCode.apply(null, e2.slice(i2, Math.min(i2 + r2, s2)))) : n2.push(String.fromCharCode.apply(null, e2.subarray(i2, Math.min(i2 + r2, s2)))), i2 += r2;
          return n2.join("");
        }, stringifyByChar: function(e2) {
          for (var t2 = "", r2 = 0; r2 < e2.length; r2++)
            t2 += String.fromCharCode(e2[r2]);
          return t2;
        }, applyCanBeUsed: { uint8array: function() {
          try {
            return o.uint8array && 1 === String.fromCharCode.apply(null, new Uint8Array(1)).length;
          } catch (e2) {
            return false;
          }
        }(), nodebuffer: function() {
          try {
            return o.nodebuffer && 1 === String.fromCharCode.apply(null, r.allocBuffer(1)).length;
          } catch (e2) {
            return false;
          }
        }() } };
        function s(e2) {
          var t2 = 65536, r2 = a.getTypeOf(e2), n2 = true;
          if ("uint8array" === r2 ? n2 = i.applyCanBeUsed.uint8array : "nodebuffer" === r2 && (n2 = i.applyCanBeUsed.nodebuffer), n2)
            for (; 1 < t2; )
              try {
                return i.stringifyByChunk(e2, r2, t2);
              } catch (e3) {
                t2 = Math.floor(t2 / 2);
              }
          return i.stringifyByChar(e2);
        }
        function f(e2, t2) {
          for (var r2 = 0; r2 < e2.length; r2++)
            t2[r2] = e2[r2];
          return t2;
        }
        a.applyFromCharCode = s;
        var c = {};
        c.string = { string: n, array: function(e2) {
          return l(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return c.string.uint8array(e2).buffer;
        }, uint8array: function(e2) {
          return l(e2, new Uint8Array(e2.length));
        }, nodebuffer: function(e2) {
          return l(e2, r.allocBuffer(e2.length));
        } }, c.array = { string: s, array: n, arraybuffer: function(e2) {
          return new Uint8Array(e2).buffer;
        }, uint8array: function(e2) {
          return new Uint8Array(e2);
        }, nodebuffer: function(e2) {
          return r.newBufferFrom(e2);
        } }, c.arraybuffer = { string: function(e2) {
          return s(new Uint8Array(e2));
        }, array: function(e2) {
          return f(new Uint8Array(e2), new Array(e2.byteLength));
        }, arraybuffer: n, uint8array: function(e2) {
          return new Uint8Array(e2);
        }, nodebuffer: function(e2) {
          return r.newBufferFrom(new Uint8Array(e2));
        } }, c.uint8array = { string: s, array: function(e2) {
          return f(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return e2.buffer;
        }, uint8array: n, nodebuffer: function(e2) {
          return r.newBufferFrom(e2);
        } }, c.nodebuffer = { string: s, array: function(e2) {
          return f(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return c.nodebuffer.uint8array(e2).buffer;
        }, uint8array: function(e2) {
          return f(e2, new Uint8Array(e2.length));
        }, nodebuffer: n }, a.transformTo = function(e2, t2) {
          if (t2 = t2 || "", !e2)
            return t2;
          a.checkSupport(e2);
          var r2 = a.getTypeOf(t2);
          return c[r2][e2](t2);
        }, a.resolve = function(e2) {
          for (var t2 = e2.split("/"), r2 = [], n2 = 0; n2 < t2.length; n2++) {
            var i2 = t2[n2];
            "." === i2 || "" === i2 && 0 !== n2 && n2 !== t2.length - 1 || (".." === i2 ? r2.pop() : r2.push(i2));
          }
          return r2.join("/");
        }, a.getTypeOf = function(e2) {
          if ("string" == typeof e2)
            return "string";
          var t2 = Object.prototype.toString.call(e2);
          return "[object Array]" === t2 ? "array" : o.nodebuffer && r.isBuffer(e2) ? "nodebuffer" : o.uint8array && "[object Uint8Array]" === t2 ? "uint8array" : o.arraybuffer && "[object ArrayBuffer]" === t2 ? "arraybuffer" : void 0;
        }, a.checkSupport = function(e2) {
          if (!o[e2.toLowerCase()])
            throw new Error(e2 + " is not supported by this platform");
        }, a.MAX_VALUE_16BITS = 65535, a.MAX_VALUE_32BITS = -1, a.pretty = function(e2) {
          var t2, r2, n2 = "";
          for (r2 = 0; r2 < (e2 || "").length; r2++)
            n2 += "\\x" + ((t2 = e2.charCodeAt(r2)) < 16 ? "0" : "") + t2.toString(16).toUpperCase();
          return n2;
        }, a.delay = function(e2, t2, r2) {
          setImmediate(function() {
            e2.apply(r2 || null, t2 || []);
          });
        }, a.inherits = function(e2, t2) {
          function r2() {
          }
          r2.prototype = t2.prototype, e2.prototype = new r2();
        }, a.extend = function() {
          var e2, t2, r2 = {};
          for (e2 = 0; e2 < arguments.length; e2++)
            for (t2 in arguments[e2])
              Object.prototype.hasOwnProperty.call(arguments[e2], t2) && void 0 === r2[t2] && (r2[t2] = arguments[e2][t2]);
          return r2;
        }, a.prepareContent = function(r2, e2, n2, i2, s2) {
          return u.Promise.resolve(e2).then(function(n3) {
            return o.blob && (n3 instanceof Blob || -1 !== ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(n3))) ? void 0 !== Blob.prototype.arrayBuffer ? n3.arrayBuffer() : "undefined" != typeof FileReader ? new u.Promise(function(t2, r3) {
              var e3 = new FileReader();
              e3.onload = function(e4) {
                t2(e4.target.result);
              }, e3.onerror = function(e4) {
                r3(e4.target.error);
              }, e3.readAsArrayBuffer(n3);
            }) : u.Promise.reject(new Error(r2 + " is a Blob, but we have no way of reading it.")) : n3;
          }).then(function(e3) {
            var t2 = a.getTypeOf(e3);
            return t2 ? ("arraybuffer" === t2 ? e3 = a.transformTo("uint8array", e3) : "string" === t2 && (s2 ? e3 = h.decode(e3) : n2 && true !== i2 && (e3 = function(e4) {
              return l(e4, o.uint8array ? new Uint8Array(e4.length) : new Array(e4.length));
            }(e3))), e3) : u.Promise.reject(new Error("Can't read the data of '" + r2 + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
          });
        };
      }, { "./base64": 1, "./external": 6, "./nodejsUtils": 14, "./support": 30, setimmediate: 54 }], 33: [function(e, t, r) {
        "use strict";
        var n = e("./reader/readerFor"), i = e("./utils"), s = e("./signature"), a = e("./zipEntry"), o = e("./support");
        function h(e2) {
          this.files = [], this.loadOptions = e2;
        }
        h.prototype = { checkSignature: function(e2) {
          if (!this.reader.readAndCheckSignature(e2)) {
            this.reader.index -= 4;
            var t2 = this.reader.readString(4);
            throw new Error("Corrupted zip or bug: unexpected signature (" + i.pretty(t2) + ", expected " + i.pretty(e2) + ")");
          }
        }, isSignature: function(e2, t2) {
          var r2 = this.reader.index;
          this.reader.setIndex(e2);
          var n2 = this.reader.readString(4) === t2;
          return this.reader.setIndex(r2), n2;
        }, readBlockEndOfCentral: function() {
          this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
          var e2 = this.reader.readData(this.zipCommentLength), t2 = o.uint8array ? "uint8array" : "array", r2 = i.transformTo(t2, e2);
          this.zipComment = this.loadOptions.decodeFileName(r2);
        }, readBlockZip64EndOfCentral: function() {
          this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
          for (var e2, t2, r2, n2 = this.zip64EndOfCentralSize - 44; 0 < n2; )
            e2 = this.reader.readInt(2), t2 = this.reader.readInt(4), r2 = this.reader.readData(t2), this.zip64ExtensibleData[e2] = { id: e2, length: t2, value: r2 };
        }, readBlockZip64EndOfCentralLocator: function() {
          if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount)
            throw new Error("Multi-volumes zip are not supported");
        }, readLocalFiles: function() {
          var e2, t2;
          for (e2 = 0; e2 < this.files.length; e2++)
            t2 = this.files[e2], this.reader.setIndex(t2.localHeaderOffset), this.checkSignature(s.LOCAL_FILE_HEADER), t2.readLocalPart(this.reader), t2.handleUTF8(), t2.processAttributes();
        }, readCentralDir: function() {
          var e2;
          for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER); )
            (e2 = new a({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(e2);
          if (this.centralDirRecords !== this.files.length && 0 !== this.centralDirRecords && 0 === this.files.length)
            throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
        }, readEndOfCentral: function() {
          var e2 = this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);
          if (e2 < 0)
            throw !this.isSignature(0, s.LOCAL_FILE_HEADER) ? new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html") : new Error("Corrupted zip: can't find end of central directory");
          this.reader.setIndex(e2);
          var t2 = e2;
          if (this.checkSignature(s.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === i.MAX_VALUE_16BITS || this.diskWithCentralDirStart === i.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === i.MAX_VALUE_16BITS || this.centralDirRecords === i.MAX_VALUE_16BITS || this.centralDirSize === i.MAX_VALUE_32BITS || this.centralDirOffset === i.MAX_VALUE_32BITS) {
            if (this.zip64 = true, (e2 = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0)
              throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
            if (this.reader.setIndex(e2), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, s.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0))
              throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
          }
          var r2 = this.centralDirOffset + this.centralDirSize;
          this.zip64 && (r2 += 20, r2 += 12 + this.zip64EndOfCentralSize);
          var n2 = t2 - r2;
          if (0 < n2)
            this.isSignature(t2, s.CENTRAL_FILE_HEADER) || (this.reader.zero = n2);
          else if (n2 < 0)
            throw new Error("Corrupted zip: missing " + Math.abs(n2) + " bytes.");
        }, prepareReader: function(e2) {
          this.reader = n(e2);
        }, load: function(e2) {
          this.prepareReader(e2), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
        } }, t.exports = h;
      }, { "./reader/readerFor": 22, "./signature": 23, "./support": 30, "./utils": 32, "./zipEntry": 34 }], 34: [function(e, t, r) {
        "use strict";
        var n = e("./reader/readerFor"), s = e("./utils"), i = e("./compressedObject"), a = e("./crc32"), o = e("./utf8"), h = e("./compressions"), u = e("./support");
        function l(e2, t2) {
          this.options = e2, this.loadOptions = t2;
        }
        l.prototype = { isEncrypted: function() {
          return 1 == (1 & this.bitFlag);
        }, useUTF8: function() {
          return 2048 == (2048 & this.bitFlag);
        }, readLocalPart: function(e2) {
          var t2, r2;
          if (e2.skip(22), this.fileNameLength = e2.readInt(2), r2 = e2.readInt(2), this.fileName = e2.readData(this.fileNameLength), e2.skip(r2), -1 === this.compressedSize || -1 === this.uncompressedSize)
            throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
          if (null === (t2 = function(e3) {
            for (var t3 in h)
              if (Object.prototype.hasOwnProperty.call(h, t3) && h[t3].magic === e3)
                return h[t3];
            return null;
          }(this.compressionMethod)))
            throw new Error("Corrupted zip : compression " + s.pretty(this.compressionMethod) + " unknown (inner file : " + s.transformTo("string", this.fileName) + ")");
          this.decompressed = new i(this.compressedSize, this.uncompressedSize, this.crc32, t2, e2.readData(this.compressedSize));
        }, readCentralPart: function(e2) {
          this.versionMadeBy = e2.readInt(2), e2.skip(2), this.bitFlag = e2.readInt(2), this.compressionMethod = e2.readString(2), this.date = e2.readDate(), this.crc32 = e2.readInt(4), this.compressedSize = e2.readInt(4), this.uncompressedSize = e2.readInt(4);
          var t2 = e2.readInt(2);
          if (this.extraFieldsLength = e2.readInt(2), this.fileCommentLength = e2.readInt(2), this.diskNumberStart = e2.readInt(2), this.internalFileAttributes = e2.readInt(2), this.externalFileAttributes = e2.readInt(4), this.localHeaderOffset = e2.readInt(4), this.isEncrypted())
            throw new Error("Encrypted zip are not supported");
          e2.skip(t2), this.readExtraFields(e2), this.parseZIP64ExtraField(e2), this.fileComment = e2.readData(this.fileCommentLength);
        }, processAttributes: function() {
          this.unixPermissions = null, this.dosPermissions = null;
          var e2 = this.versionMadeBy >> 8;
          this.dir = !!(16 & this.externalFileAttributes), 0 == e2 && (this.dosPermissions = 63 & this.externalFileAttributes), 3 == e2 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || "/" !== this.fileNameStr.slice(-1) || (this.dir = true);
        }, parseZIP64ExtraField: function() {
          if (this.extraFields[1]) {
            var e2 = n(this.extraFields[1].value);
            this.uncompressedSize === s.MAX_VALUE_32BITS && (this.uncompressedSize = e2.readInt(8)), this.compressedSize === s.MAX_VALUE_32BITS && (this.compressedSize = e2.readInt(8)), this.localHeaderOffset === s.MAX_VALUE_32BITS && (this.localHeaderOffset = e2.readInt(8)), this.diskNumberStart === s.MAX_VALUE_32BITS && (this.diskNumberStart = e2.readInt(4));
          }
        }, readExtraFields: function(e2) {
          var t2, r2, n2, i2 = e2.index + this.extraFieldsLength;
          for (this.extraFields || (this.extraFields = {}); e2.index + 4 < i2; )
            t2 = e2.readInt(2), r2 = e2.readInt(2), n2 = e2.readData(r2), this.extraFields[t2] = { id: t2, length: r2, value: n2 };
          e2.setIndex(i2);
        }, handleUTF8: function() {
          var e2 = u.uint8array ? "uint8array" : "array";
          if (this.useUTF8())
            this.fileNameStr = o.utf8decode(this.fileName), this.fileCommentStr = o.utf8decode(this.fileComment);
          else {
            var t2 = this.findExtraFieldUnicodePath();
            if (null !== t2)
              this.fileNameStr = t2;
            else {
              var r2 = s.transformTo(e2, this.fileName);
              this.fileNameStr = this.loadOptions.decodeFileName(r2);
            }
            var n2 = this.findExtraFieldUnicodeComment();
            if (null !== n2)
              this.fileCommentStr = n2;
            else {
              var i2 = s.transformTo(e2, this.fileComment);
              this.fileCommentStr = this.loadOptions.decodeFileName(i2);
            }
          }
        }, findExtraFieldUnicodePath: function() {
          var e2 = this.extraFields[28789];
          if (e2) {
            var t2 = n(e2.value);
            return 1 !== t2.readInt(1) ? null : a(this.fileName) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
          }
          return null;
        }, findExtraFieldUnicodeComment: function() {
          var e2 = this.extraFields[25461];
          if (e2) {
            var t2 = n(e2.value);
            return 1 !== t2.readInt(1) ? null : a(this.fileComment) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
          }
          return null;
        } }, t.exports = l;
      }, { "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./reader/readerFor": 22, "./support": 30, "./utf8": 31, "./utils": 32 }], 35: [function(e, t, r) {
        "use strict";
        function n(e2, t2, r2) {
          this.name = e2, this.dir = r2.dir, this.date = r2.date, this.comment = r2.comment, this.unixPermissions = r2.unixPermissions, this.dosPermissions = r2.dosPermissions, this._data = t2, this._dataBinary = r2.binary, this.options = { compression: r2.compression, compressionOptions: r2.compressionOptions };
        }
        var s = e("./stream/StreamHelper"), i = e("./stream/DataWorker"), a = e("./utf8"), o = e("./compressedObject"), h = e("./stream/GenericWorker");
        n.prototype = { internalStream: function(e2) {
          var t2 = null, r2 = "string";
          try {
            if (!e2)
              throw new Error("No output type specified.");
            var n2 = "string" === (r2 = e2.toLowerCase()) || "text" === r2;
            "binarystring" !== r2 && "text" !== r2 || (r2 = "string"), t2 = this._decompressWorker();
            var i2 = !this._dataBinary;
            i2 && !n2 && (t2 = t2.pipe(new a.Utf8EncodeWorker())), !i2 && n2 && (t2 = t2.pipe(new a.Utf8DecodeWorker()));
          } catch (e3) {
            (t2 = new h("error")).error(e3);
          }
          return new s(t2, r2, "");
        }, async: function(e2, t2) {
          return this.internalStream(e2).accumulate(t2);
        }, nodeStream: function(e2, t2) {
          return this.internalStream(e2 || "nodebuffer").toNodejsStream(t2);
        }, _compressWorker: function(e2, t2) {
          if (this._data instanceof o && this._data.compression.magic === e2.magic)
            return this._data.getCompressedWorker();
          var r2 = this._decompressWorker();
          return this._dataBinary || (r2 = r2.pipe(new a.Utf8EncodeWorker())), o.createWorkerFrom(r2, e2, t2);
        }, _decompressWorker: function() {
          return this._data instanceof o ? this._data.getContentWorker() : this._data instanceof h ? this._data : new i(this._data);
        } };
        for (var u = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], l = function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, f = 0; f < u.length; f++)
          n.prototype[u[f]] = l;
        t.exports = n;
      }, { "./compressedObject": 2, "./stream/DataWorker": 27, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31 }], 36: [function(e, l, t) {
        (function(t2) {
          "use strict";
          var r, n, e2 = t2.MutationObserver || t2.WebKitMutationObserver;
          if (e2) {
            var i = 0, s = new e2(u), a = t2.document.createTextNode("");
            s.observe(a, { characterData: true }), r = function() {
              a.data = i = ++i % 2;
            };
          } else if (t2.setImmediate || void 0 === t2.MessageChannel)
            r = "document" in t2 && "onreadystatechange" in t2.document.createElement("script") ? function() {
              var e3 = t2.document.createElement("script");
              e3.onreadystatechange = function() {
                u(), e3.onreadystatechange = null, e3.parentNode.removeChild(e3), e3 = null;
              }, t2.document.documentElement.appendChild(e3);
            } : function() {
              setTimeout(u, 0);
            };
          else {
            var o = new t2.MessageChannel();
            o.port1.onmessage = u, r = function() {
              o.port2.postMessage(0);
            };
          }
          var h = [];
          function u() {
            var e3, t3;
            n = true;
            for (var r2 = h.length; r2; ) {
              for (t3 = h, h = [], e3 = -1; ++e3 < r2; )
                t3[e3]();
              r2 = h.length;
            }
            n = false;
          }
          l.exports = function(e3) {
            1 !== h.push(e3) || n || r();
          };
        }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
      }, {}], 37: [function(e, t, r) {
        "use strict";
        var i = e("immediate");
        function u() {
        }
        var l = {}, s = ["REJECTED"], a = ["FULFILLED"], n = ["PENDING"];
        function o(e2) {
          if ("function" != typeof e2)
            throw new TypeError("resolver must be a function");
          this.state = n, this.queue = [], this.outcome = void 0, e2 !== u && d(this, e2);
        }
        function h(e2, t2, r2) {
          this.promise = e2, "function" == typeof t2 && (this.onFulfilled = t2, this.callFulfilled = this.otherCallFulfilled), "function" == typeof r2 && (this.onRejected = r2, this.callRejected = this.otherCallRejected);
        }
        function f(t2, r2, n2) {
          i(function() {
            var e2;
            try {
              e2 = r2(n2);
            } catch (e3) {
              return l.reject(t2, e3);
            }
            e2 === t2 ? l.reject(t2, new TypeError("Cannot resolve promise with itself")) : l.resolve(t2, e2);
          });
        }
        function c(e2) {
          var t2 = e2 && e2.then;
          if (e2 && ("object" == typeof e2 || "function" == typeof e2) && "function" == typeof t2)
            return function() {
              t2.apply(e2, arguments);
            };
        }
        function d(t2, e2) {
          var r2 = false;
          function n2(e3) {
            r2 || (r2 = true, l.reject(t2, e3));
          }
          function i2(e3) {
            r2 || (r2 = true, l.resolve(t2, e3));
          }
          var s2 = p(function() {
            e2(i2, n2);
          });
          "error" === s2.status && n2(s2.value);
        }
        function p(e2, t2) {
          var r2 = {};
          try {
            r2.value = e2(t2), r2.status = "success";
          } catch (e3) {
            r2.status = "error", r2.value = e3;
          }
          return r2;
        }
        (t.exports = o).prototype.finally = function(t2) {
          if ("function" != typeof t2)
            return this;
          var r2 = this.constructor;
          return this.then(function(e2) {
            return r2.resolve(t2()).then(function() {
              return e2;
            });
          }, function(e2) {
            return r2.resolve(t2()).then(function() {
              throw e2;
            });
          });
        }, o.prototype.catch = function(e2) {
          return this.then(null, e2);
        }, o.prototype.then = function(e2, t2) {
          if ("function" != typeof e2 && this.state === a || "function" != typeof t2 && this.state === s)
            return this;
          var r2 = new this.constructor(u);
          this.state !== n ? f(r2, this.state === a ? e2 : t2, this.outcome) : this.queue.push(new h(r2, e2, t2));
          return r2;
        }, h.prototype.callFulfilled = function(e2) {
          l.resolve(this.promise, e2);
        }, h.prototype.otherCallFulfilled = function(e2) {
          f(this.promise, this.onFulfilled, e2);
        }, h.prototype.callRejected = function(e2) {
          l.reject(this.promise, e2);
        }, h.prototype.otherCallRejected = function(e2) {
          f(this.promise, this.onRejected, e2);
        }, l.resolve = function(e2, t2) {
          var r2 = p(c, t2);
          if ("error" === r2.status)
            return l.reject(e2, r2.value);
          var n2 = r2.value;
          if (n2)
            d(e2, n2);
          else {
            e2.state = a, e2.outcome = t2;
            for (var i2 = -1, s2 = e2.queue.length; ++i2 < s2; )
              e2.queue[i2].callFulfilled(t2);
          }
          return e2;
        }, l.reject = function(e2, t2) {
          e2.state = s, e2.outcome = t2;
          for (var r2 = -1, n2 = e2.queue.length; ++r2 < n2; )
            e2.queue[r2].callRejected(t2);
          return e2;
        }, o.resolve = function(e2) {
          if (e2 instanceof this)
            return e2;
          return l.resolve(new this(u), e2);
        }, o.reject = function(e2) {
          var t2 = new this(u);
          return l.reject(t2, e2);
        }, o.all = function(e2) {
          var r2 = this;
          if ("[object Array]" !== Object.prototype.toString.call(e2))
            return this.reject(new TypeError("must be an array"));
          var n2 = e2.length, i2 = false;
          if (!n2)
            return this.resolve([]);
          var s2 = new Array(n2), a2 = 0, t2 = -1, o2 = new this(u);
          for (; ++t2 < n2; )
            h2(e2[t2], t2);
          return o2;
          function h2(e3, t3) {
            r2.resolve(e3).then(function(e4) {
              s2[t3] = e4, ++a2 !== n2 || i2 || (i2 = true, l.resolve(o2, s2));
            }, function(e4) {
              i2 || (i2 = true, l.reject(o2, e4));
            });
          }
        }, o.race = function(e2) {
          var t2 = this;
          if ("[object Array]" !== Object.prototype.toString.call(e2))
            return this.reject(new TypeError("must be an array"));
          var r2 = e2.length, n2 = false;
          if (!r2)
            return this.resolve([]);
          var i2 = -1, s2 = new this(u);
          for (; ++i2 < r2; )
            a2 = e2[i2], t2.resolve(a2).then(function(e3) {
              n2 || (n2 = true, l.resolve(s2, e3));
            }, function(e3) {
              n2 || (n2 = true, l.reject(s2, e3));
            });
          var a2;
          return s2;
        };
      }, { immediate: 36 }], 38: [function(e, t, r) {
        "use strict";
        var n = {};
        (0, e("./lib/utils/common").assign)(n, e("./lib/deflate"), e("./lib/inflate"), e("./lib/zlib/constants")), t.exports = n;
      }, { "./lib/deflate": 39, "./lib/inflate": 40, "./lib/utils/common": 41, "./lib/zlib/constants": 44 }], 39: [function(e, t, r) {
        "use strict";
        var a = e("./zlib/deflate"), o = e("./utils/common"), h = e("./utils/strings"), i = e("./zlib/messages"), s = e("./zlib/zstream"), u = Object.prototype.toString, l = 0, f = -1, c = 0, d = 8;
        function p(e2) {
          if (!(this instanceof p))
            return new p(e2);
          this.options = o.assign({ level: f, method: d, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: c, to: "" }, e2 || {});
          var t2 = this.options;
          t2.raw && 0 < t2.windowBits ? t2.windowBits = -t2.windowBits : t2.gzip && 0 < t2.windowBits && t2.windowBits < 16 && (t2.windowBits += 16), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new s(), this.strm.avail_out = 0;
          var r2 = a.deflateInit2(this.strm, t2.level, t2.method, t2.windowBits, t2.memLevel, t2.strategy);
          if (r2 !== l)
            throw new Error(i[r2]);
          if (t2.header && a.deflateSetHeader(this.strm, t2.header), t2.dictionary) {
            var n2;
            if (n2 = "string" == typeof t2.dictionary ? h.string2buf(t2.dictionary) : "[object ArrayBuffer]" === u.call(t2.dictionary) ? new Uint8Array(t2.dictionary) : t2.dictionary, (r2 = a.deflateSetDictionary(this.strm, n2)) !== l)
              throw new Error(i[r2]);
            this._dict_set = true;
          }
        }
        function n(e2, t2) {
          var r2 = new p(t2);
          if (r2.push(e2, true), r2.err)
            throw r2.msg || i[r2.err];
          return r2.result;
        }
        p.prototype.push = function(e2, t2) {
          var r2, n2, i2 = this.strm, s2 = this.options.chunkSize;
          if (this.ended)
            return false;
          n2 = t2 === ~~t2 ? t2 : true === t2 ? 4 : 0, "string" == typeof e2 ? i2.input = h.string2buf(e2) : "[object ArrayBuffer]" === u.call(e2) ? i2.input = new Uint8Array(e2) : i2.input = e2, i2.next_in = 0, i2.avail_in = i2.input.length;
          do {
            if (0 === i2.avail_out && (i2.output = new o.Buf8(s2), i2.next_out = 0, i2.avail_out = s2), 1 !== (r2 = a.deflate(i2, n2)) && r2 !== l)
              return this.onEnd(r2), !(this.ended = true);
            0 !== i2.avail_out && (0 !== i2.avail_in || 4 !== n2 && 2 !== n2) || ("string" === this.options.to ? this.onData(h.buf2binstring(o.shrinkBuf(i2.output, i2.next_out))) : this.onData(o.shrinkBuf(i2.output, i2.next_out)));
          } while ((0 < i2.avail_in || 0 === i2.avail_out) && 1 !== r2);
          return 4 === n2 ? (r2 = a.deflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === l) : 2 !== n2 || (this.onEnd(l), !(i2.avail_out = 0));
        }, p.prototype.onData = function(e2) {
          this.chunks.push(e2);
        }, p.prototype.onEnd = function(e2) {
          e2 === l && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
        }, r.Deflate = p, r.deflate = n, r.deflateRaw = function(e2, t2) {
          return (t2 = t2 || {}).raw = true, n(e2, t2);
        }, r.gzip = function(e2, t2) {
          return (t2 = t2 || {}).gzip = true, n(e2, t2);
        };
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/deflate": 46, "./zlib/messages": 51, "./zlib/zstream": 53 }], 40: [function(e, t, r) {
        "use strict";
        var c = e("./zlib/inflate"), d = e("./utils/common"), p = e("./utils/strings"), m = e("./zlib/constants"), n = e("./zlib/messages"), i = e("./zlib/zstream"), s = e("./zlib/gzheader"), _ = Object.prototype.toString;
        function a(e2) {
          if (!(this instanceof a))
            return new a(e2);
          this.options = d.assign({ chunkSize: 16384, windowBits: 0, to: "" }, e2 || {});
          var t2 = this.options;
          t2.raw && 0 <= t2.windowBits && t2.windowBits < 16 && (t2.windowBits = -t2.windowBits, 0 === t2.windowBits && (t2.windowBits = -15)), !(0 <= t2.windowBits && t2.windowBits < 16) || e2 && e2.windowBits || (t2.windowBits += 32), 15 < t2.windowBits && t2.windowBits < 48 && 0 == (15 & t2.windowBits) && (t2.windowBits |= 15), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new i(), this.strm.avail_out = 0;
          var r2 = c.inflateInit2(this.strm, t2.windowBits);
          if (r2 !== m.Z_OK)
            throw new Error(n[r2]);
          this.header = new s(), c.inflateGetHeader(this.strm, this.header);
        }
        function o(e2, t2) {
          var r2 = new a(t2);
          if (r2.push(e2, true), r2.err)
            throw r2.msg || n[r2.err];
          return r2.result;
        }
        a.prototype.push = function(e2, t2) {
          var r2, n2, i2, s2, a2, o2, h = this.strm, u = this.options.chunkSize, l = this.options.dictionary, f = false;
          if (this.ended)
            return false;
          n2 = t2 === ~~t2 ? t2 : true === t2 ? m.Z_FINISH : m.Z_NO_FLUSH, "string" == typeof e2 ? h.input = p.binstring2buf(e2) : "[object ArrayBuffer]" === _.call(e2) ? h.input = new Uint8Array(e2) : h.input = e2, h.next_in = 0, h.avail_in = h.input.length;
          do {
            if (0 === h.avail_out && (h.output = new d.Buf8(u), h.next_out = 0, h.avail_out = u), (r2 = c.inflate(h, m.Z_NO_FLUSH)) === m.Z_NEED_DICT && l && (o2 = "string" == typeof l ? p.string2buf(l) : "[object ArrayBuffer]" === _.call(l) ? new Uint8Array(l) : l, r2 = c.inflateSetDictionary(this.strm, o2)), r2 === m.Z_BUF_ERROR && true === f && (r2 = m.Z_OK, f = false), r2 !== m.Z_STREAM_END && r2 !== m.Z_OK)
              return this.onEnd(r2), !(this.ended = true);
            h.next_out && (0 !== h.avail_out && r2 !== m.Z_STREAM_END && (0 !== h.avail_in || n2 !== m.Z_FINISH && n2 !== m.Z_SYNC_FLUSH) || ("string" === this.options.to ? (i2 = p.utf8border(h.output, h.next_out), s2 = h.next_out - i2, a2 = p.buf2string(h.output, i2), h.next_out = s2, h.avail_out = u - s2, s2 && d.arraySet(h.output, h.output, i2, s2, 0), this.onData(a2)) : this.onData(d.shrinkBuf(h.output, h.next_out)))), 0 === h.avail_in && 0 === h.avail_out && (f = true);
          } while ((0 < h.avail_in || 0 === h.avail_out) && r2 !== m.Z_STREAM_END);
          return r2 === m.Z_STREAM_END && (n2 = m.Z_FINISH), n2 === m.Z_FINISH ? (r2 = c.inflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === m.Z_OK) : n2 !== m.Z_SYNC_FLUSH || (this.onEnd(m.Z_OK), !(h.avail_out = 0));
        }, a.prototype.onData = function(e2) {
          this.chunks.push(e2);
        }, a.prototype.onEnd = function(e2) {
          e2 === m.Z_OK && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = d.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
        }, r.Inflate = a, r.inflate = o, r.inflateRaw = function(e2, t2) {
          return (t2 = t2 || {}).raw = true, o(e2, t2);
        }, r.ungzip = o;
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/constants": 44, "./zlib/gzheader": 47, "./zlib/inflate": 49, "./zlib/messages": 51, "./zlib/zstream": 53 }], 41: [function(e, t, r) {
        "use strict";
        var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array;
        r.assign = function(e2) {
          for (var t2 = Array.prototype.slice.call(arguments, 1); t2.length; ) {
            var r2 = t2.shift();
            if (r2) {
              if ("object" != typeof r2)
                throw new TypeError(r2 + "must be non-object");
              for (var n2 in r2)
                r2.hasOwnProperty(n2) && (e2[n2] = r2[n2]);
            }
          }
          return e2;
        }, r.shrinkBuf = function(e2, t2) {
          return e2.length === t2 ? e2 : e2.subarray ? e2.subarray(0, t2) : (e2.length = t2, e2);
        };
        var i = { arraySet: function(e2, t2, r2, n2, i2) {
          if (t2.subarray && e2.subarray)
            e2.set(t2.subarray(r2, r2 + n2), i2);
          else
            for (var s2 = 0; s2 < n2; s2++)
              e2[i2 + s2] = t2[r2 + s2];
        }, flattenChunks: function(e2) {
          var t2, r2, n2, i2, s2, a;
          for (t2 = n2 = 0, r2 = e2.length; t2 < r2; t2++)
            n2 += e2[t2].length;
          for (a = new Uint8Array(n2), t2 = i2 = 0, r2 = e2.length; t2 < r2; t2++)
            s2 = e2[t2], a.set(s2, i2), i2 += s2.length;
          return a;
        } }, s = { arraySet: function(e2, t2, r2, n2, i2) {
          for (var s2 = 0; s2 < n2; s2++)
            e2[i2 + s2] = t2[r2 + s2];
        }, flattenChunks: function(e2) {
          return [].concat.apply([], e2);
        } };
        r.setTyped = function(e2) {
          e2 ? (r.Buf8 = Uint8Array, r.Buf16 = Uint16Array, r.Buf32 = Int32Array, r.assign(r, i)) : (r.Buf8 = Array, r.Buf16 = Array, r.Buf32 = Array, r.assign(r, s));
        }, r.setTyped(n);
      }, {}], 42: [function(e, t, r) {
        "use strict";
        var h = e("./common"), i = true, s = true;
        try {
          String.fromCharCode.apply(null, [0]);
        } catch (e2) {
          i = false;
        }
        try {
          String.fromCharCode.apply(null, new Uint8Array(1));
        } catch (e2) {
          s = false;
        }
        for (var u = new h.Buf8(256), n = 0; n < 256; n++)
          u[n] = 252 <= n ? 6 : 248 <= n ? 5 : 240 <= n ? 4 : 224 <= n ? 3 : 192 <= n ? 2 : 1;
        function l(e2, t2) {
          if (t2 < 65537 && (e2.subarray && s || !e2.subarray && i))
            return String.fromCharCode.apply(null, h.shrinkBuf(e2, t2));
          for (var r2 = "", n2 = 0; n2 < t2; n2++)
            r2 += String.fromCharCode(e2[n2]);
          return r2;
        }
        u[254] = u[254] = 1, r.string2buf = function(e2) {
          var t2, r2, n2, i2, s2, a = e2.length, o = 0;
          for (i2 = 0; i2 < a; i2++)
            55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
          for (t2 = new h.Buf8(o), i2 = s2 = 0; s2 < o; i2++)
            55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
          return t2;
        }, r.buf2binstring = function(e2) {
          return l(e2, e2.length);
        }, r.binstring2buf = function(e2) {
          for (var t2 = new h.Buf8(e2.length), r2 = 0, n2 = t2.length; r2 < n2; r2++)
            t2[r2] = e2.charCodeAt(r2);
          return t2;
        }, r.buf2string = function(e2, t2) {
          var r2, n2, i2, s2, a = t2 || e2.length, o = new Array(2 * a);
          for (r2 = n2 = 0; r2 < a; )
            if ((i2 = e2[r2++]) < 128)
              o[n2++] = i2;
            else if (4 < (s2 = u[i2]))
              o[n2++] = 65533, r2 += s2 - 1;
            else {
              for (i2 &= 2 === s2 ? 31 : 3 === s2 ? 15 : 7; 1 < s2 && r2 < a; )
                i2 = i2 << 6 | 63 & e2[r2++], s2--;
              1 < s2 ? o[n2++] = 65533 : i2 < 65536 ? o[n2++] = i2 : (i2 -= 65536, o[n2++] = 55296 | i2 >> 10 & 1023, o[n2++] = 56320 | 1023 & i2);
            }
          return l(o, n2);
        }, r.utf8border = function(e2, t2) {
          var r2;
          for ((t2 = t2 || e2.length) > e2.length && (t2 = e2.length), r2 = t2 - 1; 0 <= r2 && 128 == (192 & e2[r2]); )
            r2--;
          return r2 < 0 ? t2 : 0 === r2 ? t2 : r2 + u[e2[r2]] > t2 ? r2 : t2;
        };
      }, { "./common": 41 }], 43: [function(e, t, r) {
        "use strict";
        t.exports = function(e2, t2, r2, n) {
          for (var i = 65535 & e2 | 0, s = e2 >>> 16 & 65535 | 0, a = 0; 0 !== r2; ) {
            for (r2 -= a = 2e3 < r2 ? 2e3 : r2; s = s + (i = i + t2[n++] | 0) | 0, --a; )
              ;
            i %= 65521, s %= 65521;
          }
          return i | s << 16 | 0;
        };
      }, {}], 44: [function(e, t, r) {
        "use strict";
        t.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 };
      }, {}], 45: [function(e, t, r) {
        "use strict";
        var o = function() {
          for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
            e2 = r2;
            for (var n = 0; n < 8; n++)
              e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
            t2[r2] = e2;
          }
          return t2;
        }();
        t.exports = function(e2, t2, r2, n) {
          var i = o, s = n + r2;
          e2 ^= -1;
          for (var a = n; a < s; a++)
            e2 = e2 >>> 8 ^ i[255 & (e2 ^ t2[a])];
          return -1 ^ e2;
        };
      }, {}], 46: [function(e, t, r) {
        "use strict";
        var h, c = e("../utils/common"), u = e("./trees"), d = e("./adler32"), p = e("./crc32"), n = e("./messages"), l = 0, f = 4, m = 0, _ = -2, g = -1, b = 4, i = 2, v = 8, y = 9, s = 286, a = 30, o = 19, w = 2 * s + 1, k = 15, x = 3, S = 258, z = S + x + 1, C = 42, E = 113, A = 1, I = 2, O = 3, B = 4;
        function R(e2, t2) {
          return e2.msg = n[t2], t2;
        }
        function T(e2) {
          return (e2 << 1) - (4 < e2 ? 9 : 0);
        }
        function D(e2) {
          for (var t2 = e2.length; 0 <= --t2; )
            e2[t2] = 0;
        }
        function F(e2) {
          var t2 = e2.state, r2 = t2.pending;
          r2 > e2.avail_out && (r2 = e2.avail_out), 0 !== r2 && (c.arraySet(e2.output, t2.pending_buf, t2.pending_out, r2, e2.next_out), e2.next_out += r2, t2.pending_out += r2, e2.total_out += r2, e2.avail_out -= r2, t2.pending -= r2, 0 === t2.pending && (t2.pending_out = 0));
        }
        function N(e2, t2) {
          u._tr_flush_block(e2, 0 <= e2.block_start ? e2.block_start : -1, e2.strstart - e2.block_start, t2), e2.block_start = e2.strstart, F(e2.strm);
        }
        function U(e2, t2) {
          e2.pending_buf[e2.pending++] = t2;
        }
        function P(e2, t2) {
          e2.pending_buf[e2.pending++] = t2 >>> 8 & 255, e2.pending_buf[e2.pending++] = 255 & t2;
        }
        function L(e2, t2) {
          var r2, n2, i2 = e2.max_chain_length, s2 = e2.strstart, a2 = e2.prev_length, o2 = e2.nice_match, h2 = e2.strstart > e2.w_size - z ? e2.strstart - (e2.w_size - z) : 0, u2 = e2.window, l2 = e2.w_mask, f2 = e2.prev, c2 = e2.strstart + S, d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
          e2.prev_length >= e2.good_match && (i2 >>= 2), o2 > e2.lookahead && (o2 = e2.lookahead);
          do {
            if (u2[(r2 = t2) + a2] === p2 && u2[r2 + a2 - 1] === d2 && u2[r2] === u2[s2] && u2[++r2] === u2[s2 + 1]) {
              s2 += 2, r2++;
              do {
              } while (u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && s2 < c2);
              if (n2 = S - (c2 - s2), s2 = c2 - S, a2 < n2) {
                if (e2.match_start = t2, o2 <= (a2 = n2))
                  break;
                d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
              }
            }
          } while ((t2 = f2[t2 & l2]) > h2 && 0 != --i2);
          return a2 <= e2.lookahead ? a2 : e2.lookahead;
        }
        function j(e2) {
          var t2, r2, n2, i2, s2, a2, o2, h2, u2, l2, f2 = e2.w_size;
          do {
            if (i2 = e2.window_size - e2.lookahead - e2.strstart, e2.strstart >= f2 + (f2 - z)) {
              for (c.arraySet(e2.window, e2.window, f2, f2, 0), e2.match_start -= f2, e2.strstart -= f2, e2.block_start -= f2, t2 = r2 = e2.hash_size; n2 = e2.head[--t2], e2.head[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; )
                ;
              for (t2 = r2 = f2; n2 = e2.prev[--t2], e2.prev[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; )
                ;
              i2 += f2;
            }
            if (0 === e2.strm.avail_in)
              break;
            if (a2 = e2.strm, o2 = e2.window, h2 = e2.strstart + e2.lookahead, u2 = i2, l2 = void 0, l2 = a2.avail_in, u2 < l2 && (l2 = u2), r2 = 0 === l2 ? 0 : (a2.avail_in -= l2, c.arraySet(o2, a2.input, a2.next_in, l2, h2), 1 === a2.state.wrap ? a2.adler = d(a2.adler, o2, l2, h2) : 2 === a2.state.wrap && (a2.adler = p(a2.adler, o2, l2, h2)), a2.next_in += l2, a2.total_in += l2, l2), e2.lookahead += r2, e2.lookahead + e2.insert >= x)
              for (s2 = e2.strstart - e2.insert, e2.ins_h = e2.window[s2], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + 1]) & e2.hash_mask; e2.insert && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + x - 1]) & e2.hash_mask, e2.prev[s2 & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = s2, s2++, e2.insert--, !(e2.lookahead + e2.insert < x)); )
                ;
          } while (e2.lookahead < z && 0 !== e2.strm.avail_in);
        }
        function Z(e2, t2) {
          for (var r2, n2; ; ) {
            if (e2.lookahead < z) {
              if (j(e2), e2.lookahead < z && t2 === l)
                return A;
              if (0 === e2.lookahead)
                break;
            }
            if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 !== r2 && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2)), e2.match_length >= x)
              if (n2 = u._tr_tally(e2, e2.strstart - e2.match_start, e2.match_length - x), e2.lookahead -= e2.match_length, e2.match_length <= e2.max_lazy_match && e2.lookahead >= x) {
                for (e2.match_length--; e2.strstart++, e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart, 0 != --e2.match_length; )
                  ;
                e2.strstart++;
              } else
                e2.strstart += e2.match_length, e2.match_length = 0, e2.ins_h = e2.window[e2.strstart], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + 1]) & e2.hash_mask;
            else
              n2 = u._tr_tally(e2, 0, e2.window[e2.strstart]), e2.lookahead--, e2.strstart++;
            if (n2 && (N(e2, false), 0 === e2.strm.avail_out))
              return A;
          }
          return e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
        }
        function W(e2, t2) {
          for (var r2, n2, i2; ; ) {
            if (e2.lookahead < z) {
              if (j(e2), e2.lookahead < z && t2 === l)
                return A;
              if (0 === e2.lookahead)
                break;
            }
            if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), e2.prev_length = e2.match_length, e2.prev_match = e2.match_start, e2.match_length = x - 1, 0 !== r2 && e2.prev_length < e2.max_lazy_match && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2), e2.match_length <= 5 && (1 === e2.strategy || e2.match_length === x && 4096 < e2.strstart - e2.match_start) && (e2.match_length = x - 1)), e2.prev_length >= x && e2.match_length <= e2.prev_length) {
              for (i2 = e2.strstart + e2.lookahead - x, n2 = u._tr_tally(e2, e2.strstart - 1 - e2.prev_match, e2.prev_length - x), e2.lookahead -= e2.prev_length - 1, e2.prev_length -= 2; ++e2.strstart <= i2 && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 != --e2.prev_length; )
                ;
              if (e2.match_available = 0, e2.match_length = x - 1, e2.strstart++, n2 && (N(e2, false), 0 === e2.strm.avail_out))
                return A;
            } else if (e2.match_available) {
              if ((n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1])) && N(e2, false), e2.strstart++, e2.lookahead--, 0 === e2.strm.avail_out)
                return A;
            } else
              e2.match_available = 1, e2.strstart++, e2.lookahead--;
          }
          return e2.match_available && (n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1]), e2.match_available = 0), e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
        }
        function M(e2, t2, r2, n2, i2) {
          this.good_length = e2, this.max_lazy = t2, this.nice_length = r2, this.max_chain = n2, this.func = i2;
        }
        function H() {
          this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = v, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new c.Buf16(2 * w), this.dyn_dtree = new c.Buf16(2 * (2 * a + 1)), this.bl_tree = new c.Buf16(2 * (2 * o + 1)), D(this.dyn_ltree), D(this.dyn_dtree), D(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new c.Buf16(k + 1), this.heap = new c.Buf16(2 * s + 1), D(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new c.Buf16(2 * s + 1), D(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
        }
        function G(e2) {
          var t2;
          return e2 && e2.state ? (e2.total_in = e2.total_out = 0, e2.data_type = i, (t2 = e2.state).pending = 0, t2.pending_out = 0, t2.wrap < 0 && (t2.wrap = -t2.wrap), t2.status = t2.wrap ? C : E, e2.adler = 2 === t2.wrap ? 0 : 1, t2.last_flush = l, u._tr_init(t2), m) : R(e2, _);
        }
        function K2(e2) {
          var t2 = G(e2);
          return t2 === m && function(e3) {
            e3.window_size = 2 * e3.w_size, D(e3.head), e3.max_lazy_match = h[e3.level].max_lazy, e3.good_match = h[e3.level].good_length, e3.nice_match = h[e3.level].nice_length, e3.max_chain_length = h[e3.level].max_chain, e3.strstart = 0, e3.block_start = 0, e3.lookahead = 0, e3.insert = 0, e3.match_length = e3.prev_length = x - 1, e3.match_available = 0, e3.ins_h = 0;
          }(e2.state), t2;
        }
        function Y(e2, t2, r2, n2, i2, s2) {
          if (!e2)
            return _;
          var a2 = 1;
          if (t2 === g && (t2 = 6), n2 < 0 ? (a2 = 0, n2 = -n2) : 15 < n2 && (a2 = 2, n2 -= 16), i2 < 1 || y < i2 || r2 !== v || n2 < 8 || 15 < n2 || t2 < 0 || 9 < t2 || s2 < 0 || b < s2)
            return R(e2, _);
          8 === n2 && (n2 = 9);
          var o2 = new H();
          return (e2.state = o2).strm = e2, o2.wrap = a2, o2.gzhead = null, o2.w_bits = n2, o2.w_size = 1 << o2.w_bits, o2.w_mask = o2.w_size - 1, o2.hash_bits = i2 + 7, o2.hash_size = 1 << o2.hash_bits, o2.hash_mask = o2.hash_size - 1, o2.hash_shift = ~~((o2.hash_bits + x - 1) / x), o2.window = new c.Buf8(2 * o2.w_size), o2.head = new c.Buf16(o2.hash_size), o2.prev = new c.Buf16(o2.w_size), o2.lit_bufsize = 1 << i2 + 6, o2.pending_buf_size = 4 * o2.lit_bufsize, o2.pending_buf = new c.Buf8(o2.pending_buf_size), o2.d_buf = 1 * o2.lit_bufsize, o2.l_buf = 3 * o2.lit_bufsize, o2.level = t2, o2.strategy = s2, o2.method = r2, K2(e2);
        }
        h = [new M(0, 0, 0, 0, function(e2, t2) {
          var r2 = 65535;
          for (r2 > e2.pending_buf_size - 5 && (r2 = e2.pending_buf_size - 5); ; ) {
            if (e2.lookahead <= 1) {
              if (j(e2), 0 === e2.lookahead && t2 === l)
                return A;
              if (0 === e2.lookahead)
                break;
            }
            e2.strstart += e2.lookahead, e2.lookahead = 0;
            var n2 = e2.block_start + r2;
            if ((0 === e2.strstart || e2.strstart >= n2) && (e2.lookahead = e2.strstart - n2, e2.strstart = n2, N(e2, false), 0 === e2.strm.avail_out))
              return A;
            if (e2.strstart - e2.block_start >= e2.w_size - z && (N(e2, false), 0 === e2.strm.avail_out))
              return A;
          }
          return e2.insert = 0, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : (e2.strstart > e2.block_start && (N(e2, false), e2.strm.avail_out), A);
        }), new M(4, 4, 8, 4, Z), new M(4, 5, 16, 8, Z), new M(4, 6, 32, 32, Z), new M(4, 4, 16, 16, W), new M(8, 16, 32, 32, W), new M(8, 16, 128, 128, W), new M(8, 32, 128, 256, W), new M(32, 128, 258, 1024, W), new M(32, 258, 258, 4096, W)], r.deflateInit = function(e2, t2) {
          return Y(e2, t2, v, 15, 8, 0);
        }, r.deflateInit2 = Y, r.deflateReset = K2, r.deflateResetKeep = G, r.deflateSetHeader = function(e2, t2) {
          return e2 && e2.state ? 2 !== e2.state.wrap ? _ : (e2.state.gzhead = t2, m) : _;
        }, r.deflate = function(e2, t2) {
          var r2, n2, i2, s2;
          if (!e2 || !e2.state || 5 < t2 || t2 < 0)
            return e2 ? R(e2, _) : _;
          if (n2 = e2.state, !e2.output || !e2.input && 0 !== e2.avail_in || 666 === n2.status && t2 !== f)
            return R(e2, 0 === e2.avail_out ? -5 : _);
          if (n2.strm = e2, r2 = n2.last_flush, n2.last_flush = t2, n2.status === C)
            if (2 === n2.wrap)
              e2.adler = 0, U(n2, 31), U(n2, 139), U(n2, 8), n2.gzhead ? (U(n2, (n2.gzhead.text ? 1 : 0) + (n2.gzhead.hcrc ? 2 : 0) + (n2.gzhead.extra ? 4 : 0) + (n2.gzhead.name ? 8 : 0) + (n2.gzhead.comment ? 16 : 0)), U(n2, 255 & n2.gzhead.time), U(n2, n2.gzhead.time >> 8 & 255), U(n2, n2.gzhead.time >> 16 & 255), U(n2, n2.gzhead.time >> 24 & 255), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 255 & n2.gzhead.os), n2.gzhead.extra && n2.gzhead.extra.length && (U(n2, 255 & n2.gzhead.extra.length), U(n2, n2.gzhead.extra.length >> 8 & 255)), n2.gzhead.hcrc && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending, 0)), n2.gzindex = 0, n2.status = 69) : (U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 3), n2.status = E);
            else {
              var a2 = v + (n2.w_bits - 8 << 4) << 8;
              a2 |= (2 <= n2.strategy || n2.level < 2 ? 0 : n2.level < 6 ? 1 : 6 === n2.level ? 2 : 3) << 6, 0 !== n2.strstart && (a2 |= 32), a2 += 31 - a2 % 31, n2.status = E, P(n2, a2), 0 !== n2.strstart && (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), e2.adler = 1;
            }
          if (69 === n2.status)
            if (n2.gzhead.extra) {
              for (i2 = n2.pending; n2.gzindex < (65535 & n2.gzhead.extra.length) && (n2.pending !== n2.pending_buf_size || (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending !== n2.pending_buf_size)); )
                U(n2, 255 & n2.gzhead.extra[n2.gzindex]), n2.gzindex++;
              n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), n2.gzindex === n2.gzhead.extra.length && (n2.gzindex = 0, n2.status = 73);
            } else
              n2.status = 73;
          if (73 === n2.status)
            if (n2.gzhead.name) {
              i2 = n2.pending;
              do {
                if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                  s2 = 1;
                  break;
                }
                s2 = n2.gzindex < n2.gzhead.name.length ? 255 & n2.gzhead.name.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
              } while (0 !== s2);
              n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.gzindex = 0, n2.status = 91);
            } else
              n2.status = 91;
          if (91 === n2.status)
            if (n2.gzhead.comment) {
              i2 = n2.pending;
              do {
                if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                  s2 = 1;
                  break;
                }
                s2 = n2.gzindex < n2.gzhead.comment.length ? 255 & n2.gzhead.comment.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
              } while (0 !== s2);
              n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.status = 103);
            } else
              n2.status = 103;
          if (103 === n2.status && (n2.gzhead.hcrc ? (n2.pending + 2 > n2.pending_buf_size && F(e2), n2.pending + 2 <= n2.pending_buf_size && (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), e2.adler = 0, n2.status = E)) : n2.status = E), 0 !== n2.pending) {
            if (F(e2), 0 === e2.avail_out)
              return n2.last_flush = -1, m;
          } else if (0 === e2.avail_in && T(t2) <= T(r2) && t2 !== f)
            return R(e2, -5);
          if (666 === n2.status && 0 !== e2.avail_in)
            return R(e2, -5);
          if (0 !== e2.avail_in || 0 !== n2.lookahead || t2 !== l && 666 !== n2.status) {
            var o2 = 2 === n2.strategy ? function(e3, t3) {
              for (var r3; ; ) {
                if (0 === e3.lookahead && (j(e3), 0 === e3.lookahead)) {
                  if (t3 === l)
                    return A;
                  break;
                }
                if (e3.match_length = 0, r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++, r3 && (N(e3, false), 0 === e3.strm.avail_out))
                  return A;
              }
              return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
            }(n2, t2) : 3 === n2.strategy ? function(e3, t3) {
              for (var r3, n3, i3, s3, a3 = e3.window; ; ) {
                if (e3.lookahead <= S) {
                  if (j(e3), e3.lookahead <= S && t3 === l)
                    return A;
                  if (0 === e3.lookahead)
                    break;
                }
                if (e3.match_length = 0, e3.lookahead >= x && 0 < e3.strstart && (n3 = a3[i3 = e3.strstart - 1]) === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3]) {
                  s3 = e3.strstart + S;
                  do {
                  } while (n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && i3 < s3);
                  e3.match_length = S - (s3 - i3), e3.match_length > e3.lookahead && (e3.match_length = e3.lookahead);
                }
                if (e3.match_length >= x ? (r3 = u._tr_tally(e3, 1, e3.match_length - x), e3.lookahead -= e3.match_length, e3.strstart += e3.match_length, e3.match_length = 0) : (r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++), r3 && (N(e3, false), 0 === e3.strm.avail_out))
                  return A;
              }
              return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
            }(n2, t2) : h[n2.level].func(n2, t2);
            if (o2 !== O && o2 !== B || (n2.status = 666), o2 === A || o2 === O)
              return 0 === e2.avail_out && (n2.last_flush = -1), m;
            if (o2 === I && (1 === t2 ? u._tr_align(n2) : 5 !== t2 && (u._tr_stored_block(n2, 0, 0, false), 3 === t2 && (D(n2.head), 0 === n2.lookahead && (n2.strstart = 0, n2.block_start = 0, n2.insert = 0))), F(e2), 0 === e2.avail_out))
              return n2.last_flush = -1, m;
          }
          return t2 !== f ? m : n2.wrap <= 0 ? 1 : (2 === n2.wrap ? (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), U(n2, e2.adler >> 16 & 255), U(n2, e2.adler >> 24 & 255), U(n2, 255 & e2.total_in), U(n2, e2.total_in >> 8 & 255), U(n2, e2.total_in >> 16 & 255), U(n2, e2.total_in >> 24 & 255)) : (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), F(e2), 0 < n2.wrap && (n2.wrap = -n2.wrap), 0 !== n2.pending ? m : 1);
        }, r.deflateEnd = function(e2) {
          var t2;
          return e2 && e2.state ? (t2 = e2.state.status) !== C && 69 !== t2 && 73 !== t2 && 91 !== t2 && 103 !== t2 && t2 !== E && 666 !== t2 ? R(e2, _) : (e2.state = null, t2 === E ? R(e2, -3) : m) : _;
        }, r.deflateSetDictionary = function(e2, t2) {
          var r2, n2, i2, s2, a2, o2, h2, u2, l2 = t2.length;
          if (!e2 || !e2.state)
            return _;
          if (2 === (s2 = (r2 = e2.state).wrap) || 1 === s2 && r2.status !== C || r2.lookahead)
            return _;
          for (1 === s2 && (e2.adler = d(e2.adler, t2, l2, 0)), r2.wrap = 0, l2 >= r2.w_size && (0 === s2 && (D(r2.head), r2.strstart = 0, r2.block_start = 0, r2.insert = 0), u2 = new c.Buf8(r2.w_size), c.arraySet(u2, t2, l2 - r2.w_size, r2.w_size, 0), t2 = u2, l2 = r2.w_size), a2 = e2.avail_in, o2 = e2.next_in, h2 = e2.input, e2.avail_in = l2, e2.next_in = 0, e2.input = t2, j(r2); r2.lookahead >= x; ) {
            for (n2 = r2.strstart, i2 = r2.lookahead - (x - 1); r2.ins_h = (r2.ins_h << r2.hash_shift ^ r2.window[n2 + x - 1]) & r2.hash_mask, r2.prev[n2 & r2.w_mask] = r2.head[r2.ins_h], r2.head[r2.ins_h] = n2, n2++, --i2; )
              ;
            r2.strstart = n2, r2.lookahead = x - 1, j(r2);
          }
          return r2.strstart += r2.lookahead, r2.block_start = r2.strstart, r2.insert = r2.lookahead, r2.lookahead = 0, r2.match_length = r2.prev_length = x - 1, r2.match_available = 0, e2.next_in = o2, e2.input = h2, e2.avail_in = a2, r2.wrap = s2, m;
        }, r.deflateInfo = "pako deflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./messages": 51, "./trees": 52 }], 47: [function(e, t, r) {
        "use strict";
        t.exports = function() {
          this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = false;
        };
      }, {}], 48: [function(e, t, r) {
        "use strict";
        t.exports = function(e2, t2) {
          var r2, n, i, s, a, o, h, u, l, f, c, d, p, m, _, g, b, v, y, w, k, x, S, z, C;
          r2 = e2.state, n = e2.next_in, z = e2.input, i = n + (e2.avail_in - 5), s = e2.next_out, C = e2.output, a = s - (t2 - e2.avail_out), o = s + (e2.avail_out - 257), h = r2.dmax, u = r2.wsize, l = r2.whave, f = r2.wnext, c = r2.window, d = r2.hold, p = r2.bits, m = r2.lencode, _ = r2.distcode, g = (1 << r2.lenbits) - 1, b = (1 << r2.distbits) - 1;
          e:
            do {
              p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = m[d & g];
              t:
                for (; ; ) {
                  if (d >>>= y = v >>> 24, p -= y, 0 === (y = v >>> 16 & 255))
                    C[s++] = 65535 & v;
                  else {
                    if (!(16 & y)) {
                      if (0 == (64 & y)) {
                        v = m[(65535 & v) + (d & (1 << y) - 1)];
                        continue t;
                      }
                      if (32 & y) {
                        r2.mode = 12;
                        break e;
                      }
                      e2.msg = "invalid literal/length code", r2.mode = 30;
                      break e;
                    }
                    w = 65535 & v, (y &= 15) && (p < y && (d += z[n++] << p, p += 8), w += d & (1 << y) - 1, d >>>= y, p -= y), p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = _[d & b];
                    r:
                      for (; ; ) {
                        if (d >>>= y = v >>> 24, p -= y, !(16 & (y = v >>> 16 & 255))) {
                          if (0 == (64 & y)) {
                            v = _[(65535 & v) + (d & (1 << y) - 1)];
                            continue r;
                          }
                          e2.msg = "invalid distance code", r2.mode = 30;
                          break e;
                        }
                        if (k = 65535 & v, p < (y &= 15) && (d += z[n++] << p, (p += 8) < y && (d += z[n++] << p, p += 8)), h < (k += d & (1 << y) - 1)) {
                          e2.msg = "invalid distance too far back", r2.mode = 30;
                          break e;
                        }
                        if (d >>>= y, p -= y, (y = s - a) < k) {
                          if (l < (y = k - y) && r2.sane) {
                            e2.msg = "invalid distance too far back", r2.mode = 30;
                            break e;
                          }
                          if (S = c, (x = 0) === f) {
                            if (x += u - y, y < w) {
                              for (w -= y; C[s++] = c[x++], --y; )
                                ;
                              x = s - k, S = C;
                            }
                          } else if (f < y) {
                            if (x += u + f - y, (y -= f) < w) {
                              for (w -= y; C[s++] = c[x++], --y; )
                                ;
                              if (x = 0, f < w) {
                                for (w -= y = f; C[s++] = c[x++], --y; )
                                  ;
                                x = s - k, S = C;
                              }
                            }
                          } else if (x += f - y, y < w) {
                            for (w -= y; C[s++] = c[x++], --y; )
                              ;
                            x = s - k, S = C;
                          }
                          for (; 2 < w; )
                            C[s++] = S[x++], C[s++] = S[x++], C[s++] = S[x++], w -= 3;
                          w && (C[s++] = S[x++], 1 < w && (C[s++] = S[x++]));
                        } else {
                          for (x = s - k; C[s++] = C[x++], C[s++] = C[x++], C[s++] = C[x++], 2 < (w -= 3); )
                            ;
                          w && (C[s++] = C[x++], 1 < w && (C[s++] = C[x++]));
                        }
                        break;
                      }
                  }
                  break;
                }
            } while (n < i && s < o);
          n -= w = p >> 3, d &= (1 << (p -= w << 3)) - 1, e2.next_in = n, e2.next_out = s, e2.avail_in = n < i ? i - n + 5 : 5 - (n - i), e2.avail_out = s < o ? o - s + 257 : 257 - (s - o), r2.hold = d, r2.bits = p;
        };
      }, {}], 49: [function(e, t, r) {
        "use strict";
        var I = e("../utils/common"), O = e("./adler32"), B = e("./crc32"), R = e("./inffast"), T = e("./inftrees"), D = 1, F = 2, N = 0, U = -2, P = 1, n = 852, i = 592;
        function L(e2) {
          return (e2 >>> 24 & 255) + (e2 >>> 8 & 65280) + ((65280 & e2) << 8) + ((255 & e2) << 24);
        }
        function s() {
          this.mode = 0, this.last = false, this.wrap = 0, this.havedict = false, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new I.Buf16(320), this.work = new I.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
        }
        function a(e2) {
          var t2;
          return e2 && e2.state ? (t2 = e2.state, e2.total_in = e2.total_out = t2.total = 0, e2.msg = "", t2.wrap && (e2.adler = 1 & t2.wrap), t2.mode = P, t2.last = 0, t2.havedict = 0, t2.dmax = 32768, t2.head = null, t2.hold = 0, t2.bits = 0, t2.lencode = t2.lendyn = new I.Buf32(n), t2.distcode = t2.distdyn = new I.Buf32(i), t2.sane = 1, t2.back = -1, N) : U;
        }
        function o(e2) {
          var t2;
          return e2 && e2.state ? ((t2 = e2.state).wsize = 0, t2.whave = 0, t2.wnext = 0, a(e2)) : U;
        }
        function h(e2, t2) {
          var r2, n2;
          return e2 && e2.state ? (n2 = e2.state, t2 < 0 ? (r2 = 0, t2 = -t2) : (r2 = 1 + (t2 >> 4), t2 < 48 && (t2 &= 15)), t2 && (t2 < 8 || 15 < t2) ? U : (null !== n2.window && n2.wbits !== t2 && (n2.window = null), n2.wrap = r2, n2.wbits = t2, o(e2))) : U;
        }
        function u(e2, t2) {
          var r2, n2;
          return e2 ? (n2 = new s(), (e2.state = n2).window = null, (r2 = h(e2, t2)) !== N && (e2.state = null), r2) : U;
        }
        var l, f, c = true;
        function j(e2) {
          if (c) {
            var t2;
            for (l = new I.Buf32(512), f = new I.Buf32(32), t2 = 0; t2 < 144; )
              e2.lens[t2++] = 8;
            for (; t2 < 256; )
              e2.lens[t2++] = 9;
            for (; t2 < 280; )
              e2.lens[t2++] = 7;
            for (; t2 < 288; )
              e2.lens[t2++] = 8;
            for (T(D, e2.lens, 0, 288, l, 0, e2.work, { bits: 9 }), t2 = 0; t2 < 32; )
              e2.lens[t2++] = 5;
            T(F, e2.lens, 0, 32, f, 0, e2.work, { bits: 5 }), c = false;
          }
          e2.lencode = l, e2.lenbits = 9, e2.distcode = f, e2.distbits = 5;
        }
        function Z(e2, t2, r2, n2) {
          var i2, s2 = e2.state;
          return null === s2.window && (s2.wsize = 1 << s2.wbits, s2.wnext = 0, s2.whave = 0, s2.window = new I.Buf8(s2.wsize)), n2 >= s2.wsize ? (I.arraySet(s2.window, t2, r2 - s2.wsize, s2.wsize, 0), s2.wnext = 0, s2.whave = s2.wsize) : (n2 < (i2 = s2.wsize - s2.wnext) && (i2 = n2), I.arraySet(s2.window, t2, r2 - n2, i2, s2.wnext), (n2 -= i2) ? (I.arraySet(s2.window, t2, r2 - n2, n2, 0), s2.wnext = n2, s2.whave = s2.wsize) : (s2.wnext += i2, s2.wnext === s2.wsize && (s2.wnext = 0), s2.whave < s2.wsize && (s2.whave += i2))), 0;
        }
        r.inflateReset = o, r.inflateReset2 = h, r.inflateResetKeep = a, r.inflateInit = function(e2) {
          return u(e2, 15);
        }, r.inflateInit2 = u, r.inflate = function(e2, t2) {
          var r2, n2, i2, s2, a2, o2, h2, u2, l2, f2, c2, d, p, m, _, g, b, v, y, w, k, x, S, z, C = 0, E = new I.Buf8(4), A = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          if (!e2 || !e2.state || !e2.output || !e2.input && 0 !== e2.avail_in)
            return U;
          12 === (r2 = e2.state).mode && (r2.mode = 13), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, f2 = o2, c2 = h2, x = N;
          e:
            for (; ; )
              switch (r2.mode) {
                case P:
                  if (0 === r2.wrap) {
                    r2.mode = 13;
                    break;
                  }
                  for (; l2 < 16; ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (2 & r2.wrap && 35615 === u2) {
                    E[r2.check = 0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0), l2 = u2 = 0, r2.mode = 2;
                    break;
                  }
                  if (r2.flags = 0, r2.head && (r2.head.done = false), !(1 & r2.wrap) || (((255 & u2) << 8) + (u2 >> 8)) % 31) {
                    e2.msg = "incorrect header check", r2.mode = 30;
                    break;
                  }
                  if (8 != (15 & u2)) {
                    e2.msg = "unknown compression method", r2.mode = 30;
                    break;
                  }
                  if (l2 -= 4, k = 8 + (15 & (u2 >>>= 4)), 0 === r2.wbits)
                    r2.wbits = k;
                  else if (k > r2.wbits) {
                    e2.msg = "invalid window size", r2.mode = 30;
                    break;
                  }
                  r2.dmax = 1 << k, e2.adler = r2.check = 1, r2.mode = 512 & u2 ? 10 : 12, l2 = u2 = 0;
                  break;
                case 2:
                  for (; l2 < 16; ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (r2.flags = u2, 8 != (255 & r2.flags)) {
                    e2.msg = "unknown compression method", r2.mode = 30;
                    break;
                  }
                  if (57344 & r2.flags) {
                    e2.msg = "unknown header flags set", r2.mode = 30;
                    break;
                  }
                  r2.head && (r2.head.text = u2 >> 8 & 1), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 3;
                case 3:
                  for (; l2 < 32; ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.head && (r2.head.time = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, E[2] = u2 >>> 16 & 255, E[3] = u2 >>> 24 & 255, r2.check = B(r2.check, E, 4, 0)), l2 = u2 = 0, r2.mode = 4;
                case 4:
                  for (; l2 < 16; ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.head && (r2.head.xflags = 255 & u2, r2.head.os = u2 >> 8), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 5;
                case 5:
                  if (1024 & r2.flags) {
                    for (; l2 < 16; ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    r2.length = u2, r2.head && (r2.head.extra_len = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0;
                  } else
                    r2.head && (r2.head.extra = null);
                  r2.mode = 6;
                case 6:
                  if (1024 & r2.flags && (o2 < (d = r2.length) && (d = o2), d && (r2.head && (k = r2.head.extra_len - r2.length, r2.head.extra || (r2.head.extra = new Array(r2.head.extra_len)), I.arraySet(r2.head.extra, n2, s2, d, k)), 512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, r2.length -= d), r2.length))
                    break e;
                  r2.length = 0, r2.mode = 7;
                case 7:
                  if (2048 & r2.flags) {
                    if (0 === o2)
                      break e;
                    for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.name += String.fromCharCode(k)), k && d < o2; )
                      ;
                    if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k)
                      break e;
                  } else
                    r2.head && (r2.head.name = null);
                  r2.length = 0, r2.mode = 8;
                case 8:
                  if (4096 & r2.flags) {
                    if (0 === o2)
                      break e;
                    for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.comment += String.fromCharCode(k)), k && d < o2; )
                      ;
                    if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k)
                      break e;
                  } else
                    r2.head && (r2.head.comment = null);
                  r2.mode = 9;
                case 9:
                  if (512 & r2.flags) {
                    for (; l2 < 16; ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if (u2 !== (65535 & r2.check)) {
                      e2.msg = "header crc mismatch", r2.mode = 30;
                      break;
                    }
                    l2 = u2 = 0;
                  }
                  r2.head && (r2.head.hcrc = r2.flags >> 9 & 1, r2.head.done = true), e2.adler = r2.check = 0, r2.mode = 12;
                  break;
                case 10:
                  for (; l2 < 32; ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  e2.adler = r2.check = L(u2), l2 = u2 = 0, r2.mode = 11;
                case 11:
                  if (0 === r2.havedict)
                    return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, 2;
                  e2.adler = r2.check = 1, r2.mode = 12;
                case 12:
                  if (5 === t2 || 6 === t2)
                    break e;
                case 13:
                  if (r2.last) {
                    u2 >>>= 7 & l2, l2 -= 7 & l2, r2.mode = 27;
                    break;
                  }
                  for (; l2 < 3; ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  switch (r2.last = 1 & u2, l2 -= 1, 3 & (u2 >>>= 1)) {
                    case 0:
                      r2.mode = 14;
                      break;
                    case 1:
                      if (j(r2), r2.mode = 20, 6 !== t2)
                        break;
                      u2 >>>= 2, l2 -= 2;
                      break e;
                    case 2:
                      r2.mode = 17;
                      break;
                    case 3:
                      e2.msg = "invalid block type", r2.mode = 30;
                  }
                  u2 >>>= 2, l2 -= 2;
                  break;
                case 14:
                  for (u2 >>>= 7 & l2, l2 -= 7 & l2; l2 < 32; ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if ((65535 & u2) != (u2 >>> 16 ^ 65535)) {
                    e2.msg = "invalid stored block lengths", r2.mode = 30;
                    break;
                  }
                  if (r2.length = 65535 & u2, l2 = u2 = 0, r2.mode = 15, 6 === t2)
                    break e;
                case 15:
                  r2.mode = 16;
                case 16:
                  if (d = r2.length) {
                    if (o2 < d && (d = o2), h2 < d && (d = h2), 0 === d)
                      break e;
                    I.arraySet(i2, n2, s2, d, a2), o2 -= d, s2 += d, h2 -= d, a2 += d, r2.length -= d;
                    break;
                  }
                  r2.mode = 12;
                  break;
                case 17:
                  for (; l2 < 14; ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (r2.nlen = 257 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ndist = 1 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ncode = 4 + (15 & u2), u2 >>>= 4, l2 -= 4, 286 < r2.nlen || 30 < r2.ndist) {
                    e2.msg = "too many length or distance symbols", r2.mode = 30;
                    break;
                  }
                  r2.have = 0, r2.mode = 18;
                case 18:
                  for (; r2.have < r2.ncode; ) {
                    for (; l2 < 3; ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    r2.lens[A[r2.have++]] = 7 & u2, u2 >>>= 3, l2 -= 3;
                  }
                  for (; r2.have < 19; )
                    r2.lens[A[r2.have++]] = 0;
                  if (r2.lencode = r2.lendyn, r2.lenbits = 7, S = { bits: r2.lenbits }, x = T(0, r2.lens, 0, 19, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                    e2.msg = "invalid code lengths set", r2.mode = 30;
                    break;
                  }
                  r2.have = 0, r2.mode = 19;
                case 19:
                  for (; r2.have < r2.nlen + r2.ndist; ) {
                    for (; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if (b < 16)
                      u2 >>>= _, l2 -= _, r2.lens[r2.have++] = b;
                    else {
                      if (16 === b) {
                        for (z = _ + 2; l2 < z; ) {
                          if (0 === o2)
                            break e;
                          o2--, u2 += n2[s2++] << l2, l2 += 8;
                        }
                        if (u2 >>>= _, l2 -= _, 0 === r2.have) {
                          e2.msg = "invalid bit length repeat", r2.mode = 30;
                          break;
                        }
                        k = r2.lens[r2.have - 1], d = 3 + (3 & u2), u2 >>>= 2, l2 -= 2;
                      } else if (17 === b) {
                        for (z = _ + 3; l2 < z; ) {
                          if (0 === o2)
                            break e;
                          o2--, u2 += n2[s2++] << l2, l2 += 8;
                        }
                        l2 -= _, k = 0, d = 3 + (7 & (u2 >>>= _)), u2 >>>= 3, l2 -= 3;
                      } else {
                        for (z = _ + 7; l2 < z; ) {
                          if (0 === o2)
                            break e;
                          o2--, u2 += n2[s2++] << l2, l2 += 8;
                        }
                        l2 -= _, k = 0, d = 11 + (127 & (u2 >>>= _)), u2 >>>= 7, l2 -= 7;
                      }
                      if (r2.have + d > r2.nlen + r2.ndist) {
                        e2.msg = "invalid bit length repeat", r2.mode = 30;
                        break;
                      }
                      for (; d--; )
                        r2.lens[r2.have++] = k;
                    }
                  }
                  if (30 === r2.mode)
                    break;
                  if (0 === r2.lens[256]) {
                    e2.msg = "invalid code -- missing end-of-block", r2.mode = 30;
                    break;
                  }
                  if (r2.lenbits = 9, S = { bits: r2.lenbits }, x = T(D, r2.lens, 0, r2.nlen, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                    e2.msg = "invalid literal/lengths set", r2.mode = 30;
                    break;
                  }
                  if (r2.distbits = 6, r2.distcode = r2.distdyn, S = { bits: r2.distbits }, x = T(F, r2.lens, r2.nlen, r2.ndist, r2.distcode, 0, r2.work, S), r2.distbits = S.bits, x) {
                    e2.msg = "invalid distances set", r2.mode = 30;
                    break;
                  }
                  if (r2.mode = 20, 6 === t2)
                    break e;
                case 20:
                  r2.mode = 21;
                case 21:
                  if (6 <= o2 && 258 <= h2) {
                    e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, R(e2, c2), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, 12 === r2.mode && (r2.back = -1);
                    break;
                  }
                  for (r2.back = 0; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (g && 0 == (240 & g)) {
                    for (v = _, y = g, w = b; g = (C = r2.lencode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    u2 >>>= v, l2 -= v, r2.back += v;
                  }
                  if (u2 >>>= _, l2 -= _, r2.back += _, r2.length = b, 0 === g) {
                    r2.mode = 26;
                    break;
                  }
                  if (32 & g) {
                    r2.back = -1, r2.mode = 12;
                    break;
                  }
                  if (64 & g) {
                    e2.msg = "invalid literal/length code", r2.mode = 30;
                    break;
                  }
                  r2.extra = 15 & g, r2.mode = 22;
                case 22:
                  if (r2.extra) {
                    for (z = r2.extra; l2 < z; ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    r2.length += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
                  }
                  r2.was = r2.length, r2.mode = 23;
                case 23:
                  for (; g = (C = r2.distcode[u2 & (1 << r2.distbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                    if (0 === o2)
                      break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (0 == (240 & g)) {
                    for (v = _, y = g, w = b; g = (C = r2.distcode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    u2 >>>= v, l2 -= v, r2.back += v;
                  }
                  if (u2 >>>= _, l2 -= _, r2.back += _, 64 & g) {
                    e2.msg = "invalid distance code", r2.mode = 30;
                    break;
                  }
                  r2.offset = b, r2.extra = 15 & g, r2.mode = 24;
                case 24:
                  if (r2.extra) {
                    for (z = r2.extra; l2 < z; ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    r2.offset += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
                  }
                  if (r2.offset > r2.dmax) {
                    e2.msg = "invalid distance too far back", r2.mode = 30;
                    break;
                  }
                  r2.mode = 25;
                case 25:
                  if (0 === h2)
                    break e;
                  if (d = c2 - h2, r2.offset > d) {
                    if ((d = r2.offset - d) > r2.whave && r2.sane) {
                      e2.msg = "invalid distance too far back", r2.mode = 30;
                      break;
                    }
                    p = d > r2.wnext ? (d -= r2.wnext, r2.wsize - d) : r2.wnext - d, d > r2.length && (d = r2.length), m = r2.window;
                  } else
                    m = i2, p = a2 - r2.offset, d = r2.length;
                  for (h2 < d && (d = h2), h2 -= d, r2.length -= d; i2[a2++] = m[p++], --d; )
                    ;
                  0 === r2.length && (r2.mode = 21);
                  break;
                case 26:
                  if (0 === h2)
                    break e;
                  i2[a2++] = r2.length, h2--, r2.mode = 21;
                  break;
                case 27:
                  if (r2.wrap) {
                    for (; l2 < 32; ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 |= n2[s2++] << l2, l2 += 8;
                    }
                    if (c2 -= h2, e2.total_out += c2, r2.total += c2, c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, a2 - c2) : O(r2.check, i2, c2, a2 - c2)), c2 = h2, (r2.flags ? u2 : L(u2)) !== r2.check) {
                      e2.msg = "incorrect data check", r2.mode = 30;
                      break;
                    }
                    l2 = u2 = 0;
                  }
                  r2.mode = 28;
                case 28:
                  if (r2.wrap && r2.flags) {
                    for (; l2 < 32; ) {
                      if (0 === o2)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if (u2 !== (4294967295 & r2.total)) {
                      e2.msg = "incorrect length check", r2.mode = 30;
                      break;
                    }
                    l2 = u2 = 0;
                  }
                  r2.mode = 29;
                case 29:
                  x = 1;
                  break e;
                case 30:
                  x = -3;
                  break e;
                case 31:
                  return -4;
                case 32:
                default:
                  return U;
              }
          return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, (r2.wsize || c2 !== e2.avail_out && r2.mode < 30 && (r2.mode < 27 || 4 !== t2)) && Z(e2, e2.output, e2.next_out, c2 - e2.avail_out) ? (r2.mode = 31, -4) : (f2 -= e2.avail_in, c2 -= e2.avail_out, e2.total_in += f2, e2.total_out += c2, r2.total += c2, r2.wrap && c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, e2.next_out - c2) : O(r2.check, i2, c2, e2.next_out - c2)), e2.data_type = r2.bits + (r2.last ? 64 : 0) + (12 === r2.mode ? 128 : 0) + (20 === r2.mode || 15 === r2.mode ? 256 : 0), (0 == f2 && 0 === c2 || 4 === t2) && x === N && (x = -5), x);
        }, r.inflateEnd = function(e2) {
          if (!e2 || !e2.state)
            return U;
          var t2 = e2.state;
          return t2.window && (t2.window = null), e2.state = null, N;
        }, r.inflateGetHeader = function(e2, t2) {
          var r2;
          return e2 && e2.state ? 0 == (2 & (r2 = e2.state).wrap) ? U : ((r2.head = t2).done = false, N) : U;
        }, r.inflateSetDictionary = function(e2, t2) {
          var r2, n2 = t2.length;
          return e2 && e2.state ? 0 !== (r2 = e2.state).wrap && 11 !== r2.mode ? U : 11 === r2.mode && O(1, t2, n2, 0) !== r2.check ? -3 : Z(e2, t2, n2, n2) ? (r2.mode = 31, -4) : (r2.havedict = 1, N) : U;
        }, r.inflateInfo = "pako inflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./inffast": 48, "./inftrees": 50 }], 50: [function(e, t, r) {
        "use strict";
        var D = e("../utils/common"), F = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], N = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], U = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], P = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
        t.exports = function(e2, t2, r2, n, i, s, a, o) {
          var h, u, l, f, c, d, p, m, _, g = o.bits, b = 0, v = 0, y = 0, w = 0, k = 0, x = 0, S = 0, z = 0, C = 0, E = 0, A = null, I = 0, O = new D.Buf16(16), B = new D.Buf16(16), R = null, T = 0;
          for (b = 0; b <= 15; b++)
            O[b] = 0;
          for (v = 0; v < n; v++)
            O[t2[r2 + v]]++;
          for (k = g, w = 15; 1 <= w && 0 === O[w]; w--)
            ;
          if (w < k && (k = w), 0 === w)
            return i[s++] = 20971520, i[s++] = 20971520, o.bits = 1, 0;
          for (y = 1; y < w && 0 === O[y]; y++)
            ;
          for (k < y && (k = y), b = z = 1; b <= 15; b++)
            if (z <<= 1, (z -= O[b]) < 0)
              return -1;
          if (0 < z && (0 === e2 || 1 !== w))
            return -1;
          for (B[1] = 0, b = 1; b < 15; b++)
            B[b + 1] = B[b] + O[b];
          for (v = 0; v < n; v++)
            0 !== t2[r2 + v] && (a[B[t2[r2 + v]]++] = v);
          if (d = 0 === e2 ? (A = R = a, 19) : 1 === e2 ? (A = F, I -= 257, R = N, T -= 257, 256) : (A = U, R = P, -1), b = y, c = s, S = v = E = 0, l = -1, f = (C = 1 << (x = k)) - 1, 1 === e2 && 852 < C || 2 === e2 && 592 < C)
            return 1;
          for (; ; ) {
            for (p = b - S, _ = a[v] < d ? (m = 0, a[v]) : a[v] > d ? (m = R[T + a[v]], A[I + a[v]]) : (m = 96, 0), h = 1 << b - S, y = u = 1 << x; i[c + (E >> S) + (u -= h)] = p << 24 | m << 16 | _ | 0, 0 !== u; )
              ;
            for (h = 1 << b - 1; E & h; )
              h >>= 1;
            if (0 !== h ? (E &= h - 1, E += h) : E = 0, v++, 0 == --O[b]) {
              if (b === w)
                break;
              b = t2[r2 + a[v]];
            }
            if (k < b && (E & f) !== l) {
              for (0 === S && (S = k), c += y, z = 1 << (x = b - S); x + S < w && !((z -= O[x + S]) <= 0); )
                x++, z <<= 1;
              if (C += 1 << x, 1 === e2 && 852 < C || 2 === e2 && 592 < C)
                return 1;
              i[l = E & f] = k << 24 | x << 16 | c - s | 0;
            }
          }
          return 0 !== E && (i[c + E] = b - S << 24 | 64 << 16 | 0), o.bits = k, 0;
        };
      }, { "../utils/common": 41 }], 51: [function(e, t, r) {
        "use strict";
        t.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
      }, {}], 52: [function(e, t, r) {
        "use strict";
        var i = e("../utils/common"), o = 0, h = 1;
        function n(e2) {
          for (var t2 = e2.length; 0 <= --t2; )
            e2[t2] = 0;
        }
        var s = 0, a = 29, u = 256, l = u + 1 + a, f = 30, c = 19, _ = 2 * l + 1, g = 15, d = 16, p = 7, m = 256, b = 16, v = 17, y = 18, w = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], k = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7], S = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], z = new Array(2 * (l + 2));
        n(z);
        var C = new Array(2 * f);
        n(C);
        var E = new Array(512);
        n(E);
        var A = new Array(256);
        n(A);
        var I = new Array(a);
        n(I);
        var O, B, R, T = new Array(f);
        function D(e2, t2, r2, n2, i2) {
          this.static_tree = e2, this.extra_bits = t2, this.extra_base = r2, this.elems = n2, this.max_length = i2, this.has_stree = e2 && e2.length;
        }
        function F(e2, t2) {
          this.dyn_tree = e2, this.max_code = 0, this.stat_desc = t2;
        }
        function N(e2) {
          return e2 < 256 ? E[e2] : E[256 + (e2 >>> 7)];
        }
        function U(e2, t2) {
          e2.pending_buf[e2.pending++] = 255 & t2, e2.pending_buf[e2.pending++] = t2 >>> 8 & 255;
        }
        function P(e2, t2, r2) {
          e2.bi_valid > d - r2 ? (e2.bi_buf |= t2 << e2.bi_valid & 65535, U(e2, e2.bi_buf), e2.bi_buf = t2 >> d - e2.bi_valid, e2.bi_valid += r2 - d) : (e2.bi_buf |= t2 << e2.bi_valid & 65535, e2.bi_valid += r2);
        }
        function L(e2, t2, r2) {
          P(e2, r2[2 * t2], r2[2 * t2 + 1]);
        }
        function j(e2, t2) {
          for (var r2 = 0; r2 |= 1 & e2, e2 >>>= 1, r2 <<= 1, 0 < --t2; )
            ;
          return r2 >>> 1;
        }
        function Z(e2, t2, r2) {
          var n2, i2, s2 = new Array(g + 1), a2 = 0;
          for (n2 = 1; n2 <= g; n2++)
            s2[n2] = a2 = a2 + r2[n2 - 1] << 1;
          for (i2 = 0; i2 <= t2; i2++) {
            var o2 = e2[2 * i2 + 1];
            0 !== o2 && (e2[2 * i2] = j(s2[o2]++, o2));
          }
        }
        function W(e2) {
          var t2;
          for (t2 = 0; t2 < l; t2++)
            e2.dyn_ltree[2 * t2] = 0;
          for (t2 = 0; t2 < f; t2++)
            e2.dyn_dtree[2 * t2] = 0;
          for (t2 = 0; t2 < c; t2++)
            e2.bl_tree[2 * t2] = 0;
          e2.dyn_ltree[2 * m] = 1, e2.opt_len = e2.static_len = 0, e2.last_lit = e2.matches = 0;
        }
        function M(e2) {
          8 < e2.bi_valid ? U(e2, e2.bi_buf) : 0 < e2.bi_valid && (e2.pending_buf[e2.pending++] = e2.bi_buf), e2.bi_buf = 0, e2.bi_valid = 0;
        }
        function H(e2, t2, r2, n2) {
          var i2 = 2 * t2, s2 = 2 * r2;
          return e2[i2] < e2[s2] || e2[i2] === e2[s2] && n2[t2] <= n2[r2];
        }
        function G(e2, t2, r2) {
          for (var n2 = e2.heap[r2], i2 = r2 << 1; i2 <= e2.heap_len && (i2 < e2.heap_len && H(t2, e2.heap[i2 + 1], e2.heap[i2], e2.depth) && i2++, !H(t2, n2, e2.heap[i2], e2.depth)); )
            e2.heap[r2] = e2.heap[i2], r2 = i2, i2 <<= 1;
          e2.heap[r2] = n2;
        }
        function K2(e2, t2, r2) {
          var n2, i2, s2, a2, o2 = 0;
          if (0 !== e2.last_lit)
            for (; n2 = e2.pending_buf[e2.d_buf + 2 * o2] << 8 | e2.pending_buf[e2.d_buf + 2 * o2 + 1], i2 = e2.pending_buf[e2.l_buf + o2], o2++, 0 === n2 ? L(e2, i2, t2) : (L(e2, (s2 = A[i2]) + u + 1, t2), 0 !== (a2 = w[s2]) && P(e2, i2 -= I[s2], a2), L(e2, s2 = N(--n2), r2), 0 !== (a2 = k[s2]) && P(e2, n2 -= T[s2], a2)), o2 < e2.last_lit; )
              ;
          L(e2, m, t2);
        }
        function Y(e2, t2) {
          var r2, n2, i2, s2 = t2.dyn_tree, a2 = t2.stat_desc.static_tree, o2 = t2.stat_desc.has_stree, h2 = t2.stat_desc.elems, u2 = -1;
          for (e2.heap_len = 0, e2.heap_max = _, r2 = 0; r2 < h2; r2++)
            0 !== s2[2 * r2] ? (e2.heap[++e2.heap_len] = u2 = r2, e2.depth[r2] = 0) : s2[2 * r2 + 1] = 0;
          for (; e2.heap_len < 2; )
            s2[2 * (i2 = e2.heap[++e2.heap_len] = u2 < 2 ? ++u2 : 0)] = 1, e2.depth[i2] = 0, e2.opt_len--, o2 && (e2.static_len -= a2[2 * i2 + 1]);
          for (t2.max_code = u2, r2 = e2.heap_len >> 1; 1 <= r2; r2--)
            G(e2, s2, r2);
          for (i2 = h2; r2 = e2.heap[1], e2.heap[1] = e2.heap[e2.heap_len--], G(e2, s2, 1), n2 = e2.heap[1], e2.heap[--e2.heap_max] = r2, e2.heap[--e2.heap_max] = n2, s2[2 * i2] = s2[2 * r2] + s2[2 * n2], e2.depth[i2] = (e2.depth[r2] >= e2.depth[n2] ? e2.depth[r2] : e2.depth[n2]) + 1, s2[2 * r2 + 1] = s2[2 * n2 + 1] = i2, e2.heap[1] = i2++, G(e2, s2, 1), 2 <= e2.heap_len; )
            ;
          e2.heap[--e2.heap_max] = e2.heap[1], function(e3, t3) {
            var r3, n3, i3, s3, a3, o3, h3 = t3.dyn_tree, u3 = t3.max_code, l2 = t3.stat_desc.static_tree, f2 = t3.stat_desc.has_stree, c2 = t3.stat_desc.extra_bits, d2 = t3.stat_desc.extra_base, p2 = t3.stat_desc.max_length, m2 = 0;
            for (s3 = 0; s3 <= g; s3++)
              e3.bl_count[s3] = 0;
            for (h3[2 * e3.heap[e3.heap_max] + 1] = 0, r3 = e3.heap_max + 1; r3 < _; r3++)
              p2 < (s3 = h3[2 * h3[2 * (n3 = e3.heap[r3]) + 1] + 1] + 1) && (s3 = p2, m2++), h3[2 * n3 + 1] = s3, u3 < n3 || (e3.bl_count[s3]++, a3 = 0, d2 <= n3 && (a3 = c2[n3 - d2]), o3 = h3[2 * n3], e3.opt_len += o3 * (s3 + a3), f2 && (e3.static_len += o3 * (l2[2 * n3 + 1] + a3)));
            if (0 !== m2) {
              do {
                for (s3 = p2 - 1; 0 === e3.bl_count[s3]; )
                  s3--;
                e3.bl_count[s3]--, e3.bl_count[s3 + 1] += 2, e3.bl_count[p2]--, m2 -= 2;
              } while (0 < m2);
              for (s3 = p2; 0 !== s3; s3--)
                for (n3 = e3.bl_count[s3]; 0 !== n3; )
                  u3 < (i3 = e3.heap[--r3]) || (h3[2 * i3 + 1] !== s3 && (e3.opt_len += (s3 - h3[2 * i3 + 1]) * h3[2 * i3], h3[2 * i3 + 1] = s3), n3--);
            }
          }(e2, t2), Z(s2, u2, e2.bl_count);
        }
        function X(e2, t2, r2) {
          var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
          for (0 === a2 && (h2 = 138, u2 = 3), t2[2 * (r2 + 1) + 1] = 65535, n2 = 0; n2 <= r2; n2++)
            i2 = a2, a2 = t2[2 * (n2 + 1) + 1], ++o2 < h2 && i2 === a2 || (o2 < u2 ? e2.bl_tree[2 * i2] += o2 : 0 !== i2 ? (i2 !== s2 && e2.bl_tree[2 * i2]++, e2.bl_tree[2 * b]++) : o2 <= 10 ? e2.bl_tree[2 * v]++ : e2.bl_tree[2 * y]++, s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4));
        }
        function V(e2, t2, r2) {
          var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
          for (0 === a2 && (h2 = 138, u2 = 3), n2 = 0; n2 <= r2; n2++)
            if (i2 = a2, a2 = t2[2 * (n2 + 1) + 1], !(++o2 < h2 && i2 === a2)) {
              if (o2 < u2)
                for (; L(e2, i2, e2.bl_tree), 0 != --o2; )
                  ;
              else
                0 !== i2 ? (i2 !== s2 && (L(e2, i2, e2.bl_tree), o2--), L(e2, b, e2.bl_tree), P(e2, o2 - 3, 2)) : o2 <= 10 ? (L(e2, v, e2.bl_tree), P(e2, o2 - 3, 3)) : (L(e2, y, e2.bl_tree), P(e2, o2 - 11, 7));
              s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4);
            }
        }
        n(T);
        var q = false;
        function J(e2, t2, r2, n2) {
          P(e2, (s << 1) + (n2 ? 1 : 0), 3), function(e3, t3, r3, n3) {
            M(e3), n3 && (U(e3, r3), U(e3, ~r3)), i.arraySet(e3.pending_buf, e3.window, t3, r3, e3.pending), e3.pending += r3;
          }(e2, t2, r2, true);
        }
        r._tr_init = function(e2) {
          q || (function() {
            var e3, t2, r2, n2, i2, s2 = new Array(g + 1);
            for (n2 = r2 = 0; n2 < a - 1; n2++)
              for (I[n2] = r2, e3 = 0; e3 < 1 << w[n2]; e3++)
                A[r2++] = n2;
            for (A[r2 - 1] = n2, n2 = i2 = 0; n2 < 16; n2++)
              for (T[n2] = i2, e3 = 0; e3 < 1 << k[n2]; e3++)
                E[i2++] = n2;
            for (i2 >>= 7; n2 < f; n2++)
              for (T[n2] = i2 << 7, e3 = 0; e3 < 1 << k[n2] - 7; e3++)
                E[256 + i2++] = n2;
            for (t2 = 0; t2 <= g; t2++)
              s2[t2] = 0;
            for (e3 = 0; e3 <= 143; )
              z[2 * e3 + 1] = 8, e3++, s2[8]++;
            for (; e3 <= 255; )
              z[2 * e3 + 1] = 9, e3++, s2[9]++;
            for (; e3 <= 279; )
              z[2 * e3 + 1] = 7, e3++, s2[7]++;
            for (; e3 <= 287; )
              z[2 * e3 + 1] = 8, e3++, s2[8]++;
            for (Z(z, l + 1, s2), e3 = 0; e3 < f; e3++)
              C[2 * e3 + 1] = 5, C[2 * e3] = j(e3, 5);
            O = new D(z, w, u + 1, l, g), B = new D(C, k, 0, f, g), R = new D(new Array(0), x, 0, c, p);
          }(), q = true), e2.l_desc = new F(e2.dyn_ltree, O), e2.d_desc = new F(e2.dyn_dtree, B), e2.bl_desc = new F(e2.bl_tree, R), e2.bi_buf = 0, e2.bi_valid = 0, W(e2);
        }, r._tr_stored_block = J, r._tr_flush_block = function(e2, t2, r2, n2) {
          var i2, s2, a2 = 0;
          0 < e2.level ? (2 === e2.strm.data_type && (e2.strm.data_type = function(e3) {
            var t3, r3 = 4093624447;
            for (t3 = 0; t3 <= 31; t3++, r3 >>>= 1)
              if (1 & r3 && 0 !== e3.dyn_ltree[2 * t3])
                return o;
            if (0 !== e3.dyn_ltree[18] || 0 !== e3.dyn_ltree[20] || 0 !== e3.dyn_ltree[26])
              return h;
            for (t3 = 32; t3 < u; t3++)
              if (0 !== e3.dyn_ltree[2 * t3])
                return h;
            return o;
          }(e2)), Y(e2, e2.l_desc), Y(e2, e2.d_desc), a2 = function(e3) {
            var t3;
            for (X(e3, e3.dyn_ltree, e3.l_desc.max_code), X(e3, e3.dyn_dtree, e3.d_desc.max_code), Y(e3, e3.bl_desc), t3 = c - 1; 3 <= t3 && 0 === e3.bl_tree[2 * S[t3] + 1]; t3--)
              ;
            return e3.opt_len += 3 * (t3 + 1) + 5 + 5 + 4, t3;
          }(e2), i2 = e2.opt_len + 3 + 7 >>> 3, (s2 = e2.static_len + 3 + 7 >>> 3) <= i2 && (i2 = s2)) : i2 = s2 = r2 + 5, r2 + 4 <= i2 && -1 !== t2 ? J(e2, t2, r2, n2) : 4 === e2.strategy || s2 === i2 ? (P(e2, 2 + (n2 ? 1 : 0), 3), K2(e2, z, C)) : (P(e2, 4 + (n2 ? 1 : 0), 3), function(e3, t3, r3, n3) {
            var i3;
            for (P(e3, t3 - 257, 5), P(e3, r3 - 1, 5), P(e3, n3 - 4, 4), i3 = 0; i3 < n3; i3++)
              P(e3, e3.bl_tree[2 * S[i3] + 1], 3);
            V(e3, e3.dyn_ltree, t3 - 1), V(e3, e3.dyn_dtree, r3 - 1);
          }(e2, e2.l_desc.max_code + 1, e2.d_desc.max_code + 1, a2 + 1), K2(e2, e2.dyn_ltree, e2.dyn_dtree)), W(e2), n2 && M(e2);
        }, r._tr_tally = function(e2, t2, r2) {
          return e2.pending_buf[e2.d_buf + 2 * e2.last_lit] = t2 >>> 8 & 255, e2.pending_buf[e2.d_buf + 2 * e2.last_lit + 1] = 255 & t2, e2.pending_buf[e2.l_buf + e2.last_lit] = 255 & r2, e2.last_lit++, 0 === t2 ? e2.dyn_ltree[2 * r2]++ : (e2.matches++, t2--, e2.dyn_ltree[2 * (A[r2] + u + 1)]++, e2.dyn_dtree[2 * N(t2)]++), e2.last_lit === e2.lit_bufsize - 1;
        }, r._tr_align = function(e2) {
          P(e2, 2, 3), L(e2, m, z), function(e3) {
            16 === e3.bi_valid ? (U(e3, e3.bi_buf), e3.bi_buf = 0, e3.bi_valid = 0) : 8 <= e3.bi_valid && (e3.pending_buf[e3.pending++] = 255 & e3.bi_buf, e3.bi_buf >>= 8, e3.bi_valid -= 8);
          }(e2);
        };
      }, { "../utils/common": 41 }], 53: [function(e, t, r) {
        "use strict";
        t.exports = function() {
          this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
        };
      }, {}], 54: [function(e, t, r) {
        (function(e2) {
          !function(r2, n) {
            "use strict";
            if (!r2.setImmediate) {
              var i, s, t2, a, o = 1, h = {}, u = false, l = r2.document, e3 = Object.getPrototypeOf && Object.getPrototypeOf(r2);
              e3 = e3 && e3.setTimeout ? e3 : r2, i = "[object process]" === {}.toString.call(r2.process) ? function(e4) {
                process.nextTick(function() {
                  c(e4);
                });
              } : function() {
                if (r2.postMessage && !r2.importScripts) {
                  var e4 = true, t3 = r2.onmessage;
                  return r2.onmessage = function() {
                    e4 = false;
                  }, r2.postMessage("", "*"), r2.onmessage = t3, e4;
                }
              }() ? (a = "setImmediate$" + Math.random() + "$", r2.addEventListener ? r2.addEventListener("message", d, false) : r2.attachEvent("onmessage", d), function(e4) {
                r2.postMessage(a + e4, "*");
              }) : r2.MessageChannel ? ((t2 = new MessageChannel()).port1.onmessage = function(e4) {
                c(e4.data);
              }, function(e4) {
                t2.port2.postMessage(e4);
              }) : l && "onreadystatechange" in l.createElement("script") ? (s = l.documentElement, function(e4) {
                var t3 = l.createElement("script");
                t3.onreadystatechange = function() {
                  c(e4), t3.onreadystatechange = null, s.removeChild(t3), t3 = null;
                }, s.appendChild(t3);
              }) : function(e4) {
                setTimeout(c, 0, e4);
              }, e3.setImmediate = function(e4) {
                "function" != typeof e4 && (e4 = new Function("" + e4));
                for (var t3 = new Array(arguments.length - 1), r3 = 0; r3 < t3.length; r3++)
                  t3[r3] = arguments[r3 + 1];
                var n2 = { callback: e4, args: t3 };
                return h[o] = n2, i(o), o++;
              }, e3.clearImmediate = f;
            }
            function f(e4) {
              delete h[e4];
            }
            function c(e4) {
              if (u)
                setTimeout(c, 0, e4);
              else {
                var t3 = h[e4];
                if (t3) {
                  u = true;
                  try {
                    !function(e5) {
                      var t4 = e5.callback, r3 = e5.args;
                      switch (r3.length) {
                        case 0:
                          t4();
                          break;
                        case 1:
                          t4(r3[0]);
                          break;
                        case 2:
                          t4(r3[0], r3[1]);
                          break;
                        case 3:
                          t4(r3[0], r3[1], r3[2]);
                          break;
                        default:
                          t4.apply(n, r3);
                      }
                    }(t3);
                  } finally {
                    f(e4), u = false;
                  }
                }
              }
            }
            function d(e4) {
              e4.source === r2 && "string" == typeof e4.data && 0 === e4.data.indexOf(a) && c(+e4.data.slice(a.length));
            }
          }("undefined" == typeof self ? void 0 === e2 ? this : e2 : self);
        }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
      }, {}] }, {}, [10])(10);
    });
  }
});

// node_modules/file-saver/dist/FileSaver.min.js
var require_FileSaver_min = __commonJS({
  "node_modules/file-saver/dist/FileSaver.min.js"(exports, module2) {
    (function(a, b) {
      if ("function" == typeof define && define.amd)
        define([], b);
      else if ("undefined" != typeof exports)
        b();
      else {
        b(), a.FileSaver = { exports: {} }.exports;
      }
    })(exports, function() {
      "use strict";
      function b(a2, b3) {
        return "undefined" == typeof b3 ? b3 = { autoBom: false } : "object" != typeof b3 && (console.warn("Deprecated: Expected third argument to be a object"), b3 = { autoBom: !b3 }), b3.autoBom && /^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(a2.type) ? new Blob(["\uFEFF", a2], { type: a2.type }) : a2;
      }
      function c(a2, b3, c2) {
        var d2 = new XMLHttpRequest();
        d2.open("GET", a2), d2.responseType = "blob", d2.onload = function() {
          g(d2.response, b3, c2);
        }, d2.onerror = function() {
          console.error("could not download file");
        }, d2.send();
      }
      function d(a2) {
        var b3 = new XMLHttpRequest();
        b3.open("HEAD", a2, false);
        try {
          b3.send();
        } catch (a3) {
        }
        return 200 <= b3.status && 299 >= b3.status;
      }
      function e(a2) {
        try {
          a2.dispatchEvent(new MouseEvent("click"));
        } catch (c2) {
          var b3 = document.createEvent("MouseEvents");
          b3.initMouseEvent("click", true, true, window, 0, 0, 0, 80, 20, false, false, false, false, 0, null), a2.dispatchEvent(b3);
        }
      }
      var f = "object" == typeof window && window.window === window ? window : "object" == typeof self && self.self === self ? self : "object" == typeof global && global.global === global ? global : void 0, a = f.navigator && /Macintosh/.test(navigator.userAgent) && /AppleWebKit/.test(navigator.userAgent) && !/Safari/.test(navigator.userAgent), g = f.saveAs || ("object" != typeof window || window !== f ? function() {
      } : "download" in HTMLAnchorElement.prototype && !a ? function(b3, g2, h) {
        var i = f.URL || f.webkitURL, j = document.createElement("a");
        g2 = g2 || b3.name || "download", j.download = g2, j.rel = "noopener", "string" == typeof b3 ? (j.href = b3, j.origin === location.origin ? e(j) : d(j.href) ? c(b3, g2, h) : e(j, j.target = "_blank")) : (j.href = i.createObjectURL(b3), setTimeout(function() {
          i.revokeObjectURL(j.href);
        }, 4e4), setTimeout(function() {
          e(j);
        }, 0));
      } : "msSaveOrOpenBlob" in navigator ? function(f2, g2, h) {
        if (g2 = g2 || f2.name || "download", "string" != typeof f2)
          navigator.msSaveOrOpenBlob(b(f2, h), g2);
        else if (d(f2))
          c(f2, g2, h);
        else {
          var i = document.createElement("a");
          i.href = f2, i.target = "_blank", setTimeout(function() {
            e(i);
          });
        }
      } : function(b3, d2, e2, g2) {
        if (g2 = g2 || open("", "_blank"), g2 && (g2.document.title = g2.document.body.innerText = "downloading..."), "string" == typeof b3)
          return c(b3, d2, e2);
        var h = "application/octet-stream" === b3.type, i = /constructor/i.test(f.HTMLElement) || f.safari, j = /CriOS\/[\d]+/.test(navigator.userAgent);
        if ((j || h && i || a) && "undefined" != typeof FileReader) {
          var k = new FileReader();
          k.onloadend = function() {
            var a2 = k.result;
            a2 = j ? a2 : a2.replace(/^data:[^;]*;/, "data:attachment/file;"), g2 ? g2.location.href = a2 : location = a2, g2 = null;
          }, k.readAsDataURL(b3);
        } else {
          var l = f.URL || f.webkitURL, m = l.createObjectURL(b3);
          g2 ? g2.location = m : location.href = m, g2 = null, setTimeout(function() {
            l.revokeObjectURL(m);
          }, 4e4);
        }
      });
      f.saveAs = g.saveAs = g, "undefined" != typeof module2 && (module2.exports = g);
    });
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TablifyPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian15 = require("obsidian");

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
      var err3 = new Error(ed[0]);
      err3["code"] = ed[1];
      err3.stack = ed[2];
      cb(err3, null);
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
  var w = wrkr(fns, init, id, function(err3, dat2) {
    w.terminate();
    cb(err3, dat2);
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
    forEach(row, "c", function(cell2) {
      cells.push(cell2);
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
  var daysBeforeUnixEpoch2 = JANUARY_0TH_1900_DAY + ERRONEOUS_FEBRUARY_29_1990_DAY + (1970 - 1900) * DAYS_IN_YEAR + NUMBER_OF_LEAP_YEARS_BETWEEN_1900_AND_1970;
  return new Date(Math.floor((excelSerialDate - daysBeforeUnixEpoch2) * DAY));
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
  var allRows = cells.map(function(cell2) {
    return cell2.row;
  }).sort(comparator);
  var allCols = cells.map(function(cell2) {
    return cell2.column;
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
      var cell2 = _step.value;
      if (accessor(cell2) !== null) {
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
    var cell2 = _step.value;
    var rowIndex = cell2.row - 1;
    var columnIndex = cell2.column - 1;
    if (columnIndex < colsCount && rowIndex < rowsCount) {
      data[rowIndex][columnIndex] = cell2.value;
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
    rows: s.data.map((row) => row.map((cell2) => cell2 === void 0 ? null : cell2))
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
    let day2;
    let month;
    if (a > 12 && b <= 12) {
      day2 = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day2 = b;
      month = a;
    } else {
      return null;
    }
    return validYMD(y, month, day2) ? ymd(y, month, day2) : null;
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
    ...view.warnings ? { warnings: [...view.warnings] } : {},
    // SAD-69: search and query are persisted view state. They are copied conditionally —
    // an unconditional `search: view.search` would give every view written before this
    // change two extra keys on its next save and break byte-identical round-trips.
    ...view.search !== void 0 ? { search: view.search } : {},
    ...view.query !== void 0 && view.query !== null ? { query: view.query } : {}
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

// src/format/syncSchema.ts
var AIRTABLE_BASE_ID = /^app[A-Za-z0-9]+$/;
var AIRTABLE_TABLE_ID = /^tbl[A-Za-z0-9]+$/;
var AIRTABLE_RECORD_ID = /^rec[A-Za-z0-9]+$/;
var AIRTABLE_FIELD_ID = /^fld[A-Za-z0-9]+$/;
var SHA256_HEX = /^[0-9a-f]{64}$/;
var CONFLICT_KINDS = ["both_changed", "remote_deleted"];
var CONFLICT_DECISIONS = ["keep_local", "keep_remote", "keep_both"];
var SYNC_DIRECTIONS = ["link", "pull", "push"];
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isIsoDate(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}
function isNonNegativeInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function validateRowSync(value) {
  if (value === null)
    return null;
  if (!isPlainObject(value))
    return "must be null or an object";
  if (typeof value.airtableId !== "string" || !AIRTABLE_RECORD_ID.test(value.airtableId)) {
    return "airtableId must be an Airtable record ID (rec\u2026)";
  }
  if (!isNonNegativeInteger(value.syncedRev))
    return "syncedRev must be a non-negative integer";
  if (!isIsoDate(value.syncedAt))
    return "syncedAt must be an ISO 8601 date string";
  if (typeof value.remoteHash !== "string" || !SHA256_HEX.test(value.remoteHash)) {
    return "remoteHash must be a 64-character lowercase hex SHA-256";
  }
  if ("remoteDeleted" in value && typeof value.remoteDeleted !== "boolean") {
    return "remoteDeleted must be a boolean when present";
  }
  if ("conflict" in value && value.conflict !== null && value.conflict !== void 0) {
    const c = value.conflict;
    if (!isPlainObject(c))
      return "conflict must be null or an object";
    if (!CONFLICT_KINDS.includes(c.kind)) {
      return `conflict.kind must be one of ${CONFLICT_KINDS.join(", ")}`;
    }
    if (!CONFLICT_DECISIONS.includes(c.decision)) {
      return `conflict.decision must be one of ${CONFLICT_DECISIONS.join(", ")}`;
    }
    if (!isNonNegativeInteger(c.localRev))
      return "conflict.localRev must be a non-negative integer";
    if (c.remoteHash !== null && (typeof c.remoteHash !== "string" || !SHA256_HEX.test(c.remoteHash))) {
      return "conflict.remoteHash must be null or a 64-character lowercase hex SHA-256";
    }
    if (!isIsoDate(c.decidedAt))
      return "conflict.decidedAt must be an ISO 8601 date string";
  }
  return null;
}
function validateSyncLink(value) {
  if (value === null)
    return null;
  if (!isPlainObject(value))
    return "must be null or an object";
  if (typeof value.baseId !== "string" || !AIRTABLE_BASE_ID.test(value.baseId)) {
    return "baseId must be an Airtable base ID (app\u2026)";
  }
  if (typeof value.tableId !== "string" || !AIRTABLE_TABLE_ID.test(value.tableId)) {
    return "tableId must be an Airtable table ID (tbl\u2026)";
  }
  if (typeof value.tableName !== "string")
    return "tableName must be a string";
  if (!isIsoDate(value.linkedAt))
    return "linkedAt must be an ISO 8601 date string";
  if (value.lastSync !== null && value.lastSync !== void 0) {
    const s = value.lastSync;
    if (!isPlainObject(s))
      return "lastSync must be null or an object";
    if (!isIsoDate(s.at))
      return "lastSync.at must be an ISO 8601 date string";
    if (!SYNC_DIRECTIONS.includes(s.direction)) {
      return `lastSync.direction must be one of ${SYNC_DIRECTIONS.join(", ")}`;
    }
    if (typeof s.ok !== "boolean")
      return "lastSync.ok must be a boolean";
    if (typeof s.summary !== "string")
      return "lastSync.summary must be a string";
  }
  if (!Array.isArray(value.records))
    return "records must be an array";
  const seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < value.records.length; i++) {
    const r = value.records[i];
    if (!isPlainObject(r))
      return `records[${i}] must be an object`;
    if (typeof r.airtableId !== "string" || !AIRTABLE_RECORD_ID.test(r.airtableId)) {
      return `records[${i}].airtableId must be an Airtable record ID (rec\u2026)`;
    }
    if (seen.has(r.airtableId))
      return `records[${i}].airtableId is duplicated`;
    seen.add(r.airtableId);
    if (typeof r.remoteHash !== "string" || !SHA256_HEX.test(r.remoteHash)) {
      return `records[${i}].remoteHash must be a 64-character lowercase hex SHA-256`;
    }
  }
  return null;
}
function validateFieldAirtableMeta(value) {
  if (value === null || value === void 0)
    return null;
  if (!isPlainObject(value))
    return "must be null or an object";
  if (typeof value.id !== "string" || !AIRTABLE_FIELD_ID.test(value.id)) {
    return "id must be an Airtable field ID (fld\u2026)";
  }
  if (typeof value.type !== "string" || value.type.length === 0)
    return "type must be a non-empty string";
  if (typeof value.readOnly !== "boolean")
    return "readOnly must be a boolean";
  return null;
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
  if (obj.formatVersion !== 1 && obj.formatVersion !== 2) {
    return {
      ok: false,
      error: `Unsupported formatVersion: ${JSON.stringify(obj.formatVersion)}. Expected 1 or 2.`
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
    if ((field.type === "formula" || field.type === "link") && obj.formatVersion !== 2) {
      return { ok: false, error: `fields[${i}].type "${field.type}" requires formatVersion 2` };
    }
    if (field.formula !== void 0 && typeof field.formula !== "string") {
      return { ok: false, error: `fields[${i}].formula must be a string` };
    }
    if (field.linkTableId !== void 0 && typeof field.linkTableId !== "string") {
      return { ok: false, error: `fields[${i}].linkTableId must be a string` };
    }
    const airtableErr = validateFieldAirtableMeta(field.airtable);
    if (airtableErr) {
      return { ok: false, error: `fields[${i}].airtable: ${airtableErr}` };
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
    if (!("sync" in row)) {
      return { ok: false, error: `rows[${i}].sync is required (null or a sync object)` };
    }
    const syncErr = validateRowSync(row.sync);
    if (syncErr) {
      return { ok: false, error: `rows[${i}].sync: ${syncErr}` };
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
        warnings: Array.isArray(v.warnings) ? v.warnings : [],
        // SAD-69: persisted search/query. Kept here (rather than relying on the
        // "preserve unknown keys" loop below) so validateView carries them and every
        // downstream reader sees them as first-class view state. Non-strings are left out;
        // the loop below still preserves the raw value so nothing is lost on round-trip.
        ...typeof v.search === "string" ? { search: v.search } : {},
        ...typeof v.query === "string" ? { query: v.query } : {}
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
  const syncLinkErr = validateSyncLink(obj.syncLink);
  if (syncLinkErr) {
    return { ok: false, error: `syncLink: ${syncLinkErr}` };
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
function formatVersionFor(file) {
  const needsV2 = file.fields.some((f) => f.type === "formula" || f.type === "link");
  if (needsV2)
    return 2;
  return file.formatVersion === 2 ? 2 : 1;
}
var FIELD_KEYS = ["id", "name", "type", "primary", "options", "required", "unique", "min", "max", "regex", "formula", "linkTableId", "airtable"];
var ROW_KEYS = ["id", "rev", "createdAt", "updatedAt", "values", "sync"];
var VIEW_KEYS = ["id", "name", "sort", "groupBy", "hidden", "frozenColumns", "rowHeight", "columnWidths", "columnOrder", "warnings", "search", "query"];
var ROW_SYNC_KEYS = ["airtableId", "syncedRev", "syncedAt", "remoteHash", "remoteDeleted", "conflict"];
var SYNC_LINK_KEYS = ["baseId", "tableId", "tableName", "linkedAt", "lastSync", "records"];
var OPTION_KEYS = ["id", "name", "color"];
function orderTopLevel(file) {
  const result = {};
  const sanitizedViews = file.views ? sanitizeViewsForSave(file.views, file.fields) : file.views;
  for (const key of TOP_LEVEL_KEYS) {
    if (key in file) {
      if (key === "formatVersion") {
        result[key] = formatVersionFor(file);
      } else if (key === "fields") {
        result[key] = file.fields.map(orderField);
      } else if (key === "rows") {
        result[key] = file.rows.map(orderRow);
      } else if (key === "views") {
        result[key] = sanitizedViews.map(orderView);
      } else if (key === "syncLink" && file.syncLink) {
        result[key] = orderOrdered(file.syncLink, SYNC_LINK_KEYS);
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
      } else if (key === "airtable" && field.airtable) {
        result[key] = orderOrdered(field.airtable, ["id", "type", "readOnly"]);
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
      if (key === "sync" && row.sync) {
        result[key] = orderOrdered(row.sync, ROW_SYNC_KEYS);
      } else {
        result[key] = row[key];
      }
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
function orderOrdered(source, keys) {
  const result = {};
  for (const key of keys) {
    if (key in source)
      result[key] = source[key];
  }
  for (const key of Object.keys(source)) {
    if (!keys.includes(key))
      result[key] = source[key];
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

// src/model/fieldTypes/formula.ts
var formulaType = {
  readOnly: true,
  validate(value) {
    return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  },
  parse(_input) {
    return null;
  },
  format(value) {
    if (value === null)
      return "";
    return Array.isArray(value) ? value.join(", ") : String(value);
  },
  defaultValue() {
    return null;
  }
};

// src/model/fieldTypes/link.ts
function isLinkRef(v) {
  if (typeof v !== "object" || v === null)
    return false;
  const r = v;
  return typeof r.tableId === "string" && typeof r.rowId === "string";
}
var linkType = {
  readOnly: false,
  validate(value) {
    if (value === null)
      return true;
    return Array.isArray(value) && value.every(isLinkRef);
  },
  parse(_input) {
    return null;
  },
  /** Count only. Grid labels come from the link index (summarizeLinks). Sort and filter use this. */
  format(value) {
    if (!Array.isArray(value) || value.length === 0)
      return "";
    return `${value.length} linked`;
  },
  defaultValue() {
    return null;
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
  ["modified_time", modifiedTimeType],
  ["formula", formulaType],
  ["link", linkType]
]);
function getFieldType(name) {
  const ft = registry.get(name);
  if (!ft) {
    throw new Error(`Unknown field type: "${name}". Registered types: ${ALL_TYPE_NAMES.join(", ")}`);
  }
  return ft;
}
function isKnownType(name) {
  return registry.has(name);
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
  "modified_time",
  "formula",
  "link"
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
        const day2 = dateOnlyIso(v);
        if (day2 !== null)
          return day2;
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
function candidatePath(folder, base, n, ext = "tablify") {
  const name = n === 1 ? `${base}.${ext}` : `${base} ${n}.${ext}`;
  return folder === "" ? name : `${folder}/${name}`;
}
function pickFreePath(folder, base, exists, ext = "tablify") {
  for (let n = 1; n <= MAX_NAME_ATTEMPTS; n++) {
    const p = candidatePath(folder, base, n, ext);
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
    callback: () => startImport(plugin.app)
  });
}
function startImport(app, presetFolder) {
  pickFile(app, presetFolder);
}
function kindOf(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv"))
    return "csv";
  if (lower.endsWith(".xlsx"))
    return "xlsx";
  return null;
}
function pickFile(app, presetFolder) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,.xlsx";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file)
      void readThenChooseFolder(app, file, presetFolder);
  };
  input.click();
}
async function readThenChooseFolder(app, file, presetFolder) {
  const kind = kindOf(file.name);
  if (kind === null) {
    new import_obsidian.Notice("Choose a .csv or .xlsx file.");
    return;
  }
  const data = kind === "csv" ? await file.text() : await file.arrayBuffer();
  if (presetFolder !== void 0) {
    void runImport(app, kind, file.name, data, presetFolder);
    return;
  }
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

// src/commands/export.ts
var import_obsidian2 = require("obsidian");

// src/query/evaluate.ts
function offsetToLineCol2(text, offset) {
  let line = 1;
  let column = 1;
  const lim = Math.min(offset, text.length);
  for (let i = 0; i < lim; i++) {
    if (text[i] === "\n") {
      line++;
      column = 1;
    } else
      column++;
  }
  return { line, column };
}
function makeQueryError(message, position, rawInput) {
  const { line, column } = offsetToLineCol2(rawInput, position);
  return { message, position, line, column };
}
function isEmptyCell2(cell2) {
  if (cell2 === void 0 || cell2 === null)
    return true;
  if (typeof cell2 === "string")
    return cell2 === "";
  if (Array.isArray(cell2))
    return cell2.length === 0;
  return false;
}
function getFieldMap(fields) {
  const m = /* @__PURE__ */ new Map();
  for (const f of fields)
    m.set(f.name.trim().toLowerCase(), f);
  return m;
}
function resolveOptionId(value, field) {
  if (!field.options)
    return null;
  const lower = value.trim().toLowerCase();
  const byName = field.options.find((o) => o.name.trim().toLowerCase() === lower);
  if (byName)
    return byName.id;
  const byId = field.options.find((o) => o.id.toLowerCase() === lower);
  if (byId)
    return byId.id;
  return null;
}
function parseNumericQueryValue(raw, fieldType) {
  const trimmed = raw.trim();
  if (trimmed === "")
    return null;
  switch (fieldType) {
    case "number": {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    case "currency": {
      const cleaned = trimmed.replace(/[^0-9.-]/g, "");
      const n = parseFloat(cleaned);
      if (!Number.isFinite(n))
        return null;
      return Math.round(n * 100);
    }
    case "percent": {
      if (trimmed.endsWith("%")) {
        const n2 = parseFloat(trimmed.slice(0, -1));
        if (!Number.isFinite(n2))
          return null;
        return n2 / 100;
      }
      const n = parseFloat(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    case "duration": {
      try {
        const ft = getFieldType("duration");
        const parsed = ft.parse(trimmed);
        if (typeof parsed === "number" && Number.isFinite(parsed))
          return parsed;
      } catch {
      }
      const n = parseInt(trimmed, 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    case "rating": {
      const n = parseInt(trimmed, 10);
      if (!Number.isFinite(n))
        return null;
      return n;
    }
    case "auto_number": {
      const n = Number(trimmed);
      return Number.isFinite(n) && Number.isInteger(n) ? n : null;
    }
    default:
      return null;
  }
}
function parseCheckboxQueryValue(raw) {
  const t = raw.trim().toLowerCase();
  if (["true", "1", "yes", "y", "\u2713", "checked"].includes(t))
    return true;
  if (["false", "0", "no", "n", "unchecked"].includes(t))
    return false;
  return null;
}
function parseDateValue(raw, isDateOnly) {
  const trimmed = raw.trim();
  if (trimmed === "")
    return null;
  if (isDateOnly) {
    const ft = getFieldType("date");
    const parsed = ft.parse(trimmed);
    return typeof parsed === "string" ? parsed : null;
  } else {
    const ft = getFieldType("date_time");
    const parsed = ft.parse(trimmed);
    return typeof parsed === "string" ? parsed : null;
  }
}
function compileTerm(term, field, rawInput) {
  const fieldType = field.type;
  const op = term.op;
  const values = term.values;
  const isEmptyRequest = op === "empty" || op === "eq" && values.length === 1 && values[0] === "";
  if (isEmptyRequest) {
    const pred = (row) => isEmptyCell2(row.values[field.id]);
    return { ok: true, predicate: pred };
  }
  const textFamily = /* @__PURE__ */ new Set(["text", "long_text", "url", "email", "phone", "attachment"]);
  const numberFamily = /* @__PURE__ */ new Set(["number", "currency", "percent", "duration", "rating", "auto_number"]);
  const dateFamily = /* @__PURE__ */ new Set(["date", "date_time", "created_time", "modified_time"]);
  if (textFamily.has(fieldType)) {
    if (op === "not" || op === "gt" || op === "lt") {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput)
      };
    }
    if (op === "contains") {
      const want = values[0] ?? "";
      const lowerWant = want.toLowerCase();
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (isEmptyCell2(cell2))
          return false;
        const cellStr = String(cell2).toLowerCase();
        return cellStr.includes(lowerWant);
      };
      return { ok: true, predicate: pred };
    }
    if (values.length === 1) {
      const want = values[0] ?? "";
      const lowerWant = want.toLowerCase();
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (isEmptyCell2(cell2))
          return false;
        return String(cell2).toLowerCase() === lowerWant;
      };
      return { ok: true, predicate: pred };
    } else {
      const lowerVals = values.map((v) => v.toLowerCase()).filter((v) => v !== "");
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (isEmptyCell2(cell2))
          return false;
        const cellStr = String(cell2).toLowerCase();
        return lowerVals.some((v) => cellStr.includes(v));
      };
      return { ok: true, predicate: pred };
    }
  }
  if (fieldType === "single_select") {
    if (op === "contains" || op === "gt" || op === "lt") {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for single_select field "${field.name}"`, term.position, rawInput)
      };
    }
    if (op === "not") {
      const raw = values[0] ?? "";
      const resolved = resolveOptionId(raw, field);
      if (resolved === null) {
        const pred2 = () => true;
        return { ok: true, predicate: pred2 };
      }
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (isEmptyCell2(cell2))
          return true;
        return String(cell2) !== resolved;
      };
      return { ok: true, predicate: pred };
    }
    if (values.length === 1) {
      const resolved = resolveOptionId(values[0] ?? "", field);
      if (resolved === null) {
        const pred2 = () => false;
        return { ok: true, predicate: pred2 };
      }
      const pred = (row) => String(row.values[field.id] ?? "") === resolved;
      return { ok: true, predicate: pred };
    } else {
      const resolvedIds = values.map((v) => resolveOptionId(v, field)).filter((id) => id !== null);
      if (resolvedIds.length === 0) {
        const pred2 = () => false;
        return { ok: true, predicate: pred2 };
      }
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (isEmptyCell2(cell2))
          return false;
        return resolvedIds.includes(String(cell2));
      };
      return { ok: true, predicate: pred };
    }
  }
  if (fieldType === "multi_select") {
    if (op === "contains" || op === "not" || op === "gt" || op === "lt") {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for multi_select field "${field.name}"`, term.position, rawInput)
      };
    }
    if (values.length === 1) {
      const resolved = resolveOptionId(values[0] ?? "", field);
      if (resolved === null) {
        const pred2 = () => false;
        return { ok: true, predicate: pred2 };
      }
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (!Array.isArray(cell2))
          return false;
        return cell2.includes(resolved);
      };
      return { ok: true, predicate: pred };
    } else {
      const resolvedIds = values.map((v) => resolveOptionId(v, field)).filter((id) => id !== null);
      if (resolvedIds.length === 0) {
        const pred2 = () => false;
        return { ok: true, predicate: pred2 };
      }
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (!Array.isArray(cell2))
          return false;
        return cell2.some((id) => resolvedIds.includes(id));
      };
      return { ok: true, predicate: pred };
    }
  }
  if (fieldType === "checkbox") {
    if (op === "contains" || op === "not" || op === "gt" || op === "lt") {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for checkbox field "${field.name}"`, term.position, rawInput)
      };
    }
    const bools = [];
    for (const raw of values) {
      const b = parseCheckboxQueryValue(raw);
      if (b === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid boolean value "${raw}" for checkbox field "${field.name}"`, term.position, rawInput)
        };
      }
      bools.push(b);
    }
    if (bools.length === 1) {
      const want = bools[0];
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (cell2 === null || cell2 === void 0)
          return false;
        return cell2 === want;
      };
      return { ok: true, predicate: pred };
    } else {
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (cell2 === null || cell2 === void 0)
          return false;
        return bools.includes(cell2);
      };
      return { ok: true, predicate: pred };
    }
  }
  if (numberFamily.has(fieldType)) {
    if (op === "contains" || op === "not") {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput)
      };
    }
    if (op === "gt" || op === "lt") {
      const raw = values[0] ?? "";
      const parsed = parseNumericQueryValue(raw, fieldType);
      if (parsed === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid number "${raw}" for field "${field.name}"`, term.position, rawInput)
        };
      }
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (typeof cell2 !== "number" || !Number.isFinite(cell2))
          return false;
        return op === "gt" ? cell2 > parsed : cell2 < parsed;
      };
      return { ok: true, predicate: pred };
    }
    const parsedVals = [];
    for (const raw of values) {
      if (raw === "") {
        continue;
      }
      const parsed = parseNumericQueryValue(raw, fieldType);
      if (parsed === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid number "${raw}" for field "${field.name}"`, term.position, rawInput)
        };
      }
      parsedVals.push(parsed);
    }
    if (parsedVals.length === 0) {
      const pred = (row) => isEmptyCell2(row.values[field.id]);
      return { ok: true, predicate: pred };
    }
    if (parsedVals.length === 1) {
      const want = parsedVals[0];
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (typeof cell2 !== "number")
          return false;
        return cell2 === want;
      };
      return { ok: true, predicate: pred };
    } else {
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (typeof cell2 !== "number")
          return false;
        return parsedVals.includes(cell2);
      };
      return { ok: true, predicate: pred };
    }
  }
  if (dateFamily.has(fieldType)) {
    if (op === "contains" || op === "not") {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput)
      };
    }
    const isDateOnly = fieldType === "date";
    if (op === "gt" || op === "lt") {
      const raw = values[0] ?? "";
      const parsed = parseDateValue(raw, isDateOnly);
      if (parsed === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid date "${raw}" for field "${field.name}"`, term.position, rawInput)
        };
      }
      const parsedTime = new Date(parsed).getTime();
      const pred = (row) => {
        const cell2 = row.values[field.id];
        if (typeof cell2 !== "string")
          return false;
        const cellTime = new Date(cell2).getTime();
        if (isNaN(cellTime) || isNaN(parsedTime))
          return false;
        return op === "gt" ? cellTime > parsedTime : cellTime < parsedTime;
      };
      return { ok: true, predicate: pred };
    }
    const parsedVals = [];
    for (const raw of values) {
      if (raw === "")
        continue;
      const parsed = parseDateValue(raw, isDateOnly);
      if (parsed === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid date "${raw}" for field "${field.name}"`, term.position, rawInput)
        };
      }
      parsedVals.push(parsed);
    }
    if (parsedVals.length === 0) {
      const pred = (row) => isEmptyCell2(row.values[field.id]);
      return { ok: true, predicate: pred };
    }
    if (parsedVals.length === 1) {
      const want = parsedVals[0];
      const wantTime = new Date(want).getTime();
      if (isDateOnly) {
        const pred = (row) => {
          const cell2 = row.values[field.id];
          if (typeof cell2 !== "string")
            return false;
          return cell2 === want;
        };
        return { ok: true, predicate: pred };
      } else {
        const pred = (row) => {
          const cell2 = row.values[field.id];
          if (typeof cell2 !== "string")
            return false;
          const cellTime = new Date(cell2).getTime();
          return cellTime === wantTime;
        };
        return { ok: true, predicate: pred };
      }
    } else {
      if (isDateOnly) {
        const set = new Set(parsedVals);
        const pred = (row) => {
          const cell2 = row.values[field.id];
          if (typeof cell2 !== "string")
            return false;
          return set.has(cell2);
        };
        return { ok: true, predicate: pred };
      } else {
        const wantTimes = new Set(parsedVals.map((s) => new Date(s).getTime()));
        const pred = (row) => {
          const cell2 = row.values[field.id];
          if (typeof cell2 !== "string")
            return false;
          const ct = new Date(cell2).getTime();
          return wantTimes.has(ct);
        };
        return { ok: true, predicate: pred };
      }
    }
  }
  return {
    ok: false,
    error: makeQueryError(`Unsupported field type "${fieldType}" for field "${field.name}"`, term.position, rawInput)
  };
}
function compilePredicate(ast, fields) {
  const fieldMap = getFieldMap(fields);
  const preds = [];
  for (const term of ast.terms) {
    const field = fieldMap.get(term.fieldName);
    if (!field) {
      return {
        ok: false,
        error: makeQueryError(`Unknown field: "${term.rawFieldName}"`, term.position, ast.rawInput)
      };
    }
    const compiled = compileTerm(term, field, ast.rawInput);
    if (!compiled.ok)
      return compiled;
    preds.push(compiled.predicate);
  }
  const combined = (row) => preds.every((p) => p(row));
  return { ok: true, predicate: combined };
}

// src/query/parse.ts
function isWS(c) {
  return c === " " || c === "	" || c === "\n" || c === "\r";
}
function offsetToLineCol3(text, offset) {
  let line = 1;
  let column = 1;
  const lim = Math.min(offset, text.length);
  for (let i = 0; i < lim; i++) {
    if (text[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}
function makeError(text, message, position) {
  const { line, column } = offsetToLineCol3(text, position);
  return { message, position, line, column };
}
function parseQuery(input) {
  const len = input.length;
  let i = 0;
  const terms = [];
  function skipWS() {
    while (i < len && isWS(input[i]))
      i++;
  }
  function peekIsNextField(start) {
    const j = start;
    if (j >= len)
      return false;
    if (input[j] === '"') {
      let k = j + 1;
      let closed = false;
      while (k < len) {
        if (input[k] === '"') {
          if (k + 1 < len && input[k + 1] === '"')
            k += 2;
          else {
            k++;
            closed = true;
            break;
          }
        } else
          k++;
      }
      if (!closed)
        return false;
      while (k < len && isWS(input[k]))
        k++;
      return k < len && input[k] === ":";
    } else {
      let k = j;
      let hasContent = false;
      while (k < len && input[k] !== ":" && !isWS(input[k]) && input[k] !== "," && input[k] !== '"') {
        if (input[k] === "~" || input[k] === "!" || input[k] === ">" || input[k] === "<")
          return false;
        hasContent = true;
        k++;
      }
      if (!hasContent)
        return false;
      while (k < len && isWS(input[k]))
        k++;
      return k < len && input[k] === ":";
    }
  }
  function parseSingleValueImmediate() {
    if (i >= len) {
      return { error: makeError(input, "Unexpected end of input in value", i) };
    }
    if (input[i] === '"') {
      const qStart = i;
      i++;
      let inner = "";
      let closed = false;
      while (i < len) {
        if (input[i] === '"') {
          if (i + 1 < len && input[i + 1] === '"') {
            inner += '"';
            i += 2;
          } else {
            i++;
            closed = true;
            break;
          }
        } else {
          inner += input[i];
          i++;
        }
      }
      if (!closed) {
        return { error: makeError(input, "Unclosed quote in value", qStart) };
      }
      return { value: inner };
    } else {
      let v = "";
      const start = i;
      while (i < len && !isWS(input[i]) && input[i] !== "," && input[i] !== '"') {
        if (input[i] === ":") {
          return {
            error: makeError(input, `Unexpected ':' in value \u2014 quote the value if it contains ':'`, i)
          };
        }
        v += input[i];
        i++;
      }
      if (v.length === 0) {
        return { error: makeError(input, "Empty value in list", start) };
      }
      return { value: v };
    }
  }
  function parseValueList() {
    const vals = [];
    if (i >= len) {
      return { values: [""] };
    }
    if (isWS(input[i])) {
      return { values: [""] };
    }
    const first = parseSingleValueImmediate();
    if ("error" in first)
      return first;
    vals.push(first.value);
    while (true) {
      let j = i;
      while (j < len && isWS(input[j]))
        j++;
      if (j < len && input[j] === ",") {
        const commaPos = j;
        j++;
        while (j < len && isWS(input[j]))
          j++;
        if (j >= len) {
          return { error: makeError(input, "Trailing comma in value list", commaPos) };
        }
        if (input[j] === ",") {
          return { error: makeError(input, `Unexpected ',' in value list`, j) };
        }
        if (isWS(input[j])) {
          return { error: makeError(input, "Trailing comma in value list", commaPos) };
        }
        i = j;
        const nxt = parseSingleValueImmediate();
        if ("error" in nxt)
          return nxt;
        vals.push(nxt.value);
      } else {
        break;
      }
    }
    return { values: vals };
  }
  skipWS();
  if (i >= len) {
    return { ok: true, ast: { terms: [], rawInput: input } };
  }
  while (i < len) {
    skipWS();
    if (i >= len)
      break;
    const termStart = i;
    let rawFieldName;
    let fieldName;
    if (input[i] === '"') {
      const quoteStart = i;
      i++;
      let inner = "";
      let closed = false;
      while (i < len) {
        if (input[i] === '"') {
          if (i + 1 < len && input[i + 1] === '"') {
            inner += '"';
            i += 2;
          } else {
            i++;
            closed = true;
            break;
          }
        } else {
          inner += input[i];
          i++;
        }
      }
      if (!closed) {
        return { ok: false, error: makeError(input, "Unclosed quote in field name", quoteStart) };
      }
      rawFieldName = inner;
      fieldName = inner.trim().toLowerCase();
      if (fieldName.length === 0) {
        return { ok: false, error: makeError(input, "Empty field name", quoteStart) };
      }
      while (i < len && isWS(input[i]))
        i++;
      if (i >= len || input[i] !== ":") {
        const at = i < len ? i : len;
        const preview = rawFieldName.length > 20 ? rawFieldName.slice(0, 20) + "\u2026" : rawFieldName;
        return { ok: false, error: makeError(input, `Expected ':' after field name "${preview}"`, at) };
      }
    } else {
      const fieldStart = i;
      let raw = "";
      while (i < len && input[i] !== ":" && !isWS(input[i])) {
        const ch3 = input[i];
        if (ch3 === '"' || ch3 === ",") {
          return { ok: false, error: makeError(input, `Invalid character '${ch3}' in field name`, i) };
        }
        if (ch3 === "~" || ch3 === "!" || ch3 === ">" || ch3 === "<") {
          return { ok: false, error: makeError(input, `Invalid character '${ch3}' in field name`, i) };
        }
        raw += ch3;
        i++;
      }
      if (raw.length === 0) {
        if (i < len && input[i] === ":") {
          return { ok: false, error: makeError(input, "Empty field name", fieldStart) };
        }
        return { ok: false, error: makeError(input, "Empty field name", fieldStart) };
      }
      while (i < len && isWS(input[i]))
        i++;
      if (i >= len || input[i] !== ":") {
        return {
          ok: false,
          error: makeError(input, `Expected ':' after field name "${raw}"`, i < len ? i : len)
        };
      }
      rawFieldName = raw;
      fieldName = raw.trim().toLowerCase();
    }
    i++;
    let hadWS = false;
    while (i < len && isWS(input[i])) {
      hadWS = true;
      i++;
    }
    let op;
    let values;
    if (i >= len) {
      op = "eq";
      values = [""];
    } else {
      const slice5 = input.slice(i, i + 5);
      const lower5 = slice5.toLowerCase();
      const afterEmpty = i + 5;
      const nextIsCommaAfterEmpty = afterEmpty < len && input[afterEmpty] === ",";
      if (input[i] !== '"' && lower5 === "empty" && (afterEmpty === len || isWS(input[afterEmpty]))) {
        op = "empty";
        values = [];
        i += 5;
      } else if (input[i] !== '"' && lower5 === "empty" && nextIsCommaAfterEmpty) {
        const parsed = parseValueList();
        if ("error" in parsed)
          return { ok: false, error: parsed.error };
        op = "eq";
        values = parsed.values;
      } else if (input[i] === "~" || input[i] === "!" || input[i] === ">" || input[i] === "<") {
        const opChar = input[i];
        if (opChar === "~")
          op = "contains";
        else if (opChar === "!")
          op = "not";
        else if (opChar === ">")
          op = "gt";
        else
          op = "lt";
        i++;
        while (i < len && isWS(input[i]))
          i++;
        if (i >= len) {
          return { ok: false, error: makeError(input, `Expected value after '${opChar}'`, i) };
        }
        if (input[i] === ",") {
          return { ok: false, error: makeError(input, `Unexpected ',' after '${opChar}'`, i) };
        }
        if (input[i] === '"') {
          const qStart = i;
          i++;
          let inner = "";
          let closed = false;
          while (i < len) {
            if (input[i] === '"') {
              if (i + 1 < len && input[i + 1] === '"') {
                inner += '"';
                i += 2;
              } else {
                i++;
                closed = true;
                break;
              }
            } else {
              inner += input[i];
              i++;
            }
          }
          if (!closed) {
            return { ok: false, error: makeError(input, "Unclosed quote in value", qStart) };
          }
          values = [inner];
        } else {
          let v = "";
          while (i < len && !isWS(input[i]) && input[i] !== "," && input[i] !== '"') {
            if (input[i] === ":") {
              return {
                error: makeError(input, `Unexpected ':' in value \u2014 quote the value if it contains ':'`, i)
              };
            }
            v += input[i];
            i++;
          }
          if (v.length === 0) {
            return { ok: false, error: makeError(input, `Expected value after '${opChar}'`, i) };
          }
          values = [v];
        }
        if (i < len && input[i] === ",") {
          return {
            ok: false,
            error: makeError(input, `Comma not allowed after '${opChar}' operator`, i)
          };
        }
      } else {
        const lookahead = hadWS && peekIsNextField(i);
        if (lookahead) {
          op = "eq";
          values = [""];
        } else {
          if (i < len && input[i] === ",") {
            return { ok: false, error: makeError(input, "Unexpected ',' in value list", i) };
          }
          const parsed = parseValueList();
          if ("error" in parsed)
            return { ok: false, error: parsed.error };
          op = "eq";
          values = parsed.values;
        }
      }
    }
    const termEnd = i;
    const rawSlice = input.slice(termStart, termEnd);
    terms.push({
      fieldName,
      rawFieldName,
      op,
      values,
      raw: rawSlice.trim(),
      position: termStart
    });
    if (i === termStart) {
      return { ok: false, error: makeError(input, "Failed to parse term", termStart) };
    }
  }
  return { ok: true, ast: { terms, rawInput: input } };
}

// src/model/viewOrder.ts
var collator = new Intl.Collator("en", { numeric: true, sensitivity: "variant" });
function sortText(value, field) {
  if (typeof value === "string")
    return value;
  return getFieldType(field.type).format(value, field);
}
function compareCells(a, b, field, dir) {
  const aEmpty = a === null || a === void 0 || Array.isArray(a) && a.length === 0;
  const bEmpty = b === null || b === void 0 || Array.isArray(b) && b.length === 0;
  if (aEmpty || bEmpty)
    return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  let c;
  if (typeof a === "number" && typeof b === "number")
    c = a - b;
  else if (typeof a === "boolean" && typeof b === "boolean")
    c = Number(a) - Number(b);
  else
    c = collator.compare(sortText(a, field), sortText(b, field));
  return c * dir;
}
function sortRows(rows, sort, fields) {
  if (sort.length === 0)
    return rows.slice();
  const byId = new Map(fields.map((f) => [f.id, f]));
  const keys = sort.map((s) => ({ field: byId.get(s.fieldId), dir: s.direction === "desc" ? -1 : 1 })).filter((k) => k.field !== void 0);
  return rows.slice().sort((r1, r2) => {
    for (const k of keys) {
      const c = compareCells(r1.values[k.field.id] ?? null, r2.values[k.field.id] ?? null, k.field, k.dir);
      if (c !== 0)
        return c;
    }
    return 0;
  });
}
function visibleFields(fields, view) {
  const hidden = new Set(view.hidden);
  const byId = new Map(fields.map((f) => [f.id, f]));
  const ordered = [];
  const seen = /* @__PURE__ */ new Set();
  for (const id of view.columnOrder) {
    const f = byId.get(id);
    if (f && !seen.has(id)) {
      ordered.push(f);
      seen.add(id);
    }
  }
  for (const f of fields)
    if (!seen.has(f.id))
      ordered.push(f);
  return ordered.filter((f) => !hidden.has(f.id));
}

// src/io/export/view.ts
function cellText(value, field) {
  if (value === null || value === void 0)
    return "";
  switch (field.type) {
    case "checkbox":
      return value === true ? "true" : value === false ? "false" : "";
    case "number":
      return typeof value === "number" ? String(value) : "";
    case "date":
    case "date_time":
    case "text":
    case "long_text":
    case "url":
    case "email":
    case "phone":
      return typeof value === "string" ? value : String(value);
    case "single_select":
    case "multi_select":
      return getFieldType(field.type).format(value, field);
    default:
      return getFieldType(field.type).format(value, field);
  }
}
function resolveExportTable(file, scope) {
  if (scope.fullTable) {
    return { ok: true, table: { name: file.name, fields: file.fields.slice(), rows: file.rows.slice() } };
  }
  const index = scope.viewIndex ?? 0;
  const view = file.views[index];
  if (!view)
    return { ok: false, error: 'The table has no view to export. Use "Full table".' };
  let rows = file.rows;
  const query = scope.query?.trim();
  if (query) {
    const parsed = parseQuery(query);
    if (!parsed.ok)
      return { ok: false, error: `Filter error: ${parsed.error.message}` };
    const compiled = compilePredicate(parsed.ast, file.fields);
    if (!compiled.ok)
      return { ok: false, error: `Filter error: ${compiled.error.message}` };
    rows = rows.filter((r) => compiled.predicate(r));
  }
  const fields = visibleFields(file.fields, view);
  rows = sortRows(rows, view.sort, file.fields);
  return { ok: true, table: { name: file.name, fields, rows } };
}

// src/io/export/csv.ts
var BOM = "\uFEFF";
function csvField(text) {
  if (/[",\r\n]/.test(text))
    return `"${text.replace(/"/g, '""')}"`;
  return text;
}
function toCsv(table) {
  const lines = [];
  lines.push(table.fields.map((f) => csvField(f.name)).join(","));
  for (const row of table.rows) {
    lines.push(table.fields.map((f) => csvField(cellText(row.values[f.id] ?? null, f))).join(","));
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

// src/io/export/markdown.ts
function escapeMarkdownCell(text) {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r\n|\r|\n/g, "<br>");
}
function toMarkdown(table) {
  const header = `| ${table.fields.map((f) => escapeMarkdownCell(f.name)).join(" | ")} |`;
  const sep = `| ${table.fields.map(() => "---").join(" | ")} |`;
  const body = table.rows.map(
    (row) => `| ${table.fields.map((f) => escapeMarkdownCell(cellText(row.values[f.id] ?? null, f))).join(" | ")} |`
  );
  return [header, sep, ...body].join("\n") + "\n";
}

// node_modules/write-excel-file/modules/write/writeXlsxFileBrowser.js
var import_jszip = __toESM(require_jszip_min(), 1);
var import_file_saver = __toESM(require_FileSaver_min(), 1);

// node_modules/write-excel-file/modules/write/statics/workbook.xml.js
function generateWorkbookXml(_ref) {
  var sheets = _ref.sheets, stickyRowsCount = _ref.stickyRowsCount, stickyColumnsCount = _ref.stickyColumnsCount;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mx="http://schemas.microsoft.com/office/mac/excel/2008/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><workbookPr/>' + (stickyRowsCount || stickyColumnsCount ? "<bookViews><workbookView/></bookViews>" : "") + "<sheets>" + sheets.map(function(_ref2) {
    var id = _ref2.id, name = _ref2.name;
    return '<sheet name="'.concat(name, '" sheetId="').concat(id, '" r:id="rId').concat(id, '"/>');
  }).join("") + "</sheets><definedNames/><calcPr/></workbook>";
}

// node_modules/write-excel-file/modules/write/statics/workbook.xml.rels.js
function generateWorkbookXmlRels(_ref) {
  var sheets = _ref.sheets;
  return '<?xml version="1.0" ?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function(_ref2) {
    var id = _ref2.id;
    return '<Relationship Id="rId'.concat(id, '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet').concat(id, '.xml"/>');
  }).join("") + '<Relationship Id="rId'.concat(sheets.length + 1, '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>') + '<Relationship Id="rId'.concat(sheets.length + 2, '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>') + "</Relationships>";
}

// node_modules/write-excel-file/modules/write/statics/rels.js
var rels_default = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';

// node_modules/write-excel-file/modules/write/statics/[Content_Types].xml.js
var Content_Types_xml_default = '<?xml version="1.0" ?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default ContentType="application/xml" Extension="xml"/><Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels"/><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" PartName="/xl/worksheets/sheet1.xml"/><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" PartName="/xl/workbook.xml"/><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml" PartName="/xl/sharedStrings.xml"/><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" PartName="/xl/styles.xml"/></Types>';

// node_modules/write-excel-file/modules/xml/escapeXmlCharacters.js
function escapeXmlCharacters(string, _ref) {
  var attribute = _ref.attribute;
  string = string.replace(AMPERSAND_REGEXP, "&amp;").replace(GREATER_THAN_REGEXP, "&gt;").replace(LESS_THAN_REGEXP, "&lt;");
  if (attribute) {
    string = string.replace(SINGLE_QUOTE_REGEXP, "&apos;").replace(DOUBLE_QUOTE_REGEXP, "&quot;");
  }
  return string;
}
var AMPERSAND_REGEXP = /&/g;
var GREATER_THAN_REGEXP = />/g;
var LESS_THAN_REGEXP = /</g;
var SINGLE_QUOTE_REGEXP = /'/g;
var DOUBLE_QUOTE_REGEXP = /"/g;

// node_modules/write-excel-file/modules/xml/removeInvalidXmlCharacters.js
var INVALID_CHARACTERS = /((?:[\0-\x08\x0B\f\x0E-\x1F\uFFFD\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]))/g;
var DISCOURAGED_CHARACTERS = new RegExp("([\\x7F-\\x84]|[\\x86-\\x9F]|[\\uFDD0-\\uFDEF]|(?:\\uD83F[\\uDFFE\\uDFFF])|(?:\\uD87F[\\uDFFE\\uDFFF])|(?:\\uD8BF[\\uDFFE\\uDFFF])|(?:\\uD8FF[\\uDFFE\\uDFFF])|(?:\\uD93F[\\uDFFE\\uDFFF])|(?:\\uD97F[\\uDFFE\\uDFFF])|(?:\\uD9BF[\\uDFFE\\uDFFF])|(?:\\uD9FF[\\uDFFE\\uDFFF])|(?:\\uDA3F[\\uDFFE\\uDFFF])|(?:\\uDA7F[\\uDFFE\\uDFFF])|(?:\\uDABF[\\uDFFE\\uDFFF])|(?:\\uDAFF[\\uDFFE\\uDFFF])|(?:\\uDB3F[\\uDFFE\\uDFFF])|(?:\\uDB7F[\\uDFFE\\uDFFF])|(?:\\uDBBF[\\uDFFE\\uDFFF])|(?:\\uDBFF[\\uDFFE\\uDFFF])(?:[\\0-\\t\\x0B\\f\\x0E-\\u2027\\u202A-\\uD7FF\\uE000-\\uFFFF]|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?:[^\\uD800-\\uDBFF]|^)[\\uDC00-\\uDFFF]))", "g");
function removeInvalidXmlCharacters(string) {
  var _ref = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, _ref$removeDiscourage = _ref.removeDiscouragedCharacters, removeDiscouragedCharacters = _ref$removeDiscourage === void 0 ? true : _ref$removeDiscourage;
  string = string.replace(INVALID_CHARACTERS, "");
  if (removeDiscouragedCharacters) {
    string = string.replace(DISCOURAGED_CHARACTERS, "");
  }
  return string;
}

// node_modules/write-excel-file/modules/xml/sanitizeText.js
function sanitizeText(string) {
  return escapeXmlCharacters(removeInvalidXmlCharacters(string), {
    attribute: false
  });
}

// node_modules/write-excel-file/modules/write/generateCellNumber.js
function generateCellNumber(columnIndex, rowNumber) {
  return "".concat(generateColumnLetter(columnIndex)).concat(rowNumber);
}
var LETTERS_COUNT = 26;
function generateColumnLetter(columnIndex) {
  if (typeof columnIndex !== "number") {
    return "";
  }
  var prefix = Math.floor(columnIndex / LETTERS_COUNT);
  var letter = String.fromCharCode(97 + columnIndex % LETTERS_COUNT).toUpperCase();
  if (prefix === 0) {
    return letter;
  }
  return generateColumnLetter(prefix - 1) + letter;
}

// node_modules/write-excel-file/modules/write/convertDateToExcelSerial.js
var daysBeforeUnixEpoch = 70 * 365 + 19;
var hour = 60 * 60 * 1e3;
var day = 24 * hour;
function convertDateToExcelSerial(date) {
  return date.getTime() / day + daysBeforeUnixEpoch;
}

// node_modules/write-excel-file/modules/write/cell.js
function _slicedToArray4(arr, i) {
  return _arrayWithHoles4(arr) || _iterableToArrayLimit4(arr, i) || _unsupportedIterableToArray9(arr, i) || _nonIterableRest4();
}
function _nonIterableRest4() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray9(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray9(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray9(o, minLen);
}
function _arrayLikeToArray9(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }
  return arr2;
}
function _iterableToArrayLimit4(arr, i) {
  var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
  if (_i == null)
    return;
  var _arr = [];
  var _n = true;
  var _d = false;
  var _s, _e;
  try {
    for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);
      if (i && _arr.length === i)
        break;
    }
  } catch (err3) {
    _d = true;
    _e = err3;
  } finally {
    try {
      if (!_n && _i["return"] != null)
        _i["return"]();
    } finally {
      if (_d)
        throw _e;
    }
  }
  return _arr;
}
function _arrayWithHoles4(arr) {
  if (Array.isArray(arr))
    return arr;
}
function generateCell(rowNumber, columnIndex, value, type, cellStyleId, getSharedString) {
  if (value === null) {
    if (!cellStyleId) {
      return "";
    }
  }
  var xml = '<c r="'.concat(generateCellNumber(columnIndex, rowNumber), '"');
  if (cellStyleId) {
    xml += ' s="'.concat(cellStyleId, '"');
  }
  if (value === null) {
    return xml + "/>";
  }
  if (type === Date && !cellStyleId) {
    throw new Error('No "format" has been specified for a Date cell');
  }
  value = getXlsxValue(type, value, getSharedString);
  type = getXlsxType(type);
  if (type) {
    xml += ' t="'.concat(type, '"');
  }
  var _getOpeningAndClosing = getOpeningAndClosingTags(type), _getOpeningAndClosing2 = _slicedToArray4(_getOpeningAndClosing, 2), openingTags = _getOpeningAndClosing2[0], closingTags = _getOpeningAndClosing2[1];
  return xml + ">" + openingTags + value + closingTags + "</c>";
}
function getXlsxType(type) {
  switch (type) {
    case String:
      return "s";
    case Number:
      return;
    case Date:
      return;
    case Boolean:
      return "b";
    case "Formula":
      return "f";
    default:
      throw new Error("Unknown schema type: ".concat(type && type.name || type));
  }
}
function getXlsxValue(type, value, getSharedString) {
  switch (type) {
    case String:
      if (typeof value !== "string") {
        throw new Error("Invalid cell value: ".concat(value, ". Expected a string"));
      }
      return getSharedString(value);
    case Number:
      if (typeof value !== "number") {
        throw new Error("Invalid cell value: ".concat(value, ". Expected a number"));
      }
      return String(value);
    case Date:
      if (!(value instanceof Date)) {
        throw new Error("Invalid cell value: ".concat(value, ". Expected a Date"));
      }
      return String(convertDateToExcelSerial(value));
    case Boolean:
      if (typeof value !== "boolean") {
        throw new Error("Invalid cell value: ".concat(value, ". Expected a boolean"));
      }
      return value ? "1" : "0";
    case "Formula":
      if (typeof value !== "string") {
        throw new Error("Invalid cell value: ".concat(value, ". Expected a string"));
      }
      return sanitizeText(value);
    default:
      throw new Error("Unknown schema type: ".concat(type && type.name || type));
  }
}
var TAG_BRACKET_LEFT_REGEXP = /</g;
function getOpeningAndClosingTags(xlsxType) {
  var openingTags = getOpeningTags(xlsxType);
  var closingTags = openingTags.replace(TAG_BRACKET_LEFT_REGEXP, "</");
  return [openingTags, closingTags];
}
function getOpeningTags(xlsxType) {
  switch (xlsxType) {
    case "inlineStr":
      return "<is><t>";
    case "f":
      return "<f>";
    default:
      return "<v>";
  }
}

// node_modules/write-excel-file/modules/write/getCellStyleProperties.js
function getCellStyleProperties(cell2) {
  var align = cell2.align, alignVertical = cell2.alignVertical, textRotation = cell2.textRotation, wrap = cell2.wrap, fontFamily = cell2.fontFamily, fontSize = cell2.fontSize, fontWeight = cell2.fontWeight, fontStyle = cell2.fontStyle, color = cell2.color, backgroundColor = cell2.backgroundColor, borderColor = cell2.borderColor, borderStyle = cell2.borderStyle, leftBorderColor = cell2.leftBorderColor, leftBorderStyle = cell2.leftBorderStyle, rightBorderColor = cell2.rightBorderColor, rightBorderStyle = cell2.rightBorderStyle, topBorderColor = cell2.topBorderColor, topBorderStyle = cell2.topBorderStyle, bottomBorderColor = cell2.bottomBorderColor, bottomBorderStyle = cell2.bottomBorderStyle;
  if (align || alignVertical || textRotation || wrap || fontFamily || fontSize || fontWeight || fontStyle || color || backgroundColor || borderColor || borderStyle || leftBorderColor || leftBorderStyle || rightBorderColor || rightBorderStyle || topBorderColor || topBorderStyle || bottomBorderColor || bottomBorderStyle) {
    return omitUndefinedProperties({
      align,
      alignVertical,
      textRotation,
      wrap,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      color,
      backgroundColor,
      borderColor,
      borderStyle,
      leftBorderColor,
      leftBorderStyle,
      rightBorderColor,
      rightBorderStyle,
      topBorderColor,
      topBorderStyle,
      bottomBorderColor,
      bottomBorderStyle
    });
  }
}
function omitUndefinedProperties(object) {
  var filteredObject = {};
  for (var key in object) {
    if (object[key] !== void 0) {
      filteredObject[key] = object[key];
    }
  }
  return filteredObject;
}

// node_modules/write-excel-file/modules/write/row.js
function _typeof2(obj) {
  "@babel/helpers - typeof";
  return _typeof2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(obj2) {
    return typeof obj2;
  } : function(obj2) {
    return obj2 && "function" == typeof Symbol && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
  }, _typeof2(obj);
}
function generateRow(row, rowIndex, _ref) {
  var getStyle = _ref.getStyle, getSharedString = _ref.getSharedString, customFont = _ref.customFont, dateFormat = _ref.dateFormat, usesSchema = _ref.usesSchema;
  var rowNumber = rowIndex + 1;
  var rowHeight;
  var rowCells = row.map(function(cell2, columnIndex) {
    if (cell2 === void 0 || cell2 === null) {
      return "";
    }
    var height = cell2.height;
    var cellStyleProperties = getCellStyleProperties(cell2);
    var type = cell2.type, value = cell2.value, format = cell2.format;
    if (isEmpty(value)) {
      value = null;
    } else {
      if (type === void 0) {
        if (!usesSchema) {
          type = detectValueType(value);
        }
        if (type === void 0) {
          type = String;
          value = String(value);
        }
      }
    }
    if (format) {
      if (type !== Date && type !== Number && type !== "Formula") {
        throw new Error('`format` can only be used on `Date`, `Number` or `"Formula"` cells');
      }
    } else {
      if (type === Date) {
        format = dateFormat;
      }
    }
    var cellStyleId;
    if (format || customFont || cellStyleProperties) {
      cellStyleId = getStyle(cellStyleProperties || {}, {
        format
      });
    }
    if (height) {
      if (rowHeight === void 0 || rowHeight < height) {
        rowHeight = height;
      }
    }
    return generateCell(rowNumber, columnIndex, value, type, cellStyleId, getSharedString);
  }).join("");
  return '<row r="'.concat(rowNumber, '"') + (rowHeight ? ' ht="'.concat(rowHeight, '" customHeight="1"') : "") + ">" + rowCells + "</row>";
}
function isEmpty(value) {
  return value === void 0 || value === null || value === "";
}
function detectValueType(value) {
  switch (_typeof2(value)) {
    case "string":
      return String;
    case "number":
      return Number;
    case "boolean":
      return Boolean;
    default:
      if (value instanceof Date) {
        return Date;
      }
  }
}

// node_modules/write-excel-file/modules/write/rows.js
function ownKeys2(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    enumerableOnly && (symbols = symbols.filter(function(sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    })), keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = null != arguments[i] ? arguments[i] : {};
    i % 2 ? ownKeys2(Object(source), true).forEach(function(key) {
      _defineProperty2(target, key, source[key]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys2(Object(source)).forEach(function(key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }
  return target;
}
function _defineProperty2(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _createForOfIteratorHelperLoose7(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray10(o)) || allowArrayLike && o && typeof o.length === "number") {
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
function _unsupportedIterableToArray10(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray10(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray10(o, minLen);
}
function _arrayLikeToArray10(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }
  return arr2;
}
function generateRows(data, _ref) {
  var schema = _ref.schema, headerStyle = _ref.headerStyle, getStyle = _ref.getStyle, getSharedString = _ref.getSharedString, customFont = _ref.customFont, dateFormat = _ref.dateFormat;
  if (schema) {
    var header = [];
    for (var _iterator = _createForOfIteratorHelperLoose7(schema), _step; !(_step = _iterator()).done; ) {
      var column = _step.value;
      if (column.column) {
        header = [schema.map(function(column2) {
          return _objectSpread2({
            type: String,
            value: column2.column,
            align: column2.align
          }, headerStyle || DEFAULT_HEADER_STYLE);
        })];
        break;
      }
    }
    data = header.concat(data.map(function(row) {
      return schema.map(function(column2) {
        return _objectSpread2(_objectSpread2({}, column2), {}, {
          value: column2.value(row)
        });
      });
    }));
  }
  return data.map(function(row, index) {
    return generateRow(row, index, {
      getStyle,
      getSharedString,
      customFont,
      dateFormat,
      usesSchema: schema !== void 0
    });
  }).join("");
}
var DEFAULT_HEADER_STYLE = {
  fontWeight: "bold"
};

// node_modules/write-excel-file/modules/write/column.js
var DATE_COLUMN_DEFAULT_WIDTH = 14;
function generateColumnDescription(column, index) {
  if (!column) {
    return "";
  }
  if (column.type === Date && !column.width) {
    column.width = DATE_COLUMN_DEFAULT_WIDTH;
  }
  if (!column.width) {
    return "";
  }
  var columnNumber = index + 1;
  return '<col min="'.concat(columnNumber, '" max="').concat(columnNumber, '" width="').concat(column.width, '" customWidth="1"/>');
}

// node_modules/write-excel-file/modules/write/columns.js
function generateColumnsDescription(_ref) {
  var schema = _ref.schema, columns = _ref.columns;
  if (schema || columns) {
    var description = (schema || columns).map(generateColumnDescription).join("");
    if (description) {
      return "<cols>".concat(description, "</cols>");
    }
  }
  return "";
}

// node_modules/write-excel-file/modules/write/processMergedCells.js
function processMergedCells(data, _ref) {
  var schema = _ref.schema;
  var mergedCells = [];
  if (schema) {
    return {
      data,
      mergedCells
    };
  }
  var _cloneData = function cloneData() {
    data = data.slice();
    var i = 0;
    while (i < data.length) {
      data[i] = data[i].slice();
      i++;
    }
    _cloneData = function cloneData2() {
      return data;
    };
    return data;
  };
  var rowIndex = 0;
  while (rowIndex < data.length) {
    var row = data[rowIndex];
    var columnIndex = 0;
    while (columnIndex < row.length) {
      var cell2 = row[columnIndex];
      if (cell2) {
        var _cell$span = cell2.span, span = _cell$span === void 0 ? 1 : _cell$span, _cell$rowSpan = cell2.rowSpan, rowSpan = _cell$rowSpan === void 0 ? 1 : _cell$rowSpan;
        if (span > 1 || rowSpan > 1) {
          processSpanningCells({
            data,
            rowIndex,
            columnIndex,
            span,
            rowSpan,
            cloneData: _cloneData
          });
          mergedCells.push([[rowIndex, columnIndex], [rowIndex + (rowSpan ? rowSpan - 1 : 0), columnIndex + (span ? span - 1 : 0)]]);
        }
      }
      columnIndex++;
    }
    rowIndex++;
  }
  return {
    data,
    mergedCells
  };
}
function processSpanningCells(_ref2) {
  var data = _ref2.data, rowIndex = _ref2.rowIndex, columnIndex = _ref2.columnIndex, span = _ref2.span, rowSpan = _ref2.rowSpan, cloneData = _ref2.cloneData;
  var cellStyleProperties = getCellStyleProperties(data[rowIndex][columnIndex]);
  if (cellStyleProperties) {
    data = cloneData();
  }
  var i = rowIndex;
  while (i <= rowIndex + (rowSpan - 1)) {
    var j = columnIndex;
    while (j <= columnIndex + (span - 1)) {
      var cell2 = data[i][j];
      if (i > rowIndex || j > columnIndex) {
        if (cell2 !== null && cell2 !== void 0) {
          throw new Error("[write-excel-file] When using `span` or `rowSpan` parameters, all hidden overlapped cells should be represented by `null`s or `undefined`s. Cell at row ".concat(rowIndex + 1, " and column ").concat(columnIndex + 1, " is configured with `span` ").concat(span, " and `rowSpan` ").concat(rowSpan, ". Cell at row ").concat(i + 1, " and column ").concat(j + 1, " is neither `null` nor `undefined`: ").concat(JSON.stringify(cell2)));
        }
        if (cellStyleProperties) {
          data[i][j] = cellStyleProperties;
        }
      }
      j++;
    }
    i++;
  }
}

// node_modules/write-excel-file/modules/write/generateMergedCellsDescription.js
function _slicedToArray5(arr, i) {
  return _arrayWithHoles5(arr) || _iterableToArrayLimit5(arr, i) || _unsupportedIterableToArray11(arr, i) || _nonIterableRest5();
}
function _nonIterableRest5() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray11(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray11(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray11(o, minLen);
}
function _arrayLikeToArray11(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }
  return arr2;
}
function _iterableToArrayLimit5(arr, i) {
  var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
  if (_i == null)
    return;
  var _arr = [];
  var _n = true;
  var _d = false;
  var _s, _e;
  try {
    for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);
      if (i && _arr.length === i)
        break;
    }
  } catch (err3) {
    _d = true;
    _e = err3;
  } finally {
    try {
      if (!_n && _i["return"] != null)
        _i["return"]();
    } finally {
      if (_d)
        throw _e;
    }
  }
  return _arr;
}
function _arrayWithHoles5(arr) {
  if (Array.isArray(arr))
    return arr;
}
function generateMergedCellsDescription(mergedCells) {
  if (mergedCells.length === 0) {
    return "";
  }
  return '<mergeCells count="'.concat(mergedCells.length, '">') + mergedCells.map(function(_ref) {
    var _ref2 = _slicedToArray5(_ref, 2), from = _ref2[0], to = _ref2[1];
    var coordinates = generateCellNumber(from[1], from[0] + 1) + ":" + generateCellNumber(to[1], to[0] + 1);
    return '<mergeCell ref="'.concat(coordinates, '"/>');
  }).join("") + "</mergeCells>";
}

// node_modules/write-excel-file/modules/xml/sanitizeAttributeValue.js
function sanitizeAttributeValue(string) {
  return escapeXmlCharacters(removeInvalidXmlCharacters(string), {
    attribute: true
  });
}

// node_modules/write-excel-file/modules/write/layout.js
function generateLayout(_ref) {
  var sheetId = _ref.sheetId, orientation = _ref.orientation;
  var layout = "";
  if (orientation) {
    var marginLeft = 0.7;
    var marginRight = 0.7;
    var marginTop = 0.75;
    var marginBottom = 0.75;
    var header = 0.3;
    var footer = 0.3;
    layout += "<pageMargins";
    layout += ' left="'.concat(marginLeft, '"');
    layout += ' right="'.concat(marginRight, '"');
    layout += ' top="'.concat(marginTop, '"');
    layout += ' bottom="'.concat(marginBottom, '"');
    layout += ' header="'.concat(header, '"');
    layout += ' footer="'.concat(footer, '"');
    layout += "/>";
  }
  if (orientation) {
    var paperSize = 9;
    layout += "<pageSetup";
    layout += ' paperSize="'.concat(paperSize, '"');
    layout += ' orientation="'.concat(sanitizeAttributeValue(orientation), '"');
    layout += ' r:id="rId'.concat(sheetId, '"');
    layout += "/>";
  }
  return layout;
}

// node_modules/write-excel-file/modules/write/views.js
function generateViews(_ref) {
  var stickyRowsCount = _ref.stickyRowsCount, stickyColumnsCount = _ref.stickyColumnsCount;
  if (!stickyRowsCount && !stickyColumnsCount) {
    return "";
  }
  var views = "";
  views += "<sheetViews>";
  views += '<sheetView tabSelected="1" workbookViewId="0">';
  views += '<pane ySplit="'.concat(stickyRowsCount || 0, '" xSplit="').concat(stickyColumnsCount || 0, '" topLeftCell="').concat(generateCellNumber(stickyColumnsCount || 0, (stickyRowsCount || 0) + 1), '" activePane="bottomRight" state="frozen"/>');
  views += "</sheetView>";
  views += "</sheetViews>";
  return views;
}

// node_modules/write-excel-file/modules/write/worksheet.js
var WORKSHEET_TEMPLATE = '<?xml version="1.0" ?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:mx="http://schemas.microsoft.com/office/mac/excel/2008/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">{views}{columnsDescription}<sheetData>{data}</sheetData>{mergedCellsDescription}{layout}</worksheet>';
function generateWorksheet(data_, _ref) {
  var schema = _ref.schema, columns = _ref.columns, headerStyle = _ref.headerStyle, getStyle = _ref.getStyle, getSharedString = _ref.getSharedString, customFont = _ref.customFont, dateFormat = _ref.dateFormat, orientation = _ref.orientation, stickyRowsCount = _ref.stickyRowsCount, stickyColumnsCount = _ref.stickyColumnsCount, sheetId = _ref.sheetId;
  validateData(data_, {
    schema
  });
  var _processMergedCells = processMergedCells(data_, {
    schema
  }), data = _processMergedCells.data, mergedCells = _processMergedCells.mergedCells;
  return WORKSHEET_TEMPLATE.replace("{data}", generateRows(data, {
    schema,
    headerStyle,
    getStyle,
    getSharedString,
    customFont,
    dateFormat
  })).replace("{views}", generateViews({
    stickyRowsCount,
    stickyColumnsCount
  })).replace("{columnsDescription}", generateColumnsDescription({
    schema,
    columns
  })).replace("{mergedCellsDescription}", generateMergedCellsDescription(mergedCells)).replace("{layout}", generateLayout({
    sheetId,
    orientation
  }));
}
function validateData(data, _ref2) {
  var schema = _ref2.schema;
  if (schema) {
    if (!Array.isArray(data)) {
      throw new TypeError("Expected an array of objects");
    }
  } else {
    if (!Array.isArray(data)) {
      throw new TypeError("Expected an array of arrays");
    }
    if (data.length > 0) {
      if (!Array.isArray(data[0])) {
        throw new TypeError("Expected an array of arrays");
      }
    }
  }
}

// node_modules/write-excel-file/modules/write/styles.js
function _createForOfIteratorHelperLoose8(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray12(o)) || allowArrayLike && o && typeof o.length === "number") {
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
function _unsupportedIterableToArray12(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray12(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray12(o, minLen);
}
function _arrayLikeToArray12(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }
  return arr2;
}
var FORMAT_ID_STARTS_FROM = 100;
function initStyles(_ref) {
  var defaultFontFamily = _ref.fontFamily, defaultFontSize = _ref.fontSize;
  var customFont = Boolean(defaultFontFamily || defaultFontSize);
  if (defaultFontFamily === void 0) {
    defaultFontFamily = "Calibri";
  }
  if (defaultFontSize === void 0) {
    defaultFontSize = 12;
  }
  var formats = [];
  var formatsIndex = {};
  var styles = [];
  var stylesIndex = {};
  var fonts = [];
  var fontsIndex = {};
  var fills = [];
  var fillsIndex = {};
  var borders = [];
  var bordersIndex = {};
  fonts.push({
    size: defaultFontSize,
    family: defaultFontFamily,
    custom: customFont
  });
  fontsIndex["-:-"] = 0;
  fills.push({});
  fillsIndex["-"] = 0;
  borders.push({
    left: {},
    right: {},
    top: {},
    bottom: {}
  });
  bordersIndex["-:-/-:-/-:-/-:-"] = 0;
  fills.push({
    gray125: true
  });
  function getStyle(_ref2, _ref3) {
    var align = _ref2.align, alignVertical = _ref2.alignVertical, textRotation = _ref2.textRotation, wrap = _ref2.wrap, fontFamily = _ref2.fontFamily, fontSize = _ref2.fontSize, fontWeight = _ref2.fontWeight, fontStyle = _ref2.fontStyle, color = _ref2.color, backgroundColor = _ref2.backgroundColor, borderColor = _ref2.borderColor, borderStyle = _ref2.borderStyle, leftBorderColor = _ref2.leftBorderColor, leftBorderStyle = _ref2.leftBorderStyle, rightBorderColor = _ref2.rightBorderColor, rightBorderStyle = _ref2.rightBorderStyle, topBorderColor = _ref2.topBorderColor, topBorderStyle = _ref2.topBorderStyle, bottomBorderColor = _ref2.bottomBorderColor, bottomBorderStyle = _ref2.bottomBorderStyle;
    var format = _ref3.format;
    var border = void 0;
    var fontKey = "".concat(fontFamily || "-", ":").concat(fontSize || "-", ":").concat(fontWeight || "-", ":").concat(fontStyle || "-", ":").concat(color || "-");
    var fillKey = backgroundColor || "-";
    var borderKey = "".concat(topBorderColor || borderColor || "-", ":").concat(topBorderStyle || borderStyle || "-") + "/" + "".concat(rightBorderColor || borderColor || "-", ":").concat(rightBorderStyle || borderStyle || "-") + "/" + "".concat(bottomBorderColor || borderColor || "-", ":").concat(bottomBorderStyle || borderStyle || "-") + "/" + "".concat(leftBorderColor || borderColor || "-", ":").concat(leftBorderStyle || borderStyle || "-");
    var key = "".concat(align || "-", "/").concat(alignVertical || "-", "/").concat(textRotation || "-", "/").concat(format || "-", "/").concat(wrap || "-", "/").concat(fontKey, "/").concat(fillKey, "/").concat(borderKey);
    var styleId = stylesIndex[key];
    if (styleId !== void 0) {
      return styleId;
    }
    var formatId;
    if (format) {
      formatId = formatsIndex[format];
      if (formatId === void 0) {
        formatId = formatsIndex[format] = String(FORMAT_ID_STARTS_FROM + formats.length);
        formats.push(format);
      }
    }
    var fontId = customFont ? 0 : void 0;
    if (fontFamily || fontSize || fontWeight || fontStyle || color) {
      fontId = fontsIndex[fontKey];
      if (fontId === void 0) {
        fontId = fontsIndex[fontKey] = String(fonts.length);
        fonts.push({
          custom: true,
          size: fontSize || defaultFontSize,
          family: fontFamily || defaultFontFamily,
          weight: fontWeight,
          style: fontStyle,
          color
        });
      }
    }
    var fillId;
    if (backgroundColor) {
      fillId = fillsIndex[fillKey];
      if (fillId === void 0) {
        fillId = fillsIndex[fillKey] = String(fills.length);
        fills.push({
          color: backgroundColor
        });
      }
    }
    var borderId;
    if (borderColor || borderStyle || leftBorderColor || leftBorderStyle || rightBorderColor || rightBorderStyle || topBorderColor || topBorderStyle || bottomBorderColor || bottomBorderStyle) {
      borderId = bordersIndex[borderKey];
      if (borderId === void 0) {
        borderId = bordersIndex[borderKey] = String(borders.length);
        borders.push({
          left: {
            style: leftBorderStyle || borderStyle,
            color: leftBorderColor || borderColor
          },
          right: {
            style: rightBorderStyle || borderStyle,
            color: rightBorderColor || borderColor
          },
          top: {
            style: topBorderStyle || borderStyle,
            color: topBorderColor || borderColor
          },
          bottom: {
            style: bottomBorderStyle || borderStyle,
            color: bottomBorderColor || borderColor
          }
        });
      }
    }
    styles.push({
      fontId,
      fillId,
      borderId,
      align,
      alignVertical,
      textRotation,
      wrap,
      formatId
    });
    return stylesIndex[key] = String(styles.length - 1);
  }
  getStyle({}, {});
  return {
    getStylesXml: function getStylesXml() {
      return generateXml({
        formats,
        styles,
        fonts,
        fills,
        borders
      });
    },
    getStyle
  };
}
function generateXml(_ref4) {
  var formats = _ref4.formats, styles = _ref4.styles, fonts = _ref4.fonts, fills = _ref4.fills, borders = _ref4.borders;
  var xml = '<?xml version="1.0" ?>';
  xml += '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  if (formats.length > 0) {
    xml += '<numFmts count="'.concat(formats.length, '">');
    for (var i = 0; i < formats.length; i++) {
      xml += '<numFmt numFmtId="'.concat(FORMAT_ID_STARTS_FROM + i, '" formatCode="').concat(sanitizeAttributeValue(formats[i]), '"/>');
    }
    xml += "</numFmts>";
  }
  xml += '<fonts count="'.concat(fonts.length, '">');
  for (var _iterator = _createForOfIteratorHelperLoose8(fonts), _step; !(_step = _iterator()).done; ) {
    var font = _step.value;
    var size = font.size, family = font.family, color = font.color, weight = font.weight, style = font.style, custom = font.custom;
    xml += "<font>";
    xml += '<sz val="'.concat(size, '"/>');
    xml += "<color ".concat(color ? 'rgb="' + sanitizeAttributeValue(getColor(color)) + '"' : 'theme="1"', "/>");
    xml += '<name val="'.concat(sanitizeAttributeValue(family), '"/>');
    xml += '<family val="2"/>';
    if (!custom) {
      xml += '<scheme val="minor"/>';
    }
    if (weight === "bold") {
      xml += "<b/>";
    }
    if (style === "italic") {
      xml += "<i/>";
    }
    xml += "</font>";
  }
  xml += "</fonts>";
  xml += '<fills count="'.concat(fills.length, '">');
  for (var _iterator2 = _createForOfIteratorHelperLoose8(fills), _step2; !(_step2 = _iterator2()).done; ) {
    var fill = _step2.value;
    var _color = fill.color, gray125 = fill.gray125;
    xml += "<fill>";
    if (_color) {
      xml += '<patternFill patternType="solid">';
      xml += '<fgColor rgb="'.concat(sanitizeAttributeValue(getColor(_color)), '"/>');
      xml += '<bgColor indexed="64"/>';
      xml += "</patternFill>";
    } else if (gray125) {
      xml += '<patternFill patternType="gray125"/>';
    } else {
      xml += '<patternFill patternType="none"/>';
    }
    xml += "</fill>";
  }
  xml += "</fills>";
  xml += '<borders count="'.concat(borders.length, '">');
  for (var _iterator3 = _createForOfIteratorHelperLoose8(borders), _step3; !(_step3 = _iterator3()).done; ) {
    var border = _step3.value;
    var left = border.left, right = border.right, top = border.top, bottom = border.bottom;
    var getBorderXml = function getBorderXml2(direction, _ref5) {
      var style2 = _ref5.style, color2 = _ref5.color;
      if (color2 && !style2) {
        style2 = "thin";
      }
      var hasChildren = color2 ? true : false;
      return "<".concat(direction) + (style2 ? ' style="'.concat(sanitizeAttributeValue(style2), '"') : "") + (hasChildren ? ">" : "/>") + (color2 ? '<color rgb="'.concat(sanitizeAttributeValue(getColor(color2)), '"/>') : "") + (hasChildren ? "</".concat(direction, ">") : "");
    };
    xml += "<border>";
    xml += getBorderXml("left", left);
    xml += getBorderXml("right", right);
    xml += getBorderXml("top", top);
    xml += getBorderXml("bottom", bottom);
    xml += "<diagonal/>";
    xml += "</border>";
  }
  xml += "</borders>";
  xml += '<cellXfs count="'.concat(styles.length, '">');
  for (var _iterator4 = _createForOfIteratorHelperLoose8(styles), _step4; !(_step4 = _iterator4()).done; ) {
    var cellStyle = _step4.value;
    var fontId = cellStyle.fontId, fillId = cellStyle.fillId, borderId = cellStyle.borderId, align = cellStyle.align, alignVertical = cellStyle.alignVertical, textRotation = cellStyle.textRotation, wrap = cellStyle.wrap, formatId = cellStyle.formatId;
    xml += "<xf " + [
      formatId !== void 0 ? 'numFmtId="'.concat(formatId, '"') : void 0,
      formatId !== void 0 ? 'applyNumberFormat="1"' : void 0,
      fontId !== void 0 ? 'fontId="'.concat(fontId, '"') : void 0,
      fontId !== void 0 ? 'applyFont="1"' : void 0,
      fillId !== void 0 ? 'fillId="'.concat(fillId, '"') : void 0,
      fillId !== void 0 ? 'applyFill="1"' : void 0,
      borderId !== void 0 ? 'borderId="'.concat(borderId, '"') : void 0,
      borderId !== void 0 ? 'applyBorder="1"' : void 0,
      align || alignVertical || textRotation || wrap ? 'applyAlignment="1"' : void 0
      // 'xfId="0"'
    ].filter(function(_) {
      return _;
    }).join(" ") + ">" + // Possible horizontal alignment values:
    //  left, center, right, fill, justify, center_across, distributed.
    // Possible vertical alignment values:
    //  top, vcenter, bottom, vjustify, vdistributed.
    // https://xlsxwriter.readthedocs.io/format.html#set_align
    (align || alignVertical || textRotation || wrap ? "<alignment" + (align ? ' horizontal="'.concat(sanitizeAttributeValue(align), '"') : "") + (alignVertical ? ' vertical="'.concat(sanitizeAttributeValue(alignVertical), '"') : "") + (wrap ? ' wrapText="1"' : "") + (textRotation ? ' textRotation="'.concat(getTextRotation(validateTextRotation(textRotation)), '"') : "") + "/>" : "") + "</xf>";
  }
  xml += "</cellXfs>";
  xml += "</styleSheet>";
  return xml;
}
function getColor(color) {
  if (color[0] !== "#") {
    throw new Error('Color "'.concat(color, '" must start with a "#"'));
  }
  return "FF".concat(color.slice("#".length).toUpperCase());
}
function validateTextRotation(textRotation) {
  if (!(textRotation >= -90 && textRotation <= 90)) {
    throw new Error("Unsupported text rotation angle: ".concat(textRotation, ". Values from -90 to 90 are supported."));
  }
  return textRotation;
}
function getTextRotation(textRotation) {
  if (textRotation < 0) {
    return 90 - textRotation;
  }
  return textRotation;
}

// node_modules/write-excel-file/modules/write/sharedStrings.js
function _createForOfIteratorHelperLoose9(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray13(o)) || allowArrayLike && o && typeof o.length === "number") {
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
function _unsupportedIterableToArray13(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray13(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray13(o, minLen);
}
function _arrayLikeToArray13(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }
  return arr2;
}
function initSharedStrings() {
  var sharedStrings = [];
  var sharedStringsIndex = {};
  return {
    getSharedStringsXml: function getSharedStringsXml() {
      return generateXml2(sharedStrings);
    },
    getSharedString: function getSharedString(string) {
      var id = sharedStringsIndex[string];
      if (id === void 0) {
        id = String(sharedStrings.length);
        sharedStringsIndex[string] = id;
        sharedStrings.push(string);
      }
      return id;
    }
  };
}
function generateXml2(sharedStrings) {
  var xml = '<?xml version="1.0"?>';
  xml += '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  for (var _iterator = _createForOfIteratorHelperLoose9(sharedStrings), _step; !(_step = _iterator()).done; ) {
    var string = _step.value;
    var attributes = string.trim().length === string.length ? "" : ' xml:space="preserve"';
    xml += "<si><t".concat(attributes, ">");
    xml += sanitizeText(string);
    xml += "</t></si>";
  }
  xml += "</sst>";
  return xml;
}

// node_modules/write-excel-file/modules/write/validateSheetName.js
var ILLEGAL_CHARACTERS_IN_SHEET_NAME = /[\[\]\/\\:*?]+/;
function validateSheetName(sheetName) {
  if (!sheetName) {
    throw new Error("Sheet name can't be empty");
  }
  if (sheetName.length > 31) {
    throw new Error('Sheet name "'.concat(sheetName, `" can't be longer than 31 characters`));
  }
  if (ILLEGAL_CHARACTERS_IN_SHEET_NAME.test(sheetName)) {
    throw new Error('Sheet name "'.concat(sheetName, '" contains illegal characters: []/\\:*?'));
  }
}

// node_modules/write-excel-file/modules/write/writeXlsxFile.common.js
function _createForOfIteratorHelperLoose10(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray14(o)) || allowArrayLike && o && typeof o.length === "number") {
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
function _unsupportedIterableToArray14(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray14(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray14(o, minLen);
}
function _arrayLikeToArray14(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }
  return arr2;
}
function generateSheets(_ref) {
  var data = _ref.data, sheetName = _ref.sheetName, sheetNames = _ref.sheetNames, schema = _ref.schema, columns = _ref.columns, headerStyle = _ref.headerStyle, fontFamily = _ref.fontFamily, fontSize = _ref.fontSize, orientation = _ref.orientation, stickyRowsCount = _ref.stickyRowsCount, stickyColumnsCount = _ref.stickyColumnsCount, dateFormat = _ref.dateFormat;
  var _initSharedStrings = initSharedStrings(), getSharedStringsXml = _initSharedStrings.getSharedStringsXml, getSharedString = _initSharedStrings.getSharedString;
  var _initStyles = initStyles({
    fontFamily,
    fontSize
  }), getStylesXml = _initStyles.getStylesXml, getStyle = _initStyles.getStyle;
  if (sheetNames) {
    if (columns) {
      if (!Array.isArray(columns[0])) {
        throw new Error('In a "write multiple sheets" scenario, `columns` parameter must be an array of `columns` for each sheet.');
      }
    }
  }
  if (!sheetNames) {
    sheetNames = [sheetName || "Sheet1"];
    data = [data];
    if (columns) {
      columns = [columns];
    }
    if (schema) {
      schema = [schema];
    }
  }
  for (var _iterator = _createForOfIteratorHelperLoose10(sheetNames), _step; !(_step = _iterator()).done; ) {
    var _sheetName = _step.value;
    validateSheetName(_sheetName);
  }
  var worksheets = [];
  var sheetIndex = 0;
  for (var _iterator2 = _createForOfIteratorHelperLoose10(sheetNames), _step2; !(_step2 = _iterator2()).done; ) {
    var sheet = _step2.value;
    worksheets.push(generateWorksheet(data[sheetIndex], {
      schema: schema && schema[sheetIndex],
      columns: columns && columns[sheetIndex],
      headerStyle,
      getStyle,
      getSharedString,
      customFont: fontFamily || fontSize,
      dateFormat,
      orientation,
      stickyRowsCount,
      stickyColumnsCount,
      sheetId: sheetIndex + 1
    }));
    sheetIndex++;
  }
  return {
    sheets: sheetNames.map(function(sheetName2, i) {
      return {
        id: i + 1,
        name: sheetName2,
        data: worksheets[i]
      };
    }),
    getSharedStringsXml,
    getStylesXml
  };
}

// node_modules/write-excel-file/modules/write/writeXlsxFileBrowser.js
var _excluded = ["fileName"];
function _createForOfIteratorHelperLoose11(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it)
    return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray15(o)) || allowArrayLike && o && typeof o.length === "number") {
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
function _unsupportedIterableToArray15(o, minLen) {
  if (!o)
    return;
  if (typeof o === "string")
    return _arrayLikeToArray15(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor)
    n = o.constructor.name;
  if (n === "Map" || n === "Set")
    return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray15(o, minLen);
}
function _arrayLikeToArray15(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }
  return arr2;
}
function _objectWithoutProperties(source, excluded) {
  if (source == null)
    return {};
  var target = _objectWithoutPropertiesLoose(source, excluded);
  var key, i;
  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0)
        continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key))
        continue;
      target[key] = source[key];
    }
  }
  return target;
}
function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null)
    return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;
  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0)
      continue;
    target[key] = source[key];
  }
  return target;
}
function writeXlsxFile(data) {
  var _ref = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, fileName = _ref.fileName, rest = _objectWithoutProperties(_ref, _excluded);
  return generateXlsxFile(data, rest).then(function(blob) {
    if (fileName) {
      return import_file_saver.default.saveAs(blob, fileName);
    }
    return blob;
  });
}
function generateXlsxFile(data, _ref2) {
  var sheetName = _ref2.sheet, sheetNames = _ref2.sheets, schema = _ref2.schema, columns = _ref2.columns, headerStyle = _ref2.headerStyle, fontFamily = _ref2.fontFamily, fontSize = _ref2.fontSize, orientation = _ref2.orientation, stickyRowsCount = _ref2.stickyRowsCount, stickyColumnsCount = _ref2.stickyColumnsCount, dateFormat = _ref2.dateFormat;
  var zip = new import_jszip.default();
  zip.file("_rels/.rels", rels_default);
  zip.file("[Content_Types].xml", Content_Types_xml_default);
  var _generateSheets = generateSheets({
    data,
    sheetName,
    sheetNames,
    schema,
    columns,
    headerStyle,
    fontFamily,
    fontSize,
    orientation,
    stickyRowsCount,
    stickyColumnsCount,
    dateFormat
  }), sheets = _generateSheets.sheets, getSharedStringsXml = _generateSheets.getSharedStringsXml, getStylesXml = _generateSheets.getStylesXml;
  var xl = zip.folder("xl");
  xl.file("_rels/workbook.xml.rels", generateWorkbookXmlRels({
    sheets
  }));
  xl.file("workbook.xml", generateWorkbookXml({
    sheets,
    stickyRowsCount,
    stickyColumnsCount
  }));
  xl.file("styles.xml", getStylesXml());
  xl.file("sharedStrings.xml", getSharedStringsXml());
  for (var _iterator = _createForOfIteratorHelperLoose11(sheets), _step; !(_step = _iterator()).done; ) {
    var _step$value = _step.value, id = _step$value.id, _data = _step$value.data;
    xl.file("worksheets/sheet".concat(id, ".xml"), _data);
  }
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

// src/io/export/xlsx.ts
function sheetNameFor(name) {
  const safe = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
  return safe === "" ? "Sheet1" : safe;
}
function xlsxCell(value, field) {
  if (value === null || value === void 0)
    return { value: null };
  if (field.type === "checkbox" && typeof value === "boolean")
    return { value };
  if (field.type === "number" && typeof value === "number")
    return { value };
  if (field.type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()))
      return { value: d, format: "yyyy-mm-dd" };
  }
  const text = cellText(value, field);
  return { value: text === "" ? null : text };
}
async function toXlsx(table) {
  const header = table.fields.map((f) => ({ value: f.name, fontWeight: "bold" }));
  const body = table.rows.map((row) => table.fields.map((f) => xlsxCell(row.values[f.id] ?? null, f)));
  const blob = await writeXlsxFile([header, ...body], { sheet: sheetNameFor(table.name) });
  return await blob.arrayBuffer();
}

// src/io/export/exporter.ts
var EXTENSION = { csv: "csv", xlsx: "xlsx", md: "md" };
async function exportTable(input) {
  const resolved = resolveExportTable(input.file, input.scope);
  if (!resolved.ok)
    return { ok: false, error: resolved.error };
  const table = resolved.table;
  const ext = EXTENSION[input.format];
  let text = null;
  let binary2 = null;
  try {
    if (input.format === "csv")
      text = toCsv(table);
    else if (input.format === "md")
      text = toMarkdown(table);
    else
      binary2 = await toXlsx(table);
  } catch (e) {
    return { ok: false, error: `Export failed, no file was written: ${e instanceof Error ? e.message : String(e)}` };
  }
  const path = pickFreePath(input.folder, input.baseName || "Export", input.adapter.exists, ext);
  if (path === null)
    return { ok: false, error: "No free file name found." };
  try {
    if (text !== null)
      await input.adapter.create(path, text);
    else if (binary2 !== null)
      await input.adapter.createBinary(path, binary2);
  } catch (e) {
    return { ok: false, error: `Could not write the file: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true, path, rowCount: table.rows.length, columnCount: table.fields.length };
}

// src/commands/export.ts
var EXPORT_COMMAND_ID = "export-table";
var EXPORT_COMMAND_NAME = "Export table (CSV, Excel, Markdown)";
function registerExportCommand(plugin) {
  plugin.addCommand({
    id: EXPORT_COMMAND_ID,
    name: EXPORT_COMMAND_NAME,
    callback: () => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file || file.extension !== "tablify") {
        new import_obsidian2.Notice("Open a .tablify table first.");
        return;
      }
      new ExportModal(plugin.app, file).open();
    }
  });
}
function openExportModal(app, file) {
  new ExportModal(app, file).open();
}
var ExportModal = class extends import_obsidian2.Modal {
  constructor(app, source) {
    super(app);
    this.source = source;
  }
  format = "csv";
  fullTable = false;
  onOpen() {
    this.setTitle(`Export ${this.source.basename}`);
    new import_obsidian2.Setting(this.contentEl).setName("Format").addDropdown(
      (d) => d.addOption("csv", "CSV").addOption("xlsx", "Excel (.xlsx)").addOption("md", "Markdown table").setValue(this.format).onChange((v) => {
        this.format = v;
      })
    );
    new import_obsidian2.Setting(this.contentEl).setName("Full table").setDesc("Off: current view (saved sort, visible fields, column order). On: every field and row.").addToggle(
      (t) => t.setValue(this.fullTable).onChange((v) => {
        this.fullTable = v;
      })
    );
    new import_obsidian2.Setting(this.contentEl).addButton(
      (b) => b.setButtonText("Export").setCta().onClick(() => void this.run())
    );
  }
  async run() {
    const app = this.app;
    const text = await app.vault.read(this.source);
    const parsed = parse(text);
    if (!parsed.ok) {
      new import_obsidian2.Notice(`Export failed. The table file could not be read: ${parsed.error}`);
      return;
    }
    const folder = this.source.parent && !this.source.parent.isRoot() ? this.source.parent.path : "";
    const outcome = await exportTable({
      file: parsed.data,
      format: this.format,
      scope: { fullTable: this.fullTable },
      folder,
      baseName: this.source.basename,
      adapter: {
        exists: (path) => app.vault.getAbstractFileByPath(path) !== null,
        create: async (path, data) => {
          await app.vault.create(path, data);
        },
        createBinary: async (path, data) => {
          await app.vault.createBinary(path, data);
        }
      }
    });
    if (!outcome.ok) {
      new import_obsidian2.Notice(`Export failed. No file was written. ${outcome.error}`);
      return;
    }
    new import_obsidian2.Notice(`Exported ${outcome.rowCount} rows and ${outcome.columnCount} columns to ${outcome.path}.`);
    this.close();
  }
};

// src/commands/linkIntegrity.ts
var import_obsidian3 = require("obsidian");

// src/links/linkModel.ts
var UNTITLED_ROW = "Untitled row";
var BROKEN_MESSAGES = {
  "missing-table": "The linked table is not in this vault.",
  "missing-row": "The linked row was deleted."
};
function baseName(path) {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.tablify$/i, "");
}
function primaryFieldOf(fields) {
  return fields.find((f) => f.primary) ?? fields[0];
}
function isNonEmptyLinkArray(v) {
  return Array.isArray(v) && v.length > 0;
}
function snapshotTable(file, path) {
  const primary = primaryFieldOf(file.fields);
  const linkFields = file.fields.filter((f) => f.type === "link");
  const rows = [];
  const linkCells = [];
  for (const row of file.rows) {
    const label = primary ? getFieldType(primary.type).format(row.values[primary.id] ?? null, primary) : "";
    rows.push({ id: row.id, label });
    for (const field of linkFields) {
      const v = row.values[field.id];
      if (isNonEmptyLinkArray(v)) {
        linkCells.push({ rowId: row.id, rowLabel: label, fieldId: field.id, fieldName: field.name, refs: v });
      }
    }
  }
  return { tableId: file.tableId, name: baseName(path), path, rows, linkCells };
}
var LinkIndex = class {
  byPath = /* @__PURE__ */ new Map();
  derived = null;
  rowMaps = /* @__PURE__ */ new WeakMap();
  /** Add or replace the snapshot for a path. */
  put(snapshot) {
    this.byPath.set(snapshot.path, snapshot);
    this.derived = null;
  }
  remove(path) {
    if (this.byPath.delete(path))
      this.derived = null;
  }
  has(path) {
    return this.byPath.has(path);
  }
  paths() {
    return [...this.byPath.keys()];
  }
  /** The snapshot for a path, or undefined. Used to compare before a write. */
  get(path) {
    return this.byPath.get(path);
  }
  /** One snapshot per table ID, sorted by path. A duplicate ID keeps the first path only. */
  tables() {
    return [...this.derive().byId.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  }
  byTableId(tableId) {
    return this.derive().byId.get(tableId);
  }
  duplicates() {
    return this.derive().duplicates.map((d) => ({ tableId: d.tableId, paths: [...d.paths] }));
  }
  resolve(ref) {
    const table = this.byTableId(ref.tableId);
    if (!table)
      return { ok: false, reason: "missing-table" };
    const row = this.rowMap(table).get(ref.rowId);
    if (!row)
      return { ok: false, reason: "missing-row", tableName: table.name };
    return { ok: true, tableName: table.name, rowLabel: row.label.trim() || UNTITLED_ROW };
  }
  rowMap(table) {
    let map2 = this.rowMaps.get(table);
    if (!map2) {
      map2 = new Map(table.rows.map((r) => [r.id, r]));
      this.rowMaps.set(table, map2);
    }
    return map2;
  }
  derive() {
    if (this.derived)
      return this.derived;
    const sorted = [...this.byPath.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    const byId = /* @__PURE__ */ new Map();
    const dupPaths = /* @__PURE__ */ new Map();
    for (const snap of sorted) {
      const first = byId.get(snap.tableId);
      if (!first) {
        byId.set(snap.tableId, snap);
      } else {
        const list = dupPaths.get(snap.tableId) ?? [first.path];
        list.push(snap.path);
        dupPaths.set(snap.tableId, list);
      }
    }
    const duplicates = [...dupPaths.entries()].map(([tableId, paths]) => ({ tableId, paths }));
    this.derived = { byId, duplicates };
    return this.derived;
  }
};
function createLinkIndex() {
  return new LinkIndex();
}
function summarizeLinks(value, index) {
  if (!isNonEmptyLinkArray(value))
    return { text: "", broken: 0 };
  const parts = [];
  let broken = 0;
  for (const ref of value) {
    const res = index.resolve(ref);
    if (res.ok) {
      parts.push(res.rowLabel);
    } else {
      broken++;
      parts.push(res.reason === "missing-table" ? "Missing table" : "Missing row");
    }
  }
  return { text: parts.join(", "), broken };
}
function checkIntegrity(index) {
  const broken = [];
  let checked = 0;
  for (const table of index.tables()) {
    for (const cell2 of table.linkCells) {
      for (const ref of cell2.refs) {
        checked++;
        const res = index.resolve(ref);
        if (res.ok)
          continue;
        broken.push({
          sourcePath: table.path,
          sourceTable: table.name,
          rowId: cell2.rowId,
          rowLabel: cell2.rowLabel.trim() || UNTITLED_ROW,
          fieldName: cell2.fieldName,
          targetTableId: ref.tableId,
          targetRowId: ref.rowId,
          reason: res.reason,
          message: BROKEN_MESSAGES[res.reason]
        });
      }
    }
  }
  return { checked, broken, duplicates: index.duplicates() };
}
function buildSelection(current, targetTableId, selectedRowIds) {
  const selected = new Set(selectedRowIds);
  const kept = [];
  const seen = /* @__PURE__ */ new Set();
  for (const ref of current) {
    if (ref.tableId !== targetTableId) {
      kept.push(ref);
    } else if (selected.has(ref.rowId) && !seen.has(ref.rowId)) {
      kept.push(ref);
      seen.add(ref.rowId);
    }
  }
  for (const rowId of selectedRowIds) {
    if (!seen.has(rowId)) {
      kept.push({ tableId: targetTableId, rowId });
      seen.add(rowId);
    }
  }
  return kept.length > 0 ? kept : null;
}
function filterRows(rows, query) {
  const q = query.trim().toLowerCase();
  if (q === "")
    return rows.slice();
  return rows.filter((r) => r.label.toLowerCase().includes(q));
}

// src/links/vaultLinkIndex.ts
var DEBOUNCE_MS = 250;
var VaultLinkIndex = class {
  constructor(app) {
    this.app = app;
  }
  index = createLinkIndex();
  /** Paths whose file is open in a view, mapped to the live snapshot. */
  live = /* @__PURE__ */ new Map();
  /** mtime of the disk version last read, per path. */
  stamps = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  timer = null;
  running = Promise.resolve();
  /** Wire the vault events and run the first refresh. Called once from the plugin's onload. */
  start(plugin) {
    const schedule = () => this.schedule();
    plugin.registerEvent(this.app.vault.on("create", schedule));
    plugin.registerEvent(this.app.vault.on("modify", schedule));
    plugin.registerEvent(this.app.vault.on("delete", schedule));
    plugin.registerEvent(this.app.vault.on("rename", schedule));
    this.app.workspace.onLayoutReady(() => void this.refresh());
  }
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /** Refresh now. Refreshes run one after another, so two never overlap. */
  refresh() {
    this.running = this.running.then(() => this.doRefresh(), () => this.doRefresh());
    return this.running;
  }
  /** An open view publishes its state. Listeners are told only when the snapshot changed. */
  noteLive(path, snapshot) {
    this.live.set(path, snapshot);
    const prev = this.index.get(path);
    if (prev && JSON.stringify(prev) === JSON.stringify(snapshot))
      return;
    this.index.put(snapshot);
    this.notify();
  }
  /** The view closed. The next refresh reads the file from disk again. */
  dropLive(path) {
    this.live.delete(path);
    this.stamps.delete(path);
    this.schedule();
  }
  schedule() {
    if (this.timer !== null)
      clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, DEBOUNCE_MS);
  }
  async doRefresh() {
    const files = this.app.vault.getFiles().filter((f) => f.extension === "tablify");
    const present = /* @__PURE__ */ new Set();
    let changed = false;
    for (const file of files) {
      present.add(file.path);
      if (this.live.has(file.path))
        continue;
      if (this.stamps.get(file.path) === file.stat.mtime)
        continue;
      const text = await this.app.vault.cachedRead(file);
      this.stamps.set(file.path, file.stat.mtime);
      const parsed = parse(text);
      if (parsed.ok) {
        this.index.put(snapshotTable(parsed.data, file.path));
      } else {
        this.index.remove(file.path);
      }
      changed = true;
    }
    for (const path of this.index.paths()) {
      if (!present.has(path)) {
        this.index.remove(path);
        this.stamps.delete(path);
        this.live.delete(path);
        changed = true;
      }
    }
    for (const path of [...this.live.keys()]) {
      if (!present.has(path))
        this.live.delete(path);
    }
    if (changed)
      this.notify();
  }
  notify() {
    for (const listener of [...this.listeners])
      listener();
  }
};
var indexes = /* @__PURE__ */ new WeakMap();
function linkIndexFor(app) {
  let idx = indexes.get(app);
  if (!idx) {
    idx = new VaultLinkIndex(app);
    indexes.set(app, idx);
  }
  return idx;
}

// src/commands/linkIntegrity.ts
var LINK_INTEGRITY_COMMAND_ID = "tablify-link-integrity";
var LINK_INTEGRITY_COMMAND_NAME = "Check link integrity (all tables)";
function registerLinkIntegrityCommand(plugin) {
  plugin.addCommand({
    id: LINK_INTEGRITY_COMMAND_ID,
    name: LINK_INTEGRITY_COMMAND_NAME,
    callback: () => void runLinkIntegrityCheck(plugin.app)
  });
}
async function runLinkIntegrityCheck(app) {
  const idx = linkIndexFor(app);
  await idx.refresh();
  new LinkIntegrityModal(app, checkIntegrity(idx.index)).open();
}
var LinkIntegrityModal = class extends import_obsidian3.Modal {
  constructor(app, report) {
    super(app);
    this.report = report;
  }
  onOpen() {
    const r = this.report;
    this.setTitle("Link integrity");
    this.modalEl.addClass("tablify__modal");
    const summary = r.broken.length === 0 ? `No broken links. ${r.checked} ${r.checked === 1 ? "link" : "links"} checked.` : `${r.broken.length} broken of ${r.checked} ${r.checked === 1 ? "link" : "links"} checked.`;
    this.contentEl.createEl("p", { text: summary, cls: "tablify-link-integrity__summary" });
    if (r.broken.length > 0) {
      const list = this.contentEl.createEl("ul", { cls: "tablify-link-integrity__list" });
      for (const b of r.broken) {
        const item = list.createEl("li");
        item.createSpan({ text: `${b.sourceTable} (${b.sourcePath})`, cls: "tablify-link-integrity__where" });
        item.createSpan({ text: ` \xB7 ${b.fieldName} \xB7 ${b.rowLabel}: ${b.message}` });
        item.createDiv({ text: `Target: table ${b.targetTableId}, row ${b.targetRowId}`, cls: "tablify-link-integrity__target" });
      }
    }
    if (r.duplicates.length > 0) {
      this.contentEl.createEl("p", {
        text: "Some files share a table ID. Only the first file is used for links (copy a table to get a new ID).",
        cls: "tablify-link-integrity__summary"
      });
      const list = this.contentEl.createEl("ul", { cls: "tablify-link-integrity__list" });
      for (const d of r.duplicates) {
        list.createEl("li", { text: `${d.tableId}: ${d.paths.join(", ")}` });
      }
    }
  }
};

// src/views/tableView.ts
var import_obsidian8 = require("obsidian");

// src/model/tableStore.ts
function createTableStore(options) {
  const fields = [...options.fields];
  const rowMap = /* @__PURE__ */ new Map();
  const displayOrder = [];
  let autoNumberCounter = options.initialAutoNumber ?? 1;
  if (options.initialRows) {
    for (const row of options.initialRows) {
      const copy = cloneRow(row);
      rowMap.set(copy.id, copy);
      displayOrder.push(copy.id);
      const autoNumField = fields.find((f) => f.type === "auto_number");
      if (autoNumField) {
        const val = row.values[autoNumField.id];
        if (typeof val === "number" && val >= autoNumberCounter) {
          autoNumberCounter = val + 1;
        }
      }
    }
  }
  function cloneRow(row) {
    return {
      id: row.id,
      rev: row.rev,
      ...row.createdAt !== void 0 ? { createdAt: row.createdAt } : {},
      updatedAt: row.updatedAt,
      values: { ...row.values },
      // P7-04: keep the sync block. Dropping it here would silently unlink every synced row
      // on the next save. A deep copy keeps callers from mutating store state.
      sync: cloneSync(row.sync)
    };
  }
  function cloneSync(sync) {
    if (!sync)
      return null;
    return {
      ...sync,
      ...sync.conflict ? { conflict: { ...sync.conflict } } : {}
    };
  }
  function now() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function createRow(values) {
    const id = generateRowId();
    const timestamp = now();
    const row = {
      id,
      rev: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      values: { ...values },
      sync: null
    };
    rowMap.set(id, row);
    displayOrder.push(id);
    return cloneRow(row);
  }
  function setRowSync(id, sync) {
    const row = rowMap.get(id);
    if (!row)
      throw new Error(`Row not found: ${id}`);
    row.sync = cloneSync(sync);
  }
  function setFieldAirtable(fieldId, airtable) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field)
      throw new Error(`Field not found: ${fieldId}`);
    field.airtable = airtable ? { ...airtable } : airtable;
  }
  function getRow(id) {
    const row = rowMap.get(id);
    return row ? cloneRow(row) : void 0;
  }
  function getAllRows() {
    return displayOrder.map((id) => cloneRow(rowMap.get(id)));
  }
  function updateRow(id, values) {
    const row = rowMap.get(id);
    if (!row) {
      throw new Error(`Row not found: ${id}`);
    }
    row.rev += 1;
    row.updatedAt = now();
    for (const [key, val] of Object.entries(values)) {
      row.values[key] = val;
    }
    return cloneRow(row);
  }
  function deleteRow(id) {
    if (!rowMap.has(id)) {
      throw new Error(`Row not found: ${id}`);
    }
    rowMap.delete(id);
    const idx = displayOrder.indexOf(id);
    if (idx !== -1) {
      displayOrder.splice(idx, 1);
    }
  }
  function replaceField(field, valuesByRow) {
    const idx = fields.findIndex((f) => f.id === field.id);
    if (idx === -1)
      throw new Error(`Field not found: ${field.id}`);
    fields[idx] = { ...field };
    for (const [rowId, value] of Object.entries(valuesByRow)) {
      if (rowMap.has(rowId))
        updateRow(rowId, { [field.id]: value });
    }
  }
  function addField(field) {
    if (fields.some((f) => f.id === field.id)) {
      throw new Error(`Field already exists: ${field.id}`);
    }
    fields.push({ ...field });
  }
  function removeField(fieldId) {
    const idx = fields.findIndex((f) => f.id === fieldId);
    if (idx === -1)
      throw new Error(`Field not found: ${fieldId}`);
    fields.splice(idx, 1);
    for (const row of rowMap.values()) {
      if (fieldId in row.values)
        delete row.values[fieldId];
    }
  }
  function restoreRow(row, index) {
    if (rowMap.has(row.id)) {
      throw new Error(`Row already exists: ${row.id}`);
    }
    rowMap.set(row.id, cloneRow(row));
    const at = index === void 0 ? displayOrder.length : Math.max(0, Math.min(index, displayOrder.length));
    displayOrder.splice(at, 0, row.id);
  }
  function moveRow(id, newIndex) {
    const oldIdx = displayOrder.indexOf(id);
    if (oldIdx === -1) {
      throw new Error(`Row not found: ${id}`);
    }
    displayOrder.splice(oldIdx, 1);
    const clampedIndex = Math.max(0, Math.min(displayOrder.length, newIndex));
    displayOrder.splice(clampedIndex, 0, id);
  }
  function getNextAutoNumber() {
    const num = autoNumberCounter;
    autoNumberCounter += 1;
    return num;
  }
  return {
    createRow,
    setRowSync,
    setFieldAirtable,
    getRow,
    getAllRows,
    updateRow,
    deleteRow,
    restoreRow,
    replaceField,
    addField,
    removeField,
    moveRow,
    getNextAutoNumber,
    getFieldCount: () => fields.length,
    getRowCount: () => rowMap.size,
    getFields: () => fields,
    getDisplayOrder: () => [...displayOrder],
    getAutoNumberCounter: () => autoNumberCounter
  };
}

// src/model/commands.ts
var COALESCE_WINDOW_MS = 1e3;
var DEFAULT_LIMIT = 100;
function createCommandStack(options) {
  const { store } = options;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const undoStack = [];
  const redoStack = [];
  let lastTimestamp = 0;
  let lastTargetKey = "";
  function execute(command) {
    const now = Date.now();
    const targetKey = command.targetKey ?? "";
    const canCoalesce = targetKey !== "" && targetKey === lastTargetKey && now - lastTimestamp < COALESCE_WINDOW_MS && undoStack.length > 0;
    if (canCoalesce) {
      const originalEntry = undoStack[undoStack.length - 1];
      const merged = createMergedCommand(originalEntry.command, command);
      originalEntry.command = merged;
      originalEntry.timestamp = now;
      command.do(store);
    } else {
      command.do(store);
      undoStack.push({ command, timestamp: now });
      while (undoStack.length > limit) {
        undoStack.shift();
      }
    }
    redoStack.length = 0;
    lastTimestamp = now;
    lastTargetKey = targetKey;
  }
  function undo() {
    const entry = undoStack.pop();
    if (!entry)
      return false;
    entry.command.undo(store);
    redoStack.push(entry);
    lastTimestamp = 0;
    lastTargetKey = "";
    return true;
  }
  function redo() {
    const entry = redoStack.pop();
    if (!entry)
      return false;
    entry.command.do(store);
    undoStack.push(entry);
    lastTimestamp = 0;
    lastTargetKey = "";
    return true;
  }
  function canUndo() {
    return undoStack.length > 0;
  }
  function canRedo() {
    return redoStack.length > 0;
  }
  function clear() {
    undoStack.length = 0;
    redoStack.length = 0;
    lastTimestamp = 0;
    lastTargetKey = "";
  }
  return {
    execute,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    undoStackSize: () => undoStack.length,
    redoStackSize: () => redoStack.length
  };
}
function createMergedCommand(original, newCmd) {
  return {
    type: newCmd.type,
    targetKey: newCmd.targetKey,
    do(store) {
      newCmd.do(store);
    },
    undo(store) {
      original.undo(store);
    }
  };
}
function createEditCellCommand(data) {
  const { rowId, fieldId, oldValue, newValue } = data;
  return {
    type: "editCell",
    targetKey: `editCell:${rowId}:${fieldId}`,
    do(store) {
      store.updateRow(rowId, { [fieldId]: newValue });
    },
    undo(store) {
      store.updateRow(rowId, { [fieldId]: oldValue });
    }
  };
}
function createAddRowCommand(data) {
  let createdRowId = "";
  return {
    type: "addRow",
    targetKey: "addRow",
    do(store) {
      const row = store.createRow(data.values);
      createdRowId = row.id;
    },
    undo(store) {
      if (createdRowId) {
        store.deleteRow(createdRowId);
      }
    }
  };
}
function createDeleteRowCommand(data) {
  let deletedRow;
  let deletedIndex;
  return {
    type: "deleteRow",
    targetKey: `deleteRow:${data.rowId}`,
    do(store) {
      const row = store.getRow(data.rowId);
      if (row) {
        deletedRow = row;
        deletedIndex = store.getAllRows().findIndex((r) => r.id === data.rowId);
        store.deleteRow(data.rowId);
      }
    },
    undo(store) {
      if (deletedRow) {
        store.restoreRow(deletedRow, deletedIndex);
      }
    }
  };
}
var uniqueSeq = 0;
var uniqueKey = (prefix) => `${prefix}:${++uniqueSeq}`;
function createInsertRowCommand(data) {
  let created;
  return {
    type: "insertRow",
    targetKey: uniqueKey("insertRow"),
    do(store) {
      if (created) {
        store.restoreRow(created, data.index);
      } else {
        created = store.createRow(data.values);
        store.moveRow(created.id, data.index);
      }
    },
    undo(store) {
      if (created && store.getRow(created.id))
        store.deleteRow(created.id);
    }
  };
}
function createSetViewCommand(data) {
  return {
    type: "setView",
    targetKey: uniqueKey("setView"),
    do() {
      data.apply(data.after);
    },
    undo() {
      data.apply(data.before);
    }
  };
}
function createAddFieldCommand(data) {
  return {
    type: "addField",
    do(store) {
      store.addField(data.field);
      data.applyView(data.viewAfter);
    },
    undo(store) {
      store.removeField(data.field.id);
      data.applyView(data.viewBefore);
    }
  };
}
function createChangeFieldTypeCommand(data) {
  return {
    type: "changeFieldType",
    targetKey: uniqueKey("changeFieldType"),
    do(store) {
      store.replaceField(data.after.field, data.after.valuesByRow);
    },
    undo(store) {
      store.replaceField(data.before.field, data.before.valuesByRow);
    }
  };
}
function createSetFormulaCommand(data) {
  const { fieldId, oldFormula, newFormula } = data;
  const apply = (store, formula) => {
    const field = store.getFields().find((f) => f.id === fieldId);
    if (!field)
      return;
    const next = { ...field };
    if (formula === void 0)
      delete next.formula;
    else
      next.formula = formula;
    store.replaceField(next, {});
  };
  return {
    type: "setFormula",
    targetKey: `setFormula:${fieldId}`,
    do(store) {
      apply(store, newFormula);
    },
    undo(store) {
      apply(store, oldFormula);
    }
  };
}

// src/formula/value.ts
var BLANK = { t: "blank" };
var MAX_TEXT = 1e5;
var FormulaFault = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.name = "FormulaFault";
    this.code = code;
  }
};
function fault(code) {
  throw new FormulaFault(code);
}
function err2(code) {
  return { t: "err", code };
}
function faultValue(e) {
  if (e instanceof FormulaFault)
    return err2(e.code);
  throw e;
}
function numValue(v) {
  if (!Number.isFinite(v))
    return err2("#OVERFLOW!");
  return { t: "num", v: v === 0 ? 0 : v };
}
function textValue(v) {
  if (v.length > MAX_TEXT)
    return err2("#OVERFLOW!");
  return { t: "text", v };
}
function isTemporal(v) {
  return v.t === "date" || v.t === "dt";
}
function formatNumber(n) {
  if (n === 0)
    return "0";
  const s = Number(n.toPrecision(15)).toString();
  if (!/e/i.test(s))
    return s;
  return expandExponent(s);
}
function expandExponent(s) {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const [mant, expPart] = body.toLowerCase().split("e");
  const exp = Number(expPart);
  const [ip, fp = ""] = (mant ?? "").split(".");
  const digits = (ip ?? "") + fp;
  const point = (ip ?? "").length + exp;
  let out;
  if (point <= 0)
    out = "0." + "0".repeat(-point) + digits;
  else if (point >= digits.length)
    out = digits + "0".repeat(point - digits.length);
  else
    out = digits.slice(0, point) + "." + digits.slice(point);
  return (neg ? "-" : "") + out;
}
function msToParts(ms) {
  const t = new Date(ms);
  return {
    y: t.getFullYear(),
    m: t.getMonth() + 1,
    d: t.getDate(),
    hh: t.getHours(),
    mm: t.getMinutes(),
    ss: t.getSeconds()
  };
}
function partsToMs(p) {
  const t = /* @__PURE__ */ new Date(0);
  t.setFullYear(p.y, p.m - 1, p.d);
  t.setHours(p.hh, p.mm, p.ss, 0);
  return t.getTime();
}
function daysInMonth2(y, m) {
  const t = /* @__PURE__ */ new Date(0);
  t.setUTCFullYear(y, m, 0);
  return t.getUTCDate();
}
function dayNumber(y, m, d) {
  const t = /* @__PURE__ */ new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return Math.round(t.getTime() / 864e5);
}
function dateFromDayNumber(n) {
  const t = new Date(n * 864e5);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
function partsOf(v) {
  if (v.t === "date")
    return { y: v.y, m: v.m, d: v.d, hh: 0, mm: 0, ss: 0 };
  if (v.t === "dt")
    return msToParts(v.ms);
  return fault("#VALUE!");
}
function temporalMs(v) {
  if (v.t === "dt")
    return v.ms;
  if (v.t === "date")
    return partsToMs({ y: v.y, m: v.m, d: v.d, hh: 0, mm: 0, ss: 0 });
  return fault("#VALUE!");
}
function addMonthsParts(p, months) {
  const total = p.y * 12 + (p.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  const d = Math.min(p.d, daysInMonth2(y, m));
  return { ...p, y, m, d };
}
var pad = (n, w) => String(n).padStart(w, "0");
function formatDate(y, m, d) {
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}
function formatMinute(ms) {
  const p = msToParts(ms);
  return `${formatDate(p.y, p.m, p.d)} ${pad(p.hh, 2)}:${pad(p.mm, 2)}`;
}
function parseDateText2(s) {
  const mt2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!mt2)
    return null;
  const y = Number(mt2[1]);
  const m = Number(mt2[2]);
  const d = Number(mt2[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth2(y, m))
    return null;
  return { y, m, d };
}
function zeroLike(v) {
  switch (v.t) {
    case "num":
      return { t: "num", v: 0 };
    case "text":
      return { t: "text", v: "" };
    case "bool":
      return { t: "bool", v: false };
    case "blank":
      return BLANK;
    default:
      return fault("#VALUE!");
  }
}
function compareCodePoints(a, b) {
  const A = Array.from(a);
  const B = Array.from(b);
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const x = A[i].codePointAt(0);
    const y = B[i].codePointAt(0);
    if (x !== y)
      return x < y ? -1 : 1;
  }
  if (A.length === B.length)
    return 0;
  return A.length < B.length ? -1 : 1;
}
function equalValues(l, r) {
  if (l.t === "err")
    fault(l.code);
  if (r.t === "err")
    fault(r.code);
  if (l.t === "blank" && r.t === "blank")
    return true;
  if (l.t === "blank")
    return equalValues(zeroLike(r), r);
  if (r.t === "blank")
    return equalValues(l, zeroLike(l));
  if (isTemporal(l) && isTemporal(r))
    return temporalMs(l) === temporalMs(r);
  if (isTemporal(l) || isTemporal(r))
    return false;
  if (l.t !== r.t)
    return false;
  switch (l.t) {
    case "num":
      return l.v === r.v;
    case "text":
      return l.v === r.v;
    case "bool":
      return l.v === r.v;
    default:
      return false;
  }
}
function orderValues(l, r) {
  if (l.t === "err")
    fault(l.code);
  if (r.t === "err")
    fault(r.code);
  if (l.t === "blank" && r.t === "blank")
    return 0;
  if (l.t === "blank")
    return orderValues(zeroLike(r), r);
  if (r.t === "blank")
    return orderValues(l, zeroLike(l));
  if (isTemporal(l) && isTemporal(r)) {
    const a = temporalMs(l);
    const b = temporalMs(r);
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (l.t !== r.t)
    return fault("#VALUE!");
  switch (l.t) {
    case "num": {
      const b = r.v;
      return l.v === b ? 0 : l.v < b ? -1 : 1;
    }
    case "text":
      return compareCodePoints(l.v, r.v);
    case "bool": {
      const b = r.v;
      return l.v === b ? 0 : l.v ? 1 : -1;
    }
    default:
      return fault("#VALUE!");
  }
}

// src/formula/lexer.ts
var NUM_RE = /\d+(\.\d+)?/y;
var IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/y;
function tokenize(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src.charAt(i);
    if (c === " " || c === "	" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      NUM_RE.lastIndex = i;
      const m = NUM_RE.exec(src);
      if (!m)
        fault("#PARSE!");
      out.push({ k: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let text = "";
      let closed = false;
      while (j < n) {
        const ch3 = src.charAt(j);
        if (ch3 === "\n" || ch3 === "\r")
          fault("#PARSE!");
        if (ch3 === "\\") {
          const nx = src.charAt(j + 1);
          if (nx !== '"' && nx !== "\\")
            fault("#PARSE!");
          text += nx;
          j += 2;
          continue;
        }
        if (ch3 === '"') {
          closed = true;
          j++;
          break;
        }
        text += ch3;
        j++;
      }
      if (!closed)
        fault("#PARSE!");
      out.push({ k: "str", v: text });
      i = j;
      continue;
    }
    if (c === "{") {
      let j = i + 1;
      let name = "";
      let closed = false;
      while (j < n) {
        const ch3 = src.charAt(j);
        if (ch3 === "\n" || ch3 === "\r")
          fault("#PARSE!");
        if (ch3 === "\\") {
          const nx = src.charAt(j + 1);
          if (nx !== "}" && nx !== "\\")
            fault("#PARSE!");
          name += nx;
          j += 2;
          continue;
        }
        if (ch3 === "}") {
          closed = true;
          j++;
          break;
        }
        name += ch3;
        j++;
      }
      if (!closed || name.length === 0)
        fault("#PARSE!");
      out.push({ k: "ref", v: name });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      IDENT_RE.lastIndex = i;
      const m = IDENT_RE.exec(src);
      if (!m)
        fault("#PARSE!");
      out.push({ k: "ident", v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "!=" || two === "<=" || two === ">=") {
      out.push({ k: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-*/^&=<>".includes(c)) {
      out.push({ k: "op", v: c });
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ k: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ k: ")" });
      i++;
      continue;
    }
    if (c === ",") {
      out.push({ k: "," });
      i++;
      continue;
    }
    fault("#PARSE!");
  }
  out.push({ k: "eof" });
  return out;
}

// src/formula/parser.ts
var MAX_FORMULA_LENGTH = 2e3;
var MAX_NESTING = 50;
var MAX_ARGS = 30;
var CMP_OPS = /* @__PURE__ */ new Set(["=", "!=", "<", "<=", ">", ">="]);
var Parser = class {
  constructor(toks) {
    this.toks = toks;
  }
  pos = 0;
  depth = 0;
  peek() {
    return this.toks[this.pos];
  }
  next() {
    return this.toks[this.pos++];
  }
  isOp(v) {
    const t = this.peek();
    return t.k === "op" && t.v === v;
  }
  enter() {
    this.depth++;
    if (this.depth > MAX_NESTING)
      fault("#PARSE!");
  }
  leave() {
    this.depth--;
  }
  parseAll() {
    const e = this.parseComparison();
    if (this.peek().k !== "eof")
      fault("#PARSE!");
    return e;
  }
  parseComparison() {
    const l = this.parseConcat();
    const t = this.peek();
    if (t.k === "op" && CMP_OPS.has(t.v)) {
      this.next();
      const r = this.parseConcat();
      const after = this.peek();
      if (after.k === "op" && CMP_OPS.has(after.v))
        fault("#PARSE!");
      return { k: "bin", op: t.v, l, r };
    }
    return l;
  }
  parseConcat() {
    let l = this.parseAdditive();
    while (this.isOp("&")) {
      this.next();
      l = { k: "bin", op: "&", l, r: this.parseAdditive() };
    }
    return l;
  }
  parseAdditive() {
    let l = this.parseMultiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().v;
      l = { k: "bin", op, l, r: this.parseMultiplicative() };
    }
    return l;
  }
  parseMultiplicative() {
    let l = this.parseUnary();
    while (this.isOp("*") || this.isOp("/")) {
      const op = this.next().v;
      l = { k: "bin", op, l, r: this.parseUnary() };
    }
    return l;
  }
  parseUnary() {
    if (this.isOp("-")) {
      this.next();
      this.enter();
      const e = this.parseUnary();
      this.leave();
      return { k: "neg", e };
    }
    return this.parsePower();
  }
  parsePower() {
    let l = this.parsePrimary();
    while (this.isOp("^")) {
      this.next();
      l = { k: "bin", op: "^", l, r: this.parsePowerOperand() };
    }
    return l;
  }
  parsePowerOperand() {
    if (this.isOp("-")) {
      this.next();
      this.enter();
      const e = this.parsePowerOperand();
      this.leave();
      return { k: "neg", e };
    }
    return this.parsePrimary();
  }
  parsePrimary() {
    const t = this.next();
    switch (t.k) {
      case "num":
        return Number.isFinite(t.v) ? { k: "lit", v: { t: "num", v: t.v } } : { k: "lit", v: err2("#OVERFLOW!") };
      case "str":
        return { k: "lit", v: { t: "text", v: t.v } };
      case "ref":
        return { k: "ref", name: t.v };
      case "ident": {
        if (this.peek().k === "(")
          return this.parseCall(t.v);
        const up = t.v.toUpperCase();
        if (up === "TRUE")
          return { k: "lit", v: { t: "bool", v: true } };
        if (up === "FALSE")
          return { k: "lit", v: { t: "bool", v: false } };
        return { k: "name", name: t.v };
      }
      case "(": {
        this.enter();
        const e = this.parseComparison();
        if (this.next().k !== ")")
          fault("#PARSE!");
        this.leave();
        return e;
      }
      default:
        fault("#PARSE!");
    }
  }
  parseCall(rawName) {
    this.next();
    this.enter();
    const args = [];
    if (this.peek().k === ")") {
      this.next();
    } else {
      for (; ; ) {
        args.push(this.parseComparison());
        if (args.length > MAX_ARGS)
          fault("#PARSE!");
        const t = this.next();
        if (t.k === ")")
          break;
        if (t.k !== ",")
          fault("#PARSE!");
      }
    }
    this.leave();
    return { k: "call", name: rawName.toUpperCase(), args };
  }
};
function collectRefs(node, out = []) {
  switch (node.k) {
    case "ref":
      out.push(node.name);
      break;
    case "neg":
      collectRefs(node.e, out);
      break;
    case "bin":
      collectRefs(node.l, out);
      collectRefs(node.r, out);
      break;
    case "call":
      for (const a of node.args)
        collectRefs(a, out);
      break;
    default:
      break;
  }
  return out;
}
function compileFormula(src) {
  if (src.length > MAX_FORMULA_LENGTH)
    return { ok: false, code: "#PARSE!" };
  try {
    const root = new Parser(tokenize(src)).parseAll();
    return { ok: true, root, refs: Array.from(new Set(collectRefs(root))) };
  } catch (e) {
    if (e instanceof FormulaFault)
      return { ok: false, code: "#PARSE!" };
    throw e;
  }
}

// src/formula/functions.ts
var VARIADIC = 30;
var DAY_MS = 864e5;
function asNumber(v) {
  switch (v.t) {
    case "num":
      return v.v;
    case "blank":
      return 0;
    case "err":
      return fault(v.code);
    default:
      return fault("#VALUE!");
  }
}
function asInt(v) {
  return Math.trunc(asNumber(v));
}
function asText(v) {
  switch (v.t) {
    case "blank":
      return "";
    case "text":
      return v.v;
    case "num":
      return formatNumber(v.v);
    case "bool":
      return v.v ? "TRUE" : "FALSE";
    case "date":
      return formatDate(v.y, v.m, v.d);
    case "dt":
      return formatMinute(v.ms);
    case "err":
      return fault(v.code);
  }
}
function asBool(v) {
  switch (v.t) {
    case "bool":
      return v.v;
    case "num":
      return v.v !== 0;
    case "blank":
      return false;
    case "err":
      return fault(v.code);
    default:
      return fault("#VALUE!");
  }
}
function asTemporal(v) {
  if (isTemporal(v))
    return v;
  if (v.t === "err")
    return fault(v.code);
  return fault("#VALUE!");
}
function cps(s) {
  return Array.from(s);
}
function lowerCp(c) {
  const l = c.toLowerCase();
  return Array.from(l).length === 1 ? l : c;
}
function roundTo(n, digits, mode) {
  const sign = n < 0 ? -1 : 1;
  const a = Math.abs(n);
  const scaled = Number((digits >= 0 ? a * 10 ** digits : a / 10 ** -digits).toPrecision(15));
  let r;
  if (mode === "nearest")
    r = Math.round(scaled);
  else if (mode === "up")
    r = Math.ceil(scaled);
  else
    r = Math.floor(scaled);
  const out = digits >= 0 ? r / 10 ** digits : r * 10 ** -digits;
  return sign * out;
}
function roundArgs(args, mode) {
  const n = asNumber(args[0]);
  const digits = args.length > 1 ? asInt(args[1]) : 0;
  if (digits < -15 || digits > 15)
    return err2("#NUM!");
  return numValue(roundTo(n, digits, mode));
}
function numericArgs(args) {
  const out = [];
  for (const a of args) {
    if (a.t === "num")
      out.push(a.v);
    else if (a.t === "blank")
      continue;
    else if (a.t === "err")
      fault(a.code);
    else
      fault("#VALUE!");
  }
  return out;
}
function monthsBetween(a, b, perMonth) {
  const ta = temporalMs(a);
  const tb = temporalMs(b);
  const sign = ta >= tb ? 1 : -1;
  const bp = partsOf(b);
  let k = 0;
  for (; ; ) {
    const next = partsToMs(addMonthsParts(bp, sign * perMonth * (k + 1)));
    if (sign > 0 ? next <= ta : next >= ta)
      k++;
    else
      break;
  }
  return sign * k;
}
var UNITS = /* @__PURE__ */ new Set(["days", "weeks", "months", "years", "hours", "minutes", "seconds"]);
var TIME_UNIT_MS = { hours: 36e5, minutes: 6e4, seconds: 1e3 };
function dateAdd(v, n, unit) {
  const isDate = v.t === "date";
  const p = partsOf(v);
  switch (unit) {
    case "days":
    case "weeks": {
      const k = unit === "weeks" ? n * 7 : n;
      if (isDate) {
        const dn = dayNumber(p.y, p.m, p.d) + k;
        const r = dateFromDayNumber(dn);
        return { t: "date", y: r.y, m: r.m, d: r.d };
      }
      const t = /* @__PURE__ */ new Date(0);
      t.setFullYear(p.y, p.m - 1, p.d + k);
      t.setHours(p.hh, p.mm, p.ss, 0);
      return { t: "dt", ms: t.getTime() };
    }
    case "months":
    case "years": {
      const months = unit === "years" ? n * 12 : n;
      const r = addMonthsParts(p, months);
      if (isDate)
        return { t: "date", y: r.y, m: r.m, d: r.d };
      return { t: "dt", ms: partsToMs(r) };
    }
    default: {
      const ms = temporalMs(v) + n * TIME_UNIT_MS[unit];
      return { t: "dt", ms };
    }
  }
}
function dateDiff(a, b, unit) {
  if (unit === "months" || unit === "years")
    return monthsBetween(a, b, unit === "years" ? 12 : 1);
  if (a.t === "date" && b.t === "date" && (unit === "days" || unit === "weeks")) {
    const days = dayNumber(a.y, a.m, a.d) - dayNumber(b.y, b.m, b.d);
    return Math.trunc(unit === "weeks" ? days / 7 : days);
  }
  const dms = temporalMs(a) - temporalMs(b);
  if (unit === "days")
    return Math.trunc(dms / DAY_MS);
  if (unit === "weeks")
    return Math.trunc(dms / (7 * DAY_MS));
  return Math.trunc(dms / TIME_UNIT_MS[unit]);
}
function weekdayIso(p) {
  const n = dayNumber(p.y, p.m, p.d);
  return ((n + 3) % 7 + 7) % 7 + 1;
}
function formatPattern(v, pattern) {
  const p = partsOf(v);
  const tokens = [
    ["YYYY", () => String(p.y).padStart(4, "0")],
    ["MM", () => String(p.m).padStart(2, "0")],
    ["DD", () => String(p.d).padStart(2, "0")],
    ["HH", () => String(p.hh).padStart(2, "0")],
    ["mm", () => String(p.mm).padStart(2, "0")],
    ["ss", () => String(p.ss).padStart(2, "0")]
  ];
  let out = "";
  let i = 0;
  outer:
    while (i < pattern.length) {
      for (const [tok, render] of tokens) {
        if (pattern.startsWith(tok, i)) {
          out += render();
          i += tok.length;
          continue outer;
        }
      }
      out += pattern.charAt(i);
      i++;
    }
  return out;
}
var cell = (fn, min, max2) => ({
  min,
  max: max2,
  lazy: false,
  run: fn
});
var FUNCTIONS = {
  // ----- numeric (15) -----
  ABS: cell((a) => numValue(Math.abs(asNumber(a[0]))), 1, 1),
  ROUND: cell((a) => roundArgs(a, "nearest"), 1, 2),
  ROUNDUP: cell((a) => roundArgs(a, "up"), 1, 2),
  ROUNDDOWN: cell((a) => roundArgs(a, "down"), 1, 2),
  CEILING: cell((a) => numValue(Math.ceil(asNumber(a[0]))), 1, 1),
  FLOOR: cell((a) => numValue(Math.floor(asNumber(a[0]))), 1, 1),
  INT: cell((a) => numValue(Math.floor(asNumber(a[0]))), 1, 1),
  MOD: cell((a) => {
    const n = asNumber(a[0]);
    const m = asNumber(a[1]);
    if (m === 0)
      return err2("#DIV/0!");
    return numValue(n - m * Math.floor(n / m));
  }, 2, 2),
  POWER: cell((a) => {
    const x = asNumber(a[0]);
    const y = asNumber(a[1]);
    if (x === 0 && y < 0)
      return err2("#DIV/0!");
    const r = x ** y;
    if (Number.isNaN(r))
      return err2("#NUM!");
    return numValue(r);
  }, 2, 2),
  SQRT: cell((a) => {
    const n = asNumber(a[0]);
    if (n < 0)
      return err2("#NUM!");
    return numValue(Math.sqrt(n));
  }, 1, 1),
  MIN: cell((a) => {
    const xs = numericArgs(a);
    return xs.length === 0 ? BLANK : numValue(Math.min(...xs));
  }, 1, VARIADIC),
  MAX: cell((a) => {
    const xs = numericArgs(a);
    return xs.length === 0 ? BLANK : numValue(Math.max(...xs));
  }, 1, VARIADIC),
  SUM: cell((a) => {
    let s = 0;
    for (const x of numericArgs(a))
      s += x;
    return numValue(s);
  }, 0, VARIADIC),
  AVERAGE: cell((a) => {
    const xs = numericArgs(a);
    if (xs.length === 0)
      return err2("#DIV/0!");
    let s = 0;
    for (const x of xs)
      s += x;
    return numValue(s / xs.length);
  }, 1, VARIADIC),
  COUNT: cell((a) => numValue(a.filter((x) => x.t === "num").length), 1, VARIADIC),
  // ----- text (14) -----
  CONCATENATE: cell((a) => textValue(a.map(asText).join("")), 1, VARIADIC),
  LEN: cell((a) => numValue(cps(asText(a[0])).length), 1, 1),
  LOWER: cell((a) => textValue(asText(a[0]).toLowerCase()), 1, 1),
  UPPER: cell((a) => textValue(asText(a[0]).toUpperCase()), 1, 1),
  TRIM: cell((a) => textValue(asText(a[0]).replace(/ +/g, " ").replace(/^ | $/g, "")), 1, 1),
  LEFT: cell((a) => {
    const s = cps(asText(a[0]));
    const n = a.length > 1 ? asInt(a[1]) : 1;
    if (n < 0)
      return err2("#NUM!");
    return textValue(s.slice(0, n).join(""));
  }, 1, 2),
  RIGHT: cell((a) => {
    const s = cps(asText(a[0]));
    const n = a.length > 1 ? asInt(a[1]) : 1;
    if (n < 0)
      return err2("#NUM!");
    return textValue(s.slice(Math.max(0, s.length - n)).join(""));
  }, 1, 2),
  MID: cell((a) => {
    const s = cps(asText(a[0]));
    const start = asInt(a[1]);
    const n = asInt(a[2]);
    if (start < 1 || n < 0)
      return err2("#NUM!");
    return textValue(s.slice(start - 1, start - 1 + n).join(""));
  }, 3, 3),
  FIND: cell((a) => findText(a, false), 2, 3),
  SEARCH: cell((a) => findText(a, true), 2, 3),
  SUBSTITUTE: cell((a) => {
    const s = asText(a[0]);
    const oldText = asText(a[1]);
    const newText = asText(a[2]);
    if (oldText === "")
      return textValue(s);
    return textValue(s.split(oldText).join(newText));
  }, 3, 3),
  REPLACE: cell((a) => {
    const s = cps(asText(a[0]));
    const start = asInt(a[1]);
    const count = asInt(a[2]);
    const repl = asText(a[3]);
    if (start < 1 || count < 0)
      return err2("#NUM!");
    if (start > s.length)
      return textValue(s.join("") + repl);
    return textValue(s.slice(0, start - 1).join("") + repl + s.slice(start - 1 + count).join(""));
  }, 4, 4),
  REPT: cell((a) => {
    const s = asText(a[0]);
    const n = asInt(a[1]);
    if (n < 0)
      return err2("#NUM!");
    if (s.length * n > MAX_TEXT)
      return err2("#OVERFLOW!");
    return textValue(s.repeat(n));
  }, 2, 2),
  VALUE: cell((a) => {
    const v = a[0];
    if (v.t === "num")
      return v;
    if (v.t !== "text")
      return err2("#VALUE!");
    const t = v.v.replace(/^ +| +$/g, "");
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t))
      return err2("#VALUE!");
    return numValue(Number(t));
  }, 1, 1),
  // ----- logic (7) — IF, AND, OR, SWITCH are lazy -----
  IF: { min: 2, max: 3, lazy: true },
  AND: { min: 1, max: VARIADIC, lazy: true },
  OR: { min: 1, max: VARIADIC, lazy: true },
  NOT: cell((a) => ({ t: "bool", v: !asBool(a[0]) }), 1, 1),
  XOR: cell((a) => ({ t: "bool", v: asBool(a[0]) !== asBool(a[1]) }), 2, 2),
  SWITCH: { min: 3, max: VARIADIC, lazy: true },
  BLANK: cell(() => BLANK, 0, 0),
  // ----- date and time (15) -----
  DATE: cell((a) => {
    const p = parseDateText2(asText(a[0]));
    if (!p)
      return err2("#VALUE!");
    return { t: "date", y: p.y, m: p.m, d: p.d };
  }, 1, 1),
  TODAY: cell((_a2, ctx) => {
    const p = msToParts(ctx.now);
    return { t: "date", y: p.y, m: p.m, d: p.d };
  }, 0, 0),
  NOW: cell((_a2, ctx) => ({ t: "dt", ms: ctx.now }), 0, 0),
  DATEADD: cell((a) => {
    const v = asTemporal(a[0]);
    const n = Math.trunc(asNumber(a[1]));
    const unit = asText(a[2]).toLowerCase();
    if (!UNITS.has(unit))
      return err2("#VALUE!");
    return dateAdd(v, n, unit);
  }, 3, 3),
  DATETIME_DIFF: cell((a) => {
    const x = asTemporal(a[0]);
    const y = asTemporal(a[1]);
    const unit = asText(a[2]).toLowerCase();
    if (!UNITS.has(unit))
      return err2("#VALUE!");
    return numValue(dateDiff(x, y, unit));
  }, 3, 3),
  IS_BEFORE: cell((a) => {
    const x = asTemporal(a[0]);
    const y = asTemporal(a[1]);
    return { t: "bool", v: temporalMs(x) < temporalMs(y) };
  }, 2, 2),
  IS_AFTER: cell((a) => {
    const x = asTemporal(a[0]);
    const y = asTemporal(a[1]);
    return { t: "bool", v: temporalMs(x) > temporalMs(y) };
  }, 2, 2),
  YEAR: cell((a) => numValue(partsOf(asTemporal(a[0])).y), 1, 1),
  MONTH: cell((a) => numValue(partsOf(asTemporal(a[0])).m), 1, 1),
  DAY: cell((a) => numValue(partsOf(asTemporal(a[0])).d), 1, 1),
  WEEKDAY: cell((a) => numValue(weekdayIso(partsOf(asTemporal(a[0])))), 1, 1),
  HOUR: cell((a) => numValue(partsOf(asTemporal(a[0])).hh), 1, 1),
  MINUTE: cell((a) => numValue(partsOf(asTemporal(a[0])).mm), 1, 1),
  SECOND: cell((a) => numValue(partsOf(asTemporal(a[0])).ss), 1, 1),
  DATETIME_FORMAT: cell((a) => {
    const v = asTemporal(a[0]);
    return textValue(formatPattern(v, asText(a[1])));
  }, 2, 2),
  // ----- record (3) -----
  RECORD_ID: cell((_a2, ctx) => textValue(ctx.rowId), 0, 0),
  CREATED_TIME: cell((_a2, ctx) => ({ t: "dt", ms: ctx.createdMs }), 0, 0),
  LAST_MODIFIED_TIME: cell((_a2, ctx) => ({ t: "dt", ms: ctx.modifiedMs }), 0, 0)
};
function findText(a, ci) {
  const hay = cps(asText(a[1]));
  const needle = cps(asText(a[0]));
  const start = a.length > 2 ? asInt(a[2]) : 1;
  if (start < 1 || start > hay.length + 1)
    return err2("#NUM!");
  if (needle.length === 0)
    return numValue(start);
  const norm = (c) => ci ? lowerCp(c) : c;
  const h = hay.map(norm);
  const nd = needle.map(norm);
  for (let i = start - 1; i + nd.length <= h.length; i++) {
    let ok = true;
    for (let j = 0; j < nd.length; j++) {
      if (h[i + j] !== nd[j]) {
        ok = false;
        break;
      }
    }
    if (ok)
      return numValue(i + 1);
  }
  return numValue(0);
}

// src/formula/evaluate.ts
var TRUE = { t: "bool", v: true };
var FALSE = { t: "bool", v: false };
function evaluate(node, ctx) {
  switch (node.k) {
    case "lit":
      return node.v;
    case "ref":
      return ctx.field(node.name) ?? err2("#NAME?");
    case "name":
      return err2("#NAME?");
    case "neg": {
      const v = evaluate(node.e, ctx);
      if (v.t === "err")
        return v;
      try {
        return numValue(-asNumber(v));
      } catch (e) {
        return faultValue(e);
      }
    }
    case "bin": {
      const l = evaluate(node.l, ctx);
      const r = evaluate(node.r, ctx);
      if (l.t === "err")
        return l;
      if (r.t === "err")
        return r;
      try {
        return binary(node.op, l, r);
      } catch (e) {
        return faultValue(e);
      }
    }
    case "call":
      return call(node.name, node.args, ctx);
  }
}
function binary(op, l, r) {
  switch (op) {
    case "&":
      return textValue(asText(l) + asText(r));
    case "+":
      return numValue(asNumber(l) + asNumber(r));
    case "-":
      return numValue(asNumber(l) - asNumber(r));
    case "*":
      return numValue(asNumber(l) * asNumber(r));
    case "/": {
      const x = asNumber(l);
      const y = asNumber(r);
      if (y === 0)
        return err2("#DIV/0!");
      return numValue(x / y);
    }
    case "^": {
      const x = asNumber(l);
      const y = asNumber(r);
      if (x === 0 && y < 0)
        return err2("#DIV/0!");
      const p = x ** y;
      if (Number.isNaN(p))
        return err2("#NUM!");
      return numValue(p);
    }
    case "=":
      return equalValues(l, r) ? TRUE : FALSE;
    case "!=":
      return equalValues(l, r) ? FALSE : TRUE;
    case "<":
      return orderValues(l, r) < 0 ? TRUE : FALSE;
    case "<=":
      return orderValues(l, r) <= 0 ? TRUE : FALSE;
    case ">":
      return orderValues(l, r) > 0 ? TRUE : FALSE;
    case ">=":
      return orderValues(l, r) >= 0 ? TRUE : FALSE;
    default:
      return fault("#PARSE!");
  }
}
function call(name, args, ctx) {
  const def = Object.prototype.hasOwnProperty.call(FUNCTIONS, name) ? FUNCTIONS[name] : void 0;
  if (!def)
    return err2("#NAME?");
  if (args.length < def.min || args.length > def.max)
    return err2("#ARGS!");
  if (def.lazy)
    return lazyCall(name, args, ctx);
  const vals = [];
  for (const a of args) {
    const v = evaluate(a, ctx);
    if (v.t === "err")
      return v;
    vals.push(v);
  }
  try {
    return def.run(vals, ctx);
  } catch (e) {
    return faultValue(e);
  }
}
function lazyCall(name, args, ctx) {
  switch (name) {
    case "IF": {
      const c = evaluate(args[0], ctx);
      if (c.t === "err")
        return c;
      let b;
      try {
        b = asBool(c);
      } catch (e) {
        return faultValue(e);
      }
      if (b)
        return evaluate(args[1], ctx);
      return args[2] ? evaluate(args[2], ctx) : BLANK;
    }
    case "AND":
    case "OR": {
      const isAnd = name === "AND";
      for (const a of args) {
        const v = evaluate(a, ctx);
        if (v.t === "err")
          return v;
        let b;
        try {
          b = asBool(v);
        } catch (e) {
          return faultValue(e);
        }
        if (isAnd && !b)
          return FALSE;
        if (!isAnd && b)
          return TRUE;
      }
      return isAnd ? TRUE : FALSE;
    }
    case "SWITCH": {
      const x = evaluate(args[0], ctx);
      if (x.t === "err")
        return x;
      const pairs = Math.floor((args.length - 1) / 2);
      for (let i = 0; i < pairs; i++) {
        const v = evaluate(args[1 + 2 * i], ctx);
        if (v.t === "err")
          return v;
        let eq;
        try {
          eq = equalValues(x, v);
        } catch (e) {
          return faultValue(e);
        }
        if (eq)
          return evaluate(args[2 + 2 * i], ctx);
      }
      if ((args.length - 1) % 2 === 1)
        return evaluate(args[args.length - 1], ctx);
      return BLANK;
    }
    default:
      return err2("#NAME?");
  }
}

// src/formula/engine.ts
var FormulaEngine = class {
  stats = { evaluations: 0, internalErrors: 0 };
  fields = /* @__PURE__ */ new Map();
  nameToIds = /* @__PURE__ */ new Map();
  compiled = /* @__PURE__ */ new Map();
  /** formula id -> resolved field ids it references directly */
  deps = /* @__PURE__ */ new Map();
  /** field id -> formula ids that reference it directly */
  dependents = /* @__PURE__ */ new Map();
  cyclic = /* @__PURE__ */ new Set();
  /** acyclic formula id -> position in dependency order */
  rank = /* @__PURE__ */ new Map();
  evalOrder = [];
  rows = /* @__PURE__ */ new Map();
  nowFn;
  nowMs = 0;
  constructor(opts) {
    this.nowFn = opts.now ?? (() => Date.now());
    for (const f of opts.fields) {
      if (this.fields.has(f.id))
        throw new Error(`duplicate field id ${f.id}`);
      this.fields.set(f.id, f);
      const list = this.nameToIds.get(f.name) ?? [];
      list.push(f.id);
      this.nameToIds.set(f.name, list);
    }
    for (const f of opts.fields) {
      if (f.formula === void 0)
        continue;
      const c = compileFormula(f.formula);
      this.compiled.set(f.id, c);
      const ds = /* @__PURE__ */ new Set();
      if (c.ok) {
        for (const ref of c.refs) {
          const ids = this.nameToIds.get(ref);
          if (ids && ids.length === 1)
            ds.add(ids[0]);
        }
      }
      this.deps.set(f.id, ds);
    }
    for (const [f, ds] of this.deps) {
      for (const d of ds) {
        const set = this.dependents.get(d) ?? /* @__PURE__ */ new Set();
        set.add(f);
        this.dependents.set(d, set);
      }
    }
    this.findCycles();
    this.orderAcyclic();
    for (const r of opts.rows) {
      if (this.rows.has(r.id))
        throw new Error(`duplicate row id ${r.id}`);
      this.rows.set(r.id, {
        id: r.id,
        createdMs: r.createdMs,
        modifiedMs: r.modifiedMs,
        inputs: new Map(Object.entries(r.inputs)),
        computed: /* @__PURE__ */ new Map()
      });
    }
    this.recalculateAll();
  }
  /** Formula ids that sit on a reference cycle (value is #CYCLE!). */
  cycleFieldIds() {
    return [...this.cyclic];
  }
  /** Current value of a cell. Unknown row or field gives blank. */
  value(rowId, fieldId) {
    const row = this.rows.get(rowId);
    if (!row || !this.fields.has(fieldId))
      return BLANK;
    return this.valueOf(row, fieldId);
  }
  /**
   * Set an input cell and recalculate its dependents within that row.
   * Returns false (and changes nothing) for an unknown row, an unknown field,
   * or a formula field.
   */
  setInput(rowId, fieldId, v) {
    const row = this.rows.get(rowId);
    const f = this.fields.get(fieldId);
    if (!row || !f || f.formula !== void 0)
      return false;
    row.inputs.set(fieldId, v);
    const dirty = this.dirtyFrom(fieldId);
    for (const id of dirty)
      row.computed.delete(id);
    for (const id of dirty)
      this.valueOf(row, id);
    return true;
  }
  /** Full recalculation of every row. Captures the current time for TODAY and NOW. */
  recalculateAll() {
    this.nowMs = this.nowFn();
    for (const row of this.rows.values()) {
      row.computed.clear();
      for (const id of this.evalOrder)
        this.valueOf(row, id);
    }
  }
  valueOf(row, id) {
    const f = this.fields.get(id);
    if (!f)
      return BLANK;
    if (f.formula === void 0)
      return row.inputs.get(id) ?? BLANK;
    if (this.cyclic.has(id))
      return err2("#CYCLE!");
    const hit = row.computed.get(id);
    if (hit !== void 0)
      return hit;
    const v = this.compute(row, id);
    row.computed.set(id, v);
    return v;
  }
  compute(row, id) {
    const c = this.compiled.get(id);
    this.stats.evaluations++;
    if (!c)
      return err2("#PARSE!");
    if (!c.ok)
      return err2(c.code);
    const ctx = {
      rowId: row.id,
      createdMs: row.createdMs,
      modifiedMs: row.modifiedMs,
      now: this.nowMs,
      field: (name) => {
        const ids = this.nameToIds.get(name);
        if (!ids || ids.length !== 1)
          return void 0;
        return this.valueOf(row, ids[0]);
      }
    };
    try {
      return evaluate(c.root, ctx);
    } catch {
      this.stats.internalErrors++;
      return err2("#VALUE!");
    }
  }
  dirtyFrom(fieldId) {
    const seen = /* @__PURE__ */ new Set();
    const stack = [fieldId];
    while (stack.length > 0) {
      const x = stack.pop();
      for (const f of this.dependents.get(x) ?? []) {
        if (!seen.has(f)) {
          seen.add(f);
          stack.push(f);
        }
      }
    }
    return [...seen].filter((f) => this.rank.has(f)).sort((a, b) => this.rank.get(a) - this.rank.get(b));
  }
  formulaDeps(id) {
    const out = [];
    for (const d of this.deps.get(id) ?? [])
      if (this.compiled.has(d))
        out.push(d);
    return out;
  }
  /** Tarjan's strongly connected components over formula fields. */
  findCycles() {
    const index = /* @__PURE__ */ new Map();
    const low = /* @__PURE__ */ new Map();
    const onStack = /* @__PURE__ */ new Set();
    const stack = [];
    let counter = 0;
    const strong = (v) => {
      index.set(v, counter);
      low.set(v, counter);
      counter++;
      stack.push(v);
      onStack.add(v);
      for (const w of this.formulaDeps(v)) {
        if (!index.has(w)) {
          strong(w);
          low.set(v, Math.min(low.get(v), low.get(w)));
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v), index.get(w)));
        }
      }
      if (low.get(v) === index.get(v)) {
        const comp = [];
        let w;
        do {
          w = stack.pop();
          onStack.delete(w);
          comp.push(w);
        } while (w !== v);
        const selfLoop = this.deps.get(v)?.has(v) ?? false;
        if (comp.length > 1 || selfLoop)
          for (const c of comp)
            this.cyclic.add(c);
      }
    };
    for (const id of this.compiled.keys())
      if (!index.has(id))
        strong(id);
  }
  /** Dependency order (post-order DFS) of acyclic formula fields. */
  orderAcyclic() {
    const visited = /* @__PURE__ */ new Set();
    const visit = (v) => {
      if (visited.has(v))
        return;
      visited.add(v);
      for (const w of this.formulaDeps(v))
        if (!this.cyclic.has(w))
          visit(w);
      this.rank.set(v, this.evalOrder.length);
      this.evalOrder.push(v);
    };
    for (const id of this.compiled.keys())
      if (!this.cyclic.has(id))
        visit(id);
  }
};

// src/model/formulaRuntime.ts
var ERROR_MESSAGES = {
  "#PARSE!": "The formula has a syntax error.",
  "#NAME?": "The formula uses an unknown field or function.",
  "#ARGS!": "A function got the wrong number of arguments.",
  "#TYPE!": "A value has the wrong type.",
  "#VALUE!": "A value cannot be used here.",
  "#DIV/0!": "Division by zero.",
  "#NUM!": "A number is out of range.",
  "#OVERFLOW!": "The result is too large.",
  "#CYCLE!": "This formula depends on itself."
};
function cellToValue(field, cell2) {
  const v = cell2 ?? null;
  if (v === null)
    return BLANK;
  switch (field.type) {
    case "number":
    case "currency":
    case "percent":
    case "duration":
    case "rating":
    case "auto_number":
      return typeof v === "number" ? { t: "num", v } : BLANK;
    case "checkbox":
      return typeof v === "boolean" ? { t: "bool", v } : BLANK;
    case "date": {
      if (typeof v !== "string")
        return BLANK;
      const p = parseDateText2(v);
      return p ? { t: "date", y: p.y, m: p.m, d: p.d } : BLANK;
    }
    case "date_time":
    case "created_time":
    case "modified_time": {
      if (typeof v !== "string")
        return BLANK;
      const ms = Date.parse(v);
      return Number.isNaN(ms) ? BLANK : { t: "dt", ms };
    }
    case "single_select": {
      if (typeof v !== "string")
        return BLANK;
      const opt = field.options?.find((o) => o.id === v);
      return opt ? { t: "text", v: opt.name } : BLANK;
    }
    case "multi_select": {
      if (!Array.isArray(v))
        return BLANK;
      const names = v.map((id) => field.options?.find((o) => o.id === id)?.name ?? "");
      return { t: "text", v: names.filter((n) => n !== "").join(", ") };
    }
    case "link":
      return { t: "err", code: "#VALUE!" };
    case "attachment":
      return Array.isArray(v) ? { t: "text", v: v.join(", ") } : BLANK;
    default:
      return typeof v === "string" ? { t: "text", v } : BLANK;
  }
}
function valueToCell(v) {
  switch (v.t) {
    case "blank":
      return null;
    case "num":
      return v.v;
    case "text":
      return v.v;
    case "bool":
      return v.v;
    case "date":
      return formatDate(v.y, v.m, v.d);
    case "dt":
      return formatMinute(v.ms);
    case "err":
      return v.code;
  }
}
function createFormulaRuntime(store) {
  let engine = null;
  let signature = "";
  let shadow = /* @__PURE__ */ new Map();
  const formulaFieldsOf = () => store.getFields().filter((f) => f.type === "formula");
  function computeSignature() {
    const fields = store.getFields().map((f) => [f.id, f.name, f.type, f.formula ?? null]);
    const rowIds = store.getAllRows().map((r) => r.id);
    return JSON.stringify([fields, rowIds]);
  }
  function build() {
    const fields = store.getFields();
    const specs = fields.map(
      (f) => f.type === "formula" ? { id: f.id, name: f.name, formula: f.formula ?? "" } : { id: f.id, name: f.name }
    );
    const inputs = fields.filter((f) => f.type !== "formula");
    const nextShadow = /* @__PURE__ */ new Map();
    const rows = store.getAllRows().map((r) => {
      const values = {};
      const seen = /* @__PURE__ */ new Map();
      for (const f of inputs) {
        const cell2 = r.values[f.id] ?? null;
        values[f.id] = cellToValue(f, cell2);
        seen.set(f.id, JSON.stringify(cell2));
      }
      nextShadow.set(r.id, seen);
      const modifiedMs = Date.parse(r.updatedAt);
      const createdMs = Date.parse(r.createdAt ?? r.updatedAt);
      return {
        id: r.id,
        createdMs: Number.isNaN(createdMs) ? 0 : createdMs,
        modifiedMs: Number.isNaN(modifiedMs) ? 0 : modifiedMs,
        inputs: values
      };
    });
    shadow = nextShadow;
    engine = new FormulaEngine({ fields: specs, rows, now: () => Date.now() });
    signature = computeSignature();
  }
  return {
    sync() {
      if (formulaFieldsOf().length === 0) {
        engine = null;
        shadow = /* @__PURE__ */ new Map();
        signature = "";
        return;
      }
      if (!engine || computeSignature() !== signature) {
        build();
        return;
      }
      const fields = store.getFields();
      const inputs = fields.filter((f) => f.type !== "formula");
      for (const r of store.getAllRows()) {
        let seen = shadow.get(r.id);
        if (!seen) {
          seen = /* @__PURE__ */ new Map();
          shadow.set(r.id, seen);
        }
        for (const f of inputs) {
          const cell2 = r.values[f.id] ?? null;
          const key = JSON.stringify(cell2);
          if (seen.get(f.id) === key)
            continue;
          seen.set(f.id, key);
          engine.setInput(r.id, f.id, cellToValue(f, cell2));
        }
      }
    },
    hasFormulaFields() {
      return engine !== null;
    },
    displayValue(rowId, fieldId) {
      if (!engine)
        return null;
      const field = store.getFields().find((f) => f.id === fieldId);
      if (!field || field.type !== "formula")
        return null;
      return valueToCell(engine.value(rowId, fieldId));
    },
    error(rowId, fieldId) {
      if (!engine)
        return null;
      const field = store.getFields().find((f) => f.id === fieldId);
      if (!field || field.type !== "formula")
        return null;
      const v = engine.value(rowId, fieldId);
      if (v.t !== "err")
        return null;
      return { code: v.code, message: ERROR_MESSAGES[v.code] };
    },
    cycleFieldIds() {
      return engine ? engine.cycleFieldIds() : [];
    }
  };
}

// src/model/rowFilter.ts
function searchableText(value, field) {
  if (value === null || value === void 0)
    return "";
  const isSelect = field.type === "single_select" || field.type === "multi_select";
  if (!isSelect && typeof value === "string")
    return value;
  return getFieldType(field.type).format(value, field);
}
function searchRows(rows, fields, search) {
  const term = (search ?? "").trim().toLowerCase();
  if (!term)
    return rows.slice();
  return rows.filter(
    (row) => fields.some((field) => searchableText(row.values[field.id], field).toLowerCase().includes(term))
  );
}
function compileQuery(query, fields) {
  const trimmed = (query ?? "").trim();
  if (!trimmed)
    return { ok: true, predicate: null };
  const parsed = parseQuery(trimmed);
  if (!parsed.ok)
    return { ok: false, error: parsed.error };
  const compiled = compilePredicate(parsed.ast, fields);
  if (!compiled.ok)
    return { ok: false, error: compiled.error };
  return { ok: true, predicate: compiled.predicate };
}
function filterRows2(rows, fields, search, query) {
  const searched = searchRows(rows, fields, search);
  const compiled = compileQuery(query, fields);
  if (!compiled.ok)
    return { rows: searched, error: compiled.error };
  if (!compiled.predicate)
    return { rows: searched, error: null };
  return { rows: searched.filter(compiled.predicate), error: null };
}

// src/model/fieldChange.ts
var NOT_A_TARGET = {
  single_select: "Choose options in field settings (not in this version)",
  multi_select: "Choose options in field settings (not in this version)",
  attachment: "Attachments keep their own path",
  formula: "Formula fields are created with Add field",
  link: "Link fields are created with Add field"
};
function isEmpty2(v) {
  return v === null || v === void 0 || v === "" || Array.isArray(v) && v.length === 0;
}
function planTypeChange(rows, field, target) {
  if (!isKnownType(target))
    return { ok: false, reason: `Unknown type ${target}`, blockedRows: 0 };
  if (target === field.type)
    return { ok: false, reason: `Already ${field.type}`, blockedRows: 0 };
  if (field.type === "link")
    return { ok: false, reason: "Link fields keep their type", blockedRows: 0 };
  const note = NOT_A_TARGET[target];
  if (note)
    return { ok: false, reason: note, blockedRows: 0 };
  const targetType = getFieldType(target);
  if (targetType.readOnly)
    return { ok: false, reason: "Read-only type", blockedRows: 0 };
  const next = { ...field, type: target };
  if (target !== "single_select" && target !== "multi_select")
    delete next.options;
  if (target !== "formula")
    delete next.formula;
  if (target !== "link")
    delete next.linkTableId;
  const oldType = getFieldType(field.type);
  const valuesByRow = {};
  let blocked = 0;
  for (const row of rows) {
    const old = row.values[field.id];
    if (isEmpty2(old)) {
      valuesByRow[row.id] = null;
      continue;
    }
    const text = oldType.format(old, field);
    const parsed = targetType.parse(text, next);
    if (parsed === null || !targetType.validate(parsed, next)) {
      blocked++;
      continue;
    }
    valuesByRow[row.id] = parsed;
  }
  if (blocked > 0) {
    return { ok: false, reason: `${blocked} value${blocked === 1 ? "" : "s"} cannot convert to ${target}`, blockedRows: blocked };
  }
  return { ok: true, field: next, valuesByRow };
}

// src/model/tableSession.ts
function createSession(file) {
  const store = createTableStore({
    fields: file.fields,
    initialRows: file.rows
  });
  const stack = createCommandStack({ store });
  const formulas = createFormulaRuntime(store);
  const afterMutation = () => formulas.sync();
  let view = file.views[0];
  let syncLink = file.syncLink ?? null;
  const setViewState = (next) => {
    view = next;
  };
  return {
    store,
    stack,
    getVisibleFields() {
      return visibleFields(store.getFields(), view);
    },
    getFields() {
      return [...store.getFields()];
    },
    getField(fieldId) {
      return store.getFields().find((f) => f.id === fieldId);
    },
    getView() {
      return view;
    },
    getDisplayRows() {
      formulas.sync();
      const fields = store.getFields();
      const sorted = sortRows(store.getAllRows(), view.sort, fields);
      const rows = filterRows2(sorted, fields, view.search, view.query).rows;
      const formulaIds = fields.filter((f) => f.type === "formula").map((f) => f.id);
      if (formulaIds.length === 0)
        return rows;
      return rows.map((r) => {
        const values = { ...r.values };
        for (const id of formulaIds)
          values[id] = formulas.displayValue(r.id, id);
        return { ...r, values };
      });
    },
    getFormulaError(rowId, fieldId) {
      return formulas.error(rowId, fieldId);
    },
    setFormula(fieldId, formula) {
      const field = store.getFields().find((f) => f.id === fieldId);
      if (!field || field.type !== "formula")
        return { ok: false, reason: "Not a formula field" };
      const compiled = compileFormula(formula);
      if (!compiled.ok)
        return { ok: false, reason: ERROR_MESSAGES["#PARSE!"] };
      if (field.formula === formula)
        return { ok: true };
      stack.execute(createSetFormulaCommand({ fieldId, oldFormula: field.formula, newFormula: formula }));
      afterMutation();
      return { ok: true };
    },
    getFilterError() {
      const compiled = compileQuery(view.query, store.getFields());
      return compiled.ok ? null : compiled.error;
    },
    setValue(rowId, fieldId, value) {
      if (store.getFields().some((f) => f.id === fieldId && f.type === "formula"))
        return;
      const row = store.getRow(rowId);
      if (!row)
        return;
      const oldValue = row.values[fieldId] ?? null;
      if (JSON.stringify(oldValue) === JSON.stringify(value))
        return;
      stack.execute(createEditCellCommand({ rowId, fieldId, oldValue, newValue: value }));
      afterMutation();
    },
    addRow() {
      stack.execute(createAddRowCommand({ values: {} }));
      afterMutation();
    },
    insertRowNear(rowId, where) {
      const order = store.getAllRows().map((r) => r.id);
      const idx = order.indexOf(rowId);
      if (idx === -1)
        return;
      stack.execute(createInsertRowCommand({ index: where === "above" ? idx : idx + 1, values: {} }));
      afterMutation();
    },
    duplicateRow(rowId) {
      const source = store.getRow(rowId);
      if (!source)
        return;
      const idx = store.getAllRows().findIndex((r) => r.id === rowId);
      stack.execute(createInsertRowCommand({ index: idx + 1, values: { ...source.values } }));
      afterMutation();
    },
    deleteRow(rowId) {
      if (!store.getRow(rowId))
        return;
      stack.execute(createDeleteRowCommand({ rowId }));
      afterMutation();
    },
    setView(next) {
      const before = view;
      if (JSON.stringify(before) === JSON.stringify(next))
        return;
      stack.execute(createSetViewCommand({ apply: setViewState, before, after: next }));
    },
    patchView(patch) {
      const next = { ...view, ...patch };
      if (JSON.stringify(view) === JSON.stringify(next))
        return;
      setViewState(next);
    },
    addField(name, type, formula, linkTableId) {
      const field = {
        id: generateFieldId(),
        name,
        type,
        ...type === "formula" ? { formula: formula ?? "" } : {},
        // P8-04: a link field's default target table (FORMAT_SPEC §8).
        ...type === "link" ? { linkTableId: linkTableId ?? file.tableId } : {}
      };
      const viewBefore = view;
      const viewAfter = {
        ...view,
        columnOrder: [...view.columnOrder, field.id]
      };
      stack.execute(
        createAddFieldCommand({ field, applyView: setViewState, viewBefore, viewAfter })
      );
      afterMutation();
      return field;
    },
    changeFieldType(fieldId, target) {
      const field = store.getFields().find((f) => f.id === fieldId);
      if (!field)
        return { ok: false, reason: "Field not found", blockedRows: 0 };
      const rows = store.getAllRows();
      const plan = planTypeChange(rows, field, target);
      if (!plan.ok)
        return plan;
      const before = {
        field: { ...field },
        valuesByRow: Object.fromEntries(rows.map((r) => [r.id, r.values[fieldId] ?? null]))
      };
      stack.execute(
        createChangeFieldTypeCommand({
          before,
          after: { field: plan.field, valuesByRow: plan.valuesByRow }
        })
      );
      afterMutation();
      return plan;
    },
    undo() {
      const changed = stack.undo();
      afterMutation();
      return changed;
    },
    redo() {
      const changed = stack.redo();
      afterMutation();
      return changed;
    },
    getSyncLink() {
      return syncLink;
    },
    setSyncLink(link) {
      syncLink = link;
    },
    toFile() {
      const views = file.views.slice();
      views[0] = view;
      const formulaIds = store.getFields().filter((f) => f.type === "formula").map((f) => f.id);
      const rows = formulaIds.length === 0 ? store.getAllRows() : store.getAllRows().map((r) => {
        const values = { ...r.values };
        for (const id of formulaIds)
          delete values[id];
        return { ...r, values };
      });
      return { ...file, fields: store.getFields().map((f) => ({ ...f })), rows, views, syncLink };
    }
  };
}

// src/views/grid/editors/index.ts
var READONLY_TYPES = /* @__PURE__ */ new Set(["auto_number", "created_time", "modified_time", "formula"]);
function isReadOnly(field) {
  if (field.airtable?.readOnly)
    return true;
  return READONLY_TYPES.has(field.type) || getFieldType(field.type).readOnly;
}
function parseInput(field, input) {
  try {
    const ft = getFieldType(field.type);
    const parsed = ft.parse(input, field);
    if (input.trim() !== "" && parsed === null) {
      return { ok: false, error: `Invalid value for ${field.type}` };
    }
    const valid = ft.validate(parsed, field);
    if (!valid)
      return { ok: false, error: `Invalid value for ${field.type}` };
    return { ok: true, value: parsed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
function createEditor(field, row, store, stack, onDone) {
  if (isReadOnly(field))
    return null;
  const ft = getFieldType(field.type);
  const initial = ft.format(row.values[field.id] ?? null, field);
  let input;
  const isLong = field.type === "long_text";
  const isCheckbox = field.type === "checkbox";
  const isSingle = field.type === "single_select";
  const isMulti = field.type === "multi_select";
  if (isCheckbox) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = Boolean(row.values[field.id]);
    input = cb;
  } else if (isSingle || isMulti) {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = initial;
    input = inp;
  } else if (isLong) {
    const ta = document.createElement("textarea");
    ta.value = initial;
    input = ta;
  } else {
    const inp = document.createElement("input");
    inp.type = field.type === "date" || field.type === "date_time" ? "date" : "text";
    inp.value = initial;
    input = inp;
  }
  input.className = "tablify__editor";
  let isComposing = false;
  input.addEventListener("compositionstart", () => isComposing = true);
  input.addEventListener("compositionend", () => isComposing = false);
  let committed = false;
  const doCommit = () => {
    if (committed)
      return;
    committed = true;
    const raw = isCheckbox ? input.checked ? "true" : "false" : input.value;
    const res = parseInput(field, raw);
    if (!res.ok) {
      input.setAttribute("aria-invalid", "true");
      input.title = res.error;
      committed = false;
      return;
    }
    const oldValue = row.values[field.id] ?? null;
    if (String(oldValue) === String(res.value)) {
      onDone(false);
      return;
    }
    const cmd = createEditCellCommand({ rowId: row.id, fieldId: field.id, oldValue, newValue: res.value });
    stack.execute(cmd);
    onDone(true);
  };
  const doCancel = () => {
    if (committed)
      return;
    committed = true;
    onDone(false);
  };
  input.addEventListener("keydown", (e) => {
    if (isComposing)
      return;
    if (e.key === "Enter") {
      e.preventDefault();
      doCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      doCancel();
    }
  });
  input.addEventListener("blur", () => {
    if (!isComposing)
      doCommit();
  });
  setTimeout(() => input.focus(), 0);
  return input;
}

// src/views/grid/virtual.ts
var OVERSCAN = 5;
function rowHeightPx(rowHeight) {
  switch (rowHeight) {
    case "compact":
    case "small":
      return 28;
    case "medium":
      return 36;
    case "tall":
    case "large":
      return 48;
    default:
      return 36;
  }
}
function getVisibleRange(scrollTop, viewportHeight, rowHeight, totalRows, overscan = OVERSCAN) {
  if (totalRows <= 0 || rowHeight <= 0 || viewportHeight <= 0)
    return { start: 0, end: 0 };
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const firstVisible = Math.floor(scrollTop / rowHeight);
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(totalRows, firstVisible + visibleCount + overscan);
  return { start, end };
}
function totalHeight(totalRows, rowHeight) {
  return totalRows * rowHeight;
}

// src/views/grid/rowPool.ts
var RowPool = class {
  constructor(createRow) {
    this.createRow = createRow;
  }
  pool = [];
  active = /* @__PURE__ */ new Map();
  /**
   * Update pool for visible range [start, end). Returns active elements in order.
   * Recycles elements that fall outside the range.
   */
  update(start, end) {
    const needed = end - start;
    for (const [idx, el2] of this.active) {
      if (idx < start || idx >= end) {
        this.pool.push(el2);
        this.active.delete(idx);
      }
    }
    while (this.pool.length < needed - this.active.size) {
      this.pool.push(this.createRow());
    }
    const result = [];
    for (let i = start; i < end; i++) {
      if (!this.active.has(i)) {
        const el2 = this.pool.pop();
        this.active.set(i, el2);
      }
      result.push(this.active.get(i));
    }
    return result;
  }
  /** Current DOM size (active + pooled) — should stay bounded. */
  get size() {
    return this.active.size + this.pool.length;
  }
  /** Active count — visible + overscan */
  get activeCount() {
    return this.active.size;
  }
  /** For tests: get active indices */
  getActiveIndices() {
    return Array.from(this.active.keys()).sort((a, b) => a - b);
  }
  clear() {
    this.pool.push(...this.active.values());
    this.active.clear();
  }
};

// src/ui/theme/tokens.ts
var palette = {
  /** #181715 — dark theme background (prototype `dark`) */
  dark: "#181715",
  /** #FAF7F2 — light theme background (prototype `paper`) */
  light: "#FAF7F2",
  /** #22201D — dark card surface (prototype `dark-card`) */
  cardDark: "#22201D",
  /** #FFFFFF — light card surface (prototype `paper-card`) */
  cardLight: "#FFFFFF",
  /** #1B1A17 — dark inner surface: grid shell (prototype `dark-inner`) */
  innerDark: "#1B1A17",
  /** #F4EFE6 — light inner surface: grid shell (prototype `paper-inner`) */
  innerLight: "#F4EFE6",
  /** #262420 — dark capsule surface: cells, header capsules, popovers */
  capsuleDark: "#262420",
  /** #FFFFFF — light capsule surface (prototype cell/header capsules) */
  capsuleLight: "#FFFFFF",
  /** #38342E — dark subtle border (prototype `dark-border`) */
  borderDark: "#38342E",
  /** #E6E0D5 — light subtle border (prototype `paper-border`) */
  borderLight: "#E6E0D5",
  /** #ECE7E1 — body text on dark surfaces */
  textOnDark: "#ECE7E1",
  /** #1E1B18 — body text on light surfaces (prototype `charcoal`) */
  textOnLight: "#1E1B18",
  /** #9CA3AF — muted small text on dark (prototype dark `gray-400`) */
  mutedDark: "#9CA3AF",
  /**
   * #6E655C — muted small text on light. The prototype's clay (#8C827A) measures 3.55:1 on
   * its paper background — below AA for the 11px labels it carries — so the accessible
   * clay variant ships instead; see docs/evidence/P3-11.md (SAD-71 Step 2).
   */
  mutedLight: "#6E655C",
  /** #d97757 — primary accent on dark (prototype `terracotta-dark`), focus, selection */
  accentOrange: "#d97757",
  /** #CC785C — primary accent on light (prototype `terracotta`), focus, selection */
  terracotta: "#CC785C",
  /** #6a9bcc — secondary accent (links, info) */
  accentBlue: "#6a9bcc",
  /** #788c5d — success and tertiary accent */
  accentGreen: "#788c5d"
};
var lightTheme = {
  bg: palette.light,
  bgCard: palette.cardLight,
  bgInner: palette.innerLight,
  bgCapsule: palette.capsuleLight,
  bgSubtle: palette.innerLight,
  bgStripe: palette.innerLight,
  text: palette.textOnLight,
  textMuted: palette.mutedLight,
  border: palette.borderLight,
  borderSubtle: palette.borderLight,
  accentPrimary: palette.terracotta,
  accentSecondary: palette.accentBlue,
  accentSuccess: palette.accentGreen,
  selection: palette.terracotta,
  focus: palette.terracotta,
  onAccent: palette.textOnLight
};
var darkTheme = {
  bg: palette.dark,
  bgCard: palette.cardDark,
  bgInner: palette.innerDark,
  bgCapsule: palette.capsuleDark,
  bgSubtle: palette.capsuleDark,
  bgStripe: palette.cardDark,
  text: palette.textOnDark,
  textMuted: palette.mutedDark,
  border: palette.borderDark,
  borderSubtle: palette.borderDark,
  accentPrimary: palette.accentOrange,
  accentSecondary: palette.accentBlue,
  accentSuccess: palette.accentGreen,
  selection: palette.accentOrange,
  focus: palette.accentOrange,
  onAccent: palette.dark
};
var themes = {
  light: lightTheme,
  dark: darkTheme
};
var cssVars = {
  bg: "--tablify-bg",
  bgCard: "--tablify-bg-card",
  bgInner: "--tablify-bg-inner",
  bgCapsule: "--tablify-bg-capsule",
  bgSubtle: "--tablify-bg-subtle",
  bgStripe: "--tablify-bg-stripe",
  text: "--tablify-text",
  textMuted: "--tablify-text-muted",
  border: "--tablify-border",
  borderSubtle: "--tablify-border-subtle",
  accentPrimary: "--tablify-accent-primary",
  accentSecondary: "--tablify-accent-secondary",
  accentSuccess: "--tablify-accent-success",
  selection: "--tablify-selection",
  focus: "--tablify-focus",
  onAccent: "--tablify-on-accent"
};
function applyTheme(root, theme) {
  root.classList.remove("tablify--light", "tablify--dark");
  root.classList.add("tablify", `tablify--${theme}`);
  const t = themes[theme];
  root.style.setProperty(cssVars.bg, t.bg);
  root.style.setProperty(cssVars.bgCard, t.bgCard);
  root.style.setProperty(cssVars.bgInner, t.bgInner);
  root.style.setProperty(cssVars.bgCapsule, t.bgCapsule);
  root.style.setProperty(cssVars.bgSubtle, t.bgSubtle);
  root.style.setProperty(cssVars.bgStripe, t.bgStripe);
  root.style.setProperty(cssVars.text, t.text);
  root.style.setProperty(cssVars.textMuted, t.textMuted);
  root.style.setProperty(cssVars.border, t.border);
  root.style.setProperty(cssVars.borderSubtle, t.borderSubtle);
  root.style.setProperty(cssVars.accentPrimary, t.accentPrimary);
  root.style.setProperty(cssVars.accentSecondary, t.accentSecondary);
  root.style.setProperty(cssVars.accentSuccess, t.accentSuccess);
  root.style.setProperty(cssVars.selection, t.selection);
  root.style.setProperty(cssVars.focus, t.focus);
  root.style.setProperty(cssVars.onAccent, t.onAccent);
}

// src/views/grid/GridView.ts
var DEFAULT_COLUMN_WIDTH = 160;
function columnWidths(fields, view) {
  const widths = view.columnWidths ?? {};
  return fields.map((f) => {
    const w = widths[f.id];
    return typeof w === "number" && Number.isFinite(w) && w > 0 ? Math.round(w) : DEFAULT_COLUMN_WIDTH;
  });
}
var GridView = class {
  constructor(opts) {
    this.opts = opts;
    this.fields = opts.fields;
    this.rows = opts.rows;
    this.totalRows = opts.rows.length;
    this.rowHeight = rowHeightPx(opts.view.rowHeight);
    this.root = document.createElement("div");
    this.root.className = "tablify tablify--grid";
    this.root.setAttribute("role", "grid");
    this.root.setAttribute("aria-rowcount", String(this.totalRows + 1));
    this.root.setAttribute("aria-colcount", String(this.fields.length));
    this.sortState = Array.isArray(opts.view.sort) ? opts.view.sort.map((s) => ({ fieldId: s.fieldId, direction: s.direction })) : [];
    this.measure(opts.view);
    this.root.style.overflow = "auto";
    this.root.style.webkitOverflowScrolling = "touch";
    this.root.style.position = "relative";
    applyTheme(this.root, opts.theme);
    this.header = document.createElement("div");
    this.header.className = "tablify__header";
    this.header.setAttribute("role", "row");
    this.header.style.position = "sticky";
    this.header.style.top = "0";
    this.header.style.zIndex = "3";
    this.header.style.display = "flex";
    this.header.style.overflow = "hidden";
    this.root.appendChild(this.header);
    this.viewport = document.createElement("div");
    this.viewport.className = "tablify__viewport";
    this.viewport.setAttribute("role", "presentation");
    this.viewport.style.position = "relative";
    this.viewport.style.height = `${totalHeight(this.totalRows, this.rowHeight)}px`;
    this.viewport.style.overflowX = "auto";
    this.content = document.createElement("div");
    this.content.className = "tablify__content";
    this.content.setAttribute("role", "presentation");
    this.content.style.position = "absolute";
    this.content.style.top = "0";
    this.content.style.left = "0";
    this.content.style.right = "0";
    this.viewport.appendChild(this.content);
    this.root.appendChild(this.viewport);
    this.pool = new RowPool(() => {
      const el2 = document.createElement("div");
      el2.className = "tablify__row";
      el2.style.display = "flex";
      el2.style.height = `${this.rowHeight}px`;
      return el2;
    });
    this.root.addEventListener("scroll", () => {
      this.scrollTop = this.root.scrollTop;
      this.render();
    });
    this.viewport.addEventListener("scroll", () => {
      this.header.scrollLeft = this.viewport.scrollLeft;
    });
    this.root.addEventListener("click", (e) => {
      const target = e.target;
      const cell2 = target?.closest?.(".tablify__cell");
      if (!cell2)
        return;
      const rowEl = cell2.parentElement;
      const row = Number(rowEl?.dataset.rowIndex);
      const col = Number(cell2.dataset.colIndex);
      if (Number.isNaN(row) || Number.isNaN(col))
        return;
      this.setSelection({ row, col });
      this.opts.onCellClick?.(row, col);
    });
    this.renderHeader();
    this.render();
  }
  root;
  header;
  viewport;
  content;
  pool;
  scrollTop = 0;
  rowHeight;
  totalRows;
  fields;
  rows;
  selected = null;
  sortState = [];
  /** Column geometry, recomputed by measure(). Header and body share it. */
  widths = [];
  offsets = [];
  frozenColumns = 0;
  totalWidth = 0;
  /** Replace rows, fields, and view settings, then re-render. Scroll position is kept. */
  setModel(rows, fields, view) {
    this.rows = rows;
    this.fields = fields;
    this.totalRows = rows.length;
    this.rowHeight = rowHeightPx(view.rowHeight);
    this.sortState = Array.isArray(view.sort) ? view.sort.map((s) => ({ fieldId: s.fieldId, direction: s.direction })) : [];
    this.measure(view);
    this.root.setAttribute("aria-rowcount", String(this.totalRows + 1));
    this.root.setAttribute("aria-colcount", String(this.fields.length));
    this.viewport.style.height = `${totalHeight(this.totalRows, this.rowHeight)}px`;
    if (this.selected && (this.selected.row >= rows.length || this.selected.col >= fields.length)) {
      this.selected = null;
    }
    this.renderHeader();
    this.render();
  }
  /** Current selection, or null. */
  getSelection() {
    return this.selected ? { ...this.selected } : null;
  }
  /** Select one body cell (no-op if out of range). Pass null to clear. */
  setSelection(sel) {
    if (sel && (sel.row < 0 || sel.row >= this.totalRows || sel.col < 0 || sel.col >= this.fields.length))
      return;
    this.selected = sel ? { ...sel } : null;
    this.render();
  }
  /** Scroll so that the given row is inside the viewport. */
  scrollToRow(rowIndex) {
    const viewportH = this.root.clientHeight || this.opts.viewportHeight || 600;
    const top = rowIndex * this.rowHeight;
    const bodyTop = this.header.offsetHeight;
    if (top < this.scrollTop)
      this.setScrollTop(top);
    else if (top + this.rowHeight > this.scrollTop + viewportH - bodyTop) {
      this.setScrollTop(top + this.rowHeight - (viewportH - bodyTop));
    }
  }
  /** Set scrollTop programmatically (for tests/benchmark) */
  setScrollTop(top) {
    this.scrollTop = Math.max(0, top);
    this.root.scrollTop = this.scrollTop;
    this.render();
  }
  /** Update theme without rebuilding rows */
  setTheme(theme) {
    applyTheme(this.root, theme);
  }
  /**
   * Pane resize hook (SAD-71 Step 1). Sizing is CSS-driven, so a resize reflows the root
   * by itself; what needs redoing is the virtual-row math, which reads clientHeight.
   */
  handleResize() {
    this.render();
  }
  /** Number of DOM row elements currently mounted (active) */
  getRenderedRowCount() {
    return this.content.children.length;
  }
  /** Pool size (active + recycled) — should stay bounded */
  getPoolSize() {
    return this.pool.size;
  }
  /** For tests: get visible range */
  getVisibleRange(viewportHeight = 600) {
    return getVisibleRange(this.scrollTop, viewportHeight, this.rowHeight, this.totalRows, OVERSCAN);
  }
  /** Header labels in column order (for tests and accessibility checks). */
  getHeaderLabels() {
    return Array.from(this.header.children).map((c) => c.textContent ?? "");
  }
  /**
   * Recompute column geometry from the view. Called from the constructor and setModel(),
   * so a frozen-columns or column-width change takes effect on the next render.
   */
  measure(view) {
    this.widths = columnWidths(this.fields, view);
    this.frozenColumns = Math.max(
      0,
      Math.min(this.fields.length, Math.round(view.frozenColumns ?? 0))
    );
    this.offsets = [];
    let x = 0;
    for (const w of this.widths) {
      this.offsets.push(x);
      x += w;
    }
    this.totalWidth = x;
  }
  /**
   * @param frozenZIndex stacking order for a frozen cell. Body cells pass '1', header cells
   *   '2' — the header is its own stacking context, so this only has to outrank the other
   *   header cells, while the header element itself outranks the whole body.
   */
  styleCell(cell2, colIndex, frozenZIndex) {
    cell2.className = "tablify__cell";
    cell2.style.flex = "0 0 auto";
    cell2.style.boxSizing = "border-box";
    cell2.style.width = `${this.widths[colIndex] ?? DEFAULT_COLUMN_WIDTH}px`;
    if (colIndex < this.frozenColumns) {
      cell2.classList.add("tablify__cell--frozen");
      cell2.style.position = "sticky";
      cell2.style.left = `${this.offsets[colIndex]}px`;
      cell2.style.zIndex = frozenZIndex;
    }
  }
  renderHeader() {
    this.header.innerHTML = "";
    this.header.style.minWidth = "100%";
    this.header.style.width = `${this.totalWidth}px`;
    const primarySort = this.sortState[0];
    this.fields.forEach((field, colIndex) => {
      const cell2 = document.createElement("div");
      this.styleCell(cell2, colIndex, "2");
      cell2.classList.add("tablify__header-cell");
      cell2.style.fontWeight = "600";
      cell2.setAttribute("role", "columnheader");
      cell2.setAttribute("aria-colindex", String(colIndex + 1));
      cell2.setAttribute("data-field-type", field.type);
      if (primarySort && primarySort.fieldId === field.id) {
        cell2.setAttribute("aria-sort", primarySort.direction === "desc" ? "descending" : "ascending");
      } else {
        cell2.removeAttribute("aria-sort");
      }
      cell2.dataset.colIndex = String(colIndex);
      cell2.setAttribute("data-field-id", field.id);
      cell2.textContent = field.name;
      this.header.appendChild(cell2);
    });
  }
  render() {
    const viewportH = this.root.clientHeight || this.opts.viewportHeight || 600;
    const { start, end } = getVisibleRange(this.scrollTop, viewportH, this.rowHeight, this.totalRows, OVERSCAN);
    const rows = this.pool.update(start, end);
    this.content.innerHTML = "";
    this.content.style.transform = `translateY(${start * this.rowHeight}px)`;
    for (let i = 0; i < rows.length; i++) {
      const rowEl = rows[i];
      const rowIdx = start + i;
      rowEl.dataset.rowIndex = String(rowIdx);
      rowEl.setAttribute("role", "row");
      rowEl.style.height = `${this.rowHeight}px`;
      rowEl.style.minWidth = "100%";
      rowEl.style.width = `${this.totalWidth}px`;
      rowEl.setAttribute("aria-rowindex", String(rowIdx + 2));
      rowEl.innerHTML = "";
      const row = this.rows[rowIdx];
      if (row) {
        if (rowIdx % 2 === 1)
          rowEl.classList.add("tablify__row--stripe");
        else
          rowEl.classList.remove("tablify__row--stripe");
        this.fields.forEach((field, colIndex) => {
          const cell2 = document.createElement("div");
          this.styleCell(cell2, colIndex, "1");
          const val = row.values[field.id];
          const formulaErr = field.type === "formula" && this.opts.formulaError ? this.opts.formulaError(row.id, field.id) : null;
          const text = document.createElement("span");
          text.className = "tablify__cell-text";
          if (formulaErr) {
            text.textContent = formulaErr.code;
            cell2.classList.add("tablify__cell--error");
            cell2.title = formulaErr.message;
            cell2.setAttribute("data-formula-error", formulaErr.code);
          } else if (field.type === "link") {
            const summary = this.opts.linkSummary ? this.opts.linkSummary(val) : { text: getFieldType("link").format(val ?? null, field), broken: 0 };
            text.textContent = summary.text;
            if (summary.broken > 0) {
              cell2.classList.add("tablify__cell--broken-link");
              cell2.title = `${summary.broken} broken ${summary.broken === 1 ? "link" : "links"}: the linked row or table was not found.`;
              cell2.setAttribute("data-broken-links", String(summary.broken));
            }
          } else {
            text.textContent = val === void 0 || val === null ? "" : String(Array.isArray(val) ? val.join(", ") : val);
          }
          cell2.appendChild(text);
          cell2.setAttribute("data-field-id", field.id);
          cell2.dataset.colIndex = String(colIndex);
          cell2.setAttribute("role", "gridcell");
          cell2.setAttribute("aria-colindex", String(colIndex + 1));
          cell2.setAttribute("aria-description", `Row ${rowIdx + 1}, column ${field.name}`);
          if (this.selected && this.selected.row === rowIdx && this.selected.col === colIndex) {
            cell2.classList.add("tablify__cell--selected");
            cell2.setAttribute("aria-selected", "true");
            cell2.style.outline = "2px solid var(--tablify-selection)";
            cell2.style.outlineOffset = "-2px";
          }
          rowEl.appendChild(cell2);
        });
      }
      this.content.appendChild(rowEl);
    }
  }
  destroy() {
    this.root.remove();
    this.pool.clear();
  }
};

// src/views/grid/keyboard.ts
function getGridAction(e) {
  const ctrl = !!(e.ctrlKey || e.metaKey);
  if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey)
    return "undo";
  if (ctrl && e.key.toLowerCase() === "z" && !!e.shiftKey)
    return "redo";
  if (ctrl && e.key.toLowerCase() === "y")
    return "redo";
  if (ctrl && e.key.toLowerCase() === "c")
    return "copy";
  if (ctrl && e.key.toLowerCase() === "v")
    return "paste";
  if (e.key === "ArrowUp")
    return "moveUp";
  if (e.key === "ArrowDown")
    return "moveDown";
  if (e.key === "ArrowLeft")
    return "moveLeft";
  if (e.key === "ArrowRight")
    return "moveRight";
  if (e.key === "Tab" && !e.shiftKey)
    return "tabNext";
  if (e.key === "Tab" && !!e.shiftKey)
    return "tabPrev";
  if (e.key === "Enter")
    return "enterEdit";
  if (e.key === "Escape")
    return "escapeCancel";
  return "none";
}
function shouldHandleForGrid(gridRoot, activeElement) {
  return !!activeElement && gridRoot.contains(activeElement);
}

// src/views/tableController.ts
function moveSelection(sel, action, rowCount, colCount) {
  if (rowCount <= 0 || colCount <= 0)
    return sel;
  const clamp = (n, max2) => Math.min(max2 - 1, Math.max(0, n));
  let { row, col } = sel;
  switch (action) {
    case "moveUp":
      row = clamp(row - 1, rowCount);
      break;
    case "moveDown":
      row = clamp(row + 1, rowCount);
      break;
    case "moveLeft":
      col = clamp(col - 1, colCount);
      break;
    case "moveRight":
      col = clamp(col + 1, colCount);
      break;
    case "tabNext":
      if (col + 1 < colCount)
        col++;
      else if (row + 1 < rowCount) {
        row++;
        col = 0;
      }
      break;
    case "tabPrev":
      if (col > 0)
        col--;
      else if (row > 0) {
        row--;
        col = colCount - 1;
      }
      break;
    default:
      return sel;
  }
  return { row: clamp(row, rowCount), col: clamp(col, colCount) };
}
function isMoveAction(action) {
  return action === "moveUp" || action === "moveDown" || action === "moveLeft" || action === "moveRight" || action === "tabNext" || action === "tabPrev";
}

// src/views/longPress.ts
var LONG_PRESS_MS = 500;
var LONG_PRESS_MOVE_PX = 10;
var LongPressDetector = class {
  constructor(opts) {
    this.opts = opts;
    this.thresholdMs = opts.thresholdMs ?? LONG_PRESS_MS;
    this.moveTolerancePx = opts.moveTolerancePx ?? LONG_PRESS_MOVE_PX;
    this.timers = opts.timers ?? { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h) };
  }
  phase = "idle";
  startX = 0;
  startY = 0;
  handle = null;
  thresholdMs;
  moveTolerancePx;
  timers;
  get state() {
    return this.phase;
  }
  /** True while a touch press is being evaluated (before it fires or is cancelled). */
  isPending() {
    return this.phase === "pending";
  }
  /** Start tracking a press. Only touch pointers are tracked. Returns true if tracking started. */
  pointerDown(x, y, pointerType) {
    this.clearTimer();
    if (pointerType !== "touch") {
      this.phase = "idle";
      return false;
    }
    this.phase = "pending";
    this.startX = x;
    this.startY = y;
    this.handle = this.timers.setTimeout(() => this.fire(), this.thresholdMs);
    return true;
  }
  pointerMove(x, y) {
    if (this.phase !== "pending")
      return;
    const dist = Math.hypot(x - this.startX, y - this.startY);
    if (dist > this.moveTolerancePx)
      this.cancel();
  }
  /**
   * Pointer released. Returns true when a long press fired during this press.
   * The caller can use this to suppress the click that follows.
   */
  pointerUp() {
    const fired = this.phase === "fired";
    this.cancel();
    return fired;
  }
  /** Browser cancelled the pointer (for example, it started a native scroll). */
  pointerCancel() {
    this.cancel();
  }
  /** Grid scrolled while pressing: cancel. */
  scroll() {
    this.cancel();
  }
  fire() {
    this.handle = null;
    if (this.phase !== "pending")
      return;
    this.phase = "fired";
    this.opts.onLongPress({ x: this.startX, y: this.startY });
  }
  cancel() {
    this.clearTimer();
    this.phase = "idle";
  }
  clearTimer() {
    if (this.handle !== null) {
      this.timers.clearTimeout(this.handle);
      this.handle = null;
    }
  }
};

// src/menus/tableMenu.ts
var import_obsidian4 = require("obsidian");

// src/menus/tableMenuModel.ts
var SEPARATOR = { id: "sep", label: "", enabled: false, separator: true };
var TYPE_LABELS = {
  text: "Text",
  long_text: "Long text",
  number: "Number",
  currency: "Currency",
  percent: "Percent",
  duration: "Duration",
  rating: "Rating",
  checkbox: "Checkbox",
  date: "Date",
  date_time: "Date and time",
  url: "URL",
  email: "Email",
  phone: "Phone",
  single_select: "Single select",
  multi_select: "Multi select",
  attachment: "Attachment",
  formula: "Formula",
  link: "Link"
};
var CHANGE_TARGET_TYPES = [
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
  "formula",
  "link"
];
function cellEntries(ctx) {
  const entries = [{ id: "cell.copy", label: "Copy", enabled: true }];
  if (ctx.isLink) {
    entries.push({ id: "cell.links", label: "Choose linked rows\u2026", enabled: !ctx.readOnly });
  }
  return [
    ...entries,
    {
      id: "cell.paste",
      label: "Paste",
      enabled: !ctx.readOnly && ctx.hasClipboard && !ctx.isLink,
      reason: ctx.readOnly ? "Read-only field" : ctx.isLink ? "Use Choose linked rows instead" : "Nothing copied yet"
    },
    {
      id: "cell.clear",
      label: "Clear",
      enabled: !ctx.readOnly && !ctx.cellEmpty,
      reason: ctx.readOnly ? "Read-only field" : "Cell is already empty"
    }
  ];
}
function rowEntries() {
  return [
    { id: "row.insertAbove", label: "Insert row above", enabled: true },
    { id: "row.insertBelow", label: "Insert row below", enabled: true },
    { id: "row.duplicate", label: "Duplicate row", enabled: true },
    { id: "row.copy", label: "Copy row", enabled: true },
    { id: "row.delete", label: "Delete row", enabled: true }
  ];
}
function headerEntries(ctx) {
  const sort = ctx.view.sort;
  const sortedThis = sort.length === 1 && sort[0].fieldId === ctx.fieldId ? sort[0].direction : null;
  const frozenThrough = ctx.colIndex + 1;
  return [
    // Opens a type picker (no submenus in this Obsidian API version). See tableMenu.ts.
    { id: "header.type", label: "Change field type\u2026", enabled: true },
    // P8-03: only formula fields have an expression to edit.
    ...ctx.fieldType === "formula" ? [{ id: "header.formula", label: "Edit formula\u2026", enabled: true }] : [],
    {
      id: "header.hide",
      label: "Hide field",
      enabled: !ctx.isPrimary,
      reason: "Primary field cannot be hidden"
    },
    {
      id: "header.sortAsc",
      label: "Sort ascending",
      enabled: sortedThis !== "asc",
      reason: "Already sorted ascending"
    },
    {
      id: "header.sortDesc",
      label: "Sort descending",
      enabled: sortedThis !== "desc",
      reason: "Already sorted descending"
    },
    {
      id: "header.freeze",
      label: "Freeze column",
      enabled: ctx.view.frozenColumns !== frozenThrough,
      reason: "Already frozen through this column"
    }
  ];
}
function cellMenu(cell2) {
  return [...cellEntries(cell2), SEPARATOR, ...rowEntries()];
}
function displayTitle(entry) {
  return entry.enabled || !entry.reason ? entry.label : `${entry.label} (${entry.reason})`;
}

// src/menus/tableMenu.ts
function buildTableMenu(entries, run2) {
  const menu = new import_obsidian4.Menu();
  for (const entry of entries) {
    if (entry.separator) {
      menu.addSeparator();
      continue;
    }
    menu.addItem((item) => {
      item.setTitle(displayTitle(entry));
      if (!entry.enabled)
        item.setDisabled(true);
      item.onClick(() => {
        if (entry.enabled)
          run2(entry.id);
      });
    });
  }
  return menu;
}
var TypePickerModal = class extends import_obsidian4.FuzzySuggestModal {
  constructor(app, targets, onPick) {
    super(app);
    this.targets = targets;
    this.onPick = onPick;
    this.setPlaceholder("Change field type to\u2026");
  }
  getItems() {
    return this.targets;
  }
  getItemText(t) {
    const label = TYPE_LABELS[t.type] ?? t.type;
    return t.ok ? label : `${label} (${t.reason ?? "not available"})`;
  }
  onChooseItem(t) {
    if (t.ok) {
      this.onPick(t);
      return;
    }
    new import_obsidian4.Notice(`Cannot change to ${TYPE_LABELS[t.type] ?? t.type}: ${t.reason ?? "not available"}`);
  }
};

// src/views/grid/columns.ts
function setFrozenColumns(view, n, fields) {
  const clamped = Math.max(0, Math.min(fields.length, Math.round(n)));
  const next = { ...view, frozenColumns: clamped };
  const res = validateView(next, fields);
  return res.ok ? res.view : view;
}
function setRowHeight(view, h, fields) {
  const next = { ...view, rowHeight: h };
  const res = validateView(next, fields);
  return res.ok ? res.view : view;
}

// src/views/grid/toolbar.ts
var ROW_HEIGHTS = ["small", "medium", "large"];
var ROW_HEIGHT_LABELS = {
  small: "Small",
  medium: "Medium",
  large: "Large"
};
var DEBOUNCE_MS2 = 200;
var ICONS = {
  search: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="7" cy="7" r="4.5"></circle><path d="M10.5 10.5 L14 14"></path></svg>',
  plus: '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 3v10M3 8h10"></path></svg>',
  columns: '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1.5"></rect><path d="M8 3v10"></path></svg>',
  sliders: '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 5h10M3 11h10"></path><circle cx="6" cy="5" r="1.6" fill="currentColor" stroke="none"></circle><circle cx="10" cy="11" r="1.6" fill="currentColor" stroke="none"></circle></svg>',
  undo: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 4 L3 7 L6 10"></path><path d="M3 7 h7 a3 3 0 0 1 0 6 H7"></path></svg>',
  redo: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 4 L13 7 L10 10"></path><path d="M13 7 H6 a3 3 0 0 0 0 6 h3"></path></svg>'
};
function iconSpan(glyph) {
  const span = document.createElement("span");
  span.className = "tablify__btn-icon";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = ICONS[glyph];
  return span;
}
var ACTIONS = {
  addRow: "add-row",
  addField: "add-field",
  options: "options",
  undo: "undo",
  redo: "redo",
  clearFilters: "clear-filters"
};
var Toolbar = class {
  root;
  opts;
  searchInput;
  queryInput;
  queryError;
  optionsPanel;
  optionsButton;
  rowCount;
  hiddenList;
  searchTimer = null;
  queryTimer = null;
  constructor(options) {
    this.opts = options;
    this.root = document.createElement("div");
    this.root.className = "tablify__toolbar";
    applyTheme(this.root, options.theme);
    const topRow = document.createElement("div");
    topRow.className = "tablify__toolbar-row";
    const searchWrap = document.createElement("div");
    searchWrap.className = "tablify__search";
    const searchIcon = document.createElement("span");
    searchIcon.className = "tablify__search-icon";
    searchIcon.setAttribute("aria-hidden", "true");
    searchIcon.innerHTML = ICONS.search;
    this.searchInput = document.createElement("input");
    this.searchInput.type = "search";
    this.searchInput.className = "tablify__search-input";
    this.searchInput.placeholder = "Search rows\u2026";
    this.searchInput.setAttribute("aria-label", "Search rows");
    this.searchInput.dataset.testid = "tablify-search";
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(this.searchInput);
    const actions = document.createElement("div");
    actions.className = "tablify__toolbar-actions";
    actions.appendChild(this.makeButton(ACTIONS.addRow, "Add row", "Add row", "plus"));
    actions.appendChild(this.makeButton(ACTIONS.addField, "Add Field", "Add field", "columns"));
    this.optionsButton = this.makeButton(ACTIONS.options, "Options", "View settings", "sliders");
    this.optionsButton.setAttribute("aria-haspopup", "true");
    this.optionsButton.setAttribute("aria-expanded", "false");
    actions.appendChild(this.optionsButton);
    actions.appendChild(this.makeButton(ACTIONS.undo, "", "Undo", "undo"));
    actions.appendChild(this.makeButton(ACTIONS.redo, "", "Redo", "redo"));
    topRow.appendChild(searchWrap);
    topRow.appendChild(actions);
    this.root.appendChild(topRow);
    const queryRow = document.createElement("div");
    queryRow.className = "tablify__query-row";
    this.queryInput = document.createElement("input");
    this.queryInput.type = "text";
    this.queryInput.className = "tablify__query-input";
    this.queryInput.placeholder = "Filter, e.g. Status:Done Amount:>10";
    this.queryInput.setAttribute("aria-label", "Filter rows with a query");
    this.queryInput.dataset.testid = "tablify-query";
    this.queryError = document.createElement("div");
    this.queryError.className = "tablify__query-error";
    this.queryError.setAttribute("role", "alert");
    this.queryError.dataset.testid = "tablify-query-error";
    queryRow.appendChild(this.queryInput);
    queryRow.appendChild(this.queryError);
    this.root.appendChild(queryRow);
    this.optionsPanel = document.createElement("div");
    this.optionsPanel.className = "tablify__options";
    this.optionsPanel.hidden = true;
    this.optionsPanel.dataset.testid = "tablify-options";
    this.hiddenList = document.createElement("div");
    this.hiddenList.className = "tablify__hidden-fields";
    this.hiddenList.dataset.testid = "tablify-hidden-fields";
    this.optionsPanel.appendChild(this.hiddenList);
    this.root.appendChild(this.optionsPanel);
    this.rowCount = document.createElement("div");
    this.rowCount.className = "tablify__rowcount";
    this.rowCount.dataset.testid = "tablify-rowcount";
    this.rowCount.setAttribute("aria-live", "polite");
    this.root.appendChild(this.rowCount);
    this.wireEvents();
    this.update(options);
  }
  // ---- construction helpers ----
  makeButton(action, label, title, glyph) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tablify__toolbar-button";
    btn.appendChild(iconSpan(glyph));
    if (label) {
      const text = document.createElement("span");
      text.className = "tablify__btn-label";
      text.textContent = label;
      btn.appendChild(text);
    }
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.dataset.action = action;
    return btn;
  }
  /** Outside press closes the view-settings popover (SAD-71 Step 3). */
  outsideClose = (event) => {
    const target = event.target;
    if (target && !this.root.contains(target))
      this.setOptionsOpen(false);
  };
  wireEvents() {
    this.searchInput.addEventListener("input", () => {
      if (this.searchTimer !== null)
        clearTimeout(this.searchTimer);
      const value = this.searchInput.value;
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        this.opts.callbacks.onSearch(value);
      }, DEBOUNCE_MS2);
    });
    this.queryInput.addEventListener("input", () => {
      this.showQueryError(this.queryInput.value);
      if (this.queryTimer !== null)
        clearTimeout(this.queryTimer);
      const value = this.queryInput.value;
      this.queryTimer = setTimeout(() => {
        this.queryTimer = null;
        this.opts.callbacks.onQuery(value);
      }, DEBOUNCE_MS2);
    });
    this.root.addEventListener("click", (event) => {
      const target = event.target;
      if (!target)
        return;
      const showBtn = target.closest("[data-show-field]");
      const fieldId = showBtn?.dataset.showField;
      if (fieldId) {
        this.opts.callbacks.onShowField(fieldId);
        return;
      }
      const heightBtn = target.closest("[data-row-height]");
      const height = heightBtn?.dataset.rowHeight;
      if (height) {
        this.opts.callbacks.onRowHeight(height);
        return;
      }
      const button = target.closest("[data-action]");
      const action = button?.dataset.action;
      if (action)
        this.handleAction(action);
    });
    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.optionsPanel.hidden)
        this.setOptionsOpen(false);
    });
  }
  handleAction(action) {
    switch (action) {
      case ACTIONS.addRow:
        this.opts.callbacks.onAddRow();
        break;
      case ACTIONS.addField:
        this.opts.callbacks.onAddField();
        break;
      case ACTIONS.options:
        this.setOptionsOpen(this.optionsPanel.hidden);
        break;
      case ACTIONS.clearFilters:
        this.opts.callbacks.onClearFilters();
        break;
      case ACTIONS.undo:
        this.opts.callbacks.onUndo();
        break;
      case ACTIONS.redo:
        this.opts.callbacks.onRedo();
        break;
      default:
        break;
    }
  }
  // ---- public API ----
  /** Refresh derived state without rebuilding the inputs (that would drop focus/caret). */
  update(state) {
    this.opts.fields = state.fields;
    this.opts.view = state.view;
    this.opts.visibleRowCount = state.visibleRowCount;
    this.opts.totalRowCount = state.totalRowCount;
    this.opts.search = state.search;
    this.opts.query = state.query;
    this.opts.queryError = state.queryError;
    if (state.theme !== this.opts.theme) {
      this.opts.theme = state.theme;
      applyTheme(this.root, state.theme);
    }
    if (document.activeElement !== this.searchInput && this.searchInput.value !== (state.search ?? "")) {
      this.searchInput.value = state.search ?? "";
    }
    if (document.activeElement !== this.queryInput && this.queryInput.value !== (state.query ?? "")) {
      this.queryInput.value = state.query ?? "";
    }
    this.showQueryError(this.queryInput.value);
    this.renderRowCount();
    this.renderOptions();
  }
  /** True when the view settings popover is open. */
  isOptionsOpen() {
    return !this.optionsPanel.hidden;
  }
  destroy() {
    if (this.searchTimer !== null)
      clearTimeout(this.searchTimer);
    if (this.queryTimer !== null)
      clearTimeout(this.queryTimer);
    this.searchTimer = null;
    this.queryTimer = null;
    document.removeEventListener("pointerdown", this.outsideClose);
    this.root.remove();
  }
  // ---- rendering ----
  showQueryError(raw) {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) {
      const persisted = this.opts.queryError;
      if (persisted) {
        this.queryError.textContent = `${persisted.message} (position ${persisted.position})`;
        this.queryError.hidden = false;
        this.queryInput.classList.add("tablify__query-input--invalid");
        return;
      }
      this.queryError.textContent = "";
      this.queryError.hidden = true;
      this.queryInput.classList.remove("tablify__query-input--invalid");
      return;
    }
    const parsed = parseQuery(trimmed);
    if (parsed.ok) {
      this.queryError.textContent = "";
      this.queryError.hidden = true;
      this.queryInput.classList.remove("tablify__query-input--invalid");
      return;
    }
    this.queryError.textContent = `${parsed.error.message} (position ${parsed.error.position})`;
    this.queryError.hidden = false;
    this.queryInput.classList.add("tablify__query-input--invalid");
  }
  renderRowCount() {
    const { visibleRowCount, totalRowCount } = this.opts;
    const filtered = visibleRowCount !== totalRowCount;
    this.rowCount.textContent = filtered ? `${visibleRowCount} of ${totalRowCount} rows` : `${totalRowCount} ${totalRowCount === 1 ? "row" : "rows"}`;
  }
  setOptionsOpen(open2) {
    this.optionsPanel.hidden = !open2;
    this.optionsButton.setAttribute("aria-expanded", String(open2));
    if (open2)
      document.addEventListener("pointerdown", this.outsideClose);
    else
      document.removeEventListener("pointerdown", this.outsideClose);
    if (open2)
      this.renderOptions();
  }
  renderOptions() {
    const { view, fields } = this.opts;
    this.optionsPanel.textContent = "";
    const heightGroup = document.createElement("div");
    heightGroup.className = "tablify__option-group";
    heightGroup.dataset.testid = "option-rowheight";
    const heightLabel = document.createElement("span");
    heightLabel.className = "tablify__option-label";
    heightLabel.textContent = "Row height";
    heightGroup.appendChild(heightLabel);
    for (const h of ROW_HEIGHTS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tablify__option-button";
      btn.textContent = ROW_HEIGHT_LABELS[h] ?? h;
      btn.dataset.rowHeight = h;
      if (view.rowHeight === h)
        btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", String(view.rowHeight === h));
      heightGroup.appendChild(btn);
    }
    this.optionsPanel.appendChild(heightGroup);
    const freezeGroup = document.createElement("div");
    freezeGroup.className = "tablify__option-group";
    freezeGroup.dataset.testid = "option-freeze";
    const freezeLabel = document.createElement("label");
    freezeLabel.className = "tablify__option-label";
    freezeLabel.textContent = "Freeze columns";
    const select = document.createElement("select");
    select.className = "tablify__option-select";
    select.setAttribute("aria-label", "Number of frozen columns");
    for (let n = 0; n <= fields.length; n++) {
      const option = document.createElement("option");
      option.value = String(n);
      option.textContent = String(n);
      if (view.frozenColumns === n)
        option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener("change", () => {
      this.opts.callbacks.onFreezeColumns(Number(select.value));
    });
    freezeGroup.appendChild(freezeLabel);
    freezeGroup.appendChild(select);
    this.optionsPanel.appendChild(freezeGroup);
    const hiddenGroup = document.createElement("div");
    hiddenGroup.className = "tablify__option-group";
    hiddenGroup.dataset.testid = "tablify-hidden-fields";
    const hiddenLabel = document.createElement("span");
    hiddenLabel.className = "tablify__option-label";
    hiddenLabel.textContent = "Hidden fields";
    hiddenGroup.appendChild(hiddenLabel);
    const hidden = new Set(view.hidden ?? []);
    const hiddenFields = fields.filter((f) => hidden.has(f.id));
    if (hiddenFields.length === 0) {
      const none = document.createElement("span");
      none.className = "tablify__option-empty";
      none.textContent = "None";
      hiddenGroup.appendChild(none);
    } else {
      for (const field of hiddenFields) {
        const row = document.createElement("div");
        row.className = "tablify__hidden-field";
        const name = document.createElement("span");
        name.className = "tablify__hidden-field-name";
        name.textContent = field.name;
        const show = document.createElement("button");
        show.type = "button";
        show.className = "tablify__option-button";
        show.textContent = "Show";
        show.dataset.showField = field.id;
        show.setAttribute("aria-label", `Show field ${field.name}`);
        row.appendChild(name);
        row.appendChild(show);
        hiddenGroup.appendChild(row);
      }
    }
    this.optionsPanel.appendChild(hiddenGroup);
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "tablify__option-button tablify__option-button--wide";
    clear.textContent = "Clear filters";
    clear.dataset.action = ACTIONS.clearFilters;
    this.optionsPanel.appendChild(clear);
  }
};

// src/views/grid/AddFieldModal.ts
var import_obsidian5 = require("obsidian");
var DEFAULT_NEW_FIELD_TYPE = "text";
var AddFieldModal = class extends import_obsidian5.Modal {
  constructor(app, onConfirm, options = {}) {
    super(app);
    this.onConfirm = onConfirm;
    this.options = options;
    this.linkTableId = options.defaultLinkTableId ?? options.linkTargets?.[0]?.tableId ?? "";
  }
  name = "";
  type = DEFAULT_NEW_FIELD_TYPE;
  expression = "";
  linkTableId;
  onOpen() {
    this.setTitle("Add field");
    this.modalEl.addClass("tablify__modal");
    applyTheme(this.modalEl, document.body.classList.contains("theme-dark") ? "dark" : "light");
    new import_obsidian5.Setting(this.contentEl).setName("Field name").setDesc("Shown as the column heading.").addText(
      (text) => text.setValue(this.name).onChange((value) => {
        this.name = value;
      })
    );
    new import_obsidian5.Setting(this.contentEl).setName("Field type").addDropdown((dropdown) => {
      for (const type of CHANGE_TARGET_TYPES) {
        dropdown.addOption(type, TYPE_LABELS[type] ?? type);
      }
      dropdown.setValue(this.type).onChange((value) => {
        this.type = value;
        showTypeRows();
      });
    });
    const formulaRow = this.contentEl.createDiv();
    new import_obsidian5.Setting(formulaRow).setName("Formula").setDesc("Refer to fields as {Field name}. Example: {Price} * {Quantity}").addText(
      (text) => text.setValue(this.expression).setPlaceholder("{Price} * 2").onChange((value) => {
        this.expression = value;
      })
    );
    const linkRow = this.contentEl.createDiv();
    const targets = this.options.linkTargets ?? [];
    new import_obsidian5.Setting(linkRow).setName("Link to table").setDesc(targets.length === 0 ? "No tables are available to link to." : "Rows are picked from this table.").addDropdown((dropdown) => {
      for (const t of targets)
        dropdown.addOption(t.tableId, t.name);
      if (this.linkTableId)
        dropdown.setValue(this.linkTableId);
      dropdown.onChange((value) => {
        this.linkTableId = value;
      });
    });
    const showTypeRows = () => {
      formulaRow.style.display = this.type === "formula" ? "" : "none";
      linkRow.style.display = this.type === "link" ? "" : "none";
    };
    showTypeRows();
    new import_obsidian5.Setting(this.contentEl).addButton(
      (button) => button.setButtonText("Add field").setCta().onClick(() => this.submit())
    );
    this.contentEl.addEventListener("keydown", (event) => {
      const evt = event;
      if (evt.key === "Enter" && evt.target?.tagName === "INPUT") {
        evt.preventDefault();
        this.submit();
      }
    });
  }
  submit() {
    const name = this.name.trim();
    if (!name) {
      new import_obsidian5.Notice("Field name cannot be empty.");
      return;
    }
    if (this.type === "link") {
      if (!this.linkTableId) {
        new import_obsidian5.Notice("Choose a table to link to.");
        return;
      }
      this.close();
      this.onConfirm(name, this.type, void 0, this.linkTableId);
      return;
    }
    if (this.type === "formula") {
      const compiled = compileFormula(this.expression);
      if (!compiled.ok) {
        new import_obsidian5.Notice("The formula has a syntax error.");
        return;
      }
      this.close();
      this.onConfirm(name, this.type, this.expression);
      return;
    }
    this.close();
    this.onConfirm(name, this.type);
  }
};

// src/views/grid/LinkPickerModal.ts
var import_obsidian6 = require("obsidian");
var LinkPickerModal = class extends import_obsidian6.Modal {
  constructor(opts) {
    super(opts.app);
    this.opts = opts;
    this.targetId = opts.field.linkTableId ?? "";
    for (const ref of opts.current) {
      if (ref.tableId === this.targetId) {
        this.selected.add(ref.rowId);
        this.order.push(ref.rowId);
      }
    }
  }
  targetId;
  selected = /* @__PURE__ */ new Set();
  order = [];
  query = "";
  onOpen() {
    this.setTitle(`Link: ${this.opts.field.name}`);
    this.modalEl.addClass("tablify__modal");
    applyTheme(this.modalEl, document.body.classList.contains("theme-dark") ? "dark" : "light");
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    const table = this.opts.index.byTableId(this.targetId);
    if (!table) {
      root.createEl("p", {
        text: "The table this field links to is not in this vault. Existing links are kept until you clear them.",
        cls: "tablify-link-picker__note"
      });
      new import_obsidian6.Setting(root).addButton((b) => b.setButtonText("Clear links").setWarning().onClick(() => this.save(null))).addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
      return;
    }
    root.createEl("p", { text: `Rows in ${table.name}`, cls: "tablify-link-picker__note" });
    const list = root.createDiv({ cls: "tablify-link-picker__list" });
    const search = root.createEl("input", { type: "text", cls: "tablify-link-picker__search" });
    search.placeholder = "Search rows";
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderList(list, table.rows);
    });
    this.renderList(list, table.rows);
    new import_obsidian6.Setting(root).addButton((b) => b.setButtonText("Clear").onClick(() => this.save(null))).addButton((b) => b.setButtonText("Cancel").onClick(() => this.close())).addButton((b) => b.setButtonText("Save").setCta().onClick(() => this.save(this.result(table.rows))));
  }
  renderList(list, rows) {
    list.empty();
    const known = new Set(rows.map((r) => r.id));
    const missing = this.order.filter((id) => !known.has(id));
    if (missing.length > 0) {
      list.createDiv({ text: "Missing (the row was deleted)", cls: "tablify-link-picker__heading" });
      for (const id of missing)
        this.itemRow(list, id, "Missing row", true);
    }
    const visible = filterRows(rows, this.query);
    if (visible.length === 0) {
      list.createDiv({ text: rows.length === 0 ? "This table has no rows yet." : "No rows match.", cls: "tablify-link-picker__note" });
    }
    for (const row of visible)
      this.itemRow(list, row.id, row.label.trim() || "Untitled row", false);
    const others = this.opts.current.filter((r) => r.tableId !== this.targetId).length;
    if (others > 0) {
      list.createDiv({
        text: others === 1 ? "1 link to another table is kept." : `${others} links to other tables are kept.`,
        cls: "tablify-link-picker__note"
      });
    }
  }
  itemRow(list, rowId, label, missing) {
    const row = list.createEl("label", { cls: "tablify-link-picker__row" });
    const box = row.createEl("input", { type: "checkbox" });
    box.checked = this.selected.has(rowId);
    box.addEventListener("change", () => {
      if (box.checked) {
        this.selected.add(rowId);
        if (!this.order.includes(rowId))
          this.order.push(rowId);
      } else {
        this.selected.delete(rowId);
      }
    });
    row.createSpan({ text: label, cls: missing ? "tablify-link-picker__missing" : "" });
  }
  /** Selected rows in display order, then combined with the kept links to other tables. */
  result(rows) {
    const displayed = rows.map((r) => r.id).filter((id) => this.selected.has(id));
    const missing = this.order.filter((id) => this.selected.has(id) && !rows.some((r) => r.id === id));
    return buildSelection(this.opts.current, this.targetId, [...missing, ...displayed]);
  }
  save(refs) {
    this.close();
    this.opts.onSave(refs);
  }
};

// src/views/grid/FormulaEditModal.ts
var import_obsidian7 = require("obsidian");
var FormulaEditModal = class extends import_obsidian7.Modal {
  constructor(app, initial, onSave) {
    super(app);
    this.onSave = onSave;
    this.expression = initial;
  }
  expression;
  onOpen() {
    this.setTitle("Edit formula");
    this.modalEl.addClass("tablify__modal");
    applyTheme(this.modalEl, document.body.classList.contains("theme-dark") ? "dark" : "light");
    new import_obsidian7.Setting(this.contentEl).setName("Formula").setDesc("Refer to fields as {Field name}. Example: {Price} * {Quantity}").addText(
      (text) => text.setValue(this.expression).setPlaceholder("{Price} * 2").onChange((value) => {
        this.expression = value;
      })
    );
    new import_obsidian7.Setting(this.contentEl).addButton(
      (button) => button.setButtonText("Save formula").setCta().onClick(() => this.submit())
    );
    this.contentEl.addEventListener("keydown", (event) => {
      const evt = event;
      if (evt.key === "Enter" && evt.target?.tagName === "INPUT") {
        evt.preventDefault();
        this.submit();
      }
    });
  }
  submit() {
    const compiled = compileFormula(this.expression);
    if (!compiled.ok) {
      new import_obsidian7.Notice("The formula has a syntax error.");
      return;
    }
    this.close();
    this.onSave(this.expression);
  }
};

// src/views/tableView.ts
var TABLIFY_VIEW_TYPE = "tablify";
var TableView = class extends import_obsidian8.TextFileView {
  session = null;
  grid = null;
  rawData = "";
  editing = null;
  toolbar = null;
  body = null;
  menuTarget = null;
  /** Bottom-of-shell "Insert Row" pill (SAD-71 Step 1, prototype parity). */
  insertBtn = null;
  /** Empty-table hint shown above the Insert Row pill (SAD-71 Step 1). */
  emptyHint = null;
  /** Workspace card wrapping toolbar + grid (SAD-71 Step 6). */
  card = null;
  /** Text copied from a cell or row (system clipboard is also written when available). */
  clipboardText = null;
  /** Long-press state for touch (P5-03). */
  press = new LongPressDetector({ onLongPress: (p) => this.onLongPress(p) });
  pressTarget = null;
  /** Set when a long press opened the menu, so the following click does nothing. */
  suppressClick = false;
  /** Time of the last touch, used to ignore the native touch context menu (P5-03). */
  lastTouchAt = 0;
  /** P8-04: unsubscribe from the vault link index on close. */
  linkUnsub = null;
  constructor(leaf) {
    super(leaf);
  }
  getViewType() {
    return TABLIFY_VIEW_TYPE;
  }
  getDisplayText() {
    return this.file?.basename ?? "Tablify table";
  }
  canAcceptExtension(extension) {
    return extension === "tablify";
  }
  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("tablify-view");
    applyTheme(this.contentEl, this.currentTheme());
    this.card = document.createElement("div");
    this.card.className = "tablify__card";
    this.contentEl.appendChild(this.card);
    this.toolbarView = new Toolbar({ ...this.toolbarState(), callbacks: this.toolbarCallbacks() });
    this.card.appendChild(this.toolbarView.root);
    this.body = document.createElement("div");
    this.body.className = "tablify__body";
    this.card.appendChild(this.body);
    this.linkUnsub = linkIndexFor(this.app).onChange(() => {
      if (this.session)
        this.renderGrid();
    });
  }
  setViewData(data, clear) {
    if (clear)
      this.clear();
    this.rawData = data;
    const parsed = parse(data);
    if (!parsed.ok) {
      this.session = null;
      this.showError(parsed.error ?? "Could not read this .tablify file.");
      return;
    }
    this.session = createSession(parsed.data);
    this.publishLive();
    this.renderGrid();
  }
  getViewData() {
    if (!this.session)
      return this.rawData;
    return serialize(this.session.toFile());
  }
  clear() {
    this.grid?.destroy();
    this.grid = null;
    this.session = null;
    this.editing = null;
    this.menuTarget = null;
    this.insertBtn = null;
    this.emptyHint = null;
    if (this.body)
      this.body.empty();
    this.syncToolbar();
  }
  async onClose() {
    const path = this.file?.path;
    this.clear();
    this.linkUnsub?.();
    this.linkUnsub = null;
    if (path)
      linkIndexFor(this.app).dropLive(path);
    this.toolbarView?.destroy();
    this.toolbarView = null;
  }
  /**
   * Obsidian lifecycle: the pane changed size (SAD-71 Step 1). The grid is CSS-sized, so
   * only the virtual-row math needs redoing — it reads clientHeight, which just changed.
   */
  onResize() {
    this.grid?.handleResize();
  }
  // ---- internals ----
  currentTheme() {
    return document.body.classList.contains("theme-dark") ? "dark" : "light";
  }
  /** Snapshot of everything the toolbar renders from. */
  toolbarState() {
    const theme = this.currentTheme();
    const s = this.session;
    if (!s) {
      return {
        fields: [],
        view: createDefaultView([]),
        visibleRowCount: 0,
        totalRowCount: 0,
        search: "",
        query: "",
        queryError: null,
        theme
      };
    }
    const view = s.getView();
    return {
      fields: s.getFields(),
      view,
      visibleRowCount: s.getDisplayRows().length,
      totalRowCount: s.store.getAllRows().length,
      search: view.search ?? "",
      query: view.query ?? "",
      queryError: s.getFilterError(),
      theme
    };
  }
  /** Push the current model state into the toolbar without rebuilding it. */
  syncToolbar() {
    this.toolbarView?.update(this.toolbarState());
  }
  toolbarCallbacks() {
    return {
      // Search and query are persisted but not undoable — see patchView().
      onSearch: (term) => this.applyFilter({ search: term }),
      onQuery: (query) => this.applyFilter({ query }),
      onAddRow: () => this.mutate((s) => s.addRow()),
      onAddField: () => this.promptAddField(),
      onRowHeight: (height) => this.applyViewChange((view, fields) => setRowHeight(view, height, fields)),
      onFreezeColumns: (count) => this.applyViewChange((view, fields) => setFrozenColumns(view, count, fields)),
      // SAD-69 plan item B: the only way to bring a hidden field back.
      onShowField: (fieldId) => this.mutate((s) => {
        const view = s.getView();
        s.setView({ ...view, hidden: view.hidden.filter((id) => id !== fieldId) });
      }),
      onClearFilters: () => this.applyFilter({ search: "", query: "" }),
      onUndo: () => this.mutate((s) => s.undo()),
      onRedo: () => this.mutate((s) => s.redo())
    };
  }
  /**
   * Persist search/query. Goes through patchView(), not setView(), so typing does not push
   * an undo entry per debounce tick — see the note on TableSession.patchView.
   */
  applyFilter(patch) {
    if (!this.session)
      return;
    this.session.patchView(patch);
    this.afterChange();
  }
  /** Apply an undoable view change through setView(). */
  applyViewChange(change) {
    if (!this.session)
      return;
    const s = this.session;
    const before = s.getView();
    const next = change(before, s.getFields());
    if (next === before)
      return;
    s.setView(next);
    this.afterChange();
  }
  promptAddField() {
    if (!this.session)
      return;
    const s = this.session;
    const selfId = s.toFile().tableId;
    const others = linkIndexFor(this.app).index.tables().filter((t) => t.tableId !== selfId).map((t) => ({ tableId: t.tableId, name: t.name }));
    const selfName = this.file?.basename ?? "This table";
    new AddFieldModal(
      this.app,
      (name, type, formula, linkTableId) => {
        if (!this.session)
          return;
        this.session.addField(name, type, formula, linkTableId);
        this.afterChange();
      },
      { linkTargets: [{ tableId: selfId, name: selfName }, ...others], defaultLinkTableId: selfId }
    ).open();
  }
  showError(message) {
    this.clear();
    this.body?.createDiv({ cls: "tablify__error", text: message });
  }
  /** Apply a model change, then re-render and request a save. */
  mutate(change) {
    if (!this.session)
      return;
    change(this.session);
    this.afterChange();
  }
  afterChange() {
    this.publishLive();
    this.renderGrid();
    this.requestSave();
  }
  /** P8-04: publish this table's live state to the vault link index (unsaved edits included). */
  publishLive() {
    const s = this.session;
    const path = this.file?.path;
    if (!s || !path)
      return;
    linkIndexFor(this.app).noteLive(path, snapshotTable(s.toFile(), path));
  }
  /** Sync hooks (P7-10). The sync modal works on this view's session and saves through the view. */
  syncSession() {
    return this.session;
  }
  afterSyncChange() {
    this.afterChange();
  }
  renderGrid() {
    this.syncToolbar();
    if (!this.session || !this.body)
      return;
    const s = this.session;
    const rows = s.getDisplayRows();
    const fields = s.getVisibleFields();
    const theme = document.body.classList.contains("theme-dark") ? "dark" : "light";
    applyTheme(this.contentEl, theme);
    if (!this.grid) {
      this.body.empty();
      this.grid = new GridView({
        rows,
        fields,
        view: s.getView(),
        theme,
        viewportWidth: this.contentEl.clientWidth || 800,
        onCellClick: () => this.grid?.root.focus(),
        // P8-03: formula cells show their error code, with the reason in the tooltip.
        formulaError: (rowId, fieldId) => this.session?.getFormulaError(rowId, fieldId) ?? null,
        // P8-04: resolved row names for link cells; broken links are counted for the marker.
        linkSummary: (value) => summarizeLinks(value, linkIndexFor(this.app).index)
      });
      this.body.appendChild(this.grid.root);
      this.grid.root.tabIndex = 0;
      this.grid.root.addEventListener("keydown", (e) => this.onKeyDown(e));
      this.grid.root.addEventListener("contextmenu", (e) => this.onContextMenu(e));
      this.wirePressEvents(this.grid.root);
      this.emptyHint = document.createElement("div");
      this.emptyHint.className = "tablify__empty-hint";
      this.emptyHint.textContent = "This table is empty. Insert a row to get started.";
      this.emptyHint.dataset.testid = "tablify-empty-hint";
      this.body.appendChild(this.emptyHint);
      this.insertBtn = document.createElement("button");
      this.insertBtn.type = "button";
      this.insertBtn.className = "tablify__insert-row";
      this.insertBtn.textContent = "Insert Row";
      this.insertBtn.dataset.testid = "tablify-insert-row";
      this.insertBtn.addEventListener("click", () => this.mutate((st) => st.addRow()));
      this.body.appendChild(this.insertBtn);
    } else {
      this.grid.setTheme(theme);
      this.grid.setModel(rows, fields, s.getView());
    }
    if (this.emptyHint)
      this.emptyHint.hidden = rows.length !== 0;
  }
  // ---- keyboard ----
  onKeyDown(e) {
    if (!this.grid || !this.session || this.editing)
      return;
    const root = this.grid.root;
    if (!shouldHandleForGrid(root, document.activeElement))
      return;
    if (e.key === "ContextMenu" || e.shiftKey && e.key === "F10") {
      e.preventDefault();
      const sel = this.grid.getSelection() ?? { row: 0, col: 0 };
      this.grid.setSelection(sel);
      const cellEl = this.cellElement(sel);
      const rect = cellEl?.getBoundingClientRect();
      this.openCellMenu(sel.row, sel.col, rect ? { x: rect.left, y: rect.bottom } : { x: 0, y: 0 });
      return;
    }
    const action = getGridAction(e);
    if (action === "none")
      return;
    e.preventDefault();
    if (isMoveAction(action) || action === "enterEdit") {
      const sel = this.grid.getSelection() ?? { row: 0, col: 0 };
      if (action === "enterEdit") {
        this.startEdit(sel);
        return;
      }
      const rowCount = this.session.getDisplayRows().length;
      const colCount = this.session.getVisibleFields().length;
      const next = moveSelection(sel, action, rowCount, colCount);
      this.grid.setSelection(next);
      this.grid.scrollToRow(next.row);
      return;
    }
    if (action === "undo")
      this.mutate((s) => s.undo());
    if (action === "redo")
      this.mutate((s) => s.redo());
  }
  cellElement(sel) {
    if (!this.grid)
      return null;
    return this.grid.root.querySelector(
      `.tablify__row[data-row-index="${sel.row}"] .tablify__cell[data-col-index="${sel.col}"]`
    );
  }
  // ---- context menus (P5-02) ----
  onContextMenu(e) {
    if (Date.now() - this.lastTouchAt < 1500) {
      e.preventDefault();
      return;
    }
    if (this.openMenuFromTarget(e.target, e))
      e.preventDefault();
  }
  /** Open the header or cell menu for a DOM target. Returns false when the target is neither. */
  openMenuFromTarget(target, pos) {
    if (!this.grid)
      return false;
    const headerCell = target?.closest?.(".tablify__header-cell");
    if (headerCell) {
      this.openHeaderMenu(Number(headerCell.dataset.colIndex), pos);
      return true;
    }
    const cell2 = target?.closest?.(".tablify__cell");
    if (!cell2)
      return false;
    const row = Number(cell2.parentElement.dataset.rowIndex);
    const col = Number(cell2.dataset.colIndex);
    this.grid.setSelection({ row, col });
    this.openCellMenu(row, col, pos);
    return true;
  }
  // ---- touch long press (P5-03) ----
  wirePressEvents(root) {
    root.addEventListener("pointerdown", (e) => {
      this.suppressClick = false;
      if (this.editing || e.pointerType !== "touch")
        return;
      this.lastTouchAt = Date.now();
      this.pressTarget = e.target;
      this.press.pointerDown(e.clientX, e.clientY, e.pointerType);
    });
    root.addEventListener("pointermove", (e) => this.press.pointerMove(e.clientX, e.clientY));
    root.addEventListener("pointerup", () => {
      this.lastTouchAt = Date.now();
      this.suppressClick = this.press.pointerUp() || this.suppressClick;
    });
    root.addEventListener("pointercancel", () => {
      this.lastTouchAt = Date.now();
      this.press.pointerCancel();
    });
    root.addEventListener("scroll", () => this.press.scroll());
    root.addEventListener("selectstart", (e) => {
      if (this.press.isPending() || this.press.state === "fired")
        e.preventDefault();
    });
    root.addEventListener(
      "click",
      (e) => {
        if (this.suppressClick) {
          this.suppressClick = false;
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );
    root.style.setProperty("-webkit-touch-callout", "none");
  }
  onLongPress(point) {
    const target = this.pressTarget;
    this.pressTarget = null;
    if (!target || this.editing)
      return;
    this.suppressClick = true;
    this.openMenuFromTarget(target, point);
  }
  openCellMenu(row, col, pos) {
    if (!this.session)
      return;
    const rowData = this.session.getDisplayRows()[row];
    const field = this.session.getVisibleFields()[col];
    if (!rowData || !field)
      return;
    const value = rowData.values[field.id];
    const entries = cellMenu({
      readOnly: isReadOnly(field),
      cellEmpty: isEmptyValue(value),
      hasClipboard: this.clipboardText !== null,
      isLink: field.type === "link"
    });
    this.showMenu(entries, { row, col }, pos);
  }
  openHeaderMenu(col, pos) {
    if (!this.session)
      return;
    const field = this.session.getVisibleFields()[col];
    if (!field)
      return;
    const entries = headerEntries({
      fieldId: field.id,
      isPrimary: field.primary === true,
      colIndex: col,
      view: this.session.getView(),
      fieldType: field.type
    });
    this.showMenu(entries, { row: -1, col }, pos);
  }
  showMenu(entries, target, pos) {
    this.menuTarget = target;
    const menu = buildTableMenu(entries, (id) => this.runMenuAction(id));
    if ("clientX" in pos)
      menu.showAtMouseEvent(pos);
    else
      menu.showAtPosition(pos);
  }
  /** Run one menu item against the target captured when the menu opened. */
  runMenuAction(id) {
    const s = this.session;
    const t = this.menuTarget;
    if (!s || !t)
      return;
    const rows = s.getDisplayRows();
    const fields = s.getVisibleFields();
    if (id.startsWith("cell.") || id.startsWith("row.")) {
      const row = rows[t.row];
      const field2 = fields[t.col];
      if (!row || !field2)
        return;
      switch (id) {
        case "cell.copy":
          this.copyText(formatValue(row.values[field2.id], field2));
          return;
        case "cell.paste":
          this.pasteInto(row, field2);
          return;
        case "cell.links":
          this.openLinkPicker(row.id, field2);
          return;
        case "cell.clear":
          s.setValue(row.id, field2.id, null);
          break;
        case "row.insertAbove":
          s.insertRowNear(row.id, "above");
          break;
        case "row.insertBelow":
          s.insertRowNear(row.id, "below");
          break;
        case "row.duplicate":
          s.duplicateRow(row.id);
          break;
        case "row.copy":
          this.copyText(fields.map((f) => formatValue(row.values[f.id], f)).join("	"));
          return;
        case "row.delete":
          s.deleteRow(row.id);
          break;
        default:
          return;
      }
      this.afterChange();
      return;
    }
    const field = fields[t.col];
    if (!field)
      return;
    switch (id) {
      case "header.type": {
        const allRows = s.store.getAllRows();
        const targets = CHANGE_TARGET_TYPES.map((type) => {
          const plan = planTypeChange(allRows, field, type);
          return plan.ok ? { type, ok: true } : { type, ok: false, reason: plan.reason };
        });
        new TypePickerModal(this.app, targets, (target) => {
          const result = s.changeFieldType(field.id, target.type);
          if (!result.ok)
            new import_obsidian8.Notice(result.reason);
          this.afterChange();
        }).open();
        return;
      }
      case "header.formula": {
        const current = field.formula ?? "";
        new FormulaEditModal(this.app, current, (expression) => {
          const result = s.setFormula(field.id, expression);
          if (!result.ok)
            new import_obsidian8.Notice(result.reason);
          this.afterChange();
        }).open();
        return;
      }
      case "header.hide":
        s.setView({ ...s.getView(), hidden: [...s.getView().hidden, field.id] });
        break;
      case "header.sortAsc":
        s.setView({ ...s.getView(), sort: [{ fieldId: field.id, direction: "asc" }] });
        break;
      case "header.sortDesc":
        s.setView({ ...s.getView(), sort: [{ fieldId: field.id, direction: "desc" }] });
        break;
      case "header.freeze":
        s.setView({ ...s.getView(), frozenColumns: t.col + 1 });
        break;
      default:
        return;
    }
    this.afterChange();
  }
  pasteInto(row, field) {
    if (field.type === "link") {
      new import_obsidian8.Notice("Use Choose linked rows to change links.");
      return;
    }
    if (this.clipboardText === null) {
      new import_obsidian8.Notice("Nothing copied yet.");
      return;
    }
    const res = parseInput(field, this.clipboardText);
    if (!res.ok) {
      new import_obsidian8.Notice(`Cannot paste here: ${res.error}`);
      return;
    }
    this.session?.setValue(row.id, field.id, res.value);
    this.afterChange();
  }
  copyText(text) {
    this.clipboardText = text;
    void navigator.clipboard?.writeText(text).catch(() => void 0);
  }
  // ---- link picker (P8-04) ----
  /** Row picker for a link cell. Save goes through setValue, so it is undoable and saved with the file. */
  openLinkPicker(rowId, field) {
    const s = this.session;
    if (!s)
      return;
    const stored = s.store.getRow(rowId);
    if (!stored)
      return;
    const value = stored.values[field.id];
    const current = Array.isArray(value) ? value : [];
    new LinkPickerModal({
      app: this.app,
      field,
      current,
      index: linkIndexFor(this.app).index,
      onSave: (refs) => {
        s.setValue(rowId, field.id, refs);
        this.afterChange();
      }
    }).open();
  }
  // ---- inline editing ----
  /** Open the inline editor over the selected cell. Commit goes through the command stack. */
  startEdit(sel) {
    const s = this.session;
    const grid = this.grid;
    if (!s || !grid)
      return;
    const rows = s.getDisplayRows();
    const fields = s.getVisibleFields();
    const row = rows[sel.row];
    const field = fields[sel.col];
    if (!row || !field)
      return;
    const storeRow = s.store.getRow(row.id);
    if (!storeRow)
      return;
    if (field.type === "link") {
      this.openLinkPicker(row.id, field);
      return;
    }
    grid.scrollToRow(sel.row);
    const cell2 = this.cellElement(sel);
    const editor = createEditor(field, storeRow, s.store, s.stack, (committed) => {
      this.editing = null;
      editor?.remove();
      if (committed)
        this.publishLive();
      this.renderGrid();
      grid.root.focus();
      if (committed)
        this.requestSave();
    });
    if (!editor || !cell2)
      return;
    this.editing = editor;
    editor.style.position = "absolute";
    const rootRect = grid.root.getBoundingClientRect();
    const cellRect = cell2.getBoundingClientRect();
    editor.style.left = `${cellRect.left - rootRect.left + grid.root.scrollLeft}px`;
    editor.style.top = `${cellRect.top - rootRect.top + grid.root.scrollTop}px`;
    editor.style.width = `${cellRect.width}px`;
    editor.style.height = `${cellRect.height}px`;
    grid.root.appendChild(editor);
  }
};
function formatValue(value, field) {
  return getFieldType(field.type).format(value ?? null, field);
}
function isEmptyValue(v) {
  return v === null || v === void 0 || v === "" || Array.isArray(v) && v.length === 0;
}

// src/menus/fileMenu.ts
var import_obsidian9 = require("obsidian");

// src/menus/fileMenuModel.ts
var COPY_SUFFIX = " copy";
var NEW_TABLE_NAME = "Untitled table";
var OPEN = { id: "open", label: "Open" };
var DUPLICATE = { id: "duplicate", label: "Duplicate" };
var EXPORT = { id: "export", label: "Export" };
var NEW_TABLE = { id: "newTable", label: "New table" };
var IMPORT = { id: "importTable", label: "Import CSV / Excel as table" };
function menuItemsFor(target) {
  if (target.kind === "file")
    return target.extension === "tablify" ? [OPEN, DUPLICATE, EXPORT] : [];
  if (target.kind === "folder")
    return target.path === "" || target.path === "/" ? [] : [NEW_TABLE, IMPORT];
  return [];
}
function joinPath(folder, name) {
  return folder === "" || folder === "/" ? name : `${folder}/${name}`;
}
function uniqueName(base, exists) {
  if (!exists(base))
    return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!exists(candidate))
      return candidate;
  }
}
function duplicateTableText(text, newName) {
  const parsed = parse(text);
  if (!parsed.ok)
    return { ok: false, error: parsed.error };
  const copy = { ...parsed.data, tableId: generateTableId(), name: newName };
  return { ok: true, text: serialize(copy) };
}
function newTableText(name) {
  const primary = { id: generateFieldId(), name: "Name", type: "text", primary: true };
  const file = {
    formatVersion: 1,
    tableId: generateTableId(),
    name,
    fields: [primary],
    rows: [],
    views: [createDefaultView([primary])],
    syncLink: null
  };
  return serialize(file);
}

// src/menus/fileMenu.ts
function registerFileMenu(plugin) {
  const app = plugin.app;
  plugin.registerEvent(
    app.workspace.on("file-menu", (menu, file) => {
      for (const item of menuItemsFor(targetOf(file))) {
        menu.addItem(
          (mi) => mi.setTitle(item.label).onClick(() => void run(app, file, item.id))
        );
      }
    })
  );
}
function targetOf(file) {
  if (file instanceof import_obsidian9.TFile)
    return { kind: "file", extension: file.extension };
  if (file instanceof import_obsidian9.TFolder)
    return { kind: "folder", path: file.isRoot() ? "" : file.path };
  return { kind: "other" };
}
async function run(app, file, action) {
  switch (action) {
    case "open":
      if (file instanceof import_obsidian9.TFile)
        await app.workspace.getLeaf(false).openFile(file);
      return;
    case "export":
      if (file instanceof import_obsidian9.TFile)
        openExportModal(app, file);
      return;
    case "duplicate":
      if (file instanceof import_obsidian9.TFile)
        await duplicateFile(app, file);
      return;
    case "newTable":
      if (file instanceof import_obsidian9.TFolder)
        await createNewTable(app, file.path);
      return;
    case "importTable":
      if (file instanceof import_obsidian9.TFolder)
        startImport(app, file.path);
      return;
  }
}
async function duplicateFile(app, source) {
  const folder = source.parent?.path ?? "";
  const exists = (name2) => app.vault.getAbstractFileByPath(joinPath(folder, `${name2}.tablify`)) !== null;
  const name = uniqueName(`${source.basename}${COPY_SUFFIX}`, exists);
  const text = await app.vault.read(source);
  const result = duplicateTableText(text, name);
  if (!result.ok) {
    new import_obsidian9.Notice(`Duplicate failed. The table file could not be read: ${result.error}`);
    return;
  }
  const path = joinPath(folder, `${name}.tablify`);
  await app.vault.create(path, result.text);
  new import_obsidian9.Notice(`Created ${path}.`);
}
async function createNewTable(app, folder) {
  const exists = (name2) => app.vault.getAbstractFileByPath(joinPath(folder, `${name2}.tablify`)) !== null;
  const name = uniqueName(NEW_TABLE_NAME, exists);
  const path = joinPath(folder, `${name}.tablify`);
  const created = await app.vault.create(path, newTableText(name));
  await app.workspace.getLeaf(true).openFile(created);
}

// src/settings.ts
var import_obsidian10 = require("obsidian");
var DEFAULT_SETTINGS = Object.freeze({ airtableToken: "" });
var MAX_TOKEN_LENGTH = 512;
function normalizeSettings(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }
  const token = raw.airtableToken;
  if (typeof token !== "string")
    return { ...DEFAULT_SETTINGS };
  const trimmed = token.trim();
  if (trimmed.length > MAX_TOKEN_LENGTH)
    return { ...DEFAULT_SETTINGS };
  return { airtableToken: trimmed };
}
async function loadSettings(store) {
  try {
    return normalizeSettings(await store.loadData());
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
async function saveSettings(store, settings) {
  const clean = normalizeSettings(settings);
  await store.saveData({ airtableToken: clean.airtableToken });
}
var TablifySettingTab = class extends import_obsidian10.PluginSettingTab {
  host;
  constructor(app, host) {
    super(app, host);
    this.host = host;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian10.Setting(containerEl).setName("Airtable").setHeading();
    new import_obsidian10.Setting(containerEl).setName("Personal access token").setDesc(
      "Used only for Airtable sync. Stored in this plugin\u2019s settings. It is never written to .tablify files or exports."
    ).addText((text) => {
      text.inputEl.type = "password";
      text.inputEl.autocomplete = "off";
      text.inputEl.spellcheck = false;
      text.setPlaceholder("Paste your Airtable token").setValue(this.host.settings.airtableToken).onChange(async (value) => {
        this.host.settings = normalizeSettings({ airtableToken: value });
        try {
          await saveSettings(this.host, this.host.settings);
        } catch {
        }
      });
    });
  }
};

// src/embed/register.ts
var import_obsidian12 = require("obsidian");

// src/embed/embedDocument.ts
var EmbedDocument = class {
  path;
  io;
  session = null;
  error = null;
  /** Text this document last read or wrote. Used to skip our own writes when the file changes. */
  lastText = null;
  listeners = /* @__PURE__ */ new Set();
  writeChain = Promise.resolve();
  constructor(path, io) {
    this.path = path;
    this.io = io;
  }
  /** Current session, or null when the file is missing or invalid. */
  getSession() {
    return this.session;
  }
  getError() {
    return this.error;
  }
  /** Reads the file and builds the session. A missing file is an error state, not a throw. */
  async load() {
    let text;
    try {
      text = await this.io.read(this.path);
    } catch {
      this.setFailure(`Tablify embed: the file "${this.path}" was not found.`);
      return;
    }
    this.applyText(text);
    this.notify();
  }
  /**
   * The file changed on disk. Reloads unless the text is the one we last read or wrote, which is
   * the case for our own saves. Returns true when the content was reloaded.
   */
  async fileChanged() {
    let text;
    try {
      text = await this.io.read(this.path);
    } catch {
      this.setFailure(`Tablify embed: the file "${this.path}" was not found.`);
      this.notify();
      return true;
    }
    if (text === this.lastText)
      return false;
    this.applyText(text);
    this.notify();
    return true;
  }
  /** Runs a model change (undoable through the session), then saves and notifies all embeds. */
  mutate(change) {
    if (!this.session)
      return;
    change(this.session);
    this.commit();
  }
  /** Called after an edit that already went through the command stack (for example an inline editor). */
  commit() {
    this.notify();
    void this.save();
  }
  /** Saves the serialized session. Writes run one at a time, so saves land in order. */
  save() {
    const s = this.session;
    if (!s)
      return this.writeChain;
    const text = serialize(s.toFile());
    this.writeChain = this.writeChain.then(async () => {
      if (text === this.lastText)
        return;
      await this.io.write(this.path, text);
      this.lastText = text;
    }).catch(() => {
    });
    return this.writeChain;
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  notify() {
    for (const fn of [...this.listeners])
      fn();
  }
  applyText(text) {
    const parsed = parse(text);
    if (!parsed.ok) {
      this.session = null;
      this.error = parsed.error ?? "Tablify embed: the file could not be read.";
      this.lastText = text;
      return;
    }
    this.session = createSession(parsed.data);
    this.error = null;
    this.lastText = text;
  }
  setFailure(message) {
    this.session = null;
    this.error = message;
    this.lastText = null;
  }
};
var EmbedRegistry = class {
  docs = /* @__PURE__ */ new Map();
  /** Returns the shared document, loading it on first use. */
  async acquire(path, io) {
    const existing = this.docs.get(path);
    if (existing) {
      existing.refs += 1;
      return existing.doc;
    }
    const doc = new EmbedDocument(path, io);
    this.docs.set(path, { doc, refs: 1 });
    await doc.load();
    return doc;
  }
  release(path) {
    const entry = this.docs.get(path);
    if (!entry)
      return;
    entry.refs -= 1;
    if (entry.refs <= 0)
      this.docs.delete(path);
  }
  /** Forwards a file change to the shared document, if one is open. */
  async fileChanged(path) {
    const entry = this.docs.get(path);
    if (!entry)
      return;
    await entry.doc.fileChanged();
  }
  /** For tests and diagnostics. */
  size() {
    return this.docs.size;
  }
  refCount(path) {
    return this.docs.get(path)?.refs ?? 0;
  }
};

// src/embed/embedView.ts
var import_obsidian11 = require("obsidian");
var EMBED_VIEWPORT_HEIGHT = 320;
var EmbedView = class {
  root;
  doc;
  opts;
  header;
  body;
  grid = null;
  sel = { row: 0, col: 0 };
  editing = null;
  unsubscribe;
  unlinks = null;
  destroyed = false;
  constructor(opts) {
    this.opts = opts;
    this.doc = opts.doc;
    this.root = document.createElement("div");
    this.root.className = "tablify-embed";
    this.root.dataset.testid = "tablify-embed";
    this.header = document.createElement("div");
    this.header.className = "tablify-embed__head";
    const label = document.createElement("span");
    label.className = "tablify-embed__path";
    label.textContent = "file: " + this.doc.path;
    const open2 = document.createElement("button");
    open2.type = "button";
    open2.className = "tablify-embed__open";
    open2.textContent = "Open full table";
    open2.dataset.testid = "tablify-embed-open";
    open2.addEventListener("click", () => this.opts.onOpenFull(this.doc.path));
    this.header.append(label, open2);
    this.root.appendChild(this.header);
    this.body = document.createElement("div");
    this.body.className = "tablify-embed__body";
    this.root.appendChild(this.body);
    this.unsubscribe = this.doc.subscribe(() => this.render());
    this.unlinks = this.opts.links?.onChange(() => this.render()) ?? null;
    this.render();
  }
  /** Re-renders from the document. Safe to call at any time. */
  render() {
    if (this.destroyed)
      return;
    const error = this.doc.getError();
    const session = this.doc.getSession();
    if (error || !session) {
      this.showError(error ?? "Tablify embed: the file could not be read.");
      return;
    }
    this.clearError();
    this.ensureGrid();
    if (!this.grid)
      return;
    const rows = session.getDisplayRows();
    const fields = session.getVisibleFields();
    this.clampSelection(rows.length, fields.length);
    this.grid.setTheme(this.theme());
    this.grid.setModel(rows, fields, session.getView());
    this.grid.setSelection(this.sel);
  }
  /** Moves the selection, as the arrow keys do. Exposed for tests and for the key handler. */
  moveBy(action) {
    const s = this.doc.getSession();
    if (!s)
      return;
    this.sel = moveSelection(this.sel, action, s.getDisplayRows().length, s.getVisibleFields().length);
    this.grid?.setSelection(this.sel);
  }
  getSelection() {
    return { ...this.sel };
  }
  /** Opens the inline editor for the selected cell. Returns false when the cell is read-only or missing. */
  startEdit() {
    const s = this.doc.getSession();
    const grid = this.grid;
    if (!s || !grid || this.editing)
      return false;
    const rows = s.getDisplayRows();
    const fields = s.getVisibleFields();
    const row = rows[this.sel.row];
    const field = fields[this.sel.col];
    if (!row || !field)
      return false;
    const storeRow = s.store.getRow(row.id);
    if (!storeRow)
      return false;
    if (field.type === "link") {
      new import_obsidian11.Notice("Open the full table to change links.");
      return false;
    }
    const editor = createEditor(field, storeRow, s.store, s.stack, (committed) => {
      this.editing = null;
      editor?.remove();
      if (committed)
        this.doc.commit();
      else
        this.render();
      grid.root.focus();
    });
    if (!editor)
      return false;
    this.editing = editor;
    editor.style.position = "absolute";
    const cell2 = this.cellElement();
    if (cell2) {
      const rootRect = grid.root.getBoundingClientRect();
      const cellRect = cell2.getBoundingClientRect();
      editor.style.left = `${cellRect.left - rootRect.left + grid.root.scrollLeft}px`;
      editor.style.top = `${cellRect.top - rootRect.top + grid.root.scrollTop}px`;
      editor.style.width = `${cellRect.width}px`;
      editor.style.height = `${cellRect.height}px`;
    }
    grid.root.appendChild(editor);
    return true;
  }
  /** Adds a row through the command stack and saves. */
  insertRow() {
    this.doc.mutate((s) => s.addRow());
  }
  /** Reads the displayed value of one cell. Used by tests. */
  cellValue(rowIndex, colIndex) {
    const s = this.doc.getSession();
    if (!s)
      return void 0;
    const row = s.getDisplayRows()[rowIndex];
    const field = s.getVisibleFields()[colIndex];
    if (!row || !field)
      return void 0;
    return row.values[field.id];
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    this.unsubscribe();
    this.unlinks?.();
    this.editing?.remove();
    this.editing = null;
    this.grid?.destroy();
    this.grid = null;
    this.root.remove();
  }
  // ---- internals ----
  theme() {
    if (this.opts.theme)
      return this.opts.theme;
    return typeof document !== "undefined" && document.body.classList.contains("theme-dark") ? "dark" : "light";
  }
  ensureGrid() {
    if (this.grid)
      return;
    const s = this.doc.getSession();
    const links = this.opts.links;
    this.grid = new GridView({
      rows: s.getDisplayRows(),
      fields: s.getVisibleFields(),
      view: s.getView(),
      theme: this.theme(),
      viewportHeight: EMBED_VIEWPORT_HEIGHT,
      viewportWidth: this.opts.viewportWidth ?? 800,
      onCellClick: (row, col) => {
        this.sel = { row, col };
      },
      linkSummary: links ? (value) => summarizeLinks(value, links.index) : void 0
    });
    this.grid.root.tabIndex = 0;
    this.grid.root.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.grid.root.addEventListener("dblclick", () => this.startEdit());
    this.body.appendChild(this.grid.root);
    const insert = document.createElement("button");
    insert.type = "button";
    insert.className = "tablify-embed__insert";
    insert.textContent = "Insert Row";
    insert.dataset.testid = "tablify-embed-insert";
    insert.addEventListener("click", () => this.insertRow());
    this.body.appendChild(insert);
  }
  onKeyDown(e) {
    if (this.editing || !this.grid)
      return;
    const action = getGridAction(e);
    if (action === "none")
      return;
    e.preventDefault();
    if (action === "enterEdit") {
      this.startEdit();
      return;
    }
    if (action === "undo") {
      this.doc.mutate((s) => s.undo());
      return;
    }
    if (action === "redo") {
      this.doc.mutate((s) => s.redo());
      return;
    }
    if (action === "moveUp" || action === "moveDown" || action === "moveLeft" || action === "moveRight" || action === "tabNext" || action === "tabPrev") {
      this.moveBy(action);
    }
  }
  cellElement() {
    if (!this.grid)
      return null;
    return this.grid.root.querySelector(
      `.tablify__row[data-row-index="${this.sel.row}"] .tablify__cell[data-col-index="${this.sel.col}"]`
    );
  }
  clampSelection(rowCount, colCount) {
    const row = Math.max(0, Math.min(this.sel.row, rowCount - 1));
    const col = Math.max(0, Math.min(this.sel.col, colCount - 1));
    this.sel = { row: Math.max(0, row), col: Math.max(0, col) };
  }
  showError(message) {
    this.grid?.destroy();
    this.grid = null;
    this.body.replaceChildren();
    const err3 = document.createElement("div");
    err3.className = "tablify__error tablify-embed__error";
    err3.dataset.testid = "tablify-embed-error";
    err3.textContent = message;
    this.body.appendChild(err3);
  }
  clearError() {
    const err3 = this.body.querySelector(".tablify-embed__error");
    if (err3)
      this.body.replaceChildren();
  }
};

// src/embed/embedSource.ts
var MAX_PATH_LENGTH = 512;
var EXT = ".tablify";
function parseEmbedSource(body) {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { ok: false, error: "Tablify embed: add the path of a .tablify file inside the code block." };
  }
  let path = null;
  for (const line of lines) {
    if (/^view\s*:/i.test(line)) {
      const value = line.replace(/^view\s*:/i, "").trim().toLowerCase();
      if (value !== "grid") {
        return { ok: false, error: `Tablify embed: view "${value}" is not supported. Use "view: grid".` };
      }
      continue;
    }
    if (path !== null) {
      return { ok: false, error: "Tablify embed: the code block must contain one file path." };
    }
    path = line;
  }
  if (path === null) {
    return { ok: false, error: "Tablify embed: add the path of a .tablify file inside the code block." };
  }
  return validatePath(path);
}
function hasControlChars(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c === 127)
      return true;
  }
  return false;
}
function validatePath(path) {
  if (path.length > MAX_PATH_LENGTH) {
    return { ok: false, error: "Tablify embed: the file path is too long." };
  }
  if (hasControlChars(path)) {
    return { ok: false, error: "Tablify embed: the file path contains control characters." };
  }
  if (path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path) || path.includes("\\")) {
    return { ok: false, error: "Tablify embed: use a vault-relative path with forward slashes." };
  }
  const segments = path.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "")) {
    return { ok: false, error: "Tablify embed: the file path must stay inside the vault." };
  }
  if (!path.toLowerCase().endsWith(EXT)) {
    return { ok: false, error: `Tablify embed: only ${EXT} files can be embedded.` };
  }
  return { ok: true, path };
}

// src/embed/register.ts
var EMBED_FENCE_LANGUAGE = "tablify";
function vaultEmbedIO(app) {
  const fileAt = (path) => {
    const f = app.vault.getAbstractFileByPath(path);
    if (!(f instanceof import_obsidian12.TFile))
      throw new Error("file not found");
    return f;
  };
  return {
    read: async (path) => app.vault.read(fileAt(path)),
    write: async (path, text) => {
      await app.vault.modify(fileAt(path), text);
    }
  };
}
var EmbedRenderChild = class extends import_obsidian12.MarkdownRenderChild {
  onDone;
  constructor(containerEl, onDone) {
    super(containerEl);
    this.onDone = onDone;
  }
  onunload() {
    this.onDone();
  }
};
function registerEmbedProcessor(plugin) {
  const registry2 = new EmbedRegistry();
  const app = plugin.app;
  plugin.registerMarkdownCodeBlockProcessor(
    EMBED_FENCE_LANGUAGE,
    async (source, el2, ctx) => {
      const parsed = parseEmbedSource(source);
      if (!parsed.ok) {
        const err3 = document.createElement("div");
        err3.className = "tablify__error";
        err3.dataset.testid = "tablify-embed-error";
        err3.textContent = parsed.error;
        el2.appendChild(err3);
        return;
      }
      const path = parsed.path;
      const io = vaultEmbedIO(app);
      const doc = await registry2.acquire(path, io);
      const view = new EmbedView({
        doc,
        onOpenFull: (p) => {
          void app.workspace.openLinkText(p, "", false);
        },
        links: linkIndexFor(app)
      });
      el2.appendChild(view.root);
      ctx.addChild(
        new EmbedRenderChild(el2, () => {
          view.destroy();
          registry2.release(path);
        })
      );
    }
  );
  plugin.registerEvent(
    app.vault.on("modify", (file) => {
      if (file instanceof import_obsidian12.TFile)
        void registry2.fileChanged(file.path);
    })
  );
  return { registry: registry2 };
}

// src/views/sync/SyncModal.ts
var import_obsidian14 = require("obsidian");

// src/sync/airtableClient.ts
var import_obsidian13 = require("obsidian");

// src/sync/rateLimiter.ts
var defaultClock = () => Date.now();
var defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var KeyedRateLimiter = class {
  constructor(minIntervalMs, now = defaultClock, sleep = defaultSleep) {
    this.minIntervalMs = minIntervalMs;
    this.now = now;
    this.sleep = sleep;
    if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) {
      throw new RangeError("minIntervalMs must be a non-negative number");
    }
  }
  nextAt = /* @__PURE__ */ new Map();
  tails = /* @__PURE__ */ new Map();
  /** Run `task` after earlier tasks for the same key and after the key's spacing. */
  schedule(key, task) {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const run2 = previous.then(async () => {
      const now = this.now();
      const at = Math.max(now, this.nextAt.get(key) ?? now);
      this.nextAt.set(key, at + this.minIntervalMs);
      if (at > now)
        await this.sleep(at - now);
      return task();
    });
    this.tails.set(
      key,
      run2.then(
        () => void 0,
        () => void 0
      )
    );
    return run2;
  }
  /** Hold every later request for `key` for at least `ms` milliseconds. */
  penalize(key, ms) {
    if (!Number.isFinite(ms) || ms <= 0)
      return;
    const until = this.now() + ms;
    if ((this.nextAt.get(key) ?? 0) < until)
      this.nextAt.set(key, until);
  }
};

// src/sync/airtableClient.ts
var AIRTABLE_MIN_INTERVAL_MS = 250;
var AIRTABLE_DEFAULT_429_WAIT_MS = 3e4;
var AIRTABLE_MAX_WAIT_MS = 6e4;
var AIRTABLE_MAX_ATTEMPTS = 4;
var AIRTABLE_PAGE_SIZE = 100;
var AIRTABLE_WRITE_BATCH = 10;
var AIRTABLE_MAX_PAGES = 1e4;
var API_ORIGIN = "https://api.airtable.com";
var ACCOUNT_KEY = "__account__";
var AirtableError = class extends Error {
  kind;
  status;
  attempts;
  constructor(kind, status, attempts, message) {
    super(message);
    this.name = "AirtableError";
    this.kind = kind;
    this.status = status;
    this.attempts = attempts;
  }
};
var BASE_ID = /^app[A-Za-z0-9]+$/;
var TABLE_ID = /^tbl[A-Za-z0-9]+$/;
var RECORD_ID = /^rec[A-Za-z0-9]+$/;
function transportDefault(param) {
  return (0, import_obsidian13.requestUrl)(param);
}
function headerValue(headers, name) {
  if (!headers)
    return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted)
      return value;
  }
  return null;
}
function retryAfterMs(headers) {
  const raw = headerValue(headers, "retry-after");
  if (raw === null)
    return AIRTABLE_DEFAULT_429_WAIT_MS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0)
    return AIRTABLE_DEFAULT_429_WAIT_MS;
  return Math.min(Math.round(seconds * 1e3), AIRTABLE_MAX_WAIT_MS);
}
function serverBackoffMs(attempt) {
  return Math.min(1e3 * 2 ** (attempt - 1), 8e3);
}
function requireId(value, pattern, label) {
  if (!pattern.test(value)) {
    throw new AirtableError("bad_request", null, 0, `Invalid ${label} ID. Check the ID in the sync settings.`);
  }
  return value;
}
function messageFor(status, attempts) {
  if (status === 401) {
    return {
      kind: "unauthorized",
      message: "Airtable did not accept the token (HTTP 401). Check the token in Tablify settings."
    };
  }
  if (status === 403) {
    return {
      kind: "forbidden",
      message: "Airtable denied access (HTTP 403). The token may lack a required scope or access to this base. Check the token scopes and base access."
    };
  }
  if (status === 404) {
    return {
      kind: "not_found",
      message: "Airtable could not find that base or table (HTTP 404). Check the base and table, and that the token can access them."
    };
  }
  if (status === 429) {
    return {
      kind: "rate_limited",
      message: `Airtable rate limit still exceeded after ${attempts} attempts (HTTP 429). Try again in a minute.`
    };
  }
  if (status >= 500) {
    return {
      kind: "server",
      message: `Airtable had a server error (HTTP ${status}) after ${attempts} attempts. Try again later.`
    };
  }
  return {
    kind: "bad_request",
    message: `Airtable rejected the request (HTTP ${status}).`
  };
}
var AirtableClient = class {
  token;
  transport;
  limiter;
  constructor(options) {
    if (!options.token || typeof options.token !== "string") {
      throw new AirtableError("unauthorized", null, 0, "No Airtable token is set. Add the token in Tablify settings.");
    }
    this.token = options.token;
    this.transport = options.transport ?? transportDefault;
    this.limiter = new KeyedRateLimiter(
      options.minIntervalMs ?? AIRTABLE_MIN_INTERVAL_MS,
      options.clock ?? defaultClock,
      options.sleep ?? defaultSleep
    );
  }
  /** Lists every base the token can see (all pages). */
  async listBases() {
    const bases = [];
    await this.paginate(
      ACCOUNT_KEY,
      "/v0/meta/bases",
      {},
      (body) => {
        for (const item of asArray(body, "bases"))
          bases.push(toBase(item));
      }
    );
    return bases;
  }
  /** Lists tables and their fields for one base. */
  async listTables(baseId) {
    const base = requireId(baseId, BASE_ID, "base");
    const body = await this.send(base, "GET", `/v0/meta/bases/${base}/tables`);
    return asArray(body, "tables").map(toTable);
  }
  /** Reads every record of a table. Fields are keyed by field ID, which survives renames. */
  async listRecords(baseId, tableId) {
    const base = requireId(baseId, BASE_ID, "base");
    const table = requireId(tableId, TABLE_ID, "table");
    const records = [];
    await this.paginate(
      base,
      `/v0/${base}/${table}`,
      { pageSize: String(AIRTABLE_PAGE_SIZE), returnFieldsByFieldId: "true" },
      (body) => {
        for (const item of asArray(body, "records"))
          records.push(toRecord(item));
      }
    );
    return records;
  }
  /** Creates records in batches of AIRTABLE_WRITE_BATCH. Returns the created records in order. */
  async createRecords(baseId, tableId, records) {
    return this.writeBatches(baseId, tableId, records, "POST");
  }
  /** Updates records in batches of AIRTABLE_WRITE_BATCH. Every write needs an `id`. */
  async updateRecords(baseId, tableId, records) {
    for (const r of records) {
      if (!r.id || !RECORD_ID.test(r.id)) {
        throw new AirtableError("bad_request", null, 0, "A record update needs a valid record ID.");
      }
    }
    return this.writeBatches(baseId, tableId, records, "PATCH");
  }
  /**
   * Creates one field (P7-09). Needs schema.bases:write. The caller must have shown the user the
   * exact field list and got explicit confirmation first.
   */
  async createField(baseId, tableId, spec) {
    const base = requireId(baseId, BASE_ID, "base");
    const table = requireId(tableId, TABLE_ID, "table");
    const body = await this.send(base, "POST", `/v0/meta/bases/${base}/tables/${table}/fields`, void 0, {
      name: spec.name,
      type: spec.type,
      ...spec.options === void 0 ? {} : { options: spec.options }
    });
    const created = body;
    if (!created || typeof created.id !== "string" || typeof created.type !== "string") {
      throw new AirtableError("bad_response", null, 1, "Airtable returned an unexpected field response.");
    }
    return { id: created.id, name: typeof created.name === "string" ? created.name : spec.name, type: created.type };
  }
  async writeBatches(baseId, tableId, records, method) {
    const base = requireId(baseId, BASE_ID, "base");
    const table = requireId(tableId, TABLE_ID, "table");
    const out = [];
    for (let i = 0; i < records.length; i += AIRTABLE_WRITE_BATCH) {
      const batch = records.slice(i, i + AIRTABLE_WRITE_BATCH);
      const body = await this.send(base, method, `/v0/${base}/${table}`, void 0, {
        records: batch,
        typecast: false,
        returnFieldsByFieldId: true
      });
      for (const item of asArray(body, "records"))
        out.push(toRecord(item));
    }
    return out;
  }
  /** Follows offsets until none is returned. Stops on a repeated offset so a bad server cannot loop forever. */
  async paginate(key, path, query, onPage) {
    const seen = /* @__PURE__ */ new Set();
    let offset = null;
    for (let page = 0; page < AIRTABLE_MAX_PAGES; page++) {
      const params = { ...query };
      if (offset !== null)
        params.offset = offset;
      const body = await this.send(key, "GET", path, params);
      onPage(body);
      const next = body?.offset;
      if (next === void 0 || next === null || next === "")
        return;
      if (typeof next !== "string" || seen.has(next)) {
        throw new AirtableError("bad_response", null, 1, "Airtable returned an unexpected page offset.");
      }
      seen.add(next);
      offset = next;
    }
    throw new AirtableError("bad_response", null, 1, "Airtable returned more pages than Tablify can read.");
  }
  /**
   * One logical request, queued under `key`. Retries 429 and 5xx responses and network
   * errors, up to AIRTABLE_MAX_ATTEMPTS. Other errors are thrown at once.
   */
  async send(key, method, path, query, jsonBody) {
    let url = API_ORIGIN + path;
    if (query && Object.keys(query).length > 0) {
      const search = new URLSearchParams(query).toString();
      url += "?" + search;
    }
    const headers = {
      Authorization: "Bearer " + this.token,
      Accept: "application/json"
    };
    const param = { url, method, headers, throw: false };
    if (jsonBody !== void 0) {
      param.contentType = "application/json";
      param.body = JSON.stringify(jsonBody);
    }
    for (let attempt = 1; ; attempt++) {
      let res;
      try {
        res = await this.limiter.schedule(key, () => this.transport(param));
      } catch {
        if (attempt < AIRTABLE_MAX_ATTEMPTS) {
          const wait = serverBackoffMs(attempt);
          this.limiter.penalize(key, wait);
          continue;
        }
        throw new AirtableError("network", null, attempt, "Could not reach Airtable. Check the network connection and try again.");
      }
      const status = res.status;
      if (status >= 200 && status < 300) {
        return parseBody(res);
      }
      if (status === 429 && attempt < AIRTABLE_MAX_ATTEMPTS) {
        this.limiter.penalize(key, retryAfterMs(res.headers));
        continue;
      }
      if (status >= 500 && attempt < AIRTABLE_MAX_ATTEMPTS) {
        this.limiter.penalize(key, serverBackoffMs(attempt));
        continue;
      }
      const mapped = messageFor(status, attempt);
      throw new AirtableError(mapped.kind, status, attempt, mapped.message);
    }
  }
};
function parseBody(res) {
  try {
    const body = res.json;
    if (body === void 0 || body === null || typeof body !== "object") {
      throw new Error("not an object");
    }
    return body;
  } catch {
    throw new AirtableError("bad_response", res.status, 1, "Airtable returned an unexpected response.");
  }
}
function asArray(body, key) {
  const value = body?.[key];
  if (!Array.isArray(value)) {
    throw new AirtableError("bad_response", null, 1, "Airtable returned an unexpected response.");
  }
  for (const item of value) {
    if (item === null || typeof item !== "object") {
      throw new AirtableError("bad_response", null, 1, "Airtable returned an unexpected response.");
    }
  }
  return value;
}
function str(item, key) {
  const v = item[key];
  if (typeof v !== "string") {
    throw new AirtableError("bad_response", null, 1, "Airtable returned an unexpected response.");
  }
  return v;
}
function toBase(item) {
  return {
    id: str(item, "id"),
    name: str(item, "name"),
    permissionLevel: typeof item.permissionLevel === "string" ? item.permissionLevel : ""
  };
}
function toTable(item) {
  const fields = Array.isArray(item.fields) ? item.fields : [];
  return {
    id: str(item, "id"),
    name: str(item, "name"),
    primaryFieldId: str(item, "primaryFieldId"),
    fields: fields.map((f) => {
      const field = f;
      return { id: str(field, "id"), name: str(field, "name"), type: str(field, "type"), options: field.options };
    })
  };
}
function toRecord(item) {
  const fields = item.fields;
  return {
    id: str(item, "id"),
    createdTime: typeof item.createdTime === "string" ? item.createdTime : "",
    fields: fields && typeof fields === "object" ? fields : {}
  };
}

// src/sync/hash.ts
function integerRoot(n, degree) {
  if (n < 2n)
    return n;
  const d = BigInt(degree);
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / degree) + 1);
  for (; ; ) {
    const next = ((d - 1n) * x + n / x ** (d - 1n)) / d;
    if (next >= x)
      return x;
    x = next;
  }
}
function firstPrimes(count) {
  const out = [];
  for (let n = 2; out.length < count; n++) {
    if (out.every((p) => n % p !== 0))
      out.push(n);
  }
  return out;
}
var MASK32 = 0xffffffffn;
var K = firstPrimes(64).map((p) => Number(integerRoot(BigInt(p) << 96n, 3) & MASK32));
var H0 = firstPrimes(8).map((p) => Number(integerRoot(BigInt(p) << 64n, 2) & MASK32));
function rotr(x, n) {
  return x >>> n | x << 32 - n;
}
function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const bitLen = BigInt(bytes.length) * 8n;
  const paddedLen = bytes.length + 9 + 63 >> 6 << 6;
  const buf = new Uint8Array(paddedLen);
  buf.set(bytes);
  buf[bytes.length] = 128;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, Number(bitLen >> 32n));
  view.setUint32(paddedLen - 4, Number(bitLen & MASK32));
  const H = H0.slice();
  const W = new Uint32Array(64);
  for (let off = 0; off < paddedLen; off += 64) {
    for (let i = 0; i < 16; i++)
      W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ W[i - 15] >>> 3;
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ W[i - 2] >>> 10;
      W[i] = W[i - 16] + s0 + W[i - 7] + s1 >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch3 = e & f ^ ~e & g;
      const t1 = h + S1 + ch3 + K[i] + W[i] >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    const working = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++)
      H[i] = H[i] + working[i] >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, "0")).join("");
}
function canonicalJson(value) {
  if (value === null || value === void 0)
    return "null";
  if (Array.isArray(value))
    return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  if (typeof value === "object") {
    const obj = value;
    const keys = Object.keys(obj).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
  }
  if (typeof value === "number" && !Number.isFinite(value))
    return "null";
  return JSON.stringify(value);
}

// src/sync/values.ts
var UnknownChoiceError = class extends Error {
  constructor(fieldName, choice) {
    super(`Airtable has an option "${choice}" in "${fieldName}" that Tablify does not know. Re-link the table to refresh its options, then sync again.`);
    this.fieldName = fieldName;
    this.choice = choice;
    this.name = "UnknownChoiceError";
  }
};
function syncedFields(fields) {
  return fields.filter((f) => f.airtable && typeof f.airtable.id === "string");
}
function isWritable(field) {
  return !!field.airtable && !field.airtable.readOnly;
}
function stringify(raw) {
  if (raw === null || raw === void 0 || raw === "")
    return null;
  if (typeof raw === "string")
    return raw;
  if (typeof raw === "number" || typeof raw === "boolean")
    return String(raw);
  return JSON.stringify(raw);
}
function attachmentNames(raw) {
  if (!Array.isArray(raw))
    return stringify(raw);
  const names = raw.map((a) => a && typeof a === "object" && typeof a.filename === "string" ? a.filename : null).filter((n) => n !== null);
  return names.length > 0 ? names.join(", ") : null;
}
function optionIdFor(field, name) {
  const opt = (field.options ?? []).find((o) => o.name === name);
  if (!opt)
    throw new UnknownChoiceError(field.name, name);
  return opt.id;
}
function requireOptionName(field, id) {
  const opt = (field.options ?? []).find((o) => o.id === id);
  if (!opt)
    throw new Error(`Field "${field.name}" has an option ID with no matching option. Fix the file before syncing.`);
  return opt.name;
}
function remoteToLocal(field, raw) {
  const airtableType = field.airtable?.type ?? "";
  switch (field.type) {
    case "checkbox":
      return raw === true;
    case "number":
    case "currency":
    case "percent":
    case "duration":
    case "rating":
    case "auto_number":
      return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    case "single_select":
      return typeof raw === "string" && raw !== "" ? optionIdFor(field, raw) : null;
    case "multi_select": {
      if (!Array.isArray(raw))
        return [];
      return raw.filter((n) => typeof n === "string").map((n) => optionIdFor(field, n));
    }
    case "text":
    case "long_text":
    case "url":
    case "email":
    case "phone":
    case "date":
    case "date_time":
    case "created_time":
    case "modified_time":
      return airtableType === "multipleAttachments" ? attachmentNames(raw) : stringify(raw);
    case "attachment":
      return attachmentNames(raw);
    case "formula":
    case "link":
      return null;
  }
}
function localToRemote(field, value) {
  const v = value ?? null;
  if (field.type === "single_select") {
    if (typeof v !== "string")
      return null;
    return requireOptionName(field, v);
  }
  if (field.type === "multi_select") {
    if (!Array.isArray(v))
      return [];
    return v.map((id) => requireOptionName(field, id));
  }
  if (field.type === "checkbox")
    return v === true;
  if (v === "")
    return null;
  return v;
}
function normalize(field, value) {
  const v = value ?? null;
  if (field.type === "checkbox")
    return v === true;
  if (field.type === "multi_select")
    return Array.isArray(v) ? [...v] : [];
  if (v === "")
    return null;
  return v;
}
function remoteValues(fields, rawFields) {
  const out = {};
  for (const f of syncedFields(fields)) {
    out[f.id] = normalize(f, remoteToLocal(f, rawFields[f.airtable.id]));
  }
  return out;
}
function localValues(fields, row) {
  const out = {};
  for (const f of syncedFields(fields))
    out[f.id] = normalize(f, row.values[f.id]);
  return out;
}
function hashValues(values) {
  return sha256Hex(canonicalJson(values));
}
function writePayload(fields, row) {
  const out = {};
  for (const f of fields) {
    if (!isWritable(f))
      continue;
    out[f.airtable.id] = localToRemote(f, row.values[f.id]);
  }
  return out;
}

// src/sync/rules.ts
function linkedFacts(row, remote, fields, remoteHash) {
  const sync = row.sync;
  const localChanged = row.rev !== sync.syncedRev;
  const remoteExists = remote !== null;
  const remoteChanged = remoteExists && remoteHash !== sync.remoteHash;
  const sameValues = remoteExists && canonicalJson(localValues(fields, row)) === canonicalJson(remoteValues(fields, remote.fields));
  const c = sync.conflict;
  const decided = !!c && c.localRev === row.rev && c.remoteHash === (remoteExists ? remoteHash : null);
  return { localChanged, remoteExists, remoteChanged, sameValues, decided };
}
function classifyLinked(f, sync, op) {
  if (!f.remoteExists) {
    if (f.localChanged) {
      if (f.decided)
        return { caseId: "remote_deleted_local_changed", action: "decided", conflictKind: "remote_deleted" };
      return { caseId: "remote_deleted_local_changed", action: "conflict", conflictKind: "remote_deleted" };
    }
    if (sync?.remoteDeleted)
      return { caseId: "remote_deleted", action: "none" };
    return { caseId: "remote_deleted", action: "mark_remote_deleted" };
  }
  if (!f.localChanged && !f.remoteChanged)
    return { caseId: "no_change", action: "none" };
  if (f.localChanged && !f.remoteChanged) {
    return { caseId: "local_only", action: op === "push" ? "push" : "keep_local_only" };
  }
  if (!f.localChanged && f.remoteChanged) {
    return { caseId: "remote_only", action: op === "pull" ? "pull" : "remote_changed" };
  }
  if (f.sameValues)
    return { caseId: "both_same", action: "adopt" };
  if (f.decided)
    return { caseId: "both_different", action: "decided", conflictKind: "both_changed" };
  return { caseId: "both_different", action: "conflict", conflictKind: "both_changed" };
}
function remoteHashFor(fields, record) {
  return hashValues(remoteValues(fields, record.fields));
}

// src/sync/engineTypes.ts
function emptyReport(direction) {
  return {
    direction,
    created: 0,
    updated: 0,
    pushed: 0,
    adopted: 0,
    unchanged: 0,
    localOnly: 0,
    remoteDeleted: 0,
    localDeletedKept: 0,
    remoteChangedNotPushed: 0,
    conflicts: [],
    failures: [],
    ok: true,
    summary: ""
  };
}
function summarize(report) {
  const parts = [];
  if (report.direction === "pull") {
    parts.push(`${report.created} new`, `${report.updated} updated`);
  } else {
    parts.push(`${report.pushed} pushed`, `${report.created} created`);
  }
  if (report.conflicts.length)
    parts.push(`${report.conflicts.length} conflict(s)`);
  if (report.failures.length)
    parts.push(`${report.failures.length} failed`);
  if (report.remoteDeleted)
    parts.push(`${report.remoteDeleted} deleted in Airtable`);
  if (report.localDeletedKept)
    parts.push(`${report.localDeletedKept} deleted locally, kept in Airtable`);
  return parts.join(", ").slice(0, 300);
}
function requireLink(session) {
  const link = session.getSyncLink();
  if (!link)
    throw new Error("This table is not linked to Airtable.");
  return link;
}
function refreshRecordSnapshot(session) {
  const link = requireLink(session);
  const records = [];
  for (const row of session.store.getAllRows()) {
    if (row.sync)
      records.push({ airtableId: row.sync.airtableId, remoteHash: row.sync.remoteHash });
  }
  session.setSyncLink({ ...link, records });
}
function finishRun(ctx, report, direction) {
  ctx.session.stack.clear();
  refreshRecordSnapshot(ctx.session);
  const link = requireLink(ctx.session);
  ctx.session.setSyncLink({
    ...link,
    lastSync: { at: ctx.now(), direction, ok: report.ok, summary: report.summary }
  });
}
function safeReason(err3) {
  if (err3 instanceof AirtableError)
    return err3.message;
  return "Airtable did not accept this change.";
}

// src/sync/pull.ts
async function pullFromAirtable(ctx) {
  const link = requireLink(ctx.session);
  const fields = ctx.session.getFields();
  const remote = await ctx.client.listRecords(link.baseId, link.tableId);
  const byId = new Map(remote.map((r) => [r.id, r]));
  const report = emptyReport("pull");
  const plan = [];
  const rows = ctx.session.store.getAllRows();
  const linkedIds = /* @__PURE__ */ new Set();
  for (const row of rows) {
    if (!row.sync) {
      report.localOnly++;
      continue;
    }
    linkedIds.add(row.sync.airtableId);
    const rec = byId.get(row.sync.airtableId) ?? null;
    const remoteHash = rec ? remoteHashFor(fields, rec) : null;
    const facts = linkedFacts(row, rec, fields, remoteHash);
    const cls = classifyLinked(facts, row.sync, "pull");
    switch (cls.action) {
      case "pull": {
        const values = remoteValues(fields, rec.fields);
        plan.push({ kind: "update", row, values, remoteHash });
        report.updated++;
        break;
      }
      case "adopt":
        plan.push({ kind: "sync", row, remoteHash, remoteDeleted: false });
        report.adopted++;
        break;
      case "mark_remote_deleted":
        plan.push({ kind: "sync", row, remoteHash: row.sync.remoteHash, remoteDeleted: true });
        report.remoteDeleted++;
        break;
      case "none":
        if (row.sync.remoteDeleted)
          report.remoteDeleted++;
        else
          report.unchanged++;
        break;
      case "keep_local_only":
        report.localOnly++;
        break;
      case "conflict":
        report.conflicts.push(conflictItem(row, cls.conflictKind, remoteHash));
        break;
      case "decided":
        report.unchanged++;
        break;
      default:
        throw new Error(`Unexpected action on pull: ${cls.action}`);
    }
  }
  for (const rec of remote) {
    if (linkedIds.has(rec.id))
      continue;
    plan.push({
      kind: "create",
      values: remoteValues(fields, rec.fields),
      airtableId: rec.id,
      remoteHash: remoteHashFor(fields, rec)
    });
    report.created++;
  }
  const localSnapshot = requireLink(ctx.session).records;
  for (const rec of localSnapshot) {
    if (!linkedIds.has(rec.airtableId) && byId.has(rec.airtableId))
      report.localDeletedKept++;
  }
  const syncedAt = ctx.now();
  for (const w of plan) {
    if (w.kind === "create") {
      const created = ctx.session.store.createRow(w.values);
      ctx.session.store.setRowSync(created.id, {
        airtableId: w.airtableId,
        syncedRev: created.rev,
        syncedAt,
        remoteHash: w.remoteHash
      });
    } else if (w.kind === "update") {
      const updated = ctx.session.store.updateRow(w.row.id, w.values);
      ctx.session.store.setRowSync(w.row.id, nextSync(w.row.sync, {
        syncedRev: updated.rev,
        syncedAt,
        remoteHash: w.remoteHash,
        remoteDeleted: false
      }));
    } else {
      const current = ctx.session.store.getRow(w.row.id);
      ctx.session.store.setRowSync(w.row.id, nextSync(current.sync, {
        syncedRev: current.rev,
        syncedAt,
        remoteHash: w.remoteHash,
        remoteDeleted: w.remoteDeleted
      }));
    }
  }
  report.ok = report.conflicts.length === 0;
  report.summary = summarize(report);
  finishRun(ctx, report, "pull");
  return report;
}
function nextSync(current, patch) {
  const next = { ...current, ...patch };
  if (patch.remoteDeleted === false)
    delete next.remoteDeleted;
  return next;
}
function conflictItem(row, kind, remoteHash) {
  return { rowId: row.id, airtableId: row.sync?.airtableId ?? null, kind, remoteHash };
}

// src/sync/push.ts
async function pushToAirtable(ctx) {
  const link = requireLink(ctx.session);
  const fields = ctx.session.getFields();
  const report = emptyReport("push");
  const remote = await ctx.client.listRecords(link.baseId, link.tableId);
  const byId = new Map(remote.map((r) => [r.id, r]));
  const creates = [];
  const updates = [];
  const localOnly = [];
  const linkedIds = /* @__PURE__ */ new Set();
  for (const row of ctx.session.store.getAllRows()) {
    if (!row.sync) {
      creates.push({ row, sentRev: row.rev, airtableId: null, payload: writePayload(fields, row) });
      continue;
    }
    linkedIds.add(row.sync.airtableId);
    const rec = byId.get(row.sync.airtableId) ?? null;
    const remoteHash = rec ? remoteHashFor(fields, rec) : null;
    const cls = classifyLinked(linkedFacts(row, rec, fields, remoteHash), row.sync, "push");
    switch (cls.action) {
      case "push":
        updates.push({ row, sentRev: row.rev, airtableId: row.sync.airtableId, payload: writePayload(fields, row) });
        break;
      case "adopt":
        localOnly.push({ row, kind: "adopt", remoteHash });
        break;
      case "mark_remote_deleted":
        localOnly.push({ row, kind: "flag" });
        break;
      case "conflict":
        report.conflicts.push(conflictItem(row, cls.conflictKind, remoteHash));
        break;
      case "remote_changed":
        report.remoteChangedNotPushed++;
        break;
      case "none":
      case "decided":
        if (row.sync.remoteDeleted)
          report.remoteDeleted++;
        else
          report.unchanged++;
        break;
      default:
        throw new Error(`Unexpected action on push: ${cls.action}`);
    }
  }
  for (const rec of link.records) {
    if (!linkedIds.has(rec.airtableId) && byId.has(rec.airtableId))
      report.localDeletedKept++;
  }
  const results = [];
  const failures = [];
  const sendChunk = async (items, isCreate) => {
    try {
      const recs = isCreate ? await ctx.client.createRecords(link.baseId, link.tableId, items.map((i) => ({ fields: i.payload }))) : await ctx.client.updateRecords(link.baseId, link.tableId, items.map((i) => ({ id: i.airtableId, fields: i.payload })));
      if (recs.length !== items.length)
        throw new AirtableError("bad_response", null, 1, "Airtable returned an unexpected number of records.");
      items.forEach((item, idx) => results.push({ row: item.row, sentRev: item.sentRev, record: recs[idx] }));
    } catch {
      for (const item of items) {
        try {
          const [rec] = isCreate ? await ctx.client.createRecords(link.baseId, link.tableId, [{ fields: item.payload }]) : await ctx.client.updateRecords(link.baseId, link.tableId, [{ id: item.airtableId, fields: item.payload }]);
          if (!rec)
            throw new AirtableError("bad_response", null, 1, "Airtable returned no record.");
          results.push({ row: item.row, sentRev: item.sentRev, record: rec });
        } catch (rowErr) {
          failures.push({ rowId: item.row.id, reason: safeReason(rowErr) });
        }
      }
    }
  };
  for (let i = 0; i < creates.length; i += AIRTABLE_WRITE_BATCH)
    await sendChunk(creates.slice(i, i + AIRTABLE_WRITE_BATCH), true);
  for (let i = 0; i < updates.length; i += AIRTABLE_WRITE_BATCH)
    await sendChunk(updates.slice(i, i + AIRTABLE_WRITE_BATCH), false);
  const syncedAt = ctx.now();
  for (const r of results) {
    const remoteHash = hashValues(remoteValues(fields, r.record.fields));
    const current = ctx.session.store.getRow(r.row.id);
    if (!current) {
      failures.push({ rowId: r.row.id, reason: "The row was removed during the push." });
      continue;
    }
    const base = current.sync ?? { airtableId: r.record.id, syncedRev: 0, syncedAt, remoteHash };
    ctx.session.store.setRowSync(
      r.row.id,
      nextSync(
        { ...base, airtableId: r.record.id },
        { airtableId: r.record.id, syncedRev: r.sentRev, syncedAt, remoteHash, remoteDeleted: false }
      )
    );
    if (current.sync)
      report.updated++;
    else
      report.created++;
    report.pushed++;
  }
  for (const item of localOnly) {
    const current = ctx.session.store.getRow(item.row.id);
    if (!current?.sync)
      continue;
    if (item.kind === "flag") {
      ctx.session.store.setRowSync(item.row.id, nextSync(current.sync, { remoteDeleted: true }));
      report.remoteDeleted++;
    } else {
      ctx.session.store.setRowSync(item.row.id, nextSync(current.sync, { remoteHash: item.remoteHash, syncedRev: current.rev, syncedAt }));
      report.adopted++;
    }
  }
  report.failures = failures;
  report.ok = failures.length === 0 && report.conflicts.length === 0;
  report.summary = summarize(report);
  finishRun(ctx, report, "push");
  return report;
}

// src/sync/conflicts.ts
async function resolveConflict(ctx, rowId, decision) {
  const link = requireLink(ctx.session);
  const fields = ctx.session.getFields();
  const remote = await ctx.client.listRecords(link.baseId, link.tableId);
  const byId = new Map(remote.map((r) => [r.id, r]));
  const row = ctx.session.store.getRow(rowId);
  if (!row || !row.sync)
    throw new Error("This row is not linked to Airtable.");
  const rec = byId.get(row.sync.airtableId) ?? null;
  const remoteHash = rec ? remoteHashFor(fields, rec) : null;
  const cls = classifyLinked(linkedFacts(row, rec, fields, remoteHash), row.sync, "pull");
  if (cls.action !== "conflict" || !cls.conflictKind) {
    throw new Error("There is no open conflict on this row. Sync again to see the current state.");
  }
  const kind = cls.conflictKind;
  if (kind === "remote_deleted" && decision === "keep_both") {
    throw new Error("Keep both is not offered when the record was deleted in Airtable.");
  }
  const decidedAt = ctx.now();
  const sync = row.sync;
  let createdRowId = null;
  if (decision === "keep_local") {
    if (kind === "remote_deleted") {
      ctx.session.store.setRowSync(row.id, null);
    } else {
      ctx.session.store.setRowSync(row.id, {
        ...sync,
        remoteHash,
        conflict: { kind, decision, localRev: row.rev, remoteHash, decidedAt }
      });
    }
  } else if (decision === "keep_remote") {
    if (kind === "remote_deleted") {
      ctx.session.store.deleteRow(row.id);
    } else {
      const updated = ctx.session.store.updateRow(row.id, remoteValues(fields, rec.fields));
      ctx.session.store.setRowSync(row.id, {
        ...sync,
        syncedRev: updated.rev,
        syncedAt: decidedAt,
        remoteHash,
        conflict: { kind, decision, localRev: updated.rev, remoteHash, decidedAt }
      });
    }
  } else {
    const copy = ctx.session.store.createRow(remoteValues(fields, rec.fields));
    createdRowId = copy.id;
    ctx.session.store.setRowSync(row.id, {
      ...sync,
      remoteHash,
      conflict: { kind, decision, localRev: row.rev, remoteHash, decidedAt }
    });
  }
  ctx.session.stack.clear();
  refreshRecordSnapshot(ctx.session);
  return { createdRowId };
}

// src/sync/autoCreate.ts
var CREATE_SPEC = {
  text: { airtableType: "singleLineText" },
  long_text: { airtableType: "multilineText" },
  url: { airtableType: "url" },
  email: { airtableType: "email" },
  phone: { airtableType: "phoneNumber" },
  number: { airtableType: "number", options: { precision: 0 } },
  percent: { airtableType: "percent", options: { precision: 0 } },
  rating: { airtableType: "rating", options: { max: 5, icon: "star", color: "yellowBright" } },
  checkbox: { airtableType: "checkbox", options: { icon: "check", color: "greenBright" } },
  date: { airtableType: "date", options: { dateFormat: { name: "iso" } } }
};
var NOT_CREATED = {
  currency: "needs a currency symbol choice",
  duration: "needs a duration unit choice",
  date_time: "needs a time zone choice",
  single_select: "select options are not created yet; add the field in Airtable first",
  multi_select: "select options are not created yet; add the field in Airtable first",
  attachment: "attachments are not created from Tablify",
  auto_number: "system field",
  created_time: "system field",
  modified_time: "system field",
  formula: "computed in Tablify; never sent to Airtable",
  link: "links are not created in Airtable from Tablify"
};
function planAutoCreate(fields, remoteFields) {
  const items = [];
  const skipped = [];
  const remoteNames = new Set(remoteFields.map((f) => f.name.trim().toLowerCase()));
  for (const f of fields) {
    if (f.airtable) {
      if (!remoteFields.some((r) => r.id === f.airtable.id)) {
        skipped.push({ fieldId: f.id, name: f.name, reason: "linked field no longer exists in Airtable" });
      }
      continue;
    }
    const spec = CREATE_SPEC[f.type];
    if (!spec) {
      skipped.push({ fieldId: f.id, name: f.name, reason: NOT_CREATED[f.type] ?? "not supported" });
      continue;
    }
    if (remoteNames.has(f.name.trim().toLowerCase())) {
      skipped.push({ fieldId: f.id, name: f.name, reason: "a field with this name already exists in Airtable" });
      continue;
    }
    items.push({ fieldId: f.id, name: f.name, tablifyType: f.type, airtableType: spec.airtableType, options: spec.options });
  }
  return { items, skipped };
}
async function createMissingFields(ctx, plan, confirmed) {
  if (!confirmed)
    throw new Error("Creating fields needs explicit confirmation. Nothing was created.");
  const link = requireLink(ctx.session);
  const result = { created: [], failed: null };
  if (plan.items.length === 0)
    return result;
  const fieldsBefore = ctx.session.getFields();
  const remote = await ctx.client.listRecords(link.baseId, link.tableId);
  const byId = new Map(remote.map((r) => [r.id, r]));
  for (const row of ctx.session.store.getAllRows()) {
    if (!row.sync)
      continue;
    const rec = byId.get(row.sync.airtableId);
    if (rec && remoteHashFor(fieldsBefore, rec) !== row.sync.remoteHash) {
      throw new Error("Airtable records changed since the last sync. Pull first, then create the fields.");
    }
  }
  for (const item of plan.items) {
    try {
      const created = await ctx.client.createField(link.baseId, link.tableId, {
        name: item.name,
        type: item.airtableType,
        options: item.options
      });
      ctx.session.store.setFieldAirtable(item.fieldId, { id: created.id, type: created.type, readOnly: false });
      result.created.push({ fieldId: item.fieldId, airtableId: created.id, name: item.name, airtableType: created.type });
    } catch (err3) {
      result.failed = { name: item.name, reason: safeReason(err3) };
      break;
    }
  }
  if (result.created.length > 0) {
    const fieldsAfter = ctx.session.getFields();
    const newIds = new Set(result.created.map((c) => c.fieldId));
    for (const row of ctx.session.store.getAllRows()) {
      if (!row.sync)
        continue;
      const rec = byId.get(row.sync.airtableId);
      if (!rec)
        continue;
      const hashAfter = hashValues(remoteValues(fieldsAfter, rec.fields));
      const hasLocalNew = fieldsAfter.some((f) => newIds.has(f.id) && row.values[f.id] !== void 0 && row.values[f.id] !== null && row.values[f.id] !== "");
      if (hasLocalNew)
        ctx.session.store.updateRow(row.id, {});
      const current = ctx.session.store.getRow(row.id);
      ctx.session.store.setRowSync(row.id, { ...current.sync, remoteHash: hashAfter });
    }
  }
  ctx.session.stack.clear();
  refreshRecordSnapshot(ctx.session);
  return result;
}

// src/sync/redact.ts
var REDACTED = "[token hidden]";
var AIRTABLE_PAT_SHAPE = /pat[A-Za-z0-9]{14}\.[0-9a-fA-F]{64}/g;
var BEARER_SHAPE = /Bearer\s+[^\s"',;]+/gi;
var MIN_LITERAL_SECRET_LENGTH = 8;
function redactSecrets(text, secret) {
  let out = text;
  if (secret && secret.length >= MIN_LITERAL_SECRET_LENGTH) {
    out = out.split(secret).join(REDACTED);
  }
  out = out.replace(BEARER_SHAPE, "Bearer " + REDACTED);
  out = out.replace(AIRTABLE_PAT_SHAPE, REDACTED);
  return out;
}

// src/sync/fieldMap.ts
function tablifyFieldIdFor(airtableFieldId) {
  const body = airtableFieldId.startsWith("fld") ? airtableFieldId.slice(3) : airtableFieldId;
  return "fld_" + body.replace(/[^A-Za-z0-9_]/g, "_");
}
var UNSUPPORTED = "unsupported type";
var FIELD_TYPE_MAP = Object.freeze({
  singleLineText: { tablify: "text", readOnly: false },
  multilineText: { tablify: "long_text", readOnly: false },
  email: { tablify: "email", readOnly: false },
  url: { tablify: "url", readOnly: false },
  phoneNumber: { tablify: "phone", readOnly: false },
  number: { tablify: "number", readOnly: false },
  currency: { tablify: "currency", readOnly: false },
  percent: { tablify: "percent", readOnly: false },
  rating: { tablify: "rating", readOnly: false },
  checkbox: { tablify: "checkbox", readOnly: false },
  date: { tablify: "date", readOnly: false },
  // Time zone handling is not verified yet, so these are read-only until it is.
  dateTime: { tablify: "date_time", readOnly: true, reason: "time zone handling not verified" },
  // Airtable stores durations in its own unit. Conversion to Tablify milliseconds is not verified.
  duration: { tablify: "duration", readOnly: true, reason: "unit conversion not verified" },
  singleSelect: { tablify: "single_select", readOnly: false },
  multipleSelects: { tablify: "multi_select", readOnly: false },
  // Shown as the file names in a read-only text column. A Tablify attachment cell needs a vault path,
  // which Airtable does not supply, so it is not used here.
  multipleAttachments: { tablify: "text", readOnly: true, reason: "attachments are shown as file names" },
  autoNumber: { tablify: "auto_number", readOnly: true, reason: "system field" },
  createdTime: { tablify: "created_time", readOnly: true, reason: "system field" },
  lastModifiedTime: { tablify: "modified_time", readOnly: true, reason: "system field" }
});
var COLOR_FAMILIES = [
  [/^blue|^cyan|^teal/i, "blue"],
  [/^green/i, "green"],
  [/^yellow/i, "yellow"],
  [/^orange/i, "orange"],
  [/^red/i, "red"],
  [/^pink/i, "pink"],
  [/^purple/i, "purple"],
  [/^brown/i, "brown"],
  [/^gray|^grey/i, "gray"]
];
function optionColorFor(airtableColor) {
  if (typeof airtableColor !== "string")
    return "gray";
  for (const [re, color] of COLOR_FAMILIES)
    if (re.test(airtableColor))
      return color;
  return "gray";
}
function selectOptionsFor(field) {
  const opts = field.options?.choices;
  if (!Array.isArray(opts))
    return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  opts.forEach((raw, i) => {
    const c = raw ?? {};
    const name = typeof c.name === "string" && c.name.length > 0 ? c.name : `Option ${i + 1}`;
    const id = "opt_" + (typeof c.id === "string" ? c.id : String(i)).replace(/[^A-Za-z0-9_]/g, "_");
    if (seen.has(id))
      return;
    seen.add(id);
    out.push({ id, name, color: optionColorFor(c.color) });
  });
  return out;
}
function mapField(field, primaryId) {
  const rule = Object.prototype.hasOwnProperty.call(FIELD_TYPE_MAP, field.type) ? FIELD_TYPE_MAP[field.type] : void 0;
  const supported = rule !== void 0;
  const tablifyType = rule ? rule.tablify : "text";
  let readOnly = rule ? rule.readOnly : true;
  let reason = rule ? rule.reason ?? "" : `${UNSUPPORTED} (${field.type})`;
  if (field.type === "rating") {
    const max2 = field.options?.max;
    if (typeof max2 === "number" && max2 > 10) {
      readOnly = true;
      reason = `rating above 10 (${max2}) is read-only`;
    }
  }
  const def = {
    id: tablifyFieldIdFor(field.id),
    name: field.name,
    type: tablifyType,
    airtable: { id: field.id, type: field.type, readOnly }
  };
  if (primaryId !== null && field.id === primaryId)
    def.primary = true;
  if (tablifyType === "single_select" || tablifyType === "multi_select") {
    def.options = selectOptionsFor(field);
  }
  if (!supported) {
    def.type = "text";
  }
  const info = {
    airtableId: field.id,
    airtableName: field.name,
    airtableType: field.type,
    tablifyId: def.id,
    tablifyType: def.type,
    readOnly,
    supported,
    reason
  };
  return { def, info };
}
function mapTable(table) {
  const fields = [];
  const mapped = [];
  const unmapped = [];
  const used = /* @__PURE__ */ new Set();
  const primaryAirtableId = table.fields.some((f) => f.id === table.primaryFieldId) ? table.primaryFieldId : null;
  for (const field of table.fields) {
    const { def, info } = mapField(field, primaryAirtableId);
    let id = def.id;
    let n = 2;
    while (used.has(id))
      id = `${def.id}_${n++}`;
    used.add(id);
    def.id = id;
    info.tablifyId = id;
    fields.push(def);
    (info.supported ? mapped : unmapped).push(info);
  }
  if (fields.length > 0 && !fields.some((f) => f.primary))
    fields[0].primary = true;
  return { fields, mapped, unmapped, primaryAirtableId };
}

// src/views/sync/syncController.ts
function linkTable(session, choice, now) {
  const { table, baseId } = choice;
  let matched = 0;
  if (choice.replaceColumns) {
    unlinkTable(session);
    const mapping = mapTable(table);
    for (const f of session.getFields())
      session.store.removeField(f.id);
    for (const f of mapping.fields)
      session.store.addField(f);
    session.patchView({ columnOrder: mapping.fields.map((f) => f.id), hidden: [], sort: [], groupBy: null });
    matched = mapping.fields.length;
  } else {
    const used = /* @__PURE__ */ new Set();
    for (const local of session.getFields()) {
      if (local.airtable)
        continue;
      const remote = table.fields.find((r) => !used.has(r.id) && r.name.trim().toLowerCase() === local.name.trim().toLowerCase());
      if (!remote)
        continue;
      const { def, info } = mapField(remote, null);
      if (def.type !== local.type)
        continue;
      used.add(remote.id);
      session.store.setFieldAirtable(local.id, { id: remote.id, type: remote.type, readOnly: info.readOnly });
      matched++;
    }
  }
  session.setSyncLink({
    baseId,
    tableId: table.id,
    tableName: table.name,
    linkedAt: now,
    lastSync: null,
    records: []
  });
  session.stack.clear();
  return { matched, replaced: choice.replaceColumns };
}
function unlinkTable(session) {
  for (const row of session.store.getAllRows()) {
    if (row.sync)
      session.store.setRowSync(row.id, null);
  }
  for (const f of session.getFields()) {
    if (f.airtable)
      session.store.setFieldAirtable(f.id, null);
  }
  session.setSyncLink(null);
  session.stack.clear();
}
function typeLabel(type) {
  return type.replace(/_/g, " ");
}

// src/views/sync/SyncModal.ts
function el(parent, tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.cls)
    node.className = opts.cls;
  if (opts.text !== void 0)
    node.textContent = opts.text;
  parent.insertAdjacentElement("beforeend", node);
  return node;
}
var SCOPES_TEXT = "data.records:read \xB7 data.records:write \xB7 schema.bases:read";
var CREATE_SCOPE_TEXT = "schema.bases:write is needed only to create fields.";
var SyncModal = class extends import_obsidian14.Modal {
  constructor(app, deps) {
    super(app);
    this.deps = deps;
  }
  state = {
    bases: [],
    tables: [],
    baseId: null,
    tableIndex: 0,
    replaceColumns: false,
    busy: null,
    status: null,
    conflicts: [],
    plan: null,
    planFields: []
  };
  cancelButton = null;
  onOpen() {
    this.setTitle("Airtable sync");
    this.modalEl.addClass("tablify__modal");
    this.render();
    if (this.deps.token)
      void this.loadBases();
  }
  onClose() {
    while (this.contentEl.firstChild)
      this.contentEl.removeChild(this.contentEl.firstChild);
  }
  // ---- clients and context ----
  client() {
    if (!this.deps.token)
      throw new Error("No Airtable token is stored. Add one in Tablify settings first.");
    return this.deps.makeClient ? this.deps.makeClient(this.deps.token) : new AirtableClient({ token: this.deps.token });
  }
  ctx() {
    return { client: this.client(), session: this.deps.session, now: this.deps.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()) };
  }
  fail(err3, prefix) {
    const raw = err3 instanceof Error ? err3.message : "Unknown error.";
    const safe = redactSecrets(raw, this.deps.token ?? void 0);
    const hint = err3 instanceof AirtableError && (err3.kind === "network" || err3.kind === "server" || err3.kind === "rate_limited") ? " Nothing in the table changed." : "";
    this.state.status = { text: `${prefix}: ${safe}${hint}`, error: true };
  }
  /** Runs one action: sets busy, catches errors, and re-renders. */
  async run(label, work) {
    this.state.busy = label;
    this.state.status = null;
    this.render();
    try {
      await work();
    } catch (err3) {
      this.fail(err3, `${label} failed`);
    } finally {
      this.state.busy = null;
      this.render();
    }
  }
  // ---- actions ----
  async loadBases() {
    await this.run("Loading bases", async () => {
      this.state.bases = await this.client().listBases();
      if (this.state.bases.length > 0 && !this.state.baseId)
        this.state.baseId = this.state.bases[0].id;
      await this.loadTables();
    });
  }
  async loadTables() {
    if (!this.state.baseId)
      return;
    this.state.tables = await this.client().listTables(this.state.baseId);
    this.state.tableIndex = 0;
  }
  async link() {
    const table = this.state.tables[this.state.tableIndex];
    if (!table || !this.state.baseId)
      return;
    await this.run("Linking", async () => {
      const res = linkTable(
        this.deps.session,
        { baseId: this.state.baseId, table, replaceColumns: this.state.replaceColumns },
        (this.deps.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))()
      );
      this.state.status = {
        text: res.replaced ? `Linked to ${table.name} and replaced the columns. Pull to fill the rows.` : `Linked to ${table.name}. ${res.matched} column(s) matched by name and type.`,
        error: false
      };
      this.deps.changed();
    });
  }
  unlink() {
    unlinkTable(this.deps.session);
    this.state.conflicts = [];
    this.state.plan = null;
    this.state.status = { text: "Unlinked. Local values are kept.", error: false };
    this.deps.changed();
    this.render();
  }
  pull() {
    return this.run("Pulling", async () => {
      const report = await pullFromAirtable(this.ctx());
      this.afterReport(report);
    });
  }
  push() {
    return this.run("Pushing", async () => {
      const report = await pushToAirtable(this.ctx());
      this.afterReport(report);
    });
  }
  afterReport(report) {
    this.state.conflicts = report.conflicts;
    const problems = [];
    if (report.failures.length) {
      problems.push(`${report.failures.length} row(s) not sent: ${report.failures.map((f) => f.reason).filter((v, i, a) => a.indexOf(v) === i).join("; ")}`);
    }
    if (report.conflicts.length)
      problems.push(`${report.conflicts.length} conflict(s) need a choice`);
    this.state.status = {
      text: `${report.direction === "pull" ? "Pulled" : "Pushed"}: ${report.summary || "no changes"}.${problems.length ? " " + problems.join(". ") + "." : ""}`,
      error: !report.ok
    };
    this.deps.changed();
  }
  async resolve(item, decision) {
    await this.run("Resolving", async () => {
      const res = await resolveConflict(this.ctx(), item.rowId, decision);
      this.state.conflicts = this.state.conflicts.filter((c) => c.rowId !== item.rowId);
      this.state.status = {
        text: res.createdRowId ? "Kept both. The remote copy is a new row. Push to create it in Airtable." : `Resolved: ${decision.replace("_", " ")}.`,
        error: false
      };
      this.deps.changed();
    });
  }
  async preparePlan() {
    await this.run("Checking fields", async () => {
      const link = this.deps.session.getSyncLink();
      if (!link)
        throw new Error("Link the table first.");
      const tables = await this.client().listTables(link.baseId);
      const table = tables.find((t) => t.id === link.tableId);
      if (!table)
        throw new Error("The linked table no longer exists in Airtable.");
      this.state.planFields = table.fields;
      this.state.plan = planAutoCreate(this.deps.session.getFields(), table.fields);
      this.state.status = this.state.plan.items.length ? { text: `${this.state.plan.items.length} field(s) can be created. Nothing is created until you confirm.`, error: false } : { text: "No local fields need creating in Airtable.", error: false };
    });
  }
  async createFields() {
    if (!this.state.plan)
      return;
    const plan = this.state.plan;
    await this.run("Creating fields", async () => {
      const res = await createMissingFields(this.ctx(), plan, true);
      this.state.plan = null;
      this.state.status = res.failed ? { text: `Created ${res.created.length} of ${plan.items.length}. ${res.failed.name}: ${res.failed.reason}. Nothing else was created.`, error: true } : { text: `Created ${res.created.length} field(s) in Airtable.`, error: false };
      this.deps.changed();
    });
  }
  // ---- rendering ----
  render() {
    const root = this.contentEl;
    while (root.firstChild)
      root.removeChild(root.firstChild);
    const link = this.deps.session.getSyncLink();
    const busy = this.state.busy !== null;
    el(root, "div", {
      cls: "tablify-sync__token",
      text: this.deps.token ? "Token: stored in Tablify settings (never written to .tablify files)." : "No token. Add one in Tablify settings, under Airtable sync."
    });
    el(root, "div", { cls: "tablify-sync__scopes", text: `Scopes: ${SCOPES_TEXT}. ${CREATE_SCOPE_TEXT}` });
    const linkBox = el(root, "div", { cls: "tablify-sync__link" });
    if (link) {
      el(linkBox, "span", { text: `Linked to ${link.tableName} (${link.baseId}).` });
      const unlinkBtn = el(linkBox, "button", { text: "Unlink" });
      unlinkBtn.addEventListener("click", () => this.unlink());
    } else {
      this.renderLinkForm(linkBox, busy);
    }
    const actions = el(root, "div", { cls: "tablify-sync__actions" });
    const pullBtn = el(actions, "button", { text: "Pull from Airtable" });
    const pushBtn = el(actions, "button", { text: "Push to Airtable" });
    const canRun = !!link && !!this.deps.token && !busy;
    pullBtn.disabled = !canRun;
    pushBtn.disabled = !canRun;
    pullBtn.addEventListener("click", () => void this.pull());
    pushBtn.addEventListener("click", () => void this.push());
    if (this.state.busy)
      el(root, "div", { cls: "tablify-sync__progress", text: `${this.state.busy}\u2026` });
    if (this.state.status) {
      el(root, "div", {
        cls: this.state.status.error ? "tablify-sync__status tablify-sync__status--error" : "tablify-sync__status",
        text: this.state.status.text
      });
    }
    if (link?.lastSync) {
      el(root, "div", {
        cls: "tablify-sync__last",
        text: `Last ${link.lastSync.direction} ${link.lastSync.at}: ${link.lastSync.ok ? "ok" : "with problems"}. ${link.lastSync.summary}`
      });
    }
    this.renderConflicts(root, busy);
    if (link)
      this.renderFields(root, busy);
  }
  renderLinkForm(box, busy) {
    const baseSel = el(box, "select", { cls: "tablify-sync__base" });
    for (const b of this.state.bases) {
      const opt = el(baseSel, "option", { text: b.name });
      opt.value = b.id;
      if (b.id === this.state.baseId)
        opt.selected = true;
    }
    baseSel.addEventListener("change", () => {
      this.state.baseId = baseSel.value;
      void this.run("Loading tables", () => this.loadTables());
    });
    const tableSel = el(box, "select", { cls: "tablify-sync__table" });
    this.state.tables.forEach((t, i) => {
      const opt = el(tableSel, "option", { text: t.name });
      opt.value = String(i);
      if (i === this.state.tableIndex)
        opt.selected = true;
    });
    tableSel.addEventListener("change", () => {
      this.state.tableIndex = Number(tableSel.value);
    });
    const replaceLabel = el(box, "label");
    const replace = el(replaceLabel, "input");
    replace.type = "checkbox";
    replace.checked = this.state.replaceColumns;
    replaceLabel.appendChild(document.createTextNode(" Replace local columns with the Airtable schema (local values in those columns are removed)"));
    replace.addEventListener("change", () => {
      this.state.replaceColumns = replace.checked;
      this.render();
    });
    const linkBtn = el(box, "button", { text: this.state.replaceColumns ? "Replace columns and link" : "Link table" });
    linkBtn.disabled = busy || !this.deps.token || this.state.tables.length === 0;
    linkBtn.addEventListener("click", () => void this.link());
  }
  renderConflicts(root, busy) {
    if (this.state.conflicts.length === 0)
      return;
    const box = el(root, "div", { cls: "tablify-sync__conflicts" });
    el(box, "div", { text: `Conflicts (${this.state.conflicts.length})` });
    for (const item of this.state.conflicts) {
      const row = el(box, "div", { cls: "tablify-sync__conflict" });
      const title = item.kind === "remote_deleted" ? "Deleted in Airtable, edited here" : "Changed here and in Airtable";
      el(row, "div", { text: title });
      const choices = item.kind === "remote_deleted" ? [["keep_local", "Keep local"], ["keep_remote", "Remove row"]] : [["keep_local", "Keep local"], ["keep_remote", "Keep remote"], ["keep_both", "Keep both"]];
      for (const [decision, label] of choices) {
        const btn = el(row, "button", { text: label });
        btn.disabled = busy;
        btn.addEventListener("click", () => void this.resolve(item, decision));
      }
    }
  }
  renderFields(root, busy) {
    const box = el(root, "div", { cls: "tablify-sync__fields" });
    const check = el(box, "button", { text: "Check fields to create" });
    check.disabled = busy || !this.deps.token;
    check.addEventListener("click", () => void this.preparePlan());
    const plan = this.state.plan;
    if (!plan)
      return;
    const list = el(box, "ul", { cls: "tablify-sync__plan" });
    for (const item of plan.items) {
      el(list, "li", { text: `${item.name} (${typeLabel(item.tablifyType)} \u2192 ${item.airtableType})` });
    }
    for (const skip of plan.skipped) {
      el(list, "li", { cls: "tablify-sync__skipped", text: `${skip.name}: not created (${skip.reason})` });
    }
    const buttons = el(box, "div", { cls: "tablify-sync__confirm" });
    this.cancelButton = el(buttons, "button", { text: "Cancel" });
    this.cancelButton.addEventListener("click", () => {
      this.state.plan = null;
      this.render();
    });
    const create = el(buttons, "button", { text: `Create ${plan.items.length} field(s) in Airtable` });
    create.disabled = busy || plan.items.length === 0;
    create.addEventListener("click", () => void this.createFields());
    this.cancelButton.focus();
  }
};

// src/main.ts
var TablifyPlugin = class extends import_obsidian15.Plugin {
  // P7-03: plugin settings. The Airtable token lives only here (plugin data).
  settings = { ...DEFAULT_SETTINGS };
  async onload() {
    this.settings = await loadSettings(this);
    this.addSettingTab(new TablifySettingTab(this.app, this));
    registerImportCommand(this);
    registerExportCommand(this);
    linkIndexFor(this.app).start(this);
    registerLinkIntegrityCommand(this);
    this.registerView(TABLIFY_VIEW_TYPE, (leaf) => new TableView(leaf));
    this.registerExtensions(["tablify"], TABLIFY_VIEW_TYPE);
    registerFileMenu(this);
    registerEmbedProcessor(this);
    this.addCommand({
      id: "tablify-airtable-sync",
      name: "Airtable sync for this table",
      callback: () => this.openSync()
    });
  }
  openSync() {
    const view = this.app.workspace.getActiveViewOfType(TableView);
    const session = view?.syncSession();
    if (!view || !session) {
      new import_obsidian15.Notice("Open a .tablify table first.");
      return;
    }
    const token = this.settings.airtableToken.trim() || null;
    new SyncModal(this.app, { session, token, changed: () => view.afterSyncChange() }).open();
  }
};
/*! Bundled license information:

jszip/dist/jszip.min.js:
  (*!
  
  JSZip v3.10.2 - A JavaScript class for generating and reading zip files
  <http://stuartk.com/jszip>
  
  (c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
  Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.
  
  JSZip uses the library pako released under the MIT license :
  https://github.com/nodeca/pako/blob/main/LICENSE
  *)
*/
