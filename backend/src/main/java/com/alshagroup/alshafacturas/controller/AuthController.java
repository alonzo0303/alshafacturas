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
  private final com.alshagroup.alshafacturas.gestion.LocalesService locales;

  public AuthController(
      AuthenticationManager m,
      SecurityContextRepository c,
      SessionAuthenticationStrategy s,
      EmpresaRepository e,
      UsuarioRepository u,
      com.alshagroup.alshafacturas.gestion.LocalesService locales) {
    manager = m;
    contexts = c;
    sessions = s;
    empresas = e;
    users = u;
    this.locales = locales;
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
    if (r.ruc() != null && !r.ruc().isBlank())
      id = empresas.findByRuc(r.ruc()).map(e -> e.getId()).orElseThrow(() -> bad());
    if (id != null) return authenticate(id, r, req, res, false);
    Authentication selected = null;
    for (var user : users.findByCorreoAndActivoTrue(r.correo().trim().toLowerCase(Locale.ROOT))) {
      if ("SUPERADMIN".equals(user.getRol())) continue;
      Authentication candidate;
      try {
        candidate =
            manager.authenticate(
                new UsernamePasswordAuthenticationToken(
                    user.getEmpresa().getId() + ":" + r.correo(), r.password()));
      } catch (AuthenticationException e) {
        continue;
      }
      if (selected != null)
        throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "El correo coincide con varias cuentas. Indica el código de negocio o RUC para"
                + " ingresar");
      selected = candidate;
    }
    if (selected == null) throw bad();
    return establish(selected, req, res);
  }

  @PostMapping("/negocios")
  public java.util.List<java.util.Map<String, Object>> negocios(
      @Valid @RequestBody LoginRequest r) {
    var matches = new java.util.ArrayList<java.util.Map<String, Object>>();
    for (var u : users.findByCorreoAndActivoTrue(r.correo().trim().toLowerCase(Locale.ROOT))) {
      if ("SUPERADMIN".equals(u.getRol())) continue;
      try {
        manager.authenticate(
            new UsernamePasswordAuthenticationToken(
                u.getEmpresa().getId() + ":" + r.correo(), r.password()));
        matches.add(
            java.util.Map.of(
                "id", u.getEmpresa().getId(), "nombre", u.getEmpresa().getRazonSocial()));
      } catch (AuthenticationException ignored) {
      }
    }
    if (matches.isEmpty()) throw bad();
    return matches;
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
    return establish(auth, req, res);
  }

  private LoginResponse establish(
      Authentication auth, HttpServletRequest req, HttpServletResponse res) {
    var p = (UsuarioPrincipal) auth.getPrincipal();
    locales.seleccionar(p, null);
    sessions.onAuthentication(auth, req, res);
    req.getSession().setAttribute("localId", p.getLocalId());
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(auth);
    SecurityContextHolder.setContext(context);
    contexts.saveContext(context, req, res);
    return response(p);
  }

  private LoginResponse response(UsuarioPrincipal p) {
    return new LoginResponse(
        p.getId(),
        p.getEmpresaId(),
        p.getNombre(),
        p.getUsername(),
        p.getRol(),
        p.getPermisos(),
        p.getModalidad(),
        p.getTipoAtencion(),
        p.getLocalId(),
        p.getLocalNombre());
  }

  private ResponseStatusException bad() {
    return new ResponseStatusException(
        HttpStatus.UNAUTHORIZED, "Credenciales incorrectas o empresa sin acceso activo");
  }
}
