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
const productCount = document.getElementById("productCount");
const noResults = document.getElementById("noResults");
const categoryFilters = document.getElementById("categoryFilters");
const storeCategories = ["Shtëpi", "Për fëmijë", "Mjete pune", "Dekore", "Teknologji"];
let activeCategory = "";

function normalizeCategoryText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function getProductCategory(name, category) {
    const categoryText = String(category ?? "").trim();
    const normalizedCategory = normalizeCategoryText(categoryText);
    const knownCategory = storeCategories.find(
        (item) => normalizeCategoryText(item) === normalizedCategory
    );
    if (knownCategory) return knownCategory;

    if (!categoryText || normalizedCategory === "te tjera") {
        const productName = normalizeCategoryText(name);
        if (productName.includes("go kart") || productName.includes("femije")) {
            return "Për fëmijë";
        }
        if (productName.includes("sprej izolues") || productName.includes("riparues carjesh")) {
            return "Mjete pune";
        }
        if (productName.includes("cakmak")) return "Teknologji";
        if (
            productName.includes("porte sigurie") ||
            productName.includes("raft per banjo") ||
            productName.includes("drita solare") ||
            productName.includes("perde pvc")
        ) {
            return "Shtëpi";
        }
    }

    return categoryText || "Të tjera";
}

function updateProductResults() {
    if (!searchInput || !productCount || !noResults) return;

    const searchValue = searchInput.value.toLowerCase().trim();
    let visibleProducts = 0;

    document.querySelectorAll(".product").forEach((product) => {
        const productName = product.dataset.name?.toLowerCase() || "";
        const matchesSearch = productName.includes(searchValue);
        const matchesCategory = !activeCategory || product.dataset.category === activeCategory;
        const isVisible = matchesSearch && matchesCategory;
        product.style.display = isVisible ? "" : "none";
        if (isVisible) visibleProducts++;
    });

    productCount.textContent = visibleProducts;
    noResults.style.display = visibleProducts === 0 ? "block" : "none";
}

function renderCategoryFilters() {
    if (!categoryFilters) return;

    const categories = [...storeCategories];
    document.querySelectorAll(".product").forEach((product) => {
        const category = product.dataset.category?.trim();
        if (category && !categories.includes(category)) categories.push(category);
    });

    if (activeCategory && !categories.includes(activeCategory)) activeCategory = "";
    categoryFilters.innerHTML = [
        `<button class="category-filter${activeCategory ? "" : " active"}" type="button" data-category-filter="" aria-pressed="${!activeCategory}">Të gjitha</button>`,
        ...categories.map((category) => (
            `<button class="category-filter${activeCategory === category ? " active" : ""}" type="button" data-category-filter="${escapeProductHtml(category)}" aria-pressed="${activeCategory === category}">${escapeProductHtml(category)}</button>`
        ))
    ].join("");
}

function setupProductSearch() {
    if (!searchInput || !productCount || !noResults) return;

    if (!searchInput.dataset.productSearchBound) {
        searchInput.addEventListener("input", updateProductResults);
        searchInput.dataset.productSearchBound = "true";
    }
    if (categoryFilters && !categoryFilters.dataset.categoryFiltersBound) {
        categoryFilters.addEventListener("click", (event) => {
            const button = event.target instanceof Element
                ? event.target.closest("[data-category-filter]")
                : null;
            if (!button) return;
            activeCategory = button.dataset.categoryFilter || "";
            renderCategoryFilters();
            updateProductResults();
        });
        categoryFilters.dataset.categoryFiltersBound = "true";
    }

    renderCategoryFilters();
    updateProductResults();
}

function escapeProductHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function resolveCartImageUrl(value) {
    const image = String(value ?? "").trim().replace(/^\.\/(https?:\/\/)/i, "$1");
    if (!image) return "./logo.png";
    if (/^(https?:|data:|blob:)/i.test(image)) return image;
    if (image.startsWith("/")) return image;
    return `./${image.replace(/^\.?\//, "")}`;
}

