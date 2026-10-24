
package com.alshagroup.alshafacturas.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.alshagroup.alshafacturas.entity.Usuario;
import com.alshagroup.alshafacturas.repository.UsuarioRepository;

import com.alshagroup.alshafacturas.dto.UsuarioResponse;


import org.springframework.security.crypto.password.PasswordEncoder;

import com.alshagroup.alshafacturas.dto.UsuarioRequest;
import com.alshagroup.alshafacturas.entity.Empresa;
import com.alshagroup.alshafacturas.repository.EmpresaRepository;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.alshagroup.alshafacturas.security.Rol;
import java.util.Locale;

@Service
public class UsuarioService {

private final UsuarioRepository usuarioRepository;
private final EmpresaRepository empresaRepository;
private final PasswordEncoder passwordEncoder;

public UsuarioService(
        UsuarioRepository usuarioRepository,
        EmpresaRepository empresaRepository,
        PasswordEncoder passwordEncoder
) {
    this.usuarioRepository = usuarioRepository;
    this.empresaRepository = empresaRepository;
    this.passwordEncoder = passwordEncoder;
}

    
public List<UsuarioResponse> listarPorEmpresa(Long empresaId) {

    return usuarioRepository.findByEmpresaId(empresaId)
            .stream()
            .map(usuario -> new UsuarioResponse(
                    usuario.getId(),
                    usuario.getEmpresa().getId(),
                    usuario.getNombre(),
                    usuario.getCorreo(),
                    usuario.getRol(),
                    usuario.getActivo()
            ))
            .toList();
}

public UsuarioResponse registrarUsuario(UsuarioRequest request) {
    String correoNormalizado = request.correo().trim().toLowerCase(java.util.Locale.ROOT);

    // 1. Verificar que la empresa exista
    Empresa empresa = empresaRepository.findById(request.empresaId())
            .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "La empresa no existe"
            ));

    // 2. Verificar que el correo no esté registrado
  
if (usuarioRepository.existsByEmpresaIdAndCorreo(
        empresa.getId(), correoNormalizado)) {

    throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "El correo ya está registrado en esta empresa"
    );
}

    // 3. Crear el usuario
    Usuario usuario = new Usuario();

    usuario.setEmpresa(empresa);
    
usuario.setNombre(request.nombre().trim());
usuario.setCorreo(correoNormalizado);

// Validar el rol del usuario

String rolTexto = request.rol().trim().toUpperCase(Locale.ROOT);

Rol rol;

try {
    rol = Rol.valueOf(rolTexto);
} catch (IllegalArgumentException e) {
    throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "El rol debe ser ADMIN o VENDEDOR"
    );
}

usuario.setRol(rol.name());

usuario.setActivo(true);

    // 4. Proteger la contraseña con BCrypt
    usuario.setPasswordHash(
            passwordEncoder.encode(request.password())
    );

    // 5. Guardar en PostgreSQL
    Usuario guardado = usuarioRepository.save(usuario);

    // 6. Devolver una respuesta sin contraseña
    return new UsuarioResponse(
            guardado.getId(),
            guardado.getEmpresa().getId(),
            guardado.getNombre(),
            guardado.getCorreo(),
            guardado.getRol(),
            guardado.getActivo()
    );
}

public UsuarioResponse registrarEmpleado(
        Long empresaIdAutenticada,
        UsuarioRequest request
) {

    if (empresaIdAutenticada == null) {
        throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "No se pudo identificar la empresa del usuario"
        );
    }

    UsuarioRequest solicitudSegura = new UsuarioRequest(
            empresaIdAutenticada,
            request.nombre(),
            request.correo(),
            request.password(),
            request.rol()
    );

    return registrarUsuario(solicitudSegura);
}

}
