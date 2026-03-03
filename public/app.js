const CATEGORIES = ['Vodka', 'Tequila', 'Rum', 'Whiskey', 'Gin', 'Liqueur', 'Wine', 'Beer', 'NA', 'Other'];
const STATUSES = ['FULL', 'LOW', 'OUT', 'ORDERED', 'DISCONTINUED'];

const state = {
  items: [],
  filters: {
    search: '',
    category: '',
    status: '',
    sort: 'status',
    order: 'desc'
  }
};

const $ = (selector) => document.querySelector(selector);

const itemDialog = $('#item-dialog');
const itemForm = $('#item-form');
const historyDialog = $('#history-dialog');
const topBar = $('#top-bar');
const undoStack = [];
const redoStack = [];


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

function buildQuery() {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state.filters)) {
    if (value === '' || value === false) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

async function loadItems() {
  setLoading(true);
  closeAllActionMenus();
  try {
    state.items = await api(`/api/items?${buildQuery()}`);
    renderTable();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    setLoading(false);
  }
}

function renderTable() {
  const tbody = $('#items-table tbody');
  tbody.innerHTML = '';

  $('#empty-state').classList.toggle('hidden', state.items.length > 0);

  for (const item of state.items) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
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
  }
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
    topBar.classList.toggle('is-sticky', window.scrollY > 8);
  }

  window.addEventListener('scroll', updateStickyState, { passive: true });
  updateStickyState();
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
    if (action === 'plus' || action === 'minus') {
      const beforeSnapshot = cloneItem(item);
      const afterSnapshot = await api(`/api/items/${id}/quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ delta: action === 'plus' ? 1 : -1 })
      });
      pushUndoAction({ type: 'quantity', beforeSnapshot, afterSnapshot: cloneItem(afterSnapshot) });
      showToast('Quantity updated.');
    }

    if (action === 'plus10') {
      const beforeSnapshot = cloneItem(item);
      const afterSnapshot = await api(`/api/items/${id}/quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ delta: 10 })
      });
      pushUndoAction({ type: 'quantity', beforeSnapshot, afterSnapshot: cloneItem(afterSnapshot) });
      showToast('Quantity increased by 10.');
    }

    if (action === 'mark-low' || action === 'mark-full') {
      const beforeSnapshot = cloneItem(item);
      const status = action === 'mark-low' ? 'LOW' : 'FULL';
      const afterSnapshot = await api(`/api/items/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      pushUndoAction({ type: 'status', beforeSnapshot, afterSnapshot: cloneItem(afterSnapshot) });
      showToast(`Status updated to ${status}.`);
    }

    if (action === 'mark-out') {
      const beforeSnapshot = cloneItem(item);
      let afterSnapshot;
      if (item.quantity > 0) {
        afterSnapshot = await api(`/api/items/${id}/quantity`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity: 0 })
        });
      } else {
        afterSnapshot = await api(`/api/items/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'OUT' })
        });
      }
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

function wireUpFilters() {
  $('#search-input').addEventListener('input', (e) => {
    state.filters.search = e.target.value.trim();
    loadItems();
  });

  $('#category-filter').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    loadItems();
  });

  $('#status-filter').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    loadItems();
  });

  $('#sort-field').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    loadItems();
  });

  $('#sort-order').addEventListener('change', (e) => {
    state.filters.order = e.target.value;
    loadItems();
  });

}

function init() {
  fillSelect($('#category-filter'), CATEGORIES, true);
  fillSelect($('#status-filter'), STATUSES, true);
  fillSelect($('#category'), CATEGORIES, false);
  fillSelect($('#status'), STATUSES, false);

  $('#sort-field').value = state.filters.sort;
  $('#sort-order').value = state.filters.order;

  wireUpFilters();
  wireKeyboardShortcuts();
  wireStickyTopBar();

  $('#add-item-btn').addEventListener('click', openCreateModal);
  $('#undo-btn').addEventListener('click', handleUndo);
  $('#redo-btn').addEventListener('click', handleRedo);
  itemForm.addEventListener('submit', handleSave);
  $('#cancel-btn').addEventListener('click', () => itemDialog.close());
  $('#delete-btn').addEventListener('click', handleDeleteCurrentItem);
  $('#items-table tbody').addEventListener('click', handleRowAction);
  $('#items-table tbody').addEventListener('change', handleStatusInlineChange);
  $('#items-table tbody').addEventListener('mousedown', (event) => {
    if (event.target.closest('select, button, input, a, .row-actions')) {
      event.stopPropagation();
    }
  });
  $('#history-close').addEventListener('click', () => historyDialog.close());

  updateUndoRedoButtons();
  loadItems();
}

init();
