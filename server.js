const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const dataFile = path.join(root, "orders.json");
const port = Number(process.env.PORT || 3000);
const adminKey = process.env.OMI_ADMIN_KEY || "omi-admin";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function readOrders() {
  if (!fs.existsSync(dataFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(dataFile, JSON.stringify(orders, null, 2));
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function authorized(req) {
  const key = req.headers["x-admin-key"];
  return key === adminKey;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/orders") {
    try {
      const order = await readJson(req);
      if (!order.customer?.name || !order.customer?.phone || !order.customer?.address || !Array.isArray(order.items) || order.items.length === 0) {
        send(res, 400, { error: "Të dhënat e porosisë janë të paplotë." });
        return;
      }

      const orders = readOrders();
      const saved = {
        id: `OMI-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 100)}`,
        createdAt: new Date().toISOString(),
        status: "I ri",
        ...order
      };
      orders.unshift(saved);
      writeOrders(orders);
      send(res, 201, { success: true, order: saved });
    } catch (error) {
      send(res, 400, { error: error.message || "Porosia nuk u pranua." });
    }
    return;
  }

  if (url.pathname.startsWith("/api/admin")) {
    if (!authorized(req)) {
      send(res, 401, { error: "Autorizim i papranueshëm." });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/orders") {
      send(res, 200, { orders: readOrders() });
      return;
    }

    if (req.method === "PATCH" && /^\/api\/admin\/orders\/[^/]+$/.test(url.pathname)) {
      try {
        const id = decodeURIComponent(url.pathname.split("/").pop());
        const { status } = await readJson(req);
        const allowed = ["I ri", "Konfirmuar", "Në transport", "Dorëzuar", "Anuluar"];
        if (!allowed.includes(status)) {
          send(res, 400, { error: "Status i pavlefshëm." });
          return;
        }
        const orders = readOrders();
        const order = orders.find((item) => item.id === id);
        if (!order) {
          send(res, 404, { error: "Porosia nuk u gjet." });
          return;
        }
        order.status = status;
        writeOrders(orders);
        send(res, 200, { success: true, order });
      } catch (error) {
        send(res, 400, { error: error.message });
      }
      return;
    }
  }

  let requestedPath = decodeURIComponent(url.pathname);
  if (requestedPath === "/") requestedPath = "/index.html";
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, "Faqja nuk u gjet.", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      send(res, 500, "Gabim serveri.", "text/plain; charset=utf-8");
      return;
    }
    send(res, 200, content, mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  });
});

server.listen(port, () => {
  console.log(`OMI STORE running at http://localhost:${port}`);
  if (adminKey === "omi-admin") {
    console.log("PARALAJMËRIM: ndrysho OMI_ADMIN_KEY para publikimit.");
  }
});
