// Real-DOM regression test driver for the prototype (Prototype/index.html + script.js).
// Usage:  npm i jsdom && node scripts/prototype-dom-test.js
// The test body lives in prototype-dom-tests-body.js (plain JS, evaluated in the
// jsdom window together with the app script so they share one scope).
// Scenarios: S1-S7 outside-tap selection clearing; S8 row drag-and-drop;
//            S9 fixed uniform cell dimensions.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/home/user/Tablify/Prototype/index.html', 'utf8')
  .replace(/<script src="https:[^"]*"><\/script>/g, '')
  .replace(/<link[^>]*href="https:[^"]*"[^>]*>/g, '')
  .replace('<script src="script.js"></script>', '');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const { window } = dom;
window.innerWidth = 1400;
window.confirm = () => true;
window.navigator.clipboard = { writeText: () => Promise.resolve(), readText: () => Promise.reject(new Error('no')) };
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener(){} }));
window.HTMLElement.prototype.scrollIntoView = function(){};
window.__A = (name, cond) => { if (!cond) { console.log('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };
window.__log = (...a) => console.log(...a);

const app = fs.readFileSync('/home/user/Tablify/Prototype/script.js', 'utf8').replace("'use strict';", '');

const tests = fs.readFileSync(require('path').join(__dirname, 'prototype-dom-tests-body.js'), 'utf8');
window.eval(app + tests);
