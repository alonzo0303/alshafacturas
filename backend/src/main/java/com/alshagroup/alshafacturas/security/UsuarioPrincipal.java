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

  private Long localId;
  private String localNombre;
  private long credencialesVersion;

  public Long getLocalId() {
    return localId;
  }

  public String getLocalNombre() {
    return localNombre;
  }

  public long getCredencialesVersion() {
    return credencialesVersion;
  }

  public void seleccionarLocal(Long id, String nombre) {
    localId = id;
    localNombre = nombre;
  }

  private final Long id;
  private final Long empresaId;
  private final String nombre;
  private final String correo;
  private final String passwordHash;
  private final String rol;
  private final boolean activo;
  private List<String> permisos;
  private final List<String> permisosBase;
  private final String modalidad;
  private final String tipoAtencion;

  private final String colorPrimario, diseno;
  private final long aparienciaVersion;
  private final List<String> modulosVisibles, ordenModulos;

  public String getColorPrimario() {
    return colorPrimario;
  }

  public String getDiseno() {
    return diseno;
  }

  public long getAparienciaVersion() {
    return aparienciaVersion;
  }

  public List<String> getModulosVisibles() {
    return modulosVisibles;
  }

  public List<String> getOrdenModulos() {
    return ordenModulos;
  }

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
    var empresa = usuario.getEmpresa();
    this.permisos =
        permisos.stream()
            .filter(
                permiso ->
                    empresa
                        .getModulosVisuales()
                        .contains(com.alshagroup.alshafacturas.visual.Modulos.dePermiso(permiso)))
            .toList();
    this.permisosBase = this.permisos;
    this.colorPrimario = empresa.getColorVisual();
    this.diseno = empresa.getDisenoVisual();
    this.aparienciaVersion = empresa.getVersionVisual();
    this.modulosVisibles = empresa.getModulosVisuales();
    this.ordenModulos = empresa.getOrdenVisual();
    this.modalidad = usuario.getEmpresa().getModalidadVisual();
    this.tipoAtencion = usuario.getEmpresa().getTipoVisual();
    this.id = usuario.getId();
    this.credencialesVersion = usuario.getCredencialesVersion();
    this.empresaId = usuario.getEmpresa().getId();
    this.nombre = usuario.getNombre();
    this.correo = usuario.getCorreo();
    this.passwordHash = usuario.getPasswordHash();
    this.rol = usuario.getRol();
    this.activo = Boolean.TRUE.equals(usuario.getActivo());
  }

  public void configurarCaja(Boolean habilitada) {
    if (habilitada == null) {
      permisos = permisosBase;
      return;
    }
    var next = new java.util.ArrayList<>(permisosBase);
    next.remove("CAJA_GESTIONAR");
    if (habilitada && modulosVisibles.contains("CAJA")) next.add("CAJA_GESTIONAR");
    permisos = List.copyOf(next);
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
