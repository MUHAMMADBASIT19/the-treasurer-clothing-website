const API_URL = 'http://localhost:5000/api';

// Cart State Management
let cart = JSON.parse(localStorage.getItem('treasurer_cart')) || [];
let appliedDiscountPercent = 0;

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    updateCartUI();
});

// Load Products from Backend
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        const data = await response.json();

        const gridContainer = document.getElementById('product-grid');
        if (!gridContainer) return;
        
        gridContainer.innerHTML = '';

        if (!Array.isArray(data)) {
            gridContainer.innerHTML = `<p style="color: red;">Error: ${data.error || 'Server error occurred.'}</p>`;
            return;
        }

        if (data.length === 0) {
            gridContainer.innerHTML = '<p>No active drops right now.</p>';
            return;
        }

        data.forEach(product => {
            const imageUrl = product.image && product.image.startsWith('http') 
                ? product.image 
                : `http://localhost:5000/${product.image || ''}`;

            const productCard = `
                <div class="product-card">
                    <div class="product-img-box zoom-container">
                        <img src="${imageUrl}" alt="${product.name}">
                    </div>
                    <div class="product-info product-details">
                        <h3 class="product-title">${product.name}</h3>
                        <p class="product-desc">${product.description || ''}</p>
                        <div class="product-footer price-row">
                            <span class="product-price price">Rs. ${product.price}</span>
                            <button onclick="addToCart('${product.id}', '${product.name.replace(/'/g, "\\'")}', ${product.price})" class="secure-btn add-to-cart-btn">ADD TO CART</button>
                        </div>
                    </div>
                </div>
            `;
            gridContainer.innerHTML += productCard;
        });

        // Initialize Image Zoom Effect after loading products
        initImageZoom();

    } catch (err) {
        console.error('Error loading products:', err);
        const gridContainer = document.getElementById('product-grid');
        if (gridContainer) {
            gridContainer.innerHTML = '<p style="color: red;">Failed to connect to backend server.</p>';
        }
    }
}

// Image Zoom Effect on Mouse Move
function initImageZoom() {
    const zoomContainers = document.querySelectorAll('.zoom-container, .product-image-container');
    
    zoomContainers.forEach(container => {
        const img = container.querySelector('img');
        if (!img) return;

        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / container.offsetWidth) * 100;
            const y = ((e.clientY - rect.top) / container.offsetHeight) * 100;
            
            img.style.transformOrigin = `${x}% ${y}%`;
            img.style.transform = "scale(2)";
        });

        container.addEventListener('mouseleave', () => {
            img.style.transformOrigin = "center center";
            img.style.transform = "scale(1)";
        });
    });
}

// Add Item to Cart
function addToCart(id, name, price) {
    const existingIndex = cart.findIndex(item => item.id === id);
    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({ id, name, price: parseFloat(price), quantity: 1 });
    }
    
    localStorage.setItem('treasurer_cart', JSON.stringify(cart));
    updateCartUI();
    alert(`"${name}" added to cart!`);
}

