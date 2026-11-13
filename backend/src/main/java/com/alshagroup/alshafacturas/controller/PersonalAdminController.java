package com.alshagroup.alshafacturas.controller;

import com.alshagroup.alshafacturas.gestion.*;
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
@RequestMapping("/api/admin/personal")
@PreAuthorize("hasRole('SUPERADMIN')")
public class PersonalAdminController {
  private final JdbcTemplate db;
  private final PlanesService planes;
  private final RolesService roles;
  private final AuditoriaService audit;

  public PersonalAdminController(
      JdbcTemplate db, PlanesService planes, RolesService roles, AuditoriaService audit) {
    this.db = db;
    this.planes = planes;
    this.roles = roles;
    this.audit = audit;
  }

  private Map<String, Object> user(Long e, Long id) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, e);
    var rows =
        db.queryForList(
            "SELECT * FROM usuarios WHERE empresa_id=? AND id=? AND rol<>'SUPERADMIN' FOR UPDATE",
            e,
            id);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cuenta de negocio no encontrada");
    return rows.getFirst();
  }

  @GetMapping
  public List<Map<String, Object>> lista(@RequestParam Long empresaId) {
    return db.queryForList(
        "SELECT id,nombre,correo,rol,activo,desactivado_en,desactivado_en+INTERVAL '15 days' AS"
            + " gracia_hasta,id=(SELECT administrador_principal_id FROM empresas WHERE id=?) AS"
            + " principal FROM usuarios WHERE empresa_id=? AND rol<>'SUPERADMIN' ORDER BY id",
        empresaId,
        empresaId);
  }

  @GetMapping("/roles")
  public Map<String, Object> roles(@RequestParam Long empresaId) {
    return roles.listado(empresaId);
  }

  public record Estado(@NotNull Boolean activo, @AssertTrue boolean confirmado) {}

  @PatchMapping("/{id}/estado")
  @Transactional
  public void estado(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam Long empresaId,
      @PathVariable Long id,
      @Valid @RequestBody Estado r) {
    var u = user(empresaId, id);
    boolean activo = Boolean.TRUE.equals(u.get("activo"));
    if (activo == r.activo()) return;
    if (r.activo()) planes.validarReactivar(empresaId, id);
    db.update(
        "UPDATE usuarios SET activo=?,desactivado_en=CASE WHEN ? THEN NULL ELSE CURRENT_TIMESTAMP"
            + " END,credenciales_version=credenciales_version+1 WHERE empresa_id=? AND id=?",
        r.activo(),
        r.activo(),
        empresaId,
        id);
    audit.registrar(
        p,
        empresaId,
        null,
        r.activo() ? "USUARIO_REACTIVADO" : "USUARIO_DESACTIVADO",
        id,
        "Confirmación manual del superadministrador");
  }

  public record Rol(@NotBlank @Size(max = 30) String rol) {}

  @PatchMapping("/{id}/rol")
  @Transactional
  public void rol(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam Long empresaId,
      @PathVariable Long id,
      @Valid @RequestBody Rol r) {
    user(empresaId, id);
    if (Objects.equals(id, planes.propietario(empresaId)))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Transfiere primero la administración principal");
    if (!roles.existe(empresaId, r.rol()))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rol no válido para el negocio");
    db.update("UPDATE usuarios SET rol=? WHERE empresa_id=? AND id=?", r.rol(), empresaId, id);
    audit.registrar(p, empresaId, null, "USUARIO_ROL", id, r.rol());
  }

  public record Eliminar(@AssertTrue boolean confirmado) {}

  @DeleteMapping("/{id}")
  @Transactional
  public void eliminar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam Long empresaId,
      @PathVariable Long id,
      @Valid @RequestBody Eliminar r) {
    var u = user(empresaId, id);
    if (Boolean.TRUE.equals(u.get("activo")))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Desactiva la cuenta antes de eliminarla");
    if (Objects.equals(id, planes.propietario(empresaId)))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Transfiere primero la administración principal");
    if (db.queryForObject(
            "SELECT count(*) FROM cajas WHERE usuario_id=? AND estado='ABIERTA'", Long.class, id)
        > 0)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Cierra las cajas del usuario antes de eliminarlo");
    audit.registrar(
        p,
        empresaId,
        null,
        "USUARIO_ELIMINADO",
        id,
        "Cuenta eliminada; operaciones y autoría histórica conservadas");
    db.update("DELETE FROM usuarios WHERE empresa_id=? AND id=?", empresaId, id);
  }

  public record Propietario(@NotNull Long usuarioId) {}

  @PatchMapping("/propietario")
  @Transactional
  public void propietario(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam Long empresaId,
      @Valid @RequestBody Propietario r) {
    var u = user(empresaId, r.usuarioId());
    if (!Boolean.TRUE.equals(u.get("activo")) || !"ADMIN".equals(u.get("rol")))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Elige otro administrador activo de esta empresa");
    db.update(
        "UPDATE empresas SET administrador_principal_id=? WHERE id=?", r.usuarioId(), empresaId);
    audit.registrar(
        p,
        empresaId,
        null,
        "ADMINISTRADOR_PRINCIPAL",
        r.usuarioId(),
        "Transferencia de administración principal");
  }
}
