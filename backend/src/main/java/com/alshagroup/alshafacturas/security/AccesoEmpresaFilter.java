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

  public AccesoEmpresaFilter(UsuarioRepository users) {
    this.users = users;
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
              && user.getRol().equals(principal.getRol())
              && user.getEmpresa().getId().equals(principal.getEmpresaId())
              && ("SUPERADMIN".equals(user.getRol())
                  || user.getEmpresa().getEstado() == EstadoEmpresa.ACTIVA);
      if (!allowed) {
        SecurityContextHolder.clearContext();
        var session = req.getSession(false);
        if (session != null) session.invalidate();
        res.setStatus(403);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"mensaje\":\"La cuenta o la empresa no tiene acceso activo\"}");
        return;
      }
    }
    chain.doFilter(req, res);
  }
}
