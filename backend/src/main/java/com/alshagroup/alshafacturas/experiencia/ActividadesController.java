package com.alshagroup.alshafacturas.experiencia;

import static com.alshagroup.alshafacturas.experiencia.ExperienciaDtos.*;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/experiencia/actividades")
@PreAuthorize("hasRole('SUPERADMIN') or hasAuthority('ACTIVIDADES_GESTIONAR')")
public class ActividadesController {
  private final ActividadesService service;
  private final ExperienciaScope scope;

  public ActividadesController(ActividadesService s, ExperienciaScope p) {
    service = s;
    scope = p;
  }

  @GetMapping
  public List<Map<String, Object>> listar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId) {
    long e = scope.empresa(p, empresaId);
    return service.lista(p, e, scope.local(p, e, localId));
  }

  @GetMapping("/responsables")
  @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
  public List<Map<String, Object>> responsables(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId) {
    long e = scope.empresa(p, empresaId);
    return service.responsables(e, scope.local(p, e, localId));
  }

  @GetMapping("/{id}")
  public Map<String, Object> detalle(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable long id,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId) {
    long e = scope.empresa(p, empresaId);
    return service.detalle(p, e, scope.local(p, e, localId), id);
  }

  @PostMapping
  public Map<String, Object> crear(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId,
      @Valid @RequestBody NuevaActividad r) {
    long e = scope.empresa(p, empresaId);
    return service.crear(p, e, scope.local(p, e, localId), r);
  }

  @PostMapping("/{id}/etapa")
  public Map<String, Object> avanzar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable long id,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId,
      @Valid @RequestBody Paso r) {
    long e = scope.empresa(p, empresaId);
    return service.avanzar(p, e, scope.local(p, e, localId), id, r);
  }

  @PostMapping("/{id}/responsable")
  @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
  public Map<String, Object> asignar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable long id,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId,
      @Valid @RequestBody Reasignar r) {
    long e = scope.empresa(p, empresaId);
    return service.asignar(p, e, scope.local(p, e, localId), id, r);
  }
}
