package com.alshagroup.alshafacturas.controller;

import com.alshagroup.alshafacturas.repository.UsuarioRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/visualizaciones")
@PreAuthorize("hasRole('SUPERADMIN')")
public class VisualizacionController {
  private final UsuarioRepository usuarios;
  private final com.alshagroup.alshafacturas.security.LoginAttemptService attempts;
  private final com.alshagroup.alshafacturas.gestion.AuditoriaService audit;
  private final org.springframework.security.crypto.password.PasswordEncoder encoder;
  private final org.springframework.jdbc.core.JdbcTemplate db;

  public VisualizacionController(
      UsuarioRepository usuarios,
      org.springframework.jdbc.core.JdbcTemplate db,
      com.alshagroup.alshafacturas.gestion.AuditoriaService audit,
      org.springframework.security.crypto.password.PasswordEncoder encoder,
      com.alshagroup.alshafacturas.security.LoginAttemptService attempts) {
    this.usuarios = usuarios;
    this.audit = audit;
    this.encoder = encoder;
    this.attempts = attempts;
    this.db = db;
  }

  public record VisualizacionUsuario(
      Long id,
      Long empresaId,
      String nombre,
      String correo,
      String rol,
      boolean activo,
      String modalidad,
      String tipoAtencion) {}

  public record Seleccion(
      @NotNull @Pattern(regexp = "COMERCIO|ATENCION") String modalidad,
      @jakarta.validation.constraints.Size(max = 20) String tipoAtencion) {}

  @GetMapping
  @Transactional(readOnly = true)
  public List<VisualizacionUsuario> listar(@RequestParam Long empresaId) {
    return usuarios.findByEmpresaId(empresaId).stream()
        .filter(u -> !"SUPERADMIN".equals(u.getRol()))
        .map(this::respuesta)
        .toList();
  }

  @PatchMapping("/{id}")
  @Transactional
  public VisualizacionUsuario actualizar(
      @PathVariable Long id,
      @RequestParam Long empresaId,
      @Valid @RequestBody Seleccion seleccion) {
    if (("ATENCION".equals(seleccion.modalidad()) && seleccion.tipoAtencion() == null)
        || ("COMERCIO".equals(seleccion.modalidad()) && seleccion.tipoAtencion() != null))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Elige un tipo para Atención y servicios; Comercio no utiliza tipo de atención");
    if (seleccion.tipoAtencion() != null
        && db.queryForObject(
                "SELECT count(*) FROM tipos_atencion WHERE codigo=? AND activo",
                Long.class,
                seleccion.tipoAtencion())
            != 1)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de atención no válido");
    var usuario =
        usuarios
            .findByIdAndEmpresaId(id, empresaId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    if ("SUPERADMIN".equals(usuario.getRol()))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "La cuenta de plataforma conserva su administración");
    db.update(
        "UPDATE usuarios SET modalidad=?, tipo_atencion=? WHERE id=? AND empresa_id=?",
        seleccion.modalidad(),
        seleccion.tipoAtencion(),
        id,
        empresaId);
    return new VisualizacionUsuario(
        usuario.getId(),
        empresaId,
        usuario.getNombre(),
        usuario.getCorreo(),
        usuario.getRol(),
        Boolean.TRUE.equals(usuario.getActivo()),
        seleccion.modalidad(),
        seleccion.tipoAtencion());
  }

  public record Credenciales(
      @jakarta.validation.constraints.NotBlank
          @jakarta.validation.constraints.Email
          @jakarta.validation.constraints.Size(max = 150)
          String correo,
      @jakarta.validation.constraints.Size(max = 72) String password) {}

  @PatchMapping("/{id}/credenciales")
  @Transactional
  public void credenciales(
      @PathVariable Long id, @RequestParam Long empresaId, @Valid @RequestBody Credenciales r) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresaId);
    var user =
        usuarios
            .findByIdAndEmpresaId(id, empresaId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    if ("SUPERADMIN".equals(user.getRol()))
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Esta opción es para cuentas de negocios");
    String correo = r.correo().trim().toLowerCase(java.util.Locale.ROOT);
    if (usuarios.existsByEmpresaIdAndCorreo(empresaId, correo) && !correo.equals(user.getCorreo()))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Ese correo ya pertenece a otra cuenta de esta empresa");
    String password = r.password();
    if (password != null && !password.isEmpty()) {
      if (password.isBlank()
          || password.length() < 8
          || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "La contraseña requiere al menos 8 caracteres y hasta 72 bytes");
      db.update(
          "UPDATE usuarios SET correo=?,password_hash=?,credenciales_version=credenciales_version+1"
              + " WHERE id=? AND empresa_id=?",
          correo,
          encoder.encode(password),
          id,
          empresaId);
    } else if (!correo.equals(user.getCorreo()))
      db.update(
          "UPDATE usuarios SET correo=?,credenciales_version=credenciales_version+1 WHERE id=? AND"
              + " empresa_id=?",
          correo,
          id,
          empresaId);
    if (password != null && !password.isEmpty()) {
      attempts.clear(correo);
      attempts.clear(user.getCorreo());
    }
    var actor =
        (com.alshagroup.alshafacturas.security.UsuarioPrincipal)
            org.springframework.security.core.context.SecurityContextHolder.getContext()
                .getAuthentication()
                .getPrincipal();
    if ((password != null && !password.isEmpty()) || !correo.equals(user.getCorreo()))
      audit.registrar(
          actor,
          empresaId,
          null,
          "CREDENCIALES_ACTUALIZADAS",
          id,
          "Correo modificado="
              + !correo.equals(user.getCorreo())
              + ", contraseña restablecida="
              + (password != null && !password.isEmpty()));
  }

  private VisualizacionUsuario respuesta(com.alshagroup.alshafacturas.entity.Usuario u) {
    return new VisualizacionUsuario(
        u.getId(),
        u.getEmpresa().getId(),
        u.getNombre(),
        u.getCorreo(),
        u.getRol(),
        Boolean.TRUE.equals(u.getActivo()),
        u.getModalidad(),
        u.getTipoAtencion());
  }
}
