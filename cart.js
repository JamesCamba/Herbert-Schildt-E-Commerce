const BASE_URL = "https://herbert-schildt-e-commerce-31.onrender.com";

class ShoppingCart {
    constructor() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        this.currentUserEmail = currentUser?.email || null;
        this.items = [];       // array of book objects now
        this.shippingCost = 5.99;
        this.taxRate = 0.08;

        this.init();
    }

    async init() {
        await this.loadUserCart();
        this.renderCart();
        this.updateCartCount();
        this.bindEvents();
    }

    async loadUserCart() {
        if (!this.currentUserEmail) return;

        try {
            const response = await fetch(`${BASE_URL}/get-cart`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: this.currentUserEmail })
            });
            const result = await response.json();
            this.items = result.cart || []; // cart is now full book objects
        } catch (err) {
            console.error("Failed to fetch user cart:", err);
            this.items = [];
        }
    }


    async addItem(book) {
        if (!this.currentUserEmail) return alert("Please log in first.");

        if (this.items.some(b => b.id === book.id)) return alert("This book is already in your cart!");

        try {
            const response = await fetch(`${BASE_URL}/add-to-cart`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: this.currentUserEmail, title: book.title })
            });
            const result = await response.json();
            if (!result.success) return alert(result.message);

            this.items.push(book);
            this.renderCart();
            this.updateCartCount();
            this.showNotification(`${book.title} added to cart!`);
        } catch (err) {
            console.error("Failed to add book:", err);
        }
    }

    async removeItem(bookId) {
        if (!this.currentUserEmail) return;

        try {
            const response = await fetch(`${BASE_URL}/remove-from-cart`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: this.currentUserEmail, bookId })
            });
            const result = await response.json();
            if (!result.success) return console.warn(result.message);

            this.items = this.items.filter(item => item.id !== bookId);
            this.renderCart();
            this.updateCartCount();
            this.showNotification(`Removed "${result.removedTitle}" from cart`);
        } catch (err) {
            console.error("Failed to remove book:", err);
        }
    }

    async clearCart() {
        if (!this.items.length) return;
        if (!confirm("Are you sure you want to clear the cart?")) return;

        try {
            const response = await fetch(`${BASE_URL}/clear-cart`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: this.currentUserEmail })
            });
            const result = await response.json();
            if (!result.success) return this.showNotification("Failed to clear cart.");

            this.items = [];
            this.renderCart();
            this.updateCartCount();
            this.updateSummary();
            this.showNotification("Cart cleared successfully!");
        } catch (err) {
            console.error("Failed to clear cart:", err);
        }
    }

 proceedToCheckout() {
    if (!this.items || this.items.length === 0) {
        this.showNotification("Your cart is empty. Cannot proceed to checkout.");
        return;
    }

    const paypalContainer = document.getElementById('paypal-button-container');
    if (!paypalContainer) return;

    const overlay = document.querySelector('.loading-Overlay');

    // Show overlay unconditionally
    if (overlay) overlay.style.display = "flex";

    this.showPayPalButtons(paypalContainer, () => {
        // Hide overlay once PayPal buttons are rendered
        if (overlay) overlay.style.display = "none";
    });

    // Close PayPal if clicking outside
    document.addEventListener('click', (e) => {
        if (paypalContainer.style.display === "flex" && !paypalContainer.contains(e.target)) {
            paypalContainer.style.display = "none";
        }
    });
}

showPayPalButtons(paypalContainer, callback) {
    paypalContainer.innerHTML = ""; // clear old buttons

    paypal.Buttons({
        createOrder: (data, actions) => {
            return actions.order.create({
                purchase_units: [{
                    amount: { value: this.calculateTotal().toFixed(2) }
                }]
            });
        },
        onApprove: (data, actions) => {
            return actions.order.capture().then(details => {
                alert(`Transaction completed by ${details.payer.name.given_name}`);

                this.items = [];
                this.renderCart();
                this.updateCartCount();

                paypalContainer.style.display = "none";
                window.location.href = "thank you.html";
            });
        },
        onCancel: () => {
            this.showNotification("Payment cancelled.");
            paypalContainer.style.display = "none";
        },
        onError: (err) => {
            console.error("PayPal Error:", err);
            this.showNotification("Payment failed. Please try again.");
            paypalContainer.style.display = "none";
        }
    }).render('#paypal-button-container').then(() => {
        paypalContainer.style.display = "flex";
        if (callback) callback(); // hide overlay here
    });
};


    renderCart() {
        const container = document.getElementById("cart-items");
        if (!container) return;

        if (!this.items.length) {
            container.innerHTML = `<div class="empty-cart">
                <h3>Your cart is empty</h3>
                <p>Add some books to get started!</p>
                <a href="../browse-book.html" class="browse-btn">Browse Books</a>
            </div>`;
            this.updateSummary();
            return;
        }

        container.innerHTML = "";
        this.items.forEach(book => {
            const cartItem = document.createElement("div");
            cartItem.className = "cart-item";
            cartItem.innerHTML = `
                <img src="${book.image}" alt="${book.title}" class="cart-item-image">
                <div class="cart-item-details">
                    <h3>${book.title}</h3>
                    <p>by ${book.author}</p>
                    <p>$${Number(book.price).toFixed(2)}</p>
                </div>
            `;

            const controls = document.createElement("div");
            controls.className = "cart-item-controls";

            const removeBtn = document.createElement("button");
            removeBtn.textContent = "Remove";
            removeBtn.className = "remove-btn";
            removeBtn.addEventListener("click", () => this.removeItem(book.id));

            controls.appendChild(removeBtn);
            cartItem.appendChild(controls);
            container.appendChild(cartItem);
        });

        this.updateSummary();
    }

    calculateSubtotal() {
        return this.items.reduce((sum, book) => sum + Number(book.price), 0);
    }

    calculateTax() { return this.calculateSubtotal() * this.taxRate; }
    calculateTotal() { return this.calculateSubtotal() + this.calculateTax() + this.shippingCost; }

    updateSummary() {
        const subtotalEl = document.getElementById('subtotal');
        const totalEl = document.getElementById('total');
        const checkoutBtn = document.getElementById('checkout-btn');

        if (!this.items || this.items.length === 0) {
            if (subtotalEl) subtotalEl.textContent = "$0.00";
            if (totalEl) totalEl.textContent = "$0.00";
            if (checkoutBtn) checkoutBtn.disabled = true;
            return;
        }

        const subtotal = this.calculateSubtotal();
        const total = this.calculateTotal();

        if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
        if (checkoutBtn) checkoutBtn.disabled = false;
    }

    updateCartCount() {
        const el = document.getElementById("cart-count");
        if (el) el.textContent = this.items.length;
    }

    showNotification(message) {
        const notification = document.createElement("div");
        notification.className = "notification";
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    bindEvents() {
        const clearBtn = document.getElementById("clear-cart");
        if (clearBtn) {
            // Remove all existing click listeners first
            clearBtn.replaceWith(clearBtn.cloneNode(true));
            const newClearBtn = document.getElementById("clear-cart");
            newClearBtn.addEventListener("click", (e) => {
                e.preventDefault();
                this.clearCart();
            });
        }
        const checkoutBtn = document.getElementById("checkout-btn");
        if (checkoutBtn) checkoutBtn.addEventListener("click", () => this.proceedToCheckout());

        document.addEventListener("click", e => {
            if (e.target.classList.contains("add-to-cart-btn")) {
                const bookId = e.target.dataset.id;
                const book = this.booksData.find(b => b.id == bookId);
                if (book) this.addItem(book);
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.cart = new ShoppingCart();
});
