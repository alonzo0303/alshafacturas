package com.alshagroup.alshafacturas.security;

import static org.junit.jupiter.api.Assertions.*;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class LoginAttemptServiceTests {
  @Test
  void parallelAttemptsAreBoundedAndResetUnlocks() throws Exception {
    var service = new LoginAttemptService();
    var pool = Executors.newFixedThreadPool(20);
    try {
      var start = new CountDownLatch(1);
      var results = new java.util.ArrayList<Future<Boolean>>();
      for (int i = 0; i < 20; i++)
        results.add(
            pool.submit(
                () -> {
                  start.await();
                  return service.allowed("127.0.0.1", "account@test.local");
                }));
      start.countDown();
      int allowed = 0;
      for (var r : results) if (r.get()) allowed++;
      assertEquals(10, allowed);
      for (int i = 0; i < 10; i++) service.complete("127.0.0.1", "account@test.local", 401);
      assertFalse(service.allowed("127.0.0.1", "account@test.local"));
      service.clear("account@test.local");
      assertTrue(service.allowed("127.0.0.1", "account@test.local"));
      service.complete("127.0.0.1", "account@test.local", 200);
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void failedWindowExpiresWithoutPermanentLock() {
    var clock = new AtomicLong(1000);
    var service = new LoginAttemptService(clock::get);
    for (int i = 0; i < 10; i++) {
      assertTrue(service.allowed("ip", "account"));
      service.complete("ip", "account", 401);
    }
    assertFalse(service.allowed("ip", "account"));
    clock.addAndGet(900001);
    assertTrue(service.allowed("ip", "account"));
    service.complete("ip", "account", 200);
  }
}
