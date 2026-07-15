// ==============================================
//    TOAST NOTIFICATIONS (Premium Popups)
// ==============================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ==============================================
//    CONFIRM MODAL (Replaces confirm())
// ==============================================

function showConfirm(message, onConfirm, onCancel = null) {
    const overlay = document.getElementById('confirmOverlay');
    if (!overlay) return;
    document.getElementById('confirmMessage').textContent = message;
    overlay.classList.add('open');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    const cleanup = () => {
        overlay.classList.remove('open');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    const handleConfirm = () => { cleanup(); if (onConfirm) onConfirm(); };
    const handleCancel = () => { cleanup(); if (onCancel) onCancel(); };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    // Click outside to cancel
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) { handleCancel(); }
    });
}

// ==============================================
//    ADD ORDER MODAL (Replaces prompt)
// ==============================================

function openAddOrder() {
    const modal = document.getElementById('addOrderModal');
    if (!modal) return;
    modal.classList.add('open');
    document.getElementById('addOrderForm').reset();
    document.getElementById('addOrderStatus').value = 'pending';
}

function closeAddOrderModal() {
    document.getElementById('addOrderModal').classList.remove('open');
}

// Submit Add Order Form
document.getElementById('addOrderForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    fetch('/api/order', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ تم إضافة الطلب بنجاح!', 'success');
            closeAddOrderModal();
            setTimeout(() => location.reload(), 500);
        } else {
            showToast('❌ حدث خطأ، حاول مرة أخرى', 'error');
        }
    });
});

// ==============================================
//    TAB SWITCHING (Dashboard)
// ==============================================

document.querySelectorAll('.dash-sidebar li').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.dash-sidebar li').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        const tabId = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-' + tabId).classList.add('active');
    });
});

// ==============================================
//    PRODUCT TOGGLE (Knob)
// ==============================================

document.querySelectorAll('.toggle-input').forEach(input => {
    input.addEventListener('change', function() {
        const id = this.dataset.id;
        fetch('/api/toggle/' + id, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) showToast('🔄 تم تحديث المخزون', 'info');
        });
    });
});

// ==============================================
//    ADD PRODUCT MODAL
// ==============================================

function openAddProduct() {
    document.getElementById('productModal').style.display = 'flex';
}
function closeModal() {
    document.getElementById('productModal').style.display = 'none';
}
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) closeModal();
    if (event.target.classList.contains('modal-overlay')) {
        event.target.classList.remove('open');
    }
}

document.getElementById('addProductForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    fetch('/api/product', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ تمت إضافة المنتج بنجاح!', 'success');
            closeModal();
            setTimeout(() => location.reload(), 500);
        }
    });
});

// ==============================================
//    DELETE PRODUCT
// ==============================================

function deleteProduct(id) {
    showConfirm('هل أنت متأكد من حذف هذا المنتج؟', () => {
        fetch('/api/product/' + id, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('🗑️ تم حذف المنتج', 'info');
                document.getElementById('product-row-' + id).remove();
            }
        });
    });
}

// ==============================================
//    UPDATE EXCHANGE RATE
// ==============================================

function updateExchangeRate() {
    const rate = document.getElementById('exchangeRateInput').value;
    const formData = new FormData();
    formData.append('usd_to_syp', rate);
    fetch('/api/settings', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ تم تحديث سعر الصرف!', 'success');
        }
    });
}

// ==============================================
//    UPDATE SETTINGS
// ==============================================

function updateSettings(e) {
    e.preventDefault();
    const form = document.getElementById('settingsForm');
    const formData = new FormData(form);
    fetch('/api/settings', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ تم حفظ الإعدادات بنجاح!', 'success');
        }
    });
}

// ==============================================
//    ORDER MANAGEMENT
// ==============================================

// Update order status via dropdown
document.addEventListener('change', function(e) {
    if (e.target.classList.contains('order-status-select')) {
        const id = e.target.dataset.id;
        const status = e.target.value;
        updateOrderStatus(id, status);
    }
});

function updateOrderStatus(id, status) {
    fetch(`/api/order/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('🔄 تم تحديث الحالة', 'info');
            updateOrderCounts();
        }
    });
}

// Edit Order
function editOrder(id) {
    fetch(`/api/order/${id}`)
    .then(res => res.json())
    .then(data => {
        document.getElementById('editOrderId').value = data.id;
        document.getElementById('editCustomerName').value = data.customer_name || '';
        document.getElementById('editItems').value = data.product_ids || '';
        document.getElementById('editTotal').value = data.total_price || 0;
        document.getElementById('editStatus').value = data.status || 'pending';
        document.getElementById('editOrderModal').style.display = 'flex';
    });
}

function closeEditOrderModal() {
    document.getElementById('editOrderModal').style.display = 'none';
}

document.getElementById('editOrderForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('editOrderId').value;
    const formData = new FormData(this);
    const data = {
        customer_name: formData.get('customer_name'),
        product_ids: formData.get('product_ids'),
        total_price: parseFloat(formData.get('total_price')),
        status: formData.get('status')
    };
    fetch(`/api/order/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            showToast('✅ تم تحديث الطلب!', 'success');
            closeEditOrderModal();
            setTimeout(() => location.reload(), 400);
        }
    });
});

