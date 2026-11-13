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
  private final com.alshagroup.alshafacturas.gestion.RubrosService rubros;

  public EmpresaService(
      EmpresaRepository empresaRepository,
      UsuarioService usuarios,
      com.alshagroup.alshafacturas.gestion.RubrosService rubros) {
    this.usuarios = usuarios;
    this.rubros = rubros;
    this.empresaRepository = empresaRepository;
  }

  public List<Empresa> listarEmpresas() {
    return empresaRepository.findAll();
  }

  @org.springframework.transaction.annotation.Transactional
  public Empresa guardarEmpresa(Empresa empresa) {

    if (empresa.getRuc() != null && empresaRepository.existsByRuc(empresa.getRuc())) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Ya existe una empresa registrada con este RUC");
    }

    empresa.setRubroNegocio(rubros.validar(empresa.getRubroNegocio()));
    var saved = empresaRepository.saveAndFlush(empresa);
    rubros.asociar(saved.getId(), saved.getRubroNegocio());
    return saved;
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
    e.setRubroNegocio(rubros.validar(r.rubroNegocio()));
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

  public record DatosRequest(
      @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 200)
          String razonSocial,
      @jakarta.validation.constraints.Size(max = 255) String direccion,
      @jakarta.validation.constraints.Pattern(regexp = "(?:[0-9]{11})?") String ruc,
      @jakarta.validation.constraints.Size(max = 100) String rubroNegocio) {}

  @org.springframework.transaction.annotation.Transactional
  public Empresa editarDatos(Long id, DatosRequest r) {
    var actual =
        empresaRepository
            .paraEditar(id)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "La empresa no existe"));
    if (r.rubroNegocio() != null) {
      actual.setRubroNegocio(rubros.validar(r.rubroNegocio()));
      empresaRepository.saveAndFlush(actual);
      rubros.asociar(id, actual.getRubroNegocio());
    }
    String nuevo = r.ruc() == null || r.ruc().isBlank() ? null : r.ruc().trim();
    if (nuevo != null && !nuevo.equals(actual.getRuc())) {
      if (actual.getRuc() != null)
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "El RUC ya registrado no se cambia desde esta opción");
      if ("00000000000".equals(nuevo) || empresaRepository.existsByRuc(nuevo))
        throw new ResponseStatusException(HttpStatus.CONFLICT, "El RUC no está disponible");
      actual.setRuc(nuevo);
      actual.habilitarRuc();
      empresaRepository.saveAndFlush(actual);
    }
    if (empresaRepository.editarDatos(
            id, r.razonSocial().trim(), r.direccion() == null ? null : r.direccion().trim())
        == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La empresa no existe");
    return obtenerEmpresaPorId(id);
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
