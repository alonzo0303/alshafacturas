package com.alshagroup.alshafacturas.service;

import com.alshagroup.alshafacturas.dto.EmpleadoRequest;
import com.alshagroup.alshafacturas.dto.UsuarioRequest;
import com.alshagroup.alshafacturas.dto.UsuarioResponse;
import com.alshagroup.alshafacturas.entity.Empresa;
import com.alshagroup.alshafacturas.entity.Usuario;
import com.alshagroup.alshafacturas.repository.EmpresaRepository;
import com.alshagroup.alshafacturas.repository.UsuarioRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UsuarioService {

  private final UsuarioRepository usuarioRepository;
  private final EmpresaRepository empresaRepository;
  private final PasswordEncoder passwordEncoder;
  private final jakarta.validation.Validator validator;
  private final com.alshagroup.alshafacturas.gestion.RolesService roles;
  private final com.alshagroup.alshafacturas.gestion.PlanesService planes;
  private final org.springframework.jdbc.core.JdbcTemplate db;

  public UsuarioService(
      UsuarioRepository usuarioRepository,
      EmpresaRepository empresaRepository,
      PasswordEncoder passwordEncoder,
      jakarta.validation.Validator validator,
      com.alshagroup.alshafacturas.gestion.RolesService roles,
      com.alshagroup.alshafacturas.gestion.PlanesService planes,
      org.springframework.jdbc.core.JdbcTemplate db) {
    this.usuarioRepository = usuarioRepository;
    this.empresaRepository = empresaRepository;
    this.passwordEncoder = passwordEncoder;
    this.validator = validator;
    this.roles = roles;
    this.planes = planes;
    this.db = db;
  }

  public List<UsuarioResponse> listarPorEmpresa(Long empresaId) {

    return usuarioRepository.findByEmpresaId(empresaId).stream()
        .map(
            usuario ->
                new UsuarioResponse(
                    usuario.getId(),
                    usuario.getEmpresa().getId(),
                    usuario.getNombre(),
                    usuario.getCorreo(),
                    usuario.getRol(),
                    usuario.getActivo()))
        .toList();
  }

  @org.springframework.transaction.annotation.Transactional
  public UsuarioResponse registrarUsuario(UsuarioRequest request) {
    if (!validator.validate(request).isEmpty())
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Revisa nombre, correo y contraseña (8 a 72 caracteres)");
    if (request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Contraseña demasiado larga");
    String correoNormalizado = request.correo().trim().toLowerCase(java.util.Locale.ROOT);

    // 1. Verificar que la empresa exista
    Empresa empresa =
        empresaRepository
            .findById(request.empresaId())
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "La empresa no existe"));

    // 2. Verificar que el correo no esté registrado

    if (usuarioRepository.existsByEmpresaIdAndCorreo(empresa.getId(), correoNormalizado)) {

      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "El correo ya está registrado en esta empresa");
    }

    // 3. Crear el usuario
    Usuario usuario = new Usuario();

    usuario.setEmpresa(empresa);

    usuario.setNombre(request.nombre().trim());
    usuario.setCorreo(correoNormalizado);

    // Validar el rol del usuario

    String rolTexto = request.rol().trim().toUpperCase(Locale.ROOT);

    if ("SUPERADMIN".equals(rolTexto))
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "No está permitido registrar usuarios SUPERADMIN");
    if (!roles.existe(empresa.getId(), rolTexto))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El rol no existe en este negocio");
    usuario.setRol(rolTexto);

    usuario.setActivo(true);

    // 4. Proteger la contraseña con BCrypt
    usuario.setPasswordHash(passwordEncoder.encode(request.password()));

    // 5. Guardar en PostgreSQL
    Usuario guardado = usuarioRepository.save(usuario);

    // 6. Devolver una respuesta sin contraseña
    return new UsuarioResponse(
        guardado.getId(),
        guardado.getEmpresa().getId(),
        guardado.getNombre(),
        guardado.getCorreo(),
        guardado.getRol(),
        guardado.getActivo());
  }

  @org.springframework.transaction.annotation.Transactional
  public UsuarioResponse registrarEmpleado(Long empresaIdAutenticada, EmpleadoRequest request) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresaIdAutenticada);
    planes.validarCupo(empresaIdAutenticada);
    UsuarioRequest nuevoUsuario =
        new UsuarioRequest(
            empresaIdAutenticada,
            request.nombre(),
            request.correo(),
            request.password(),
            request.rol());

    return registrarUsuario(nuevoUsuario);
  }

  @org.springframework.transaction.annotation.Transactional
  public UsuarioResponse cambiarActivo(Long empresaId, Long actorId, Long id, boolean activo) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresaId);
    var u =
        usuarioRepository
            .findByIdAndEmpresaId(id, empresaId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    if (id.equals(actorId))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "No puedes desactivar tu propia cuenta");
    if (!activo && java.util.Objects.equals(id, planes.propietario(empresaId)))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "El administrador principal debe conservar acceso");
    if (activo && !Boolean.TRUE.equals(u.getActivo())) planes.validarCupo(empresaId);
    u.setActivo(activo);
    usuarioRepository.save(u);
    return new UsuarioResponse(
        u.getId(), empresaId, u.getNombre(), u.getCorreo(), u.getRol(), u.getActivo());
  }

  @org.springframework.transaction.annotation.Transactional
  public UsuarioResponse cambiarRol(Long empresa, Long actor, Long id, String rol) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
    if (id.equals(actor) || id.equals(planes.propietario(empresa)))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "No se puede cambiar el rol del administrador principal ni el propio");
    if (!roles.existe(empresa, rol))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rol no válido");
    var u =
        usuarioRepository
            .findByIdAndEmpresaId(id, empresa)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    u.setRol(rol);
    usuarioRepository.save(u);
    return new UsuarioResponse(
        u.getId(), empresa, u.getNombre(), u.getCorreo(), u.getRol(), u.getActivo());
  }
}
