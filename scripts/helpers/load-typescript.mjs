import {readFileSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const cache=new Map();
export function load(file){
 file=resolve(file);if(cache.has(file))return cache.get(file);
 if(file.endsWith('.mjs'))return pathToFileURL(file).href;
 let code=file.endsWith('.json')?'export default '+readFileSync(file,'utf8'):ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 code=code.replace(/from ["']([^"']+)["']/g,(match,ref)=>{if(!ref.startsWith('.')&&!ref.startsWith('@/'))return match;let p=ref.startsWith('@/')?resolve('src',ref.slice(2)):resolve(dirname(file),ref);if(!extname(p))p+='.ts';return `from ${JSON.stringify(load(p))}`;});
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(file,url);return url;
}
