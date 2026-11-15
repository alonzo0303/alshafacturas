package com.alshagroup.alshafacturas.gestion;

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
@RequestMapping("/api/cajas")
public class AccesosCajaController {
  private final JdbcTemplate db;
  private final RolesService roles;
  private final CajaService cajas;
  private final AuditoriaService audit;

  public AccesosCajaController(
      JdbcTemplate db, RolesService roles, CajaService cajas, AuditoriaService audit) {
    this.db = db;
    this.roles = roles;
    this.cajas = cajas;
    this.audit = audit;
  }

  @GetMapping("/personal")
  @PreAuthorize("hasRole('ADMIN')")
  public List<Map<String, Object>> personal(@AuthenticationPrincipal UsuarioPrincipal p) {
    var rows =
        db.queryForList(
            "SELECT u.id,u.nombre,u.rol,a.habilitada,a.fondo_asignado FROM usuarios u LEFT JOIN"
                + " accesos_caja a ON a.usuario_id=u.id AND a.empresa_id=u.empresa_id AND"
                + " a.local_id=? WHERE u.empresa_id=? AND u.activo AND u.rol<>'SUPERADMIN' AND"
                + " (u.rol='ADMIN' OR EXISTS(SELECT 1 FROM usuario_locales ul WHERE"
                + " ul.usuario_id=u.id AND ul.local_id=?) OR (NOT EXISTS(SELECT 1 FROM"
                + " usuario_locales ul WHERE ul.usuario_id=u.id) AND ?=(SELECT min(id) FROM locales"
                + " WHERE empresa_id=u.empresa_id))) ORDER BY u.nombre,u.id",
            LocalesService.actual(),
            p.getEmpresaId(),
            LocalesService.actual(),
            LocalesService.actual());
    var defaults = new HashMap<String, Boolean>();
    rows.forEach(
        r -> {
          r.put("personalizado", r.get("habilitada") != null);
          if (r.get("habilitada") == null)
            r.put(
                "habilitada",
                defaults.computeIfAbsent(
                    r.get("rol").toString(),
                    rol -> roles.permisos(p.getEmpresaId(), rol).contains("CAJA_GESTIONAR")));
        });
    return rows;
  }

  @GetMapping("/mi-acceso")
  public Map<String, Object> acceso(@AuthenticationPrincipal UsuarioPrincipal p) {
    var result = new LinkedHashMap<String, Object>();
    result.put("habilitada", p.getPermisos().contains("CAJA_GESTIONAR"));
    var rows =
        db.queryForList(
            "SELECT fondo_asignado FROM accesos_caja WHERE empresa_id=? AND local_id=? AND"
                + " usuario_id=?",
            p.getEmpresaId(),
            LocalesService.actual(),
            p.getId());
    result.put("fondoAsignado", rows.isEmpty() ? null : rows.getFirst().get("fondo_asignado"));
    return result;
  }

  public record Config(
      boolean habilitada,
      @DecimalMin("0") @DecimalMax("999999999.99") @Digits(integer = 9, fraction = 2)
          BigDecimal fondoAsignado,
      boolean abrirAhora) {}

  @PutMapping("/personal/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  @Transactional
  public Map<String, Object> configurar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody Config r) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var user =
        personal(p).stream()
            .filter(u -> ((Number) u.get("id")).longValue() == id)
            .findFirst()
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no disponible en este local"));
    if (r.habilitada() && !p.getModulosVisibles().contains("CAJA"))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Habilita el módulo Caja en la configuración del negocio");
    if (!r.habilitada()
        && db.queryForObject(
                "SELECT count(*) FROM cajas WHERE empresa_id=? AND local_id=? AND"
                    + " usuario_original_id=? AND estado='ABIERTA'",
                Long.class,
                p.getEmpresaId(),
                LocalesService.actual(),
                id)
            > 0)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Cierra su caja antes de retirar el acceso");
    if (r.abrirAhora() && (!r.habilitada() || r.fondoAsignado() == null))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Para entregar fondo y abrir caja debes habilitarla e indicar el importe");
    db.update(
        "INSERT INTO accesos_caja(empresa_id,local_id,usuario_id,habilitada,fondo_asignado) VALUES"
            + " (?,?,?,?,?) ON CONFLICT(empresa_id,local_id,usuario_id) DO UPDATE SET"
            + " habilitada=EXCLUDED.habilitada,fondo_asignado=EXCLUDED.fondo_asignado,actualizado=CURRENT_TIMESTAMP",
        p.getEmpresaId(),
        LocalesService.actual(),
        id,
        r.habilitada(),
        r.fondoAsignado());
    audit.registrar(
        p,
        p.getEmpresaId(),
        LocalesService.actual(),
        "ACCESO_CAJA_CONFIGURADO",
        id,
        "Habilitada=" + r.habilitada() + ", fondo=" + r.fondoAsignado());
    if (r.abrirAhora())
      return cajas.abrirPara(p, id, user.get("nombre").toString(), r.fondoAsignado());
    return Map.of("guardado", true);
  }
}
