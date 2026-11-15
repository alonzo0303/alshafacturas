import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const password = "CajaPersonal2026";
async function write(
  c: APIRequestContext,
  path: string,
  body: unknown,
  method = "POST",
) {
  const t = await (await c.get("/api/auth/csrf")).json();
  const r = await c.fetch("/api" + path, {
    method,
    data: body,
    headers: { [t.headerName]: t.token },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  const text = await r.text();
  return text ? JSON.parse(text) : undefined;
}
test("Caja por persona, entrega de fondo y avisos obligatorios en cada entrada y salida", async ({
  page,
  browser,
}) => {
  const baseURL = process.env.TEST_WEB_URL || "http://127.0.0.1:5173";
  const root = await request.newContext({ baseURL });
  await write(root, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  const correo = randomUUID() + "@test.local";
  const company = await write(root, "/empresas/alta", {
    razonSocial: "Caja " + randomUUID(),
    administradorNombre: "Jefe de caja",
    administradorCorreo: correo,
    administradorPassword: password,
  });
  const plan = await (
    await root.get(`/api/empresas/${company.id}/plan`)
  ).json();
  const today = plan.fechaActual;
  await write(root, `/empresas/${company.id}/pagos`, {
    plan: "INICIO",
    importe: 30,
    desde: today,
    hasta: today,
    referencia: randomUUID(),
    confirmado: true,
  });
  const owner = await request.newContext({ baseURL });
  await write(owner, "/auth/login", {
    empresaId: company.id,
    correo,
    password,
  });
  const config = await (await owner.get("/api/visualizacion-negocio")).json();
  await write(
    owner,
    "/visualizacion-negocio",
    { ...config, modalidad: "ATENCION", tipoAtencion: "BARBERIA" },
    "PUT",
  );
  const code =
    "R_" + randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
  await write(owner, "/roles", {
    codigo: code,
    nombre: "Barbero de caja",
    permisos: ["SERVICIOS_VER", "VENTAS_GESTIONAR"],
  });
  const email = randomUUID() + "@test.local";
  const user = await write(owner, "/usuarios", {
    nombre: "Personal de caja",
    correo: email,
    password,
    rol: code,
  });
  await page.context().addCookies((await owner.storageState()).cookies);
  await page.goto("/atencion/usuarios");
  await expect(
    page.getByRole("dialog", { name: "Tu membresía vence hoy", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  const context = await browser.newContext({ baseURL });
  await write(context.request, "/auth/login", {
    empresaId: company.id,
    correo: email,
    password,
  });
  const staff = await context.newPage();
  await staff.goto("/atencion");
  await staff.getByRole("button", { name: "Entendido", exact: true }).click();
  await expect(
    staff.getByRole("link", { name: "Caja y cierres", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("row")
    .filter({
      has: page.getByRole("cell", { name: "Personal de caja", exact: true }),
    })
    .getByRole("button", { name: /Configurar caja/ })
    .click();
  const assign = page.getByRole("dialog", {
    name: "Caja de Personal de caja",
    exact: true,
  });
  await assign.getByLabel("Habilitar Caja para esta persona").check();
  await assign.getByLabel("Fondo asignado para caja (S/, opcional)").fill("30");
  await assign.getByLabel("Entregar el fondo y abrir su caja ahora").check();
  await assign
    .getByRole("button", { name: "Guardar acceso de caja", exact: true })
    .click();
  await expect(assign).toHaveCount(0);
  const assigned = await (await owner.get("/api/cajas")).json();
  const box = assigned.find(
    (c: { usuario_original_id: number }) => c.usuario_original_id === user.id,
  );
  expect(box.fondo).toBe(30);
  await staff.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    staff.getByRole("link", { name: "Caja y cierres", exact: true }),
  ).toBeVisible();
  await staff
    .getByRole("link", { name: "Caja y cierres", exact: true })
    .click();
  await staff
    .getByRole("button", { name: `Ver caja ${box.id}`, exact: true })
    .click();
  const detail = staff.getByRole("dialog", {
    name: `Caja #${box.id}`,
    exact: true,
  });
  await expect(detail).toContainText("Abrió: Jefe de caja");
  await detail.getByRole("button", { name: "Cerrar", exact: true }).click();
  await staff
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  const exit = staff.getByRole("dialog", {
    name: "Tu membresía vence hoy",
    exact: true,
  });
  await expect(exit).toContainText("Tienes cajas abiertas");
  await expect(exit).toContainText("S/ 30.00");
  for (const width of [320, 768, 1024, 1440]) {
    await staff.setViewportSize({ width, height: 900 });
    expect(
      await staff.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  }
  expect(
    (
      await new AxeBuilder({ page: staff })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await exit
    .getByRole("button", { name: "Salir sin cerrar la caja", exact: true })
    .click();
  await expect(staff).toHaveURL(/\/login$/);
  expect((await (await owner.get(`/api/cajas/${box.id}`)).json()).estado).toBe(
    "ABIERTA",
  );
  await staff.getByLabel("Correo electrónico").fill(email);
  await staff.getByLabel("Contraseña", { exact: true }).fill(password);
  await staff
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    staff.getByRole("dialog", { name: "Tu membresía vence hoy", exact: true }),
  ).toBeVisible();
  await staff.getByRole("button", { name: "Entendido", exact: true }).click();
  await staff.evaluate(() => window.dispatchEvent(new Event("focus")));
  await staff
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await staff
    .getByRole("button", { name: "Revisar y cerrar mi caja", exact: true })
    .click();
  await staff
    .getByRole("button", { name: `Ver caja ${box.id}`, exact: true })
    .click();
  await staff.getByLabel("Efectivo contado al cierre (S/)").fill("25");
  await expect(staff.getByLabel("Comentario del cierre")).toHaveAttribute(
    "required",
    "",
  );
  await staff
    .getByRole("button", { name: "Confirmar cierre de caja", exact: true })
    .click();
  await expect(staff.getByLabel("Comentario del cierre")).toBeVisible();
  expect((await (await owner.get(`/api/cajas/${box.id}`)).json()).estado).toBe(
    "ABIERTA",
  );
  await staff
    .getByLabel("Comentario del cierre")
    .fill("Faltan S/5 en el conteo de monedas");
  await staff
    .getByRole("button", { name: "Confirmar cierre de caja", exact: true })
    .click();
  await expect(staff.getByRole("dialog")).toHaveCount(0);
  await staff
    .getByRole("button", { name: `Ver caja ${box.id}`, exact: true })
    .click();
  await expect(
    staff.getByText("Faltan S/5 en el conteo de monedas", { exact: true }),
  ).toBeVisible();
  await expect(staff.getByRole("dialog")).toContainText(
    "Registrado por Personal de caja",
  );
  await staff
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await write(
    owner,
    `/cajas/personal/${user.id}`,
    { habilitada: true, fondoAsignado: 70, abrirAhora: false },
    "PUT",
  );
  await staff
    .getByRole("button", { name: "Actualizar cajas", exact: true })
    .click();
  await expect(staff.getByLabel("Fondo inicial en efectivo (S/)")).toHaveValue(
    "70",
  );
  await expect(
    staff.getByLabel("Fondo inicial en efectivo (S/)"),
  ).not.toBeEditable();
  await staff.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await expect(
    staff.getByRole("cell", { name: "ABIERTA", exact: true }),
  ).toBeVisible();
  const currentBoxes = await (await context.request.get("/api/cajas")).json();
  const ownBox = currentBoxes.find(
    (c: { estado: string }) => c.estado === "ABIERTA",
  );
  expect(ownBox.fondo).toBe(70);
  await staff
    .getByRole("button", { name: `Ver caja ${ownBox.id}`, exact: true })
    .click();
  await staff.getByLabel("Efectivo contado al cierre (S/)").fill("70");
  await staff
    .getByRole("button", { name: "Confirmar cierre de caja", exact: true })
    .click();
  await expect(staff.getByRole("dialog")).toHaveCount(0);
  await staff
    .getByRole("button", { name: `Ver caja ${ownBox.id}`, exact: true })
    .click();
  await staff
    .getByLabel("Comentario del cierre")
    .fill("Arqueo verificado sin diferencia");
  await staff
    .getByRole("button", { name: "Guardar comentario del cierre", exact: true })
    .click();
  await expect(
    staff.getByText("Arqueo verificado sin diferencia", { exact: true }),
  ).toBeVisible();
  await expect(staff.getByLabel("Comentario del cierre")).toHaveCount(0);
  const annotated = await (await owner.get(`/api/cajas/${ownBox.id}`)).json();
  expect(annotated.efectivo_contado).toBe(70);
  expect(annotated.diferencia).toBe(0);
  await staff
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();

  await staff
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    staff.getByRole("dialog", { name: "Tu membresía vence hoy", exact: true }),
  ).toBeVisible();
  await expect(
    staff.getByText("Tienes cajas abiertas.", { exact: false }),
  ).toHaveCount(0);
  await staff
    .getByRole("button", { name: "Continuar y cerrar sesión", exact: true })
    .click();
  await expect(staff).toHaveURL(/\/login$/);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Tu membresía vence hoy", exact: true }),
  ).toBeVisible();
  await context.close();
  await owner.dispose();
  await root.dispose();
});
