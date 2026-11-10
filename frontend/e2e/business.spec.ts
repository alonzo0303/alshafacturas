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
  await post(platform, "/empresas/alta", {
    ruc,
    razonSocial: "Comercial de prueba navegador",
    administradorNombre: "Responsable de ventas",
    administradorCorreo: correo,
    administradorPassword: password,
  });
  await platform.dispose();
  return { ruc, correo };
}
test("Empresa: catálogo, stock, venta, comprobante, anulación, sesión y móvil", async ({
  page,
}) => {
  const company = await setup(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("RUC de la empresa").fill(company.ruc);
  await page.getByLabel("Correo electrónico").fill(company.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page.getByLabel("Código / SKU").fill("ACEITE-001");
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Aceite de motor 1 litro");
  await page.getByLabel("Precio de venta").fill("59.00");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "ACEITE-001", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await page
    .getByLabel("Producto", { exact: true })
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
