
package com.alshagroup.alshafacturas.service;

import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.alshagroup.alshafacturas.entity.Usuario;
import com.alshagroup.alshafacturas.repository.UsuarioRepository;

import com.alshagroup.alshafacturas.dto.LoginResponse;

@Service
public class AutenticacionService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public AutenticacionService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public LoginResponse verificarCredenciales(
            Long empresaId,
            String correo,
            String password
    ) {

        if (empresaId == null || correo == null || password == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Credenciales incorrectas"
            );
        }

        String correoNormalizado =
                correo.trim().toLowerCase(Locale.ROOT);

        Usuario usuario = usuarioRepository
                .findByEmpresaIdAndCorreoAndActivoTrue(
                        empresaId,
                        correoNormalizado
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Credenciales incorrectas"
                ));

        if (!passwordEncoder.matches(
                password,
                usuario.getPasswordHash()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Credenciales incorrectas"
            );
        }

       
return new LoginResponse(
        usuario.getId(),
        usuario.getEmpresa().getId(),
        usuario.getNombre(),
        usuario.getCorreo(),
        usuario.getRol()
);

    }
}
