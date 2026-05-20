/*!
 * Locator Block v2.4
 * github.com/jonas-nicollin/squarespace-blocks
 *
 * CONFIGURATION (window.LOCATOR_BLOCK_CONFIG)
 * SOURCE : collectionUrl, category, tagNumero, tagLieu, tagZone
 * DISPLAY: layout, display.{showImage,showTitle,showNumero,showLieu,showZones,imageInMedia,lieuIcon,pageSize}
 * CARTE  : apiKey, mapCenter, mapZoom, mapZoomOnSelect, mapStyle, mapOptions
 *          map.{markerLabel,markerStyle,markerFontSize,markerShadow,
 *               popup,popupShowImage,
 *               clustering,clusterMinCount,
 *               updateListOnMapMove}  ← IMPORTANT: doit être dans map:{}, pas à la racine
 * UI     : openInNewTab, showCardLink, showZoneFilter, sortBy
 * CSS    : customClass (classe CSS ajoutée sur .locator-block__inner pour CSS spécifique par site)
 * PERF   : rootSelector, noCache, cacheTTL, debug
 */
(function(){
'use strict';

/* clean : désactive tous les POI (restaurants, commerces, icônes).
   IMPORTANT: mapStyle: clean  →  sans guillemets (variable JS)
              mapStyle: 'clean' → guillemets = chaîne invalide, Google ignore */
var clean=[
  /* Tous les POI off — restaurants, commerces, loisirs, etc. */
  {featureType:'poi',stylers:[{visibility:'off'}]},
  /* Parcs : garder la géométrie, supprimer les icônes */
  {featureType:'poi.park',elementType:'geometry',stylers:[{visibility:'on'}]},
  {featureType:'poi.park',elementType:'labels',stylers:[{visibility:'off'}]},
  /* Transport : icônes off */
  {featureType:'transit',elementType:'labels.icon',stylers:[{visibility:'off'}]},
  {featureType:'transit.station',elementType:'labels.text',stylers:[{visibility:'off'}]},
  /* Routes : icônes de direction off */
  {featureType:'road',elementType:'labels.icon',stylers:[{visibility:'off'}]},
  /* Quartiers : labels off (trop de bruit) */
  {featureType:'administrative.neighborhood',stylers:[{visibility:'off'}]},
  {featureType:'administrative.land_parcel',stylers:[{visibility:'off'}]},
];

var cfg=Object.assign({
  collectionUrl:'',category:'',tagNumero:'Numéro',tagLieu:'Lieu',tagZone:'Zone',
  layout:'list',display:{},apiKey:'',mapCenter:null,mapZoom:null,
  mapZoomOnSelect:16,mapStyle:null,mapOptions:{},map:{},
  openInNewTab:false,showCardLink:true,showZoneFilter:true,sortBy:'numero',
  customClass:'',
  rootSelector:'.locator-block',noCache:false,cacheTTL:600000,debug:false,
},window.LOCATOR_BLOCK_CONFIG||{});

/* display — même modèle que Related Block / Query Block.
   groups définit la construction des cards (media + body).
   Chaque group a une className et des children.
   Par défaut : media avec image seule, body avec tous les champs texte.
   Surcharger dans window.LOCATOR_BLOCK_CONFIG.display. */
cfg.display=Object.assign({
  /* Éléments à afficher (utilisés par les groups par défaut) */
  showImage:   true,
  showTitle:   true,
  showNumero:  true,
  showLieu:    true,
  showZones:   false,
  lieuIcon:    'location_on',
  showCount:   true,           /* afficher le compteur d'items */
  pageSize:    0,              /* 0 = tout afficher sans pagination */
  /* groups : définit la construction des cards.
     null = comportement par défaut (media:image, body:numero+title+lieu+zones)
     Voir exemple dans la config PCC pour la construction spécifique. */
  groups: null,
},cfg.display||{});

cfg.map=Object.assign({
  markerLabel:'numero',markerStyle:'pill',
  markerFontSize:13,      /* px — taille du label dans le marqueur SVG */
  markerShadow:true,      /* ombre portée sous les marqueurs */
  popup:true,popupShowImage:true,
  clustering:false,clusterMinCount:2,updateListOnMapMove:false,
},cfg.map||{});

cfg.openInNewTab=!!cfg.openInNewTab;
cfg.showCardLink=cfg.showCardLink!==false;

function log(){if(cfg.debug)console.log.apply(console,['[LocatorBlock]'].concat(Array.prototype.slice.call(arguments)));}

/* ── Utilitaires ── */
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function tagRe(p){return new RegExp('^'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':\\s*','i');}
function getTag(tags,p){if(!Array.isArray(tags))return'';var re=tagRe(p),t=tags.find(function(x){return re.test(String(x));});return t?String(t).replace(re,'').trim():'';}
function getTags(tags,p){if(!Array.isArray(tags))return[];var re=tagRe(p);return tags.filter(function(x){return re.test(String(x));}).map(function(x){return String(x).replace(re,'').trim();});}

/* ── Image srcset ── */
var SW=[300,500,750,1000,1500];
function buildSrcset(b){return SW.map(function(w){return b+'?format='+w+'w '+w+'w';}).join(', ');}
function getImgBase(item){return(item.assetUrl||item.thumbnailUrl||item.mainImageUrl||(item.media&&item.media[0]&&item.media[0].url)||'').split('?')[0];}
function imgTag(base,alt,cls,sizes){if(!base)return'';return'<img class="'+escHtml(cls)+'" src="'+escHtml(base+'?format=750w')+'" srcset="'+escHtml(buildSrcset(base))+'" sizes="'+escHtml(sizes||'(max-width:768px) 100vw, 400px')+'" alt="'+escHtml(alt)+'" loading="lazy" decoding="async">';}

/* ── Coordonnées ── */
function getCoords(loc){loc=loc||{};return{lat:parseFloat(loc.mapLat||loc.markerLat||''),lng:parseFloat(loc.mapLng||loc.markerLng||'')};}

/* ── Cache localStorage ── */
var CK='locator_block_v18',CKT='locator_block_v18_ttl';
function cacheRead(){if(cfg.noCache)return null;try{if(Date.now()>parseInt(localStorage.getItem(CKT)||'0',10))return null;var r=localStorage.getItem(CK);return r?JSON.parse(r):null;}catch(_){return null;}}
function cacheWrite(d){if(cfg.noCache)return;try{localStorage.setItem(CK,JSON.stringify(d));localStorage.setItem(CKT,String(Date.now()+cfg.cacheTTL));}catch(_){}}

/* ── Fetch SQS + pagination timestamp ── */
async function fetchItems(){
  var cached=cacheRead();if(cached){log('Cache:',cached.length);return cached;}
  if(!cfg.collectionUrl)throw new Error('collectionUrl manquant');
  var all=[],nextOffset=null,pc=0;
  while(pc<10){
    var url=cfg.collectionUrl+'?format=json'+(nextOffset!==null?'&offset='+nextOffset:'');
    log('GET',url);
    var res=await fetch(url,{cache:'no-store'});
    if(!res.ok)throw new Error('Collection inaccessible ('+res.status+')');
    var data=await res.json();
    var page=data.items||(data.collection&&data.collection.items)||[];
    all=all.concat(page);pc++;
    var pag=data.pagination||{};
    if(pag.nextPage&&pag.nextPageOffset){nextOffset=pag.nextPageOffset;}else{break;}
  }
  log('Brut:',all.length);
  var filtered=all.filter(function(item){
    var c=getCoords(item.location);
    if(isNaN(c.lat)||isNaN(c.lng)){log('Sans coords:',item.title);return false;}
    if(cfg.category){var cats=(item.categories||[]).map(function(c){return String(c).toLowerCase();});if(cats.indexOf(cfg.category.toLowerCase())===-1){log('Hors cat:',item.title);return false;}}
    return true;
  });
  var items=filtered.map(function(item){
    var c=getCoords(item.location);
    return{id:item.id||item.urlId||'',url:item.fullUrl||item.url||'',title:item.title||'',
      numero:getTag(item.tags,cfg.tagNumero),lieu:getTag(item.tags,cfg.tagLieu),zones:getTags(item.tags,cfg.tagZone),
      imageBase:getImgBase(item),lat:c.lat,lng:c.lng};
  });
  if(cfg.sortBy==='numero')items.sort(function(a,b){return(parseInt(a.numero,10)||999)-(parseInt(b.numero,10)||999);});
  else if(cfg.sortBy==='title')items.sort(function(a,b){return a.title.localeCompare(b.title,'fr');});
  cacheWrite(items);return items;
}

/* ── Rendu d'un child dans un group ── */
function renderChild(child,item){
  var d=cfg.display;
  if(child==='image'){
    if(!d.showImage||!item.imageBase)return'';
    return imgTag(item.imageBase,item.title,'locator-block__image','(max-width:768px) 100vw,'+(cfg.layout==='grid'?'33vw':'50vw'));
  }
  if(child==='title'){
    if(!d.showTitle||!item.title)return'';
    return'<div class="locator-block__title">'+escHtml(item.title)+'</div>';
  }
  if(child==='numero'){
    if(!d.showNumero||!item.numero)return'';
    return'<div class="locator-block__tag-prefix locator-block__tag-prefix--numero">'+escHtml(item.numero)+'</div>';
  }
  if(child==='lieu'){
    if(!d.showLieu||!item.lieu)return'';
    var icon=d.lieuIcon?'<span class="ui-icon" aria-hidden="true">'+escHtml(d.lieuIcon)+'</span>':'';
    return'<div class="locator-block__tag-prefix locator-block__tag-prefix--lieu">'+icon+escHtml(item.lieu)+'</div>';
  }
  if(child==='zones'){
    if(!d.showZones||!item.zones.length)return'';
    return'<div class="locator-block__zones">'+item.zones.map(function(z){return'<span class="locator-block__zone">'+escHtml(z)+'</span>';}).join('')+'</div>';
  }
  if(child==='cardLink'){
    if(!cfg.showCardLink||!item.url)return'';
    var lt=cfg.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';
    return'<a class="locator-block__card-link" href="'+escHtml(item.url)+'"'+lt+' aria-label="Voir '+escHtml(item.title)+'"><span class="ui-icon" aria-hidden="true">arrow_forward</span></a>';
  }
  return'';
}

/* ── HTML card — construit via display.groups (modèle Related Block) ── */
function buildCardHTML(item){
  var d=cfg.display;
  var groups=d.groups;

  /* Si display.groups est défini, on utilise le modèle groups */
  if(groups&&Array.isArray(groups)){
    var html='';
    groups.forEach(function(group){
      var inner='';
      (group.children||[]).forEach(function(child){inner+=renderChild(child,item);});
      if(inner){
        var cls=group.className||'locator-block__body';
        /* Si le group contient une image, c'est un media group */
        var isMedia=group.children&&group.children.indexOf('image')!==-1;
        html+=(isMedia?'<div class="locator-block__media">'+inner+'</div>':'<div class="'+escHtml(cls)+'">'+inner+'</div>');
      }
    });
    /* cardLink toujours en dernier dans le dernier body group */
    var clHtml='';
    if(cfg.showCardLink&&item.url){var lt=cfg.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';clHtml='<a class="locator-block__card-link" href="'+escHtml(item.url)+'"'+lt+' aria-label="Voir '+escHtml(item.title)+'"><span class="ui-icon" aria-hidden="true">arrow_forward</span></a>';}
    return'<div class="locator-block__card" data-item-id="'+escHtml(item.id)+'">'+html+clHtml+'</div>';
  }

  /* Comportement par défaut : media (image seule) + body (tous les champs texte) */
  var mediaHtml='';
  if(d.showImage&&item.imageBase)mediaHtml='<div class="locator-block__media">'+imgTag(item.imageBase,item.title,'locator-block__image','(max-width:768px) 100vw,'+(cfg.layout==='grid'?'33vw':'50vw'))+'</div>';

  var bodyHtml='';
  if(d.showNumero&&item.numero)bodyHtml+='<div class="locator-block__tag-prefix locator-block__tag-prefix--numero">'+escHtml(item.numero)+'</div>';
  if(d.showTitle&&item.title)bodyHtml+='<div class="locator-block__title">'+escHtml(item.title)+'</div>';
  if(d.showLieu&&item.lieu){var icon=d.lieuIcon?'<span class="ui-icon" aria-hidden="true">'+escHtml(d.lieuIcon)+'</span>':'';bodyHtml+='<div class="locator-block__tag-prefix locator-block__tag-prefix--lieu">'+icon+escHtml(item.lieu)+'</div>';}
  if(d.showZones&&item.zones.length)bodyHtml+='<div class="locator-block__zones">'+item.zones.map(function(z){return'<span class="locator-block__zone">'+escHtml(z)+'</span>';}).join('')+'</div>';

  var clHtml='';
  if(cfg.showCardLink&&item.url){var lt=cfg.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';clHtml='<a class="locator-block__card-link" href="'+escHtml(item.url)+'"'+lt+' aria-label="Voir '+escHtml(item.title)+'"><span class="ui-icon" aria-hidden="true">arrow_forward</span></a>';}

  return'<div class="locator-block__card" data-item-id="'+escHtml(item.id)+'">'+mediaHtml+(bodyHtml?'<div class="locator-block__body">'+bodyHtml+clHtml+'</div>':'')+'</div>';
}

/* ── Popup OverlayView ── */
var CustomPopup=null;
function defineCustomPopup(){
  if(CustomPopup)return;
  CustomPopup=function(pos,item){this.position=pos;this.item=item;this.container=null;};
  CustomPopup.prototype=Object.create(google.maps.OverlayView.prototype);
  CustomPopup.prototype.onAdd=function(){
    var d=cfg.display,item=this.item;
    var im=(cfg.map.popupShowImage&&d.showImage&&item.imageBase)?'<div class="locator-block__popup-media">'+imgTag(item.imageBase,item.title,'locator-block__popup-image','240px')+'</div>':'';
    var b='';if(item.numero)b+='<div class="locator-block__popup-num">'+escHtml(item.numero)+'</div>';if(item.title)b+='<div class="locator-block__popup-title">'+escHtml(item.title)+'</div>';if(item.lieu)b+='<div class="locator-block__popup-lieu">'+escHtml(item.lieu)+'</div>';
    this.container=document.createElement('div');this.container.className='locator-block__popup-wrap';
    var pt=cfg.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';
    this.container.innerHTML='<a class="locator-block__popup" href="'+escHtml(item.url)+'"'+pt+'>'+im+(b?'<div class="locator-block__popup-body">'+b+'</div>':'')+'</a>';
    this.getPanes().floatPane.appendChild(this.container);
  };
  CustomPopup.prototype.draw=function(){var proj=this.getProjection(),pos=proj.fromLatLngToDivPixel(this.position);if(!pos||!this.container)return;var w=this.container.offsetWidth||220;this.container.style.left=(pos.x-w/2)+'px';this.container.style.top=(pos.y-this.container.offsetHeight-56)+'px';};
  CustomPopup.prototype.onRemove=function(){if(this.container&&this.container.parentNode){this.container.parentNode.removeChild(this.container);this.container=null;}};
}

/* ── Marqueurs SVG ── */
function getMC(a){var p=a?'--locator-marker-active':'--locator-marker-color';return getComputedStyle(document.documentElement).getPropertyValue(p).trim()||(a?'#000':'#333');}
function pillSvg(bg,tc,label,border){
  label=label?String(label):'';
  var fs=cfg.map.markerFontSize||13;
  var charW=fs*0.6;
  var pH=label.length>2?10:8,tW=label.length*charW;
  /* Dimensions du pill */
  var pw=Math.max(32,tW+pH*2),ph=Math.max(26,fs+14),rx=ph/2;
  /* Padding autour pour que l'ombre ne soit pas rognée par le viewBox */
  var pad=cfg.map.markerShadow!==false?8:0;
  /* Dimensions totales SVG avec padding */
  var sw=pw+pad*2,sh=ph+pad*2;
  /* Ombre */
  var shadowOp=cfg.map.markerShadow!==false?'0.28':'0';
  var sEl='<filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,'+shadowOp+')"/></filter>';
  var fa=' filter="url(#s)"';
  /* Contour (état normal) */
  var bEl=border?'<rect x="'+(pad+.5)+'" y="'+(pad+.5)+'" width="'+(pw-1)+'" height="'+(ph-1)+'" rx="'+(rx-.5)+'" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>':'';
  /* Texte */
  var txt=label?'<text x="'+(sw/2)+'" y="'+(ph/2+pad+1)+'" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="'+fs+'" fill="'+tc+'">'+label+'</text>':'';
  var svgContent='<svg xmlns="http://www.w3.org/2000/svg" width="'+sw+'" height="'+sh+'" viewBox="0 0 '+sw+' '+sh+'">'
    +'<defs>'+sEl+'</defs>'
    +'<rect x="'+pad+'" y="'+pad+'" width="'+pw+'" height="'+ph+'" rx="'+rx+'" fill="'+bg+'"'+fa+'/>'
    +bEl+txt+'</svg>';
  return'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svgContent);
}
function dotSvg(c){var r=8;return'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+(r*2)+'" height="'+(r*2)+'" viewBox="0 0 '+(r*2)+' '+(r*2)+'"><circle cx="'+r+'" cy="'+r+'" r="'+r+'" fill="'+c+'"/></svg>');}
function markerIcon(label,active){
  var style=cfg.map.markerStyle||'pill';
  if(style==='google')return null;
  var c=getMC(active),lbl=cfg.map.markerLabel==='none'?'':(label||'');
  if(style==='dot'){var r=active?10:8;return{url:dotSvg(c),scaledSize:new google.maps.Size(r*2,r*2),anchor:new google.maps.Point(r,r)};}
  var fs=cfg.map.markerFontSize||13;
  var pH=lbl.length>2?10:8,pw=Math.max(32,lbl.length*(fs*0.6)+pH*2),ph=Math.max(26,fs+14);
  var pad=cfg.map.markerShadow!==false?8:0;
  var sw=pw+pad*2,sh=ph+pad*2;
  /* anchor : pointe en bas au centre du pill (pas du SVG total avec padding) */
  return{url:pillSvg(active?c:'#fff',active?'#fff':'#111',lbl,!active),scaledSize:new google.maps.Size(sw,sh),anchor:new google.maps.Point(sw/2,ph+pad)};
}

/* ── API Maps + clusterer ── */
function loadMapsAPI(){return new Promise(function(resolve,reject){if(window.google&&window.google.maps){resolve();return;}var cb='__locatorReady_'+Date.now();window[cb]=function(){delete window[cb];resolve();};var s=document.createElement('script');s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(cfg.apiKey)+'&callback='+cb+'&loading=async';s.async=true;s.onerror=function(){reject(new Error('Google Maps inaccessible'));};document.head.appendChild(s);});}
function loadClusterer(){return new Promise(function(resolve){if(window.markerClusterer){resolve();return;}var s=document.createElement('script');s.src='https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';s.onload=function(){resolve();};s.onerror=function(){resolve();};document.head.appendChild(s);});}

/* ── Contrôles + skeleton ── */
function buildControls(zones,total){
  var f='';
  if(cfg.showZoneFilter&&zones.length){
    /* Wrapper pour contrôle total du style (icône custom, appearance:none) */
    var opts=['<option value="">Toutes les zones</option>']
      .concat(zones.map(function(z){return'<option value="'+escHtml(z)+'">'+escHtml(z)+'</option>';})).join('');
    f='<div class="locator-block__filter-wrap">'
      +'<select class="locator-block__filter-zone" aria-label="Filtrer par zone">'+opts+'</select>'
      +'<span class="locator-block__filter-icon ui-icon" aria-hidden="true">expand_more</span>'
      +'</div>';
  }
  /* showCount respecté */
  var countHtml=cfg.display.showCount!==false
    ?'<span class="locator-block__count">'+total+' exposition'+(total>1?'s':'')+'</span>':'';
  return'<div class="locator-block__controls">'+countHtml+f+'</div>';
}
function buildSkeleton(){var s='';for(var i=0;i<4;i++)s+='<div class="locator-block__card locator-block__card--skeleton"><div class="locator-block__media"></div><div class="locator-block__body"><div class="locator-block__skeleton-line" style="width:20%"></div><div class="locator-block__skeleton-line" style="width:70%"></div><div class="locator-block__skeleton-line" style="width:45%"></div></div></div>';return s;}

/* ── Instance ── */
function createInstance(root,allItems){
  var map,markers={},clusterer=null,activeId=null,activePopup=null;
  var currentItems=allItems,visibleCount=cfg.display.pageSize>0?cfg.display.pageSize:allItems.length;

  function buildMap(c){
    var o=Object.assign({center:cfg.mapCenter||{lat:48.8566,lng:2.3522},zoom:cfg.mapZoom||12,zoomControl:true,mapTypeControl:false,streetViewControl:false,fullscreenControl:true,clickableIcons:false},cfg.mapOptions||{});
    if(cfg.mapStyle)o.styles=cfg.mapStyle;
    map=new google.maps.Map(c,o);
    map.addListener('click',function(){closePopup();});
    /* updateListOnMapMove doit être dans map:{} dans la config, pas à la racine */
    if(cfg.map.updateListOnMapMove)map.addListener('idle',function(){
      var b=map.getBounds();if(!b)return;
      var v=currentItems.filter(function(i){return b.contains(new google.maps.LatLng(i.lat,i.lng));});
      var list=root.querySelector('.locator-block__list');if(!list)return;
      list.innerHTML=v.length?v.map(buildCardHTML).join(''):'<p class="locator-block__error" style="padding:1rem;opacity:.5">Aucune exposition dans cette zone.</p>';
      bindCards();
    });
  }
  function showPopup(item){if(!cfg.map.popup||!item)return;closePopup();defineCustomPopup();activePopup=new CustomPopup(new google.maps.LatLng(item.lat,item.lng),item);activePopup.setMap(map);}
  function closePopup(){if(activePopup){activePopup.setMap(null);activePopup=null;}}
  function createMarker(item){var icon=markerIcon(item.numero,false);var o={position:{lat:item.lat,lng:item.lng},map:cfg.map.clustering?null:map,title:item.title};if(icon!==null)o.icon=icon;var m=new google.maps.Marker(o);m.addListener('click',function(){activate(item.id,true);showPopup(item);});markers[item.id]={marker:m,item:item};return m;}
  function addAllMarkers(){var ml=allItems.map(function(i){return createMarker(i);});if(cfg.map.clustering&&window.markerClusterer)clusterer=new markerClusterer.MarkerClusterer({map:map,markers:ml,algorithm:new markerClusterer.GridAlgorithm({maxDistance:40})});}
  function updateMarker(id,a){if(!markers[id])return;var icon=markerIcon(markers[id].item.numero,a);if(icon!==null)markers[id].marker.setIcon(icon);markers[id].marker.setZIndex(a?999:0);}
  function activate(id,pan){
    if(activeId===id)return;
    if(activeId){updateMarker(activeId,false);var prev=root.querySelector('.locator-block__card[data-item-id="'+activeId+'"]');if(prev)prev.classList.remove('is-active');}
    activeId=id;updateMarker(id,true);
    var card=root.querySelector('.locator-block__card[data-item-id="'+id+'"]');
    if(card){card.classList.add('is-active');card.scrollIntoView({behavior:'smooth',block:'nearest'});}
    if(pan&&markers[id]){
      map.panTo({lat:markers[id].item.lat,lng:markers[id].item.lng});
      if(map.getZoom()<cfg.mapZoomOnSelect)map.setZoom(cfg.mapZoomOnSelect);
      /* Compenser la hauteur du popup (environ popup + marker + marge) */
      var popupH = cfg.map.popup ? 280 : 0;
      if(popupH > 0) setTimeout(function(){ map.panBy(0, -(popupH/2)); }, 50);
    }
  }
  function bindCards(){root.querySelectorAll('.locator-block__card:not(.locator-block__card--skeleton)').forEach(function(card){var id=card.dataset.itemId;card.addEventListener('mouseenter',function(){if(!markers[id])return;updateMarker(id,true);if(activeId&&activeId!==id)updateMarker(activeId,false);});card.addEventListener('mouseleave',function(){if(id!==activeId)updateMarker(id,false);});card.addEventListener('click',function(e){if(e.target.closest('.locator-block__card-link'))return;activate(id,true);showPopup(markers[id]&&markers[id].item);});});}
  function renderList(items,count){
    var list=root.querySelector('.locator-block__list');if(!list)return;
    var n=cfg.display.pageSize>0?Math.min(count,items.length):items.length;
    list.innerHTML=items.slice(0,n).map(buildCardHTML).join('');bindCards();
    var lw=root.querySelector('.locator-block__load-more-wrap');if(lw)lw.remove();
    if(cfg.display.pageSize>0&&items.length>n){var sb=root.querySelector('.locator-block__sidebar');if(sb){sb.insertAdjacentHTML('beforeend','<div class="locator-block__load-more-wrap"><button class="locator-block__load-more" type="button">Voir plus</button></div>');var btn=sb.querySelector('.locator-block__load-more');if(btn)btn.addEventListener('click',function(){visibleCount=Math.min(visibleCount+cfg.display.pageSize,items.length);renderList(items,visibleCount);});}}
  }
  function applyFilter(zone){closePopup();currentItems=zone?allItems.filter(function(i){return i.zones.indexOf(zone)!==-1;}):allItems;visibleCount=cfg.display.pageSize>0?cfg.display.pageSize:currentItems.length;renderList(currentItems,visibleCount);allItems.forEach(function(i){if(!markers[i.id])return;markers[i.id].marker.setVisible(currentItems.some(function(ci){return ci.id===i.id;}));});if(currentItems.length&&zone){var b=new google.maps.LatLngBounds();currentItems.forEach(function(i){b.extend({lat:i.lat,lng:i.lng});});map.fitBounds(b,{padding:60});}}

  var zones=[];allItems.forEach(function(i){i.zones.forEach(function(z){if(zones.indexOf(z)===-1)zones.push(z);});});zones.sort();
  /* En mode grid, la structure HTML est identique au mode list.
     Le CSS gère l'affichage : liste=grille multi-colonnes, carte=côté droit.
     --locator-grid-list-width contrôle la proportion (défaut: 50%). */
  var lc=cfg.layout==='grid'?' locator-block__inner--grid':' locator-block__inner--list';
  var cc=cfg.customClass?' '+escHtml(cfg.customClass):'';
  root.innerHTML='<div class="locator-block__inner'+lc+cc+'"><div class="locator-block__sidebar">'+buildControls(zones,allItems.length)+'<div class="locator-block__list"></div></div><div class="locator-block__map-wrap"><div class="locator-block__map"></div></div></div>';
  buildMap(root.querySelector('.locator-block__map'));addAllMarkers();
  if(allItems.length){var bounds=new google.maps.LatLngBounds();allItems.forEach(function(i){bounds.extend({lat:i.lat,lng:i.lng});});if(cfg.mapCenter&&cfg.mapZoom){map.setCenter(cfg.mapCenter);map.setZoom(cfg.mapZoom);}else map.fitBounds(bounds,{padding:60});}
  renderList(allItems,visibleCount);
  var sel=root.querySelector('.locator-block__filter-zone');if(sel)sel.addEventListener('change',function(){applyFilter(sel.value);});
  log('Instance:',allItems.length,'marqueurs');
}

/* ── Init ── */
async function init(){
  var roots=Array.from(document.querySelectorAll(cfg.rootSelector));
  log('Init —',roots.length,'conteneur(s)');if(!roots.length)return;
  if(!cfg.apiKey){roots.forEach(function(r){r.innerHTML='<p class="locator-block__error">apiKey manquant</p>';});return;}
  roots.forEach(function(r){r.innerHTML='<div class="locator-block__inner locator-block__inner--list"><div class="locator-block__sidebar"><div class="locator-block__list">'+buildSkeleton()+'</div></div><div class="locator-block__map-wrap"><div class="locator-block__map locator-block__map--loading"></div></div></div>';});
  try{
    var loaders=[fetchItems(),loadMapsAPI()];if(cfg.map.clustering)loaders.push(loadClusterer());
    var results=await Promise.all(loaders);var items=results[0];log('Items:',items.length);
    if(!items.length){roots.forEach(function(r){r.innerHTML='<p class="locator-block__error">Aucun élément trouvé.</p>';});return;}
    roots.forEach(function(r){createInstance(r,items);});
  }catch(err){console.error('Locator Block:',err);roots.forEach(function(r){r.innerHTML='<p class="locator-block__error">Erreur: '+escHtml(err.message)+'</p>';});}
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

})();
