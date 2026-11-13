package com.alshagroup.alshafacturas.exception;

import java.util.Map;

public class MembresiaException extends RuntimeException {
  private final Map<String, Object> datos;

  public MembresiaException(Map<String, Object> datos) {
    super(datos.get("mensaje").toString());
    this.datos = datos;
  }

  public Map<String, Object> datos() {
    return datos;
  }
}