function bindCartImageFallbacks(container) {
    container?.querySelectorAll("img[data-cart-image]").forEach((image) => {
        image.addEventListener("error", () => {
            if (image.dataset.fallbackApplied) return;
            image.dataset.fallbackApplied = "true";
            image.src = "./logo.png";
        }, { once: true });
    });
}

async function loadSiteSettingsFromSupabase() {
    const heroImage = document.getElementById("heroImage");
    const heroBadge = document.getElementById("heroBadge");
    const heroMessage = document.getElementById("heroMessage");
    const holidayBanner = document.getElementById("holidayBanner");
    if (!window.OmiSupabase) return;

    try {
        const settings = await window.OmiSupabase.getSiteSettings();
        if (settings.hero_image_url && heroImage) heroImage.src = settings.hero_image_url;
        if (settings.hero_badge && heroBadge) heroBadge.textContent = settings.hero_badge;
        if (settings.hero_message && heroMessage) heroMessage.textContent = settings.hero_message;
        if (settings.banner_active && settings.banner_title && holidayBanner) {
            document.getElementById("bannerLabel").textContent = settings.banner_label || "FESTA";
            document.getElementById("holidayTitle").textContent = settings.banner_title;
            document.getElementById("holidayMessage").textContent = settings.banner_message || "";
            const button = document.getElementById("holidayButton");
            const link = settings.banner_button_link || "#produkter";
            if (settings.banner_button_text && /^(#|https:\/\/)/.test(link)) {
                button.textContent = settings.banner_button_text;
                button.href = link;
                button.hidden = false;
            }
            const alignment = { left: "flex-start", center: "center", right: "flex-end" }[settings.banner_align] || "center";
            holidayBanner.style.justifyContent = alignment;
            holidayBanner.style.textAlign = settings.banner_align || "center";
            if (settings.banner_motion) holidayBanner.classList.add("holiday-ribbon--scroll");
            if (settings.banner_image_url) {
                holidayBanner.classList.add("holiday-ribbon--photo");
                const photo = settings.banner_image_url.replace(/"/g, "%22");
                holidayBanner.style.backgroundImage = `linear-gradient(rgba(58, 7, 84, 0.8), rgba(58, 7, 84, 0.8)), url("${photo}")`;
            }
            holidayBanner.hidden = false;
        }
    } catch (error) {
        // Keep the default hero and hide the banner if the settings cannot be loaded.
        console.error(error);
    }
}

async function loadProductsFromSupabase() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    try {
        if (!window.OmiSupabase) throw new Error("Supabase nuk është i gatshëm.");
        const products = await window.OmiSupabase.getActiveProducts();
        grid.innerHTML = products.map((product) => {
            const oldPrice = product.old_price ? Number(product.old_price) : null;
            const price = Number(product.price);
            const stock = Number(product.stock || 0);
            const description = product.description || product.category || "";
            const specs = Array.isArray(product.specifications)
                ? product.specifications.join(" • ")
                : (product.specifications || "");
            const imageUrls = window.OmiSupabase.getProductImages(product);
            const image = imageUrls[0] || "logo.png";
            const category = getProductCategory(product.name, product.category);
            const badge = oldPrice && oldPrice > price ? "Oferta" : category;

            return `
                <article class="product" data-name="${escapeProductHtml(product.name.toLowerCase())}" data-category="${escapeProductHtml(category)}" data-price="${price}" data-old-price="${oldPrice || ""}" data-image="${escapeProductHtml(image)}" data-images="${escapeProductHtml(JSON.stringify(imageUrls))}" data-stock="${stock}" data-description="${escapeProductHtml(description)}" data-specifications="${escapeProductHtml(specs)}">
                    <div class="product-image">
                        <img src="${escapeProductHtml(image)}" alt="${escapeProductHtml(product.name)}" role="button" tabindex="0" />
                        <span class="product-badge ${oldPrice && oldPrice > price ? "sale" : ""}">${escapeProductHtml(badge)}</span>
                    </div>
                    <div class="product-info">
                        <h3>${escapeProductHtml(product.name)}</h3>
                        <button class="product-details-button" type="button">Shiko detajet</button>
                        <div class="price">${oldPrice && oldPrice > price ? `<del>${oldPrice.toFixed(2).replace(".00", "")}€</del> ` : ""}${price.toFixed(2).replace(".00", "")}€</div>
                        <button class="btn-buy add-to-cart" type="button" data-product="${escapeProductHtml(product.name)}"${stock <= 0 ? " disabled" : ""}>${stock <= 0 ? "Nuk ka në stok" : "Shto në shportë"}</button>
                    </div>
                </article>`;
        }).join("");

        if (products.length === 0) {
            grid.innerHTML = "";
            noResults.style.display = "block";
        }
        setupProductSearch();
    } catch (error) {
        grid.innerHTML = `<div class="no-results" style="grid-column:1/-1;display:block"><h3>Nuk u ngarkuan produktet</h3><p>${escapeProductHtml(error.message)}</p></div>`;
        if (productCount) productCount.textContent = "0";
    }
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
const productDialog = document.getElementById("productDialog");
const productDialogImage = document.getElementById("productDialogImage");
const productDialogImageStage = document.getElementById("productDialogImageStage");
const productDialogTitle = document.getElementById("productDialogTitle");
const productDialogPrice = document.getElementById("productDialogPrice");
const productDialogDescription = document.getElementById("productDialogDescription");
const productDialogSpecifications = document.getElementById("productDialogSpecifications");
const productDialogThumbnails = document.getElementById("productDialogThumbnails");
let productDialogImages = [];
let productZoom = 1;
let productZoomOffset = { x: 0, y: 0 };
let productImageDrag = null;

function showProductDialogImage(index) {
    const image = productDialogImages[index];
    if (!image) return;
    productDialogImage.src = image;
    setProductZoom(1);
    productDialogThumbnails.querySelectorAll("[data-image-index]").forEach((button) => {
        button.classList.toggle("active", Number(button.dataset.imageIndex) === index);
    });
}

function setProductZoom(zoom) {
    productZoom = Math.min(3, Math.max(1, zoom));
    if (productZoom === 1) productZoomOffset = { x: 0, y: 0 };
    productDialogImage.style.transform = `translate3d(${productZoomOffset.x}px, ${productZoomOffset.y}px, 0) scale(${productZoom})`;
    productDialogImage.classList.toggle("zoomed", productZoom > 1);
    productDialog?.querySelector("[data-zoom='out']")?.toggleAttribute("disabled", productZoom <= 1);
    productDialog?.querySelector("[data-zoom='in']")?.toggleAttribute("disabled", productZoom >= 3);
    const resetButton = productDialog?.querySelector("[data-zoom='reset']");
    if (resetButton) resetButton.textContent = `${productZoom}×`;
}

function clampProductZoomOffset(x, y) {
    const bounds = productDialogImageStage.getBoundingClientRect();
    const maxX = bounds.width * (productZoom - 1) / 2;
    const maxY = bounds.height * (productZoom - 1) / 2;
    return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y))
    };
}

