package com.alshagroup.alshafacturas.security;

import com.alshagroup.alshafacturas.entity.EstadoEmpresa;
import com.alshagroup.alshafacturas.repository.UsuarioRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AccesoEmpresaFilter extends OncePerRequestFilter {
  private final UsuarioRepository users;
  private final com.alshagroup.alshafacturas.gestion.RolesService roles;
  private final com.alshagroup.alshafacturas.gestion.PlanesService planes;

  public AccesoEmpresaFilter(
      UsuarioRepository users,
      com.alshagroup.alshafacturas.gestion.RolesService roles,
      com.alshagroup.alshafacturas.gestion.PlanesService planes) {
    this.users = users;
    this.roles = roles;
    this.planes = planes;
  }

  // Only run inside the security chain, after the session has been loaded.
  @Bean
  FilterRegistrationBean<AccesoEmpresaFilter> accesoRegistration() {
    var bean = new FilterRegistrationBean<>(this);
    bean.setEnabled(false);
    return bean;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof UsuarioPrincipal principal) {
      var user = users.findById(principal.getId()).orElse(null);
      boolean allowed =
          user != null
              && Boolean.TRUE.equals(user.getActivo())
              && user.getEmpresa().getId().equals(principal.getEmpresaId())
              && ("SUPERADMIN".equals(user.getRol())
                  || (user.getEmpresa().getEstado() == EstadoEmpresa.ACTIVA
                      && planes.permiteAcceso(user.getEmpresa().getId(), user.getId())));
      if (!allowed) {
        SecurityContextHolder.clearContext();
        var session = req.getSession(false);
        if (session != null) session.invalidate();
        res.setStatus(403);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter()
            .write(
                "{\"codigo\":\"SESION_REVOCADA\",\"mensaje\":\"La cuenta, empresa o plan no tiene"
                    + " acceso activo\"}");
        return;
      }
      var refreshed =
          new UsuarioPrincipal(user, roles.permisos(user.getEmpresa().getId(), user.getRol()));
      SecurityContextHolder.getContext()
          .setAuthentication(
              new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                  refreshed, null, refreshed.getAuthorities()));
    }
    chain.doFilter(req, res);
  }
}
