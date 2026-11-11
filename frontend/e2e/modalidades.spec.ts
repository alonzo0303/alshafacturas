import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const password = "AlshaModalidades2026";
async function mutate(
  client: APIRequestContext,
  path: string,
  body: unknown,
  method = "POST",
) {
  const csrf = await (await client.get("/api/auth/csrf")).json();
  const response = await client.fetch(`/api${path}`, {
    method,
    data: body,
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
test("Visualización individual: asignación ROOT, Comercio intacto, Atención con personal y roles", async ({
  page,
  browser,
}) => {
  const baseURL = process.env.TEST_WEB_URL || "http://127.0.0.1:5173";
  const platform = await request.newContext({ baseURL });
  await mutate(platform, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  const correo = randomUUID() + "@test.local";
  const company = await mutate(platform, "/empresas/alta", {
    razonSocial: "Negocio modalidades " + randomUUID(),
    administradorNombre: "Responsable modalidades",
    administradorCorreo: correo,
    administradorPassword: password,
  });
  const today = new Date();
  const until = new Date(today);
  until.setDate(until.getDate() + 30);
  const from = new Date(today);
  from.setDate(from.getDate() - 1);
  await mutate(platform, `/empresas/${company.id}/pagos`, {
    plan: "INICIO",
    importe: 35,
    desde: from.toISOString().slice(0, 10),
    hasta: until.toISOString().slice(0, 10),
    referencia: randomUUID(),
    confirmado: true,
  });
  const owner = await request.newContext({ baseURL });
  const ownerSession = await mutate(owner, "/auth/login", {
    empresaId: company.id,
    correo,
    password,
  });
  const staffEmail = randomUUID() + "@test.local";
  await mutate(owner, "/usuarios", {
    nombre: "Personal modalidades",
    correo: staffEmail,
    password,
    rol: "VENDEDOR",
  });
  const product = await mutate(owner, "/productos", {
    nombre: "Producto conservado",
    sku: randomUUID(),
    marca: "Marca conservada",
    precio: 20,
    minimo: 1,
    activo: true,
  });
  const productsBefore = await (await owner.get("/api/productos")).json();
  const planBefore = await (await owner.get("/api/plan")).json();
  await page.context().addCookies((await owner.storageState()).cookies);
  await page.goto("/panel");
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  const rootContext = await browser.newContext({
    baseURL,
    storageState: await platform.storageState(),
  });
  const root = await rootContext.newPage();
  const errors: string[] = [];
  root.on("pageerror", (e) => errors.push(e.message));
  page.on("pageerror", (e) => errors.push(e.message));
  await root.goto("/admin/visualizaciones");
  await root
    .getByLabel("Empresa para asignar visualizaciones")
    .selectOption(String(company.id));
  for (const width of [320, 768, 1024, 1440]) {
    await root.setViewportSize({ width, height: 900 });
    await expect(
      root.getByLabel("Modalidad de Responsable modalidades"),
    ).toBeVisible();
    expect(
      await root.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  expect((await new AxeBuilder({ page: root }).analyze()).violations).toEqual(
    [],
  );
  await root
    .getByLabel("Modalidad de Responsable modalidades")
    .selectOption("ATENCION");
  const save = root.getByRole("button", {
    name: "Guardar visualización de Responsable modalidades",
    exact: true,
  });
  for (const [value, title] of [
    ["BARBERIA", "Barbería"],
    ["RESTAURANTE", "Restaurante"],
    ["OTROS_SERVICIOS", "Otros servicios"],
  ]) {
    await root
      .getByLabel("Tipo de atención de Responsable modalidades")
      .selectOption(value);
    await save.click();
    await expect(
      root.getByText(
        "Visualización guardada. Se aplica al recargar o iniciar sesión.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/atencion$/);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Punto de venta", exact: true }),
    ).toHaveCount(0);
  }
  await root
    .getByLabel("Buscar usuario, correo o rol")
    .fill("Personal modalidades");
  await expect(
    root.getByLabel("Modalidad de Responsable modalidades"),
  ).toHaveCount(0);
  await root.getByLabel("Buscar usuario, correo o rol").fill("");
  await expect(
    root.getByLabel("Modalidad de Responsable modalidades"),
  ).toHaveValue("ATENCION");
  await expect(
    root.getByLabel("Tipo de atención de Responsable modalidades"),
  ).toHaveValue("OTROS_SERVICIOS");
  await root
    .getByRole("button", { name: "Actualizar usuarios", exact: true })
    .click();
  await expect(
    root.getByLabel("Tipo de atención de Responsable modalidades"),
  ).toHaveValue("OTROS_SERVICIOS");
  await page
    .getByRole("link", { name: "Personal", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Usuarios", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Personal modalidades", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Roles", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Roles y permisos", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nombre del rol").fill("Barbero");
  await page
    .getByRole("checkbox", { name: "Gestionar clientes", exact: true })
    .check();
  await page.getByRole("button", { name: "Guardar rol", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Barbero", exact: true }),
  ).toBeVisible();
  await page.goto("/panel/pos");
  await expect(page).toHaveURL(/\/atencion$/);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Otros servicios", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path:
      (process.env.TEST_ARTIFACT_DIR || "test-results") +
      "/atencion-desktop.png",
    fullPage: true,
  });
  const employee = await browser.newContext({ baseURL });
  const employeePage = await employee.newPage();
  await mutate(employee.request, "/auth/login", {
    empresaId: company.id,
    correo: staffEmail,
    password,
  });
  await employeePage.goto("/panel/pos");
  await expect(
    employeePage.getByRole("heading", { name: "Punto de venta", exact: true }),
  ).toBeVisible();
  await root
    .getByLabel("Modalidad de Personal modalidades")
    .selectOption("ATENCION");
  await root
    .getByRole("button", {
      name: "Guardar visualización de Personal modalidades",
      exact: true,
    })
    .click();
  await expect(
    root
      .locator("form")
      .filter({
        has: root.getByRole("heading", {
          name: "Personal modalidades",
          exact: true,
        }),
      })
      .getByRole("status"),
  ).toContainText("Visualización guardada");
  await employeePage.reload();
  await expect(
    employeePage.getByRole("heading", { name: "Barbería", exact: true }),
  ).toBeVisible();
  await expect(
    employeePage.getByRole("link", { name: "Personal", exact: true }),
  ).toHaveCount(0);
  await employeePage.goto("/atencion/usuarios");
  await expect(employeePage).toHaveURL(/\/atencion$/);
  await root
    .getByLabel("Modalidad de Responsable modalidades")
    .selectOption("COMERCIO");
  await save.click();
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  expect(await (await owner.get("/api/productos")).json()).toEqual(
    productsBefore,
  );
  expect(await (await owner.get("/api/plan")).json()).toEqual(planBefore);
  expect(
    productsBefore.find((p: { id: number }) => p.id === product.id).marca,
  ).toBe("Marca conservada");
  expect((await (await owner.get("/api/auth/me")).json()).id).toBe(
    ownerSession.id,
  );
  expect(errors).toEqual([]);
  await employee.close();
  await rootContext.close();
  await platform.dispose();
  await owner.dispose();
});
