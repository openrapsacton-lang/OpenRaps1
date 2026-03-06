const CATEGORIES = ['Vodka', 'Tequila', 'Rum', 'Whiskey', 'Gin', 'Liqueur', 'Wine', 'Beer', 'Syrups+', 'NA', 'Other'];
const STATUSES = ['FULL', 'LOW', 'OUT', 'ORDERED', 'DISCONTINUED'];

const TAB_KEYS = ['Total Stock', 'Liquor', 'Wine', 'Beer', 'Syrups+'];
const LIQUOR_CATEGORIES = ['Vodka', 'Tequila', 'Rum', 'Whiskey', 'Gin', 'Liqueur'];
const TAB_STORAGE_KEY = 'barInventoryTabStateV1';
const UNIT_OPTIONS = ['Bottle', 'Keg', '4Pk', 'Can'];

function createDefaultTabState() {
  return {
    search: '',
    status: '',
    sort: 'status',
    order: 'desc',
    category: '',
    wineType: 'All',
    beerPackaging: 'All'
  };
}

function createDefaultAllTabState() {
  return {
    'Total Stock': createDefaultTabState(),
    Liquor: { ...createDefaultTabState(), category: '' },
    Wine: { ...createDefaultTabState(), category: 'Wine', wineType: 'All' },
    Beer: { ...createDefaultTabState(), category: 'Beer', beerPackaging: 'All' },
    'Syrups+': { ...createDefaultTabState(), category: 'Syrups+' }
  };
}

const state = {
  items: [],
  activeTab: 'Total Stock',
  tabState: createDefaultAllTabState(),
  filters: {
    search: '',
    category: '',
    status: '',
    sort: 'status',
    order: 'desc'
  },
  wineType: 'All',
  beerPackaging: 'All'
};

const $ = (selector) => document.querySelector(selector);

const itemDialog = $('#item-dialog');
const itemForm = $('#item-form');
const historyDialog = $('#history-dialog');
const stickyControls = $('#sticky-controls');
const searchInput = $('#search-input');
const clearSearchBtn = $('#clear-search-btn');
const mobileQuickList = $('#mobile-quick-list');
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const wineTypeWrap = $('#wine-type-wrap');
const wineTypeFilter = $('#wine-type-filter');
const beerPackagingWrap = $('#beer-packaging-wrap');
const beerPackagingFilter = $('#beer-packaging-filter');
const wineTypeInputWrap = $('#wine-type-input-wrap');
const wineTypeInput = $('#wine_type');
const undoStack = [];
const redoStack = [];
const mobileAddItemBtn = $('#mobile-add-item-btn');
const mobileUndoBtn = $('#mobile-undo-btn');
const mobileRedoBtn = $('#mobile-redo-btn');


function fillSelect(selectEl, values, includeAll = false) {
  selectEl.innerHTML = '';
  if (includeAll) {
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All';
    selectEl.appendChild(allOpt);
  }

  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  }
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.style.background = isError ? '#b91c1c' : '#111827';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 5500);
}

function setLoading(isLoading) {
  $('#loading-indicator').classList.toggle('hidden', !isLoading);
}

function toLocalDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!res.ok) {
    let payload = {};
    try {
      payload = await res.json();
    } catch (_e) {
      payload = {};
    }
    throw new Error(payload.details ? payload.details.join(' ') : payload.error || 'Request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

function getCurrentUiState() {
  return {
    search: searchInput.value.trim(),
    category: $('#category-filter').value,
    status: $('#status-filter').value,
    sort: $('#sort-field').value,
    order: $('#sort-order').value,
    wineType: wineTypeFilter.value,
    beerPackaging: beerPackagingFilter.value
  };
}

function saveCurrentTabState() {
  state.tabState[state.activeTab] = {
    ...state.tabState[state.activeTab],
    ...getCurrentUiState()
  };
  persistTabPreferences();
}

function applyTabConstraints(tab, uiState) {
  const nextState = { ...uiState };

  if (tab === 'Total Stock') {
    return nextState;
  }

  if (tab === 'Liquor') {
    if (nextState.category && !LIQUOR_CATEGORIES.includes(nextState.category)) {
      nextState.category = '';
    }
    return nextState;
  }

  if (tab === 'Wine') {
    nextState.category = 'Wine';
    if (!['All', 'Red', 'White'].includes(nextState.wineType)) {
      nextState.wineType = 'All';
    }
    return nextState;
  }

  if (tab === 'Beer') {
    nextState.category = 'Beer';
    if (!['All', 'Kegs', 'Cans'].includes(nextState.beerPackaging)) {
      nextState.beerPackaging = 'All';
    }
    return nextState;
  }

  if (tab === 'Syrups+') {
    nextState.category = 'Syrups+';
  }

  return nextState;
}

function syncCategoryFilterForActiveTab(preferredCategory = '') {
  const categoryFilter = $('#category-filter');

  if (state.activeTab === 'Liquor') {
    fillSelect(categoryFilter, LIQUOR_CATEGORIES, true);
    categoryFilter.value = preferredCategory && LIQUOR_CATEGORIES.includes(preferredCategory) ? preferredCategory : '';
    return;
  }

  if (state.activeTab === 'Wine') {
    fillSelect(categoryFilter, ['Wine'], false);
    categoryFilter.value = 'Wine';
    return;
  }

  if (state.activeTab === 'Beer') {
    fillSelect(categoryFilter, ['Beer'], false);
    categoryFilter.value = 'Beer';
    return;
  }

  if (state.activeTab === 'Syrups+') {
    fillSelect(categoryFilter, ['Syrups+'], false);
    categoryFilter.value = 'Syrups+';
    return;
  }

  fillSelect(categoryFilter, CATEGORIES, true);
  categoryFilter.value = preferredCategory && CATEGORIES.includes(preferredCategory) ? preferredCategory : '';
}

function updateTabSpecificControls() {
  wineTypeWrap.classList.toggle('hidden', state.activeTab !== 'Wine');
  beerPackagingWrap.classList.toggle('hidden', state.activeTab !== 'Beer');
}

function toggleClearSearchButton() {
  clearSearchBtn.classList.toggle('hidden', !searchInput.value);
}

function loadTabStateIntoUI(tab) {
  const savedState = applyTabConstraints(tab, state.tabState[tab] || createDefaultTabState());
  state.tabState[tab] = savedState;

  searchInput.value = savedState.search || '';
  toggleClearSearchButton();
  $('#status-filter').value = savedState.status || '';
  $('#sort-field').value = savedState.sort || 'status';
  $('#sort-order').value = savedState.order || 'desc';
  wineTypeFilter.value = savedState.wineType || 'All';
  beerPackagingFilter.value = savedState.beerPackaging || 'All';
  syncCategoryFilterForActiveTab(savedState.category || '');

  state.filters.search = searchInput.value;
  state.filters.status = $('#status-filter').value;
  state.filters.sort = $('#sort-field').value;
  state.filters.order = $('#sort-order').value;
  state.filters.category = $('#category-filter').value;
  state.wineType = wineTypeFilter.value;
  state.beerPackaging = beerPackagingFilter.value;

  updateTabSpecificControls();
}

function updateTabButtons() {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === state.activeTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function switchTab(newTab) {
  if (!TAB_KEYS.includes(newTab) || newTab === state.activeTab) return;
  saveCurrentTabState();
  state.activeTab = newTab;
  loadTabStateIntoUI(newTab);
  updateTabButtons();
  persistTabPreferences();
  loadItems();
}

function detectBeerPackaging(item) {
  const value = `${item.unit || ''} ${item.name || ''} ${item.notes || ''}`.toLowerCase();
  if (/\b(keg|sixtel|half|full)\b/.test(value)) return 'Kegs';
  if (/\b(can|4pack|4-pack|4pk|case|pack)\b/.test(value)) return 'Cans';
  return 'Other';
}

function getBeerPackagingLabel(item) {
  const packaging = detectBeerPackaging(item);
  const raw = `${item.unit || ''} ${item.name || ''} ${item.notes || ''}`.toLowerCase();
  if (packaging === 'Kegs') return 'KEG';
  if (/\b4pack|4-pack|4pk\b/.test(raw)) return '4PK';
  if (/\bcase\b/.test(raw)) return 'CASE';
  if (packaging === 'Cans') return 'CAN';
  return '';
}

function getWineTypeBadge(item) {
  if (item.category !== 'Wine' || !item.wine_type) return '';
  return ` <span class="wine-type-badge wine-type-${item.wine_type.toLowerCase()}">${item.wine_type}</span>`;
}

function matchesWineType(item, wineType) {
  if (wineType === 'All') return true;
  if (item.wine_type === wineType) return true;
  const notes = (item.notes || '').toLowerCase();
  if (!notes.trim()) return false;
  if (wineType === 'Red') return notes.includes('red');
  if (wineType === 'White') return notes.includes('white');
  return true;
}

function getEffectiveQueryParamsFromUI() {
  const uiState = applyTabConstraints(state.activeTab, {
    search: state.filters.search,
    category: state.filters.category,
    status: state.filters.status,
    sort: state.filters.sort,
    order: state.filters.order,
    wineType: state.wineType,
    beerPackaging: state.beerPackaging
  });

  const params = new URLSearchParams();
  if (uiState.search) params.set('search', uiState.search);
  if (uiState.category) params.set('category', uiState.category);
  if (uiState.status) params.set('status', uiState.status);
  if (uiState.sort) params.set('sort', uiState.sort);
  if (uiState.order) params.set('order', uiState.order);
  return params;
}

function applyClientFilters(items) {
  return items.filter((item) => {
    if (state.activeTab === 'Liquor' && !LIQUOR_CATEGORIES.includes(item.category)) {
      return false;
    }

    if (state.activeTab === 'Wine' && !matchesWineType(item, state.wineType)) {
      return false;
    }

    if (state.activeTab === 'Beer') {
      if (state.beerPackaging === 'Kegs' && detectBeerPackaging(item) !== 'Kegs') return false;
      if (state.beerPackaging === 'Cans' && detectBeerPackaging(item) !== 'Cans') return false;
    }

    return true;
  });
}

function persistTabPreferences() {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify({
      activeTab: state.activeTab,
      tabState: state.tabState
    }));
  } catch (_e) {
    // ignore storage issues
  }
}

function restoreTabPreferences() {
  try {
    const raw = localStorage.getItem(TAB_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.tabState && typeof parsed.tabState === 'object') {
      for (const tab of TAB_KEYS) {
        state.tabState[tab] = applyTabConstraints(tab, {
          ...createDefaultTabState(),
          ...(parsed.tabState[tab] || {})
        });
      }
    }
    if (TAB_KEYS.includes(parsed.activeTab)) {
      state.activeTab = parsed.activeTab;
    }
  } catch (_e) {
    // ignore storage issues
  }
}

function buildQuery() {
  return getEffectiveQueryParamsFromUI().toString();
}

async function loadItems() {
  setLoading(true);
  closeAllActionMenus();
  try {
    const items = await api(`/api/items?${buildQuery()}`);
    state.items = applyClientFilters(items);
    renderTable();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    setLoading(false);
  }
}

function getRowClassForStatus(status) {
  if (status === 'OUT') return 'row-out';
  if (status === 'LOW') return 'row-low';
  if (status === 'ORDERED') return 'row-ordered';
  if (status === 'DISCONTINUED') return 'row-discontinued';
  return '';
}

function getQuickCardStatusClass(status) {
  if (status === 'OUT') return 'quick-card--out';
  if (status === 'LOW') return 'quick-card--low';
  if (status === 'DISCONTINUED') return 'quick-card--discontinued';
  return '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\$&');
}

