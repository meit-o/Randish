package com.example.restaurantroulette.enishi;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@Profile("enishi")
@RequestMapping("/api/enishi")
public class EnishiController {
  private final EnishiService service;
  private final EnishiEvents events;
  private final boolean secureCookie;
  public EnishiController(EnishiService service,EnishiEvents events,@Value("${enishi.secure-cookie:false}") boolean secureCookie) {
    this.service=service;this.events=events;this.secureCookie=secureCookie;
  }
  void cookie(HttpServletResponse response,String token,long seconds) {
    response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from("enishi_session",token).httpOnly(true).secure(secureCookie).sameSite("Strict").path("/api/enishi").maxAge(Duration.ofSeconds(seconds)).build().toString());
  }
  Map<String,Object> authenticated(Map<String,Object> result,HttpServletResponse response) {
    cookie(response,(String)result.remove("token"),7*86400); return result;
  }
  Map<String,Boolean> done() { events.refresh();return Map.of("ok",true); }
  @GetMapping("/config") public Map<String,Object> config() { return Map.of("demo",service.demo); }
  @PostMapping("/auth/register") public Map<String,Object> register(@RequestBody Map<String,Object> input,HttpServletResponse response) { return authenticated(service.register(input),response); }
  @PostMapping("/auth/login") public Map<String,Object> login(@RequestBody Map<String,Object> input,HttpServletResponse response) { return authenticated(service.login(input),response); }
  @PostMapping("/auth/logout") public Object logout(@CookieValue(name="enishi_session",defaultValue="") String token,HttpServletResponse response) { service.logout(token);cookie(response,"",0);return done(); }
  @GetMapping("/state") public Object state(@CookieValue(name="enishi_session",defaultValue="") String token) { return service.bootstrap(token); }
  @PatchMapping("/profile") public Object profile(@CookieValue(name="enishi_session",defaultValue="") String token,@RequestBody Map<String,Object> input) { var result=service.updateProfile(token,input);events.refresh();return result; }
  @DeleteMapping("/account") public Object account(@CookieValue(name="enishi_session",defaultValue="") String token,@RequestBody Map<String,Object> input,HttpServletResponse response) { service.deleteAccount(token,input);cookie(response,"",0);return done(); }
  @PostMapping("/favorites/{spot}") public Object favorite(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String spot,@RequestBody Map<String,Object> input) { service.favorite(token,spot,Boolean.TRUE.equals(input.get("value")));return done(); }
  @PostMapping("/visits") public Object checkin(@CookieValue(name="enishi_session",defaultValue="") String token,@RequestBody Map<String,Object> input) { var result=service.checkin(token,input);events.refresh();return result; }
  @PostMapping("/visits/checkout") public Object checkout(@CookieValue(name="enishi_session",defaultValue="") String token) { service.checkout(token);return done(); }
  @PostMapping("/demo/checkin") public Object demo(@CookieValue(name="enishi_session",defaultValue="") String token) { service.demoCheckin(token);return done(); }
  @PostMapping("/candidates/{other}/{action}") public Object intent(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String other,@PathVariable String action) {
    if(service.intent(token,other,action))events.refresh();else events.refreshUser(token);
    return Map.of("ok",true);
  }
  @DeleteMapping("/matches/{mid}") public Object unmatch(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String mid) { service.unmatch(token,mid);return done(); }
  @GetMapping("/matches/{mid}/messages") public Object messages(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String mid) { return service.messages(token,mid); }
  @PostMapping("/matches/{mid}/messages") public Object message(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String mid,@RequestBody Map<String,Object> input) { service.message(token,mid,input);return done(); }
  @GetMapping(value="/events",produces="text/event-stream") public SseEmitter events(@CookieValue(name="enishi_session",defaultValue="") String token) { return events.connect(token,null); }
  @GetMapping(value="/matches/{mid}/events",produces="text/event-stream") public SseEmitter chatEvents(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String mid) { return events.connect(token,mid); }
  @GetMapping("/letters") public Object letters(@CookieValue(name="enishi_session",defaultValue="") String token,@RequestParam(defaultValue="false") boolean mine) { return service.letters(token,mine); }
  @GetMapping("/replies/mine") public Object ownReplies(@CookieValue(name="enishi_session",defaultValue="") String token) { return service.ownReplies(token); }
  @PostMapping("/letters") public Object createLetter(@CookieValue(name="enishi_session",defaultValue="") String token,@RequestBody Map<String,Object> input) { service.createLetter(token,input);return done(); }
  @GetMapping("/letters/{lid}") public Object letter(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String lid) { return service.letter(token,lid); }
  @PostMapping("/letters/{lid}/replies") public Object reply(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String lid,@RequestBody Map<String,Object> input) { service.reply(token,lid,input);return done(); }
  @PostMapping("/letters/{lid}/reaction") public Object react(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String lid,@RequestBody Map<String,Object> input) { service.react(token,lid,Boolean.TRUE.equals(input.get("value")));return done(); }
  @DeleteMapping("/content/{type}/{id}") public Object deleteContent(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String type,@PathVariable String id) { service.deleteContent(token,type,id);return done(); }
  @PostMapping("/content/{type}/{id}/block-author") public Object blockContentAuthor(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String type,@PathVariable String id) { service.blockContentAuthor(token,type,id);return done(); }
  @GetMapping("/blocks") public Object blocks(@CookieValue(name="enishi_session",defaultValue="") String token) { return service.blocks(token); }
  @PostMapping("/blocks/{other}") public Object block(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String other,@RequestBody Map<String,Object> input) { service.block(token,other,Boolean.TRUE.equals(input.get("value")));return done(); }
  @PostMapping("/notifications/{nid}/read") public Object read(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String nid) { service.readNotification(token,nid);return done(); }
  @PostMapping("/reports") public Object report(@CookieValue(name="enishi_session",defaultValue="") String token,@RequestBody Map<String,Object> input) { service.report(token,input);return done(); }
  @GetMapping("/admin/reports") public Object reports(@CookieValue(name="enishi_session",defaultValue="") String token) { return service.reports(token); }
  @PatchMapping("/admin/reports/{rid}") public Object reportStatus(@CookieValue(name="enishi_session",defaultValue="") String token,@PathVariable String rid,@RequestBody Map<String,Object> input) { service.reportStatus(token,rid,Objects.toString(input.get("status"),""));return done(); }
}
