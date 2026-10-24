
package com.alshagroup.alshafacturas.controller;

import com.alshagroup.alshafacturas.dto.UsuarioRequest;
import com.alshagroup.alshafacturas.dto.UsuarioResponse;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import com.alshagroup.alshafacturas.service.UsuarioService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
            @Valid @RequestBody UsuarioRequest request
    ) {
        UsuarioResponse nuevoUsuario = usuarioService.registrarEmpleado(
                usuario.getEmpresaId(),
                request
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(nuevoUsuario);
    }
    
@GetMapping
@PreAuthorize("hasRole('ADMIN')")
public List<UsuarioResponse> listarEmpleados(
        @AuthenticationPrincipal UsuarioPrincipal usuario
) {
    return usuarioService.listarPorEmpresa(
            usuario.getEmpresaId()
    );
}

}