function highlightName(name, search) {
  const safeName = escapeHtml(name);
  const query = (search || '').trim();
  if (!query) return safeName;

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  return safeName.replace(regex, '<mark>$1</mark>');
}

function renderTable() {
  const tbody = $('#items-table tbody');
  const mobileList = $('#mobile-quick-list');
  tbody.innerHTML = '';
  mobileQuickList.innerHTML = '';

  $('#empty-state').classList.toggle('hidden', state.items.length > 0);

  for (const item of state.items) {
    const rowClass = getRowClassForStatus(item.status);

    const tr = document.createElement('tr');
    tr.dataset.itemId = String(item.id);
    if (rowClass) tr.classList.add(rowClass);
    tr.innerHTML = `
      <td>${item.name}${getWineTypeBadge(item)}${state.activeTab === 'Beer' && getBeerPackagingLabel(item) ? ` <span class="packaging-badge">(${getBeerPackagingLabel(item)})</span>` : ''}</td>
      <td>
        <span class="status-pill status-${item.status}">${item.status}</span>
      </td>
      <td>${item.quantity}</td>
      <td>
        <div class="row-actions">
            <button class="btn" data-action="minus" data-id="${item.id}">-1</button>
            <button class="btn" data-action="plus" data-id="${item.id}">+1</button>
            <button class="btn" data-action="plus10" data-id="${item.id}">+10</button>
            <button class="btn" data-action="mark-low" data-id="${item.id}">Low</button>
            <button class="btn" data-action="mark-full" data-id="${item.id}">Full</button>
            <button class="btn" data-action="mark-out" data-id="${item.id}">OUT</button>
            <button class="btn" data-action="edit" data-id="${item.id}">Edit</button>
            <button class="btn" data-action="history" data-id="${item.id}">History</button>
            <select data-action="status" data-id="${item.id}">
              ${STATUSES.map((s) => `<option value="${s}" ${s === item.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    const card = document.createElement('article');
    const statusClass = getQuickCardStatusClass(item.status);
    card.className = `quick-card ${statusClass}`.trim();
    card.dataset.itemId = String(item.id);
    card.innerHTML = `
      <div class="quick-card-head">
        <h3 class="quick-name" title="${escapeHtml(item.name)}">${highlightName(item.name, state.filters.search)}${getWineTypeBadge(item)}${state.activeTab === 'Beer' && getBeerPackagingLabel(item) ? ` <span class="packaging-badge">(${getBeerPackagingLabel(item)})</span>` : ''}</h3>
        <span class="status-pill status-${item.status}">${item.status}</span>
      </div>
      <p class="quick-quantity" aria-label="Quantity ${item.quantity}">${item.quantity}</p>
      <div class="quick-actions">
        <button class="btn quick-btn" data-action="minus" data-id="${item.id}">-1</button>
        <button class="btn quick-btn" data-action="plus" data-id="${item.id}">+1</button>
        <button class="btn quick-btn" data-action="plus10" data-id="${item.id}">+10</button>
        <button class="btn quick-btn" data-action="mark-low" data-id="${item.id}">LOW</button>
        <button class="btn quick-btn" data-action="mark-out" data-id="${item.id}">OUT</button>
      </div>
    `;
    mobileQuickList.appendChild(card);
  }
}

function isMobileQuickMode() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function isMobilePortraitMode() {
  return window.matchMedia('(max-width: 900px) and (orientation: portrait)').matches;
}

function syncResponsiveMode() {
  document.body.classList.toggle('mobile-quick-mode', isMobileQuickMode());
  document.body.classList.toggle('mobile-portrait-mode', isMobilePortraitMode());
}

function focusSearchForMobileQuickMode() {
  if (!isMobilePortraitMode()) return;
  requestAnimationFrame(() => {
    searchInput.focus({ preventScroll: true });
  });
}



function flashItemFeedback(id) {
  const selector = `[data-item-id="${id}"]`;
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.remove('action-flash');
    void el.offsetWidth;
    el.classList.add('action-flash');
  });
}

