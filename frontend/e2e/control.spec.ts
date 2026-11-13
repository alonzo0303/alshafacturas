import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
const password = "ControlBrowser2026";
const baseURL = process.env.TEST_WEB_URL || "http://127.0.0.1:5173";
async function write(
  c: APIRequestContext,
  path: string,
  body: unknown,
  method = "POST",
) {
  const token = await (await c.get("/api/auth/csrf")).json();
  const r = await c.fetch("/api" + path, {
    method,
    data: body,
    headers: { [token.headerName]: token.token },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  const text = await r.text();
  return text ? JSON.parse(text) : undefined;
}
async function setup(name: string) {
  const root = await request.newContext({ baseURL });
  await write(root, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  const correo = randomUUID() + "@test.local";
  const company = await write(root, "/empresas/alta", {
    razonSocial: name + " " + randomUUID(),
    administradorNombre: "Responsable " + name,
    administradorCorreo: correo,
    administradorPassword: password,
  });
  await write(root, `/empresas/${company.id}/pagos`, {
    plan: "INICIO",
    importe: 35,
    desde: "2026-01-01",
    hasta: "2099-12-31",
    referencia: randomUUID(),
    confirmado: true,
  });
  const owner = await request.newContext({ baseURL });
  const session = await write(owner, "/auth/login", {
    empresaId: company.id,
    correo,
    password,
  });
  return { root, owner, company, correo, session };
}

test("Personal: confirmar baja, reservar, restablecer, reactivar y eliminar manualmente", async ({
  page,
}) => {
  const f = await setup("Personal UI");
  const u = await write(f.owner, "/usuarios", {
    nombre: "Colaborador UI",
    correo: randomUUID() + "@test.local",
    password,
    rol: "VENDEDOR",
  });
  await page.context().addCookies((await f.root.storageState()).cookies);
  await page.goto("/admin/personal");
  await page
    .getByLabel("Empresa del personal")
    .selectOption(String(f.company.id));
  const row = page
    .getByRole("row")
    .filter({ has: page.getByText(u.correo, { exact: true }) });
  await row.getByRole("button", { name: /^Desactivar/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "¿Está seguro de realizar esta acción?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(
    (
      await (
        await f.root.get(`/api/admin/personal?empresaId=${f.company.id}`)
      ).json()
    ).find((r: { id: number }) => r.id === u.id).activo,
  ).toBe(true);
  await row.getByRole("button", { name: /^Desactivar/ }).click();
  await page
    .getByRole("button", { name: "Confirmar acción", exact: true })
    .click();
  await expect(row.getByText("Desactivado", { exact: true })).toBeVisible();
  expect((await (await f.owner.get("/api/plan")).json()).cuposReservados).toBe(
    1,
  );
  await row.getByRole("button", { name: /^Editar acceso/ }).click();
  await expect(page.getByText(/Esta cuenta está desactivada/)).toBeVisible();
  await page.getByLabel("Nueva contraseña (opcional)").fill("        ");
  await page
    .getByRole("button", { name: "Guardar acceso", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Nueva contraseña (opcional)").fill("NuevaControl2026");
  await page
    .getByRole("button", { name: "Guardar acceso", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await row.getByRole("button", { name: /^Reactivar/ }).click();
  await page
    .getByRole("button", { name: "Confirmar acción", exact: true })
    .click();
  await expect(row.getByText("Activo", { exact: true })).toBeVisible();
  const login = await request.newContext({ baseURL });
  expect(
    (
      await write(login, "/auth/login", {
        empresaId: f.company.id,
        correo: u.correo,
        password: "NuevaControl2026",
      })
    ).id,
  ).toBe(u.id);
  await login.dispose();
  await row.getByRole("button", { name: /^Desactivar/ }).click();
  await page
    .getByRole("button", { name: "Confirmar acción", exact: true })
    .click();
  await row.getByRole("button", { name: /^Eliminar/ }).click();
  await expect(
    page.getByRole("button", { name: "Eliminar definitivamente", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Entiendo que la eliminación de la cuenta es permanente.")
    .check();
  await page
    .getByRole("button", { name: "Eliminar definitivamente", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  expect((await (await f.owner.get("/api/plan")).json()).cuposOcupados).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await f.root.dispose();
  await f.owner.dispose();
});

test("Restaurante: mesa, impresión A4/80/58, cobro único y comidas en rendimiento", async ({
  page,
}, testInfo) => {
  const f = await setup("Restaurante UI");
  const profiles = await (
    await f.root.get("/api/experiencia/plantillas")
  ).json();
  await write(
    f.root,
    `/experiencia/configuracion?empresaId=${f.company.id}`,
    {
      modo: "ESPECIFICO",
      plantillaId: profiles.find(
        (p: { codigo: string }) => p.codigo === "RESTAURANTE",
      ).id,
    },
    "PUT",
  );
  await write(
    f.root,
    `/admin/visualizaciones/${f.session.id}?empresaId=${f.company.id}`,
    { modalidad: "ATENCION", tipoAtencion: "RESTAURANTE" },
    "PATCH",
  );
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/atencion");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-nicho",
    "RESTAURANTE",
  );
  await page.getByRole("link", { name: "Servicios", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuevo servicio", exact: true })
    .click();
  await page.getByLabel("Nombre del servicio").fill("Menú diario");
  await page.getByLabel("Precio del servicio (S/)").fill("15");
  await page.getByLabel("Contabilizar como comida en rendimiento").check();
  await page
    .getByRole("button", { name: "Guardar servicio", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Menú diario", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Mesas", exact: true }).click();
  await page.getByRole("button", { name: "Nueva mesa", exact: true }).click();
  await page.getByLabel("Nombre de la mesa").fill("Mesa 1");
  await page.getByRole("button", { name: "Guardar mesa", exact: true }).click();
  await page
    .getByRole("button", { name: "Atender mesa Mesa 1", exact: true })
    .click();
  const select = page.getByLabel("Agregar artículo al pedido");
  const id = await select
    .locator("option")
    .filter({ hasText: "Menú diario" })
    .getAttribute("value");
  await select.selectOption(id!);
  await page
    .getByRole("button", { name: "Agregar al pedido", exact: true })
    .click();
  await page.getByLabel("Cantidad de Menú diario en pedido").fill("2");
  await page
    .getByRole("button", { name: "Guardar pedido", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Imprimir pedido", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Imprimir pedido", exact: true })
    .click();
  const print = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Pedido de mesa", exact: true }),
  });
  await expect(print).toBeVisible();
  for (const [format, width] of [
    ["A4", 210],
    ["80", 80],
    ["58", 58],
  ] as const) {
    await print.getByLabel("Formato de documento interno").selectOption(format);
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({
      path: testInfo.outputPath(`pedido-${format}.pdf`),
      preferCSSPageSize: true,
    });
    const match = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)/.exec(
      pdf.toString("latin1"),
    );
    expect(match).not.toBeNull();
    expect(Math.abs(Number(match![1]) - (width * 72) / 25.4)).toBeLessThan(2);
    await page.emulateMedia({ media: "screen" });
  }
  expect(await (await f.owner.get("/api/ventas")).json()).toEqual([]);
  expect(await (await f.owner.get("/api/inventario")).json()).toEqual([]);
  await print
    .getByRole("button", { name: "Cerrar impresión", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar cobro del pedido", exact: true })
    .click();
  const receipt = page.getByRole("dialog").filter({
    has: page.getByRole("heading", {
      name: "Nota de venta interna",
      exact: true,
    }),
  });
  await expect(receipt).toBeVisible();
  await receipt.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  expect(
    (await (await f.owner.get("/api/mesas")).json())[0].pedido_id,
  ).toBeNull();
  await page.getByRole("link", { name: "Rendimiento", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Por colaborador", exact: true }),
  ).toBeVisible();
  const metric = await (await f.owner.get("/api/rendimiento")).json();
  expect(Number(metric.ventas[0].comidas)).toBe(2);
  await expect(
    page.getByText("S/ 30.00", { exact: true }).first(),
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
  await page.screenshot({
    path: testInfo.outputPath("restaurante-rendimiento.png"),
    fullPage: true,
  });
  await f.root.dispose();
  await f.owner.dispose();
});

test("Comercio: preparación vinculada, cierre, CSV y orden con factura adjunta", async ({
  page,
}, testInfo) => {
  const f = await setup("Comercio UI");
  await write(
    f.root,
    `/operacion/configuracion?empresaId=${f.company.id}`,
    {
      preparacionHabilitada: true,
      cajaObligatoria: true,
      rendimientoModo: "AMBOS",
    },
    "PUT",
  );
  const p = await write(f.owner, "/productos", {
    sku: randomUUID(),
    nombre: "Artículo de preparación",
    precio: 8,
    minimo: 8,
    activo: true,
  });
  await write(f.owner, "/inventario/ajustes", {
    productoId: p.id,
    cantidad: 10,
    motivo: "Carga de navegador",
  });
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/panel/cajas");
  await page.getByLabel("Fondo inicial en efectivo (S/)").fill("10");
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "ABIERTA", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Punto de venta", exact: true }).click();
  await page.getByRole("button", { name: /Artículo de preparación/ }).click();
  await page
    .getByLabel("Cantidad de Artículo de preparación", { exact: true })
    .fill("2");
  await page
    .getByRole("button", {
      name: "Generar preparación antes de cobrar",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Hoja de preparación de artículos",
      exact: true,
    }),
  ).toBeVisible();
  expect((await (await f.owner.get("/api/productos")).json())[0].stock).toBe(
    10,
  );
  await page
    .getByRole("button", { name: "Cerrar impresión", exact: true })
    .click();
  await page
    .getByLabel("Cantidad de Artículo de preparación", { exact: true })
    .fill("3");
  await page
    .getByRole("button", { name: "Confirmar venta", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("El carrito cambió");
  await page
    .getByRole("button", {
      name: "Actualizar / imprimir preparación",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Cerrar impresión", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar venta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nota de venta interna", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  expect((await (await f.owner.get("/api/productos")).json())[0].stock).toBe(7);
  await page.getByRole("link", { name: "Caja y cierres", exact: true }).click();
  await page.getByRole("button", { name: /^Ver caja/ }).click();
  await page.getByLabel("Efectivo contado al cierre (S/)").fill("34");
  await page
    .getByRole("button", { name: "Confirmar cierre de caja", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "CERRADA", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  const dlEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar stock CSV", exact: true })
    .click();
  const dl = await dlEvent;
  const path = testInfo.outputPath("stock.csv");
  await dl.saveAs(path);
  expect(await readFile(path, "utf8")).toContain(p.sku);
  await page.getByRole("link", { name: "Ventas", exact: true }).click();
  await expect(page.getByText("🔴 Stock bajo", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Registrar compra", exact: true })
    .click();
  await page.getByRole("button", { name: /Artículo de preparación/ }).click();
  await page
    .getByLabel("Registro de compra", { exact: true })
    .selectOption("ORDEN");
  await page
    .getByLabel("Cantidad de Artículo de preparación", { exact: true })
    .fill("2");
  await page
    .getByLabel("Costo de Artículo de preparación", { exact: true })
    .fill("4");
  await page.getByLabel("Proveedor", { exact: true }).fill("Proveedor UI");
  await page
    .getByLabel("Referencia del documento de compra")
    .fill("OC-" + randomUUID());
  await page
    .getByRole("button", { name: "Crear orden de compra", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "creada. El stock no cambió" }),
  ).toBeVisible();
  expect((await (await f.owner.get("/api/productos")).json())[0].stock).toBe(7);
  await page
    .getByRole("link", { name: "Órdenes de compra", exact: true })
    .click();
  await page.getByRole("button", { name: /^Ver orden/ }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("cell", { name: "Artículo de preparación", exact: true }),
  ).toBeVisible();
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\ntrailer <</Root 1 0 R>>\n%%EOF",
  );
  await page.getByLabel("Archivo de compra").setInputFiles({
    name: "factura.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page
    .getByRole("button", { name: "Subir documento", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "factura.pdf", exact: true }),
  ).toBeVisible();
  const docEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar factura.pdf", exact: true })
    .click();
  const doc = await docEvent;
  await doc.saveAs(testInfo.outputPath("factura.pdf"));
  expect(await readFile(testInfo.outputPath("factura.pdf"))).toEqual(pdf);
  await page
    .getByRole("button", { name: "Confirmar recepción", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar acción", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Detalle de compra #/ }),
  ).toBeVisible();
  expect((await (await f.owner.get("/api/productos")).json())[0].stock).toBe(9);
  await f.root.dispose();
  await f.owner.dispose();
});
