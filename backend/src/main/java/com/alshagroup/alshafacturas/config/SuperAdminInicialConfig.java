package com.alshagroup.alshafacturas.config;

import com.alshagroup.alshafacturas.entity.*;
import com.alshagroup.alshafacturas.repository.*;
import java.util.Locale;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration
public class SuperAdminInicialConfig {
  @Bean
  ApplicationRunner crearSuperAdmin(
      Environment env,
      EmpresaRepository empresas,
      UsuarioRepository users,
      PasswordEncoder encoder,
      TransactionTemplate tx) {
    return args -> {
      if (!env.getProperty("APP_BOOTSTRAP_SUPERADMIN_ENABLED", Boolean.class, false)) return;
      String correo = env.getRequiredProperty("SUPERADMIN_CORREO").trim().toLowerCase(Locale.ROOT);
      String password = env.getRequiredProperty("SUPERADMIN_PASSWORD");
      if (password.length() < 12
          || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72
          || !correo.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+"))
        throw new IllegalStateException(
            "Configura correo válido y contraseña SUPERADMIN de 12 a 72 caracteres");
      tx.executeWithoutResult(
          status -> {
            if (users.findByCorreoAndRolAndActivoTrue(correo, "SUPERADMIN").isPresent()) return;
            var empresa =
                empresas
                    .findByRuc("00000000000")
                    .orElseGet(
                        () -> {
                          var e = new Empresa();
                          e.setRuc("00000000000");
                          e.setRazonSocial("Alsha Group · Plataforma");
                          e.setEstado(EstadoEmpresa.ACTIVA);
                          return empresas.save(e);
                        });
            var u = new Usuario();
            u.setEmpresa(empresa);
            u.setNombre("Administrador de plataforma");
            u.setCorreo(correo);
            u.setPasswordHash(encoder.encode(password));
            u.setRol("SUPERADMIN");
            u.setActivo(true);
            users.save(u);
          });
    };
  }
}
