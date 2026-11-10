package com.alshagroup.alshafacturas.sunat;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sunat")
public class SunatController {
  private final SunatService service;

  public SunatController(SunatService service) {
    this.service = service;
  }

  @GetMapping("/configuracion")
  public Map<String, Object> config(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.configuracion(p);
  }

  @GetMapping("/comprobantes")
  public List<Map<String, Object>> lista(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.listar(p);
  }

  @PostMapping("/ventas/{id}/emitir")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> emitir(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    return service.emitir(p, id);
  }

  @PostMapping("/comprobantes/{id}/consultar")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> consultar(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    return service.consultar(p, id);
  }

  @PostMapping("/comprobantes/{id}/reintentar")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> reintentar(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    return service.reintentar(p, id);
  }

  @GetMapping("/comprobantes/{id}/{archivo}")
  public ResponseEntity<byte[]> archivo(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @PathVariable String archivo) {
    var a = service.archivo(p, id, archivo);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(a.tipo()))
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + a.nombre() + "\"")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .body(a.contenido());
  }
}
