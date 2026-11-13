package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.servlet.http.HttpServletRequest;
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
@RequestMapping("/api/locales")
public class LocalesController {
  private final LocalesService locales;
  private final JdbcTemplate db;
  private final RubrosService rubros;

  public LocalesController(LocalesService locales, JdbcTemplate db, RubrosService rubros) {
    this.locales = locales;
    this.db = db;
    this.rubros = rubros;
  }

  private Long empresa(UsuarioPrincipal p, Long id) {
    return "SUPERADMIN".equals(p.getRol())
        ? Objects.requireNonNullElse(id, p.getEmpresaId())
        : p.getEmpresaId();
  }

  @GetMapping
  public List<Map<String, Object>> listar(
      @AuthenticationPrincipal UsuarioPrincipal p, @RequestParam(required = false) Long empresaId) {
    return "SUPERADMIN".equals(p.getRol())
        ? locales.todos(empresa(p, empresaId))
        : locales.permitidos(p);
  }

  public record Datos(
      @NotBlank @Size(max = 100) String nombre,
      @Size(max = 255) String direccion,
      @Size(max = 100) String rubroNegocio) {}

  @PostMapping
  @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
  @Transactional
  public List<Map<String, Object>> crear(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @Valid @RequestBody Datos r) {
    Long e = empresa(p, empresaId);
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, e);
    locales.todos(e);
    if (r.rubroNegocio() != null && !"SUPERADMIN".equals(p.getRol()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El rubro lo asigna SuperAdmin");
    String rubro = rubros.validar(r.rubroNegocio());
    rubros.asociar(e, rubro);
    db.update(
        "INSERT INTO locales(empresa_id,nombre,direccion,rubro_negocio) VALUES (?,?,?,?)",
        e,
        r.nombre().trim(),
        Objects.requireNonNullElse(r.direccion(), ""),
        rubro);
    return locales.todos(e);
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
  @Transactional
  public void editar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @RequestParam(required = false) Long empresaId,
      @Valid @RequestBody Datos r) {
    Long e = empresa(p, empresaId);
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, e);
    if (r.rubroNegocio() != null) {
      if (!"SUPERADMIN".equals(p.getRol()))
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El rubro lo asigna SuperAdmin");
      String rubro = rubros.validar(r.rubroNegocio());
      rubros.asociar(e, rubro);
      db.update("UPDATE locales SET rubro_negocio=? WHERE empresa_id=? AND id=?", rubro, e, id);
    }
    if (db.update(
            "UPDATE locales SET nombre=?,direccion=? WHERE empresa_id=? AND id=?",
            r.nombre().trim(),
            Objects.requireNonNullElse(r.direccion(), ""),
            empresa(p, empresaId),
            id)
        == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Local no encontrado");
  }

  public record Seleccion(@NotNull Long localId) {}

  @PostMapping("/seleccionar")
  public Map<String, Object> seleccionar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @Valid @RequestBody Seleccion r,
      HttpServletRequest req) {
    locales.seleccionar(p, r.localId());
    req.getSession().setAttribute("localId", p.getLocalId());
    return Map.of("localId", p.getLocalId(), "localNombre", p.getLocalNombre());
  }

  public record Acceso(@NotEmpty @Size(max = 100) List<@NotNull Long> locales) {}

  @GetMapping("/usuarios")
  @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
  public List<Map<String, Object>> usuarios(
      @AuthenticationPrincipal UsuarioPrincipal p, @RequestParam(required = false) Long empresaId) {
    return db.queryForList(
        "SELECT id,nombre,correo,rol,COALESCE((SELECT json_agg(local_id) FROM usuario_locales ul"
            + " WHERE ul.usuario_id=u.id),'[]')::text AS locales FROM usuarios u WHERE empresa_id=?"
            + " AND rol<>'SUPERADMIN' ORDER BY id",
        empresa(p, empresaId));
  }

  @PutMapping("/usuarios/{id}")
  @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
  @Transactional
  public void acceso(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @PathVariable Long id,
      @Valid @RequestBody Acceso r) {
    Long e = empresa(p, empresaId);
    var user =
        db.queryForList(
            "SELECT id,rol FROM usuarios WHERE id=? AND empresa_id=? FOR UPDATE", id, e);
    if (user.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado");
    if (Set.of("ADMIN", "SUPERADMIN").contains(user.getFirst().get("rol")))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Los administradores tienen acceso a todos los locales");
    var valid = locales.todos(e).stream().map(l -> ((Number) l.get("id")).longValue()).toList();
    if (!valid.containsAll(r.locales()))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Local ajeno al negocio");
    db.update("DELETE FROM usuario_locales WHERE usuario_id=?", id);
    for (Long l : new HashSet<>(r.locales()))
      db.update("INSERT INTO usuario_locales(usuario_id,local_id) VALUES (?,?)", id, l);
  }
}
