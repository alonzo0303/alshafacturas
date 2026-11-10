package com.alshagroup.alshafacturas.service;

import com.alshagroup.alshafacturas.entity.Empresa;
import com.alshagroup.alshafacturas.entity.EstadoEmpresa;
import com.alshagroup.alshafacturas.repository.EmpresaRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EmpresaService {

  private final EmpresaRepository empresaRepository;
  private final UsuarioService usuarios;

  public EmpresaService(EmpresaRepository empresaRepository, UsuarioService usuarios) {
    this.usuarios = usuarios;
    this.empresaRepository = empresaRepository;
  }

  public List<Empresa> listarEmpresas() {
    return empresaRepository.findAll();
  }

  public Empresa guardarEmpresa(Empresa empresa) {

    if (empresa.getRuc() != null && empresaRepository.existsByRuc(empresa.getRuc())) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Ya existe una empresa registrada con este RUC");
    }

    return empresaRepository.save(empresa);
  }

  public Empresa obtenerEmpresaPorId(Long empresaId) {

    return empresaRepository
        .findById(empresaId)
        .orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "La empresa no existe"));
  }

  @org.springframework.transaction.annotation.Transactional
  public Empresa alta(com.alshagroup.alshafacturas.dto.EmpresaAltaRequest r) {
    var e = new Empresa();
    e.setRuc(r.ruc());
    e.setRazonSocial(r.razonSocial().trim());
    e.setDireccion(r.direccion());
    e.setEstado(EstadoEmpresa.ACTIVA);
    var saved = guardarEmpresa(e);
    usuarios.registrarUsuario(
        new com.alshagroup.alshafacturas.dto.UsuarioRequest(
            saved.getId(),
            r.administradorNombre(),
            r.administradorCorreo(),
            r.administradorPassword(),
            "ADMIN"));
    return saved;
  }

  public Empresa cambiarEstadoEmpresa(Long empresaId, EstadoEmpresa nuevoEstado) {
    if (nuevoEstado == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El estado de la empresa es obligatorio");
    }

    Empresa empresa = obtenerEmpresaPorId(empresaId);

    if ("00000000000".equals(empresa.getRuc()))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "La empresa de plataforma no se puede suspender");
    empresa.setEstado(nuevoEstado);

    return empresaRepository.save(empresa);
  }
}
