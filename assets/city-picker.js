(()=>{
 const picks=[],lang=()=>document.querySelector('#lang').value,mode=()=>document.querySelector('.tab.active').dataset.mode;
 const labels={ru:{from:'Откуда',to:'Куда',empty:'Город не найден. Попробуйте другое название.',hint:'Введите город'},tj:{from:'Аз куҷо',to:'Ба куҷо',empty:'Шаҳр ёфт нашуд. Номи дигарро санҷед.',hint:'Шаҳрро ворид кунед'},en:{from:'From',to:'To',empty:'No cities found. Try another name.',hint:'Enter a city'}};
 const countries={ru:{tj:'Таджикистан',ru:'Россия',uz:'Узбекистан',kz:'Казахстан',kg:'Кыргызстан',tm:'Туркменистан',tr:'Турция',ae:'ОАЭ',ir:'Иран',in:'Индия',az:'Азербайджан',cn:'Китай'},tj:{tj:'Тоҷикистон',ru:'Русия',uz:'Ӯзбекистон',kz:'Қазоқистон',kg:'Қирғизистон',tm:'Туркманистон',tr:'Туркия',ae:'АМА',ir:'Эрон',in:'Ҳиндустон',az:'Озарбойҷон',cn:'Чин'},en:{tj:'Tajikistan',ru:'Russia',uz:'Uzbekistan',kz:'Kazakhstan',kg:'Kyrgyzstan',tm:'Turkmenistan',tr:'Turkey',ae:'UAE',ir:'Iran',in:'India',az:'Azerbaijan',cn:'China'}};
 const countryIds={uz:'tashkent samarkand bukhara fergana namangan andijan karshi termez navoi urgench nukus',kz:'almaty astana shymkent karaganda aktobe aktau atyrau taraz pavlodar kostanay',kg:'bishkek osh kulundu',tm:'ashgabat',tr:'istanbul',ae:'dubai',ir:'tehran',in:'delhi',az:'baku',cn:'urumqi beijing'};
 const country=c=>c.region==='tj'?'tj':Object.keys(countryIds).find(k=>countryIds[k].split(' ').includes(c.id))||'ru';
 const norm=s=>s.toLocaleLowerCase().replace(/ё/g,'е').trim();
 const pin='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill="currentColor"/></svg>';
 function close(p){p.panel.hidden=true;p.input.setAttribute('aria-expanded','false');p.input.removeAttribute('aria-activedescendant');p.field.classList.remove('city-open');p.input.value=p.select.selectedOptions[0]?.textContent||'';p.active=-1;}
 function refresh(){for(const p of picks){close(p);p.input.setAttribute('aria-label',labels[lang()][p.select.id]);p.input.placeholder=labels[lang()].hint;p.input.setCustomValidity('');}}
 function choose(p,c){p.select.value=c.id;p.select.dispatchEvent(new Event('change',{bubbles:true}));p.input.setCustomValidity('');close(p);p.input.focus();p.input.setSelectionRange(p.input.value.length,p.input.value.length);}
 function activate(p,n){if(!p.matches.length)return;p.active=(n+p.matches.length)%p.matches.length;[...p.panel.querySelectorAll('[role=option]')].forEach((e,i)=>{e.classList.toggle('highlighted',i===p.active);if(i===p.active){p.input.setAttribute('aria-activedescendant',e.id);e.scrollIntoView({block:'nearest'})}});}
 function render(p,query=''){
  const term=norm(query),allowed=new Set([...p.select.options].map(o=>o.value));
  p.matches=cities.filter(c=>allowed.has(c.id)&&(!term||norm([c[lang()],c.ru,c.en,c.iata,countries[lang()][country(c)]].join(' ')).includes(term)));
  if(!term){const home=p.select.id==='from'?'tj':'ru';p.matches.sort((a,b)=>Number(country(b)===home)-Number(country(a)===home));}
  p.active=-1;p.panel.replaceChildren();p.input.removeAttribute('aria-activedescendant');
  p.matches.forEach((c,i)=>{const row=document.createElement('div');row.className='city-option';row.id=p.select.id+'-option-'+i;row.setAttribute('role','option');row.setAttribute('aria-selected',String(c.id===p.select.value));row.innerHTML='<span class="city-pin">'+pin+'</span><span class="city-option-copy"><b></b><small></small></span><span class="city-code"></span>';row.querySelector('b').textContent=c[lang()];row.querySelector('small').textContent=countries[lang()][country(c)];row.querySelector('.city-code').textContent=mode()==='air'&&c.iata!=='none'?c.iata:'';row.addEventListener('pointerdown',e=>e.preventDefault());row.onclick=()=>choose(p,c);p.panel.append(row);});
  if(!p.matches.length){const e=document.createElement('p');e.className='city-no-results';e.textContent=labels[lang()].empty;p.panel.append(e);}
 }
 function open(p){picks.filter(x=>x!==p).forEach(close);p.panel.hidden=false;p.field.classList.add('city-open');p.input.setAttribute('aria-expanded','true');render(p);const rect=p.field.getBoundingClientRect(),width=p.panel.getBoundingClientRect().width;p.panel.style.left=Math.min(0,innerWidth-16-rect.left-width)+'px';}
 for(const id of ['from','to']){
  const select=document.getElementById(id),field=select.closest('.field'),control=document.createElement('div');control.className='city-control';
  const input=document.createElement('input');input.id=id+'Input';input.type='text';input.autocomplete='off';input.spellcheck=false;input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-controls',id+'Cities');input.setAttribute('aria-expanded','false');
  const arrow=document.createElement('span');arrow.className='city-chevron';arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const panel=document.createElement('div');panel.id=id+'Cities';panel.className='city-suggestions';panel.setAttribute('role','listbox');panel.hidden=true;
  select.hidden=true;field.querySelector('label').htmlFor=input.id;control.append(input,arrow);select.after(control);field.append(panel);
  const p={select,field,input,panel,active:-1,matches:[]};picks.push(p);
  input.onfocus=()=>input.select();input.onclick=()=>{if(panel.hidden)open(p)};
  input.oninput=()=>{input.setCustomValidity('');if(panel.hidden)open(p);render(p,input.value)};
  input.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(panel.hidden)open(p);activate(p,p.active<0?(e.key==='ArrowDown'?0:p.matches.length-1):p.active+(e.key==='ArrowDown'?1:-1));}else if(e.key==='Enter'&&!panel.hidden){e.preventDefault();if(p.matches.length)choose(p,p.matches[p.active<0?0:p.active]);}else if(e.key==='Escape'){e.preventDefault();close(p)}else if(e.key==='Tab')close(p)};
  input.onblur=()=>close(p);select.addEventListener('change',()=>{input.value=select.selectedOptions[0]?.textContent||'';input.setCustomValidity('')});
 }
 document.addEventListener('pointerdown',e=>picks.forEach(p=>{if(!p.field.contains(e.target))close(p)}));
 window.addEventListener('resize',()=>picks.forEach(close));
 window.TutuCityPicker={refresh,reportError(message){const p=picks[0];close(p);p.input.setCustomValidity(message);p.input.reportValidity();p.input.focus();}};refresh();
})();