function formatProductPrice(value) {
    return `${Number(value).toFixed(2).replace(/\.00$/, "")}€`;
}

function openProductDialog(product) {
    if (!product || !productDialog) return;

    const price = Number(product.dataset.price);
    const oldPrice = Number(product.dataset.oldPrice || 0);
    const name = product.querySelector("h3")?.textContent.trim() || "";
    const description = product.dataset.description || "Përshkrimi nuk është shtuar ende.";
    const specifications = product.dataset.specifications || "";
    try {
        productDialogImages = JSON.parse(product.dataset.images || "[]");
    } catch {
        productDialogImages = [];
    }
    if (!Array.isArray(productDialogImages) || productDialogImages.length === 0) {
        productDialogImages = product.dataset.image ? [product.dataset.image] : ["logo.png"];
    }

    productDialogThumbnails.innerHTML = productDialogImages.length > 1
        ? productDialogImages.map((image, index) => `
            <button class="product-dialog-thumbnail${index === 0 ? " active" : ""}" type="button" data-image-index="${index}" aria-label="Foto ${index + 1} e ${escapeProductHtml(name)}">
                <img src="${escapeProductHtml(image)}" alt="" />
            </button>`).join("")
        : "";
    productDialogImage.alt = name;
    showProductDialogImage(0);
    productDialogTitle.textContent = name;
    productDialogPrice.textContent = oldPrice > price
        ? `${formatProductPrice(oldPrice)}  ${formatProductPrice(price)}`
        : formatProductPrice(price);
    productDialogDescription.textContent = description;
    productDialogSpecifications.textContent = specifications;
    productDialogSpecifications.hidden = !specifications;
    productDialog.showModal();
}

