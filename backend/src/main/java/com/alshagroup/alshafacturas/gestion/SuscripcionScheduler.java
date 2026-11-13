package com.alshagroup.alshafacturas.gestion;

import java.time.Clock;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.*;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
public class SuscripcionScheduler {
  private final PlanesService planes;
  private final JdbcTemplate db;

  public SuscripcionScheduler(PlanesService p, JdbcTemplate d) {
    planes = p;
    db = d;
  }

  @Bean
  public static Clock subscriptionClock() {
    return Clock.system(PlanesService.ZONA);
  }

  @Scheduled(cron = "${app.suscripciones.cron:0 5 0 * * *}", zone = "America/Lima")
  @EventListener(ApplicationReadyEvent.class)
  public void revisar() {
    for (Long id :
        db.queryForList(
            "SELECT id FROM empresas WHERE ruc IS DISTINCT FROM '00000000000' ORDER BY id",
            Long.class)) planes.revisarEmpresa(id, planes.hoy());
  }
}
