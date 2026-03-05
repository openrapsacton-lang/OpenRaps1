const CATEGORIES = ['Vodka', 'Tequila', 'Rum', 'Whiskey', 'Gin', 'Liqueur', 'Wine', 'Beer', 'NA', 'Other', 'Syrups+'];
const STATUSES = ['FULL', 'LOW', 'OUT', 'ORDERED', 'DISCONTINUED'];
const TABS = ['Total Stock', 'Liquor', 'Wine', 'Beer', 'Syrups+'];
const LIQUOR_CATEGORIES = ['Vodka', 'Tequila', 'Rum', 'Whiskey', 'Gin', 'Liqueur'];
const TAB_STORAGE_KEY = 'barInventoryTabViewStateV1';

const defaultTabViewState = () => ({
  search: '',
  status: '',
  sort: 'status',
  order: 'desc',
  category: '',
  wineType: '',
  beerPackaging: ''
});

const state = {
  allItems: [],
  items: [],
  filters: {
    search: '',
    category: '',
    status: '',
    sort: 'status',
    order: 'desc',
    wineType: '',
    beerPackaging: ''
  },
  activeTab: 'Total Stock',
  tabState: Object.fromEntries(TABS.map((tab) => [tab, defaultTabViewState()]))
};

const $ = (selector) => document.querySelector(selector);

const itemDialog = $('#item-dialog');
const itemForm = $('#item-form');
const historyDialog = $('#history-dialog');
const topBar = $('#top-bar');
const searchInput = $('#search-input');
const mobileQuickList = $('#mobile-quick-list');
const undoStack = [];
const redoStack = [];

function restoreTabState() {
  try {
    const raw = localStorage.getItem(TAB_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.activeTab && TABS.includes(parsed.activeTab)) {
      state.activeTab = parsed.activeTab;
    }
    if (parsed.tabState && typeof parsed.tabState === 'object') {
      for (const tab of TABS) {
        state.tabState[tab] = {
          ...defaultTabViewState(),
          ...(parsed.tabState[tab] || {})
        };
      }
    }
  } catch (_err) {
    // ignore bad localStorage payloads
  }
}

function persistTabState() {
  localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify({
    activeTab: state.activeTab,
    tabState: state.tabState
  }));
}

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

function applyCategoryOptionsForTab(tabName, desiredValue = '') {
  const categoryFilter = $('#category-filter');
  if (tabName === 'Liquor') {
    fillSelect(categoryFilter, LIQUOR_CATEGORIES, true);
  } else if (tabName === 'Wine') {
    fillSelect(categoryFilter, ['Wine'], false);
  } else if (tabName === 'Beer') {
    fillSelect(categoryFilter, ['Beer'], false);
  } else if (tabName === 'Syrups+') {
    fillSelect(categoryFilter, ['Syrups+'], false);
  } else {
    fillSelect(categoryFilter, CATEGORIES, true);
  }

  const safeValue = Array.from(categoryFilter.options).some((opt) => opt.value === desiredValue)
    ? desiredValue
    : categoryFilter.options[0]?.value || '';

  categoryFilter.value = safeValue;
}

function saveCurrentTabStateFromUI() {
  const tab = state.activeTab;
  const current = state.tabState[tab] || defaultTabViewState();
  state.tabState[tab] = {
    ...current,
    search: $('#search-input').value.trim(),
    status: $('#status-filter').value,
    sort: $('#sort-field').value,
    order: $('#sort-order').value,
    category: $('#category-filter').value,
    wineType: $('#wine-type-filter').value,
    beerPackaging: $('#beer-packaging-filter').value
  };
}

function loadTabStateIntoUI(tabName) {
  const tabViewState = state.tabState[tabName] || defaultTabViewState();
  $('#search-input').value = tabViewState.search || '';
  $('#status-filter').value = tabViewState.status || '';
  $('#sort-field').value = tabViewState.sort || 'status';
  $('#sort-order').value = tabViewState.order || 'desc';
  $('#wine-type-filter').value = tabViewState.wineType || '';
  $('#beer-packaging-filter').value = tabViewState.beerPackaging || '';
  applyCategoryOptionsForTab(tabName, tabViewState.category || '');
}

