import { QRCodeWriter, BarcodeFormat } from "@zxing/library";
import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const password = "AlshaBrowserTest2026";
async function post(client: APIRequestContext, path: string, body: unknown) {
  const csrfResponse = await client.get("/api/auth/csrf");
  const csrf = await csrfResponse.json();
  const response = await client.post("/api" + path, {
    data: body,
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function setup() {
  const platform = await request.newContext({
    baseURL: process.env.TEST_WEB_URL || "http://127.0.0.1:5173",
  });
  await post(platform, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  const ruc = "20" + String(Date.now()).slice(-9),
    correo = randomUUID() + "@test.local";
  const empresa = await post(platform, "/empresas/alta", {
    ruc,
    razonSocial: "Comercial de prueba navegador",
    administradorNombre: "Responsable de ventas",
    administradorCorreo: correo,
    administradorPassword: password,
  });
  const csrf = await (await platform.get("/api/auth/csrf")).json();
  expect(
    (
      await platform.put(`/api/empresas/${empresa.id}/rubros-catalogo`, {
        data: { rubros: ["Maquillaje"] },
        headers: { [csrf.headerName]: csrf.token },
      })
    ).ok(),
  ).toBeTruthy();
  await platform.dispose();
  return { ruc, correo, id: empresa.id };
}
test("Empresa: catálogo, stock, venta, comprobante, anulación, sesión y móvil", async ({
  page,
}) => {
  const company = await setup(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/login$/);
  // Existing RUC-based businesses also support email-only login.
  await page.getByLabel("Correo electrónico").fill(company.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuevo producto", exact: true })
    .click();
  await page.getByLabel("Código / SKU (opcional)").fill("ACEITE-001");
  await page
    .getByLabel("Nombre del producto", { exact: true })
    .fill("Aceite de motor 1 litro");
  await page.getByLabel("Precio de venta ingresado (S/)").fill("59.00");
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(page.getByRole("cell", { name: /ACEITE-001/ })).toBeVisible();
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await page
    .getByLabel("Producto para ajustar", { exact: true })
    .selectOption({ label: "ACEITE-001 · Aceite de motor 1 litro · Stock 0" });
  await page.getByLabel("Cantidad a sumar o restar").fill("5");
  await page.getByLabel("Motivo del ajuste").fill("Carga inicial");
  await page.getByRole("button", { name: "Registrar ajuste" }).click();
  await expect(page.getByRole("cell", { name: "Carga inicial" })).toBeVisible();
  await page.getByRole("link", { name: "Punto de venta" }).click();
  await page.getByRole("button", { name: /Aceite de motor 1 litro/ }).click();
  await page.getByLabel("Cantidad de Aceite de motor 1 litro").fill("2");
  await page.getByRole("button", { name: "Confirmar venta" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Nota de venta interna" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Documento interno sin validez tributaria.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByText("S/ 118.00", { exact: true }).last(),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({
    path: process.env.TEST_RECEIPT_PATH || "/tmp/alsha-test-receipt.pdf",
    format: "A4",
  });
  expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length).toBe(
    1,
  );
  await page.emulateMedia({ media: "screen" });
  for (const size of ["58", "80"]) {
    await dialog.getByLabel("Formato de impresión").selectOption(size);
    await page.emulateMedia({ media: "print" });
    const thermal = await page.pdf({ preferCSSPageSize: true });
    const boxes = [
      ...thermal
        .toString("latin1")
        .matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g),
    ];
    expect(boxes.length).toBeGreaterThan(0);
    expect(
      Math.abs(Number(boxes[0][1]) - (Number(size) * 72) / 25.4),
    ).toBeLessThan(2);
    await page.emulateMedia({ media: "screen" });
  }
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("link", { name: "Ventas", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "CONFIRMADA", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept("Devolución de prueba"));
  await page.getByRole("button", { name: "Anular", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "ANULADA", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ventas y reportes" }),
  ).toBeVisible();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `horizontal overflow at ${width}`,
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Resumen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: process.env.TEST_SCREENSHOT_PATH || "/tmp/alsha-dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Facturación electrónica", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Estado de la conexión" }),
  ).toBeVisible();
  await expect(
    page.getByText("Pendiente de configuración segura", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("Acceso SUPERADMIN y rutas protegidas", async ({ page }) => {
  await page.goto("/admin/login");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env.TEST_SUPERADMIN_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.TEST_SUPERADMIN_PASSWORD!);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Empresas", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nueva empresa y administrador" }),
  ).toBeVisible();
  await page.goto("/panel/pos");
  await expect(page).toHaveURL(/\/admin\/empresas$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Empresas", exact: true }),
  ).toBeVisible();
});

test("Alta sin RUC y acceso a gestión interna", async ({ page }) => {
  const email = randomUUID() + "@test.local";
  await page.goto("/admin/login");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env.TEST_SUPERADMIN_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.TEST_SUPERADMIN_PASSWORD!);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page
    .getByLabel("Nombre del negocio o razón social")
    .fill("Negocio sin RUC " + email);
  await page
    .getByLabel("Nombre del administrador")
    .fill("Responsable de inventario");
  await page.getByLabel("Correo del administrador").fill(email);
  await page.getByLabel("Contraseña inicial").fill(password);
  await page
    .getByRole("button", { name: "Crear empresa", exact: true })
    .click();
  await expect(page.getByRole("row").filter({ hasText: email })).toContainText(
    "Sin RUC",
  );
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Punto de venta", exact: true }).click();
  await expect(
    page.getByLabel("Documento solicitado").locator("option"),
  ).toHaveCount(1);
  await expect(page.getByLabel("Documento solicitado")).toHaveValue("TICKET");
  await page
    .getByRole("link", { name: "Facturación electrónica", exact: true })
    .click();
  await expect(
    page.getByText("Pendiente de configuración segura", { exact: true }),
  ).toBeVisible();
});

test("Compra con nueva mercadería, costo independiente, catálogo y escáner", async ({
  page,
}) => {
  const company = await setup();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(company.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Registrar compra", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Agregar mercadería", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nombre del producto")
    .fill("Labial compra navegador");
  await dialog.getByLabel("Marca", { exact: true }).fill("Marca de prueba");
  await dialog.getByLabel("Precio de venta ingresado (S/)").fill("15");
  await dialog.getByLabel("Código de barras (opcional)").fill("7750000000011");
  await dialog.getByLabel("Cantidad para esta compra").fill("3");
  await dialog.getByLabel("Costo unitario de esta compra (S/)").fill("8");
  await dialog
    .getByRole("button", { name: "Guardar y añadir a la compra" })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Costo de Labial compra navegador")).toHaveValue(
    "8",
  );
  await page
    .getByLabel("Proveedor", { exact: true })
    .fill("Mayorista de prueba");
  await page
    .getByLabel("Referencia del documento de compra")
    .fill(randomUUID());
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(page.getByText(/Compra registrada/)).toBeVisible();
  await page.getByRole("link", { name: "Resumen", exact: true }).click();
  await expect(page.locator(".stock-alert").first()).toBeVisible();
  expect(
    await page
      .locator(".stock-alert")
      .first()
      .evaluate((el) => getComputedStyle(el).color),
  ).toBe("rgb(180, 35, 24)");
  const table = page.locator("table").first();
  await expect(
    table.getByRole("columnheader", { name: "Stock", exact: true }),
  ).toHaveCSS("text-align", "right");
  await page.getByRole("link", { name: "Punto de venta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Labial compra navegador/ }),
  ).toBeVisible();
  const scanner = page.getByLabel("Buscar por nombre, SKU o código de barras");
  await scanner.fill("7750000000011");
  await scanner.press("Enter");
  await expect(
    page.getByLabel("Cantidad de Labial compra navegador"),
  ).toHaveValue("1");
  const matrix = new QRCodeWriter().encode(
    "7750000000011",
    BarcodeFormat.QR_CODE,
    240,
    240,
    new Map(),
  );
  let pixels = "";
  for (let y = 0; y < matrix.getHeight(); y++)
    for (let x = 0; x < matrix.getWidth(); x++)
      if (matrix.get(x, y))
        pixels += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/><g fill="black">${pixels}</g></svg>`;
  await page.getByLabel("Imagen de código de barras").setInputFiles({
    name: "codigo-prueba.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(svg),
  });
  await expect(
    page.getByLabel("Cantidad de Labial compra navegador"),
  ).toHaveValue("2");
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denegada", "NotAllowedError");
    };
  });
  await page
    .getByRole("button", { name: "Escanear con cámara", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(/cámara|permiso/i);
  await page.getByRole("link", { name: "Catálogo común", exact: true }).click();
  await page
    .getByRole("button", { name: "Usar producto Lápiz de ojos", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Precio de venta ingresado (S/)").fill("9");
  await dialog
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  for (const path of [
    "Productos",
    "Inventario",
    "Registrar compra",
    "Roles",
    "Mi plan",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("link", { name: path, exact: true })
      .click();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(
          async () =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          { message: `${path} overflow ${width}` },
        )
        .toBeTruthy();
    }
  }
});

test("Pago confirmado, cupos, roles y consulta de inventario por vendedor", async ({
  page,
}) => {
  const company = await setup();
  const platform = await request.newContext({
    baseURL: process.env.TEST_WEB_URL || "http://127.0.0.1:5173",
  });
  await post(platform, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  await post(platform, `/empresas/${company.id}/pagos`, {
    plan: "INICIO",
    importe: 35,
    desde: "2026-01-01",
    hasta: "2099-12-31",
    referencia: randomUUID(),
    confirmado: true,
  });
  await platform.dispose();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(company.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.getByRole("link", { name: "Usuarios", exact: true }).click();
  await expect(page.getByText("S/ 35.00", { exact: true })).toBeVisible();
  const email = randomUUID() + "@test.local";
  await page.getByLabel("Nombre completo").fill("Vendedor de prueba");
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña inicial").fill(password);
  await page.getByLabel("Rol", { exact: true }).selectOption("VENDEDOR");
  await page
    .getByRole("button", { name: "Crear usuario", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: email, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Roles", exact: true }).click();
  await page.getByLabel("Nombre del rol").fill("Supervisor de inventario");
  await page.getByLabel("Consultar inventario", { exact: true }).check();
  await page.getByRole("button", { name: "Guardar rol", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Supervisor de inventario", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inventario", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar ajuste", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Usuarios", exact: true }),
  ).toHaveCount(0);
});

test("Fotos, marca morada y desplazamiento con menú móvil", async ({
  page,
}) => {
  const company = await setup();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(company.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuevo producto", exact: true })
    .click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Nombre del producto").fill("Producto con foto");
  await editor.getByLabel("Precio de venta ingresado (S/)").fill("12");
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#7C3AED";
    ctx.fillRect(0, 0, 100, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await editor.getByLabel("Foto del producto (opcional)").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
  await expect(
    editor.getByAltText("Vista previa de la foto del producto"),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  const image = page.getByAltText("Producto con foto", { exact: true });
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Nuevo producto", exact: true }),
  ).toHaveCSS("background-color", "rgb(124, 58, 237)");
  for (const width of [320, 390, 622, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        { message: `Ancho ${width}` },
      )
      .toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole("button", { name: "Menú", exact: true });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await expect(page.getByRole("navigation")).not.toBeVisible();
  await page.getByRole("button", { name: "Menú", exact: true }).click();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  const scroll = page.getByRole("region", { name: /Tabla: Código/ });
  await expect(
    page.getByRole("button", { name: "Más columnas", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Más columnas", exact: true }).click();
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Columnas anteriores", exact: true })
    .click();
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBe(0);
  const slider = page.getByRole("slider", {
    name: /Desplazar columnas de Código/,
  });
  await slider.scrollIntoViewIfNeeded();
  const bounds = (await slider.boundingBox())!;
  await page.mouse.move(bounds.x + 20, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width - 2,
    bounds.y + bounds.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      scroll.evaluate(
        (el) => el.scrollLeft / (el.scrollWidth - el.clientWidth),
      ),
    )
    .toBeGreaterThan(0.9);
  await slider.focus();
  await slider.press("Home");
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBe(0);
  await slider.press("End");
  await expect
    .poll(() =>
      scroll.evaluate(
        (el) => el.scrollLeft / (el.scrollWidth - el.clientWidth),
      ),
    )
    .toBeGreaterThan(0.99);

  await page.getByRole("button", { name: "Menú", exact: true }).click();
  await page.getByRole("link", { name: "Punto de venta", exact: true }).click();
  await expect(
    page.getByAltText("Producto con foto", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Categoría de mercancía").selectOption("General");
  await expect(
    page.getByRole("button", { name: /Producto con foto/ }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("SUPERADMIN asigna el rubro visible para el negocio", async ({ page }) => {
  const company = await setup();
  await page.goto("/admin/login");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env.TEST_SUPERADMIN_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.TEST_SUPERADMIN_PASSWORD!);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page
    .getByLabel("Negocio para habilitar rubros")
    .selectOption(String(company.id));
  await page.getByLabel("Maquillaje", { exact: true }).uncheck();
  await page.getByLabel("Buscar rubros para habilitar").fill("FERRETERIA");
  await page.getByLabel("Ferretería", { exact: true }).check();
  await page.getByLabel("Buscar rubros para habilitar").fill("maq");
  await expect(
    page.getByLabel("Ferretería", { exact: true }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Ferretería", { exact: true })).toBeChecked();
  await page
    .getByRole("button", { name: "Guardar acceso al catálogo", exact: true })
    .click();
  await expect(
    page.getByText("Acceso al catálogo actualizado.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(company.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.getByRole("link", { name: "Catálogo común", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Usar producto Martillo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Usar producto Lápiz labial",
      exact: true,
    }),
  ).toHaveCount(0);
  const rubro = page.getByRole("combobox", { name: "Rubro", exact: true });
  await rubro.click();
  await expect(page.getByRole("option")).toHaveText([
    "Todos los rubros",
    "Ferretería",
  ]);
  await rubro.fill("FERRETERIA");
  await expect(page.getByRole("option")).toHaveText(["Ferretería"]);
  await rubro.press("ArrowDown");
  await rubro.press("Enter");
  await expect(rubro).toHaveValue("Ferretería");
  await rubro.click();
  await page
    .getByRole("option", { name: "Todos los rubros", exact: true })
    .click();
  await expect(rubro).toHaveValue("Todos los rubros");
});

test("Editar negocio conserva su código y permite continuar con sus productos", async ({
  page,
}) => {
  const company = await setup();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(company.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio", exact: true }),
  ).toBeVisible();
  await post(page.request, "/productos", {
    sku: "PERMANECE",
    nombre: "Mercadería que se conserva",
    precio: 10,
    minimo: 2,
    activo: true,
  });
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.goto("/admin/login");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env.TEST_SUPERADMIN_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.TEST_SUPERADMIN_PASSWORD!);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: String(company.id), exact: true }),
  });
  await row.getByRole("button", { name: /Editar/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: `Editar negocio #${company.id}` }),
  ).toBeVisible();
  await dialog
    .getByLabel("Nombre del negocio o razón social")
    .fill("Negocio actualizado en prueba");
  await dialog
    .getByLabel("Dirección", { exact: true })
    .fill("Dirección actualizada");
  await dialog
    .getByRole("button", { name: "Guardar cambios del negocio", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    row.getByRole("cell", {
      name: "Negocio actualizado en prueba",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(company.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await expect(
    page.getByText("Mercadería que se conserva", { exact: true }),
  ).toBeVisible();
});

test("Buscar rubro del catálogo, elegir con teclado y crear uno propio", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env.TEST_SUPERADMIN_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.TEST_SUPERADMIN_PASSWORD!);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.getByRole("link", { name: "Catálogo común", exact: true }).click();
  const name = "Plantilla búsqueda " + randomUUID().slice(0, 8);
  await page.getByLabel("Nombre del producto común").fill(name);
  const rubro = page.getByRole("combobox", {
    name: "Rubro del catálogo",
    exact: true,
  });
  await rubro.fill("ferreteria");
  await expect(page.getByRole("option")).toHaveText(["Ferretería"]);
  await rubro.press("ArrowDown");
  await rubro.press("Enter");
  await expect(rubro).toHaveValue("Ferretería");
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Editar/ }).click();
  await expect(rubro).toHaveValue("Ferretería");
  await page
    .getByRole("button", { name: "Cancelar edición", exact: true })
    .click();
  const custom = "Rubro propio " + randomUUID().slice(0, 8);
  await page.getByLabel("Nombre del producto común").fill(name + " nuevo");
  await rubro.fill(custom);
  await expect(
    page.getByText("Sin coincidencias. Puedes guardar este rubro nuevo.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: name + " nuevo" }),
  ).toContainText(custom);
  await page.setViewportSize({ width: 320, height: 900 });
  await rubro.fill("ferre");
  await expect(
    page.getByRole("option", { name: "Ferretería", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBeTruthy();
  await rubro.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