function updateItemInState(updatedItem) {
  const idx = state.items.findIndex((item) => item.id === updatedItem.id);
  if (idx === -1) return;
  state.items[idx] = updatedItem;
}


function closeAllActionMenus() {
  document.querySelectorAll('.actions-menu').forEach((menu) => menu.classList.add('hidden'));
}

function toggleMenuForRow(id) {
  const target = document.querySelector(`.actions-menu[data-menu-id="${id}"]`);
  if (!target) return;
  const isHidden = target.classList.contains('hidden');
  closeAllActionMenus();
  if (isHidden) target.classList.remove('hidden');
}

function syncWineTypeInputVisibility() {
  const isWine = $('#category').value === 'Wine';
  wineTypeInputWrap.classList.toggle('hidden', !isWine);
  if (!isWine) {
    wineTypeInput.value = '';
  }
}

function resetForm() {
  $('#item-id').value = '';
  $('#name').value = '';
  $('#category').value = CATEGORIES[0];
  $('#quantity').value = '0';
  $('#unit').value = 'Bottle';
  $('#status').value = 'FULL';
  $('#par_level').value = '0';
  wineTypeInput.value = '';
  $('#notes').value = '';
  $('#form-error').textContent = '';
  syncWineTypeInputVisibility();
}

function normalizeUnitValue(unitValue) {
  const rawUnit = String(unitValue || '').trim();
  if (!rawUnit) return 'Bottle';

  const match = UNIT_OPTIONS.find((option) => option.toLowerCase() === rawUnit.toLowerCase());
  if (match) return match;

  const unitSelect = $('#unit');
  const dynamicOption = document.createElement('option');
  dynamicOption.value = rawUnit;
  dynamicOption.textContent = rawUnit;
  unitSelect.appendChild(dynamicOption);
  return rawUnit;
}

