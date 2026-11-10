package com.alshagroup.alshafacturas.controller;

import com.alshagroup.alshafacturas.dto.*;
import com.alshagroup.alshafacturas.repository.*;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.core.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.*;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthenticationManager manager;
  private final SecurityContextRepository contexts;
  private final SessionAuthenticationStrategy sessions;
  private final EmpresaRepository empresas;
  private final UsuarioRepository users;

  public AuthController(
      AuthenticationManager m,
      SecurityContextRepository c,
      SessionAuthenticationStrategy s,
      EmpresaRepository e,
      UsuarioRepository u) {
    manager = m;
    contexts = c;
    sessions = s;
    empresas = e;
    users = u;
  }

  @GetMapping("/csrf")
  public CsrfToken csrf(CsrfToken token) {
    return token;
  }

  @GetMapping("/me")
  public LoginResponse me(@AuthenticationPrincipal UsuarioPrincipal p) {
    return response(p);
  }

  @PostMapping("/login")
  public LoginResponse login(
      @Valid @RequestBody LoginRequest r, HttpServletRequest req, HttpServletResponse res) {
    Long id = r.empresaId();
    if (r.ruc() != null)
      id = empresas.findByRuc(r.ruc()).map(e -> e.getId()).orElseThrow(() -> bad());
    if (id == null) throw bad();
    return authenticate(id, r, req, res, false);
  }

  @PostMapping("/admin/login")
  public LoginResponse admin(
      @Valid @RequestBody LoginRequest r, HttpServletRequest req, HttpServletResponse res) {
    var u =
        users
            .findByCorreoAndRolAndActivoTrue(
                r.correo().trim().toLowerCase(Locale.ROOT), "SUPERADMIN")
            .orElseThrow(() -> bad());
    return authenticate(u.getEmpresa().getId(), r, req, res, true);
  }

  private LoginResponse authenticate(
      Long id, LoginRequest r, HttpServletRequest req, HttpServletResponse res, boolean admin) {
    Authentication auth;
    try {
      auth =
          manager.authenticate(
              new UsernamePasswordAuthenticationToken(id + ":" + r.correo(), r.password()));
    } catch (AuthenticationException e) {
      throw bad();
    }
    var p = (UsuarioPrincipal) auth.getPrincipal();
    if (admin != "SUPERADMIN".equals(p.getRol())) throw bad();
    sessions.onAuthentication(auth, req, res);
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(auth);
    SecurityContextHolder.setContext(context);
    contexts.saveContext(context, req, res);
    return response(p);
  }

  private LoginResponse response(UsuarioPrincipal p) {
    return new LoginResponse(
        p.getId(), p.getEmpresaId(), p.getNombre(), p.getUsername(), p.getRol());
  }

  private ResponseStatusException bad() {
    return new ResponseStatusException(
        HttpStatus.UNAUTHORIZED, "Credenciales incorrectas o empresa sin acceso activo");
  }
}
