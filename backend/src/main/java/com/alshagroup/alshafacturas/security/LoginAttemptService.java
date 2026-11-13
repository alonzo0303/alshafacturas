package com.alshagroup.alshafacturas.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class LoginAttemptService {
  private static class Bucket {
    int failed, inflight;
    long expires;

    Bucket(long e) {
      expires = e;
    }
  }

  private final Map<String, Bucket> limits = new HashMap<>();
  private final java.util.function.LongSupplier clock;

  public LoginAttemptService() {
    this(System::currentTimeMillis);
  }

  LoginAttemptService(java.util.function.LongSupplier clock) {
    this.clock = clock;
  }

  private String account(String correo) {
    try {
      return "a:"
          + HexFormat.of()
              .formatHex(
                  MessageDigest.getInstance("SHA-256")
                      .digest(
                          correo.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private int count(String key) {
    var b = limits.get(key);
    return b == null ? 0 : b.failed + b.inflight;
  }

  public synchronized boolean allowed(String ip, String correo) {
    long now = clock.getAsLong();
    limits.entrySet().removeIf(e -> e.getValue().expires < now && e.getValue().inflight == 0);
    String i = "i:" + ip, a = account(correo);
    if (limits.size() >= 10000 || count(i) >= 100 || count(a) >= 10) return false;
    limits.computeIfAbsent(i, k -> new Bucket(now + 900000)).inflight++;
    limits.computeIfAbsent(a, k -> new Bucket(now + 900000)).inflight++;
    return true;
  }

  public synchronized void complete(String ip, String correo, int status) {
    for (String key : List.of("i:" + ip, account(correo))) {
      var b = limits.get(key);
      if (b == null) continue;
      b.inflight = Math.max(0, b.inflight - 1);
      if (status == 401) b.failed++;
      else if (status == 200 && key.startsWith("a:")) b.failed = 0;
      if (b.failed == 0 && b.inflight == 0) limits.remove(key);
    }
  }

  public synchronized void clear(String correo) {
    var b = limits.get(account(correo));
    if (b != null) {
      b.failed = 0;
      if (b.inflight == 0) limits.remove(account(correo));
    }
  }
}