function applyTabConstraints(tabName, uiState) {
  const next = { ...uiState };
  if (tabName === 'Liquor') {
    if (next.category && !LIQUOR_CATEGORIES.includes(next.category)) {
      next.category = '';
    }
  }
  if (tabName === 'Wine') {
    next.category = 'Wine';
  }
  if (tabName === 'Beer') {
    next.category = 'Beer';
  }
  if (tabName === 'Syrups+') {
    next.category = 'Syrups+';
  }
  return next;
}

function syncFiltersFromUiState(uiState) {
  state.filters.search = uiState.search || '';
  state.filters.status = uiState.status || '';
  state.filters.sort = uiState.sort || 'status';
  state.filters.order = uiState.order || 'desc';
  state.filters.category = uiState.category || '';
  state.filters.wineType = uiState.wineType || '';
  state.filters.beerPackaging = uiState.beerPackaging || '';
}

function getEffectiveQueryParamsFromUI() {
  const params = new URLSearchParams();
  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.sort) params.set('sort', state.filters.sort);
  if (state.filters.order) params.set('order', state.filters.order);
  if (state.filters.category) params.set('category', state.filters.category);
  return params;
}

function matchesWineType(item, wineType) {
  if (!wineType) return true;
  const notes = (item.notes || '').toLowerCase();
  if (!notes) return false;
  if (wineType === 'Red') return notes.includes('red');
  if (wineType === 'White') return notes.includes('white');
  return true;
}

function detectBeerPackaging(item) {
  const haystack = `${item.unit || ''} ${item.name || ''} ${item.notes || ''}`.toLowerCase();
  if (/\b(keg|sixtel|half|full)\b/.test(haystack)) return 'KEG';
  if (/\b(can|4pack|4-pack|case)\b/.test(haystack)) return 'CAN';
  return '';
}

function matchesBeerPackaging(item, beerPackaging) {
  if (!beerPackaging) return true;
  const packaging = detectBeerPackaging(item);
  if (beerPackaging === 'Kegs') return packaging === 'KEG';
  if (beerPackaging === 'Cans') return packaging === 'CAN';
  return true;
}

function getBeerPackagingLabel(item) {
  const packaging = detectBeerPackaging(item);
  if (!packaging) return '';

  const haystack = `${item.unit || ''} ${item.name || ''} ${item.notes || ''}`.toLowerCase();
  if (packaging === 'CAN') {
    if (/\b4pack|4-pack\b/.test(haystack)) return '4PK';
    if (/\bcase\b/.test(haystack)) return 'CASE';
    return 'CAN';
  }

  return 'KEG';
}

async function loadItems() {
  setLoading(true);
  closeAllActionMenus();
  try {
    const params = getEffectiveQueryParamsFromUI();
    state.allItems = await api(`/api/items?${params.toString()}`);
    state.items = state.allItems.filter((item) => {
      if (state.activeTab === 'Wine') return matchesWineType(item, state.filters.wineType);
      if (state.activeTab === 'Beer') return matchesBeerPackaging(item, state.filters.beerPackaging);
      return true;
    });
    renderTable();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    setLoading(false);
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

function getRowClassForStatus(status) {
  if (status === 'OUT') return 'row-out';
  if (status === 'LOW') return 'row-low';
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
      <td>${item.name}${getBeerPackagingLabel(item) ? ` <span class="item-tag">(${getBeerPackagingLabel(item)})</span>` : ""}</td>
      <td>
        <span class="status-pill status-${item.status}">${item.status}</span>
      </td>
      <td>${item.quantity}</td>
      <td>
        <div class="row-actions">
            <button class="btn" data-action="minus" data-id="${item.id}">-1</button>
            <button class="btn" data-action="plus" data-id="${item.id}">+1</button>
            <button class="btn" data-action="plus10" data-id="${item.id}">+10</button>
            <button class="btn" data-action="mark-low" data-id="${item.id}">Mark Low</button>
            <button class="btn" data-action="mark-full" data-id="${item.id}">Mark Full</button>
            <button class="btn" data-action="mark-out" data-id="${item.id}">Mark OUT</button>
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
        <h3 class="quick-name" title="${escapeHtml(item.name)}">${highlightName(item.name, state.filters.search)}${getBeerPackagingLabel(item) ? ` <span class="item-tag">(${getBeerPackagingLabel(item)})</span>` : ""}</h3>
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

function resetForm() {
  $('#item-id').value = '';
  $('#name').value = '';
  $('#category').value = CATEGORIES[0];
  $('#quantity').value = '0';
  $('#unit').value = 'bottle';
  $('#status').value = 'FULL';
  $('#par_level').value = '0';
  $('#notes').value = '';
  $('#form-error').textContent = '';
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
  $('#unit').value = item.unit;
  $('#status').value = item.status;
  $('#par_level').value = item.par_level;
  $('#notes').value = item.notes || '';
  $('#form-error').textContent = '';
  itemDialog.showModal();
}


function cloneItem(item) {
  return item ? JSON.parse(JSON.stringify(item)) : null;
}

function getItemById(id) {
  return state.items.find((item) => item.id === Number(id)) || null;
}

function updateUndoRedoButtons() {
  $('#undo-btn').disabled = undoStack.length === 0;
  $('#redo-btn').disabled = redoStack.length === 0;
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
    if (isMobileQuickMode()) {
      topBar.classList.remove('is-sticky');
      return;
    }
    topBar.classList.toggle('is-sticky', window.scrollY > 8);
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
  return ['OUT', 'LOW'].includes(item.status);
}

async function exportOrderListCsv() {
  const rows = state.items
    .filter(matchesOrderListFilters)
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
}

function updateActiveTabButtons() {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === state.activeTab);
  });
}

