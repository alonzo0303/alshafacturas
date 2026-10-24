
package com.alshagroup.alshafacturas.controller;

import com.alshagroup.alshafacturas.entity.Empresa;
import com.alshagroup.alshafacturas.service.EmpresaService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@RestController
@RequestMapping("/api/empresas")
public class EmpresaController {

    private final EmpresaService empresaService;

    public EmpresaController(EmpresaService empresaService) {
        this.empresaService = empresaService;
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPERADMIN')")
    public List<Empresa> listarEmpresas() {
        return empresaService.listarEmpresas();
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPERADMIN')")
    public Empresa guardarEmpresa(
            @Valid @RequestBody Empresa empresa
    ) {
        return empresaService.guardarEmpresa(empresa);
    }
    
@GetMapping("/mi-empresa")
public Empresa obtenerMiEmpresa(
        @AuthenticationPrincipal UsuarioPrincipal usuario
) {
    return empresaService.obtenerEmpresaPorId(
            usuario.getEmpresaId()
    );
}

}
