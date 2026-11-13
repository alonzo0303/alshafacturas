package com.alshagroup.alshafacturas.experiencia;

import static com.alshagroup.alshafacturas.experiencia.ExperienciaDtos.*;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/experiencia")
public class AvisosController {
  private final AvisosService service;

  public AvisosController(AvisosService s) {
    service = s;
  }

  @GetMapping("/reglas")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public List<Map<String, Object>> listar(@RequestParam(required = false) Long empresaId) {
    return service.reglas(empresaId);
  }

  @PostMapping("/reglas")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> publicar(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody Aviso r) {
    return service.publicar(p, r);
  }

  @PostMapping("/avisos/reclamar")
  public Map<String, Object> reclamar(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @Valid @RequestBody Solicitar r,
      HttpServletRequest req) {
    return service.reclamar(p, r, req.getSession().getId());
  }

  @PostMapping("/avisos/{id}/respuesta")
  public void responder(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable UUID id,
      @Valid @RequestBody Respuesta r,
      HttpServletRequest req) {
    service.responder(p, id, r, req.getSession().getId());
  }
}
