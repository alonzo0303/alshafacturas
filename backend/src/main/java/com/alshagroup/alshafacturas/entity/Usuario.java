
package com.alshagroup.alshafacturas.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_id", nullable = false)
    private Empresa empresa;

    @Column(nullable = false, length = 150)
    private String nombre;

    @Column(nullable = false, length = 150)
    private String correo;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 30)
    private String rol;

    @Column(nullable = false)
    private Boolean activo = true;

    public Usuario() {
    }
    
public Long getId() {
    return id;
}

public void setId(Long id) {
    this.id = id;
}

public Empresa getEmpresa() {
    return empresa;
}

public void setEmpresa(Empresa empresa) {
    this.empresa = empresa;
}

public String getNombre() {
    return nombre;
}

public void setNombre(String nombre) {
    this.nombre = nombre;
}

public String getCorreo() {
    return correo;
}

public void setCorreo(String correo) {
    this.correo = correo;
}

public String getPasswordHash() {
    return passwordHash;
}

public void setPasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
}

public String getRol() {
    return rol;
}

public void setRol(String rol) {
    this.rol = rol;
}

public Boolean getActivo() {
    return activo;
}

public void setActivo(Boolean activo) {
    this.activo = activo;
}

}
