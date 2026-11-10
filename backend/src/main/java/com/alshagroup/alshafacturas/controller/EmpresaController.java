package com.alshagroup.alshafacturas.controller;

import com.alshagroup.alshafacturas.entity.Empresa;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import com.alshagroup.alshafacturas.service.EmpresaService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/empresas")
public class EmpresaController {

  private final EmpresaService empresaService;

  public EmpresaController(EmpresaService empresaService) {
    this.empresaService = empresaService;
  }

  @PostMapping("/alta")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Empresa alta(@Valid @RequestBody com.alshagroup.alshafacturas.dto.EmpresaAltaRequest r) {
    return empresaService.alta(r);
  }

  public record EstadoRequest(
      @jakarta.validation.constraints.NotNull
          com.alshagroup.alshafacturas.entity.EstadoEmpresa estado) {}

  @PatchMapping("/{id}/estado")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Empresa estado(@PathVariable Long id, @Valid @RequestBody EstadoRequest r) {
    return empresaService.cambiarEstadoEmpresa(id, r.estado());
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Empresa editarDatos(
      @PathVariable Long id, @Valid @RequestBody EmpresaService.DatosRequest r) {
    return empresaService.editarDatos(id, r);
  }

  @GetMapping
  @PreAuthorize("hasRole('SUPERADMIN')")
  public List<Empresa> listarEmpresas() {
    return empresaService.listarEmpresas();
  }

  @PostMapping
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Empresa guardarEmpresa(@Valid @RequestBody Empresa empresa) {
    return empresaService.guardarEmpresa(empresa);
  }

  @GetMapping("/mi-empresa")
  public Empresa obtenerMiEmpresa(@AuthenticationPrincipal UsuarioPrincipal usuario) {
    return empresaService.obtenerEmpresaPorId(usuario.getEmpresaId());
  }
}
