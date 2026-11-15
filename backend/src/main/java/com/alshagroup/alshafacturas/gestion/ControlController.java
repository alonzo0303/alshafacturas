package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ControlController {
  private final JdbcTemplate db;
  private final CajaService cajas;
  private final com.alshagroup.alshafacturas.experiencia.MetricasService metricas;

  public ControlController(
      JdbcTemplate db,
      CajaService cajas,
      com.alshagroup.alshafacturas.experiencia.MetricasService metricas) {
    this.db = db;
    this.cajas = cajas;
    this.metricas = metricas;
  }

  private boolean root(UsuarioPrincipal p) {
    return "SUPERADMIN".equals(p.getRol());
  }

  private Long empresa(UsuarioPrincipal p, Long requested) {
    return root(p) ? Objects.requireNonNullElse(requested, p.getEmpresaId()) : p.getEmpresaId();
  }

  private long local(UsuarioPrincipal p, Long e, Long requested) {
    if (!root(p)) return LocalesService.actual();
    if (requested == null
        || db.queryForObject(
                "SELECT count(*) FROM locales WHERE empresa_id=? AND id=?",
                Long.class,
                e,
                requested)
            != 1)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Selecciona un local de la empresa");
    return requested;
  }

  public record Apertura(
      @NotNull @DecimalMin("0") @DecimalMax("999999999.99") @Digits(integer = 9, fraction = 2)
          BigDecimal fondo) {}

  public record Cierre(
      @NotNull @DecimalMin("0") @DecimalMax("999999999999.99") @Digits(integer = 12, fraction = 2)
          BigDecimal efectivoContado) {}

  @GetMapping("/cajas")
  @PreAuthorize("hasRole('SUPERADMIN') or hasAuthority('CAJA_GESTIONAR')")
  public List<Map<String, Object>> listar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId) {
    Long e = empresa(p, empresaId);
    long l = local(p, e, localId);
    return db.queryForList(
        "SELECT * FROM cajas WHERE empresa_id=? AND local_id=? AND (? OR usuario_original_id=?)"
            + " ORDER BY id DESC LIMIT 200",
        e,
        l,
        Set.of("ADMIN", "SUPERADMIN").contains(p.getRol()),
        p.getId());
  }

  @GetMapping("/cajas/{id}")
  @PreAuthorize("hasRole('SUPERADMIN') or hasAuthority('CAJA_GESTIONAR')")
  public Map<String, Object> detalle(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId) {
    Long e = empresa(p, empresaId);
    var caja = cajas.detalle(e, local(p, e, localId), id);
    if (!Set.of("ADMIN", "SUPERADMIN").contains(p.getRol())
        && !Objects.equals(p.getId(), caja.get("usuario_original_id")))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes acceso a esa caja");
    return caja;
  }

  @PostMapping("/cajas")
  @PreAuthorize("hasAuthority('CAJA_GESTIONAR')")
  public Map<String, Object> abrir(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody Apertura r) {
    return cajas.abrir(p, r.fondo());
  }

  @PostMapping("/cajas/{id}/cerrar")
  @PreAuthorize("hasRole('SUPERADMIN') or hasAuthority('CAJA_GESTIONAR')")
  public Map<String, Object> cerrar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId,
      @Valid @RequestBody Cierre r) {
    Long e = empresa(p, empresaId);
    return cajas.cerrar(p, e, local(p, e, localId), id, r.efectivoContado());
  }

  @GetMapping("/rendimiento")
  @PreAuthorize("hasRole('SUPERADMIN') or hasAuthority('RENDIMIENTO_VER')")
  public Map<String, Object> rendimiento(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId,
      @RequestParam(required = false)
          @org.springframework.format.annotation.DateTimeFormat(
              iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
          LocalDate desde,
      @RequestParam(required = false)
          @org.springframework.format.annotation.DateTimeFormat(
              iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
          LocalDate hasta) {
    Long e = empresa(p, empresaId);
    long l = local(p, e, localId);
    var zone = ZoneId.of("America/Lima");
    if (hasta == null) hasta = LocalDate.now(zone);
    if (desde == null) desde = hasta.withDayOfMonth(1);
    if (hasta.isBefore(desde) || java.time.temporal.ChronoUnit.DAYS.between(desde, hasta) > 366)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Elige un periodo de hasta 366 días");
    var start = java.sql.Timestamp.from(desde.atStartOfDay(zone).toInstant());
    var end = java.sql.Timestamp.from(hasta.plusDays(1).atStartOfDay(zone).toInstant());
    boolean all = Set.of("ADMIN", "SUPERADMIN").contains(p.getRol());
    String modo =
        db.queryForObject("SELECT rendimiento_modo FROM empresas WHERE id=?", String.class, e);
    String filtro =
        "AMBOS".equals(modo)
            ? ""
            : "COMERCIO".equals(modo) ? " AND d.clase='PRODUCTO'" : " AND d.clase='SERVICIO'";
    var ventas =
        db.queryForList(
            "SELECT v.usuario_original_id AS colaborador_id,v.usuario_nombre AS"
                + " colaborador,count(DISTINCT v.id) FILTER(WHERE v.estado='CONFIRMADA') AS"
                + " ventas,count(DISTINCT v.id) FILTER(WHERE v.estado='ANULADA') AS"
                + " anuladas,COALESCE(sum(d.total) FILTER(WHERE v.estado='CONFIRMADA'),0) AS"
                + " total,COALESCE(sum(d.cantidad) FILTER(WHERE v.estado='CONFIRMADA'),0) AS"
                + " unidades,COALESCE(sum(d.cantidad) FILTER(WHERE v.estado='CONFIRMADA' AND"
                + " d.es_comida),0) AS comidas FROM ventas v JOIN venta_detalles d ON"
                + " d.venta_id=v.id WHERE v.empresa_id=? AND v.local_id=? AND v.fecha>=? AND"
                + " v.fecha<? AND (? OR v.usuario_original_id=?)"
                + filtro
                + " GROUP BY v.usuario_original_id,v.usuario_nombre ORDER BY total"
                + " DESC,colaborador_id",
            e,
            l,
            start,
            end,
            all,
            p.getId());
    var cortes =
        db.queryForList(
            "SELECT cerrado_por AS colaborador_id,cerrado_nombre AS colaborador,count(*) AS"
                + " cortes,COALESCE(sum(diferencia),0) AS diferencia FROM cajas WHERE empresa_id=?"
                + " AND local_id=? AND estado='CERRADA' AND cerrada>=? AND cerrada<? AND (? OR"
                + " cerrado_por=?) GROUP BY cerrado_por,cerrado_nombre ORDER BY colaborador_id",
            e,
            l,
            start,
            end,
            all,
            p.getId());
    var diario =
        db.queryForList(
            "SELECT (v.fecha AT TIME ZONE 'America/Lima')::date AS dia,count(DISTINCT v.id) AS"
                + " ventas,COALESCE(sum(d.total),0) AS total,COALESCE(sum(d.cantidad) FILTER(WHERE"
                + " d.es_comida),0) AS comidas FROM ventas v JOIN venta_detalles d ON"
                + " d.venta_id=v.id WHERE v.empresa_id=? AND v.local_id=? AND v.fecha>=? AND"
                + " v.fecha<? AND v.estado='CONFIRMADA' AND (? OR v.usuario_original_id=?)"
                + filtro
                + " GROUP BY dia ORDER BY dia",
            e,
            l,
            start,
            end,
            all,
            p.getId());
    var result = new LinkedHashMap<String, Object>();
    result.put("modo", modo);
    result.put("desde", desde);
    result.put("hasta", hasta);
    result.put("ventas", ventas);
    result.put("cortes", cortes);
    result.put("diario", diario);
    result.put("personalizado", metricas.reporte(p, e, l, start, end, ventas, cortes));
    return result;
  }

  @GetMapping("/auditoria")
  @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
  public List<Map<String, Object>> auditoria(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(defaultValue = "0") long antesDe) {
    Long e = empresa(p, empresaId);
    return db.queryForList(
        "SELECT * FROM eventos_auditoria WHERE empresa_id=? AND (?=0 OR id<?) ORDER BY id DESC"
            + " LIMIT 100",
        e,
        antesDe,
        antesDe);
  }
}
