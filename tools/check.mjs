import {readFile,access,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {combinations,available} from '../dist/domain.js';
const data=JSON.parse(await readFile('dist/data.json','utf8'));
const manifest=JSON.parse(await readFile('docs/media-manifest.json','utf8'));
const ids=new Set(data.items.map(x=>x.id));assert.equal(ids.size,data.items.length);
assert.equal(data.items.length,12);assert.equal(data.looks.length,6);
for(const row of [...data.items,...data.looks]){assert.match(row.image,/^\.\/assets\/[a-z0-9-]+\.jpg$/);await access('dist/'+row.image);assert.ok(row.alt?.length>10);}
for(const look of data.looks){assert.ok(look.itemIds.every(id=>ids.has(id)));assert.ok(available(look,[...ids]));const pieces=look.itemIds.map(id=>data.items.find(x=>x.id===id));assert.ok(pieces.every(x=>x.occasions.includes(look.occasion)&&x.temperatures.includes(look.temperature)));if(look.temperature==='cool')assert.ok(pieces.some(x=>x.category==='layer'));}
let generated=0;
for(const occasion of ['everyday','work','evening','weekend'])for(const temperature of ['warm','mild','cool']){const result=combinations(data.items,{occasion,temperature});assert.ok(result.length>0,`${occasion}/${temperature}`);generated+=result.length;}
const files=await readdir('dist/assets');
const collect=(value)=>Array.isArray(value)?value.flatMap(collect):value&&typeof value==='object'?[...(value.filename&&value.sha256?[value]:[]),...Object.values(value).filter(v=>typeof v==='object'&&v!==null).flatMap(collect)]:[];
const sources=collect(manifest);
for(const file of files){const row=sources.find(x=>x.filename===file);assert.ok(row,`attribution for ${file}`);const bytes=await readFile('dist/assets/'+file);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);}
const html=await readFile('dist/index.html','utf8');assert.match(html,/<html lang="vi">/);assert.ok(!html.includes('https://images.'));
await access('dist/credits.html');
console.log(`Verified ${data.items.length} pieces, ${data.looks.length} looks, ${files.length} original stock-photo hashes, ${generated} valid combinations across 12 settings.`);
