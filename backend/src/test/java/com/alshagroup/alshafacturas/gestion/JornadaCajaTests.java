package com.alshagroup.alshafacturas.gestion;

import static org.junit.jupiter.api.Assertions.*;

import com.alshagroup.alshafacturas.repository.UsuarioRepository;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@Transactional
class JornadaCajaTests {
  @Autowired JdbcTemplate db;
  @Autowired UsuarioRepository users;
  @Autowired CajaService cajas;
  @Autowired com.alshagroup.alshafacturas.security.AccesoEmpresaFilter filtro;
  @Autowired PlanesService planes;

  @Test
  void previousPeruvianDayBlocksSalesAndNewBoxesButAllowsClose() throws Exception {
    Long e =
        db.queryForObject(
            "INSERT INTO empresas(razon_social,estado) VALUES ('Jornada','ACTIVA') RETURNING id",
            Long.class);
    Long u =
        db.queryForObject(
            "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol) VALUES"
                + " (?,'Caja','jornada@cash.test','test','VENDEDOR') RETURNING id",
            Long.class,
            e);
    Long l =
        db.queryForObject(
            "INSERT INTO locales(empresa_id,nombre) VALUES (?,'Local') RETURNING id",
            Long.class,
            e);
    db.update("UPDATE empresas SET administrador_principal_id=? WHERE id=?", u, e);
    var p = new UsuarioPrincipal(users.findById(u).orElseThrow());
    p.seleccionarLocal(l, "Local");
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken(p, null, List.of()));
    try {
      var c = cajas.abrir(p, new BigDecimal("30"));
      Long id = ((Number) c.get("id")).longValue();
      assertTrue(cajas.pendientes(p).isEmpty());
      assertEquals(id, cajas.paraVenta(p));
      db.update("UPDATE cajas SET abierta=CURRENT_TIMESTAMP-INTERVAL '1 day' WHERE id=?", id);
      assertEquals(1, cajas.pendientes(p).size());
      assertThrows(ResponseStatusException.class, () -> cajas.paraVenta(p));
      assertThrows(ResponseStatusException.class, () -> cajas.abrir(p, BigDecimal.TEN));
      var req = new org.springframework.mock.web.MockHttpServletRequest("POST", "/api/productos");
      req.getSession().setAttribute("localId", l);
      var res = new org.springframework.mock.web.MockHttpServletResponse();
      filtro.doFilter(
          req, res, (request, response) -> fail("No debe ejecutar la operación pendiente"));
      assertEquals(409, res.getStatus());
      assertTrue(res.getContentAsString().contains("CAJA_ANTERIOR_PENDIENTE"));
      for (String path : List.of("/api/auth/logout", "/api/cajas/" + id + "/cerrar")) {
        var allowed = new org.springframework.mock.web.MockHttpServletRequest("POST", path);
        allowed.getSession().setAttribute("localId", l);
        var response = new org.springframework.mock.web.MockHttpServletResponse();
        boolean[] entered = {false};
        filtro.doFilter(allowed, response, (request, result) -> entered[0] = true);
        assertTrue(entered[0]);
      }
      cajas.cerrar(p, e, l, id, new BigDecimal("30"), null);
      assertTrue(cajas.pendientes(p).isEmpty());
      assertNotNull(cajas.abrir(p, BigDecimal.TEN));
    } finally {
      SecurityContextHolder.clearContext();
    }
  }

  @Test
  void upgradeAfterFiveDaysProratesRemainingDaysWithoutChangingPaidDates() {
    Long e =
        db.queryForObject(
            "INSERT INTO empresas(razon_social,estado) VALUES ('Upgrade cinco días','ACTIVA')"
                + " RETURNING id",
            Long.class);
    Long u =
        db.queryForObject(
            "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol) VALUES"
                + " (?,'Admin','upgrade@cash.test','test','ADMIN') RETURNING id",
            Long.class,
            e);
    var today = planes.hoy();
    planes.registrar(
        e,
        u,
        new PlanesService.PagoRequest(
            "INICIO",
            new BigDecimal("30"),
            today.minusDays(5),
            today.plusDays(24),
            "Pago original",
            true));
    var before = db.queryForMap("SELECT * FROM pagos_suscripcion WHERE empresa_id=?", e);
    var q = planes.cotizarUpgrade(e, "EQUIPO");
    assertEquals(new BigDecimal("12.50"), q.get("importe"));
    var result =
        planes.upgrade(
            e,
            u,
            new PlanesService.UpgradeRequest(
                "EQUIPO",
                ((Number) q.get("pagoId")).longValue(),
                "INICIO",
                today,
                new BigDecimal("12.50"),
                "Diferencia",
                true,
                java.util.UUID.randomUUID()));
    assertEquals("EQUIPO", result.get("plan"));
    assertEquals(before, db.queryForMap("SELECT * FROM pagos_suscripcion WHERE empresa_id=?", e));
  }
}
