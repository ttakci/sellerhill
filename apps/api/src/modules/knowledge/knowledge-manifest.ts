import { createHash } from 'crypto';
import { readFile, realpath, lstat } from 'fs/promises';
import { join, sep } from 'path';

export interface KnowledgeManifestItem { slug: string; locale: 'en'|'tr'; version: number; checksum: string; sourcePath: string }
export interface KnowledgeManifest { version: number; embeddingSpaceId: string; items: KnowledgeManifestItem[] }
export interface KnowledgeChunk { ordinal: number; headingPath: string|null; content: string; tokenCount: number; contentHash: string }

const hash=(s:string):string=>createHash('sha256').update(s).digest('hex');
export async function loadKnowledgeManifest(root:string):Promise<{manifest:KnowledgeManifest, files: Map<string,string>}>{
 const raw=JSON.parse(await readFile(join(root,'manifest.json'),'utf8')) as KnowledgeManifest;
 if(raw.version!==1||!raw.embeddingSpaceId||!Array.isArray(raw.items)||raw.items.length!==36) {throw new Error('manifest_invalid');}
 const files=new Map<string,string>(); const seen=new Set<string>();
 for(const item of raw.items){ if(!['en','tr'].includes(item.locale)||!/^[-a-z0-9]+$/.test(item.slug)||!/^\d+$/.test(String(item.version))||seen.has(item.sourcePath)) {throw new Error('manifest_invalid');} seen.add(item.sourcePath); const p=join(root,item.sourcePath); const rp=await realpath(p); if(!rp.startsWith(root+sep)|| (await lstat(p)).isSymbolicLink()) {throw new Error('path_not_allowed');} const text=await readFile(p,'utf8'); if(hash(text)!==item.checksum) {throw new Error('checksum_mismatch');} const fm=/^---\n([\s\S]*?)\n---\n/.exec(text); if(!fm||!fm[1].includes(`slug: ${item.slug}`)||!fm[1].includes(`locale: ${item.locale}`)) {throw new Error('frontmatter_invalid');} files.set(item.sourcePath,text); }
 for(const slug of new Set(raw.items.map(i=>i.slug))) {for(const locale of ['en','tr'] as const) {if(!raw.items.some(i=>i.slug===slug&&i.locale===locale)) {throw new Error('locale_pair_missing');}}}
 return {manifest:raw,files};
}
export function chunkKnowledge(markdown:string,maxTokens=500):KnowledgeChunk[]{ const lines=markdown.split(/\r?\n/); let heading:string[]=[]; let buf:string[]=[]; const out:KnowledgeChunk[]=[]; const flush=()=>{const content=buf.join('\n').trim(); if(!content){return;} const words=content.split(/\s+/).filter(Boolean); const emit=(part:string[])=>{const value=part.join(' '); out.push({ordinal:out.length,headingPath:heading.join(' > ')||null,content:value,tokenCount:part.length,contentHash:hash((heading.join(' > ')+'\n'+value))});}; for(let i=0;i<words.length;i+=maxTokens){emit(words.slice(i,i+maxTokens));} buf=[]}; for(const line of lines){const h=/^(#{1,6})\s+(.+)$/.exec(line); if(h){flush(); heading=heading.slice(0,h[1].length-1); heading.push(h[2].trim()); continue;} buf.push(line); if(buf.join(' ').split(/\s+/).filter(Boolean).length>=maxTokens){flush();}} flush(); return out; }
