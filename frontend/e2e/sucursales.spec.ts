import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const password = "SucursalesBrowser2026";
async function mutate(
  c: APIRequestContext,
  path: string,
  body: unknown,
  method = "POST",
) {
  const csrf = await (await c.get("/api/auth/csrf")).json();
  const r = await c.fetch("/api" + path, {
    method,
    data: body,
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function platform() {
  const c = await request.newContext({
    baseURL: process.env.TEST_WEB_URL || "http://127.0.0.1:5173",
  });
  await mutate(c, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  return c;
}
async function company(c: APIRequestContext, correo: string, name: string) {
  return mutate(c, "/empresas/alta", {
    razonSocial: name,
    administradorNombre: "Responsable " + name,
    administradorCorreo: correo,
    administradorPassword: password,
  });
}
test("Correo compartido: elegir tienda, agregar RUC y cambiar credenciales conservando cuenta", async ({
  page,
  browser,
}) => {
  const root = await platform(),
    correo = randomUUID() + "@test.local";
  const first = await company(root, correo, "Tienda A " + randomUUID()),
    second = await company(root, correo, "Tienda B " + randomUUID());
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page
    .getByLabel("Tienda a la que deseas ingresar")
    .selectOption(String(second.id));
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Empresa #${second.id}`, { exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({
      baseURL: process.env.TEST_WEB_URL || "http://127.0.0.1:5173",
      storageState: await root.storageState(),
    }),
    admin = await context.newPage();
  await admin.goto("/admin/empresas");
  const row = admin.getByRole("row").filter({
    has: admin.getByRole("cell", { name: first.razonSocial, exact: true }),
  });
  await row.getByRole("button", { name: "Editar", exact: false }).click();
  await admin
    .getByLabel("Agregar RUC (opcional)")
    .fill("20" + String(Date.now()).slice(-9));
  await admin
    .getByRole("button", { name: "Guardar cambios del negocio", exact: true })
    .click();
  await expect(admin.getByRole("dialog")).toHaveCount(0);
  await admin.goto("/admin/visualizaciones");
  await admin
    .getByLabel("Empresa para asignar visualizaciones")
    .selectOption(String(second.id));
  await admin
    .getByRole("button", {
      name: `Editar correo y contraseña de Responsable ${second.razonSocial}`,
      exact: true,
    })
    .click();
  const newmail = randomUUID() + "@test.local",
    newpass = "CambioSeguro2026";
  await admin.getByLabel("Nuevo correo", { exact: true }).fill(newmail);
  await admin.getByLabel("Nueva contraseña (opcional)").fill(newpass);
  await admin
    .getByRole("button", { name: "Guardar acceso", exact: true })
    .click();
  await expect(admin.getByRole("dialog")).toHaveCount(0);
  await expect(admin.getByText(newmail, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Correo electrónico").fill(newmail);
  await page.getByLabel("Contraseña", { exact: true }).fill(newpass);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Empresa #${second.id}`, { exact: true }),
  ).toBeVisible();
  await context.close();
  await root.dispose();
});
test("Tipo personalizado, sucursales y cobro de servicio sin stock", async ({
  page,
  browser,
}) => {
  const root = await platform(),
    correo = randomUUID() + "@test.local",
    name = "Servicios " + randomUUID();
  const business = await company(root, correo, name);
  const context = await browser.newContext({
      baseURL: process.env.TEST_WEB_URL || "http://127.0.0.1:5173",
      storageState: await root.storageState(),
    }),
    admin = await context.newPage();
  await admin.goto("/admin/visualizaciones");
  const type = "Spa " + randomUUID();
  await admin.getByLabel("Nombre del tipo de atención").fill(type);
  await admin
    .getByRole("button", { name: "Agregar tipo", exact: true })
    .click();
  await expect(admin.getByRole("status").first()).toContainText(
    "Guardado correctamente",
  );
  await admin
    .getByLabel("Empresa para asignar visualizaciones")
    .selectOption(String(business.id));
  await admin
    .getByLabel(`Modalidad de Responsable ${name}`)
    .selectOption("ATENCION");
  await admin
    .getByLabel(`Tipo de atención de Responsable ${name}`)
    .selectOption({ label: type });
  await admin
    .getByRole("button", {
      name: `Guardar visualización de Responsable ${name}`,
      exact: true,
    })
    .click();
  await expect(
    admin.getByText(
      "Visualización guardada. Se aplica al recargar o iniciar sesión.",
      { exact: true },
    ),
  ).toBeVisible();
  await mutate(page.request, "/auth/login", {
    empresaId: business.id,
    correo,
    password,
  });
  await page.goto("/atencion");
  await expect(
    page.getByRole("heading", { name: type, exact: true }),
  ).toBeVisible();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("link", { name: "Locales", exact: true }).click();
  for (const local of ["Tienda A", "Tienda B"]) {
    await page.getByLabel("Nombre del local", { exact: true }).fill(local);
    await page.getByLabel("Dirección del local").fill("Dirección " + local);
    await page
      .getByRole("button", { name: "Crear local", exact: true })
      .click();
    await expect(
      page.getByRole("cell", { name: local, exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel("Local de trabajo").selectOption({ label: "Tienda A" });
  await expect(page).toHaveURL(/\/atencion$/);
  await page.getByRole("link", { name: "Servicios", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuevo servicio", exact: true })
    .click();
  await page.getByLabel("Nombre del servicio").fill("Corte de cabello");
  await page.getByLabel("Precio del servicio (S/)").fill("25");
  await page.getByLabel("Duración en minutos").fill("30");
  await page
    .getByRole("button", { name: "Guardar servicio", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Corte de cabello", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Cobrar servicios", exact: true })
    .click();
  const serviceOption = page
    .getByLabel("Servicio a cobrar")
    .locator("option")
    .filter({ hasText: "Corte de cabello" });
  await page
    .getByLabel("Servicio a cobrar")
    .selectOption((await serviceOption.getAttribute("value"))!);
  await page.getByLabel("Cantidad de servicios").fill("2");
  await page
    .getByRole("button", { name: "Confirmar cobro de servicio", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Corte de cabello", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("link", { name: "Ventas", exact: true }).click();
  await expect(page.getByRole("cell", { name: /NV01-/ })).toBeVisible();
  await page.getByLabel("Local de trabajo").selectOption({ label: "Tienda B" });
  await expect(page).toHaveURL(/\/atencion$/);
  await page.getByRole("link", { name: "Servicios", exact: true }).click();
  await expect(
    page.getByText("Agrega el primer servicio de este local.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ventas", exact: true }).click();
  await expect(page.getByRole("cell", { name: /NV01-/ })).toHaveCount(0);
  await page.getByLabel("Local de trabajo").selectOption({ label: "Tienda A" });
  await page.getByRole("link", { name: "Servicios", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Corte de cabello", exact: true }),
  ).toBeVisible();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({
    path:
      (process.env.TEST_ARTIFACT_DIR || "test-results") +
      "/servicios-local.png",
    fullPage: true,
  });
  await context.close();
  await root.dispose();
});
