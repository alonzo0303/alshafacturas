package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.comercial.ComercialDtos;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasAuthority('MESAS_GESTIONAR') or hasAuthority('PREPARACION_GESTIONAR')")
public class PedidosController {
  private final JdbcTemplate db;
  private final PedidosService pedidos;
  private final AuditoriaService audit;

  public PedidosController(JdbcTemplate db, PedidosService pedidos, AuditoriaService audit) {
    this.db = db;
    this.pedidos = pedidos;
    this.audit = audit;
  }

  public record Mesa(
      @NotBlank @Size(max = 100) String nombre, @Min(1) @Max(100) int capacidad, boolean activo) {}

  @GetMapping("/mesas")
  @PreAuthorize("hasAuthority('MESAS_GESTIONAR')")
  public List<Map<String, Object>> mesas(@AuthenticationPrincipal UsuarioPrincipal p) {
    return db.queryForList(
        "SELECT m.*,(SELECT id FROM pedidos p WHERE p.mesa_id=m.id AND p.estado IN"
            + " ('ABIERTO','PREPARADO')) AS pedido_id FROM mesas m WHERE m.empresa_id=? AND"
            + " m.local_id=? ORDER BY m.nombre,m.id",
        p.getEmpresaId(),
        LocalesService.actual());
  }

  @PostMapping("/mesas")
  @PreAuthorize("hasAuthority('MESAS_GESTIONAR')")
  @Transactional
  public Map<String, Object> crearMesa(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody Mesa r) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    Long id =
        db.queryForObject(
            "INSERT INTO mesas(empresa_id,local_id,nombre,capacidad,activo) VALUES (?,?,?,?,?)"
                + " RETURNING id",
            Long.class,
            p.getEmpresaId(),
            LocalesService.actual(),
            r.nombre().trim(),
            r.capacidad(),
            r.activo());
    audit.registrar(
        p, p.getEmpresaId(), LocalesService.actual(), "MESA_CREADA", id, r.nombre().trim());
    return db.queryForMap("SELECT * FROM mesas WHERE id=?", id);
  }

  @PutMapping("/mesas/{id}")
  @PreAuthorize("hasAuthority('MESAS_GESTIONAR')")
  @Transactional
  public void editarMesa(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody Mesa r) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    if (!r.activo()
        && db.queryForObject(
                "SELECT count(*) FROM pedidos WHERE empresa_id=? AND local_id=? AND mesa_id=? AND"
                    + " estado IN ('ABIERTO','PREPARADO')",
                Long.class,
                p.getEmpresaId(),
                LocalesService.actual(),
                id)
            > 0)
      throw new ResponseStatusException(HttpStatus.CONFLICT, "La mesa tiene un pedido abierto");
    if (db.update(
            "UPDATE mesas SET nombre=?,capacidad=?,activo=? WHERE empresa_id=? AND local_id=? AND"
                + " id=?",
            r.nombre().trim(),
            r.capacidad(),
            r.activo(),
            p.getEmpresaId(),
            LocalesService.actual(),
            id)
        == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa no encontrada");
    audit.registrar(p, p.getEmpresaId(), LocalesService.actual(), "MESA_EDITADA", id, r.nombre());
  }

  @GetMapping("/pedidos/catalogo")
  public List<Map<String, Object>> catalogo(@AuthenticationPrincipal UsuarioPrincipal p) {
    return db.queryForList(
        "SELECT id,sku,nombre,precio,clase,stock,es_comida FROM productos WHERE empresa_id=? AND"
            + " local_id=? AND activo AND precio>0 ORDER BY nombre,id",
        p.getEmpresaId(),
        LocalesService.actual());
  }

  public record Nuevo(
      @NotNull @Pattern(regexp = "MESA|PREPARACION") String clase,
      Long mesaId,
      @NotNull UUID idempotencia) {}

  public record Edicion(
      @Min(0) int version,
      @Size(max = 500) String observacion,
      @NotEmpty @Size(max = 100) List<ComercialDtos.@NotNull @Valid LineaVenta> lineas) {}

  public record Estado(
      @Min(0) int version, @NotNull @Pattern(regexp = "PREPARADO|CANCELADO") String estado) {}

  public record Cobro(
      @Min(0) int version,
      Long clienteId,
      @NotNull @Pattern(regexp = "TICKET|BOLETA|FACTURA") String tipo,
      @NotNull @Pattern(regexp = "EFECTIVO|TARJETA|TRANSFERENCIA") String metodoPago) {}

  @GetMapping("/pedidos")
  public List<Map<String, Object>> lista(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(defaultValue = "PREPARACION") @Pattern(regexp = "MESA|PREPARACION")
          String clase) {
    boolean permitido =
        p.getAuthorities().stream()
            .anyMatch(
                a ->
                    a.getAuthority()
                        .equals(
                            "MESA".equals(clase) ? "MESAS_GESTIONAR" : "PREPARACION_GESTIONAR"));
    if (!permitido)
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes acceso a esos pedidos");
    var resultados =
        db.queryForList(
            "SELECT p.*,m.nombre AS mesa,COALESCE((SELECT sum(cantidad*precio) FROM pedido_detalles"
                + " WHERE pedido_id=p.id),0) AS total FROM pedidos p LEFT JOIN mesas m ON"
                + " m.id=p.mesa_id WHERE p.empresa_id=? AND p.local_id=? AND p.clase=? ORDER BY"
                + " p.id DESC LIMIT 200",
            p.getEmpresaId(),
            LocalesService.actual(),
            clase);
    resultados.forEach(r -> r.remove("cobro_idempotencia"));
    return resultados;
  }

  @PostMapping("/pedidos")
  public Map<String, Object> crear(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody Nuevo r) {
    return pedidos.crear(p, r);
  }

  @GetMapping("/pedidos/{id}")
  public Map<String, Object> detalle(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    return pedidos.detalle(p, id);
  }

  @PutMapping("/pedidos/{id}")
  public Map<String, Object> guardar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody Edicion r) {
    return pedidos.guardar(p, id, r);
  }

  @PatchMapping("/pedidos/{id}/estado")
  public Map<String, Object> estado(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody Estado r) {
    return pedidos.estado(p, id, r);
  }

  public record PrimeraEntrega(@NotNull @Min(0) Integer version) {}

  @PostMapping("/pedidos/{id}/servir")
  @PreAuthorize("hasAuthority('MESAS_GESTIONAR')")
  public Map<String, Object> servir(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody PrimeraEntrega r) {
    return pedidos.servir(p, id, r.version());
  }

  @PostMapping("/pedidos/{id}/cobrar")
  @PreAuthorize("hasAuthority('VENTAS_GESTIONAR')")
  public Map<String, Object> cobrar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody Cobro r) {
    return pedidos.cobrar(p, id, r);
  }
}
