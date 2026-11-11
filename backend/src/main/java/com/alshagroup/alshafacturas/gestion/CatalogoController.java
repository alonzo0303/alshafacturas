package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.comercial.*;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/catalogo-comun")
public class CatalogoController {
  private final JdbcTemplate db;
  private final ComercialService productos;

  public CatalogoController(JdbcTemplate db, ComercialService productos) {
    this.db = db;
    this.productos = productos;
  }

  public record Plantilla(
      @NotBlank @Size(max = 200) String nombre,
      @NotBlank @Size(max = 100) String rubro,
      @Size(max = 500) String descripcion,
      boolean activo) {}

  @GetMapping
  @PreAuthorize("hasRole('SUPERADMIN') or hasAuthority('PRODUCTOS_VER')")
  public List<Map<String, Object>> listado(@AuthenticationPrincipal UsuarioPrincipal p) {
    return db.queryForList(
        "SELECT c.*,f.version AS imagen_version FROM catalogo_comun c LEFT JOIN fotos_catalogo f ON"
            + " f.catalogo_id=c.id WHERE ? OR (c.activo AND EXISTS(SELECT 1 FROM"
            + " empresa_rubros_catalogo r WHERE r.empresa_id=? AND r.rubro=c.rubro)) ORDER BY"
            + " c.rubro,c.nombre,c.id",
        "SUPERADMIN".equals(p.getRol()),
        p.getEmpresaId());
  }

  @PostMapping
  @PreAuthorize("hasRole('SUPERADMIN')")
  @org.springframework.transaction.annotation.Transactional
  public Map<String, Object> crear(@Valid @RequestBody Plantilla r) {
    db.update(
        "INSERT INTO rubros_catalogo(nombre) VALUES (?) ON CONFLICT DO NOTHING", r.rubro().trim());
    Long id =
        db.queryForObject(
            "INSERT INTO catalogo_comun(nombre,rubro,descripcion,activo) VALUES (?,?,?,?) RETURNING"
                + " id",
            Long.class,
            r.nombre().trim(),
            r.rubro().trim(),
            r.descripcion(),
            r.activo());
    return db.queryForMap("SELECT * FROM catalogo_comun WHERE id=?", id);
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasRole('SUPERADMIN')")
  @org.springframework.transaction.annotation.Transactional
  public Map<String, Object> editar(@PathVariable Long id, @Valid @RequestBody Plantilla r) {
    db.update(
        "INSERT INTO rubros_catalogo(nombre) VALUES (?) ON CONFLICT DO NOTHING", r.rubro().trim());
    if (db.update(
            "UPDATE catalogo_comun SET nombre=?,rubro=?,descripcion=?,activo=? WHERE id=?",
            r.nombre().trim(),
            r.rubro().trim(),
            r.descripcion(),
            r.activo(),
            id)
        == 0)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto común no encontrado");
    return db.queryForMap("SELECT * FROM catalogo_comun WHERE id=?", id);
  }

  @PostMapping("/{id}/incorporar")
  @PreAuthorize("hasAuthority('PRODUCTOS_EDITAR')")
  public Map<String, Object> incorporar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody ComercialDtos.ProductoRequest r) {
    return productos.producto(
        p.getEmpresaId(),
        null,
        new ComercialDtos.ProductoRequest(
            r.sku(),
            r.nombre(),
            r.precio(),
            r.minimo(),
            r.activo(),
            r.marca(),
            r.categoria(),
            r.presentacion(),
            r.codigoBarras(),
            id,
            r.afectacionIgv(),
            r.precioIncluyeIgv()));
  }
}
