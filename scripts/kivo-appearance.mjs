/** Kivo appearance; no dependencies, no ANSI when not on a colour terminal. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const THEMES = Object.freeze({
  prism: Object.freeze({brand:'#AB89FF', accent:'#FF9F87', highlight:'#F6D57A', good:'#91DEAC', dim:'#A4A6B8', bad:'#FF7A94'}),
  sunset: Object.freeze({brand:'#FF8879', accent:'#F6C96C', highlight:'#F9A7CA', good:'#AFE3A4', dim:'#BAADAE', bad:'#FF748F'}),
  garden: Object.freeze({brand:'#80CEA4', accent:'#E9BB80', highlight:'#B5A5F7', good:'#80CEA4', dim:'#A4B5AA', bad:'#EF8C99'}),
  mono: Object.freeze({brand:null, accent:null, highlight:null, good:null, dim:null, bad:null}),
});
export const SHAPES=Object.freeze({
  prism: Object.freeze([
    ['          ✦', 'highlight'],
    ['        ◇╱╲◇╱╲◇', 'brand'],
    ['       ╱  ◉  ◉  ╲', 'accent'],
    ['       ◇    ▿    ◇', 'highlight'],
    ['        ╲  ╲_╱  ╱', 'brand'],
    ['          ╲◆╱', 'accent'],
  ]),
  orbit: Object.freeze([
    ['          ✧  ◌', 'highlight'],
    ['       ╭────────╮', 'brand'],
    ['     ◇ │ ◉  ◉  │ ◇', 'accent'],
    ['       ╰╮  ▿  ╭╯', 'highlight'],
    ['        ╰──◆──╯', 'brand'],
    ['       ◌       ✦', 'accent'],
  ]),
  bloom: Object.freeze([
    ['          ◆', 'accent'],
    ['       ╱╲ │ ╱╲', 'brand'],
    ['      ◇  ◉ ◉  ◇', 'highlight'],
    ['       ╲  ▿  ╱', 'brand'],
    ['        ╲ ◆ ╱', 'accent'],
    ['          ◇', 'highlight'],
  ]),
});
const DEFAULT=Object.freeze({theme:'prism',shape:'prism'});
export function normaliseAppearance(input) {
  return {
    theme: Object.hasOwn(THEMES,input?.theme)?input.theme:DEFAULT.theme,
    shape: Object.hasOwn(SHAPES,input?.shape)?input.shape:DEFAULT.shape,
  };
}
export function appearancePath(home) {return join(home,'appearance.json');}
export function loadAppearance(home) {
  try {return normaliseAppearance(JSON.parse(readFileSync(appearancePath(home),'utf8')));} catch {return {...DEFAULT};}
}
export function saveAppearance(home, values) {
  const appearance=normaliseAppearance(values);
  mkdirSync(home,{recursive:true,mode:0o700});
  writeFileSync(appearancePath(home),JSON.stringify(appearance,null,2)+'\n',{mode:0o600});
  return appearance;
}
export function colorize(text, theme='prism', part='brand', enabled=false) {
  const value=THEMES[theme]?.[part];
  if(!enabled || !value) return String(text);
  const hex=value.slice(1);
  const [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
  return `\x1b[38;2;${r};${g};${b}m${String(text)}\x1b[0m`;
}
export function renderMascot(shape='prism',theme='prism',colors=false) {
  return (SHAPES[shape]||SHAPES.prism).map(([line,accent])=>colorize(line,theme,accent,colors)).join('\n');
}
export function rawMascot(shape='prism') {return (SHAPES[shape]||SHAPES.prism).map(([line])=>line).join('\n');}
