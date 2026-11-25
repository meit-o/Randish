package com.example.restaurantroulette.enishi;

import com.example.restaurantroulette.service.PasswordHashService;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** All decisions run under a database row lock, including across server instances. */
@Service
@Profile("enishi")
public class EnishiService {
  static final ZoneId TOKYO = ZoneId.of("Asia/Tokyo");
  static final long FIVE_MINUTES = 300_000, WEEK = 7 * 86_400_000L;
  final JdbcTemplate db;
  final TransactionTemplate tx;
  final Clock clock;
  final PasswordHashService passwords;
  final double radius;
  final long duration;
  final boolean demo;

  public EnishiService(JdbcTemplate db, TransactionTemplate tx, Clock clock, PasswordHashService passwords,
      @Value("${enishi.checkin-radius-meters:150}") double radius,
      @Value("${enishi.visit-hours:4}") long hours,
      @Value("${enishi.demo.enabled:false}") boolean demo) {
    this.db=db; this.tx=tx; this.clock=clock; this.passwords=passwords;
    if (radius <= 0 || hours <= 0) throw new IllegalArgumentException("Invalid ENISHI configuration");
    this.radius=radius; this.duration=hours*3_600_000L; this.demo=demo;
  }
  long now() { return clock.millis(); }
  static long dayOnly(long timestamp) { return Instant.ofEpochMilli(timestamp).atZone(TOKYO).toLocalDate().atStartOfDay(TOKYO).toInstant().toEpochMilli(); }
  static String id() { return UUID.randomUUID().toString(); }
  static Map<String,Object> map(Object... pairs) {
    Map<String,Object> result=new LinkedHashMap<>();
    for(int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
    return result;
  }
  static String str(Map<String,Object> row,String key) { return Objects.toString(row.get(key),""); }
  static long num(Map<String,Object> row,String key) { return ((Number)row.get(key)).longValue(); }
  static boolean yes(Map<String,Object> row,String key) { return Boolean.TRUE.equals(row.get(key)); }
  static ResponseStatusException error(HttpStatus status,String text) { return new ResponseStatusException(status,text); }
  static String text(Map<String,Object> data,String key,int max,boolean required) {
    String value=Objects.toString(data.get(key),"").strip();
    if ((required && value.isEmpty()) || value.codePointCount(0,value.length())>max)
      throw error(HttpStatus.BAD_REQUEST,key+"は"+max+"文字以内で入力してください。");
    return value;
  }
  List<Map<String,Object>> rows(String sql,Object... args) { return db.queryForList(sql,args); }
  Map<String,Object> one(String sql,Object... args) {
    var list=rows(sql,args); if(list.isEmpty()) throw error(HttpStatus.NOT_FOUND,"対象が見つかりません。"); return list.getFirst();
  }
  boolean exists(String sql,Object... args) { return !rows(sql,args).isEmpty(); }
  <T> T locked(Supplier<T> action) {
    return tx.execute(status -> { db.queryForObject("SELECT id FROM enishi_lock WHERE id=1 FOR UPDATE",Integer.class); return action.get(); });
  }
  <T> T as(String token,java.util.function.Function<String,T> action) {
    // Commit expiration even when the requested operation is denied.
    sweep();
    return locked(() -> action.apply(auth(token)));
  }
  String auth(String token) {
    var session=rows("SELECT s.user_id FROM enishi_sessions s JOIN enishi_users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.deleted=FALSE",digest(token),now());
    if(session.isEmpty()) throw error(HttpStatus.UNAUTHORIZED,"ログインし直してください。");
    return str(session.getFirst(),"user_id");
  }
  static String digest(String value) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Objects.toString(value,"").getBytes(StandardCharsets.UTF_8))); }
    catch(Exception e) { throw new IllegalStateException(e); }
  }
  Map<String,Object> profile(String uid) { return one("SELECT id,nickname,bio,avatar FROM enishi_users WHERE id=? AND deleted=FALSE",uid); }
  Map<String,Object> displayAuthor(String uid) { return one("SELECT nickname,avatar FROM enishi_users WHERE id=? AND deleted=FALSE",uid); }

  public Map<String,Object> register(Map<String,Object> input) {
    return locked(() -> {
      String email=text(input,"email",254,true).toLowerCase(Locale.ROOT);
      String password=text(input,"password",128,true), nickname=text(input,"nickname",30,true);
      if(!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") || password.length()<10)
        throw error(HttpStatus.BAD_REQUEST,"有効なメールアドレスと10文字以上のパスワードを入力してください。");
      if(exists("SELECT id FROM enishi_users WHERE email=?",email)) throw error(HttpStatus.CONFLICT,"このメールアドレスは登録済みです。");
      String uid=id(); var secret=passwords.hash(password);
      db.update("INSERT INTO enishi_users(id,email,password_hash,salt,nickname) VALUES(?,?,?,?,?)",uid,email,secret.hash(),secret.salt(),nickname);
      return session(uid);
    });
  }
  public Map<String,Object> login(Map<String,Object> input) {
    return locked(() -> {
      String email=text(input,"email",254,true).toLowerCase(Locale.ROOT), password=text(input,"password",128,true);
      var users=rows("SELECT * FROM enishi_users WHERE email=? AND deleted=FALSE",email);
      if(users.isEmpty() || !passwords.matches(password,str(users.getFirst(),"password_hash"),str(users.getFirst(),"salt")))
        throw error(HttpStatus.UNAUTHORIZED,"メールアドレスまたはパスワードを確認してください。");
      return session(str(users.getFirst(),"id"));
    });
  }
  Map<String,Object> session(String uid) {
    String raw=id()+id();
    db.update("INSERT INTO enishi_sessions(token,user_id,expires_at) VALUES(?,?,?)",digest(raw),uid,now()+7*86_400_000L);
    return map("token",raw,"user",profile(uid));
  }
  public void logout(String token) { locked(() -> db.update("DELETE FROM enishi_sessions WHERE token=?",digest(token))); }
  public Map<String,Object> updateProfile(String token,Map<String,Object> input) {
    return as(token,uid -> {
      String avatar=text(input,"avatar",600_000,false);
      if(!avatar.isEmpty() && !avatar.matches("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$"))
        throw error(HttpStatus.BAD_REQUEST,"画像はPNG、JPEG、WebPでアップロードしてください。");
      db.update("UPDATE enishi_users SET nickname=?,bio=?,avatar=? WHERE id=?",text(input,"nickname",30,true),text(input,"bio",300,false),avatar,uid);
      return profile(uid);
    });
  }
  public void deleteAccount(String token,Map<String,Object> input) {
    as(token,uid -> {
      var user=one("SELECT * FROM enishi_users WHERE id=?",uid);
      if(!passwords.matches(text(input,"password",128,true),str(user,"password_hash"),str(user,"salt"))) throw error(HttpStatus.UNAUTHORIZED,"パスワードを確認してください。");
      checkoutInternal(uid); 
      for(var m:rows("SELECT * FROM enishi_matches WHERE pair_a=? OR pair_b=?",uid,uid)) endMatch(m);
      db.update("UPDATE enishi_letters SET deleted=TRUE,body='' WHERE author_id=?",uid);
      db.update("UPDATE enishi_replies SET deleted=TRUE,body='' WHERE author_id=?",uid);
      db.update("DELETE FROM enishi_sessions WHERE user_id=?",uid);
      db.update("DELETE FROM enishi_favorites WHERE user_id=?",uid);
      db.update("DELETE FROM enishi_reactions WHERE user_id=?",uid);
      db.update("DELETE FROM enishi_notifications WHERE user_id=?",uid);
      db.update("UPDATE enishi_messages SET body='退会したユーザーのメッセージ' WHERE sender_id=?",uid);
      db.update("UPDATE enishi_intents SET selected=FALSE WHERE user_id=? OR other_id=?",uid,uid);
      db.update("DELETE FROM enishi_encounters WHERE pair_a=? OR pair_b=?",uid,uid);
      db.update("DELETE FROM enishi_visits WHERE user_id=?",uid);
      db.update("UPDATE enishi_users SET email=?,password_hash='',salt='',nickname='退会済み',bio='',avatar='',deleted=TRUE WHERE id=?","deleted-"+uid,uid);
      return null;
    });
  }
  public Map<String,Object> bootstrap(String token) {
    return as(token,uid -> map("user",map("id",uid,"email",one("SELECT email FROM enishi_users WHERE id=?",uid).get("email"),"nickname",profile(uid).get("nickname"),"bio",profile(uid).get("bio"),"avatar",profile(uid).get("avatar"),"admin",admin(uid)),
      "visit",currentVisit(uid),"spots",spots(uid),"candidates",candidates(uid),"matches",matches(uid),
      "notifications",notifications(uid),"config",map("radiusMeters",radius,"visitHours",duration/3_600_000,"demo",demo)));
  }
  List<Map<String,Object>> spots(String uid) {
    var spots=rows("SELECT * FROM enishi_spots ORDER BY CASE WHEN id='spot-library' THEN 0 ELSE 1 END,id");
    for(var spot:spots) spot.put("favorite",exists("SELECT spot_id FROM enishi_favorites WHERE user_id=? AND spot_id=?",uid,spot.get("id")));
    return spots;
  }
  public void favorite(String token,String spot,boolean value) { as(token,uid -> {
    one("SELECT id FROM enishi_spots WHERE id=?",spot);
    db.update("DELETE FROM enishi_favorites WHERE user_id=? AND spot_id=?",uid,spot);
    if(value) db.update("INSERT INTO enishi_favorites(user_id,spot_id) VALUES(?,?)",uid,spot); return null;
  }); }
  Map<String,Object> currentVisit(String uid) {
    var found=rows("SELECT v.id,v.spot_id,v.started_at,v.expires_at,s.name FROM enishi_active_visits a JOIN enishi_visits v ON v.id=a.visit_id JOIN enishi_spots s ON s.id=v.spot_id WHERE a.user_id=?",uid);
    return found.isEmpty()?null:found.getFirst();
  }
  public Map<String,Object> checkin(String token,Map<String,Object> input) {
    return as(token,uid -> {
      String spot=text(input,"spotId",36,true); var place=one("SELECT * FROM enishi_spots WHERE id=?",spot);
      double lat=coordinate(input,"lat",-90,90), lng=coordinate(input,"lng",-180,180);
      if(distance(lat,lng,((Number)place.get("lat")).doubleValue(),((Number)place.get("lng")).doubleValue())>radius)
        throw error(HttpStatus.BAD_REQUEST,"スポットの半径"+(int)radius+"m以内で再度お試しください。位置情報の精度も確認してください。");
      var active=currentVisit(uid);
      if(active!=null) {
        if(str(active,"spot_id").equals(spot)) return active;
        throw error(HttpStatus.CONFLICT,"現在のスポットをチェックアウトしてからお試しください。");
      }
      startVisit(uid,spot,now(),now()+duration); return currentVisit(uid);
    });
  }
  static double coordinate(Map<String,Object> input,String key,double min,double max) {
    Object raw=input.get(key);
    if(!(raw instanceof Number)) throw error(HttpStatus.BAD_REQUEST,"位置情報を取得し直してください。");
    double value=((Number)raw).doubleValue();
    if(!Double.isFinite(value)||value<min||value>max) throw error(HttpStatus.BAD_REQUEST,"位置情報が無効です。"); return value;
  }
  static double distance(double lat1,double lon1,double lat2,double lon2) {
    double a=Math.pow(Math.sin(Math.toRadians(lat2-lat1)/2),2)+Math.cos(Math.toRadians(lat1))*Math.cos(Math.toRadians(lat2))*Math.pow(Math.sin(Math.toRadians(lon2-lon1)/2),2);
    return 6_371_000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  void startVisit(String uid,String spot,long start,long expiry) {
    String vid=id(); db.update("INSERT INTO enishi_visits(id,user_id,spot_id,started_at,expires_at) VALUES(?,?,?,?,?)",vid,uid,spot,start,expiry);
    db.update("INSERT INTO enishi_active_visits(user_id,visit_id) VALUES(?,?)",uid,vid);
  }
  public void checkout(String token) { as(token,uid -> { checkoutInternal(uid); detect(); return null; }); }
  void checkoutInternal(String uid) {
    var active=currentVisit(uid); if(active==null) return;
    db.update("UPDATE enishi_visits SET ended_at=? WHERE id=?",Math.min(now(),num(active,"expires_at")),active.get("id"));
    db.update("DELETE FROM enishi_active_visits WHERE user_id=?",uid);
  }
  public void sweep() { locked(() -> {
    db.update("UPDATE enishi_visits SET ended_at=expires_at WHERE ended_at IS NULL AND expires_at<=?",now());
    db.update("DELETE FROM enishi_active_visits WHERE visit_id IN (SELECT id FROM enishi_visits WHERE ended_at IS NOT NULL)");
    detect(); db.update("DELETE FROM enishi_sessions WHERE expires_at<=?",now()); return null;
  }); }
  void detect() {
    var overlaps=rows("SELECT a.user_id AS pair_a,b.user_id AS pair_b,a.spot_id,a.started_at AS a_start,b.started_at AS b_start,COALESCE(a.ended_at,a.expires_at) AS a_end,COALESCE(b.ended_at,b.expires_at) AS b_end FROM enishi_visits a JOIN enishi_visits b ON a.spot_id=b.spot_id AND a.user_id<b.user_id AND a.started_at<COALESCE(b.ended_at,b.expires_at) AND b.started_at<COALESCE(a.ended_at,a.expires_at)");
    for(var overlap:overlaps) {
      String a=str(overlap,"pair_a"),b=str(overlap,"pair_b"),spot=str(overlap,"spot_id");
      if(blocked(a,b)) continue;
      long start=Math.max(num(overlap,"a_start"),num(overlap,"b_start"));
      long end=Math.min(now(),Math.min(num(overlap,"a_end"),num(overlap,"b_end")));
      for(LocalDate day=Instant.ofEpochMilli(start).atZone(TOKYO).toLocalDate();day.atStartOfDay(TOKYO).toInstant().toEpochMilli()<end;day=day.plusDays(1)) {
        long dayStart=day.atStartOfDay(TOKYO).toInstant().toEpochMilli(), dayEnd=day.plusDays(1).atStartOfDay(TOKYO).toInstant().toEpochMilli();
        if(Math.min(end,dayEnd)-Math.max(start,dayStart)<FIVE_MINUTES) continue;
        if(exists("SELECT pair_a FROM enishi_encounters WHERE pair_a=? AND pair_b=? AND spot_id=? AND encounter_day=?",a,b,spot,day.toString())) continue;
        db.update("INSERT INTO enishi_encounters(pair_a,pair_b,spot_id,encounter_day) VALUES(?,?,?,?)",a,b,spot,day.toString());
        if(count(a,b,spot)==3) {
          String name=str(one("SELECT name FROM enishi_spots WHERE id=?",spot),"name");
          for(String uid:List.of(a,b)) notify(uid,"eligible","新しい縁の候補が見つかりました",name+"で重なったご縁。プロフィールを見てみましょう。",uid.equals(a)?b:a,"eligible:"+a+":"+b+":"+spot);
        }
      }
    }
  }
  long count(String a,String b,String spot) { return db.queryForObject("SELECT COUNT(*) FROM enishi_encounters WHERE pair_a=? AND pair_b=? AND spot_id=?",Long.class,a,b,spot); }
  boolean blocked(String a,String b) { return exists("SELECT user_id FROM enishi_blocks WHERE (user_id=? AND other_id=?) OR (user_id=? AND other_id=?)",a,b,b,a); }
  List<Map<String,Object>> common(String uid,String other) {
    String a=uid.compareTo(other)<0?uid:other,b=uid.compareTo(other)<0?other:uid;
    return rows("SELECT s.id,s.name,COUNT(*) AS encounters FROM enishi_encounters e JOIN enishi_spots s ON s.id=e.spot_id WHERE e.pair_a=? AND e.pair_b=? GROUP BY s.id,s.name HAVING COUNT(*)>=3",a,b);
  }
  List<Map<String,Object>> candidates(String uid) {
    var users=rows("SELECT DISTINCT CASE WHEN pair_a=? THEN pair_b ELSE pair_a END AS other_id FROM enishi_encounters WHERE pair_a=? OR pair_b=?",uid,uid,uid);
    List<Map<String,Object>> result=new ArrayList<>();
    for(var user:users) {
      String other=str(user,"other_id"); var places=common(uid,other);
      if(places.isEmpty()||blocked(uid,other)||exists("SELECT id FROM enishi_users WHERE id=? AND deleted=TRUE",other)||activeMatch(uid,other)!=null) continue;
      var intent=rows("SELECT selected,hidden FROM enishi_intents WHERE user_id=? AND other_id=?",uid,other);
      result.add(map("profile",profile(other),"spots",places,"selected",!intent.isEmpty()&&yes(intent.getFirst(),"selected"),"hidden",!intent.isEmpty()&&yes(intent.getFirst(),"hidden")));
    } return result;
  }
  Map<String,Object> activeMatch(String uid,String other) {
    var result=rows("SELECT * FROM enishi_matches WHERE active=TRUE AND ((pair_a=? AND pair_b=?) OR (pair_a=? AND pair_b=?))",uid,other,other,uid);
    return result.isEmpty()?null:result.getFirst();
  }
  public boolean intent(String token,String other,String action) { return as(token,uid -> {
    if(uid.equals(other)||blocked(uid,other)||common(uid,other).isEmpty()) throw error(HttpStatus.FORBIDDEN,"この候補は選択できません。");
    profile(other);
    if(!List.of("select","cancel","hide","restore").contains(action)) throw error(HttpStatus.BAD_REQUEST,"操作が無効です。");
    if(!exists("SELECT user_id FROM enishi_intents WHERE user_id=? AND other_id=?",uid,other)) db.update("INSERT INTO enishi_intents(user_id,other_id) VALUES(?,?)",uid,other);
    if(action.equals("select")||action.equals("cancel")) db.update("UPDATE enishi_intents SET selected=? WHERE user_id=? AND other_id=?",action.equals("select"),uid,other);
    else db.update("UPDATE enishi_intents SET hidden=?,selected=FALSE WHERE user_id=? AND other_id=?",action.equals("hide"),uid,other);
    if(exists("SELECT user_id FROM enishi_intents WHERE user_id=? AND other_id=? AND selected=TRUE",uid,other) && exists("SELECT user_id FROM enishi_intents WHERE user_id=? AND other_id=? AND selected=TRUE",other,uid) && activeMatch(uid,other)==null) {
      String a=uid.compareTo(other)<0?uid:other,b=uid.compareTo(other)<0?other:uid;
      var old=rows("SELECT * FROM enishi_matches WHERE pair_a=? AND pair_b=?",a,b);
      String mid=old.isEmpty()?id():str(old.getFirst(),"id");
      long generation=old.isEmpty()?now():Math.max(now(),num(old.getFirst(),"created_at")+1);
      if(old.isEmpty()) db.update("INSERT INTO enishi_matches(id,pair_a,pair_b,created_at) VALUES(?,?,?,?)",mid,a,b,generation);
      else db.update("UPDATE enishi_matches SET active=TRUE,created_at=? WHERE id=?",generation,mid);
      for(String u:List.of(a,b)) notify(u,"matched","縁が結ばれました","お互いの気持ちが重なりました。チャットでごあいさつを。",mid,"match:"+mid+":"+generation);
      return true;
    } return false;
  }); }
  List<Map<String,Object>> matches(String uid) {
    var result=rows("SELECT id,pair_a,pair_b,created_at FROM enishi_matches WHERE active=TRUE AND (pair_a=? OR pair_b=?) ORDER BY created_at DESC",uid,uid);
    for(var match:result) {
      String other=uid.equals(match.get("pair_a"))?str(match,"pair_b"):str(match,"pair_a");
      match.put("profile",profile(other)); match.put("spots",common(uid,other)); match.remove("pair_a");match.remove("pair_b");
    } return result;
  }
  Map<String,Object> chatAccess(String uid,String mid) {
    var m=one("SELECT * FROM enishi_matches WHERE id=?",mid);
    if(!yes(m,"active")||(!uid.equals(m.get("pair_a"))&&!uid.equals(m.get("pair_b")))||blocked(str(m,"pair_a"),str(m,"pair_b"))) throw error(HttpStatus.FORBIDDEN,"このチャットの利用は終了しています。");
    return m;
  }
  public void unmatch(String token,String mid) { as(token,uid -> { endMatch(chatAccess(uid,mid)); return null; }); }
  void endMatch(Map<String,Object> m) {
    db.update("UPDATE enishi_matches SET active=FALSE WHERE id=?",m.get("id"));
    db.update("UPDATE enishi_intents SET selected=FALSE WHERE (user_id=? AND other_id=?) OR (user_id=? AND other_id=?)",m.get("pair_a"),m.get("pair_b"),m.get("pair_b"),m.get("pair_a"));
    // Old messages cannot become visible through a later matching generation.
    db.update("DELETE FROM enishi_notifications WHERE target_id=? AND kind IN ('matched','message')",m.get("id"));
  }
  public List<Map<String,Object>> messages(String token,String mid) { return as(token,uid -> {
    var m=chatAccess(uid,mid);
    return rows("SELECT id,sender_id,body,created_at FROM enishi_messages WHERE match_id=? AND generation=? ORDER BY created_at,id",mid,m.get("created_at"));
  }); }
  public void message(String token,String mid,Map<String,Object> input) { as(token,uid -> {
    var m=chatAccess(uid,mid); String clientId=text(input,"clientId",80,true), body=text(input,"body",1000,true);
    if(exists("SELECT id FROM enishi_messages WHERE match_id=? AND sender_id=? AND client_id=?",mid,uid,clientId)) return null;
    String messageId=id(); db.update("INSERT INTO enishi_messages(id,match_id,sender_id,body,created_at,generation,client_id) VALUES(?,?,?,?,?,?,?)",messageId,mid,uid,body,now(),m.get("created_at"),clientId);
    String other=uid.equals(m.get("pair_a"))?str(m,"pair_b"):str(m,"pair_a");
    notify(other,"message","新しいメッセージ",str(profile(uid),"nickname")+"さんからメッセージが届きました。",mid,"message:"+messageId);return null;
  }); }
  boolean streamAllowed(String token,String mid) { try { as(token,uid -> chatAccess(uid,mid)); return true; } catch(ResponseStatusException e) { return false; } }

  boolean present(String uid,String spot) { var v=currentVisit(uid); return v!=null&&spot.equals(v.get("spot_id")); }
  Map<String,Object> letterAccess(String uid,String lid) {
    var letter=one("SELECT * FROM enishi_letters WHERE id=? AND deleted=FALSE",lid);
    if(blocked(uid,str(letter,"author_id")) || (!uid.equals(letter.get("author_id")) && (num(letter,"expires_at")<=now()||!present(uid,str(letter,"spot_id")))))
      throw error(HttpStatus.FORBIDDEN,"この手紙は現在閲覧できません。公開期間内にスポットへチェックインしてください。");
    return letter;
  }
  Map<String,Object> publicLetter(String uid,Map<String,Object> letter,boolean detail) {
    String lid=str(letter,"id"),author=str(letter,"author_id"); boolean own=uid.equals(author);
    var replies=rows("SELECT * FROM enishi_replies WHERE letter_id=? AND deleted=FALSE ORDER BY created_at,id",lid);
    List<Map<String,Object>> visible=new ArrayList<>();
    for(var reply:replies) if(!blocked(uid,str(reply,"author_id"))) visible.add(map("id",reply.get("id"),"body",reply.get("body"),"created_at",uid.equals(reply.get("author_id"))?reply.get("created_at"):dayOnly(num(reply,"created_at")),"own",uid.equals(reply.get("author_id")),"author",displayAuthor(str(reply,"author_id"))));
    long reactions=rows("SELECT user_id FROM enishi_reactions WHERE letter_id=?",lid).stream().filter(r->!blocked(uid,str(r,"user_id"))).count();
    return map("id",lid,"spot_id",letter.get("spot_id"),"spotName",one("SELECT name FROM enishi_spots WHERE id=?",letter.get("spot_id")).get("name"),"body",letter.get("body"),"anonymous",letter.get("anonymous"),"author",yes(letter,"anonymous")?map("nickname","名もない誰か","avatar",""):displayAuthor(author),"own",own,"created_at",own?letter.get("created_at"):dayOnly(num(letter,"created_at")),"expires_at",own?letter.get("expires_at"):dayOnly(num(letter,"expires_at"))+86_400_000L,"canReply",present(uid,str(letter,"spot_id"))&&num(letter,"expires_at")>now(),"reactions",reactions,"reacted",exists("SELECT user_id FROM enishi_reactions WHERE letter_id=? AND user_id=?",lid,uid),"replyCount",visible.size(),"replies",detail?visible:List.of());
  }
  public List<Map<String,Object>> letters(String token,boolean mine) { return as(token,uid -> {
    List<Map<String,Object>> result=new ArrayList<>();
    List<Map<String,Object>> source;
    if(mine) source=rows("SELECT * FROM enishi_letters WHERE author_id=? AND deleted=FALSE ORDER BY created_at DESC",uid);
    else {
      var visit=currentVisit(uid); if(visit==null) return result;
      source=rows("SELECT * FROM enishi_letters WHERE spot_id=? AND expires_at>? AND deleted=FALSE ORDER BY created_at DESC",visit.get("spot_id"),now());
    }
    for(var letter:source) if(!blocked(uid,str(letter,"author_id"))) result.add(publicLetter(uid,letter,false)); return result;
  }); }
  public List<Map<String,Object>> ownReplies(String token) { return as(token,uid ->
    rows("SELECT r.id,r.body,r.created_at FROM enishi_replies r JOIN enishi_letters l ON l.id=r.letter_id WHERE r.author_id=? AND r.deleted=FALSE AND l.deleted=FALSE ORDER BY r.created_at DESC",uid)); }
  public Map<String,Object> letter(String token,String lid) { return as(token,uid -> publicLetter(uid,letterAccess(uid,lid),true)); }
  public void createLetter(String token,Map<String,Object> input) { as(token,uid -> {
    var visit=currentVisit(uid); if(visit==null) throw error(HttpStatus.FORBIDDEN,"手紙を置くにはチェックインが必要です。");
    db.update("INSERT INTO enishi_letters(id,spot_id,author_id,body,anonymous,created_at,expires_at) VALUES(?,?,?,?,?,?,?)",id(),visit.get("spot_id"),uid,text(input,"body",200,true),Boolean.TRUE.equals(input.get("anonymous")),now(),now()+WEEK); return null;
  }); }
  public void reply(String token,String lid,Map<String,Object> input) { as(token,uid -> {
    var letter=letterAccess(uid,lid);
    if(!present(uid,str(letter,"spot_id"))||num(letter,"expires_at")<=now()) throw error(HttpStatus.FORBIDDEN,"公開期間内に、このスポットへチェックインすると返信できます。");
    db.update("INSERT INTO enishi_replies(id,letter_id,author_id,body,created_at) VALUES(?,?,?,?,?)",id(),lid,uid,text(input,"body",200,true),now()); return null;
  }); }
  public void react(String token,String lid,boolean value) { as(token,uid -> {
    var letter=letterAccess(uid,lid);
    if(!present(uid,str(letter,"spot_id"))||num(letter,"expires_at")<=now()) throw error(HttpStatus.FORBIDDEN,"リアクションには現在のチェックインが必要です。");
    db.update("DELETE FROM enishi_reactions WHERE letter_id=? AND user_id=?",lid,uid);
    if(value) db.update("INSERT INTO enishi_reactions(letter_id,user_id) VALUES(?,?)",lid,uid); return null;
  }); }
  public void deleteContent(String token,String type,String target) { as(token,uid -> {
    String table=type.equals("letter")?"enishi_letters":type.equals("reply")?"enishi_replies":"";
    if(table.isEmpty()) throw error(HttpStatus.BAD_REQUEST,"対象が無効です。");
    // A reply author may delete their own reply even after leaving the spot.
    if(db.update("UPDATE "+table+" SET deleted=TRUE,body='' WHERE id=? AND author_id=?",target,uid)==0) throw error(HttpStatus.FORBIDDEN,"自分の投稿のみ削除できます。");return null;
  }); }
  public List<Map<String,Object>> blocks(String token) { return as(token,uid -> rows("SELECT b.block_id AS id,CASE WHEN b.anonymous THEN '匿名の投稿者' ELSE u.nickname END AS nickname,CASE WHEN b.anonymous THEN '' ELSE u.avatar END AS avatar FROM enishi_blocks b JOIN enishi_users u ON u.id=b.other_id WHERE b.user_id=?",uid)); }
  public void blockContentAuthor(String token,String type,String target) {
    as(token,uid -> {
      String other;boolean anonymous=false;
      if(type.equals("letter")) {
        var letter=letterAccess(uid,target);other=str(letter,"author_id");anonymous=yes(letter,"anonymous");
      } else if(type.equals("reply")) {
        var reply=one("SELECT * FROM enishi_replies WHERE id=? AND deleted=FALSE",target);
        letterAccess(uid,str(reply,"letter_id"));other=str(reply,"author_id");
      } else throw error(HttpStatus.BAD_REQUEST,"対象が無効です。");
      blockInternal(uid,other,true,anonymous);return null;
    });
  }
  public void block(String token,String other,boolean value) { as(token,uid -> {
    String target=other;
    if(!value) {
      var existing=rows("SELECT other_id FROM enishi_blocks WHERE user_id=? AND (block_id=? OR other_id=?)",uid,other,other);
      if(existing.isEmpty())return null;
      target=str(existing.getFirst(),"other_id");
    }
    blockInternal(uid,target,value,false);return null;
  }); }
  void blockInternal(String uid,String other,boolean value,boolean anonymous) {
    if(uid.equals(other)) throw error(HttpStatus.BAD_REQUEST,"自分はブロックできません。"); profile(other);
    db.update("DELETE FROM enishi_blocks WHERE user_id=? AND other_id=?",uid,other);
    if(value) {
      db.update("INSERT INTO enishi_blocks(user_id,other_id,block_id,anonymous) VALUES(?,?,?,?)",uid,other,id(),anonymous);
      var m=activeMatch(uid,other); if(m!=null) endMatch(m);
      db.update("UPDATE enishi_intents SET selected=FALSE WHERE (user_id=? AND other_id=?) OR (user_id=? AND other_id=?)",uid,other,other,uid);
      db.update("DELETE FROM enishi_notifications WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",uid,other,other,uid);
    }
  }
  void notify(String uid,String kind,String title,String body,String target,String key) {
    if(!exists("SELECT id FROM enishi_notifications WHERE user_id=? AND event_key=?",uid,key)) db.update("INSERT INTO enishi_notifications(id,user_id,kind,title,body,target_id,event_key,created_at) VALUES(?,?,?,?,?,?,?,?)",id(),uid,kind,title,body,target,key,now());
  }
  List<Map<String,Object>> notifications(String uid) { return rows("SELECT id,kind,title,body,target_id,created_at,is_read FROM enishi_notifications WHERE user_id=? ORDER BY created_at DESC",uid); }
  public void readNotification(String token,String nid) { as(token,uid -> { db.update("UPDATE enishi_notifications SET is_read=TRUE WHERE user_id=? AND id=?",uid,nid); return null; }); }
  boolean admin(String uid) { return yes(one("SELECT is_admin FROM enishi_users WHERE id=?",uid),"is_admin"); }
  public void report(String token,Map<String,Object> input) { as(token,uid -> {
    String type=text(input,"type",20,true),target=text(input,"targetId",36,true),snapshot;
    switch(type) {
      case "user" -> {
        if(common(uid,target).isEmpty()&&activeMatch(uid,target)==null&&!blocked(uid,target)) throw error(HttpStatus.FORBIDDEN,"このユーザーは通報できません。");
        snapshot=profile(target).toString();
      }
      case "letter" -> snapshot=str(letterAccess(uid,target),"body");
      case "reply" -> { var reply=one("SELECT * FROM enishi_replies WHERE id=? AND deleted=FALSE",target); letterAccess(uid,str(reply,"letter_id")); if(blocked(uid,str(reply,"author_id"))) throw error(HttpStatus.FORBIDDEN,"対象が見つかりません。"); snapshot=str(reply,"body"); }
      default -> throw error(HttpStatus.BAD_REQUEST,"通報対象が無効です。");
    }
    db.update("INSERT INTO enishi_reports(id,reporter_id,target_type,target_id,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)",id(),uid,type,target,text(input,"reason",500,true),snapshot,now());return null;
  }); }
  public List<Map<String,Object>> reports(String token) { return as(token,uid -> { if(!admin(uid)) throw error(HttpStatus.FORBIDDEN,"運営者のみ利用できます。"); return rows("SELECT * FROM enishi_reports ORDER BY created_at DESC"); }); }
  public void reportStatus(String token,String rid,String status) { as(token,uid -> {
    if(!admin(uid)) throw error(HttpStatus.FORBIDDEN,"運営者のみ利用できます。");
    if(!List.of("open","reviewing","resolved","dismissed").contains(status)) throw error(HttpStatus.BAD_REQUEST,"対応状況が無効です。");
    if(db.update("UPDATE enishi_reports SET status=? WHERE id=?",status,rid)==0) throw error(HttpStatus.NOT_FOUND,"通報が見つかりません。"); return null;
  }); }

  @PostConstruct public void seed() { locked(() -> {
    for(var block:rows("SELECT user_id,other_id FROM enishi_blocks WHERE block_id IS NULL"))
      db.update("UPDATE enishi_blocks SET block_id=? WHERE user_id=? AND other_id=?",id(),block.get("user_id"),block.get("other_id"));
    if(!exists("SELECT id FROM enishi_spots WHERE id='spot-library'")) {
      seedSpot("spot-library","mori-library","森の図書室","東京都渋谷区神南1-1-1（デモ施設）",35.6628,139.6987,"図書館","ページをめくる音と、静かな時間。読書や調べものの合間に、いつもの席で過ごせる小さな図書室です。","library");
      seedSpot("spot-cafe","komorebi-cafe","喫茶 こもれび","東京都渋谷区神宮前5-2-1（デモ施設）",35.6660,139.7060,"カフェ","窓から差す光と、一杯ずつ淹れるコーヒー。本を持ち寄りたくなる、街の喫茶店です。","cafe");
      seedSpot("spot-bookshop","yorimichi-books","よりみち書店","東京都渋谷区宇田川町10-1（デモ施設）",35.6620,139.6960,"書店","読みたい一冊と出会う場所。奥の読書スペースで、気になったページをゆっくりどうぞ。","bookshop");
      seedSpot("spot-lounge","hitoiki-lounge","ひといきラウンジ","東京都渋谷区神南1-5-1（デモ施設）",35.6640,139.7000,"ラウンジ","仕事の合間にも、何も決めない日にも。気軽に立ち寄れる、ひらかれた休憩スペースです。","lounge");
    }
    if(demo&&!exists("SELECT id FROM enishi_users WHERE email='aoi@enishi.example'")) seedDemo();
    if(demo) db.update("UPDATE enishi_messages SET generation=(SELECT m.created_at FROM enishi_matches m WHERE m.id=match_id) WHERE client_id='seed' AND EXISTS (SELECT m.id FROM enishi_matches m WHERE m.id=match_id AND m.created_at<enishi_messages.created_at)");
    return null;
  }); }
  void seedSpot(String id,String key,String name,String address,double lat,double lng,String category,String description,String cover) {
    db.update("INSERT INTO enishi_spots(id,facility_key,name,address,lat,lng,category,description,cover) VALUES(?,?,?,?,?,?,?,?,?)",id,key,name,address,lat,lng,category,description,cover);
  }
  void seedUser(String uid,String name,String email,String bio,boolean admin) {
    var secret=passwords.hash("EnishiDemo2026!");
    db.update("INSERT INTO enishi_users(id,email,password_hash,salt,nickname,bio,is_admin) VALUES(?,?,?,?,?,?,?)",uid,email,secret.hash(),secret.salt(),name,bio,admin);
  }
  void seedDemo() {
    seedUser("demo-aoi","あおい","aoi@enishi.example","本とコーヒー、散歩が好きです。最近は短編小説をよく読みます。",false);
    seedUser("demo-haru","はる","haru@enishi.example","休日は本屋さんへ。おすすめの一冊を教えてもらえたら嬉しいです。",false);
    seedUser("demo-nagi","なぎ","nagi@enishi.example","写真と旅のエッセイが好きです。のんびりお話ししましょう。",false);
    seedUser("demo-admin","運営","admin@enishi.example","ENISHI サンプル運営アカウント",true);
    for(String other:List.of("demo-haru","demo-nagi")) {
      String a="demo-aoi",b=other;
      for(int days=3;days>=1;days--) {
        long start=LocalDate.now(clock.withZone(TOKYO)).minusDays(days).atTime(13,0).atZone(TOKYO).toInstant().toEpochMilli();
        for(String u:List.of(a,b)) db.update("INSERT INTO enishi_visits(id,user_id,spot_id,started_at,ended_at,expires_at) VALUES(?,?,?,?,?,?)",id(),u,"spot-library",start,start+1_800_000,start+duration);
      }
    }
    detect();
    db.update("INSERT INTO enishi_intents(user_id,other_id,selected) VALUES('demo-aoi','demo-nagi',TRUE)");
    db.update("INSERT INTO enishi_intents(user_id,other_id,selected) VALUES('demo-nagi','demo-aoi',TRUE)");
    String mid=id(); long matchedAt=now()-60_000;
    db.update("INSERT INTO enishi_matches(id,pair_a,pair_b,created_at) VALUES(?,?,?,?)",mid,"demo-aoi","demo-nagi",matchedAt);
    db.update("INSERT INTO enishi_messages(id,match_id,sender_id,body,created_at,generation,client_id) VALUES(?,?,?,?,?,?,?)",id(),mid,"demo-nagi","はじめまして。同じ本棚の前で、何度かご一緒していたんですね。よろしくお願いします！",now()-30_000,matchedAt,"seed");
    startVisit("demo-haru","spot-library",now()-600_000,now()+duration);
    String lid=id(); db.update("INSERT INTO enishi_letters(id,spot_id,author_id,body,anonymous,created_at,expires_at) VALUES(?,?,?,?,?,?,?)",lid,"spot-library","demo-haru","雨の日に読みたくなる本、ありますか？ 私は『雨の名前』のような、言葉をゆっくり味わえる本が好きです。",false,now()-3_600_000,now()+WEEK-3_600_000);
    db.update("INSERT INTO enishi_replies(id,letter_id,author_id,body,created_at) VALUES(?,?,?,?,?)",id(),lid,"demo-nagi","雨音を聞きながら、旅のエッセイを読むのも好きです。",now()-1_800_000);
    db.update("INSERT INTO enishi_letters(id,spot_id,author_id,body,anonymous,created_at,expires_at) VALUES(?,?,?,?,?,?,?)",id(),"spot-library","demo-nagi","今日、ふと手に取った一冊がとてもよかった。そんな小さな出会いを、ここに残しておきます。",true,now()-7_200_000,now()+WEEK-7_200_000);
    db.update("INSERT INTO enishi_favorites(user_id,spot_id) VALUES('demo-aoi','spot-library')");
  }
  public void demoCheckin(String token) {
    if(!demo) throw error(HttpStatus.NOT_FOUND,"デモ機能は無効です。");
    as(token,uid -> {
      if(!uid.startsWith("demo-")||uid.equals("demo-admin")) throw error(HttpStatus.FORBIDDEN,"サンプルユーザー専用の操作です。");
      var v=currentVisit(uid);
      if(v!=null&&!str(v,"spot_id").equals("spot-library")) throw error(HttpStatus.CONFLICT,"現在のスポットをチェックアウトしてください。");
      if(v==null) startVisit(uid,"spot-library",now(),now()+duration);return null;
    });
  }
}
