package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.comercial.*;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/servicios")
public class ServiciosController {
  private final JdbcTemplate db;
  private final ComercialService comercial;

  public ServiciosController(JdbcTemplate db, ComercialService comercial) {
    this.db = db;
    this.comercial = comercial;
  }

  public record Datos(
      @NotBlank @Size(max = 200) String nombre,
      @NotNull @DecimalMin("0.01") @DecimalMax("999999999.99") @Digits(integer = 9, fraction = 2)
          BigDecimal precio,
      @Min(0) @Max(1440) int duracionMinutos,
      boolean activo,
      @Pattern(regexp = "GRAVADO|EXONERADO|INAFECTO|SIN_IGV") String afectacionIgv) {}

  @GetMapping
  @PreAuthorize("hasAuthority('SERVICIOS_VER') or hasAuthority('VENTAS_GESTIONAR')")
  public List<Map<String, Object>> lista(@AuthenticationPrincipal UsuarioPrincipal p) {
    return db.queryForList(
        "SELECT * FROM productos WHERE empresa_id=? AND local_id=? AND clase='SERVICIO' ORDER BY"
            + " nombre,id",
        p.getEmpresaId(),
        LocalesService.actual());
  }

  @PostMapping
  @PreAuthorize("hasAuthority('SERVICIOS_EDITAR')")
  @Transactional
  public Map<String, Object> crear(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody Datos r) {
    return guardar(p, null, r);
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasAuthority('SERVICIOS_EDITAR')")
  @Transactional
  public Map<String, Object> editar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody Datos r) {
    if (db.queryForObject(
            "SELECT count(*) FROM productos WHERE id=? AND empresa_id=? AND local_id=? AND"
                + " clase='SERVICIO'",
            Long.class,
            id,
            p.getEmpresaId(),
            LocalesService.actual())
        != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Servicio no encontrado");
    return guardar(p, id, r);
  }

  private Map<String, Object> guardar(UsuarioPrincipal p, Long id, Datos r) {
    String sku =
        id == null
            ? null
            : db.queryForObject("SELECT sku FROM productos WHERE id=?", String.class, id);
    var prod =
        comercial.producto(
            p.getEmpresaId(),
            id,
            new ComercialDtos.ProductoRequest(
                sku,
                r.nombre(),
                r.precio(),
                0,
                r.activo(),
                "Sin marca",
                "Servicios",
                "",
                null,
                null,
                r.afectacionIgv(),
                true));
    Long saved = ((Number) prod.get("id")).longValue();
    db.update(
        "UPDATE productos SET clase='SERVICIO',duracion_minutos=? WHERE id=?",
        r.duracionMinutos(),
        saved);
    return db.queryForMap("SELECT * FROM productos WHERE id=?", saved);
  }
}
