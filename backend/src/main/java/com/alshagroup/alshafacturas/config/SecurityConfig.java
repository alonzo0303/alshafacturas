
package com.alshagroup.alshafacturas.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.alshagroup.alshafacturas.security.UsuarioDetailsService;

import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;

import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {


@Bean
public SessionAuthenticationStrategy sessionAuthenticationStrategy() {
    return new ChangeSessionIdAuthenticationStrategy();
}


@Bean
public SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        SecurityContextRepository securityContextRepository
) throws Exception {

   http
    .csrf(csrf -> csrf
        .csrfTokenRepository(
            CookieCsrfTokenRepository.withHttpOnlyFalse()
        )
    )
    

.authorizeHttpRequests(auth -> auth
    .requestMatchers("/error").permitAll()

    .requestMatchers(
        org.springframework.http.HttpMethod.GET,
        "/api/auth/csrf"
    ).permitAll()

    .requestMatchers(
        org.springframework.http.HttpMethod.POST,
        "/api/auth/login"
    ).permitAll()

    .anyRequest().authenticated()
)

        .securityContext(context -> context
            .securityContextRepository(securityContextRepository)
        )
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
        )
        .httpBasic(basic -> {});

    return http.build();
}


@Bean
public SecurityContextRepository securityContextRepository() {
    return new HttpSessionSecurityContextRepository();
}

    
@Bean
public DaoAuthenticationProvider authenticationProvider(
        UsuarioDetailsService usuarioDetailsService,
        PasswordEncoder passwordEncoder
) {
    DaoAuthenticationProvider provider =
            new DaoAuthenticationProvider(usuarioDetailsService);

    provider.setPasswordEncoder(passwordEncoder);

    return provider;
}

@Bean
public AuthenticationManager authenticationManager(
        AuthenticationConfiguration configuration
) throws Exception {
    return configuration.getAuthenticationManager();
}

}
