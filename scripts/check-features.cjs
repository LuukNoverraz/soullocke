// Run with node scripts/check-features.cjs. No dependencies or network needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../public', name), 'utf8');
function element() {
  return {
    children: [], style: {}, value: '', checked: false, listeners: {},
    classList: { add() {}, remove() {}, toggle(name, value) { this[name] = value; } },
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { this.children = []; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    setAttribute() {},
  };
}
function context(search = '', storage = new Map()) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  get('param-typing').value = 'gen6';
  get('param-max').value = '6';
  const ctx = vm.createContext({
    URLSearchParams, console, setTimeout, clearTimeout,
    btoa: text => Buffer.from(text, 'binary').toString('base64'),
    unescape, encodeURIComponent,
    window: { location: { search, hostname: 'localhost', origin: 'http://localhost:3000' },
      matchMedia: () => ({ matches: false }) },
    document: { getElementById: get, createElement: element, documentElement: element() },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    fetch: async url => {
      const name = url.split('/').pop();
      const data = { bulbasaur: [1, 'grass'], charmander: [4, 'fire'], squirtle: [7, 'water'] }[name];
      return { ok: Boolean(data), json: async () => ({ id: data[0], types: [{ type: { name: data[1] } }] }) };
    },
  });
  return { ctx, get, run: code => vm.runInContext(code, ctx) };
}
function overlay(search) {
  const env = context(search);
  env.run(read('pokemon-names-de.js'));
  const code = [...read('overlay.html').matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  env.run(code.slice(0, code.indexOf('(async function init()')));
  return env;
}
(async () => {
  const de = overlay('?lang=de&reverse=true&layout=vertical&max=2');
  for (const [name, expected] of [
    ['Bisasam', 'bulbasaur'], ['GLUMANDA', 'charmander'], ['Schiggy', 'squirtle'],
    ['Pantimos', 'mr-mime'], ['Typ:Null', 'type-null'], ['Flabébé', 'flabebe'],
    ['Alola-Raichu', 'raichu-alola'], ['Galar-Pantimos', 'mr-mime-galar'],
    ['Galarian Pantimos', 'mr-mime-galar'], ['Hisui-Zorua', 'zorua-hisui'],
    ['Deoxys', 'deoxys-normal'], ['Deoxys-attack', 'deoxys-attack'],
    ['Mr. Mime', 'mr-mime'], ['Bulbasaur', 'bulbasaur'],
  ]) assert.equal(de.run(`normalizePokemonName(${JSON.stringify(name)})`), expected, name);
  assert.equal(de.run('GERMAN_POKEMON_NAMES.length'), 1025);
  assert.equal(de.run('parseSpeciesName("Schiggy (Shiny)").isShiny'), true);
  assert.equal(de.run('parseSpeciesName("Schiggy (Shiny)").cleanName'), 'squirtle');
  assert.equal(de.get('overlay').classList.vertical, true);
  const yaml = '- First\nLeaf & Ember\nBisasam & Glumanda (Shiny)\n- Hidden (DEAD)\nGone\nSchiggy\n- Second\nSplash\nSchiggy\n- Third\nExtra\nBisasam';
  de.run(`globalThis.pairs = parseRunTxt(${JSON.stringify(yaml)}).pairs`);
  await de.run('renderPairs(pairs)');
  const circles = de.get('pairs-container').children;
  assert.deepEqual(circles.map(c => c.title), ['Second', 'First']);
  assert.equal(circles[0].children[1].textContent, 'Splash');
  assert.match(circles[1].children[1].src, /shiny\/4.png$/);
  assert.equal(circles[1].children[2].textContent, 'Leaf');
  assert.equal(de.run('pairs[0].routeName'), 'First');
  const en = overlay('');
  assert.equal(en.run('normalizePokemonName("Bisasam")'), 'bisasam');
  assert.equal(en.get('overlay').classList.vertical, false);
  const setup = context('?lang=de&layout=vertical&reverse=true');
  setup.run([...read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1]);
  const url = new URL(setup.run('buildOverlayUrl()'));
  assert.equal(url.searchParams.get('lang'), 'de');
  assert.equal(url.searchParams.get('layout'), 'vertical');
  assert.equal(url.searchParams.get('reverse'), 'true');
  setup.get('param-german').checked = false;
  setup.get('param-german').listeners.change();
  assert.equal(new URL(setup.run('buildOverlayUrl()')).searchParams.has('lang'), false);
  console.log('German names, shiny artwork, partner order, team limits, layout and URL controls passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
