package com.alshagroup.alshafacturas.security;

import com.alshagroup.alshafacturas.entity.Usuario;
import com.alshagroup.alshafacturas.repository.UsuarioRepository;
import java.util.Locale;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UsuarioDetailsService implements UserDetailsService {

  private final UsuarioRepository usuarioRepository;
  private final com.alshagroup.alshafacturas.gestion.RolesService roles;
  private final com.alshagroup.alshafacturas.gestion.PlanesService planes;

  public UsuarioDetailsService(
      UsuarioRepository usuarioRepository,
      com.alshagroup.alshafacturas.gestion.RolesService roles,
      com.alshagroup.alshafacturas.gestion.PlanesService planes) {
    this.usuarioRepository = usuarioRepository;
    this.roles = roles;
    this.planes = planes;
  }

  @Override
  public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {

    try {
      String[] partes = username.split(":", 2);

      if (partes.length != 2) {
        throw new IllegalArgumentException();
      }

      Long empresaId = Long.parseLong(partes[0]);

      String correo = partes[1].trim().toLowerCase(Locale.ROOT);

      Usuario usuario =
          usuarioRepository
              .findByEmpresaIdAndCorreoAndActivoTrue(empresaId, correo)
              .orElseThrow(() -> new UsernameNotFoundException("Credenciales incorrectas"));

      if (!"SUPERADMIN".equals(usuario.getRol())
          && usuario.getEmpresa().getEstado()
              != com.alshagroup.alshafacturas.entity.EstadoEmpresa.ACTIVA) {
        throw new UsernameNotFoundException("Credenciales incorrectas");
      }
      if (!"SUPERADMIN".equals(usuario.getRol())
          && !planes.permiteAcceso(empresaId, usuario.getId()))
        throw new UsernameNotFoundException("Cuenta sin cupo vigente");
      return new UsuarioPrincipal(usuario, roles.permisos(empresaId, usuario.getRol()));

    } catch (IllegalArgumentException e) {
      throw new UsernameNotFoundException("Credenciales incorrectas");
    }
  }
}
