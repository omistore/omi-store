(function () {
  const config = window.OMI_SUPABASE_CONFIG || {};
  const sessionKey = "omiSupabaseAdminSession";

  function getConfig() {
    if (!config.url || !config.anonKey || config.anonKey.includes("PASTE_")) {
      throw new Error("Supabase nuk është konfiguruar ende. Vendosni publishable/anon key në supabase-config.js.");
    }
    return config;
  }

  function getProductImages(product) {
    if (Array.isArray(product?.image_urls)) {
      return product.image_urls.filter((image) => typeof image === "string" && image);
    }

    const imageUrl = product?.image_url;
    if (typeof imageUrl !== "string" || !imageUrl) return [];
    try {
      const images = JSON.parse(imageUrl);
      if (Array.isArray(images)) return images.filter((image) => typeof image === "string" && image);
    } catch {
      return [imageUrl];
    }
    return [imageUrl];
  }

  function serializeProductImages(images) {
    const urls = images.filter((image) => typeof image === "string" && image);
    if (urls.length > 5) throw new Error("Një produkt mund të ketë maksimumi 5 fotografi.");
    // Keep the existing single-URL format; encode galleries in the same text column.
    return urls.length > 1 ? JSON.stringify(urls) : (urls[0] || null);
  }

  async function readResponse(response) {
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }
    if (!response.ok) {
      throw new Error(data?.msg || data?.message || data?.error_description || data?.hint || data?.details || "Kërkesa te Supabase dështoi.");
    }
    return data;
  }

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(sessionKey) || "null");
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
  }

  async function refreshSession(session) {
    const { url, anonKey } = getConfig();
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const data = await readResponse(response);
    const updated = {
      ...data,
      expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600)
    };
    saveSession(updated);
    return updated;
  }

  async function getValidSession() {
    let session = readSession();
    if (!session?.access_token) throw new Error("Ju lutem hyni si administrator.");
    if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000) + 60) {
      session = await refreshSession(session);
    }
    return session;
  }

  async function signIn(email, password) {
    const { url, anonKey } = getConfig();
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await readResponse(response);
    saveSession({
      ...data,
      expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600)
    });
  }

  async function signOut() {
    const session = readSession();
    const { url, anonKey } = getConfig();
    if (session?.access_token) {
      await fetch(`${url}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`
        }
      });
    }
    sessionStorage.removeItem(sessionKey);
  }

  async function insertOrder(order) {
    const { url, anonKey } = getConfig();
    const response = await fetch(`${url}/rest/v1/orders`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(order)
    });
    await readResponse(response);
  }

  async function getOrders() {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const response = await fetch(`${url}/rest/v1/orders?select=*&order=created_at.desc`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`
      }
    });
    return readResponse(response);
  }

  async function verifyAdmin() {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const response = await fetch(`${url}/rest/v1/store_admins?select=user_id&limit=1`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`
      }
    });
    const admins = await readResponse(response);
    if (!Array.isArray(admins) || admins.length === 0) {
      throw new Error("Kjo llogari nuk ka leje administratori.");
    }
  }

  async function updateOrderStatus(orderNumber, status) {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const params = new URLSearchParams({
      order_number: `eq.${orderNumber}`,
      select: "order_number"
    });
    const response = await fetch(`${url}/rest/v1/orders?${params}`, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ status })
    });
    const rows = await readResponse(response);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Statusi nuk u ndryshua. Kontrolloni lejet e administratorit.");
    }
  }

  async function updateOrderDetails(orderNumber, customer) {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const params = new URLSearchParams({
      order_number: `eq.${orderNumber}`,
      select: "order_number"
    });
    const response = await fetch(`${url}/rest/v1/orders?${params}`, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ customer })
    });
    const rows = await readResponse(response);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Porosia nuk u përditësua. Kontrolloni lejet e administratorit.");
    }
  }

  async function deleteOrder(orderNumber) {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const params = new URLSearchParams({
      order_number: `eq.${orderNumber}`,
      select: "order_number"
    });
    const response = await fetch(`${url}/rest/v1/orders?${params}`, {
      method: "DELETE",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        Prefer: "return=representation"
      }
    });
    const rows = await readResponse(response);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Porosia nuk u fshi. Kontrolloni lejet e administratorit.");
    }
  }

  async function getActiveProducts() {
    const { url, anonKey } = getConfig();
    const response = await fetch(`${url}/rest/v1/store_products?select=*&active=eq.true&order=created_at.desc`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
    });
    return readResponse(response);
  }

  async function getAdminProducts() {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const response = await fetch(`${url}/rest/v1/store_products?select=*&order=created_at.desc`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` }
    });
    return readResponse(response);
  }

  async function uploadProductImage(file) {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    const response = await fetch(`${url}/storage/v1/object/product-images/${encodeURIComponent(path)}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false"
      },
      body: file
    });
    await readResponse(response);

    return `${url}/storage/v1/object/public/product-images/${encodeURIComponent(path)}`;
  }

  async function uploadProductImages(files) {
    if (!Array.isArray(files) || files.length < 1 || files.length > 5) {
      throw new Error("Zgjidhni nga 1 deri në 5 fotografi.");
    }

    const uploadedImages = [];
    try {
      for (const file of files) {
        uploadedImages.push(await uploadProductImage(file));
      }
    } catch (error) {
      if (uploadedImages.length) {
        try {
          await deleteProductImages(uploadedImages);
        } catch (cleanupError) {
          throw new Error(`${error.message} Fotot e ngarkuara pjesërisht nuk u pastruan: ${cleanupError.message}`);
        }
      }
      throw error;
    }
    return uploadedImages;
  }

  async function deleteProductImages(images) {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    for (const imageUrl of images) {
      const marker = "/product-images/";
      const path = imageUrl.includes(marker) ? imageUrl.split(marker)[1].split("?")[0] : "";
      if (!path) continue;

      const response = await fetch(`${url}/storage/v1/object/product-images/${path}`, {
        method: "DELETE",
        headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` }
      });
      await readResponse(response);
    }
  }

  async function createProduct(product) {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const response = await fetch(`${url}/rest/v1/store_products`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(product)
    });
    const rows = await readResponse(response);
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("Produkti nuk u shtua.");
    return rows[0];
  }

  async function updateProduct(name, product) {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const params = new URLSearchParams({ name: `eq.${name}`, select: "name" });
    const response = await fetch(`${url}/rest/v1/store_products?${params}`, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(product)
    });
    const rows = await readResponse(response);
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("Produkti nuk u përditësua.");
  }

  async function deleteProduct(product) {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const params = new URLSearchParams({ name: `eq.${product.name}` });
    const response = await fetch(`${url}/rest/v1/store_products?${params}`, {
      method: "DELETE",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        Prefer: "return=minimal"
      }
    });
    await readResponse(response);

    await deleteProductImages(getProductImages(product));
  }

  async function getSiteSettings() {
    const { url, anonKey } = getConfig();
    const response = await fetch(`${url}/rest/v1/store_site_settings?select=*&id=eq.1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
    });
    const rows = await readResponse(response);
    return Array.isArray(rows) && rows.length ? rows[0] : {};
  }

  async function updateSiteSettings(settings) {
    const { url, anonKey } = getConfig();
    const session = await getValidSession();
    const params = new URLSearchParams({ id: "eq.1", select: "id" });
    const response = await fetch(`${url}/rest/v1/store_site_settings?${params}`, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ ...settings, updated_at: new Date().toISOString() })
    });
    const rows = await readResponse(response);
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("Cilësimet nuk u ruajtën. Kontrolloni lejet e administratorit.");
  }

  window.OmiSupabase = {
    hasSession: () => Boolean(readSession()?.access_token),
    signIn,
    signOut,
    insertOrder,
    getOrders,
    verifyAdmin,
    updateOrderStatus,
    updateOrderDetails,
    deleteOrder,
    getActiveProducts,
    getAdminProducts,
    getSiteSettings,
    updateSiteSettings,
    getProductImages,
    serializeProductImages,
    uploadProductImage,
    uploadProductImages,
    deleteProductImages,
    createProduct,
    updateProduct,
    deleteProduct
  };
})();
