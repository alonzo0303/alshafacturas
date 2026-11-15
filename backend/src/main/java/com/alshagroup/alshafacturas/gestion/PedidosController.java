package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.comercial.ComercialDtos;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import com.alshagroup.alshafacturas.visual.AlcanceDatos;
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
            + " ('ABIERTO','PREPARADO') AND (? OR p.usuario_original_id=? OR"
            + " p.responsable_original_id=?)) AS pedido_id,EXISTS(SELECT 1 FROM pedidos busy WHERE"
            + " busy.mesa_id=m.id AND busy.estado IN ('ABIERTO','PREPARADO')) AS ocupada FROM mesas"
            + " m WHERE m.empresa_id=? AND m.local_id=? ORDER BY m.nombre,m.id",
        AlcanceDatos.equipo(p),
        p.getId(),
        p.getId(),
        p.getEmpresaId(),
        LocalesService.actual());
  }

  @PostMapping("/mesas")
  @PreAuthorize("hasRole('ADMIN') and hasAuthority('MESAS_GESTIONAR')")
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
  @PreAuthorize("hasRole('ADMIN') and hasAuthority('MESAS_GESTIONAR')")
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
                + " m.id=p.mesa_id WHERE p.empresa_id=? AND p.local_id=? AND p.clase=? AND (? OR"
                + " p.usuario_original_id=? OR p.responsable_original_id=?) ORDER BY p.id DESC"
                + " LIMIT 200",
            p.getEmpresaId(),
            LocalesService.actual(),
            clase,
            AlcanceDatos.equipo(p),
            p.getId(),
            p.getId());
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

  public record Responsable(@NotNull @Min(0) Integer version, Long usuarioId) {}

  @GetMapping("/pedidos/responsables")
  @PreAuthorize("hasRole('ADMIN')")
  public List<Map<String, Object>> responsables(@AuthenticationPrincipal UsuarioPrincipal p) {
    return db.queryForList(
        "SELECT u.id,u.nombre FROM usuarios u WHERE u.empresa_id=? AND u.activo AND"
            + " u.rol<>'SUPERADMIN' AND (u.rol='ADMIN' OR EXISTS(SELECT 1 FROM usuario_locales ul"
            + " WHERE ul.usuario_id=u.id AND ul.local_id=?) OR (NOT EXISTS(SELECT 1 FROM"
            + " usuario_locales ul WHERE ul.usuario_id=u.id) AND ?=(SELECT min(id) FROM locales"
            + " WHERE empresa_id=u.empresa_id))) ORDER BY u.nombre,u.id",
        p.getEmpresaId(),
        LocalesService.actual(),
        LocalesService.actual());
  }

  @PatchMapping("/pedidos/{id}/responsable")
  @PreAuthorize("hasRole('ADMIN')")
  @Transactional
  public Map<String, Object> asignar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody Responsable r) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var pedido = pedidos.detalle(p, id);
    if (!Set.of("ABIERTO", "PREPARADO").contains(pedido.get("estado")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "El pedido ya está cerrado");
    Map<String, Object> user = null;
    if (r.usuarioId() != null) {
      user =
          responsables(p).stream()
              .filter(u -> ((Number) u.get("id")).longValue() == r.usuarioId())
              .findFirst()
              .orElseThrow(
                  () ->
                      new ResponseStatusException(
                          HttpStatus.BAD_REQUEST, "Responsable no disponible en este local"));
    }
    if (db.update(
            "UPDATE pedidos SET"
                + " responsable_id=?,responsable_original_id=?,responsable_nombre=?,version=version+1"
                + " WHERE empresa_id=? AND local_id=? AND id=? AND version=?",
            r.usuarioId(),
            r.usuarioId(),
            user == null ? null : user.get("nombre"),
            p.getEmpresaId(),
            LocalesService.actual(),
            id,
            r.version())
        != 1)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "El pedido cambió; recarga antes de asignar");
    audit.registrar(
        p,
        p.getEmpresaId(),
        LocalesService.actual(),
        "PEDIDO_ASIGNADO",
        id,
        "Responsable=" + r.usuarioId());
    return pedidos.detalle(p, id);
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
