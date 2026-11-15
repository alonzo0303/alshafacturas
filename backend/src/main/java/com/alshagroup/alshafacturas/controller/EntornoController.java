package com.alshagroup.alshafacturas.controller;

import com.alshagroup.alshafacturas.config.EntornoConfig;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
public class EntornoController {
  private final EntornoConfig entorno;

  public EntornoController(EntornoConfig entorno) {
    this.entorno = entorno;
  }

  @GetMapping("/api/entorno")
  public Map<String, Object> info() {
    return Map.of("entorno", entorno.nombre(), "cargaHabilitada", entorno.cargaHabilitada());
  }
}
