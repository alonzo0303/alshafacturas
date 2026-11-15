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
public class JsonSizeFilter extends OncePerRequestFilter {
  @Bean
  FilterRegistrationBean<JsonSizeFilter> jsonSizeRegistration() {
    var r = new FilterRegistrationBean<>(this);
    r.setEnabled(false);
    return r;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws IOException, ServletException {
    if (!req.getRequestURI().startsWith("/api/")
        || !Set.of("POST", "PUT", "PATCH", "DELETE").contains(req.getMethod())
        || !Objects.toString(req.getContentType(), "").toLowerCase(Locale.ROOT).contains("json")) {
      chain.doFilter(req, res);
      return;
    }
    if (req.getContentLengthLong() > 262144) {
      reject(res);
      return;
    }
    byte[] body = req.getInputStream().readNBytes(262145);
    if (body.length > 262144) {
      reject(res);
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
    chain.doFilter(wrapped, res);
  }

  private void reject(HttpServletResponse res) throws IOException {
    res.setStatus(413);
    res.setContentType("application/json;charset=UTF-8");
    res.getWriter().write("{\"mensaje\":\"La solicitud supera el límite de 256 KB\"}");
  }
}
