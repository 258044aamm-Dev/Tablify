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
var import_obsidian = require("obsidian");
var TablifyPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.addCommand({
      id: "tablify-hello",
      name: "Hello from Tablify",
      callback: () => {
        console.log("Tablify plugin loaded successfully");
      }
    });
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiB9IGZyb20gJ29ic2lkaWFuJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGFibGlmeVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG5cdGFzeW5jIG9ubG9hZCgpIHtcblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6ICd0YWJsaWZ5LWhlbGxvJyxcblx0XHRcdG5hbWU6ICdIZWxsbyBmcm9tIFRhYmxpZnknLFxuXHRcdFx0Y2FsbGJhY2s6ICgpID0+IHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ1RhYmxpZnkgcGx1Z2luIGxvYWRlZCBzdWNjZXNzZnVsbHknKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUF1QjtBQUV2QixJQUFxQixnQkFBckIsY0FBMkMsdUJBQU87QUFBQSxFQUNqRCxNQUFNLFNBQVM7QUFDZCxTQUFLLFdBQVc7QUFBQSxNQUNmLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTTtBQUNmLGdCQUFRLElBQUksb0NBQW9DO0FBQUEsTUFDakQ7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
