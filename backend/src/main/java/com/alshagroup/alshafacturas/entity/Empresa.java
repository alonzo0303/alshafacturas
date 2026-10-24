
package com.alshagroup.alshafacturas.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "empresas")
public class Empresa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

   
@NotBlank(message = "El RUC es obligatorio")
@Pattern(
    regexp = "^[0-9]{11}$",
    message = "El RUC debe contener exactamente 11 digitos"
)
@Column(nullable = false, length = 11, unique = true)
private String ruc;

@NotBlank(message = "La razon social es obligatoria")
@Size(
    max = 200,
    message = "La razon social no puede superar los 200 caracteres"
)
@Column(nullable = false, length = 200)
private String razonSocial;


    @Column(length = 255)
    private String direccion;
    @Enumerated(EnumType.STRING)
@Column(name = "estado", nullable = false)
private EstadoEmpresa estado = EstadoEmpresa.PENDIENTE;

    public Empresa() {
    }

    public Long getId() {
        return id;
    }

    public String getRuc() {
        return ruc;
    }

    public void setRuc(String ruc) {
        this.ruc = ruc;
    }

    public String getRazonSocial() {
        return razonSocial;
    }

    public void setRazonSocial(String razonSocial) {
        this.razonSocial = razonSocial;
    }

    public String getDireccion() {
        return direccion;
    }

    public void setDireccion(String direccion) {
        this.direccion = direccion;
    }
    public EstadoEmpresa getEstado() {
    return estado;
}

public void setEstado(EstadoEmpresa estado) {
    this.estado = estado;
}
}
