import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { QRCodeWriter, BarcodeFormat } from "@zxing/library";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const baseURL = process.env.TEST_WEB_URL || "http://127.0.0.1:5173",
  password = "CicloBrowser2026";
async function write(
  c: APIRequestContext,
  path: string,
  data: unknown,
  method = "POST",
) {
  const csrf = await (await c.get("/api/auth/csrf")).json();
  const r = await c.fetch("/api" + path, {
    method,
    data,
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function setup() {
  const root = await request.newContext({ baseURL });
  await write(root, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  const correo = randomUUID() + "@test.local";
  const company = await write(root, "/empresas/alta", {
    razonSocial: "Ciclo UI " + randomUUID(),
    administradorNombre: "Comprador del ciclo",
    administradorCorreo: correo,
    administradorPassword: password,
  });
  const plan = await (
    await root.get(`/api/empresas/${company.id}/plan`)
  ).json();
  await write(root, `/empresas/${company.id}/pagos`, {
    plan: "ILIMITADO",
    importe: 60,
    desde: plan.fechaActual,
    hasta: "2099-12-31",
    referencia: randomUUID(),
    confirmado: true,
  });
  const owner = await request.newContext({ baseURL });
  await write(owner, "/auth/login", {
    empresaId: company.id,
    correo,
    password,
  });
  return { root, owner, company };
}
function qr(value: string) {
  const m = new QRCodeWriter().encode(
    value,
    BarcodeFormat.QR_CODE,
    240,
    240,
    new Map(),
  );
  let pixels = "";
  for (let y = 0; y < m.getHeight(); y++)
    for (let x = 0; x < m.getWidth(); x++)
      if (m.get(x, y))
        pixels += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/><g fill="black">${pixels}</g></svg>`,
  );
}
test("Pasos 1→2→3, OC automática, código manual/escaneado y compra única vinculada", async ({
  page,
}) => {
  const f = await setup();
  await write(f.owner, "/productos", {
    sku: randomUUID(),
    nombre: "Artículo ciclo barras",
    precio: 20,
    minimo: 1,
    activo: true,
  });
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/panel/compra");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(
    nav.getByRole("link", { name: "1. Registrar compra", exact: true }),
  ).toBeVisible();
  const menu = (await nav.getByRole("link").allTextContents()).map((s) =>
    s.trim(),
  );
  const first = menu.indexOf("1. Registrar compra");
  expect(first).toBeGreaterThanOrEqual(0);
  expect(menu.slice(first, first + 3)).toEqual([
    "1. Registrar compra",
    "2. Órdenes y recepción",
    "3. Compras recibidas",
  ]);
  await expect(page.getByLabel("Orden de compra automática")).toBeVisible();
  await expect(
    page.getByLabel("Registro de compra", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /Artículo ciclo barras.*Añadir/ })
    .click();
  await page.getByLabel("Costo de Artículo ciclo barras").fill("5");
  await page
    .getByRole("button", {
      name: "Editar código de barras de Artículo ciclo barras",
      exact: true,
    })
    .click();
  let editor = page.getByRole("dialog", {
    name: "Código de barras de Artículo ciclo barras",
    exact: true,
  });
  await editor
    .getByLabel("Código de barras del producto", { exact: true })
    .fill("000111222");
  await editor
    .getByLabel("Código de barras del producto", { exact: true })
    .press("Enter");
  await expect(editor).toBeVisible();
  await editor
    .getByRole("button", { name: "Guardar código de barras", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  expect(
    (await (await f.owner.get("/api/productos")).json())[0].codigo_barras,
  ).toBe("000111222");
  await page
    .getByRole("button", {
      name: "Editar código de barras de Artículo ciclo barras",
      exact: true,
    })
    .click();
  editor = page.getByRole("dialog", {
    name: "Código de barras de Artículo ciclo barras",
    exact: true,
  });
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denegado", "NotAllowedError");
    };
  });
  await editor
    .getByRole("button", { name: "Escanear con cámara", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText(/cámara/);
  await editor.getByLabel("Imagen de código de barras").setInputFiles({
    name: "codigo.svg",
    mimeType: "image/svg+xml",
    buffer: qr("000999888"),
  });
  await expect(
    editor.getByLabel("Código de barras del producto", { exact: true }),
  ).toHaveValue("000999888");
  await editor
    .getByRole("button", { name: "Guardar código de barras", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await page
    .getByLabel("Proveedor", { exact: true })
    .fill("Mayorista del ciclo");
  await page
    .getByLabel("Referencia (cotización o pedido del proveedor)")
    .fill("COT-123");
  await page
    .getByRole("button", { name: "Crear orden de compra", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /Abrir OC-/ })).toBeVisible();
  expect((await (await f.owner.get("/api/productos")).json())[0].stock).toBe(0);
  const o = (await (await f.owner.get("/api/compras-ciclo")).json())[0];
  await page
    .getByRole("link", { name: `Abrir ${o.numero}`, exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: o.numero, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: o.numero, exact: true }),
  ).toContainText("000999888");
  await page
    .getByRole("button", { name: "Confirmar recepción", exact: true })
    .click();
  const receipt = page.getByRole("dialog", {
    name: "Verificar recepción de mercadería",
    exact: true,
  });
  await receipt
    .getByLabel("Guía de remisión o factura del proveedor")
    .fill("GR-123");
  await receipt.getByRole("checkbox").check();
  await receipt
    .getByRole("button", { name: "Aprobar ingreso al inventario" })
    .click();
  await expect(receipt).toHaveCount(0);
  await page
    .getByRole("dialog", { name: o.numero, exact: true })
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await nav
    .getByRole("link", { name: "3. Compras recibidas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compras recibidas", exact: true }),
  ).toBeVisible();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByText(o.numero, { exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Recibido / Completado");
  await expect(row).toContainText("Comprador del ciclo");
  expect((await (await f.owner.get("/api/compras-ciclo")).json()).length).toBe(
    1,
  );
  expect((await (await f.owner.get("/api/productos")).json())[0].stock).toBe(1);
  await row.getByRole("button", { name: /Ver \/ descargar compra/ }).click();
  await expect(
    page.getByRole("button", { name: `Ver OC vinculada ${o.numero}` }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Ver OC vinculada ${o.numero}` })
    .click();
  await expect(
    page.getByRole("dialog", { name: o.numero, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: o.numero, exact: true })
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path:
      (process.env.TEST_ARTIFACT_DIR || "test-results") + "/compras-ciclo.png",
    fullPage: true,
  });
  await f.owner.dispose();
  await f.root.dispose();
});
