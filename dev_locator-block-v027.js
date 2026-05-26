(function(){
'use strict';
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

/* ── Auto-détection de la langue depuis Squarespace ── */
function detectLocale(){
  try{var l=(window.Static&&window.Static.SQUARESPACE_CONTEXT&&window.Static.SQUARESPACE_CONTEXT.website&&window.Static.SQUARESPACE_CONTEXT.website.language)||'fr';return l.slice(0,2).toLowerCase();}catch(_){return'fr';}
}
/* Dictionnaire i18n par défaut — surcharger via cfg.i18n */
var I18N_DEFAULTS={
  fr:{noResults:'Aucun résultat dans cette zone',allZones:'Toutes les zones',itemCount:function(n){return n+' exposition'+(n>1?'s':'');},loading:'Chargement…',error:'Impossible de charger les données.'},
  en:{noResults:'No results in this area',allZones:'All areas',itemCount:function(n){return n+' exhibition'+(n>1?'s':'');},loading:'Loading…',error:'Unable to load data.'},
};
function getI18n(cfg){
  var locale=detectLocale();
  var base=I18N_DEFAULTS[locale]||I18N_DEFAULTS.fr;
  return Object.assign({},base,cfg.i18n||{});
}

var cfg=Object.assign({
  collectionUrl:'',category:'',tagNumero:'Numéro',tagLieu:'Lieu',tagZone:'Zone',
  layout:'list',display:{},apiKey:'',mapCenter:null,mapZoom:null,
  mapZoomOnSelect:16,mapStyle:null,mapOptions:{},map:{},
  openInNewTab:false,
  filterMode:'dropdown',
  filterMultiple:false,
  cardClickable:false,
  showCardLink:true,showZoneFilter:true,sortBy:'numero',
  customClass:'',
  i18n:{},
  rootSelector:'.locator-block',
  noCache:false,
  cacheTTL:600000,
  performance:{},
  debug:false,
},window.LOCATOR_BLOCK_CONFIG||{});

cfg.performance=Object.assign({
  lazyInit:true,
  lazyRootMargin:'1200px 0px',
  priorityImages:true,
  maxPages:1,
  progressiveMaxPages:'all',
  domBatchSize:8,
},cfg.performance||{});

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
var LOCATOR_RENDER_IMAGE_INDEX=0;

function buildSrcset(b){
  return SW.map(function(w){return b+'?format='+w+'w '+w+'w';}).join(', ');
}

function getImgBase(item){
  return(item.assetUrl||item.thumbnailUrl||item.mainImageUrl||(item.media&&item.media[0]&&item.media[0].url)||'').split('?')[0];
}

function imgTag(base,alt,cls,sizes,fp,priority){
  if(!base)return'';

  var useIndexPriority = priority == null;
  var idx = useIndexPriority ? LOCATOR_RENDER_IMAGE_INDEX++ : 999;
  var isPriority = priority === true || (
    useIndexPriority &&
    cfg.performance.priorityImages !== false &&
    idx < 3
  );

  var pos=fp||'50% 50%';
  var fallback=base+'?format=750w';

  return '<img class="'+escHtml(cls)+'"'
    +' src="'+escHtml(fallback)+'"'
    +' srcset="'+escHtml(buildSrcset(base))+'"'
    +' sizes="'+escHtml(sizes||'(max-width:768px) 100vw, 400px')+'"'
    +' alt="'+escHtml(alt)+'"'
    +' loading="'+(isPriority?'eager':'lazy')+'"'
    +' fetchpriority="'+(isPriority?'high':'low')+'"'
    +' decoding="async"'
    +' style="object-position:'+escHtml(pos)+'">';
}
   
/* ── Coordonnées ── */
function getCoords(loc){loc=loc||{};return{lat:parseFloat(loc.mapLat||loc.markerLat||''),lng:parseFloat(loc.mapLng||loc.markerLng||'')};}

/* ── Fetch SQS + pagination timestamp ── */
   async function fetchItems(maxPages){
  if(!cfg.collectionUrl) throw new Error('collectionUrl manquant');

  if(!window.CollectionData || typeof window.CollectionData.get !== 'function'){
    throw new Error('CollectionData requis pour Locator Block');
  }

  maxPages = maxPages || cfg.performance.maxPages || 1;

  var all = await window.CollectionData.get(cfg.collectionUrl, {
    maxPages: maxPages,
    ttl: Math.round((cfg.cacheTTL || 600000) / 1000),
    memoryCache: true,
    sessionCache: !cfg.noCache,
    credentials: 'same-origin',
    keepFields: cfg.performance.keepFields || [
      'id',
      'title',
      'fullUrl',
      'urlId',
      'assetUrl',
      'mediaFocalPoint',
      'categories',
      'tags',
      'excerpt',
      'location',
      'displayIndex',
      'workflowState',
      'startDate',
      'publishOn',
      'addedOn',
      'updatedOn'
    ],
    stripFields: []
  });

  log('Brut:', all.length);

  var filtered = all.filter(function(item){
    var c = getCoords(item.location);

    if(isNaN(c.lat) || isNaN(c.lng)){
      log('Sans coords:', item.title);
      return false;
    }

    if(cfg.category){
      var cats = (item.categories || []).map(function(c){
        return String(c).toLowerCase();
      });

      if(cats.indexOf(cfg.category.toLowerCase()) === -1){
        log('Hors cat:', item.title);
        return false;
      }
    }

    return true;
  });

  var items = filtered.map(function(item){
    var c = getCoords(item.location);
    var fp = item.mediaFocalPoint || { x: 0.5, y: 0.5 };
    var focalPos = Math.round(fp.x * 100) + '% ' + Math.round(fp.y * 100) + '%';

    return {
      id: item.id || item.urlId || '',
      url: item.fullUrl || item.url || '',
      title: item.title || '',
      numero: getTag(item.tags, cfg.tagNumero),
      lieu: getTag(item.tags, cfg.tagLieu),
      zones: getTags(item.tags, cfg.tagZone),
      imageBase: getImgBase(item),
      focalPos: focalPos,
      lat: c.lat,
      lng: c.lng
    };
  });

  if(cfg.sortBy === 'numero'){
    items.sort(function(a,b){
      return (parseInt(a.numero, 10) || 999) - (parseInt(b.numero, 10) || 999);
    });
  } else if(cfg.sortBy === 'title'){
    items.sort(function(a,b){
      return a.title.localeCompare(b.title, 'fr');
    });
  }

  return items;
}
/* ── Rendu d'un child dans un group ── */
function renderChild(child,item){
  var d=cfg.display;
  if(child==='image'){
    if(!d.showImage||!item.imageBase)return'';
    return imgTag(item.imageBase,item.title,'locator-block__image','(max-width:768px) 100vw,'+(cfg.layout==='grid'?'33vw':'50vw'),item.focalPos);
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
    if(cfg.cardClickable&&item.url){
      var lt=cfg.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';
      return'<a class="locator-block__card locator-block__card--clickable" href="'+escHtml(item.url)+'"'+lt+' data-item-id="'+escHtml(item.id)+'">'+html+'</a>';
    }
    /* showCardLink : si true et cardClickable=false, ajouter la flèche
       même si 'cardLink' n'est pas dans les children des groups */
    if(cfg.showCardLink&&item.url&&!cfg.cardClickable){
      var lt2=cfg.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';
      html+='<a class="locator-block__card-link" href="'+escHtml(item.url)+'"'+lt2+' aria-label="Voir '+escHtml(item.title)+'"><span class="ui-icon" aria-hidden="true">arrow_forward</span></a>';
    }
    return'<div class="locator-block__card" data-item-id="'+escHtml(item.id)+'">'+html+'</div>';
  }

  /* Comportement par défaut : media (image seule) + body (tous les champs texte) */
  var mediaHtml='';
  if(d.showImage&&item.imageBase)mediaHtml='<div class="locator-block__media">'+imgTag(item.imageBase,item.title,'locator-block__image','(max-width:768px) 100vw,'+(cfg.layout==='grid'?'33vw':'50vw'),item.focalPos)+'</div>';

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
    var im=(cfg.map.popupShowImage&&d.showImage&&item.imageBase)?'<div class="locator-block__popup-media">'+imgTag(item.imageBase,item.title,'locator-block__popup-image','240px',item.focalPos,false)+'</div>':'';
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
    if(cfg.filterMode==='buttons'){
      /* Boutons pill — même apparence que Query Block (sqb-filter-btn) */
      var btns='';
      zones.forEach(function(z){btns+='<button class="locator-block__filter-btn" data-zone="'+escHtml(z)+'" type="button">'+escHtml(z)+'</button>';});
      f='<div class="locator-block__filter-buttons">'+btns+'</div>';
    }else{
      /* Dropdown (défaut) */
      var opts=['<option value="">Toutes les zones</option>']
        .concat(zones.map(function(z){return'<option value="'+escHtml(z)+'">'+escHtml(z)+'</option>';})).join('');
      f='<div class="locator-block__filter-wrap">'
        +'<select class="locator-block__filter-zone" aria-label="Filtrer par zone">'+opts+'</select>'
        +'<span class="locator-block__filter-icon ui-icon" aria-hidden="true">expand_more</span>'
        +'</div>';
    }
  }
  var countHtml=cfg.display.showCount!==false
    ?'<span class="locator-block__count">'+getI18n(cfg).itemCount(total)+'</span>':'';
  return'<div class="locator-block__controls">'+countHtml+f+'</div>';
}
   function renderCardsProgressive(list, items, count, done){
  var n = cfg.display.pageSize > 0 ? Math.min(count, items.length) : items.length;
  var batchSize = Math.max(1, Number(cfg.performance.domBatchSize || 8));
  var index = 0;

  list.innerHTML = '';
  LOCATOR_RENDER_IMAGE_INDEX = 0;

  function appendBatch(){
    var html = '';
    var end = Math.min(index + batchSize, n);

    for (; index < end; index++) {
      html += buildCardHTML(items[index]);
    }

    list.insertAdjacentHTML('beforeend', html);

    if (index < n) {
      requestAnimationFrame(appendBatch);
    } else if (typeof done === 'function') {
      done(n);
    }
  }

  appendBatch();
}
function buildSkeleton(){var s='';for(var i=0;i<4;i++)s+='<div class="locator-block__card locator-block__card--skeleton"><div class="locator-block__media"></div><div class="locator-block__body"><div class="locator-block__skeleton-line" style="width:20%"></div><div class="locator-block__skeleton-line" style="width:70%"></div><div class="locator-block__skeleton-line" style="width:45%"></div></div></div>';return s;}

/* ── Instance ── */
function createInstance(root,allItems,fetchMoreItems){
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
      renderCardsProgressive(list, items, count, function(n){
  bindCards();

  var lw=root.querySelector('.locator-block__load-more-wrap');
  if(lw)lw.remove();

  if(cfg.display.pageSize>0&&items.length>n){
    var sb=root.querySelector('.locator-block__sidebar');
    if(sb){
      sb.insertAdjacentHTML('beforeend','<div class="locator-block__load-more-wrap"><button class="locator-block__load-more" type="button">Voir plus</button></div>');
      var btn=sb.querySelector('.locator-block__load-more');
      if(btn)btn.addEventListener('click',function(){
        visibleCount=Math.min(visibleCount+cfg.display.pageSize,items.length);
        renderList(items,visibleCount);
      });
    }
  }
});

return;
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
  function bindCards(){root.querySelectorAll('.locator-block__card:not(.locator-block__card--skeleton)').forEach(function(card){
    var id=card.dataset.itemId;
    /* Hover : allume le marker correspondant */
    card.addEventListener('mouseenter',function(){if(!markers[id])return;updateMarker(id,true);if(activeId&&activeId!==id)updateMarker(activeId,false);});
    card.addEventListener('mouseleave',function(){if(id!==activeId)updateMarker(id,false);});
    if(!cfg.cardClickable){
      /* Mode par défaut : clic → active carte + popup (navigation via card-link) */
      card.addEventListener('click',function(e){
        if(e.target.closest('.locator-block__card-link'))return;
        activate(id,true);showPopup(markers[id]&&markers[id].item);
      });
    } else {
      /* Mode cardClickable : card = <a>, clic navigue.
         On active quand même le marker au clic pour feedback visuel. */
      card.addEventListener('click',function(){activate(id,false);});
    }
  });}
  function renderList(items,count){
    var list=root.querySelector('.locator-block__list');if(!list)return;
    var n=cfg.display.pageSize>0?Math.min(count,items.length):items.length;
    renderCardsProgressive(list, items, count, function(){
  bindCards();
});
    var lw=root.querySelector('.locator-block__load-more-wrap');if(lw)lw.remove();
    if(cfg.display.pageSize>0&&items.length>n){var sb=root.querySelector('.locator-block__sidebar');if(sb){sb.insertAdjacentHTML('beforeend','<div class="locator-block__load-more-wrap"><button class="locator-block__load-more" type="button">Voir plus</button></div>');var btn=sb.querySelector('.locator-block__load-more');if(btn)btn.addEventListener('click',async function(){
  visibleCount = Math.min(visibleCount + cfg.display.pageSize, items.length);

  if(typeof fetchMoreItems === 'function' && visibleCount >= items.length){
    try{
      allItems = await fetchMoreItems();
      currentItems = allItems;
      items = allItems;
    }catch(err){
      log('Fetch more failed:', err);
    }
  }

  renderList(items, visibleCount);
});}}
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
  root.querySelectorAll('.locator-block__filter-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var zone=btn.dataset.zone||'';
      /* Toggle : clic sur bouton actif = désactiver (revenir à "tout") */
      var isAlreadyActive=btn.classList.contains('locator-block__filter-btn--active');
      root.querySelectorAll('.locator-block__filter-btn').forEach(function(b){b.classList.remove('locator-block__filter-btn--active');});
      if(!isAlreadyActive){btn.classList.add('locator-block__filter-btn--active');}else{zone='';}
      applyFilter(zone);
    });
  });
  log('Instance:',allItems.length,'marqueurs');
}

