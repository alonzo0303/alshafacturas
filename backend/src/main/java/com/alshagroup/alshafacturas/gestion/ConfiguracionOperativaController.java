package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/operacion/configuracion")
public class ConfiguracionOperativaController {
  private final JdbcTemplate db;
  private final AuditoriaService audit;

  public ConfiguracionOperativaController(JdbcTemplate db, AuditoriaService audit) {
    this.db = db;
    this.audit = audit;
  }

  private Long empresa(UsuarioPrincipal p, Long id) {
    return "SUPERADMIN".equals(p.getRol())
        ? Objects.requireNonNullElse(id, p.getEmpresaId())
        : p.getEmpresaId();
  }

  @GetMapping
  public Map<String, Object> leer(
      @AuthenticationPrincipal UsuarioPrincipal p, @RequestParam(required = false) Long empresaId) {
    return db.queryForMap(
        "SELECT preparacion_habilitada,rendimiento_modo,caja_obligatoria FROM empresas WHERE id=?",
        empresa(p, empresaId));
  }

  public record Config(
      boolean preparacionHabilitada,
      @NotNull @Pattern(regexp = "COMERCIO|SERVICIOS|AMBOS") String rendimientoModo,
      boolean cajaObligatoria) {}

  @PutMapping
  @PreAuthorize("hasRole('SUPERADMIN')")
  @Transactional
  public void guardar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam Long empresaId,
      @Valid @RequestBody Config r) {
    db.update(
        "UPDATE empresas SET preparacion_habilitada=?,rendimiento_modo=?,caja_obligatoria=? WHERE"
            + " id=?",
        r.preparacionHabilitada(),
        r.rendimientoModo(),
        r.cajaObligatoria(),
        empresaId);
    audit.registrar(
        p,
        empresaId,
        null,
        "CONFIGURACION_OPERATIVA",
        empresaId,
        "preparación="
            + r.preparacionHabilitada()
            + ", rendimiento="
            + r.rendimientoModo()
            + ", caja obligatoria="
            + r.cajaObligatoria());
  }
}
