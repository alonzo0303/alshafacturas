package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class SuscripcionController {
  private final JdbcTemplate db;
  private final PlanesService planes;
  private final SuscripcionScheduler scheduler;
  private final AuditoriaService auditoria;

  public SuscripcionController(
      JdbcTemplate d, PlanesService p, SuscripcionScheduler s, AuditoriaService a) {
    db = d;
    planes = p;
    scheduler = s;
    auditoria = a;
  }

  @GetMapping("/rubros-negocio")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public List<String> rubros() {
    return db.queryForList("SELECT nombre FROM rubros_catalogo ORDER BY nombre", String.class);
  }

  @GetMapping("/notificaciones-suscripcion")
  public Map<String, Object> avisos(
      @AuthenticationPrincipal UsuarioPrincipal p, @RequestParam(required = false) Long empresaId) {
    Long empresa =
        "SUPERADMIN".equals(p.getRol()) && empresaId != null ? empresaId : p.getEmpresaId();
    if (!"SUPERADMIN".equals(p.getRol())
        && empresaId != null
        && !empresaId.equals(p.getEmpresaId()))
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.FORBIDDEN,
          "No tienes acceso a los avisos de otro negocio");
    return Map.of(
        "instruccionesPago",
        planes.instrucciones(),
        "fechaActual",
        planes.hoy(),
        "avisos",
        db.queryForList(
            "SELECT id,fecha::text AS fecha,vence::text AS vence,dias_restantes,resuelto FROM"
                + " avisos_suscripcion WHERE empresa_id=? ORDER BY fecha DESC,id DESC LIMIT 100",
            empresa));
  }

  @GetMapping("/admin/suscripciones/configuracion")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> configuracion() {
    return Map.of(
        "instruccionesPago",
        planes.instrucciones(),
        "zonaHoraria",
        "America/Lima",
        "revisionDiaria",
        "00:05");
  }

  public record Config(@NotBlank @Size(max = 1500) String instruccionesPago) {}

  @PutMapping("/admin/suscripciones/configuracion")
  @PreAuthorize("hasRole('SUPERADMIN')")
  @Transactional
  public void configurar(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody Config r) {
    db.update(
        "UPDATE configuracion_cobranza SET instrucciones=?,actualizado=CURRENT_TIMESTAMP WHERE"
            + " id=1",
        r.instruccionesPago().trim());
    auditoria.registrar(
        p, p.getEmpresaId(), null, "COBRANZA_CONFIGURADA", 1, "Instrucciones de pago actualizadas");
  }

  @PostMapping("/admin/suscripciones/revisar")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> revisar() {
    scheduler.revisar();
    return Map.of("fechaRevision", planes.hoy());
  }

  @GetMapping("/admin/suscripciones/resumen")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> resumen() {
    var fecha = planes.hoy();
    return db.queryForMap(
        "SELECT count(*) FILTER(WHERE EXISTS(SELECT 1 FROM pagos_suscripcion p WHERE"
            + " p.empresa_id=e.id AND p.desde<=? AND p.hasta>=?)) AS activos,count(*) FILTER(WHERE"
            + " NOT EXISTS(SELECT 1 FROM pagos_suscripcion p WHERE p.empresa_id=e.id AND p.desde<=?"
            + " AND p.hasta>=?) AND EXISTS(SELECT 1 FROM pagos_suscripcion p WHERE"
            + " p.empresa_id=e.id AND p.hasta<?)) AS vencidos,count(*) FILTER(WHERE NOT"
            + " EXISTS(SELECT 1 FROM pagos_suscripcion p WHERE p.empresa_id=e.id AND p.desde<=?)"
            + " AND EXISTS(SELECT 1 FROM pagos_suscripcion p WHERE p.empresa_id=e.id AND"
            + " p.desde>?)) AS programados FROM empresas e WHERE e.ruc IS DISTINCT FROM"
            + " '00000000000'",
        fecha,
        fecha,
        fecha,
        fecha,
        fecha,
        fecha,
        fecha);
  }
}
