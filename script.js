/* =========================

   OMI STORE

   JAVASCRIPT

========================= */

const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
        nav.classList.toggle("active");
        menuToggle.textContent = nav.classList.contains("active") ? "✕" : "☰";
    });

    document.querySelectorAll(".nav a").forEach((link) => {
        link.addEventListener("click", () => {
            nav.classList.remove("active");
            menuToggle.textContent = "☰";
        });
    });
}

const searchInput = document.getElementById("searchInput");
const products = document.querySelectorAll(".product");
const productCount = document.getElementById("productCount");
const noResults = document.getElementById("noResults");

if (searchInput && products.length && productCount && noResults) {
    const updateProducts = () => {
        const searchValue = searchInput.value.toLowerCase().trim();
        let visibleProducts = 0;

        products.forEach((product) => {
            const productName = product.dataset.name?.toLowerCase() || "";
            const isVisible = productName.includes(searchValue);
            product.style.display = isVisible ? "" : "none";
            if (isVisible) visibleProducts++;
        });

        productCount.textContent = visibleProducts;
        noResults.style.display = visibleProducts === 0 ? "block" : "none";
    };

    searchInput.addEventListener("input", updateProducts);
    updateProducts();
}

const contactForm = document.getElementById("contactForm");

if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const emri = document.getElementById("emri")?.value.trim() || "";
        const mesazhi = document.getElementById("mesazhi")?.value.trim() || "";

        if (!emri || !mesazhi) {
            alert("Ju lutem plotësoni emrin dhe mesazhin.");
            return;
        }

        const tekst = `Përshëndetje, jam ${emri}. ${mesazhi}`;
        const messengerURL = `https://m.me/61575553802511?text=${encodeURIComponent(tekst)}`;
        window.open(messengerURL, "_blank", "noopener,noreferrer");
        contactForm.reset();
    });
}

const backToTop = document.getElementById("backToTop");

if (backToTop) {
    window.addEventListener("scroll", () => {
        backToTop.classList.toggle("show", window.scrollY > 500);
    });

    backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

document.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => {
        console.warn(`Fotoja nuk u gjet: ${image.src}`);
        image.style.opacity = "0.3";
    });
});

const currentYear = new Date().getFullYear();
const copyright = document.querySelector(".copyright");

if (copyright) {
    copyright.innerHTML = `© ${currentYear} OMI STORE. Të gjitha të drejtat të rezervuara.`;
}

const cartStorageKey = "omiStoreCart";
const cartTrigger = document.getElementById("cartTrigger");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const cartClose = document.getElementById("cartClose");
const cartItems = document.getElementById("cartItems");
const headerCartCount = document.getElementById("headerCartCount");
const drawerCount = document.getElementById("drawerCount");
const cartTotal = document.getElementById("cartTotal");
const clearCart = document.getElementById("clearCart");
const checkoutBtn = document.getElementById("checkoutBtn");

let cart = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");

function saveCart() {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    renderCart();
}

function openCart() {
    cartDrawer?.classList.add("open");
    cartOverlay?.classList.add("open");
    cartDrawer?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeCart() {
    cartDrawer?.classList.remove("open");
    cartOverlay?.classList.remove("open");
    cartDrawer?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function cartQuantity() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function cartAmount() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function renderCart() {
    if (!cartItems) return;

    const quantity = cartQuantity();
    const total = cartAmount();

    if (headerCartCount) headerCartCount.textContent = quantity;
    if (drawerCount) drawerCount.textContent = `(${quantity})`;
    if (cartTotal) cartTotal.textContent = `${total.toFixed(2).replace(".00", "")}€`;
    if (checkoutBtn) checkoutBtn.classList.toggle("disabled", quantity === 0);

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <div><span>🛒</span><strong>Shporta është bosh</strong><p>Shto produkte për të vazhduar.</p></div>
            </div>`;
        return;
    }

    cartItems.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" />
            <div>
                <h3>${item.name}</h3>
                <div class="cart-item-price">${item.price}€</div>
                <div class="qty-controls" aria-label="Sasia për ${item.name}">
                    <button type="button" data-cart-action="decrease" data-index="${index}" aria-label="Ul sasinë">−</button>
                    <strong>${item.quantity}</strong>
                    <button type="button" data-cart-action="increase" data-index="${index}" aria-label="Rrit sasinë">+</button>
                </div>
            </div>
            <button class="cart-remove" type="button" data-cart-action="remove" data-index="${index}" aria-label="Hiq produktin">×</button>
        </div>
    `).join("");
}

document.querySelectorAll(".add-to-cart").forEach((button) => {
    button.addEventListener("click", () => {
        const card = button.closest(".product");
        const name = button.dataset.product;
        const price = Number(card.dataset.price);
        const image = card.dataset.image;
        const existing = cart.find((item) => item.name === name);

        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ name, price, image, quantity: 1 });
        }

        saveCart();
        button.textContent = "U shtua ✓";
        setTimeout(() => { button.textContent = "Shto në shportë"; }, 900);
        openCart();
    });
});

cartItems?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;

    const index = Number(button.dataset.index);
    const action = button.dataset.cartAction;

    if (action === "increase") cart[index].quantity += 1;
    if (action === "decrease") cart[index].quantity -= 1;
    if (action === "remove") cart.splice(index, 1);

    if (action === "decrease" && cart[index]?.quantity <= 0) cart.splice(index, 1);
    saveCart();
});

cartTrigger?.addEventListener("click", openCart);
cartClose?.addEventListener("click", closeCart);
cartOverlay?.addEventListener("click", closeCart);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCart();
});
clearCart?.addEventListener("click", () => {
    cart = [];
    saveCart();
});

checkoutBtn?.addEventListener("click", (event) => {
    if (cart.length === 0) event.preventDefault();
});

renderCart();