/* ── Init ── */
async function init(){
  var roots=Array.from(document.querySelectorAll(cfg.rootSelector));
  log('Init —',roots.length,'conteneur(s)');if(!roots.length)return;
  if(!cfg.apiKey){roots.forEach(function(r){r.innerHTML='<p class="locator-block__error">apiKey manquant</p>';});return;}
  roots.forEach(function(r){r.innerHTML='<div class="locator-block__inner locator-block__inner--list"><div class="locator-block__sidebar"><div class="locator-block__list">'+buildSkeleton()+'</div></div><div class="locator-block__map-wrap"><div class="locator-block__map locator-block__map--loading"></div></div></div>';});
  try{
    var initialMaxPages = cfg.performance.maxPages || 1;
    var loaders=[fetchItems(initialMaxPages),loadMapsAPI()];if(cfg.map.clustering)loaders.push(loadClusterer());
    var results=await Promise.all(loaders);var items=results[0];log('Items:',items.length);
        var loadedMaxPages = initialMaxPages;
    var progressiveMaxPages = cfg.performance.progressiveMaxPages || 'all';
    if(!items.length){roots.forEach(function(r){r.innerHTML='<p class="locator-block__error">'+getI18n(cfg).noResults+'</p>';});return;}

async function fetchMoreItems(){
  if(progressiveMaxPages !== 'all' && Number(loadedMaxPages) >= Number(progressiveMaxPages)){
    return items;
  }

  loadedMaxPages = progressiveMaxPages === 'all'
    ? Number(loadedMaxPages || 1) + 1
    : Math.min(Number(loadedMaxPages || 1) + 1, Number(progressiveMaxPages));

  var more = await fetchItems(loadedMaxPages);

  if(more.length > items.length){
    items = more;
  }

  return items;
}

roots.forEach(function(r){createInstance(r,items,fetchMoreItems);});
  }catch(err){console.error('Locator Block:',err);roots.forEach(function(r){r.innerHTML='<p class="locator-block__error">Erreur: '+escHtml(err.message)+'</p>';});}
}

function scheduleInit(){
  var roots=Array.from(document.querySelectorAll(cfg.rootSelector));
  log('Schedule —',roots.length,'conteneur(s)');
  if(!roots.length)return;

  if(cfg.performance.lazyInit===false||!('IntersectionObserver'in window)){
    init();
    return;
  }

  var started=false;
  var obs=new IntersectionObserver(function(entries){
    if(started)return;
    var hit=entries.some(function(e){return e.isIntersecting;});
    if(!hit)return;
    started=true;
    obs.disconnect();
    init();
  },{rootMargin:cfg.performance.lazyRootMargin||'1200px 0px'});

  roots.forEach(function(r){obs.observe(r);});
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',scheduleInit,{once:true});
}else{
  scheduleInit();
}

})();