function refreshForCurrentTab() {
  const uiState = {
    search: $('#search-input').value.trim(),
    status: $('#status-filter').value,
    sort: $('#sort-field').value,
    order: $('#sort-order').value,
    category: $('#category-filter').value,
    wineType: $('#wine-type-filter').value,
    beerPackaging: $('#beer-packaging-filter').value
  };

  const constrainedState = applyTabConstraints(state.activeTab, uiState);
  syncFiltersFromUiState(constrainedState);

  const showWineType = state.activeTab === 'Wine';
  const showBeerPackaging = state.activeTab === 'Beer';
  $('#wine-type-filter-wrap').classList.toggle('hidden', !showWineType);
  $('#beer-packaging-filter-wrap').classList.toggle('hidden', !showBeerPackaging);

  applyCategoryOptionsForTab(state.activeTab, constrainedState.category);

  saveCurrentTabStateFromUI();
  persistTabState();
  updateActiveTabButtons();
  loadItems();
}

function wireTabs() {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const nextTab = button.dataset.tab;
      if (!TABS.includes(nextTab) || nextTab === state.activeTab) return;

      saveCurrentTabStateFromUI();
      state.activeTab = nextTab;
      loadTabStateIntoUI(nextTab);
      refreshForCurrentTab();
    });
  });
}

function wireUpFilters() {
  searchInput.addEventListener('input', refreshForCurrentTab);
  $('#category-filter').addEventListener('change', refreshForCurrentTab);
  $('#status-filter').addEventListener('change', refreshForCurrentTab);
  $('#sort-field').addEventListener('change', refreshForCurrentTab);
  $('#sort-order').addEventListener('change', refreshForCurrentTab);
  $('#wine-type-filter').addEventListener('change', refreshForCurrentTab);
  $('#beer-packaging-filter').addEventListener('change', refreshForCurrentTab);
}

function init() {
  restoreTabState();
  fillSelect($('#status-filter'), STATUSES, true);
  fillSelect($('#category'), CATEGORIES, false);
  fillSelect($('#status'), STATUSES, false);

  loadTabStateIntoUI(state.activeTab);
  refreshForCurrentTab();

  wireTabs();
  wireUpFilters();
  wireKeyboardShortcuts();
  wireStickyTopBar();
  wireMobileLongPressEdit();

  $('#add-item-btn').addEventListener('click', openCreateModal);
  $('#undo-btn').addEventListener('click', handleUndo);
  $('#redo-btn').addEventListener('click', handleRedo);
  $('#export-full-btn').addEventListener('click', exportFullInventoryCsv);
  $('#export-order-btn').addEventListener('click', exportOrderListCsv);
  itemForm.addEventListener('submit', handleSave);
  $('#cancel-btn').addEventListener('click', () => itemDialog.close());
  $('#delete-btn').addEventListener('click', handleDeleteCurrentItem);
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
}

init();
