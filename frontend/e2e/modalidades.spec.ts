import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const password = "AlshaModalidades2026";
async function mutate(c: APIRequestContext, p: string, b: unknown, m = "POST") {
  const csrf = await (await c.get("/api/auth/csrf")).json();
  const r = await c.fetch(`/api${p}`, {
    method: m,
    data: b,
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
test("Apariencia heredada, plantillas de puestos y datos propios", async ({
  page,
  browser,
}) => {
  const baseURL = process.env.TEST_WEB_URL || "http://127.0.0.1:5173";
  const root = await request.newContext({ baseURL });
  await mutate(root, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  const correo = randomUUID() + "@test.local";
  const company = await mutate(root, "/empresas/alta", {
    razonSocial: "Herencia " + randomUUID(),
    administradorNombre: "Administrador de herencia",
    administradorCorreo: correo,
    administradorPassword: password,
  });
  const start = new Date(),
    end = new Date();
  start.setDate(start.getDate() - 1);
  end.setDate(end.getDate() + 30);
  await mutate(root, `/empresas/${company.id}/pagos`, {
    plan: "INICIO",
    importe: 35,
    desde: start.toISOString().slice(0, 10),
    hasta: end.toISOString().slice(0, 10),
    referencia: randomUUID(),
    confirmado: true,
  });
  const owner = await request.newContext({ baseURL });
  await mutate(owner, "/auth/login", {
    empresaId: company.id,
    correo,
    password,
  });
  const staffMail = randomUUID() + "@test.local";
  await mutate(owner, "/usuarios", {
    nombre: "Barbero de prueba",
    correo: staffMail,
    password,
    rol: "VENDEDOR",
  });
  await page.context().addCookies((await owner.storageState()).cookies);
  await page.goto("/panel/roles");
  await page
    .getByLabel("Usar plantilla de puesto (opcional)")
    .selectOption("Barbero");
  await expect(page.getByLabel("Nombre del rol")).toHaveValue("Barbero");
  await expect(
    page
      .getByLabel("Registrar mis actividades y etapas", { exact: false })
      .first(),
  ).toBeChecked();
  await expect(
    page.getByText(
      "(personal obrero, barbero, cocinero, bartender o secretario)",
      { exact: true },
    ),
  ).toBeVisible();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  }
  await expect(
    page.getByLabel("Usar plantilla de puesto (opcional)"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Guardar rol", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Barbero", exact: true }),
  ).toBeVisible();
  await page.goto("/panel/configuracion");
  await page.getByLabel("Modalidad del negocio").selectOption("ATENCION");
  await page
    .getByLabel("Tipo de atención del negocio")
    .selectOption("BARBERIA");
  await page.getByLabel("Distribución").selectOption("COMPACTO");
  await page
    .getByRole("button", { name: "Guardar apariencia del negocio" })
    .click();
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-nicho",
    "BARBERIA",
  );
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-density",
    "COMPACTO",
  );
  await expect(
    page.getByRole("link", { name: "Personal", exact: true }),
  ).toBeVisible();
  const ctx = await browser.newContext({ baseURL });
  await mutate(ctx.request, "/auth/login", {
    empresaId: company.id,
    correo: staffMail,
    password,
  });
  const staff = await ctx.newPage();
  await staff.goto("/atencion");
  await expect(staff.locator(".app-shell")).toHaveAttribute(
    "data-nicho",
    "BARBERIA",
  );
  await expect(staff.locator(".app-shell")).toHaveAttribute(
    "data-density",
    "COMPACTO",
  );
  await expect(
    staff.getByRole("link", { name: "Configuración", exact: true }),
  ).toHaveCount(0);
  await staff.getByRole("link", { name: "Ventas", exact: true }).click();
  await expect(
    staff.getByRole("heading", { name: "Mis ventas y reportes" }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page: staff })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.goto("/atencion/roles");
  await page.getByLabel("Nombre del rol").fill("Borrador conservado");
  const config = await (await owner.get("/api/visualizacion-negocio")).json();
  await mutate(
    owner,
    "/visualizacion-negocio",
    { ...config, modalidad: "COMERCIO", tipoAtencion: null, diseno: "AMPLIO" },
    "PUT",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText(/El administrador actualizó la visualización/),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre del rol")).toHaveValue(
    "Borrador conservado",
  );
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-nicho",
    "BARBERIA",
  );
  await page.getByLabel("Nombre del rol").fill("");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-nicho",
    "COMERCIO",
  );
  await ctx.close();
  await owner.dispose();
  await root.dispose();
});