// Delete Order
function deleteOrder(id) {
    showConfirm('هل أنت متأكد من حذف هذا الطلب؟', () => {
        fetch(`/api/order/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('🗑️ تم حذف الطلب', 'info');
                document.getElementById('order-row-' + id).remove();
                updateOrderCounts();
            }
        });
    });
}

// Update order counts
function updateOrderCounts() {
    const rows = document.querySelectorAll('#ordersTableBody tr');
    let pending = 0, preparing = 0, ready = 0;
    rows.forEach(row => {
        const select = row.querySelector('.order-status-select');
        if (select) {
            const status = select.value;
            if (status === 'pending') pending++;
            else if (status === 'preparing') preparing++;
            else if (status === 'ready') ready++;
        }
    });
    const pEl = document.getElementById('pendingCount');
    const prEl = document.getElementById('preparingCount');
    const rEl = document.getElementById('readyCount');
    if (pEl) pEl.textContent = pending;
    if (prEl) prEl.textContent = preparing;
    if (rEl) rEl.textContent = ready;
}

// ==============================================
//    SEARCH & FILTER (Storefront)
// ==============================================

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('keyup', function() {
        const val = this.value.toLowerCase();
        document.querySelectorAll('.product-card').forEach(card => {
            const name = card.dataset.name.toLowerCase();
            card.style.display = name.includes(val) ? '' : 'none';
        });
    });
}

document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const cat = this.dataset.cat;
        document.querySelectorAll('.product-card').forEach(card => {
            if (cat === 'all' || card.dataset.category === cat) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// ==============================================
//    SHOPPING CART SYSTEM
// ==============================================

let cart = [];

function addToCart(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    updateCartUI();
    showToast(`🛒 تمت إضافة "${name}" إلى السلة`, 'success');
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
}

function updateQuantity(id, change) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(id);
            return;
        }
        updateCartUI();
    }
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;
    
    const container = document.getElementById('cartItems');
    const totalSpan = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        container.innerHTML = '<p class="empty-cart">🛒 السلة فارغة</p>';
        totalSpan.textContent = '$0.00';
        return;
    }
    
    let html = '';
    let total = 0;
    cart.forEach(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        html += `
            <div class="cart-item">
                <span class="cart-item-name">${item.name}</span>
                <div class="cart-item-controls">
                    <button onclick="updateQuantity('${item.id}', -1)">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity('${item.id}', 1)">+</button>
                </div>
                <span class="cart-item-price">$${subtotal.toFixed(2)}</span>
                <button class="cart-remove" onclick="removeFromCart('${item.id}')">✕</button>
            </div>
        `;
    });
    container.innerHTML = html;
    totalSpan.textContent = `$${total.toFixed(2)}`;
}

function toggleCart() {
    const popup = document.getElementById('cartPopup');
    const overlay = document.getElementById('cartOverlay');
    if (!popup) return;
    popup.classList.toggle('open');
    overlay.classList.toggle('open');
}

function sendOrder() {
    if (cart.length === 0) {
        showToast('🛒 السلة فارغة! أضف منتجات أولاً.', 'error');
        return;
    }
    
    let message = 'مرحباً! أريد طلب:\n';
    let total = 0;
    cart.forEach(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        message += `- ${item.name} × ${item.quantity} = $${subtotal.toFixed(2)}\n`;
    });
    message += `\nالإجمالي: $${total.toFixed(2)}`;
    message += '\nالرجاء تأكيد الطلب';
    
    const waLink = document.querySelector('.floating-wa');
    let waNumber = '';
    if (waLink) {
        const href = waLink.href;
        const match = href.match(/wa\.me\/(\d+)/);
        if (match) waNumber = match[1];
    }
    if (!waNumber) {
        showToast('⚠️ رقم واتساب غير مضبوط. يرجى تحديث الإعدادات.', 'error');
        return;
    }
    
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${waNumber}?text=${encoded}`, '_blank');
    
    cart = [];
    updateCartUI();
    toggleCart();
    showToast('📱 تم فتح واتساب! أرسل الطلب', 'success');
}

// Call on load
document.addEventListener('DOMContentLoaded', updateOrderCounts);