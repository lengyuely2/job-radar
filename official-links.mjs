import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import https from 'node:https';
import http from 'node:http';

const platforms=['linkedin.com','indeed.com','glassdoor.com','ziprecruiter.com','bebee.com','talent.com','learn4good.com','dice.com','monster.com','tealhq.com','simplify.jobs','welcometothejungle.com','joinhandshake.com','jobleads.com','lensa.com','trabajo.org','haystackapp.io','jooble.org','adzuna.com','careerjet.com','jobrapido.com','recruit.net','google.com','bing.com','yahoo.com'];
const atsHosts=['boards.greenhouse.io','job-boards.greenhouse.io','jobs.lever.co','jobs.eu.lever.co','jobs.ashbyhq.com','jobs.jobvite.com','jobs.smartrecruiters.com','apply.workable.com'];
export function safePublicURL(value){
  try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port&&u.port!==(u.protocol==='https:'?'443':'80')||u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local')||isIP(u.hostname.replace(/[\[\]]/g,'')))return '';return u.href;}catch{return '';}
}
export function isPlatform(value){try{const host=new URL(value).hostname.toLowerCase();return platforms.some(d=>host===d||host.endsWith('.'+d))||/^www\d*\.builtin|^builtin/.test(host);}catch{return true;}}
export function isATS(value){try{const host=new URL(value).hostname;return atsHosts.includes(host)||host.endsWith('.myworkdayjobs.com');}catch{return false;}}
function publicAddress(address){
  if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51)||a===203&&b===0);}
  return isIP(address)===6&&/^2[0-9a-f]{3}:/i.test(address)&&!/^2001:(?:db8|0|2):/i.test(address)&&!/^2002:/i.test(address);
}
export async function publicFetch(value,{timeout=8000,maxBytes=2500000}={}){
  let url=safePublicURL(value);if(!url)throw new Error('不允许访问非公开链接');
  const deadline=Date.now()+timeout;
  for(let redirects=0;redirects<5;redirects++){
    const u=new URL(url);
    const addresses=await Promise.race([lookup(u.hostname,{all:true}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error('域名解析超时')),Math.max(1,deadline-Date.now()));t.unref();})]);
    if(!addresses.length||addresses.some(x=>!publicAddress(x.address)))throw new Error('拒绝访问内网地址');
    const chosen=addresses.find(x=>x.family===4)||addresses[0];
    const response=await new Promise((resolve,reject)=>{
      const req=(u.protocol==='https:'?https:http).request(u,{method:'GET',headers:{'User-Agent':'JobRadarLocal/1.1 (public job link verification)','Accept':'text/html,application/json,application/rss+xml','Accept-Encoding':'identity'},lookup:(_host,options,callback)=>options.all?callback(null,[chosen]):callback(null,chosen.address,chosen.family)},res=>{
        if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();resolve({redirect:res.headers.location});return;}
        let size=0;const parts=[];res.on('data',part=>{size+=part.length;if(size>maxBytes){res.destroy(new Error('页面过大'));return;}parts.push(part);});res.on('error',reject);res.on('end',()=>resolve({url,status:res.statusCode,type:res.headers['content-type']||'',text:Buffer.concat(parts).toString('utf8')}));
      });const timer=setTimeout(()=>req.destroy(new Error('页面超时')),Math.max(1,deadline-Date.now()));timer.unref();req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
    });
    if(!response.redirect)return response;
    url=safePublicURL(new URL(response.redirect,url).href);if(!url)throw new Error('重定向地址不安全');if(Date.now()>deadline)throw new Error('页面超时');
  }
  throw new Error('重定向过多');
}
export function decodeHTML(value){return String(value||'').replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[\da-f]+|\d+);/gi,s=>{const names={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '};if(names[s.toLowerCase()])return names[s.toLowerCase()];const n=s[2].toLowerCase()==='x'?parseInt(s.slice(3,-1),16):Number(s.slice(2,-1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});}
function plain(value){return decodeHTML(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
function visibleText(html){return plain(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,''));}
function words(value){return plain(value).toLowerCase().replace(/c\s*\+\s*\+/g,'cplusplus').replace(/c\s*#/g,'csharp').replace(/\bsr\.?\b/g,'senior').replace(/\bjr\.?\b/g,'junior').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);}
function companyKey(value){return words(value).filter(x=>!['inc','llc','ltd','corporation','corp','company','co','limited','the'].includes(x)&&!/^\d+$/.test(x)).join('');}
export function companyMatches(a,b){const x=companyKey(a),y=companyKey(b);return x.length>=3&&x===y;}
function titleWords(title,job){const drop=new Set([...words(job.company),...words(job.location),...words('remote anywhere united states us usa handshake')]);return words(title.split(/\|\s*(?:[^|]*Handshake)/i)[0]).filter(x=>!drop.has(x));}
export function titleMatches(job,title){const a=titleWords(job.title,job).sort(),b=titleWords(title,job).sort();return a.length>=2&&a.join(' ')===b.join(' ');}
const regions={ca:'california',ma:'massachusetts',ny:'new york',nc:'north carolina',va:'virginia',mn:'minnesota',il:'illinois',tx:'texas',nh:'new hampshire',md:'maryland',co:'colorado',wa:'washington',fl:'florida',al:'alabama',de:'delaware',vt:'vermont'};
function locationWords(value){return words(value).flatMap(x=>regions[x]?words(regions[x]):[x]).filter(x=>!['united','states','us','usa','other','locations','location'].includes(x)&&!/^\d+$/.test(x));}
export function locationMatches(job,location,remote=false){
  if(/anywhere|remote|united states/i.test(job.location)&&locationWords(job.location).filter(x=>!['anywhere','remote'].includes(x)).length===0)return /united states|usa|\bus\b|u\.s\./i.test(location);
  const a=locationWords(job.location),b=locationWords(location);return a.length>0&&b.length>0&&a.every(x=>b.includes(x));
}
export function extractLinks(html,base){const links=[];for(const m of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)){try{const url=safePublicURL(new URL(decodeHTML(m[1]),base).href);if(url)links.push(url);}catch{}}return [...new Set(links)];}
export function jobPostings(html){const found=[];function walk(value){if(!value||typeof value!=='object')return;if([value['@type']].flat().some(x=>x==='JobPosting'))found.push(value);for(const child of Object.values(value))if(child&&typeof child==='object')Array.isArray(child)?child.forEach(walk):walk(child);}
  for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{try{walk(JSON.parse(decodeHTML(m[1])));}catch{}}}return found;
}
function structuredLocation(p){return [p.jobLocation].flat().filter(Boolean).map(x=>{const a=x.address||{};return [a.addressLocality,a.addressRegion,a.addressCountry].filter(Boolean).join(', ');}).join('; ');}
function trustedHost(url,job){
  if(isPlatform(url))return false;if(isATS(url))return true;
  const host=new URL(url).hostname.replace(/^www\./,'');const employer=safePublicURL(job.employerWebsite);
  if(employer&&!isPlatform(employer)){const h=new URL(employer).hostname.replace(/^www\./,'');if(host===h||host.endsWith('.'+h))return true;}
  const brand=companyKey(job.company),parts=host.split('.');const domainPart=/\.(?:co\.uk|com\.au|com\.cn|co\.jp|co\.nz|co\.in)$/.test(host)?parts.at(-3):parts.at(-2);
  return brand.length>=5&&domainPart?.replace(/(?:careers|jobs)$/,'')===brand;
}
function specificJobURL(value){const u=new URL(value),path=u.pathname;return /\/jobs?\/[^/]+|\/job-detail\/|\/[a-f\d-]{30,}|\/posting\/|\/position\//i.test(path)||isATS(value)&&path.split('/').filter(Boolean).length>=2&&!/\/(?:jobs|search)\/?$/.test(path)||/^\d+$/.test(u.searchParams.get('gh_jid')||'');}
export function verifyStructuredPage(job,page){
  if(page.status!==200||!trustedHost(page.url,job))return null;
  if(/(?:this|the) (?:job|position|posting) (?:is|has been) (?:no longer available|closed|filled|expired)|no longer accepting applications|job (?:not found|has expired)/i.test(visibleText(page.text)))return {expired:true};
  if(!specificJobURL(page.url))return null;
  for(const p of jobPostings(page.text)){
    const company=typeof p.hiringOrganization==='string'?p.hiringOrganization:p.hiringOrganization?.name;
    const title=p.title||p.name,location=structuredLocation(p);
    const countries=[p.jobLocation].flat().filter(Boolean).map(x=>x.address?.addressCountry).filter(Boolean).map(x=>typeof x==='object'?x.name:x);
    if(countries.length&&!countries.some(x=>/^(us|usa|united states(?: of america)?|u\.s\.)$/i.test(x)))continue;
    const locations=[p.jobLocation].flat().filter(Boolean).map(x=>{const a=x.address||{};return [a.addressLocality,a.addressRegion,a.addressCountry].filter(Boolean).join(', ');});
    if(!companyMatches(job.company,company)||!titleMatches(job,title)||!locations.some(x=>locationMatches(job,x,p.jobLocationType==='TELECOMMUTE')))continue;
    if(p.validThrough&&Number.isFinite(Date.parse(p.validThrough))&&Date.parse(p.validThrough)<Date.now())return {expired:true};
    const id=typeof p.identifier==='object'?String(p.identifier.value||''):typeof p.identifier==='string'?p.identifier:'';
    return {url:page.url,title,company,location,postingId:id,postedAt:p.datePosted&&Number.isFinite(Date.parse(p.datePosted))?new Date(p.datePosted).toISOString():null,evidence:'岗位页 JobPosting 结构化数据：公司、职位名、地点一致',evidenceURL:page.url};
  }return null;
}
export function migrateJob(job){
  job.sourceUrl=job.sourceUrl||job.options?.find(x=>x.publisher===job.source)?.url||job.url||'';
  job.officialUrl=job.officialUrl||'';
  job.linkStatus=job.linkStatus||'unverified';
  job.linkNote=job.linkNote||'官网岗位尚未核验；原始链接只作为来源线索。';
  job.officialSearchUrl='https://www.bing.com/search?'+new URLSearchParams({q:`"${job.company}" "${job.title}" careers`});
  return job;
}
export function createResolver({fetchPage=publicFetch,maxRequests=160,duration=75000}={}){
  const cache=new Map();let count=0;const deadline=Date.now()+duration;
  const get=async url=>{url=safePublicURL(url);if(!url)return null;if(cache.has(url))return cache.get(url);if(count>=maxRequests||Date.now()>deadline)return null;count++;const p=fetchPage(url,{timeout:Math.min(7000,deadline-Date.now())}).catch(()=>null);cache.set(url,p);return p;};
  const search=async query=>{const p=await get('https://www.bing.com/search?'+new URLSearchParams({format:'rss',q:query}));if(!p||p.status!==200)return [];return [...p.text.matchAll(/<item>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/g)].map(x=>safePublicURL(decodeHTML(x[1]))).filter(Boolean);};
  async function resolve(job){
    migrateJob(job);let closed=false,attempts=0;const candidates=[],visited=new Set(),boards=new Map(),linkedBoards=new Set();
    const offer=url=>{url=safePublicURL(url);if(!url)return;const u=new URL(url);u.hash='';if(/\.(?:css|js|png|jpe?g|gif|svg|woff2?|pdf|ico)(?:$|\/)/i.test(u.pathname))return;url=u.href;if(!isPlatform(url)&&!candidates.includes(url)){candidates.push(url);if(isATS(url)){const slug=u.pathname.split('/').filter(Boolean)[0];if(slug)boards.set(u.hostname+'/'+slug,url);}}};
    for(const option of job.options||[])offer(option.url);offer(job.officialUrl);
    for(const u of (job.description||'').match(/https?:\/\/[^\s<>"']+/g)||[])offer(u);
    const check=async url=>{
      if(visited.has(url)||attempts>=18||Date.now()>deadline)return null;visited.add(url);attempts++;
      const page=await get(url);if(!page)return null;
      if((page.status===404||page.status===410)&&trustedHost(url,job)&&/\/jobs?\/|\/job\/|\/application\b/.test(new URL(url).pathname))closed=true;
      const verified=verifyStructuredPage(job,page);if(verified?.expired){closed=true;return null;}if(verified)return verified;
      if(page.status!==200)return null;
      const pageTrusted=trustedHost(page.url,job)&&!isATS(page.url);
      const matchingLinks=new Set();for(const anchor of page.text.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){if(titleMatches(job,plain(anchor[2]))){try{matchingLinks.add(new URL(decodeHTML(anchor[1]),page.url).href);}catch{}}}
      for(const next of extractLinks(page.text,page.url)){
        if(isPlatform(next))continue;
        if(isATS(next)){
          const u=new URL(next),slug=u.pathname.split('/').filter(Boolean)[0];
          if(pageTrusted)linkedBoards.add(u.hostname+'/'+slug);
          if(slug)boards.set(u.hostname+'/'+slug,next);
          if(u.pathname.split('/').filter(Boolean).length<=1||matchingLinks.has(next)||/\/(?:jobs|search)\/?$/.test(u.pathname))offer(next);
        }else if(pageTrusted&&trustedHost(next,job)&&/\/careers?\b|\/jobs?\b|\/opportunities\b/.test(new URL(next).pathname))offer(next);
      }return null;
    };
    const finish=verified=>{job.officialUrl=verified.url;job.url=verified.url;job.linkStatus='verified';job.linkNote=verified.evidence;job.linkCheckedAt=new Date().toISOString();job.officialEvidence=verified;job.officialPostedAt=verified.postedAt||null;return job;};
    for(const url of [...candidates]){const v=await check(url);if(v)return finish(v);}
    if(job.employerWebsite&&!isPlatform(job.employerWebsite))offer(job.employerWebsite);
    const results=await search(`"${job.company}" ${titleWords(job.title,job).join(' ').replace(/cplusplus/g,'C++').replace(/csharp/g,'C#')} careers`);for(const url of results)if(trustedHost(url,job)&&(isATS(url)||/\/careers?\b|\/jobs?\b/.test(new URL(url).pathname)))offer(url);
    // Broader search discovers the company's careers page; it never proves a job match.
    if(!candidates.length)for(const url of await search(`"${job.company}" careers`))if(trustedHost(url,job)&&(isATS(url)||/\/careers?\b|\/jobs?\b/.test(new URL(url).pathname)))offer(url);
    const matches=new Map();for(let i=0;i<candidates.length&&attempts<14;i++){const v=await check(candidates[i]);if(v)matches.set(v.postingId||v.url.split('?')[0],v);}
    if(matches.size===1)return finish([...matches.values()][0]);
    if(matches.size>1){job.officialUrl='';job.url=job.sourceUrl;job.linkStatus='unverified';job.linkNote='找到多个公司、职位和地点相同的官网岗位，无法确认来源对应哪一条；请人工核对岗位编号。';job.officialEvidence=null;job.officialPostedAt=null;job.linkCheckedAt=new Date().toISOString();return job;}
    for(const [key,value] of boards){
      if(attempts>=18||Date.now()>deadline)break;
      const u=new URL(value),slug=u.pathname.split('/').filter(Boolean)[0];let list=[],company='',kind='';
      if(['boards.greenhouse.io','job-boards.greenhouse.io'].includes(u.hostname)){
        const [board,page]=await Promise.all([get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}`),get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`)]);
        try{company=JSON.parse(board?.text||'{}').name;list=JSON.parse(page?.text||'{}').jobs||[];kind='Greenhouse';}catch{}
      }else if(u.hostname==='jobs.ashbyhq.com'&&linkedBoards.has(key)){
        const page=await get(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);try{list=(JSON.parse(page?.text||'{}').jobs||[]).filter(x=>x.isListed===true);company=job.company;kind='Ashby';}catch{}
      }else if(['jobs.lever.co','jobs.eu.lever.co'].includes(u.hostname)&&linkedBoards.has(key)){
        const page=await get(`https://${u.hostname==='jobs.eu.lever.co'?'api.eu.lever.co':'api.lever.co'}/v0/postings/${encodeURIComponent(slug)}?mode=json`);try{list=JSON.parse(page?.text||'[]');company=job.company;kind='Lever';}catch{}
      }
      if(!companyMatches(job.company,company)||!Array.isArray(list))continue;
      const matching=list.filter(x=>titleMatches(job,x.title||x.text)&&locationMatches(job,x.location?.name||x.location||x.categories?.location||'',x.isRemote===true||x.workplaceType==='remote'||x.workplaceType==='Remote'));
      if(matching.length!==1)continue;const x=matching[0],url=safePublicURL(x.absolute_url||x.jobUrl||x.hostedUrl);
      if(!url||!trustedHost(url,job))continue;
      const page=await get(url);if(!page||page.status!==200||!trustedHost(page.url,job)||!specificJobURL(page.url))continue;
      if(verifyStructuredPage(job,page)?.expired){closed=true;continue;}
      return finish({url:page.url,title:x.title||x.text,company,location:x.location?.name||x.location||x.categories?.location,postingId:String(x.id||''),postedAt:kind==='Ashby'&&Number.isFinite(Date.parse(x.publishedAt))?new Date(x.publishedAt).toISOString():null,evidence:`${kind} 当前公开岗位列表：公司、职位名、地点一致，且只有一个匹配项`,evidenceURL:kind==='Greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`:page.url});
    }
    job.officialUrl='';job.officialPostedAt=null;job.officialEvidence=null;job.url=job.sourceUrl;job.linkCheckedAt=new Date().toISOString();job.linkStatus=closed?'closed':'unverified';job.linkNote=closed?'原官网链接返回已下架/过期信号，未找到可确认的替代岗位。':'未能核实同一公司、职位及地点的官网岗位。可能未找到、访问受限或存在多个相似岗位；来源页仅作为线索。';
    return job;
  }
  return {resolve,get requestCount(){return count;}};
}
export async function resolveJobs(jobs,options={}){const resolver=createResolver(options);let next=0;await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(next<jobs.length)await resolver.resolve(jobs[next++]);}));return jobs;}