function openCreateModal() {
  $('#form-title').textContent = 'Add Item';
  $('#delete-btn').classList.add('hidden');
  resetForm();
  itemDialog.showModal();
}

function openEditModal(item) {
  $('#form-title').textContent = 'Edit Item';
  $('#delete-btn').classList.remove('hidden');
  $('#item-id').value = item.id;
  $('#name').value = item.name;
  $('#category').value = item.category;
  $('#quantity').value = item.quantity;
  $('#unit').value = normalizeUnitValue(item.unit);
  $('#status').value = item.status;
  $('#par_level').value = item.par_level;
  wineTypeInput.value = item.wine_type || '';
  $('#notes').value = item.notes || '';
  $('#form-error').textContent = '';
  syncWineTypeInputVisibility();
  itemDialog.showModal();
}


function cloneItem(item) {
  return item ? JSON.parse(JSON.stringify(item)) : null;
}

function getItemById(id) {
  return state.items.find((item) => item.id === Number(id)) || null;
}

function updateUndoRedoButtons() {
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  $('#undo-btn').disabled = !canUndo;
  $('#redo-btn').disabled = !canRedo;
  if (mobileUndoBtn) mobileUndoBtn.disabled = !canUndo;
  if (mobileRedoBtn) mobileRedoBtn.disabled = !canRedo;
}

function pushUndoAction(action) {
  undoStack.push(action);
  redoStack.length = 0;
  updateUndoRedoButtons();
}

function actionLabel(action) {
  const labels = {
    quantity: 'quantity change',
    status: 'status change',
    edit: 'item edit',
    add: 'add item',
    delete: 'delete item'
  };
  return labels[action.type] || 'action';
}

function toCreatePayload(item) {
  const payload = cloneItem(item);
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;
  return payload;
}

async function applyUndo(action) {
  if (action.type === 'quantity' || action.type === 'status' || action.type === 'edit') {
    await api(`/api/items/${action.afterSnapshot.id}`, {
      method: 'PUT',
      body: JSON.stringify(toCreatePayload(action.beforeSnapshot))
    });
    return;
  }

  if (action.type === 'add') {
    await api(`/api/items/${action.createdSnapshot.id}`, { method: 'DELETE' });
    return;
  }

  if (action.type === 'delete') {
    await api('/api/items', {
      method: 'POST',
      body: JSON.stringify(toCreatePayload(action.deletedSnapshot))
    });
  }
}

async function applyRedo(action) {
  if (action.type === 'quantity' || action.type === 'status' || action.type === 'edit') {
    await api(`/api/items/${action.beforeSnapshot.id}`, {
      method: 'PUT',
      body: JSON.stringify(toCreatePayload(action.afterSnapshot))
    });
    return;
  }

  if (action.type === 'add') {
    await api('/api/items', {
      method: 'POST',
      body: JSON.stringify(toCreatePayload(action.createdSnapshot))
    });
    return;
  }

  if (action.type === 'delete') {
    const existing = state.items.find((item) => item.name === action.deletedSnapshot.name);
    if (existing) {
      await api(`/api/items/${existing.id}`, { method: 'DELETE' });
    }
  }
}

async function handleUndo() {
  if (!undoStack.length) return;
  const action = undoStack.pop();
  try {
    await applyUndo(action);
    redoStack.push(action);
    showToast(`Undid: ${actionLabel(action)}.`);
    await loadItems();
  } catch (err) {
    undoStack.push(action);
    showToast(err.message, true);
  } finally {
    updateUndoRedoButtons();
  }
}

