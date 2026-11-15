package com.alshagroup.alshafacturas.gestion;

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
public class ComprasCicloController {
  private final JdbcTemplate db;
  private final OrdenesCompraService ordenes;
  private final AuditoriaService audit;

  public ComprasCicloController(
      JdbcTemplate db, OrdenesCompraService ordenes, AuditoriaService audit) {
    this.db = db;
    this.ordenes = ordenes;
    this.audit = audit;
  }

  @GetMapping("/compras-ciclo")
  @PreAuthorize("hasAnyAuthority('COMPRAS_GESTIONAR','COMPRAS_RECIBIR')")
  public List<Map<String, Object>> ciclo(@AuthenticationPrincipal UsuarioPrincipal p) {
    boolean equipo = AlcanceDatos.equipo(p),
        recepcion = p.getPermisos().contains("COMPRAS_RECIBIR");
    return db.queryForList(
        "SELECT * FROM (SELECT 'ORDEN' AS"
            + " origen,o.id,o.numero,o.proveedor,o.referencia,o.fecha,o.estado,o.total,o.compra_id,o.usuario_nombre,o.recibido_nombre,o.recibido_en,o.documento_recepcion"
            + " FROM ordenes_compra o WHERE o.empresa_id=? AND o.local_id=? AND (? OR ? OR"
            + " o.usuario_original_id=? OR o.recibido_por_original_id=?) UNION ALL SELECT"
            + " 'HISTORICA' AS origen,c.id,NULL AS"
            + " numero,c.proveedor,c.referencia,c.fecha,'RECIBIDA' AS estado,c.total,c.id AS"
            + " compra_id,c.usuario_nombre,c.recibido_nombre,c.recibido_en,c.documento_recepcion"
            + " FROM compras c WHERE c.empresa_id=? AND c.local_id=? AND (? OR"
            + " c.usuario_original_id=? OR c.recibido_por_original_id=?) AND NOT EXISTS(SELECT 1"
            + " FROM ordenes_compra o WHERE o.compra_id=c.id)) ciclo ORDER BY fecha DESC,id DESC"
            + " LIMIT 500",
        p.getEmpresaId(),
        LocalesService.actual(),
        equipo,
        recepcion,
        p.getId(),
        p.getId(),
        p.getEmpresaId(),
        LocalesService.actual(),
        equipo,
        p.getId(),
        p.getId());
  }

  public record Codigo(
      @NotBlank @Size(max = 80) @Pattern(regexp = "[^\\p{Cntrl}]+") String codigoBarras,
      @Size(max = 80) String anterior,
      Long ordenId,
      Long compraId) {}

  @PatchMapping("/productos/{id}/codigo-barras")
  @PreAuthorize("hasAnyAuthority('PRODUCTOS_EDITAR','COMPRAS_GESTIONAR','COMPRAS_RECIBIR')")
  @Transactional
  public Map<String, Object> codigo(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody Codigo r) {
    long e = p.getEmpresaId(), l = LocalesService.actual();
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, e);
    if (r.ordenId() != null && r.compraId() != null)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona una orden o compra");
    if (r.ordenId() != null) {
      ordenes.target(p, "ordenes-compra", r.ordenId());
      if (!db.queryForObject(
          "SELECT EXISTS(SELECT 1 FROM ordenes_compra o CROSS JOIN LATERAL"
              + " jsonb_array_elements(COALESCE(o.datos#>'{compra,lineas}',o.datos->'lineas')) a"
              + " WHERE o.id=? AND (a->>'productoId')::bigint=?)",
          Boolean.class,
          r.ordenId(),
          id))
        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND, "El producto no pertenece a esta OC");
    } else if (r.compraId() != null) {
      ordenes.target(p, "compras", r.compraId());
      if (!db.queryForObject(
          "SELECT EXISTS(SELECT 1 FROM compra_detalles WHERE compra_id=? AND producto_id=?)",
          Boolean.class,
          r.compraId(),
          id))
        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND, "El producto no pertenece a esta compra");
    } else if (!p.getPermisos().contains("PRODUCTOS_EDITAR")
        && !p.getPermisos().contains("COMPRAS_GESTIONAR"))
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Selecciona la OC o compra que estás recibiendo");
    var rows =
        db.queryForList(
            "SELECT codigo_barras FROM productos WHERE empresa_id=? AND local_id=? AND id=? AND"
                + " clase='PRODUCTO' FOR UPDATE",
            e,
            l,
            id);
    if (rows.isEmpty())
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Producto no encontrado en este local");
    String nuevo = r.codigoBarras().strip();
    Object actual = rows.getFirst().get("codigo_barras");
    if (!nuevo.equals(actual)) {
      if (!Objects.equals(actual, r.anterior()))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "El código cambió en otra sesión. Cierra y vuelve a abrir el editor");
      if (db.queryForObject(
          "SELECT EXISTS(SELECT 1 FROM productos WHERE empresa_id=? AND local_id=? AND id<>? AND"
              + " codigo_barras=?)",
          Boolean.class,
          e,
          l,
          id,
          nuevo))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "Ese código ya corresponde a otro producto de este local");
      db.update(
          "UPDATE productos SET codigo_barras=? WHERE empresa_id=? AND local_id=? AND id=?",
          nuevo,
          e,
          l,
          id);
      audit.registrar(
          p,
          e,
          l,
          "PRODUCTO_CODIGO_ACTUALIZADO",
          id,
          "Código de barras actualizado desde compras/inventario");
    }
    return Map.of("productoId", id, "codigo_barras", nuevo);
  }
}
