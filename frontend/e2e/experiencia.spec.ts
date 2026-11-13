import {
  test,
  expect,
  request,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const baseURL = process.env.TEST_WEB_URL || "http://127.0.0.1:5173";
const password = "ExperienciaBrowser2026";
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
  const body = await r.text();
  return body ? JSON.parse(body) : undefined;
}
async function setup() {
  const root = await request.newContext({ baseURL });
  await write(root, "/auth/admin/login", {
    correo: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
  });
  const correo = randomUUID() + "@test.local";
  const company = await write(root, "/empresas/alta", {
    razonSocial: "Experiencia UI " + randomUUID(),
    administradorNombre: "Responsable UI",
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
async function rule(f: Awaited<ReturnType<typeof setup>>, patch: object = {}) {
  return write(f.root, "/experiencia/reglas", {
    idempotencia: randomUUID(),
    empresaId: f.company.id,
    nombre: "Aviso UI",
    titulo: "Recordatorio de prueba",
    mensaje: "Hola {{negocio}}. <script>window.unsafe=true</script>",
    disparadores: ["PAGE_OPEN"],
    paginas: ["RENDIMIENTO"],
    roles: ["ADMIN"],
    condicion: "SIEMPRE",
    frecuencia: "SESION",
    prioridad: 100,
    accion: "VER_ACTIVIDADES",
    activa: true,
    ...patch,
  });
}
async function responsive(page: Page) {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
}

test("SuperAdmin crea plantilla, asigna perfil y registra actividad con métricas reales", async ({
  page,
}, info) => {
  const f = await setup();
  await page.context().addCookies((await f.root.storageState()).cookies);
  await page.goto("/admin/experiencia");
  await page
    .getByLabel("Negocio de perfiles y avisos")
    .selectOption(String(f.company.id));
  await page
    .getByLabel("Configuración de experiencia")
    .selectOption("plantillas");
  await page
    .getByRole("button", { name: "Crear plantilla personalizada" })
    .click();
  await page
    .getByLabel("Nombre de la plantilla de rendimiento")
    .fill("Mini park UI");
  await page
    .getByLabel("Rubro de referencia de la plantilla")
    .fill("Entretenimiento");
  await page.getByLabel("Nombre del indicador 1").fill("Juegos completados");
  await page
    .getByLabel("Cálculo del indicador 1")
    .selectOption("ACTIVIDADES_COMPLETADAS");
  await page
    .getByRole("button", { name: "Agregar flujo", exact: true })
    .click();
  await page.getByLabel("Nombre del flujo 1").fill("Atención de juego");
  const flowCode = await page
    .getByLabel("Flujo del indicador 1")
    .locator("option")
    .last()
    .getAttribute("value");
  await page.getByLabel("Flujo del indicador 1").selectOption(flowCode!);
  await responsive(page);
  await page
    .getByRole("button", { name: "Publicar plantilla", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByLabel("Configuración de experiencia")
    .selectOption("asignacion");
  await page
    .getByLabel("Tipo de perfil de rendimiento")
    .selectOption("PERSONALIZADO");
  await page
    .getByLabel("Versión de plantilla a asignar")
    .selectOption({ label: "Mini park UI · v1 · Entretenimiento" });
  await page
    .getByRole("button", { name: "Guardar perfil de rendimiento" })
    .click();
  await expect(
    page.getByText("Mini park UI · v1", { exact: false }).first(),
  ).toBeVisible();
  await page.context().clearCookies();
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/panel/actividades");
  await page
    .getByRole("button", { name: "Nueva actividad", exact: true })
    .click();
  await page.getByLabel("Título de la actividad").fill("Juego realizado");
  await page.getByRole("button", { name: "Registrar actividad" }).click();
  await expect(
    page.getByRole("cell", { name: "Juego realizado Atención de juego" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Ver actividad #/ }).click();
  await page.getByRole("button", { name: "En curso", exact: true }).click();
  await page.getByRole("button", { name: "Completado", exact: true }).click();
  await expect(page.getByText("Completada: Completado")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("link", { name: "Rendimiento", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Rendimiento · Mini park UI" }),
  ).toBeVisible();
  await expect(
    page.getByText("Juegos completados", { exact: true }).first(),
  ).toBeVisible();
  expect(
    (await (await f.owner.get("/api/rendimiento")).json()).personalizado
      .metricas[0].valor,
  ).toBe(1);
  await responsive(page);
  await page.screenshot({
    path: info.outputPath("rendimiento-personalizado.png"),
    fullPage: true,
  });
});

test("Modales por página: texto seguro, un aviso y acción permitida", async ({
  page,
}) => {
  const f = await setup();
  await rule(f);
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/panel");
  await page.getByRole("link", { name: "Rendimiento", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Recordatorio de prueba" }),
  ).toBeVisible();
  await expect(dialog).toContainText("<script>window.unsafe=true</script>");
  expect(await page.evaluate(() => "unsafe" in window)).toBe(false);
  await responsive(page);
  await page
    .getByRole("button", { name: "Ver actividades", exact: true })
    .click();
  await expect(page).toHaveURL(/actividades$/);
  await page.getByRole("link", { name: "Rendimiento", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("Salir con cambios: navegación, cierre de sesión y beforeunload solo cuando corresponde", async ({
  page,
}) => {
  const f = await setup();
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/panel/actividades");
  await page
    .getByRole("button", { name: "Nueva actividad", exact: true })
    .click();
  await page.getByLabel("Título de la actividad").fill("Pendiente de guardar");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("link", { name: "Rendimiento", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hay cambios sin guardar" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Actividades", exact: true }).click();
  await page
    .getByRole("button", { name: "Nueva actividad", exact: true })
    .click();
  await page.getByLabel("Título de la actividad").fill("Actividad guardable");
  // Native dialog fires only for dirty forms; dismiss preserves the page.
  const native = page.waitForEvent("dialog");
  void page.reload().catch(() => {});
  const event = await native;
  expect(event.type()).toBe("beforeunload");
  await event.dismiss();
  await expect(page.getByLabel("Título de la actividad")).toHaveValue(
    "Actividad guardable",
  );
  await page.getByRole("button", { name: "Registrar actividad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let dialogs = 0;
  page.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await page.reload();
  expect(dialogs).toBe(0);
  // Inline profile form stays on the page and is protected by the shared guard.
  await page.context().clearCookies();
  await page.context().addCookies((await f.root.storageState()).cookies);
  await page.goto("/admin/experiencia");
  await page
    .getByLabel("Negocio de perfiles y avisos")
    .selectOption(String(f.company.id));
  await page
    .getByLabel("Tipo de perfil de rendimiento")
    .selectOption("ESPECIFICO");
  await page.getByRole("link", { name: "Empresas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hay cambios sin guardar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Seguir editando" }).click();
  await expect(page).toHaveURL(/experiencia$/);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hay cambios sin guardar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión", exact: true }),
  ).toBeVisible();
});

test("Exit intent en escritorio y post-login tienen disparadores independientes", async ({
  page,
}) => {
  const f = await setup();
  await rule(f, {
    disparadores: ["EXIT_INTENT"],
    paginas: [],
    accion: "CERRAR",
  });
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/panel");
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  await page.evaluate(() =>
    document.dispatchEvent(
      new MouseEvent("mouseout", { clientY: 0, relatedTarget: null }),
    ),
  );
  await expect(
    page.getByRole("heading", { name: "Recordatorio de prueba" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await rule(f, {
    disparadores: ["POST_LOGIN"],
    paginas: [],
    titulo: "Inicio personalizado",
    accion: "CERRAR",
  });
  await page.getByLabel("Correo electrónico").fill(f.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inicio personalizado" }),
  ).toBeVisible();
});

test("SuperAdmin publica y pausa un aviso desde el editor visual", async ({
  page,
}) => {
  const f = await setup();
  await page.context().addCookies((await f.root.storageState()).cookies);
  await page.goto("/admin/experiencia");
  await page
    .getByLabel("Negocio de perfiles y avisos")
    .selectOption(String(f.company.id));
  await page.getByLabel("Configuración de experiencia").selectOption("avisos");
  await page
    .getByRole("button", { name: "Crear aviso personalizado", exact: true })
    .click();
  await page.getByLabel("Título del aviso").fill("Aviso creado en pantalla");
  await page
    .getByLabel("Mensaje del aviso")
    .fill("Revisa tu trabajo, {{negocio}}.");
  await page.getByLabel("Frecuencia del aviso").selectOption("UNA_VEZ");
  await page
    .getByLabel("Botón de acción del aviso")
    .selectOption("VER_RENDIMIENTO");
  await responsive(page);
  await page
    .getByRole("button", { name: "Publicar aviso", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", {
      name: /Aviso creado en pantalla/,
    }),
  });
  await expect(row).toContainText("Activo");
  await row.getByRole("button", { name: /Editar aviso/ }).click();
  await page.getByLabel("Aviso activo", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Publicar aviso", exact: true })
    .click();
  await expect(row).toContainText("Pausado");
  const rules = await (
    await f.root.get(`/api/experiencia/reglas?empresaId=${f.company.id}`)
  ).json();
  expect(
    rules.find(
      (r: { titulo: string }) => r.titulo === "Aviso creado en pantalla",
    ).version,
  ).toBe(2);
});

test("Cambiar de local confirma antes de alterar la sesión y preserva el borrador al cancelar", async ({
  page,
}) => {
  const f = await setup();
  const locales = await write(f.owner, "/locales", {
    nombre: "Local B",
    direccion: "B",
    activo: true,
  });
  const second = locales.find(
    (l: { id: number }) => l.id !== f.session.localId,
  );
  const product = await write(f.owner, "/productos", {
    sku: randomUUID(),
    nombre: "Producto borrador local",
    precio: 10,
    minimo: 1,
    activo: true,
  });
  await write(f.owner, "/compras", {
    idempotencia: randomUUID(),
    proveedor: "Prueba",
    referencia: randomUUID(),
    lineas: [{ productoId: product.id, cantidad: 5, costo: 5 }],
  });
  await page.context().addCookies((await f.owner.storageState()).cookies);
  await page.goto("/panel/pos");
  await page.getByRole("button", { name: /Producto borrador local/ }).click();
  await page.getByLabel("Local de trabajo").selectOption(String(second.id));
  await expect(
    page.getByRole("heading", { name: "Hay cambios sin guardar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Seguir editando" }).click();
  expect((await (await page.request.get("/api/auth/me")).json()).localId).toBe(
    f.session.localId,
  );
  await expect(
    page.getByLabel("Cantidad de Producto borrador local"),
  ).toHaveValue("1");
  await page.getByLabel("Local de trabajo").selectOption(String(second.id));
  await page.getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio" }),
  ).toBeVisible();
  await expect(page.getByLabel("Local de trabajo")).toHaveValue(
    String(second.id),
  );
});