async function handleRedo() {
  if (!redoStack.length) return;
  const action = redoStack.pop();
  try {
    await applyRedo(action);
    undoStack.push(action);
    showToast(`Redid: ${actionLabel(action)}.`);
    await loadItems();
  } catch (err) {
    redoStack.push(action);
    showToast(err.message, true);
  } finally {
    updateUndoRedoButtons();
  }
}

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
    const isRedo = (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));

    if (!isUndo && !isRedo) return;

    const targetTag = (event.target.tagName || '').toLowerCase();
    const isTyping = ['input', 'textarea', 'select'].includes(targetTag) || event.target.isContentEditable;
    if (isTyping) return;

    event.preventDefault();
    if (isUndo) {
      handleUndo();
    } else {
      handleRedo();
    }
  });
}

function wireStickyTopBar() {
  function updateStickyState() {
    stickyControls.classList.toggle('is-sticky', window.scrollY > 8);
  }

  window.addEventListener('scroll', updateStickyState, { passive: true });
  window.addEventListener('resize', updateStickyState, { passive: true });
  updateStickyState();
}


function wireMobileLongPressEdit() {
  let timer = null;
  let startX = 0;
  let startY = 0;
  let targetItemId = null;
  const movementThreshold = 12;
  const longPressDelayMs = 520;

  function clearTimer() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    targetItemId = null;
  }

  function startPress(event) {
    if (!isMobileQuickMode()) return;
    if (event.target.closest('button, select, input, a')) return;

    const card = event.target.closest('.quick-card');
    if (!card) return;

    startX = event.clientX ?? 0;
    startY = event.clientY ?? 0;
    clearTimer();
    targetItemId = Number(card.dataset.itemId);

    timer = setTimeout(() => {
      const item = getItemById(targetItemId);
      if (item) {
        showToast(`Editing ${item.name}`);
        openEditModal(item);
      }
      clearTimer();
    }, longPressDelayMs);
  }

  function movePress(event) {
    if (!timer) return;
    const currentX = event.clientX ?? startX;
    const currentY = event.clientY ?? startY;
    const movedX = Math.abs(currentX - startX);
    const movedY = Math.abs(currentY - startY);
    if (movedX > movementThreshold || movedY > movementThreshold) {
      clearTimer();
    }
  }

  mobileQuickList.addEventListener('pointerdown', startPress, { passive: true });
  mobileQuickList.addEventListener('pointermove', movePress, { passive: true });
  mobileQuickList.addEventListener('pointerup', clearTimer, { passive: true });
  mobileQuickList.addEventListener('pointercancel', clearTimer, { passive: true });
  mobileQuickList.addEventListener('scroll', clearTimer, { passive: true });
  window.addEventListener('scroll', clearTimer, { passive: true });

  mobileQuickList.addEventListener('click', (event) => {
    if (event.target.closest('button, select, input, a')) {
      clearTimer();
    }
  });
}

