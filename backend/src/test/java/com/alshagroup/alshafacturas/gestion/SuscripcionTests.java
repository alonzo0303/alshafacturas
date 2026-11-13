package com.alshagroup.alshafacturas.gestion;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import(SuscripcionTests.TimeConfig.class)
@Transactional
class SuscripcionTests {
  static class MutableClock extends Clock {
    Instant current = Instant.parse("2026-11-12T17:00:00Z");

    public ZoneId getZone() {
      return PlanesService.ZONA;
    }

    public Clock withZone(ZoneId z) {
      return Clock.fixed(current, z);
    }

    public Instant instant() {
      return current;
    }
  }

  @TestConfiguration
  static class TimeConfig {
    @Bean
    @Primary
    MutableClock pruebaClock() {
      return new MutableClock();
    }
  }

  @Autowired MutableClock clock;
  @Autowired JdbcTemplate db;
  @Autowired PlanesService planes;

  @BeforeEach
  void reset() {
    clock.current = Instant.parse("2026-11-12T17:00:00Z");
  }

  long[] negocio() {
    Long e =
        db.queryForObject(
            "INSERT INTO empresas(razon_social,estado) VALUES ('Suscripción de prueba','ACTIVA')"
                + " RETURNING id",
            Long.class);
    Long u =
        db.queryForObject(
            "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol) VALUES"
                + " (?,'Principal','principal@subscription.test','test','ADMIN') RETURNING id",
            Long.class,
            e);
    db.update("UPDATE empresas SET administrador_principal_id=? WHERE id=?", u, e);
    return new long[] {e, u};
  }

  void pago(long[] n, String desde, String hasta) {
    planes.registrar(
        n[0],
        n[1],
        new PlanesService.PagoRequest(
            "INICIO",
            new BigDecimal("35"),
            LocalDate.parse(desde),
            LocalDate.parse(hasta),
            UUID.randomUUID().toString(),
            true));
  }

  @Test
  void preservesAccessUntilLastSecondOfPeruvianExpiryDate() {
    var n = negocio();
    pago(n, "2026-11-01", "2026-11-12");
    clock.current = Instant.parse("2026-11-13T04:59:59Z");
    assertEquals(LocalDate.parse("2026-11-12"), planes.hoy());
    assertTrue(planes.permiteAcceso(n[0], n[1]));
    assertNull(planes.bloqueo(n[0]));
    clock.current = Instant.parse("2026-11-13T05:00:00Z");
    assertEquals("MEMBRESIA_VENCIDA", planes.bloqueo(n[0]).get("codigo"));
    assertFalse(planes.permiteAcceso(n[0], n[1]));
    assertEquals("VENCIDO", planes.estado(n[0]).get("estadoSuscripcion"));
    planes.revisarEmpresa(n[0], planes.hoy());
    assertTrue(
        db.queryForObject(
            "SELECT suscripcion_bloqueada FROM empresas WHERE id=?", Boolean.class, n[0]));
  }

  @Test
  void issuesSixDailyRemindersOnceAndStopsWhenRenewalCoversNextDay() {
    var n = negocio();
    pago(n, "2026-11-01", "2026-11-20");
    planes.revisarEmpresa(n[0], LocalDate.parse("2026-11-14"));
    assertEquals(
        0,
        db.queryForObject(
            "SELECT count(*) FROM avisos_suscripcion WHERE empresa_id=?", Integer.class, n[0]));
    for (int day = 15; day <= 20; day++) {
      planes.revisarEmpresa(n[0], LocalDate.of(2026, 11, day));
      planes.revisarEmpresa(n[0], LocalDate.of(2026, 11, day));
    }
    assertEquals(
        List.of(5, 4, 3, 2, 1, 0),
        db.queryForList(
            "SELECT dias_restantes FROM avisos_suscripcion WHERE empresa_id=? ORDER BY fecha",
            Integer.class,
            n[0]));
    pago(n, "2026-11-21", "2026-12-20");
    assertEquals(
        6,
        db.queryForObject(
            "SELECT count(*) FROM avisos_suscripcion WHERE empresa_id=? AND resuelto",
            Integer.class,
            n[0]));
    planes.revisarEmpresa(n[0], LocalDate.parse("2026-11-20"));
    assertEquals(
        6,
        db.queryForObject(
            "SELECT count(*) FROM avisos_suscripcion WHERE empresa_id=?", Integer.class, n[0]));
  }

  @Test
  void futurePlanShowsPriceAndLimitWithoutBeingCountedActive() {
    var n = negocio();
    pago(n, "2026-11-13", "2026-11-13");
    var estado = planes.estado(n[0]);
    assertEquals("PROGRAMADO", estado.get("estadoSuscripcion"));
    assertEquals("INICIO", estado.get("plan"));
    assertEquals(2, estado.get("limiteEmpleados"));
    assertEquals(false, estado.get("vigente"));
    assertNotNull(estado.get("pagoReferencia"));
    assertNull(estado.get("pagoActual"));
    assertEquals("MEMBRESIA_PROGRAMADA", planes.bloqueo(n[0]).get("codigo"));
    clock.current = Instant.parse("2026-11-13T05:00:00Z");
    assertEquals("ACTIVO", planes.estado(n[0]).get("estadoSuscripcion"));
  }

  @Test
  void shortFutureContractReceivesRemindersBeforeItStarts() {
    var n = negocio();
    pago(n, "2026-11-20", "2026-11-20");
    for (int day = 15; day <= 20; day++) planes.revisarEmpresa(n[0], LocalDate.of(2026, 11, day));
    assertEquals(
        List.of(5, 4, 3, 2, 1, 0),
        db.queryForList(
            "SELECT dias_restantes FROM avisos_suscripcion WHERE empresa_id=? ORDER BY fecha",
            Integer.class,
            n[0]));
  }

  @Test
  void renewalRestoresSubscriptionWithoutUndoingManualSuspension() {
    var n = negocio();
    pago(n, "2026-10-01", "2026-11-11");
    assertNotNull(planes.bloqueo(n[0]));
    db.update("UPDATE empresas SET estado='SUSPENDIDA' WHERE id=?", n[0]);
    pago(n, "2026-11-12", "2026-12-11");
    assertNull(planes.bloqueo(n[0]));
    assertEquals(
        "SUSPENDIDA",
        db.queryForObject("SELECT estado FROM empresas WHERE id=?", String.class, n[0]));
    assertFalse(
        db.queryForObject(
            "SELECT suscripcion_bloqueada FROM empresas WHERE id=?", Boolean.class, n[0]));
  }
}
