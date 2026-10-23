
package com.alshagroup.alshafacturas.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alshagroup.alshafacturas.service.AutenticacionService;

import org.springframework.security.authentication.AuthenticationManager;


import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import jakarta.validation.Valid;

import com.alshagroup.alshafacturas.dto.LoginRequest;
import com.alshagroup.alshafacturas.dto.LoginResponse;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;


import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;


@RestController
@RequestMapping("/api/auth")
public class AuthController {

    
private final AutenticacionService autenticacionService;
private final AuthenticationManager authenticationManager;

private final SecurityContextRepository securityContextRepository;
private final SessionAuthenticationStrategy sessionAuthenticationStrategy;



public AuthController(
        AutenticacionService autenticacionService,
        AuthenticationManager authenticationManager,
        SecurityContextRepository securityContextRepository,
        SessionAuthenticationStrategy sessionAuthenticationStrategy
) {
    this.autenticacionService = autenticacionService;
    this.authenticationManager = authenticationManager;
    this.securityContextRepository = securityContextRepository;
 
    this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
}

// NUEVO: Endpoint para obtener el token CSRF
@GetMapping("/csrf")
public CsrfToken obtenerCsrf(CsrfToken csrfToken) {
    return csrfToken;
}

// Método de login que ya teníamos
@PostMapping("/login")


public ResponseEntity<LoginResponse> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse httpResponse
) {


    String identificador = request.empresaId()
            + ":"
            + request.correo();

    Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                    identificador,
                    request.password()
            )
    );
    
sessionAuthenticationStrategy.onAuthentication(
        authentication,
        httpRequest,
        httpResponse
);

SecurityContext securityContext =
        SecurityContextHolder.createEmptyContext();

securityContext.setAuthentication(authentication);

SecurityContextHolder.setContext(securityContext);

securityContextRepository.saveContext(
        securityContext,
        httpRequest,
        httpResponse
);


    UsuarioPrincipal usuario =
            (UsuarioPrincipal) authentication.getPrincipal();

LoginResponse respuesta = new LoginResponse(
        usuario.getId(),
        usuario.getEmpresaId(),
        usuario.getNombre(),
        usuario.getUsername(),
            authentication.getAuthorities()
                    .iterator()
                    .next()
                    .getAuthority()
                    .replace("ROLE_", "")
    );

    return ResponseEntity.ok(respuesta);
}


}
