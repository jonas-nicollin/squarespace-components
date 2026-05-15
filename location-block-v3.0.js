/*!
 * Location Block v3.0
 * github.com/jonas-nicollin/squarespace-blocks
 *
 * Affiche les informations d'un lieu (adresse, horaires, contacts, carte)
 * sur une page Squarespace. Le lieu est identifié par un tag "Lieu:"
 * sur le post courant.
 *
 * SOURCES : 'sheetbest' | 'json' | 'csv' | 'inline'
 * FUSEAU  : lu depuis les Settings Squarespace (Static.SQUARESPACE_CONTEXT)
 *           ou défini manuellement via timeZone:'Europe/Paris'
 *
 * CONFIGURATION MINIMALE :
 *   window.LOCATION_BLOCK_CONFIG = {
 *     dataSource: 'sheetbest',
 *     jsonUrl: 'https://api.sheetbest.com/sheets/VOTRE_UUID',
 *   };
 */
(function(){
'use strict';

/* ── Fuseau horaire — lecture depuis Squarespace ── */
function detectTZ(){
  if(cfg.timeZone) return cfg.timeZone;
  try{var s=window.Static&&window.Static.SQUARESPACE_CONTEXT;if(s&&s.websiteTimeZone)return s.websiteTimeZone;}catch(_){}
  return 'UTC';
}

/* ── Config ── */
var FOUR_HOURS=4*60*60*1000;
var cfg=Object.assign({
  dataSource:'json', jsonUrl:'', csvUrl:'', lieuxData:null,
  timeZone:'',
  noCache:false, cacheTTL:FOUR_HOURS,
  showMap:true, showMapLink:true, showStatus:true,
  showSocialLinks:false, collapseHours:true, useFetchForSlug:true,
},window.LOCATION_BLOCK_CONFIG||{});

/* ── Constantes jours ── */
var DAY_KEYS=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
var DAY_FULL={lundi:'Lundi',mardi:'Mardi',mercredi:'Mercredi',jeudi:'Jeudi',vendredi:'Vendredi',samedi:'Samedi',dimanche:'Dimanche'};
var EN_FR={monday:'lundi',tuesday:'mardi',wednesday:'mercredi',thursday:'jeudi',friday:'vendredi',saturday:'samedi',sunday:'dimanche'};

/* ── Utilitaires ── */
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function toSlug(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function normUrl(url){var v=String(url||'').trim();if(!v||v==='-')return'';return/^https?:\/\//i.test(v)?v:'https://'+v;}
function telHref(p){var d=String(p||'').replace(/[^\d+]/g,'');if(!d)return'';if(d.startsWith('+'))return'tel:'+d;if(d.startsWith('0')&&d.length>=9)return'tel:+41'+d.slice(1);return'tel:'+d;}

/* ── Image srcset ── */
var SW=[300,500,750,1000,1500];
function buildImgTag(lieu){
  if(!lieu.image)return'';
  var c=lieu.image.split('?')[0];
  var srcset=SW.map(function(w){return c+'?format='+w+'w '+w+'w';}).join(', ');
  var pos=lieu.imagePosition||'50% 50%';
  return'<img class="location-card__image" src="'+escHtml(c)+'?format=750w" srcset="'+escHtml(srcset)+'" sizes="(max-width:768px) 100vw, 380px" loading="lazy" decoding="async" alt="'+escHtml(lieu.title)+'" style="object-position:'+escHtml(pos)+';">';
}

/* ── Temps — fuseau dynamique ── */
function getNow(){
  var tz=detectTZ();
  var fmt=new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  var parts={};fmt.formatToParts(new Date()).forEach(function(p){if(p.type!=='literal')parts[p.type]=p.value;});
  return{dayKey:EN_FR[(parts.weekday||'').toLowerCase()]||'lundi',nowMinutes:parseInt(parts.hour||'0',10)*60+parseInt(parts.minute||'0',10)};
}
function toMin(v){var r=String(v||'').trim().toLowerCase().replace(/\s/g,'').replace(/h/g,':');var m=r.match(/^(\d{1,2})(?::(\d{2}))?$/);if(!m)return null;var h=parseInt(m[1],10),mn=parseInt(m[2]||'0',10);return(h>23||mn>59)?null:h*60+mn;}
function parseSched(raw){
  var v=String(raw||'').trim();
  if(!v||/^[-–—]$/.test(v)||/^fermé$/i.test(v))return{type:'closed',label:'Fermé'};
  if(/^sur rendez-vous$/i.test(v))return{type:'special',label:v};
  var n=v.replace(/[–—]/g,'-').replace(/\s*à\s*/gi,'-').replace(/\s*,\s*/g,',').trim();
  var ranges=[],parts=n.split(',').map(function(s){return s.trim();}).filter(Boolean);
  for(var i=0;i<parts.length;i++){var m=parts[i].match(/^([^-]+)-(.+)$/);if(!m)return{type:'special',label:v};var s=toMin(m[1]),e=toMin(m[2]);if(s===null||e===null)return{type:'special',label:v};ranges.push({start:s,end:e});}
  return ranges.length?{type:'ranges',label:v,ranges:ranges}:{type:'special',label:v};
}
function isOpen(sched,now){if(!sched||sched.type!=='ranges')return false;return sched.ranges.some(function(r){return now>=r.start&&now<r.end;});}

/* ── Parse CSV ── */
function parseCSV(text){
  var lines=text.split(/\r?\n/);if(!lines.length)return[];
  var headers=splitLine(lines[0]).map(function(h){return h.trim();});
  return lines.slice(1).filter(function(l){return l.trim();}).map(function(l){var o={};splitLine(l).forEach(function(v,i){o[headers[i]!==undefined?headers[i]:i]=v.trim();});return o;});
}
function splitLine(line){var r=[],c='',q=false;for(var i=0;i<line.length;i++){var ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}else if(ch===','&&!q){r.push(c);c='';}else c+=ch;}r.push(c);return r;}

/* ── Normalisation ── */
function normLieu(row){
  var title=row.title||row['Lieu']||'';
  var a1=row.address1||row['Adresse']||'';
  var pc=row.postalCode||row['Code postal']||'';
  var city=row.city||row['Ville']||'';
  var a2=row.address2||[pc,city].filter(Boolean).join(' ');
  return{
    slug:row.slug||toSlug(title), title:title,
    address1:a1, address2:a2, address3:row.address3||'Suisse',
    mapUrl:row.mapUrl||row['Lien: Google Maps']||'',
    phone:row.phone||row['Téléphone']||'',
    email:row.email||row['Adresse électronique']||'',
    website:row.website||row['Site internet']||'',
    instagram:row.instagram||row['Instagram']||'',
    image:row.image||row['Image']||'',
    imagePosition:row.imagePosition||row['Image position']||'',
    lundi:row.lundi||row['Lundi']||'-',mardi:row.mardi||row['Mardi']||'-',
    mercredi:row.mercredi||row['Mercredi']||'-',jeudi:row.jeudi||row['Jeudi']||'-',
    vendredi:row.vendredi||row['Vendredi']||'-',samedi:row.samedi||row['Samedi']||'-',
    dimanche:row.dimanche||row['Dimanche']||'-',
  };
}

/* ── Cache ── */
var CK='location_block_v30',CKT='location_block_v30_ttl';
function cacheRead(){if(cfg.noCache||cfg.dataSource==='inline')return null;try{if(Date.now()>parseInt(localStorage.getItem(CKT)||'0',10))return null;var r=localStorage.getItem(CK);return r?JSON.parse(r):null;}catch(_){return null;}}
function cacheWrite(d){if(cfg.noCache||cfg.dataSource==='inline')return;try{localStorage.setItem(CK,JSON.stringify(d));localStorage.setItem(CKT,String(Date.now()+cfg.cacheTTL));}catch(_){}}

/* ── Fetch ── */
async function fetchLieux(){
  if(cfg.dataSource==='inline'&&Array.isArray(cfg.lieuxData)) return cfg.lieuxData.filter(function(r){return r.title||r['Lieu'];}).map(normLieu);
  var cached=cacheRead();if(cached)return cached;
  var lieux;
  if((cfg.dataSource==='json'||cfg.dataSource==='sheetbest')&&cfg.jsonUrl){
    var res=await fetch(cfg.jsonUrl,{cache:'no-store'});
    if(!res.ok)throw new Error('Location Block: JSON inaccessible ('+res.status+')');
    var data=await res.json();
    var rows=Array.isArray(data)?data:(data.lieux||data.result||[]);
    lieux=rows.filter(function(r){return r.title||r['Lieu'];}).map(normLieu);
  }else if(cfg.dataSource==='csv'&&cfg.csvUrl){
    var res2=await fetch(cfg.csvUrl,{cache:'no-store'});
    if(!res2.ok)throw new Error('Location Block: CSV inaccessible ('+res2.status+')');
    lieux=parseCSV(await res2.text()).filter(function(r){return r['Lieu']&&r['Lieu'].trim();}).map(normLieu);
  }else{throw new Error('Location Block: dataSource mal configuré');}
  cacheWrite(lieux);return lieux;
}

/* ── Slug depuis les tags ── */
function getSlugFromMeta(){
  var meta=document.querySelector('meta[name="location-block-slug"]');if(!meta)return null;
  var c=(meta.getAttribute('content')||'').trim();if(!c)return null;
  if(/^[a-z0-9-]+$/.test(c))return c;
  var m=c.match(/Lieu:\s*(.+)/i);return m?toSlug(m[1].trim()):toSlug(c);
}
async function getSlugFromFetch(){
  if(!cfg.useFetchForSlug)return null;
  try{var res=await fetch(window.location.pathname+'?format=json',{cache:'no-store'});if(!res.ok)return null;var json=await res.json();var tags=(json.item&&json.item.tags)||json.tags||[];var t=tags.find(function(t){return String(t).startsWith('Lieu:');});return t?toSlug(t.replace(/^Lieu:\s*/i,'').trim()):null;}catch(_){return null;}
}
async function getSlug(card){if(card.dataset.locationSlug)return card.dataset.locationSlug.trim();var m=getSlugFromMeta();if(m)return m;return getSlugFromFetch();}

/* ── HTML horaires ── */
function buildHours(lieu,now){
  var dk=now.dayKey,nm=now.nowMinutes;
  var ti=DAY_KEYS.indexOf(dk);
  var ordered=[DAY_KEYS[ti]].concat(DAY_KEYS.slice(0,ti)).concat(DAY_KEYS.slice(ti+1));
  var rows=ordered.map(function(day){
    var isT=day===dk;
    var sched=parseSched(lieu[day]||'-');
    var dv=sched.type==='closed'?'Fermé':sched.label;
    var open=isT&&cfg.showStatus?isOpen(sched,nm):null;
    var st=(isT&&cfg.showStatus&&sched.type!=='special')?'<span class="location-card__status '+(open?'is-open':'is-closed')+'">'+(open?'Ouvert':'Fermé')+'</span>':'';
    var hc=(!isT&&cfg.collapseHours)?' is-hidden':'';
    return'<div class="location-card__hours-row'+(isT?' is-today':'')+hc+'"><span class="location-card__hours-day">'+escHtml(DAY_FULL[day])+'</span><span class="location-card__hours-value">'+escHtml(dv)+st+'</span></div>';
  });
  var toggle=cfg.collapseHours?'<button class="location-card__hours-toggle" type="button" aria-expanded="false"><span class="location-card__hours-toggle-label">Tous les horaires</span><span class="ui-icon" aria-hidden="true">expand_more</span></button>':'';
  return'<div class="location-card__hours-panel">'+rows.join('')+toggle+'</div>';
}

/* ── HTML carte ── */
function buildMap(lieu){
  var q=encodeURIComponent(lieu.title+', '+[lieu.address1,lieu.address2,lieu.address3].filter(Boolean).join(', '));
  return'<div class="location-card__map"><iframe class="location-card__map-iframe" src="https://maps.google.com/maps?q='+q+'&output=embed&hl=fr&z=14&iwloc=B" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Carte \u2014 '+escHtml(lieu.title)+'"></iframe></div>';
}

/* ── HTML card ── */
function buildCard(lieu){
  var now=getNow();
  var imgTag=buildImgTag(lieu);
  var titleHtml=lieu.title?'<div class="location-card__title">'+escHtml(lieu.title)+'</div>':'';
  var mediaHtml=imgTag?'<div class="location-card__media">'+imgTag+titleHtml+'</div>':'';
  var addr=[lieu.address1,lieu.address2,lieu.address3].filter(Boolean).map(escHtml).join('<br>');
  var addrHtml=lieu.mapUrl?'<a class="location-card__address-link" href="'+escHtml(lieu.mapUrl)+'" target="_blank" rel="noopener noreferrer">'+addr+'</a>':'<div class="location-card__address">'+addr+'</div>';
  var ph=telHref(lieu.phone);
  var phoneHtml=(lieu.phone&&ph)?'<div class="location-card__contact-line"><a href="'+escHtml(ph)+'">'+escHtml(lieu.phone)+'</a></div>':'';
  var emailHtml=lieu.email?'<div class="location-card__contact-line"><a href="mailto:'+escHtml(lieu.email)+'">'+escHtml(lieu.email)+'</a></div>':'';
  var wu=normUrl(lieu.website);
  var websiteHtml=wu?'<div class="location-card__contact-line"><a href="'+escHtml(wu)+'" target="_blank" rel="noopener noreferrer">'+escHtml(lieu.website)+'</a></div>':'';
  var igu=lieu.instagram?'https://instagram.com/'+lieu.instagram.replace(/^@/,''):'';
  var igHtml=(cfg.showSocialLinks&&igu)?'<div class="location-card__contact-line"><a href="'+escHtml(igu)+'" target="_blank" rel="noopener noreferrer">@'+escHtml(lieu.instagram.replace(/^@/,''))+'</a></div>':'';
  var hasContact=lieu.phone||lieu.email||lieu.website||(cfg.showSocialLinks&&lieu.instagram);
  var mapLink=(cfg.showMapLink&&lieu.mapUrl)?'<div class="location-card__maplink-wrap"><a class="location-card__maplink" href="'+escHtml(lieu.mapUrl)+'" target="_blank" rel="noopener noreferrer"><span>Voir sur la carte</span><span class="ui-icon" aria-hidden="true">chevron_right</span></a></div>':'';
  return'<article class="location-card__inner">'+mediaHtml+'<div class="location-card__body"><div class="location-card__section"><span class="ui-icon" aria-hidden="true">location_on</span><div class="location-card__content">'+addrHtml+'</div></div><div class="location-card__section"><span class="ui-icon" aria-hidden="true">schedule</span><div class="location-card__content">'+buildHours(lieu,now)+'</div></div>'+(hasContact?'<div class="location-card__section"><span class="ui-icon" aria-hidden="true">contact_page</span><div class="location-card__content">'+phoneHtml+emailHtml+websiteHtml+igHtml+'</div></div>':'')+mapLink+'</div>'+(cfg.showMap?buildMap(lieu):'')+' </article>';
}

/* ── Toggle horaires ── */
function bindToggle(card){
  var t=card.querySelector('.location-card__hours-toggle');if(!t)return;
  var p=card.querySelector('.location-card__hours-panel');if(!p)return;
  t.addEventListener('click',function(){var n=t.getAttribute('aria-expanded')!=='true';t.setAttribute('aria-expanded',String(n));p.querySelectorAll('.location-card__hours-row.is-hidden,.location-card__hours-row.is-visible').forEach(function(r){r.classList.toggle('is-hidden',!n);r.classList.toggle('is-visible',n);});});
}

/* ── Fallback image SQS ── */
function isEdit(){return document.documentElement.classList.contains('squarespace-edit-mode-active')||document.body.classList.contains('squarespace-edit-mode-active');}
function findImgBlock(card){var b=card.closest('.sqs-block');if(!b)return null;var sel='.image-block img,.sqs-block-image img';for(var p=b.previousElementSibling;p;p=p.previousElementSibling){if(p.querySelector(sel)){if(!isEdit())p.style.display='none';return p;}}return null;}
function getImgSrc(block){if(!block)return'';var img=block.querySelector('.image-block img,.sqs-block-image img');return img?(img.currentSrc||img.src||img.dataset.src||''):'';}

/* ── Rendu ── */
async function renderCard(card,lieux){
  var slug=await getSlug(card);
  var lieu=slug?lieux.find(function(l){return l.slug===slug;})||null:null;
  if(!lieu){console.warn('Location Block v3.0: lieu introuvable',{slug:slug});card.innerHTML='<p class="location-card__error">Lieu introuvable.</p>';return;}
  if(!lieu.image){var ib=findImgBlock(card);if(ib)lieu.image=getImgSrc(ib);}
  card.innerHTML=buildCard(lieu);
  bindToggle(card);
}

/* ── Init ── */
async function init(){
  var cards=Array.from(document.querySelectorAll('.location-card'));if(!cards.length)return;
  var lieux;
  try{lieux=await fetchLieux();}
  catch(err){console.error('Location Block v3.0:',err);cards.forEach(function(c){c.innerHTML='<p class="location-card__error">Impossible de charger les informations du lieu.</p>';});return;}
  await Promise.all(cards.map(function(c){return renderCard(c,lieux);}));
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

})();
