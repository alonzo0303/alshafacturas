
package com.alshagroup.alshafacturas.service;

import com.alshagroup.alshafacturas.entity.Empresa;
import com.alshagroup.alshafacturas.entity.EstadoEmpresa;
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

public Empresa obtenerEmpresaPorId(Long empresaId) {

    return empresaRepository.findById(empresaId)
            .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "La empresa no existe"
            ));
}

public Empresa cambiarEstadoEmpresa(
        Long empresaId,
        EstadoEmpresa nuevoEstado
) {
    if (nuevoEstado == null) {
        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "El estado de la empresa es obligatorio"
        );
    }

    Empresa empresa = obtenerEmpresaPorId(empresaId);

    empresa.setEstado(nuevoEstado);

    return empresaRepository.save(empresa);
}

}
