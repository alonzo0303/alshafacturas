package com.alshagroup.alshafacturas.security;

import com.alshagroup.alshafacturas.entity.Usuario;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

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
  private final List<String> permisos;
  private final String modalidad;
  private final String tipoAtencion;

  public String getModalidad() {
    return modalidad;
  }

  public String getTipoAtencion() {
    return tipoAtencion;
  }

  public UsuarioPrincipal(Usuario usuario) {
    this(
        usuario,
        com.alshagroup.alshafacturas.gestion.RolesService.predeterminados(usuario.getRol()));
  }

  public UsuarioPrincipal(Usuario usuario, List<String> permisos) {
    this.permisos = List.copyOf(permisos);
    this.modalidad = usuario.getModalidad();
    this.tipoAtencion = usuario.getTipoAtencion();
    this.id = usuario.getId();
    this.empresaId = usuario.getEmpresa().getId();
    this.nombre = usuario.getNombre();
    this.correo = usuario.getCorreo();
    this.passwordHash = usuario.getPasswordHash();
    this.rol = usuario.getRol();
    this.activo = Boolean.TRUE.equals(usuario.getActivo());
  }

  public List<String> getPermisos() {
    return permisos;
  }

  public String getRol() {
    return rol;
  }

  public Long getId() {
    return id;
  }

  public Long getEmpresaId() {
    return empresaId;
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    var authorities = new java.util.ArrayList<GrantedAuthority>();
    authorities.add(new SimpleGrantedAuthority("ROLE_" + rol));
    for (String permiso : permisos) authorities.add(new SimpleGrantedAuthority(permiso));
    return authorities;
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
