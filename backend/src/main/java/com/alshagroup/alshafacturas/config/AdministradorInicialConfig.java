
package com.alshagroup.alshafacturas.config;

import com.alshagroup.alshafacturas.dto.UsuarioRequest;
import com.alshagroup.alshafacturas.repository.UsuarioRepository;
import com.alshagroup.alshafacturas.service.UsuarioService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AdministradorInicialConfig {

    @Bean
    public ApplicationRunner crearAdministradorInicial(
            UsuarioRepository usuarioRepository,
            UsuarioService usuarioService,
            @Value("${APP_BOOTSTRAP_ADMIN_ENABLED:false}") boolean habilitado,
            @Value("${ADMIN_EMPRESA_ID:}") String empresaId,
            @Value("${ADMIN_NOMBRE:}") String nombre,
            @Value("${ADMIN_CORREO:}") String correo,
            @Value("${ADMIN_PASSWORD:}") String password
        ) {
        return args -> {

            if (!habilitado) {
                return;
            }

            if (empresaId.isBlank()
                    || nombre.isBlank()
                    || correo.isBlank()
                    || password.isBlank()) {
                throw new IllegalStateException(
                        "Faltan datos para crear el administrador inicial"
                );
            }

            Long id = Long.parseLong(empresaId);

            if (!usuarioRepository.findByEmpresaId(id).isEmpty()) {
                throw new IllegalStateException(
                        "La empresa ya tiene usuarios. "
                        + "No se permite crear otro administrador inicial."
                );
            }

            UsuarioRequest request = new UsuarioRequest(
                    id,
                    nombre,
                    correo,
                    password,
                    "ADMIN"
            );

            usuarioService.registrarUsuario(request);

            System.out.println(
                    "Administrador inicial creado correctamente."
            );
        };
    }
}
