package com.alshagroup.alshafacturas.visual;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/visualizacion-negocio")
@PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
public class VisualNegocioController {
  private final VisualNegocioService service;
  private final com.alshagroup.alshafacturas.experiencia.ExperienciaScope scope;

  public VisualNegocioController(
      VisualNegocioService s, com.alshagroup.alshafacturas.experiencia.ExperienciaScope c) {
    service = s;
    scope = c;
  }

  @GetMapping
  public Map<String, Object> obtener(
      @AuthenticationPrincipal UsuarioPrincipal p, @RequestParam(required = false) Long empresaId) {
    return service.obtener(scope.empresa(p, empresaId));
  }

  @PutMapping
  public Map<String, Object> guardar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @Valid @RequestBody VisualNegocioService.Config r) {
    return service.guardar(p, scope.empresa(p, empresaId), r);
  }
}
