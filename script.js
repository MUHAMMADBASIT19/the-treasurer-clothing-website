const API_URL = 'http://localhost:5000/api';

// Cart State Management
let cart = JSON.parse(localStorage.getItem('treasurer_cart')) || [];

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
            const imageUrl = product.image.startsWith('http') 
                ? product.image 
                : `http://localhost:5000/${product.image}`;

            const productCard = `
                <div class="product-card">
                    <div class="product-img-box">
                        <img src="${imageUrl}" alt="${product.name}">
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${product.name}</h3>
                        <p class="product-desc">${product.description || ''}</p>
                        <div class="product-footer">
                            <span class="product-price">Rs. ${product.price}</span>
                            <button onclick="addToCart('${product.id}', '${product.name.replace(/'/g, "\\'")}', ${product.price})" class="secure-btn">ADD TO CART</button>
                        </div>
                    </div>
                </div>
            `;
            gridContainer.innerHTML += productCard;
        });
    } catch (err) {
        console.error('Error loading products:', err);
        const gridContainer = document.getElementById('product-grid');
        if (gridContainer) {
            gridContainer.innerHTML = '<p style="color: red;">Failed to connect to backend server.</p>';
        }
    }
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
        totalPriceEl.innerText = `Rs. ${calculateTotal()}`;
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('treasurer_cart', JSON.stringify(cart));
    updateCartUI();
}

function calculateTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function clearCart() {
    cart = [];
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
    toggleCartModal(false); // Cart modal band karo
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.style.display = 'flex'; // Delivery Form khole
    }
}

// Redirect proceedCheckout to openCheckoutModal to prevent direct placement
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
            alert(`Thank you ${name}! Your order has been placed successfully via Cash on Delivery.`);
            closeCheckoutModal();
            clearCart();
            if (document.getElementById('codAddressForm')) {
                document.getElementById('codAddressForm').reset();
            }
        } else {
            alert(result.message || result.error || "Failed to place order. Please try again.");
        }
    } catch (error) {
        console.error("Order error:", error);
        alert("Server error. Please make sure backend server is running.");
    }
}