package com.alshagroup.alshafacturas;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SaludoController {

  @GetMapping("/api/saludo")
  public Map<String, String> saludar() {
    return Map.of("mensaje", "Bienvenido a ALSHAFACTURAS API");
  }
}
