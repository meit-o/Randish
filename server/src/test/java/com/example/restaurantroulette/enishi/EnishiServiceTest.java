package com.example.restaurantroulette.enishi;

import static org.assertj.core.api.Assertions.*;
import com.example.restaurantroulette.service.PasswordHashService;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.embedded.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import com.example.restaurantroulette.controller.ApiExceptionHandler;
import jakarta.servlet.http.Cookie;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EnishiServiceTest {
  EmbeddedDatabase database;
  JdbcTemplate db;
  EnishiService app;
  MutableClock clock;
  String a,b,c,aid,bid,cid;
  static class MutableClock extends Clock {
    Instant instant=Instant.parse("2026-11-01T03:00:00Z");
    public ZoneId getZone(){return ZoneOffset.UTC;}
    public Clock withZone(ZoneId zone){return Clock.fixed(instant,zone);}
    public Instant instant(){return instant;}
    void advance(long millis){instant=instant.plusMillis(millis);}
    void at(String value){instant=Instant.parse(value);}
  }
  @BeforeEach void setup(){
    database=new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2).addScript("enishi-schema.sql").build();
    db=new JdbcTemplate(database);clock=new MutableClock();
    app=new EnishiService(db,new TransactionTemplate(new DataSourceTransactionManager(database)),clock,new PasswordHashService(),150,4,false);
    app.seed();
    var ua=app.register(Map.of("email","a@test.example","password","Password12345!","nickname","A"));
    var ub=app.register(Map.of("email","b@test.example","password","Password12345!","nickname","B"));
    var uc=app.register(Map.of("email","c@test.example","password","Password12345!","nickname","C"));
    a=(String)ua.get("token");b=(String)ub.get("token");c=(String)uc.get("token");
    aid=(String)((Map<?,?>)ua.get("user")).get("id");bid=(String)((Map<?,?>)ub.get("user")).get("id");cid=(String)((Map<?,?>)uc.get("user")).get("id");
  }
  @AfterEach void close(){database.shutdown();}
  Map<String,Object> location(String spot){var s=app.one("SELECT * FROM enishi_spots WHERE id=?",spot);return Map.of("spotId",spot,"lat",s.get("lat"),"lng",s.get("lng"));}
  void enter(String... users){for(String u:users)app.checkin(u,location("spot-library"));}
  long encounters(){return db.queryForObject("SELECT COUNT(*) FROM enishi_encounters",Long.class);}
  void qualify(){for(int i=0;i<3;i++){enter(a,b);clock.advance(300000);app.checkout(a);app.checkout(b);clock.advance(86400000-300000);}}
  String match(){qualify();app.intent(a,bid,"select");app.intent(b,aid,"select");return (String)app.activeMatch(aid,bid).get("id");}
  String letter(String token){app.createLetter(token,Map.of("body","おすすめの本を教えてください","anonymous",true));return (String)app.letters(token,true).getFirst().get("id");}

  @Test void duplicateCheckinsAndConcurrentTabsHaveOneActiveSpot() throws Exception {
    var executor=Executors.newFixedThreadPool(2);
    try {
      var first=executor.submit(()->{try{app.checkin(a,location("spot-library"));return true;}catch(ResponseStatusException e){return false;}});
      var second=executor.submit(()->{try{app.checkin(a,location("spot-cafe"));return true;}catch(ResponseStatusException e){return false;}});
      assertThat(List.of(first.get(),second.get())).containsExactlyInAnyOrder(true,false);
      assertThat(db.queryForObject("SELECT COUNT(*) FROM enishi_active_visits WHERE user_id=?",Long.class,aid)).isEqualTo(1);
      String spot=(String)app.currentVisit(aid).get("spot_id");app.checkin(a,location(spot));
      assertThat(db.queryForObject("SELECT COUNT(*) FROM enishi_visits WHERE user_id=?",Long.class,aid)).isEqualTo(1);
    }finally{executor.shutdownNow();}
  }
  @Test void fiveMinutesWhilePresentIsRecordedOncePerTokyoDay(){
    enter(a,b);clock.advance(299999);app.sweep();assertThat(encounters()).isZero();
    clock.advance(1);app.sweep();assertThat(encounters()).isEqualTo(1);
    app.sweep();app.checkout(a);app.checkout(b);enter(a,b);clock.advance(300000);app.checkout(b);
    assertThat(encounters()).isEqualTo(1);
    assertThat(app.bootstrap(a).toString()).doesNotContain("a_start","b_start","encounter_day","otherVisit");
  }
  @Test void disconnectedShortOverlapsDoNotAccumulate(){
    enter(a,b);clock.advance(180000);app.checkout(b);clock.advance(60000);enter(b);clock.advance(180000);app.checkout(b);assertThat(encounters()).isZero();
  }
  @Test void midnightRequiresFiveMinutesWithinEachSeparateDay(){
    clock.at("2026-11-01T14:57:00Z");enter(a,b);clock.advance(6*60000);app.sweep();assertThat(encounters()).isZero();
    clock.advance(2*60000);app.sweep();assertThat(encounters()).isEqualTo(1);
    assertThat(app.one("SELECT encounter_day FROM enishi_encounters").get("encounter_day")).isEqualTo("2026-11-02");
  }
  @Test void overlapWithFiveMinutesOnBothSidesOfMidnightCountsBothDays(){
    clock.at("2026-11-01T14:55:00Z");enter(a,b);clock.advance(10*60000);app.sweep();assertThat(encounters()).isEqualTo(2);
  }
  @Test void expiredVisitEndsAtConfiguredTimeAndCannotAccumulateLater(){
    enter(a);clock.advance(4*3600000L);app.sweep();assertThat(app.currentVisit(aid)).isNull();
    assertThat(app.one("SELECT ended_at,expires_at FROM enishi_visits").get("ended_at")).isEqualTo(app.one("SELECT expires_at FROM enishi_visits").get("expires_at"));
    enter(b);clock.advance(300000);app.sweep();assertThat(encounters()).isZero();
  }
  @Test void distanceAndInvalidCoordinatesAreRejected(){
    assertThatThrownBy(()->app.checkin(a,Map.of("spotId","spot-library","lat",0,"lng",0))).isInstanceOf(ResponseStatusException.class);
    assertThatThrownBy(()->app.checkin(a,Map.of("spotId","spot-library","lat",Double.NaN,"lng",139))).isInstanceOf(ResponseStatusException.class);
    assertThat(app.currentVisit(aid)).isNull();
  }
  @Test void candidatesOnlyAfterThreeDaysAndPerSpot(){
    enter(a,b);clock.advance(300000);app.checkout(a);app.checkout(b);assertThat(app.candidates(aid)).isEmpty();
    clock.advance(86400000);for(String token:List.of(a,b))app.checkin(token,location("spot-cafe"));clock.advance(300000);app.checkout(a);app.checkout(b);
    assertThat(app.candidates(aid)).isEmpty();
    for(int i=0;i<2;i++){clock.advance(86400000);enter(a,b);clock.advance(300000);app.checkout(a);app.checkout(b);}
    assertThat(app.candidates(aid)).hasSize(1);
    app.sweep();assertThat(app.notifications(aid)).filteredOn(n->n.get("kind").equals("eligible")).hasSize(1);
  }
  @Test void unilateralConsentAndHideArePrivateAndMutualConsentUnlocksChat(){
    qualify();var before=app.notifications(bid);var candidateBefore=app.candidates(bid);
    app.intent(a,bid,"select");assertThat(app.notifications(bid)).isEqualTo(before);assertThat(app.candidates(bid)).isEqualTo(candidateBefore);assertThat(app.matches(aid)).isEmpty();
    app.intent(a,bid,"cancel");app.intent(a,bid,"hide");assertThat(app.notifications(bid)).isEqualTo(before);assertThat(app.candidates(bid)).isEqualTo(candidateBefore);
    app.intent(a,bid,"restore");app.intent(a,bid,"select");app.intent(b,aid,"select");
    String mid=(String)app.activeMatch(aid,bid).get("id");
    assertThat(app.messages(a,mid)).isEmpty();app.message(a,mid,Map.of("body","こんにちは","clientId","test-1"));
    app.message(a,mid,Map.of("body","こんにちは","clientId","test-1"));assertThat(app.messages(b,mid)).hasSize(1);
    assertThatThrownBy(()->app.messages(c,mid)).isInstanceOf(ResponseStatusException.class);
    assertThat(app.notifications(bid)).filteredOn(n->n.get("kind").equals("matched")).hasSize(1);
  }
  @Test void unmatchRevokesExistingChatAndRematchNeedsFreshBothConsents(){
    String mid=match();app.message(a,mid,Map.of("body","old","clientId","old"));assertThat(app.streamAllowed(a,mid)).isTrue();
    app.unmatch(a,mid);assertThat(app.streamAllowed(a,mid)).isFalse();
    assertThatThrownBy(()->app.messages(b,mid)).isInstanceOf(ResponseStatusException.class);
    assertThatThrownBy(()->app.message(b,mid,Map.of("body","no","clientId","no"))).isInstanceOf(ResponseStatusException.class);
    app.intent(a,bid,"select");assertThat(app.matches(aid)).isEmpty();app.intent(b,aid,"select");assertThat(app.matches(aid)).hasSize(1);
    assertThat(app.messages(b,mid)).isEmpty();
  }
  @Test void lettersRequirePresenceButAuthorsRetainThreadAfterLeavingAndExpiry(){
    enter(a,b);String lid=letter(a);app.reply(b,lid,Map.of("body","私も読みたいです"));app.react(b,lid,true);
    assertThat(app.letter(b,lid).toString()).doesNotContain(aid);assertThat(app.letter(b,lid).get("reactions")).isEqualTo(1L);
    app.checkout(b);assertThatThrownBy(()->app.letter(b,lid)).isInstanceOf(ResponseStatusException.class);
    app.checkout(a);assertThat((List<?>)app.letter(a,lid).get("replies")).hasSize(1);
    assertThatThrownBy(()->app.reply(a,lid,Map.of("body","返事"))).isInstanceOf(ResponseStatusException.class);
    clock.advance(EnishiService.WEEK+1);var login=app.login(Map.of("email","a@test.example","password","Password12345!"));a=(String)login.get("token");
    assertThat((List<?>)app.letter(a,lid).get("replies")).hasSize(1);
    b=(String)app.login(Map.of("email","b@test.example","password","Password12345!")).get("token");enter(b);
    assertThatThrownBy(()->app.letter(b,lid)).isInstanceOf(ResponseStatusException.class);
  }
  @Test void letterActionsDoNotAffectEncountersAndDeleteHidesThread(){
    enter(a,b);String lid=letter(a);app.reply(b,lid,Map.of("body","返事"));app.react(b,lid,true);assertThat(encounters()).isZero();
    assertThatThrownBy(()->app.reply(b,lid,Map.of("body","あ".repeat(201)))).isInstanceOf(ResponseStatusException.class);
    app.deleteContent(a,"letter",lid);assertThatThrownBy(()->app.letter(a,lid)).isInstanceOf(ResponseStatusException.class);assertThat(app.letters(b,false)).isEmpty();
  }
  @Test void blocksHideBothDirectionsAndRevokeChatAndUnblockDoesNotRestoreMatch(){
    String mid=match();enter(a,b);String la=letter(a),lb=letter(b);app.block(a,bid,true);
    assertThat(app.streamAllowed(b,mid)).isFalse();assertThat(app.candidates(aid)).isEmpty();assertThat(app.candidates(bid)).isEmpty();
    assertThat(app.letters(a,false)).extracting(l->l.get("id")).containsExactly(la);assertThat(app.letters(b,false)).extracting(l->l.get("id")).containsExactly(lb);
    assertThatThrownBy(()->app.letter(b,la)).isInstanceOf(ResponseStatusException.class);
    app.block(a,bid,false);assertThat(app.matches(aid)).isEmpty();app.intent(a,bid,"select");assertThat(app.matches(aid)).isEmpty();app.intent(b,aid,"select");assertThat(app.matches(aid)).hasSize(1);
  }
  @Test void reportsAreStoredAndOnlyAdminCanManageThem(){
    enter(a,b);String lid=letter(a);app.report(b,Map.of("type","letter","targetId",lid,"reason","確認してください"));
    assertThatThrownBy(()->app.reports(b)).isInstanceOf(ResponseStatusException.class);
    db.update("UPDATE enishi_users SET is_admin=TRUE WHERE id=?",cid);var reports=app.reports(c);assertThat(reports).hasSize(1);
    assertThat(reports.getFirst()).containsKeys("snapshot","created_at","status","target_id","reason");
    String rid=(String)reports.getFirst().get("id");app.reportStatus(c,rid,"reviewing");assertThat(app.reports(c).getFirst().get("status")).isEqualTo("reviewing");
  }
  @Test void deletingAnAccountAndLogoutRevokeEverySession(){
    String mid=match();String second=(String)app.login(Map.of("email","a@test.example","password","Password12345!")).get("token");
    app.logout(a);assertThatThrownBy(()->app.bootstrap(a)).isInstanceOf(ResponseStatusException.class);assertThat(app.bootstrap(second)).isNotNull();
    app.deleteAccount(second,Map.of("password","Password12345!"));assertThatThrownBy(()->app.bootstrap(second)).isInstanceOf(ResponseStatusException.class);assertThat(app.streamAllowed(b,mid)).isFalse();assertThat(app.candidates(bid)).isEmpty();
  }
  @Test void httpCookiesCsrfAndLiveStreamsAreRevokedAtUnmatchAndBlock() throws Exception {
    var events=new EnishiEvents(app);
    var mvc=MockMvcBuilders.standaloneSetup(new EnishiController(app,events,false))
        .setControllerAdvice(new ApiExceptionHandler()).addFilters(new EnishiRequestFilter()).build();
    mvc.perform(post("/api/enishi/auth/login").contentType("application/json").content("{\"email\":\"a@test.example\",\"password\":\"Password12345!\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(post("/api/enishi/auth/login").header("X-Enishi-Request","1").contentType("application/json").content("{\"email\":\"a@test.example\",\"password\":\"Password12345!\"}"))
        .andExpect(status().isOk()).andExpect(header().string("Set-Cookie",org.hamcrest.Matchers.allOf(org.hamcrest.Matchers.containsString("HttpOnly"),org.hamcrest.Matchers.containsString("SameSite=Strict"))));
    mvc.perform(get("/api/enishi/state")).andExpect(status().isUnauthorized());
    String mid=match();
    var stream=mvc.perform(get("/api/enishi/matches/"+mid+"/events").cookie(new Cookie("enishi_session",b)))
        .andExpect(request().asyncStarted()).andReturn();
    assertThat(stream.getResponse().getContentAsString()).contains("event:refresh").doesNotContain("body");
    mvc.perform(delete("/api/enishi/matches/"+mid).cookie(new Cookie("enishi_session",a)).header("X-Enishi-Request","1")).andExpect(status().isOk());
    assertThat(stream.getAsyncResult(1000)).isNull();assertThat(stream.getResponse().getContentAsString()).contains("event:revoked");
    mvc.perform(get("/api/enishi/matches/"+mid+"/messages").cookie(new Cookie("enishi_session",b))).andExpect(status().isForbidden());
    mvc.perform(post("/api/enishi/matches/"+mid+"/messages").cookie(new Cookie("enishi_session",b)).header("X-Enishi-Request","1").contentType("application/json").content("{\"body\":\"denied\",\"clientId\":\"denied\"}"))
        .andExpect(status().isForbidden());
    app.intent(a,bid,"select");app.intent(b,aid,"select");
    var second=mvc.perform(get("/api/enishi/matches/"+mid+"/events").cookie(new Cookie("enishi_session",a))).andExpect(request().asyncStarted()).andReturn();
    mvc.perform(post("/api/enishi/blocks/"+aid).cookie(new Cookie("enishi_session",b)).header("X-Enishi-Request","1").contentType("application/json").content("{\"value\":true}"))
        .andExpect(status().isOk());
    assertThat(second.getAsyncResult(1000)).isNull();assertThat(second.getResponse().getContentAsString()).contains("event:revoked");
  }
  @Test void ownReplyCanBeDeletedAfterCheckoutWithoutRevealingSomeoneElsesLetter(){
    enter(a,b);String lid=letter(a);app.reply(b,lid,Map.of("body","自分の返信"));app.checkout(b);
    var replies=app.ownReplies(b);assertThat(replies).hasSize(1);assertThat(replies.getFirst()).containsOnlyKeys("id","body","created_at");
    app.deleteContent(b,"reply",(String)replies.getFirst().get("id"));assertThat(app.ownReplies(b)).isEmpty();
  }
  @Test void anonymousLetterAuthorCanBeBlockedWithoutExposingIdentityOrPreciseTimes(){
    enter(a,b);String lid=letter(a);
    var publicView=app.letter(b,lid);assertThat(((Map<?,?>)publicView.get("author")).containsKey("id")).isFalse();
    assertThat(((Map<?,?>)publicView.get("author")).containsKey("bio")).isFalse();
    assertThat(publicView.get("created_at")).isEqualTo(EnishiService.dayOnly(clock.millis()));
    app.blockContentAuthor(b,"letter",lid);assertThat(app.letters(b,false)).isEmpty();assertThat(app.blocked(aid,bid)).isTrue();
    assertThat(app.blocks(b).getFirst().get("nickname")).isEqualTo("匿名の投稿者");assertThat(app.blocks(b).toString()).doesNotContain(aid);
    app.block(b,(String)app.blocks(b).getFirst().get("id"),false);assertThat(app.blocked(aid,bid)).isFalse();
  }
  @Test void demoSeedUsesOneGenerationEvenWhenClockAdvancesBetweenInserts(){
    Clock ticking=new Clock(){
      final java.util.concurrent.atomic.AtomicLong millis=new java.util.concurrent.atomic.AtomicLong(Instant.parse("2026-11-22T03:00:00Z").toEpochMilli());
      public ZoneId getZone(){return ZoneOffset.UTC;}
      public Clock withZone(ZoneId zone){return Clock.fixed(instant(),zone);}
      public Instant instant(){return Instant.ofEpochMilli(millis.getAndIncrement());}
    };
    var demoApp=new EnishiService(db,app.tx,ticking,new PasswordHashService(),150,4,true);demoApp.seed();
    String token=(String)demoApp.login(Map.of("email","aoi@enishi.example","password","EnishiDemo2026!")).get("token");
    String mid=(String)demoApp.activeMatch("demo-aoi","demo-nagi").get("id");assertThat(demoApp.messages(token,mid)).hasSize(1);
  }
  @Test void unilateralIntentAndDismissalDoNotEmitAnEventToTheOtherUser() throws Exception {
    qualify();var events=new EnishiEvents(app);
    var mvc=MockMvcBuilders.standaloneSetup(new EnishiController(app,events,false)).build();
    var stream=mvc.perform(get("/api/enishi/events").cookie(new Cookie("enishi_session",b))).andExpect(request().asyncStarted()).andReturn();
    String before=stream.getResponse().getContentAsString();
    for(String action:List.of("select","cancel","hide","restore")) {
      mvc.perform(post("/api/enishi/candidates/"+bid+"/"+action).cookie(new Cookie("enishi_session",a))).andExpect(status().isOk());
      assertThat(stream.getResponse().getContentAsString()).isEqualTo(before);
    }
  }
}
