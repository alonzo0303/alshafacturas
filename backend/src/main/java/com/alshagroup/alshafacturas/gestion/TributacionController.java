package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/tributacion")
public class TributacionController {
  private final JdbcTemplate db;

  public TributacionController(JdbcTemplate db) {
    this.db = db;
  }

  @GetMapping("/configuracion")
  @PreAuthorize("hasAuthority('PRODUCTOS_VER')")
  public Map<String, Object> config(@AuthenticationPrincipal UsuarioPrincipal p) {
    return db.queryForMap(
        "SELECT ruc,CASE WHEN ruc IS NULL THEN 'SIN_IGV' ELSE afectacion_default END AS"
            + " afectacion_default,precios_incluyen_igv FROM empresas WHERE id=?",
        p.getEmpresaId());
  }

  public record Config(
      @NotBlank @Pattern(regexp = "GRAVADO|EXONERADO|INAFECTO|SIN_IGV") String afectacion,
      boolean preciosIncluyenIgv) {}

  @PutMapping("/configuracion")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> guardar(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody Config r) {
    String ruc =
        db.queryForObject("SELECT ruc FROM empresas WHERE id=?", String.class, p.getEmpresaId());
    if (ruc == null && !"SIN_IGV".equals(r.afectacion())
        || ruc != null && "SIN_IGV".equals(r.afectacion()))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "El tratamiento debe corresponder al modo interno o fiscal del negocio");
    db.update(
        "UPDATE empresas SET afectacion_default=?,precios_incluyen_igv=? WHERE id=?",
        r.afectacion(),
        r.preciosIncluyenIgv(),
        p.getEmpresaId());
    return config(p);
  }

  @GetMapping("/resumen")
  @PreAuthorize("hasAuthority('IMPUESTOS_VER')")
  public Map<String, Object> resumen(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate desde,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate hasta) {
    LocalDate today = LocalDate.now(ZoneId.of("America/Lima"));
    if (desde == null) desde = today.withDayOfMonth(1);
    if (hasta == null) hasta = today;
    if (hasta.isBefore(desde))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El rango de fechas no es válido");
    var start = java.sql.Timestamp.from(desde.atStartOfDay(ZoneId.of("America/Lima")).toInstant());
    var end =
        java.sql.Timestamp.from(
            hasta.plusDays(1).atStartOfDay(ZoneId.of("America/Lima")).toInstant());
    var result = new LinkedHashMap<String, Object>();
    result.put("desde", desde);
    result.put("hasta", hasta);
    result.putAll(
        db.queryForMap(
            "SELECT COALESCE(SUM(igv),0) AS igv_ventas_registrado,COALESCE(SUM(igv) FILTER(WHERE"
                + " estado_fiscal='PRODUCCION_ACEPTADO'),0) AS igv_ventas_con_cdr FROM ventas WHERE"
                + " empresa_id=? AND estado='CONFIRMADA' AND fecha>=? AND fecha<?",
            p.getEmpresaId(),
            start,
            end));
    result.putAll(
        db.queryForMap(
            "SELECT COALESCE(SUM(igv),0) AS igv_compras_registrado,COALESCE(SUM(igv) FILTER(WHERE"
                + " credito_fiscal),0) AS credito_fiscal_potencial FROM compras WHERE empresa_id=?"
                + " AND fecha>=? AND fecha<?",
            p.getEmpresaId(),
            start,
            end));
    return result;
  }
}