document.addEventListener("click", (event) => {
    const trigger = event.target.closest(".product-details-button, .product-image img");
    if (trigger) openProductDialog(trigger.closest(".product"));
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const image = event.target.closest(".product-image img[role='button']");
    if (!image) return;

    event.preventDefault();
    openProductDialog(image.closest(".product"));
});

productDialogThumbnails?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-image-index]");
    if (button) showProductDialogImage(Number(button.dataset.imageIndex));
});

productDialog?.querySelector(".product-dialog-zoom-controls")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-zoom]");
    if (!button) return;

    if (button.dataset.zoom === "in") setProductZoom(productZoom + 0.5);
    if (button.dataset.zoom === "out") setProductZoom(productZoom - 0.5);
    if (button.dataset.zoom === "reset") setProductZoom(1);
});

productDialogImage?.addEventListener("pointerdown", (event) => {
    if (productZoom <= 1) return;
    productImageDrag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        offsetX: productZoomOffset.x,
        offsetY: productZoomOffset.y
    };
    productDialogImage.setPointerCapture(event.pointerId);
});

productDialogImage?.addEventListener("pointermove", (event) => {
    if (!productImageDrag || productImageDrag.pointerId !== event.pointerId) return;
    productZoomOffset = clampProductZoomOffset(
        productImageDrag.offsetX + event.clientX - productImageDrag.x,
        productImageDrag.offsetY + event.clientY - productImageDrag.y
    );
    setProductZoom(productZoom);
});

productDialogImage?.addEventListener("pointerup", () => {
    productImageDrag = null;
});

productDialogImage?.addEventListener("pointercancel", () => {
    productImageDrag = null;
});

productDialog?.querySelector(".product-dialog-close")?.addEventListener("click", () => {
    productDialog.close();
});

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
            <img data-cart-image src="${escapeProductHtml(resolveCartImageUrl(item.image))}" alt="${escapeProductHtml(item.name)}" />
            <div>
                <h3>${escapeProductHtml(item.name)}</h3>
                <div class="cart-item-price">${item.price}€</div>
                <div class="qty-controls" aria-label="Sasia për ${escapeProductHtml(item.name)}">
                    <button type="button" data-cart-action="decrease" data-index="${index}" aria-label="Ul sasinë">−</button>
                    <strong>${item.quantity}</strong>
                    <button type="button" data-cart-action="increase" data-index="${index}" aria-label="Rrit sasinë">+</button>
                </div>
            </div>
            <button class="cart-remove" type="button" data-cart-action="remove" data-index="${index}" aria-label="Hiq produktin">×</button>
        </div>
    `).join("");
    bindCartImageFallbacks(cartItems);
}

document.addEventListener("click", (event) => {
    const button = event.target.closest(".add-to-cart");
    if (!button || button.disabled) return;

    const card = button.closest(".product");
    const name = button.dataset.product;
    const price = Number(card.dataset.price);
    const image = resolveCartImageUrl(card.dataset.image);
    const stock = Number(card.dataset.stock || 0);
    const existing = cart.find((item) => item.name === name);

    if (existing && existing.quantity >= stock) return;
    if (!existing && stock <= 0) return;

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ name, price, image, quantity: 1, stock });
    }

    saveCart();
    button.textContent = "U shtua ✓";
    setTimeout(() => { button.textContent = "Shto në shportë"; }, 900);
    openCart();
});

cartItems?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;

    const index = Number(button.dataset.index);
    const action = button.dataset.cartAction;

    if (action === "increase" && (!cart[index].stock || cart[index].quantity < cart[index].stock)) {
        cart[index].quantity += 1;
    }
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
setupProductSearch();
loadSiteSettingsFromSupabase();
loadProductsFromSupabase();