// Update Cart UI
function updateCartUI() {
    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartBadge.innerText = totalItems;
    }

    const cartList = document.getElementById('cart-items-list');
    const totalPriceEl = document.getElementById('cart-total-price');

    if (cartList) {
        if (cart.length === 0) {
            cartList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Your cart is empty.</p>';
        } else {
            cartList.innerHTML = cart.map((item, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
                    <div>
                        <p style="margin: 0; font-weight: 600;">${item.name} (x${item.quantity})</p>
                        <small style="color: var(--gold);">Rs. ${item.price * item.quantity}</small>
                    </div>
                    <button onclick="removeFromCart(${index})" style="background: transparent; border: none; color: #ff4d4d; cursor: pointer;"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');
        }
    }

    if (totalPriceEl) {
        totalPriceEl.innerText = `Rs. ${calculateTotal().toFixed(0)}`;
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('treasurer_cart', JSON.stringify(cart));
    updateCartUI();
}

// COUPON APPLY FUNCTION (Backend + Fallback Support)
async function applyCoupon() {
    const couponInput = document.getElementById('coupon-input');
    if (!couponInput) return;
    
    const code = couponInput.value.trim().toUpperCase();
    if (!code) {
        alert("Pehle koi promo code enter karein.");
        return;
    }

    // 1. Pehle backend database se coupons fetch karke check karna
    try {
        const response = await fetch(`${API_URL}/coupons`);
        if (response.ok) {
            const coupons = await response.json();
            const foundCoupon = coupons.find(c => c.code.toUpperCase() === code);
            if (foundCoupon) {
                appliedDiscountPercent = foundCoupon.discountPercent;
                alert(`🎉 Coupon applied successfully! ${appliedDiscountPercent}% discount added.`);
                updateCartUI();
                return;
            }
        }
    } catch (err) {
        console.warn("Backend coupons fetch failed, checking local fallbacks:", err);
    }

    // 2. Local fallback coupons agar backend route active na ho ya code database mein na ho
    const localFallbacks = {
        "SYEDBADSHAH5": 5,
        "TREASURER5": 5,
        "SAVE5": 5,
        "DISCOUNT10": 10
    };

    if (localFallbacks[code] !== undefined) {
        appliedDiscountPercent = localFallbacks[code];
        alert(`🎉 Coupon applied successfully! ${appliedDiscountPercent}% discount added.`);
        updateCartUI();
        return;
    }

    // 3. Agar kahin bhi match na ho
    alert("Invalid promo code!");
    appliedDiscountPercent = 0;
    updateCartUI();
}

function calculateTotal() {
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    if (appliedDiscountPercent > 0) {
        const discountAmount = (subtotal * appliedDiscountPercent) / 100;
        return Math.max(0, subtotal - discountAmount);
    }
    return subtotal;
}

function clearCart() {
    cart = [];
    appliedDiscountPercent = 0;
    localStorage.removeItem('treasurer_cart');
    updateCartUI();
}

function toggleCartModal(show) {
    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.style.display = show ? 'flex' : 'none';
    }
}

// OPEN CHECKOUT MODAL FORM
function openCheckoutModal() {
    if (cart.length === 0) {
        alert("Your cart is empty! Add items first.");
        return;
    }
    toggleCartModal(false);
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.style.display = 'flex';
    }
}

function proceedCheckout() {
    openCheckoutModal();
}

function closeCheckoutModal() {
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.style.display = 'none';
    }
}

// HANDLE SUBMISSION FROM FORM
async function handleCODCheckout(event) {
    event.preventDefault();

    const name = document.getElementById('checkoutName').value.trim();
    const phone = document.getElementById('checkoutPhone').value.trim();
    const city = document.getElementById('checkoutCity').value.trim();
    const address = document.getElementById('checkoutAddress').value.trim();

    const orderData = {
        customer: { name, phone, city, address },
        paymentMethod: 'COD',
        items: cart,
        totalAmount: calculateTotal(),
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (response.ok) {
            const modalContent = document.querySelector('.checkout-modal-content');
            if (modalContent) {
                modalContent.innerHTML = `
                    <button class="checkout-close-btn" onclick="closeCheckoutModal(); location.reload();">&times;</button>
                    <div style="text-align: center; padding: 2rem 0;">
                        <h2 style="color: #d4af37; font-family: 'Cinzel', serif; margin-bottom: 1rem;">ORDER CONFIRMED</h2>
                        <p style="font-size: 1.2rem; color: #fff; margin-bottom: 0.8rem; font-weight: bold;">Your order has been placed successfully!</p>
                        <p style="color: #ccc; margin-bottom: 1.5rem; font-size: 0.95rem;">Thank you, <strong>${name}</strong>. Your Order ID is <strong style="color: #d4af37;">#${result.id || ''}</strong>.</p>
                        <button onclick="closeCheckoutModal(); location.reload();" style="background: #d4af37; color: #000; border: none; padding: 0.8rem 2rem; font-weight: bold; cursor: pointer; border-radius: 4px; letter-spacing: 1px; transition: background 0.3s;">CONTINUE SHOPPING</button>
                    </div>
                `;
            }
            clearCart();
        } else {
            alert(result.message || result.error || "Failed to place order. Please try again.");
        }
    } catch (error) {
        console.error("Order error:", error);
        alert("Server error. Please make sure backend server is running.");
    }
}s