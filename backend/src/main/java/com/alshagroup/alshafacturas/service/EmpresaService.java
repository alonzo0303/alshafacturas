
package com.alshagroup.alshafacturas.service;

import com.alshagroup.alshafacturas.entity.Empresa;
import com.alshagroup.alshafacturas.repository.EmpresaRepository;
import org.springframework.stereotype.Service;


import java.util.List;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class EmpresaService {

    private final EmpresaRepository empresaRepository;

    public EmpresaService(EmpresaRepository empresaRepository) {
        this.empresaRepository = empresaRepository;
    }

    public List<Empresa> listarEmpresas() {
        return empresaRepository.findAll();
    }

    
public Empresa guardarEmpresa(Empresa empresa) {

    if (empresaRepository.existsByRuc(empresa.getRuc())) {
        throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Ya existe una empresa registrada con este RUC"
        );
    }

    return empresaRepository.save(empresa);
}

}
