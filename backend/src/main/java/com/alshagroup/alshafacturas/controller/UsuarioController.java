package com.alshagroup.alshafacturas.controller;

import com.alshagroup.alshafacturas.dto.EmpleadoRequest;
import com.alshagroup.alshafacturas.dto.UsuarioResponse;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import com.alshagroup.alshafacturas.service.UsuarioService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

  private final UsuarioService usuarioService;

  public UsuarioController(UsuarioService usuarioService) {
    this.usuarioService = usuarioService;
  }

  @PostMapping
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<UsuarioResponse> registrarEmpleado(
      @AuthenticationPrincipal UsuarioPrincipal usuario,
      @Valid @RequestBody EmpleadoRequest request) {
    UsuarioResponse nuevoUsuario =
        usuarioService.registrarEmpleado(usuario.getEmpresaId(), request);

    return ResponseEntity.status(HttpStatus.CREATED).body(nuevoUsuario);
  }

  @GetMapping
  @PreAuthorize("hasRole('ADMIN')")
  public List<UsuarioResponse> listarEmpleados(@AuthenticationPrincipal UsuarioPrincipal usuario) {
    return usuarioService.listarPorEmpresa(usuario.getEmpresaId());
  }

  public record ActivoRequest(@jakarta.validation.constraints.NotNull Boolean activo) {}

  @PatchMapping("/{id}/activo")
  @PreAuthorize("hasRole('ADMIN')")
  public UsuarioResponse activo(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody ActivoRequest r) {
    return usuarioService.cambiarActivo(p.getEmpresaId(), p.getId(), id, r.activo());
  }

  public record RolRequest(@jakarta.validation.constraints.NotBlank String rol) {}

  @PatchMapping("/{id}/rol")
  @PreAuthorize("hasRole('ADMIN')")
  public UsuarioResponse rol(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody RolRequest r) {
    return usuarioService.cambiarRol(p.getEmpresaId(), p.getId(), id, r.rol());
  }
}
