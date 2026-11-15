import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
const baseURL = process.env.TEST_WEB_URL || "http://127.0.0.1:5173";
const password = "RecepcionBrowser2026";
async function write(
  c: APIRequestContext,
  path: string,
  data: unknown,
  method = "POST",
) {
  const t = await (await c.get("/api/auth/csrf")).json();
  const r = await c.fetch("/api" + path, {
    method,
    data,
    headers: { [t.headerName]: t.token },
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
    razonSocial: "Recepción UI " + randomUUID(),
    administradorNombre: "Comprador UI",
    administradorCorreo: correo,
    administradorPassword: password,
  });
  const plan = await (
    await root.get(`/api/empresas/${company.id}/plan`)
  ).json();
  await write(root, `/empresas/${company.id}/pagos`, {
    plan: "INICIO",
    importe: 30,
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
test("OC pendiente, recepción física y autor visible con fecha y hora", async ({
  page,
}) => {
  const f = await setup();
  const p = await write(f.owner, "/productos", {
    sku: randomUUID(),
    nombre: "Caja de prueba OC",
    precio: 10,
    minimo: 1,
    activo: true,
  });
  const o = await write(f.owner, "/compras", {
    idempotencia: randomUUID(),
    proveedor: "Proveedor UI",
    referencia: "COT-" + randomUUID(),
    lineas: [{ productoId: p.id, cantidad: 3, costo: 4 }],
  });
  expect((await (await f.owner.get("/api/productos")).json())[0].stock).toBe(0);
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/panel/ordenes-compra");
  await expect(
    page.getByRole("cell", { name: "Pendiente de recepción", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Comprador UI", { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver orden " + o.numero, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar recepción", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Verificar recepción de mercadería",
    exact: true,
  });
  await modal
    .getByLabel("Guía de remisión o factura del proveedor")
    .fill("GR-UI-001");
  await modal.getByRole("checkbox").check();
  await modal
    .getByRole("button", { name: "Aprobar ingreso al inventario" })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByText(/Recibió: Comprador UI/)).toBeVisible();
  expect((await (await f.owner.get("/api/productos")).json())[0].stock).toBe(3);
  await f.owner.dispose();
  await f.root.dispose();
});
test("Upgrade inmediato permite confirmar diferencia sin mover el vencimiento", async ({
  page,
}) => {
  const f = await setup();
  await page.context().addCookies((await f.root.storageState()).cookies);
  await page.goto("/admin/pagos");
  await page
    .getByLabel("Negocio para gestionar el plan")
    .selectOption(String(f.company.id));
  await page.getByLabel("Nuevo plan para este período").selectOption("EQUIPO");
  await page
    .getByRole("button", { name: "Calcular diferencia de hoy" })
    .click();
  await expect(page.getByText(/Diferencia a recibir/)).toBeVisible();
  await page.getByLabel("Referencia del pago adicional").fill(randomUUID());
  await page
    .getByLabel("Confirmo que recibí y verifiqué este pago adicional")
    .check();
  await page
    .getByRole("button", { name: "Confirmar upgrade inmediato" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Upgrades aplicados" }),
  ).toBeVisible();
  const p = await (await f.owner.get("/api/plan")).json();
  expect(p.plan).toBe("EQUIPO");
  expect(p.limiteEmpleados).toBe(2);
  expect(p.pagoActual.hasta).toBe("2099-12-31");
  await f.owner.dispose();
  await f.root.dispose();
});
test("Caja descuenta el egreso y bloquea cierre con sobrante sin justificar", async ({
  page,
}) => {
  const f = await setup();
  const c = await write(f.owner, "/cajas", { fondo: 30 });
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/panel/cajas");
  await page
    .getByRole("button", { name: "Ver caja " + c.id, exact: true })
    .click();
  await page.getByLabel("Importe del movimiento (S/)").fill("5");
  await page
    .getByLabel("Motivo / Justificación del movimiento")
    .fill("Compra de bolsas");
  await page
    .getByRole("button", { name: "Registrar movimiento", exact: true })
    .click();
  await expect(
    page.getByText("Compra de bolsas", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Efectivo contado al cierre (S/)").fill("26");
  const close = page.getByRole("button", {
    name: "Confirmar cierre de caja",
    exact: true,
  });
  await expect(close).toBeDisabled();
  await page.getByLabel("Comentario del cierre").fill("   ");
  await expect(close).toBeDisabled();
  await page
    .getByLabel("Comentario del cierre")
    .fill("Sobra una moneda en el conteo");
  await expect(close).toBeEnabled();
  await close.click();
  await expect(
    page.getByRole("dialog", { name: `Caja #${c.id}`, exact: true }),
  ).toHaveCount(0);
  const result = await (await f.owner.get(`/api/cajas/${c.id}`)).json();
  expect(result.efectivo_esperado).toBe(25);
  expect(result.diferencia).toBe(1);
  expect(result.comentario_cierre).toBe("Sobra una moneda en el conteo");
  await f.owner.dispose();
  await f.root.dispose();
});

test("Vendedor recién creado ve productos y consulta inventario en atención", async ({
  page,
}) => {
  const f = await setup();
  const visual = await (await f.owner.get("/api/visualizacion-negocio")).json();
  await write(
    f.owner,
    "/visualizacion-negocio",
    { ...visual, modalidad: "ATENCION", tipoAtencion: "BARBERIA" },
    "PUT",
  );
  const correo = randomUUID() + "@test.local";
  await write(f.owner, "/usuarios", {
    nombre: "Vendedor atención",
    correo,
    password,
    rol: "VENDEDOR",
  });
  const staff = await request.newContext({ baseURL });
  await write(staff, "/auth/login", {
    empresaId: f.company.id,
    correo,
    password,
  });
  await page.context().addCookies((await staff.storageState()).cookies);
  await page.goto("/atencion");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Productos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Productos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Inventario", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inventario", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar ajuste", exact: true }),
  ).toHaveCount(0);
  await staff.dispose();
  await f.owner.dispose();
  await f.root.dispose();
});
