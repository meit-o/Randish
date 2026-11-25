package com.example.restaurantroulette.enishi;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Streams contain invalidations only. Message bodies always require a fresh authorization. */
@Component
@Profile("enishi")
public class EnishiEvents {
  private record Connection(String token,String userId,String match,SseEmitter emitter) {}
  private final ConcurrentHashMap<SseEmitter,Connection> connections=new ConcurrentHashMap<>();
  private final EnishiService service;
  public EnishiEvents(EnishiService service) { this.service=service; }
  public SseEmitter connect(String token,String match) {
    String userId=service.as(token,uid -> { if(match!=null) service.chatAccess(uid,match); return uid; });
    SseEmitter emitter=new SseEmitter(3_600_000L);
    connections.put(emitter,new Connection(token,userId,match,emitter));
    emitter.onCompletion(() -> connections.remove(emitter));
    emitter.onTimeout(() -> { connections.remove(emitter); emitter.complete(); });
    emitter.onError(e -> connections.remove(emitter));
    send(connections.get(emitter)); return emitter;
  }
  @Scheduled(fixedDelay=10_000) public void tick() { service.sweep(); refresh(); }
  public void refresh() { connections.values().forEach(this::send); }
  public void refreshUser(String token) {
    String uid=service.locked(()->service.auth(token));
    connections.values().stream().filter(c->c.userId().equals(uid)).forEach(this::send);
  }
  private void send(Connection c) {
    try {
      boolean allowed=service.locked(() -> {
        String uid=service.auth(c.token());
        if(c.match()!=null) service.chatAccess(uid,c.match());
        return true;
      });
      if(allowed) c.emitter().send(SseEmitter.event().name("refresh").data("{}"));
    } catch(Exception e) {
      connections.remove(c.emitter());
      try { c.emitter().send(SseEmitter.event().name("revoked").data("{}")); } catch(IOException ignored) {}
      c.emitter().complete();
    }
  }
}
