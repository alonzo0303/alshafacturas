import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const password = "SubscriptionBrowser2026";
const baseURL = process.env.TEST_WEB_URL || "http://127.0.0.1:5173";
async function write(
  c: APIRequestContext,
  path: string,
  data: unknown,
  method = "POST",
) {
  const token = await (await c.get("/api/auth/csrf")).json();
  const r = await c.fetch("/api" + path, {
    method,
    data,
    headers: { [token.headerName]: token.token },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
async function setup() {
  const root = await request.newContext({ baseURL });
  await write(root, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  const correo = randomUUID() + "@test.local";
  const company = await write(root, "/empresas/alta", {
    razonSocial: "Suscripción UI " + randomUUID(),
    administradorNombre: "Principal UI",
    administradorCorreo: correo,
    administradorPassword: password,
  });
  const state = await (
    await root.get(`/api/empresas/${company.id}/plan`)
  ).json();
  return { root, company, correo, today: state.fechaActual as string };
}
function days(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
async function pay(
  f: Awaited<ReturnType<typeof setup>>,
  from: string,
  to: string,
) {
  return write(f.root, `/empresas/${f.company.id}/pagos`, {
    plan: "INICIO",
    importe: 35,
    desde: from,
    hasta: to,
    referencia: randomUUID(),
    confirmado: true,
  });
}
async function login(page: import("@playwright/test").Page, correo: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
}
test("SuperAdmin asigna rubro con búsqueda y habilita servicios sin perder datos", async ({
  page,
}, testInfo) => {
  const f = await setup();
  await pay(f, f.today, days(f.today, 5));
  await page.context().addCookies((await f.root.storageState()).cookies);
  await page.goto("/admin/empresas");
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: String(f.company.id), exact: true }),
  });
  await row.getByRole("button", { name: /Editar/ }).click();
  const dialog = page.getByRole("dialog");
  const rubro = dialog.getByRole("combobox", {
    name: "Rubro / giro de negocio",
    exact: true,
  });
  await rubro.fill("barberia");
  await dialog.getByRole("option", { name: "Barbería", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Guardar cambios del negocio", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText("Barbería");
  const users = await (
    await f.root.get(`/api/admin/visualizaciones?empresaId=${f.company.id}`)
  ).json();
  await write(
    f.root,
    `/admin/visualizaciones/${users[0].id}?empresaId=${f.company.id}`,
    { modalidad: "ATENCION", tipoAtencion: "BARBERIA" },
    "PATCH",
  );
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await login(page, f.correo);
  await page.getByRole("link", { name: "Catálogo común", exact: true }).click();
  await expect(
    page.getByText("Tu membresía vence en 5 días.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Corte de cabello", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Afeitado", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Martillo", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Usar servicio Corte de cabello",
      exact: true,
    })
    .click();
  await page.getByLabel("Precio del servicio a incorporar (S/)").fill("25");
  await page
    .getByRole("button", { name: "Incorporar servicio", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Servicios", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Corte de cabello", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Notificaciones", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Notificaciones de membresía" }),
  ).toBeVisible();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBeTruthy();
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("avisos.png"),
    fullPage: true,
  });
  await f.root.dispose();
});
test("Plan futuro muestra importe, fecha y estado programado en el panel", async ({
  page,
}, testInfo) => {
  const f = await setup();
  const tomorrow = days(f.today, 1);
  await pay(f, tomorrow, tomorrow);
  await page.context().addCookies((await f.root.storageState()).cookies);
  await page.goto("/admin/pagos");
  await page
    .getByLabel("Negocio para gestionar el plan")
    .selectOption(String(f.company.id));
  const summary = page
    .locator(".plan-summary")
    .filter({ hasText: "Plan asignado" });
  await expect(summary).toContainText("Programado");
  await expect(summary).toContainText("S/ 35.00");
  await expect(summary).toContainText(tomorrow.split("-").reverse().join("/"));
  await expect(summary).toContainText("0 / 2");
  await expect(
    page.getByText(
      "El pago está registrado, pero su vigencia aún no empieza.",
      { exact: false },
    ),
  ).toBeVisible();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBeTruthy();
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("plan-programado.png"),
    fullPage: true,
  });
  await f.root.dispose();
});
test("Vencimiento bloquea sesión y login; renovación permite volver sin perder productos", async ({
  page,
}, testInfo) => {
  const f = await setup();
  await login(page, f.correo);
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await write(page.request, "/productos", {
    nombre: "Mercadería conservada",
    precio: 10,
    minimo: 1,
    activo: true,
  });
  await pay(f, days(f.today, -30), days(f.today, -1));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Membresía vencida", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText(
    "Tu membresía ha vencido. Por favor realiza el pago para restablecer el servicio.",
  );
  await expect(
    page.getByRole("link", { name: "Punto de venta", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Volver al acceso" }).click();
  await page.getByLabel("Correo electrónico").fill(f.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Membresía vencida", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBeTruthy();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("bloqueo-membresia.png"),
    fullPage: true,
  });
  await pay(f, f.today, days(f.today, 30));
  await page.getByRole("button", { name: "Volver al acceso" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("Correo electrónico").fill(f.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await expect(
    page.getByRole("cell").filter({ hasText: "Mercadería conservada" }).first(),
  ).toBeVisible();
  await f.root.dispose();
});