async function handleSave(event) {
  event.preventDefault();
  const id = $('#item-id').value;
  const body = {
    name: $('#name').value,
    category: $('#category').value,
    quantity: Number($('#quantity').value),
    unit: $('#unit').value,
    status: $('#status').value,
    par_level: Number($('#par_level').value),
    wine_type: wineTypeInput.value,
    notes: $('#notes').value
  };

  try {
    if (id) {
      const beforeSnapshot = cloneItem(getItemById(id));
      const updatedItem = await api(`/api/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      pushUndoAction({
        type: 'edit',
        beforeSnapshot,
        afterSnapshot: cloneItem(updatedItem)
      });
      showToast('Item updated successfully.');
    } else {
      const createdItem = await api('/api/items', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      pushUndoAction({
        type: 'add',
        createdSnapshot: cloneItem(createdItem)
      });
      showToast('Item added successfully.');
    }

    itemDialog.close();
    await loadItems();
  } catch (err) {
    $('#form-error').textContent = err.message;
  }
}

async function handleDeleteCurrentItem() {
  const id = $('#item-id').value;
  if (!id) return;
  const confirmed = confirm('Delete this item permanently?');
  if (!confirmed) return;

  try {
    const deletedSnapshot = cloneItem(getItemById(id));
    await api(`/api/items/${id}`, { method: 'DELETE' });
    pushUndoAction({
      type: 'delete',
      deletedSnapshot
    });
    itemDialog.close();
    showToast('Item deleted.');
    await loadItems();
  } catch (err) {
    $('#form-error').textContent = err.message;
  }
}

async function handleRowAction(event) {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || action === 'status') return;

  if (action === 'toggle-menu') {
    event.stopPropagation();
    toggleMenuForRow(id);
    return;
  }

  if (!id) return;

  const item = state.items.find((i) => i.id === Number(id));
  if (!item) return;

  try {
    let afterSnapshot = null;

    if (action === 'plus' || action === 'minus') {
      const beforeSnapshot = cloneItem(item);
      afterSnapshot = await api(`/api/items/${id}/quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ delta: action === 'plus' ? 1 : -1 })
      });
      pushUndoAction({ type: 'quantity', beforeSnapshot, afterSnapshot: cloneItem(afterSnapshot) });
      showToast('Quantity updated.');
    }

    if (action === 'plus10') {
      const beforeSnapshot = cloneItem(item);
      afterSnapshot = await api(`/api/items/${id}/quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ delta: 10 })
      });
      pushUndoAction({ type: 'quantity', beforeSnapshot, afterSnapshot: cloneItem(afterSnapshot) });
      showToast('Quantity increased by 10.');
    }

    if (action === 'mark-low' || action === 'mark-full') {
      const beforeSnapshot = cloneItem(item);
      const status = action === 'mark-low' ? 'LOW' : 'FULL';
      afterSnapshot = await api(`/api/items/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      pushUndoAction({ type: 'status', beforeSnapshot, afterSnapshot: cloneItem(afterSnapshot) });
      showToast(`Status updated to ${status}.`);
    }

    if (action === 'mark-out') {
      const beforeSnapshot = cloneItem(item);
      await api(`/api/items/${id}/quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: 0 })
      });
      afterSnapshot = await api(`/api/items/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'OUT' })
      });
      pushUndoAction({ type: 'status', beforeSnapshot, afterSnapshot: cloneItem(afterSnapshot) });
      showToast('Item marked OUT.');
    }

    if (action === 'edit') {
      closeAllActionMenus();
      openEditModal(item);
      return;
    }

    if (action === 'history') {
      closeAllActionMenus();
      await openHistory(id);
      return;
    }

    if (afterSnapshot) {
      updateItemInState(afterSnapshot);
      renderTable();
      flashItemFeedback(id);
      return;
    }

    await loadItems();
  } catch (err) {
    showToast(err.message, true);
  }
}


