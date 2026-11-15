package com.alshagroup.alshafacturas.experiencia;

import static com.alshagroup.alshafacturas.experiencia.ExperienciaDtos.*;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/experiencia")
public class PerfilesController {
  private final PerfilesService perfiles;
  private final ExperienciaScope scope;

  public PerfilesController(PerfilesService p, ExperienciaScope s) {
    perfiles = p;
    scope = s;
  }

  @GetMapping("/plantillas")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public List<Map<String, Object>> plantillas(
      @AuthenticationPrincipal UsuarioPrincipal p, @RequestParam(required = false) Long empresaId) {
    return perfiles.listar(empresaId);
  }

  @PostMapping("/plantillas")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> publicar(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody Plantilla r) {
    return perfiles.publicar(p, r);
  }

  @GetMapping("/catalogo")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> catalogo() {
    return Map.of(
        "operaciones",
        Operacion.values(),
        "clases",
        Clase.values(),
        "disparadores",
        Trigger.values(),
        "paginas",
        Pagina.values(),
        "acciones",
        Accion.values(),
        "frecuencias",
        Frecuencia.values());
  }

  @GetMapping("/configuracion")
  @PreAuthorize(
      "hasRole('SUPERADMIN') or hasAuthority('RENDIMIENTO_VER') or"
          + " hasAuthority('ACTIVIDADES_GESTIONAR')")
  public Map<String, Object> configuracion(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam(required = false) Long empresaId,
      @RequestParam(required = false) Long localId) {
    long e = scope.empresa(p, empresaId);
    return perfiles.configuracion(
        e, scope.root(p) && localId == null ? 0 : scope.local(p, e, localId));
  }

  @PutMapping("/configuracion")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public void guardar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam Long empresaId,
      @RequestParam(required = false) Long localId,
      @Valid @RequestBody Config r) {
    long e = scope.empresa(p, empresaId);
    if (localId != null) scope.validarLocal(e, localId);
    perfiles.asignar(p, e, localId, r);
  }

  @DeleteMapping("/configuracion")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public void heredar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @RequestParam Long empresaId,
      @RequestParam Long localId) {
    long e = scope.empresa(p, empresaId);
    scope.validarLocal(e, localId);
    perfiles.heredar(p, e, localId);
  }
}
