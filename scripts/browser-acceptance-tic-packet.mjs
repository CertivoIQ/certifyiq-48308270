/** Actual organizer component in Chromium; synthetic packet, no account or production data. */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || '/tmp/tic-browser/node_modules/playwright/index.mjs').href);
const root=process.cwd(), directory=mkdtempSync(join(root,'.tic-browser-'));
const evidence=resolve('packet-browser-evidence'); mkdirSync(evidence,{recursive:true});
writeFileSync(join(directory,'index.html'),'<html lang="en"><head><meta charset="UTF-8"><title>TIC selection test</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
writeFileSync(join(directory,'main.tsx'),`
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TicPacketOrganizer } from '@/components/tic-packet-organizer';
import { packetInventory, initialPageChoices, buildPacketSelection } from '@/lib/tic-packet-selection';
const pages=[{page:1,text:'Cover Page\\nTenant Income Certification enclosed'},{page:2,text:'Review Summary\\nSample Findings'},
{page:3,text:'TENANT INCOME CERTIFICATION\\nPART I DEVELOPMENT DATA\\nPART II HOUSEHOLD COMPOSITION'},
{page:4,text:'PART VI DETERMINATION OF INCOME ELIGIBILITY\\nPART VII RENT'},
{page:5,text:'Earnings Statement\\nGross Pay: 1000 Net Pay: 800'},
{page:6,text:'Bank Statement\\nClosing balance: 200'}];
const inventory=packetInventory(pages);
function Harness(){const [choices,setChoices]=useState(initialPageChoices(inventory)),[saved,setSaved]=useState(null);
return <><h1>Synthetic packet selection acceptance</h1><TicPacketOrganizer inventory={inventory} choices={choices} sourceUrl="/original.pdf" isPdf={true} busy={false} onChange={setChoices} onConfirm={()=>setSaved(buildPacketSelection(pages,choices,'a'.repeat(64)))}/><pre data-testid="saved">{JSON.stringify(saved)}</pre></>}
createRoot(document.getElementById('root')).render(<Harness/>);
`);
let browser,server;
try{
 await build({configFile:false,root:directory,plugins:[react()],resolve:{alias:{'@':join(root,'src')}},build:{outDir:'dist',emptyOutDir:true}});
 const dist=join(directory,'dist');
 server=createServer((req,res)=>{let file=join(dist,(req.url||'/').split('?')[0]);if((req.url||'/').split('?')[0]==='/')file=join(dist,'index.html');try{const bytes=readFileSync(file);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(bytes)}catch{res.writeHead(404);res.end('Synthetic original preview; this test does not exercise PDF rendering.')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1400,height:1100}});const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const confirm=page.getByRole('button',{name:'Confirm selection & extract TIC'});
 await page.getByLabel('Page 1 review role').waitFor();
 assert.equal(await page.getByLabel('Page 1 review role').inputValue(),'pending');
 assert.equal(await page.getByLabel('Page 3 review role').inputValue(),'tic_page');
 assert.equal(await confirm.isDisabled(),true);
 assert.match(await page.getByTitle('Original packet page 3').getAttribute('src'),/#page=3$/);
 await page.getByRole('button',{name:'Include remaining recognized documents'}).click();
 assert.equal(await page.getByLabel('Page 5 review role').inputValue(),'check_stub');
 assert.equal(await page.getByLabel('Page 6 review role').inputValue(),'bank_statement');
 assert.equal(await confirm.isDisabled(),true);
 await page.getByRole('button',{name:'Omit detected covers and instructions'}).click();
 assert.equal(await confirm.isEnabled(),true);
 await confirm.click();
 let stored=JSON.parse(await page.getByTestId('saved').textContent());
 assert.deepEqual(stored.ticPages,[3,4]);assert.deepEqual(stored.supportingPages,[5,6]);assert.deepEqual(stored.omittedPages,[1,2]);
 await page.getByLabel('Page 5 review role').selectOption('omit');await confirm.click();
 stored=JSON.parse(await page.getByTestId('saved').textContent());assert.deepEqual(stored.supportingPages,[6]);
 await page.getByLabel('Page 5 omission reason').fill('');assert.equal(await confirm.isDisabled(),true);
 await page.getByLabel('Page 5 omission reason').fill('Unrelated payroll record');assert.equal(await confirm.isEnabled(),true);
 await page.getByLabel('Page 3 review role').selectOption('pending');assert.equal(await confirm.isDisabled(),true);
 await page.getByLabel('Page 3 review role').selectOption('tic_page');assert.equal(await confirm.isEnabled(),true);
 assert.deepEqual(pageErrors,[]);
 await page.screenshot({path:join(evidence,'synthetic-packet-organizer.png'),fullPage:true});
 writeFileSync(join(evidence,'result.json'),JSON.stringify({passed:true,scope:'Actual React organizer with synthetic packet, not authenticated upload/PDF rendering',checks:['pending default','TIC page focus','explicit inclusion','omission','source page preservation','blank reason blocks','reclassification blocks'],pageErrors},null,2));
 console.log('Organizer browser acceptance passed: pending -> include/omit -> selection; reclassification and missing reasons block confirmation.');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true});}
