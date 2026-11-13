package com.alshagroup.alshafacturas.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class LoginLimitFilter extends OncePerRequestFilter {
  private final LoginAttemptService attempts;
  private final tools.jackson.databind.json.JsonMapper json =
      tools.jackson.databind.json.JsonMapper.builder().build();

  public LoginLimitFilter(LoginAttemptService attempts) {
    this.attempts = attempts;
  }

  @Bean
  FilterRegistrationBean<LoginLimitFilter> loginLimitRegistration() {
    var r = new FilterRegistrationBean<>(this);
    r.setEnabled(false);
    return r;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    if (!"POST".equals(req.getMethod())
        || !Set.of("/api/auth/login", "/api/auth/admin/login", "/api/auth/negocios")
            .contains(req.getRequestURI())) {
      chain.doFilter(req, res);
      return;
    }
    byte[] body = req.getInputStream().readNBytes(8193);
    if (body.length > 8192) {
      error(res, 413, "Solicitud de acceso demasiado grande");
      return;
    }
    String correo;
    try {
      var data = json.readValue(body, Map.class);
      correo = Objects.toString(data.get("correo"), "");
    } catch (Exception e) {
      error(res, 400, "Revisa los datos de acceso");
      return;
    }
    String ip = req.getRemoteAddr();
    if (!attempts.allowed(ip, correo)) {
      res.setHeader("Retry-After", "900");
      error(
          res,
          429,
          "Demasiados intentos fallidos. Espera 15 minutos o solicita restablecer el acceso");
      return;
    }
    var wrapped =
        new HttpServletRequestWrapper(req) {
          @Override
          public ServletInputStream getInputStream() {
            var in = new ByteArrayInputStream(body);
            return new ServletInputStream() {
              public int read() {
                return in.read();
              }

              public boolean isFinished() {
                return in.available() == 0;
              }

              public boolean isReady() {
                return true;
              }

              public void setReadListener(ReadListener listener) {
                throw new UnsupportedOperationException("Solo lectura síncrona");
              }
            };
          }

          @Override
          public BufferedReader getReader() {
            return new BufferedReader(
                new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
          }
        };
    try {
      chain.doFilter(wrapped, res);
    } finally {
      attempts.complete(ip, correo, res.getStatus());
    }
  }

  private void error(HttpServletResponse res, int status, String message) throws IOException {
    res.setStatus(status);
    res.setContentType("application/json;charset=UTF-8");
    res.getWriter().write(json.writeValueAsString(Map.of("mensaje", message)));
  }
}