async function handleStatusInlineChange(event) {
  if (event.target.dataset.action !== 'status') return;
  const id = event.target.dataset.id;
  const status = event.target.value;

  try {
    const beforeSnapshot = cloneItem(getItemById(id));
    const afterSnapshot = await api(`/api/items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    pushUndoAction({ type: 'status', beforeSnapshot, afterSnapshot: cloneItem(afterSnapshot) });
    showToast('Status updated.');
    await loadItems();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function openHistory(itemId) {
  try {
    const events = await api(`/api/items/${itemId}/events`);
    const list = $('#history-list');
    list.innerHTML = '';

    if (!events.length) {
      list.innerHTML = '<li>No history yet.</li>';
    } else {
      for (const evt of events) {
        const li = document.createElement('li');
        li.textContent = `${toLocalDate(evt.created_at)} — ${evt.action} — ${evt.details_json}`;
        list.appendChild(li);
      }
    }

    historyDialog.showModal();
  } catch (err) {
    showToast(err.message, true);
  }
}


function csvValue(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function createCsvContent(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map((row) => columns.map((column) => csvValue(row[column])).join(','));
  return [header, ...lines].join('\n');
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportFullInventoryCsv() {
  const columns = ['name', 'category', 'unit', 'quantity', 'status', 'par_level', 'notes', 'updated_at'];
  const rows = state.items.map((item) => ({
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity,
    status: item.status,
    par_level: item.par_level,
    notes: item.notes || '',
    updated_at: item.updated_at || ''
  }));

  const csvContent = createCsvContent(rows, columns);
  downloadCsv(`bar_inventory_full_${dateStamp()}.csv`, csvContent);
  showToast(`Exported ${rows.length} item(s) to CSV.`);
}

function matchesOrderListFilters(item) {
  if (!['OUT', 'LOW'].includes(item.status)) return false;

  const search = state.filters.search.toLowerCase();
  const matchesSearch = !search
    || item.name.toLowerCase().includes(search)
    || (item.notes || '').toLowerCase().includes(search);
  const matchesCategory = !state.filters.category || item.category === state.filters.category;

  return matchesSearch && matchesCategory;
}

async function exportOrderListCsv() {
  try {
    const rows = state.items
      .filter((item) => ['OUT', 'LOW'].includes(item.status))
      .map((item) => ({
        name: item.name,
        category: item.category,
        unit: item.unit,
        quantity: item.quantity,
        par_level: item.par_level,
        status: item.status,
        notes: item.notes || ''
      }));

    const columns = ['name', 'category', 'unit', 'quantity', 'par_level', 'status', 'notes'];
    const csvContent = createCsvContent(rows, columns);
    downloadCsv(`bar_inventory_order_${dateStamp()}.csv`, csvContent);
    showToast(`Exported ${rows.length} order-list item(s) to CSV.`);
  } catch (err) {
    showToast(err.message, true);
  }
}

function wireUpFilters() {
  searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value.trim();
    toggleClearSearchButton();
    saveCurrentTabState();
    loadItems();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.filters.search = '';
    toggleClearSearchButton();
    saveCurrentTabState();
    loadItems();
    searchInput.focus();
  });

  $('#category-filter').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    saveCurrentTabState();
    loadItems();
  });

  $('#status-filter').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    saveCurrentTabState();
    loadItems();
  });

  $('#sort-field').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    saveCurrentTabState();
    loadItems();
  });

  $('#sort-order').addEventListener('change', (e) => {
    state.filters.order = e.target.value;
    saveCurrentTabState();
    loadItems();
  });

  wineTypeFilter.addEventListener('change', (e) => {
    state.wineType = e.target.value;
    saveCurrentTabState();
    loadItems();
  });

  beerPackagingFilter.addEventListener('change', (e) => {
    state.beerPackaging = e.target.value;
    saveCurrentTabState();
    loadItems();
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

}

function init() {
  restoreTabPreferences();
  fillSelect($('#category-filter'), CATEGORIES, true);
  fillSelect($('#status-filter'), STATUSES, true);
  fillSelect($('#category'), CATEGORIES, false);
  fillSelect($('#status'), STATUSES, false);
  fillSelect($('#unit'), UNIT_OPTIONS, false);

  $('#sort-field').value = state.filters.sort;
  $('#sort-order').value = state.filters.order;
  loadTabStateIntoUI(state.activeTab);
  updateTabButtons();

  wireUpFilters();
  wireKeyboardShortcuts();
  wireStickyTopBar();
  wireMobileLongPressEdit();

  $('#add-item-btn').addEventListener('click', openCreateModal);
  if (mobileAddItemBtn) mobileAddItemBtn.addEventListener('click', openCreateModal);
  $('#undo-btn').addEventListener('click', handleUndo);
  if (mobileUndoBtn) mobileUndoBtn.addEventListener('click', handleUndo);
  $('#redo-btn').addEventListener('click', handleRedo);
  if (mobileRedoBtn) mobileRedoBtn.addEventListener('click', handleRedo);
  $('#export-full-btn').addEventListener('click', exportFullInventoryCsv);
  $('#export-order-btn').addEventListener('click', exportOrderListCsv);
  itemForm.addEventListener('submit', handleSave);
  $('#cancel-btn').addEventListener('click', () => itemDialog.close());
  $('#delete-btn').addEventListener('click', handleDeleteCurrentItem);
  $('#category').addEventListener('change', syncWineTypeInputVisibility);
  $('#items-table tbody').addEventListener('click', handleRowAction);
  $('#mobile-quick-list').addEventListener('click', handleRowAction);
  $('#items-table tbody').addEventListener('change', handleStatusInlineChange);
  $('#items-table tbody').addEventListener('mousedown', (event) => {
    if (event.target.closest('select, button, input, a, .row-actions')) {
      event.stopPropagation();
    }
  });
  $('#history-close').addEventListener('click', () => historyDialog.close());

  syncResponsiveMode();
  focusSearchForMobileQuickMode();
  window.addEventListener('resize', () => {
    syncResponsiveMode();
    focusSearchForMobileQuickMode();
  }, { passive: true });
  window.addEventListener('orientationchange', () => {
    syncResponsiveMode();
    focusSearchForMobileQuickMode();
  });

  updateUndoRedoButtons();
  loadItems();
}

init();
