
package com.alshagroup.alshafacturas.security;

import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.alshagroup.alshafacturas.entity.Usuario;

public class UsuarioPrincipal implements UserDetails {
    public String getNombre() {
    return nombre;
}

    private final Long id;
    private final Long empresaId;
    private final String nombre;
    private final String correo;
    private final String passwordHash;
    private final String rol;   
    private final boolean activo;

    public UsuarioPrincipal(Usuario usuario) {
        this.id = usuario.getId();
        this.empresaId = usuario.getEmpresa().getId();
        this.nombre = usuario.getNombre();
        this.correo = usuario.getCorreo();
        this.passwordHash = usuario.getPasswordHash();
        this.rol = usuario.getRol();
        this.activo = Boolean.TRUE.equals(usuario.getActivo());
    }

    public Long getId() {
        return id;
    }

    public Long getEmpresaId() {
        return empresaId;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(
            new SimpleGrantedAuthority("ROLE_" + rol)
        );
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return correo;
    }

    @Override
    public boolean isEnabled() {
        return activo;
    }
}
