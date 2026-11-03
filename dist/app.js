import { localDate, weekDates, validateState, initialState, combinations, available, packing, searchItems, lookKey } from './domain.js';

const $ = (s, root = document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({arrow:'<path d="M5 19 19 5M5 5h14v14"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',check:'<path d="m5 12 4 4L19 6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M7 3v4m10-4v4M3 10h18"/>',hanger:'<path d="M9 6a3 3 0 1 1 4 2.8v2L22 17v2H2v-2l11-6"/>',bag:'<path d="M4 8h16l1 13H3L4 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>'})[name] || ''}</svg>`;
const occasionLabels = {everyday:'Hằng ngày',work:'Đi làm',evening:'Hẹn tối',weekend:'Cuối tuần'};
const tempLabels = {warm:'Ấm · trên 26°C',mild:'Dịu · 20–26°C',cool:'Mát · dưới 20°C'};
const categoryLabels = {all:'Tất cả',top:'Áo',bottom:'Quần',layer:'Áo khoác',shoes:'Giày',bag:'Túi'};
const colorLabels = {all:'Mọi màu',white:'Trắng',black:'Đen',blue:'Xanh',beige:'Beige',pink:'Hồng'};
const colorValues = {white:'#fafaf6',black:'#292b29',blue:'#7894b3',beige:'#c3b39d',pink:'#dcb6b7'};
const KEY = 'forme.wardrobe.v1';
let data, state, route = 'inspiration', weekOffset = 0;
let lookFilter = 'all', savedOnly = false, category = 'all', query = '', color = 'all', ownedOnly = false;
let builder = {occasion:'everyday',temperature:'mild',index:0};
let packingRange, toastTimer, storageWarning = false;
const main = $('#main'), modal = $('#modal');

function allLooks() { return [...data.looks, ...state.createdOutfits]; }
function getLook(id) { return allLooks().find(x => x.id === id); }
function getItem(id) { return data.items.find(x => x.id === id); }
function readState() {
  try { return validateState(localStorage.getItem(KEY), data.items, data.looks); }
  catch { storageWarning = true; return initialState(data.items); }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); $('#storage-notice').hidden=true;return true; }
  catch { storageWarning=true;$('#storage-notice').hidden=false;return false; }
}
function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}
function dateLabel(date, long = false) {
  return new Intl.DateTimeFormat('vi-VN', {day:'2-digit',month:'2-digit',...(long?{year:'numeric'}:{})}).format(new Date(`${date}T12:00:00`));
}
function image(item, className='', eager=false) {
  return `<img class="${className}" src="${esc(item.image)}" alt="${esc(item.alt || item.name)}" loading="${eager?'eager':'lazy'}" decoding="async" width="600" height="800">`;
}
function modalHead(title, eyebrow = 'THE EVERYDAY STUDIO') {
  return `<div class="modal-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h2 id="modal-title">${esc(title)}</h2></div><button class="close" data-action="close" aria-label="Đóng hộp thoại">×</button></div>`;
}
function openModal(html) {
  $('#modal-body').innerHTML = html;
  if (!modal.open) modal.showModal();
  modal.scrollTop = 0;
}
function chips(values, selected, type, labels) {
  return values.map(v => `<button class="chip" data-action="${type}" data-value="${v}" aria-pressed="${selected === v}">${esc(labels[v])}</button>`).join('');
}
function collage(look) {
  return `<div class="outfit-collage">${look.itemIds.map(id => getItem(id)).filter(Boolean).map(item => `<figure>${image(item)}<figcaption>${esc(item.name)}</figcaption></figure>`).join('')}</div>`;
}
function lookCard(look, index) {
  const fav = state.favoriteOutfitIds.includes(look.id);
  const cover = look.image ? look : getItem(look.itemIds[0]);
  return `<article class="look-card"><div class="look-photo"><a href="#look-${esc(look.id)}" data-action="look" data-id="${esc(look.id)}" aria-label="Xem bộ ${esc(look.name)}">${image(cover)}</a><span class="look-number">${String(index+1).padStart(2,'0')} / ${look.source==='created'?'YOUR EDIT':'THE EDIT'}</span><button class="save-look" data-action="favorite" data-id="${esc(look.id)}" aria-label="${fav?'Bỏ lưu':'Lưu'} ${esc(look.name)}" aria-pressed="${fav}">${icon('heart')}</button></div><div class="look-meta"><div><span class="subtle-tag">${esc(occasionLabels[look.occasion])} · ${look.itemIds.length} món phối lại</span><h3>${esc(look.name)}</h3><p>${esc(look.subtitle || 'Bộ phối từ tủ đồ của bạn')}</p></div><button class="arrow-btn" data-action="look" data-id="${esc(look.id)}" aria-label="Chi tiết ${esc(look.name)}">↗</button></div></article>`;
}
function renderInspiration() {
  const hero = data.looks[0];
  const looks = allLooks().filter(x => (lookFilter === 'all' || x.occasion === lookFilter) && (!savedOnly || state.favoriteOutfitIds.includes(x.id)));
  main.innerHTML = `<div class="container"><section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><div class="eyebrow">YOUR WARDROBE, REIMAGINED</div><h1 id="hero-title">Mặc đẹp từ<br>những gì <em>bạn có.</em></h1><p>Một chút cảm hứng cho buổi sáng. Phối lại những món quen, lên lịch cho cả tuần và tìm thêm chất riêng trong tủ đồ của bạn.</p><div class="hero-actions"><button class="btn" data-action="builder">Phối đồ ngay ${icon('arrow')}</button><a class="text-link" href="#wardrobe">Khám phá tủ đồ</a></div><div class="hero-note"><div class="thumbs">${data.items.slice(0,3).map(x=>image(x)).join('')}</div><p><b>${data.items.length} món đồ mẫu. Nhiều cách phối mới.</b><br>Bắt đầu nhỏ, mặc theo cách của bạn.</p></div></div><div class="hero-visual">${image(hero,'',true)}<span class="photo-sticker">WEAR IT<br>YOUR WAY ↗</span><div class="photo-caption"><div><span>LOOK 01 — THE EVERYDAY EDIT</span><h3>${esc(hero.name)}</h3></div><button class="round-link" data-action="look" data-id="${hero.id}" aria-label="Xem ${esc(hero.name)}">↗</button></div></div></section><div class="hero-strip"><span>${icon('hanger')} Phối từ những món đang có</span><span>${icon('calendar')} Chuẩn bị trước cho cả tuần</span><span>${icon('check')} Lưu riêng trên trình duyệt · không cần tài khoản</span></div><section class="inspiration" id="looks" aria-labelledby="looks-title"><div class="section-head"><div><div class="eyebrow">A LITTLE INSPIRATION</div><h2 id="looks-title">Hôm nay, bạn là ai?</h2></div><p>Ảnh thật để tìm cảm hứng.<br>Những món quen để phối lại.</p></div><div class="filters">${chips(['all',...Object.keys(occasionLabels)],lookFilter,'look-filter',{all:'Tất cả',...occasionLabels})}<button class="chip saved-toggle" data-action="saved-filter" aria-pressed="${savedOnly}">${icon('heart')} Đã lưu <span>${state.favoriteOutfitIds.length}</span></button></div><div class="look-grid">${looks.length ? looks.map(lookCard).join('') : `<div class="empty"><div class="empty-illustration">f.</div><h3>${savedOnly?'Chưa có bộ phối đã lưu':'Chưa có bộ phối phù hợp'}</h3><p>Chạm trái tim ở bộ bạn thích, hoặc thử một dịp khác.</p><button class="btn secondary" data-action="reset-look-filters">Xem tất cả</button></div>`}</div></section><section class="callout"><div><div class="eyebrow">MAKE ROOM FOR YOUR WEEK</div><h2 style="margin-top:12px">Bớt một câu “hôm nay mặc gì?”</h2><p>Chọn trước bộ phối cho từng ngày. Khi cần đi xa, danh sách hành lý đã sẵn sàng từ chính lịch đó.</p></div><a href="#week" class="btn">Xếp lịch tuần này ${icon('arrow')}</a></section></div>`;
}
function renderWardrobe() {
  main.innerHTML = `<div class="container"><div class="page-heading"><div><div class="eyebrow">THE BUILDING BLOCKS</div><h1>Tủ đồ của bạn <span class="count">/ ${data.items.length} món mẫu</span></h1><p>Món đồ tốt nhất là món bạn sẽ mặc lại. Bỏ chọn những món chưa sẵn sàng; bộ phối mới sẽ chỉ dùng những gì đang có.</p></div><button class="btn" data-action="builder">Phối từ tủ đồ ${icon('arrow')}</button></div><div class="wardrobe-toolbar"><label class="search">${icon('search')}<input id="wardrobe-search" type="search" value="${esc(query)}" placeholder="Tìm áo, quần, màu sắc…" aria-label="Tìm món đồ"></label><select class="select" id="wardrobe-color" aria-label="Lọc màu sắc">${Object.entries(colorLabels).map(([id,label])=>`<option value="${id}" ${id===color?'selected':''}>${label}</option>`).join('')}</select><label class="availability"><input id="owned-filter" type="checkbox" ${ownedOnly?'checked':''}> Chỉ món đang có (${state.availableItemIds.length})</label></div><div class="filters category-filters">${chips(Object.keys(categoryLabels),category,'category',categoryLabels)}</div><div class="item-grid" id="wardrobe-grid"></div></div>`;
  renderItems();
}
function renderItems() {
  const items = searchItems(data.items,{category,query,color}).filter(x => !ownedOnly || state.availableItemIds.includes(x.id));
  $('#wardrobe-grid').innerHTML = items.length ? items.map(item => {
    const owned = state.availableItemIds.includes(item.id);
    return `<article class="item-card ${owned?'':'unavailable'}"><div class="item-image">${image(item)}<label class="ownership"><span>${owned?'Đang có trong tủ':'Chưa sẵn sàng'}</span><input type="checkbox" data-item="${item.id}" aria-label="Đang có ${esc(item.name)}" ${owned?'checked':''}></label></div><h3>${esc(item.name)}</h3><p><span class="item-color" style="background:${colorValues[item.colors[0]] || '#ddd'}"></span>${esc(categoryLabels[item.category])} · ${esc(colorLabels[item.colors[0]] || item.colors[0])}</p></article>`;
  }).join('') : `<div class="empty"><h3>Chưa tìm thấy món phù hợp.</h3><p>Thử từ khóa ngắn hơn hoặc bỏ bộ lọc để xem lại tủ đồ.</p><button class="btn secondary" data-action="reset-item-filters">Bỏ bộ lọc</button></div>`;
}
function renderWeek() {
  const dates = weekDates(new Date(),weekOffset), today = localDate();
  const names = ['THỨ HAI','THỨ BA','THỨ TƯ','THỨ NĂM','THỨ SÁU','THỨ BẢY','CHỦ NHẬT'];
  const planned = dates.filter(d=>state.plan[d]).length;
  main.innerHTML = `<div class="container"><div class="page-heading"><div><div class="eyebrow">YOUR WEEK, A LITTLE LIGHTER</div><h1>Tuần của tôi <span class="count">/ ${planned} ngày đã xếp</span></h1><p>Mỗi ngày một tâm trạng, một bộ phối. Lên lịch trước để buổi sáng dành cho những điều khác.</p></div><button class="btn secondary" data-action="packing">${icon('bag')} Danh sách hành lý</button></div><div class="week-bar"><div class="week-controls"><button data-action="prev-week" aria-label="Tuần trước">←</button><b>${dateLabel(dates[0],true)} — ${dateLabel(dates[6],true)}</b><button data-action="next-week" aria-label="Tuần sau">→</button><button class="text-link" data-action="this-week" style="border:0;width:auto">Hôm nay</button></div><button class="text-link" data-action="fill-week">Điền các ngày trống ↗</button></div><section class="week-days" aria-label="Lịch phối đồ bảy ngày">${dates.map((d,i)=>{
    const look = getLook(state.plan[d]);
    return `<article class="day ${d===today?'today':''}"><div class="day-header"><span>${names[i]}</span><b>${d.slice(-2)}</b></div><div class="day-content">${look?`${image(look.image?look:getItem(look.itemIds[0]),'day-picture')}<h3>${esc(look.name)}</h3><p>${esc(occasionLabels[look.occasion])}</p>${!available(look,state.availableItemIds)?'<p class="warning">Có món chưa sẵn sàng</p>':''}<div style="display:flex;gap:13px"><button class="clear-day" data-action="pick-date" data-date="${d}">Đổi bộ</button><button class="clear-day" data-action="clear-date" data-date="${d}" aria-label="Bỏ bộ phối ngày ${dateLabel(d)}">Bỏ</button></div>`:`<button class="add-day" data-action="pick-date" data-date="${d}" aria-label="Chọn bộ phối cho ${names[i].toLowerCase()} ngày ${dateLabel(d)}"><span class="plus">+</span>Chọn bộ phối</button>`}</div></article>`;
  }).join('')}</section><aside class="week-tip"><div><h3>Đi một chuyến. Mang vừa đủ.</h3><p>Danh sách hành lý tự gộp món trùng từ lịch đã xếp. Một chiếc áo được dùng ba lần vẫn chỉ cần mang một chiếc.</p></div><button class="btn" data-action="packing">Chuẩn bị hành lý ${icon('arrow')}</button></aside></div>`;
}
function render() {
  document.querySelectorAll('[data-nav]').forEach(a=>{ if(a.dataset.nav===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current'); });
  if(route==='wardrobe') renderWardrobe(); else if(route==='week') renderWeek(); else renderInspiration();
}
function showLook(id) {
  const look = getLook(id); if(!look)return;
  const ready = available(look,state.availableItemIds), fav = state.favoriteOutfitIds.includes(id);
  openModal(`${modalHead(look.name,look.source==='created'?'YOUR PERSONAL EDIT':'THE EVERYDAY EDIT')}<div class="detail-grid"><div>${look.image?image(look,'detail-hero'):collage(look)}</div><div class="detail-copy"><span class="subtle-tag">${esc(occasionLabels[look.occasion])} · ${esc(tempLabels[look.temperature])}</span><p>${esc(look.story || 'Bộ phối của bạn, kết hợp từ những món đang có trong tủ đồ mẫu.')}</p><h3>Phối lại theo cách của bạn</h3><div class="piece-list">${look.itemIds.map(getItem).filter(Boolean).map(item=>`<div class="piece">${image(item)}<div><b>${esc(item.name)}</b><small>${state.availableItemIds.includes(item.id)?'Đang có trong tủ':'Chưa sẵn sàng'}</small></div></div>`).join('')}</div>${!ready?'<p class="warning" style="margin-top:15px">Có món chưa sẵn sàng. Chọn lại trong Tủ đồ hoặc thử bộ khác trước khi lên lịch.</p>':''}<div class="detail-actions"><button class="btn light" data-action="plan-look" data-id="${esc(id)}" ${ready?'':'disabled'}>${icon('calendar')} Thêm vào lịch</button><button class="btn secondary" data-action="favorite-detail" data-id="${esc(id)}" aria-pressed="${fav}">${icon('heart')} ${fav?'Đã lưu':'Lưu bộ'}</button></div><p class="note">${look.source==='curated'?'Ảnh người mẫu để tìm cảm hứng; các món phối lại là ảnh đại diện, không phải sản phẩm người mẫu đang mặc.':'Bộ do bạn phối, hiển thị đúng ảnh của từng món đã chọn.'}</p></div></div>`);
}
function candidates() { return combinations(data.items,{...builder,availableIds:state.availableItemIds}); }
function showBuilder(reset = false) {
  if(reset) builder={occasion:'everyday',temperature:'mild',index:0};
  const choices=candidates(), candidate=choices[builder.index % (choices.length || 1)];
  openModal(`${modalHead('Phối một bộ mới')}<div class="form-grid"><label class="field">Bạn đi đâu?<select id="builder-occasion">${Object.entries(occasionLabels).map(([id,label])=>`<option value="${id}" ${id===builder.occasion?'selected':''}>${label}</option>`).join('')}</select></label><label class="field">Thời tiết bạn chọn<select id="builder-temp">${Object.entries(tempLabels).map(([id,label])=>`<option value="${id}" ${id===builder.temperature?'selected':''}>${label}</option>`).join('')}</select></label></div>${candidate?`<div class="builder-result"><div class="section-head"><h3>Một cách phối cho bạn</h3><span class="count">${(builder.index%choices.length)+1} / ${choices.length}</span></div>${collage(candidate)}</div><div class="field" style="margin-top:18px"><label for="outfit-name">Đặt tên bộ phối</label><input id="outfit-name" maxlength="80" placeholder="Ví dụ: Một sáng thong thả" value="${esc(occasionLabels[builder.occasion])} · bộ ${(builder.index%choices.length)+1}"></div><div class="builder-actions"><button class="btn secondary" data-action="another" ${choices.length<2?'disabled':''}>Thử cách khác ↻</button><button class="btn light" data-action="save-created">Lưu bộ phối ${icon('arrow')}</button></div>`:`<div class="empty"><h3>Chưa đủ món cho lựa chọn này.</h3><p>Cần áo + quần + giày; trời mát cần thêm áo khoác. Chọn thêm món đang có trong Tủ đồ hoặc đổi dịp, thời tiết.</p><button class="btn secondary" data-action="go-wardrobe">Về Tủ đồ</button></div>`}<p class="builder-explainer">Phối theo loại đồ, dịp sử dụng và thời tiết bạn chọn. Chỉ dùng món đang có trong tủ mẫu; đây là gợi ý theo quy tắc, không phải dịch vụ AI hay dự báo thời tiết.</p>`);
}
function showPlan(id) {
  const look=getLook(id); if(!look||!available(look,state.availableItemIds))return;
  openModal(`${modalHead('Dành bộ này cho ngày nào?')}<p style="font-size:13px;margin-bottom:20px">${esc(look.name)}</p><form id="plan-form" data-look="${esc(id)}"><label class="field">Ngày mặc<input type="date" id="plan-date" required value="${localDate()}"></label><p id="replace-note" class="note"></p><div class="builder-actions"><button class="btn light" type="submit">Lưu vào ngày này ${icon('calendar')}</button></div></form>`);
  updateReplaceNote();
}
function updateReplaceNote() {
  const input=$('#plan-date');if(!input)return;
  const old=getLook(state.plan[input.value]);
  $('#replace-note').textContent=old?`Ngày này đã có “${old.name}”. Lưu sẽ thay bộ đó; bạn có thể đổi lại trong lịch.`:'Bạn có thể đổi hoặc bỏ bộ phối trong Tuần của tôi.';
}
function showDatePicker(date) {
  const looks=allLooks().filter(x=>available(x,state.availableItemIds));
  openModal(`${modalHead(`Chọn bộ cho ${dateLabel(date,true)}`)}<p class="note" style="margin:-8px 0 20px">Chỉ hiển thị bộ có đủ món đang sẵn sàng.${state.plan[date]?' Chọn sẽ thay bộ hiện tại.':''}</p><div class="picker-grid">${looks.length?looks.map(x=>`<button class="picker-look" data-action="assign" data-id="${esc(x.id)}" data-date="${date}">${image(x.image?x:getItem(x.itemIds[0]))}<span class="subtle-tag">${esc(occasionLabels[x.occasion])}</span>${esc(x.name)}${x.source==='created'?'<small style="display:block;color:var(--muted)">Bạn phối · ảnh món đầu tiên</small>':''}</button>`).join(''):'<div class="empty"><h3>Chưa có bộ đủ món.</h3><p>Chọn thêm món trong tủ đồ hoặc tự phối bộ mới.</p><button class="btn" data-action="builder">Phối một bộ</button></div>'}</div>`);
}
function showPacking(preserve = false) {
  if(!preserve||!packingRange){const dates=weekDates(new Date(),weekOffset);packingRange={from:dates[0],to:dates[6]};}
  const {from,to}=packingRange, rows=packing(state.plan,allLooks(),data.items,from,to), range=`${from}/${to}`;
  const checked=state.packingChecks[range]||[], selectedDays=Object.keys(state.plan).filter(d=>d>=from&&d<=to).length;
  const unavailable=rows.filter(x=>!state.availableItemIds.includes(x.item.id)).length;
  const done=rows.filter(x=>checked.includes(x.item.id)).length;
  openModal(`${modalHead('Mang vừa đủ. Mặc thật vui.','THE PACKING LIST')}<div class="packing-controls"><label class="field">Từ ngày<input type="date" id="packing-from" value="${from}" required></label><label class="field">Đến ngày<input type="date" id="packing-to" value="${to}" required></label><button class="btn secondary" data-action="update-packing">Xem danh sách</button></div><div class="packing-summary">${rows.length} món riêng · ${selectedDays} ngày đã lên lịch · đã xếp ${done}/${rows.length} món</div>${unavailable?`<p class="warning" style="margin-bottom:15px">${unavailable} món trong lịch chưa sẵn sàng. Hãy kiểm tra lại tủ đồ trước khi mang.</p>`:''}<div class="packing-list">${rows.length?rows.map(({item,count})=>`<label class="packing-piece">${image(item)}<span><b>${esc(item.name)}</b><small>Dùng trong ${count} bộ${state.availableItemIds.includes(item.id)?'':' · Chưa sẵn sàng'}</small></span><input type="checkbox" data-pack="${item.id}" aria-label="Đã xếp ${esc(item.name)}" ${checked.includes(item.id)?'checked':''}></label>`).join(''):'<div class="empty"><h3>Chuyến đi bắt đầu từ một bộ phối.</h3><p>Xếp lịch cho những ngày bạn chọn, rồi quay lại đây để thấy danh sách.</p><button class="btn secondary" data-action="go-week">Về lịch của tôi</button></div>'}</div>${rows.length?'<div class="builder-actions"><button class="btn secondary" data-action="copy-packing">Sao chép danh sách</button><button class="btn" data-action="print-packing">In danh sách ↗</button></div>':''}<p class="note">Món trùng được gộp lại. Danh sách chỉ gồm trang phục trong lịch; bạn có thể cần thêm các vật dụng cá nhân khác.</p>`);
}
function showAbout() {
  openModal(`${modalHead('Một tủ đồ, thêm nhiều khả năng.','ABOUT FORME')}<div class="about-content"><p>FORME là dự án tủ đồ và lịch phối đồ cá nhân, lấy cảm hứng từ trải nghiệm khám phá trang phục của Runway. Bản thử gồm ${data.items.length} món mẫu và ${data.looks.length} bộ ảnh gợi cảm hứng.</p><p><b>Dữ liệu lưu riêng trên trình duyệt này.</b> Không có tài khoản hay đồng bộ giữa thiết bị. Xóa dữ liệu trình duyệt sẽ xóa các bộ tự phối, món đã lưu và lịch của bạn. Chế độ riêng tư có thể không giữ thay đổi.</p><p>Ảnh thật từ Pexels, được lưu cùng ứng dụng. Người mẫu và các thương hiệu trong ảnh không đại diện hay bảo trợ cho FORME. Ảnh bộ phối và ảnh món đồ là ảnh minh họa riêng biệt. <a href="./credits.html" target="_blank" rel="noopener">Xem tác giả và nguồn ảnh ↗</a></p><p>Bạn có thể tải bản sao dữ liệu để lưu trên máy, rồi khôi phục trên trình duyệt khác bằng tệp đó.</p><div class="builder-actions"><button class="btn secondary" data-action="export">Tải dữ liệu của tôi</button><button class="btn secondary" data-action="import">Khôi phục dữ liệu</button></div><input type="file" id="import-file" accept="application/json,.json" hidden><button class="text-link" style="margin-top:24px;color:#9a4b22" data-action="reset-data">Xóa dữ liệu bản thử</button></div>`);
}
function exportState() {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`forme-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã chuẩn bị tệp sao lưu.');
}
async function action(button,event) {
  const {action:a,id,value,date}=button.dataset;
  if(a)event.preventDefault();
  switch(a) {
    case 'close':modal.close();break;
    case 'builder':showBuilder(true);break;
    case 'look':showLook(id);break;
    case 'favorite': case 'favorite-detail': {
      if(!getLook(id))break;
      const found=state.favoriteOutfitIds.includes(id);
      state.favoriteOutfitIds=found?state.favoriteOutfitIds.filter(x=>x!==id):[...state.favoriteOutfitIds,id];
      persist();render();if(a==='favorite-detail')showLook(id);toast(found?'Đã bỏ lưu bộ phối.':'Đã lưu bộ phối yêu thích.');break;
    }
    case 'look-filter':lookFilter=value;render();break;
    case 'saved-filter':savedOnly=!savedOnly;render();break;
    case 'reset-look-filters':lookFilter='all';savedOnly=false;render();break;
    case 'category':category=value;renderWardrobe();break;
    case 'reset-item-filters':category='all';query='';color='all';ownedOnly=false;renderWardrobe();break;
    case 'go-wardrobe':modal.close();location.hash='wardrobe';break;
    case 'go-week':modal.close();location.hash='week';break;
    case 'another':builder.index++;showBuilder();break;
    case 'save-created': {
      const choices=candidates(),candidate=choices[builder.index%(choices.length||1)];if(!candidate)break;
      const existing=state.createdOutfits.find(x=>lookKey(x.itemIds)===candidate.key);
      if(existing){showLook(existing.id);toast('Cách phối này đã được lưu.');break;}
      if(state.createdOutfits.length>=200){toast('Bạn đã lưu 200 bộ phối. Hãy sao lưu dữ liệu trước khi tạo bản thử mới.');break;}
      const name=$('#outfit-name').value.trim().slice(0,80)||'Bộ phối của tôi';
      const look={id:`created-${crypto.randomUUID()}`,name,itemIds:candidate.itemIds,occasion:builder.occasion,temperature:builder.temperature,source:'created'};
      state.createdOutfits.push(look);state.favoriteOutfitIds.push(look.id);persist();render();showLook(look.id);toast('Đã lưu bộ phối vào mục Đã lưu.');break;
    }
    case 'plan-look':showPlan(id);break;
    case 'pick-date':showDatePicker(date);break;
    case 'assign': {
      const look=getLook(id);if(!look||!available(look,state.availableItemIds))break;
      state.plan[date]=id;persist();modal.close();render();toast(`Đã xếp ${look.name} vào ${dateLabel(date)}.`);break;
    }
    case 'clear-date':delete state.plan[date];persist();render();toast(`Đã bỏ bộ phối ngày ${dateLabel(date)}.`);break;
    case 'prev-week':weekOffset--;render();break;
    case 'next-week':weekOffset++;render();break;
    case 'this-week':weekOffset=0;render();break;
    case 'fill-week': {
      const looks=allLooks().filter(x=>available(x,state.availableItemIds));
      if(!looks.length){toast('Chưa có bộ đủ món. Hãy chọn lại món đang có trong Tủ đồ.');break;}
      let count=0;weekDates(new Date(),weekOffset).forEach((d,i)=>{if(!state.plan[d]){state.plan[d]=looks[i%looks.length].id;count++;}});
      persist();render();toast(count?`Đã điền ${count} ngày trống. Bạn có thể đổi từng bộ.`:'Tuần này đã được xếp đủ.');break;
    }
    case 'packing':showPacking();break;
    case 'update-packing': {
      const from=$('#packing-from'),to=$('#packing-to');
      if(!from.reportValidity()||!to.reportValidity())break;
      if(from.value>to.value){toast('Ngày kết thúc cần bằng hoặc sau ngày bắt đầu.');break;}
      packingRange={from:from.value,to:to.value};showPacking(true);break;
    }
    case 'copy-packing': {
      const rows=packing(state.plan,allLooks(),data.items,packingRange.from,packingRange.to);
      const checked=state.packingChecks[`${packingRange.from}/${packingRange.to}`]||[];
      const text=`FORME · ${dateLabel(packingRange.from,true)} — ${dateLabel(packingRange.to,true)}\n`+rows.map(({item,count})=>`${checked.includes(item.id)?'[x]':'[ ]'} ${item.name} · dùng trong ${count} bộ`).join('\n');
      try{await navigator.clipboard.writeText(text);toast('Đã sao chép danh sách hành lý.');}catch{toast('Trình duyệt chưa cho sao chép. Bạn có thể dùng In danh sách.');}break;
    }
    case 'print-packing':window.print();break;
    case 'about':showAbout();break;
    case 'export':exportState();break;
    case 'import':$('#import-file').click();break;
    case 'reset-data':openModal(`${modalHead('Xóa dữ liệu bản thử?')}<p style="font-size:13px">Bộ tự phối, mục đã lưu, lịch và hành lý trên trình duyệt này sẽ bị xóa. Tủ đồ mẫu sẽ được khôi phục. Bạn có thể tải bản sao trước khi xóa.</p><div class="builder-actions"><button class="btn secondary" data-action="export">Tải bản sao trước</button><button class="btn" data-action="confirm-reset">Xóa và bắt đầu lại</button></div>`);break;
    case 'confirm-reset':state=initialState(data.items);persist();modal.close();render();toast('Đã khôi phục tủ đồ mẫu.');break;
  }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)action(b,e).catch(()=>toast('Chưa thực hiện được. Hãy thử lại.'));});
document.addEventListener('input',e=>{if(e.target.id==='wardrobe-search'){query=e.target.value;renderItems();}if(e.target.id==='plan-date')updateReplaceNote();});
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.id==='wardrobe-color'){color=t.value;renderItems();}
  if(t.id==='owned-filter'){ownedOnly=t.checked;renderItems();}
  if(t.dataset.item){state.availableItemIds=t.checked?[...new Set([...state.availableItemIds,t.dataset.item])]:state.availableItemIds.filter(x=>x!==t.dataset.item);persist();renderWardrobe();toast(t.checked?'Món đồ đã sẵn sàng để phối.':'Đã bỏ món khỏi các gợi ý mới. Lịch cũ sẽ hiển thị nhắc nhở.');}
  if(t.id==='builder-occasion'||t.id==='builder-temp'){builder.occasion=$('#builder-occasion').value;builder.temperature=$('#builder-temp').value;builder.index=0;showBuilder();}
  if(t.dataset.pack){const range=`${packingRange.from}/${packingRange.to}`,ids=state.packingChecks[range]||[];state.packingChecks[range]=t.checked?[...new Set([...ids,t.dataset.pack])]:ids.filter(x=>x!==t.dataset.pack);persist();const rows=packing(state.plan,allLooks(),data.items,packingRange.from,packingRange.to),done=rows.filter(x=>state.packingChecks[range].includes(x.item.id)).length;$('.packing-summary').textContent=`${rows.length} món riêng · ${Object.keys(state.plan).filter(d=>d>=packingRange.from&&d<=packingRange.to).length} ngày đã lên lịch · đã xếp ${done}/${rows.length} món`;}
  if(t.id==='import-file'&&t.files[0]){
    const file=t.files[0];if(file.size>1000000){toast('Tệp quá lớn. Hãy chọn bản sao lưu FORME dưới 1 MB.');return;}
    try{const raw=JSON.parse(await file.text()),record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);if(!record(raw)||raw.version!==1||!Array.isArray(raw.availableItemIds)||!Array.isArray(raw.favoriteOutfitIds)||!Array.isArray(raw.createdOutfits)||!record(raw.plan)||!record(raw.packingChecks))throw new Error();state=validateState(raw,data.items,data.looks);persist();modal.close();render();toast('Đã khôi phục dữ liệu; các mục không hợp lệ được bỏ qua.');}catch{toast('Tệp chưa đúng định dạng sao lưu FORME. Dữ liệu hiện tại được giữ nguyên.');}
  }
});
document.addEventListener('submit',e=>{
  if(e.target.id!=='plan-form')return;e.preventDefault();
  const form=e.target,look=getLook(form.dataset.look),date=$('#plan-date').value;
  if(!form.reportValidity()||!look||!available(look,state.availableItemIds))return;
  state.plan[date]=look.id;persist();modal.close();location.hash='week';route='week';render();toast(`Đã xếp bộ phối vào ${dateLabel(date)}.`);
});
window.addEventListener('hashchange',()=>{
  const hash=location.hash.slice(1);if(hash==='main')return;if(hash.startsWith('look-')){showLook(hash.slice(5));return;}
  const next=['inspiration','wardrobe','week'].includes(hash)?hash:'inspiration';
  if(route!==next){route=next;render();window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}
});
try {
  const response=await fetch('./data.json');if(!response.ok)throw new Error('data');data=await response.json();state=readState();
  route=['wardrobe','week'].includes(location.hash.slice(1))?location.hash.slice(1):'inspiration';render();
  if(location.hash.startsWith('#look-'))showLook(location.hash.slice(6));
  if(storageWarning)$('#storage-notice').hidden=false;
} catch {
  main.innerHTML='<div class="container"><div class="empty" style="margin:50px 0"><h1 style="font-size:36px">Tủ đồ chưa tải được.</h1><p>Hãy tải lại trang để thử lại.</p><button class="btn" id="reload-page">Tải lại trang</button></div></div>';
  $('#reload-page')?.addEventListener('click',()=>location.reload());
}
