package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class GestionController {
  private final RolesService roles;
  private final PlanesService planes;

  public GestionController(RolesService roles, PlanesService planes) {
    this.roles = roles;
    this.planes = planes;
  }

  @GetMapping("/roles")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> roles(@AuthenticationPrincipal UsuarioPrincipal p) {
    return roles.listado(p.getEmpresaId());
  }

  @PostMapping("/roles")
  @PreAuthorize("hasRole('ADMIN')")
  public void rol(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody RolesService.RolRequest r) {
    roles.guardar(p.getEmpresaId(), r);
  }

  @GetMapping("/plan")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> plan(@AuthenticationPrincipal UsuarioPrincipal p) {
    return planes.estado(p.getEmpresaId());
  }

  @GetMapping("/planes")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public List<PlanesService.Plan> planes() {
    return PlanesService.PLANES;
  }

  @GetMapping("/empresas/{id}/plan")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> planEmpresa(@PathVariable Long id) {
    return planes.estado(id);
  }

  @PostMapping("/empresas/{id}/pagos")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> pago(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody PlanesService.PagoRequest r) {
    return planes.registrar(id, p.getId(), r);
  }
}
