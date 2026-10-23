
package com.alshagroup.alshafacturas.controller;

import com.alshagroup.alshafacturas.entity.Empresa;
import com.alshagroup.alshafacturas.service.EmpresaService;

import org.springframework.web.bind.annotation.*;
import java.util.List;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/empresas")
public class EmpresaController {

    private final EmpresaService empresaService;

    public EmpresaController(EmpresaService empresaService) {
        this.empresaService = empresaService;
    }

    @GetMapping
    public List<Empresa> listarEmpresas() {
        return empresaService.listarEmpresas();
    }

    
@PostMapping
public Empresa guardarEmpresa(@Valid @RequestBody Empresa empresa) {
    return empresaService.guardarEmpresa(empresa);
}

}
