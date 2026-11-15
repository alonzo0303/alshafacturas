package com.alshagroup.alshafacturas.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Entity
@org.hibernate.annotations.DynamicUpdate
@Table(name = "empresas")
public class Empresa {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Pattern(regexp = "^[0-9]{11}$", message = "El RUC debe contener exactamente 11 digitos")
  @Column(length = 11, unique = true)
  private String ruc;

  @NotBlank(message = "La razon social es obligatoria")
  @Size(max = 200, message = "La razon social no puede superar los 200 caracteres")
  @Column(nullable = false, length = 200)
  private String razonSocial;

  @Column(length = 255)
  private String direccion;

  @Enumerated(EnumType.STRING)
  @Column(name = "estado", nullable = false)
  private EstadoEmpresa estado = EstadoEmpresa.PENDIENTE;

  @Column(name = "afectacion_default", nullable = false)
  private String afectacionDefault = "GRAVADO";

  @Column(name = "rubro_negocio", length = 100)
  private String rubroNegocio;

  @Column(name = "modalidad_visual", nullable = false)
  private String modalidadVisual = "COMERCIO";

  @Column(name = "tipo_visual")
  private String tipoVisual;

  @Column(name = "color_visual")
  private String colorVisual;

  @Column(name = "diseno_visual", nullable = false)
  private String disenoVisual = "AMPLIO";

  @Column(name = "version_visual", nullable = false)
  private long versionVisual;

  @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.ARRAY)
  @Column(name = "modulos_visuales", columnDefinition = "text[]")
  private String[] modulosVisuales;

  @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.ARRAY)
  @Column(name = "orden_visual", columnDefinition = "text[]")
  private String[] ordenVisual;

  public String getModalidadVisual() {
    return modalidadVisual;
  }

  public String getTipoVisual() {
    return tipoVisual;
  }

  public String getColorVisual() {
    return colorVisual;
  }

  public String getDisenoVisual() {
    return disenoVisual;
  }

  public long getVersionVisual() {
    return versionVisual;
  }

  public java.util.List<String> getModulosVisuales() {
    return com.alshagroup.alshafacturas.visual.Modulos.lista(modulosVisuales);
  }

  public java.util.List<String> getOrdenVisual() {
    return com.alshagroup.alshafacturas.visual.Modulos.lista(ordenVisual);
  }

  public String getRubroNegocio() {
    return rubroNegocio;
  }

  public void setRubroNegocio(String value) {
    rubroNegocio = value;
  }

  public void habilitarRuc() {
    if ("SIN_IGV".equals(afectacionDefault)) afectacionDefault = "GRAVADO";
  }

  public Empresa() {}

  public Long getId() {
    return id;
  }

  public String getRuc() {
    return ruc;
  }

  public void setRuc(String ruc) {
    this.ruc = ruc == null || ruc.isBlank() ? null : ruc.trim();
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
