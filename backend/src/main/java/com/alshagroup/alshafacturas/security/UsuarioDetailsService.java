
package com.alshagroup.alshafacturas.security;

import java.util.Locale;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.alshagroup.alshafacturas.entity.Usuario;
import com.alshagroup.alshafacturas.repository.UsuarioRepository;

@Service
public class UsuarioDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioDetailsService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username)
            throws UsernameNotFoundException {

        try {
            String[] partes = username.split(":", 2);

            if (partes.length != 2) {
                throw new IllegalArgumentException();
            }

            Long empresaId = Long.parseLong(partes[0]);

            String correo = partes[1]
                    .trim()
                    .toLowerCase(Locale.ROOT);

            Usuario usuario = usuarioRepository
                    .findByEmpresaIdAndCorreoAndActivoTrue(
                            empresaId,
                            correo
                    )
                    .orElseThrow(() -> new UsernameNotFoundException(
                            "Credenciales incorrectas"
                    ));

            return new UsuarioPrincipal(usuario);

        } catch (IllegalArgumentException e) {
            throw new UsernameNotFoundException(
                    "Credenciales incorrectas"
            );
        }
    }
}
