import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = "/api/enishi";
async function api(path, method = "GET", body) {
  const response = await fetch(API + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Enishi-Request": "1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(
      data.message || "通信できませんでした。もう一度お試しください。",
    );
    err.status = response.status;
    throw err;
  }
  return response.json();
}
const paths = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  heart: (
    <path d="M20.5 4.5a5.5 5.5 0 0 0-8 1 5.5 5.5 0 0 0-8-1c-6 5 2.5 11.5 8 15.5 5.5-4 14-10.5 8-15.5Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </>
  ),
  chat: <path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 1 1 19 0Z" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  book: (
    <>
      <path d="M12 5C8 2 3 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-1-1-6-2-10 1Z" />
      <path d="M12 5v16" />
    </>
  ),
  coffee: (
    <>
      <path d="M3 8h13v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z" />
      <path d="M16 9h2a4 4 0 0 1 0 8h-2M6 2v2M10 2v2M14 2v2" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  settings: (
    <>
      <path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H3v18h6M9 12h12m-5-5 5 5-5 5" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  send: (
    <>
      <path d="m3 3 19 9-19 9 4-9Z" />
      <path d="M7 12h15" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C5 2 2 10 5 16c6 7 17 0 15-13Z" />
      <path d="M3 22 15 10" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  flag: (
    <>
      <path d="M4 22V3c5-5 10 5 16 0v12c-6 5-11-5-16 0" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
};
function Icon({ name, size = 20, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name] || paths.leaf}
    </svg>
  );
}
function Mark() {
  return (
    <svg className="mark" viewBox="0 0 42 42" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <ellipse cx="21" cy="21" rx="10" ry="17" transform="rotate(-35 21 21)" />
      <ellipse cx="21" cy="21" rx="10" ry="17" transform="rotate(35 21 21)" />
      <ellipse cx="21" cy="21" rx="10" ry="17" />
    </svg>
  );
}
function Avatar({ user, size = "" }) {
  return user?.avatar ? (
    <img className={"avatar " + size} src={user.avatar} alt="" />
  ) : (
    <span
      className={
        "avatar " + size + " tone-" + ((user?.nickname || "").length % 3)
      }
    >
      {(user?.nickname || "誰").slice(0, 1)}
    </span>
  );
}
function Empty({ icon = "leaf", title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
const date = (value) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
const time = (value) =>
  new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
const label = {
  home: "ホーム",
  spots: "スポットを探す",
  candidates: "縁の候補",
  matches: "つながり",
  letters: "置き手紙",
  notifications: "お知らせ",
  profile: "マイページ",
  settings: "設定",
  admin: "通報の確認",
};

function App() {
  const [state, setState] = useState(null),
    [loading, setLoading] = useState(true),
    [demo, setDemo] = useState(false),
    [route, setRoute] = useState("home"),
    [spot, setSpot] = useState(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(null),
    [report, setReport] = useState(null);
  const mounted = useRef(true),
    request = useRef(0);
  const refresh = useCallback(async () => {
    const seq = ++request.current;
    try {
      const data = await api("/state");
      if (mounted.current && seq === request.current) setState(data);
    } catch (e) {
      if (e.status === 401) {
        setState(null);
      } else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh();
    api("/config")
      .then((d) => setDemo(d.demo))
      .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!state?.user.id) return;
    const source = new EventSource(API + "/events");
    source.addEventListener("refresh", refresh);
    source.addEventListener("revoked", () => {
      source.close();
      refresh();
    });
    const interval = setInterval(refresh, 30000);
    const visible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      source.close();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [state?.user.id, refresh]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  const act = async (fn, success) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      await refresh();
      if (success) setToast(success);
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const run = (fn, msg) => act(fn, msg).catch(() => {});
  const go = (next) => {
    setRoute(next);
    setSpot(null);
    setError("");
    window.scrollTo({ top: 0 });
  };
  const confirmAction = (title, description, action) =>
    setConfirm({ title, description, action });
  const geoCheckin = (place) =>
    run(async () => {
      if (!navigator.geolocation)
        throw new Error(
          "このブラウザーは位置情報に対応していません。対応ブラウザーで開き直してください。",
        );
      let position;
      try {
        position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }),
        );
      } catch (e) {
        throw new Error(
          {
            1: "位置情報の利用が許可されていません。ブラウザーのサイト設定で許可し、「チェックイン」をもう一度押してください。",
            2: "位置を確認できませんでした。端末の位置情報をオンにして、窓際や屋外で再度お試しください。",
            3: "位置情報の取得に時間がかかっています。通信状態を確認し、もう一度お試しください。",
          }[e.code] ||
            "位置情報を取得できません。設定を確認して再度お試しください。",
        );
      }
      await api("/visits", "POST", {
        spotId: place.id,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    }, "チェックインしました。いつもの時間をお楽しみください。");
  if (loading)
    return (
      <div className="boot">
        <Mark />
        <p>ENISHIをひらいています…</p>
      </div>
    );
  if (!state)
    return (
      <Auth
        demo={demo}
        onLogin={() => {
          setRoute("home");
          refresh();
        }}
      />
    );
  const { user, visit, spots, candidates, matches, notifications } = state;
  const unread = notifications.filter((n) => !n.is_read).length,
    visible = candidates.filter((c) => !c.hidden);
  const props = {
    state,
    run,
    act,
    busy,
    go,
    confirmAction,
    onReport: (type, targetId) => setReport({ type, targetId }),
    onBlock: (other) =>
      confirmAction(
        "このユーザーをブロックしますか？",
        "お互いの候補・投稿が非表示になり、チャットも終了します。",
        () => api("/blocks/" + other, "POST", { value: true }),
      ),
  };
  const openSpot = (place) => {
    setSpot(place);
    setRoute("spots");
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <Mark />
          <span>
            ENISHI<small>いつもの場所から、縁がはじまる。</small>
          </span>
        </a>
        <nav aria-label="メインナビゲーション">
          {["home", "spots", "candidates", "matches", "letters"].map((r) => (
            <button
              key={r}
              className={"nav-link " + (route === r ? "active" : "")}
              onClick={() => go(r)}
            >
              <Icon
                name={
                  {
                    home: "home",
                    spots: "pin",
                    candidates: "heart",
                    matches: "chat",
                    letters: "mail",
                  }[r]
                }
              />
              <span>{label[r]}</span>
              {r === "candidates" && visible.length > 0 && (
                <span className="count">{visible.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="leaf" />
          <p>
            出会いを急がず、
            <br />
            いつもの時間を大切に。
          </p>
        </div>
        <div className="sidebar-bottom">
          <button
            className={
              "nav-link " + (route === "notifications" ? "active" : "")
            }
            onClick={() => go("notifications")}
          >
            <Icon name="bell" />
            <span>お知らせ</span>
            {unread > 0 && <span className="count">{unread}</span>}
          </button>
          <button className="user-link" onClick={() => go("profile")}>
            <Avatar user={user} />
            <span>
              {user.nickname}
              <small>マイページ</small>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="desktop-label">
            {label[route]}
            {spot && " / " + spot.name}
          </span>
          <a
            className="mobile-brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("home");
            }}
          >
            <Mark />
            ENISHI
          </a>
          <div className="topbar-right">
            <span className="privacy-label">
              <Icon name="shield" size={15} />
              あなたの居場所は公開されません
            </span>
            <button
              className="icon-button notification-button"
              aria-label={"お知らせ " + unread + "件の未読"}
              onClick={() => go("notifications")}
            >
              <Icon name="bell" />
              {unread > 0 && <i />}
            </button>
            <button
              className="icon-button"
              aria-label="設定"
              onClick={() => go("settings")}
            >
              <Icon name="settings" />
            </button>
          </div>
        </header>
        <main id="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="エラーを閉じる"
                onClick={() => setError("")}
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          {route === "home" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    いつもの場所で、
                    <br className="mobile-only" />
                    新しいご縁を。
                  </h1>
                  <p>{user.nickname}さん、今日もあなたのペースで。</p>
                </div>
                <span className="today">{date(Date.now())}</span>
              </div>
              <div className="home-grid">
                <div className="primary-column">
                  <Stay
                    visit={visit}
                    busy={busy}
                    go={go}
                    checkout={() =>
                      run(
                        () => api("/visits/checkout", "POST"),
                        "チェックアウトしました。",
                      )
                    }
                  />
                  <section className="spots-section">
                    <div className="section-heading">
                      <h2>お気に入りの場所を、見つけよう</h2>
                      <button
                        className="text-button"
                        onClick={() => go("spots")}
                      >
                        すべてのスポット
                        <Icon name="chevron" size={16} />
                      </button>
                    </div>
                    <p className="section-intro">
                      本を読む日も、ひと息つく日も。まずは、チェックインから。
                    </p>
                    <div className="spot-grid">
                      {spots.slice(0, 2).map((s) => (
                        <SpotCard
                          key={s.id}
                          spot={s}
                          open={() => openSpot(s)}
                          favorite={() =>
                            run(() =>
                              api("/favorites/" + s.id, "POST", {
                                value: !s.favorite,
                              }),
                            )
                          }
                        />
                      ))}
                    </div>
                  </section>
                  <section className="home-letters">
                    <div className="section-heading">
                      <h2>
                        <Icon name="mail" />
                        この場所に、置き手紙を。
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => go("letters")}
                      >
                        手紙をひらく
                        <Icon name="chevron" size={16} />
                      </button>
                    </div>
                    <p>
                      おすすめの本や、ふとした気づき。
                      <br />
                      小さな言葉が、誰かの一日を少し豊かにするかもしれません。
                    </p>
                    <span className="quiet">
                      <Icon name="shield" size={15} />
                      チェックインした場所の手紙だけ読めます
                    </span>
                  </section>
                </div>
                <aside className="right-column">
                  <section className="how-to">
                    <div className="section-heading">
                      <h2>少しずつ、縁になる。</h2>
                      <Icon name="leaf" />
                    </div>
                    <p className="muted">ENISHIのつながり方</p>
                    <ol>
                      <li>
                        <span className="step-icon">
                          <Icon name="pin" />
                        </span>
                        <div>
                          <h3>いつもの場所へ</h3>
                          <p>
                            お気に入りの場所で
                            <br />
                            チェックイン。
                          </p>
                        </div>
                      </li>
                      <li>
                        <span className="step-icon">
                          <Icon name="leaf" />
                        </span>
                        <div>
                          <h3>3回のすれ違い</h3>
                          <p>
                            同じ場所で時間が重なると、
                            <br />
                            少しずつ縁が育ちます。
                          </p>
                        </div>
                      </li>
                      <li>
                        <span className="step-icon">
                          <Icon name="heart" />
                        </span>
                        <div>
                          <h3>お互いの気持ちで</h3>
                          <p>
                            双方が「縁を結ぶ」を選ぶと、
                            <br />
                            会話がはじまります。
                          </p>
                        </div>
                      </li>
                    </ol>
                    <div className="private-note">
                      <Icon name="shield" />
                      <p>
                        居場所も、片方だけの気持ちも。
                        <br />
                        相手に伝わることはありません。
                      </p>
                    </div>
                  </section>
                  {visible.length > 0 && (
                    <section className="small-candidate">
                      <div className="section-heading">
                        <h2>育ったご縁</h2>
                        <span className="count">{visible.length}</span>
                      </div>
                      <div className="candidate-preview">
                        <Avatar user={visible[0].profile} />
                        <div>
                          <b>{visible[0].profile.nickname}さん</b>
                          <p>{visible[0].spots[0].name}でのご縁</p>
                        </div>
                      </div>
                      <button
                        className="button outline full"
                        onClick={() => go("candidates")}
                      >
                        縁の候補を見る
                      </button>
                    </section>
                  )}
                  <p className="sample-note">
                    {demo
                      ? "表示中の施設・プロフィールはデモデータです。"
                      : "他のユーザーの現在地やチェックイン状況は表示されません。"}
                  </p>
                </aside>
              </div>
            </>
          )}
          {route === "spots" &&
            (spot ? (
              <SpotDetail
                {...props}
                spot={spots.find((s) => s.id === spot.id) || spot}
                checkin={geoCheckin}
                back={() => setSpot(null)}
              />
            ) : (
              <Spots {...props} openSpot={openSpot} />
            ))}
          {route === "candidates" && <Candidates {...props} />}
          {route === "matches" && <Chats {...props} />}
          {route === "letters" && <Letters {...props} />}
          {route === "notifications" && <Notifications {...props} />}
          {route === "profile" && <Profile {...props} />}
          {route === "settings" && (
            <Settings
              {...props}
              logout={() =>
                run(async () => {
                  await api("/auth/logout", "POST");
                  setState(null);
                })
              }
            />
          )}
          {route === "admin" && <Reports {...props} />}
        </main>
        <footer>
          ENISHI<span>何気ない日常に、ゆっくり育つ縁。</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="モバイルナビゲーション">
        {["home", "spots", "candidates", "matches", "letters"].map((r) => (
          <button
            key={r}
            className={route === r ? "active" : ""}
            onClick={() => go(r)}
          >
            <Icon
              name={
                {
                  home: "home",
                  spots: "pin",
                  candidates: "heart",
                  matches: "chat",
                  letters: "mail",
                }[r]
              }
            />
            <span>
              {
                {
                  home: "ホーム",
                  spots: "スポット",
                  candidates: "縁の候補",
                  matches: "つながり",
                  letters: "手紙",
                }[r]
              }
            </span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" />
          {toast}
        </div>
      )}
      {confirm && (
        <Modal title={confirm.title} close={() => setConfirm(null)}>
          <p>{confirm.description}</p>
          <div className="form-actions">
            <button className="button outline" onClick={() => setConfirm(null)}>
              キャンセル
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await confirm.action();
                  setConfirm(null);
                }, "操作を完了しました。")
              }
            >
              実行する
            </button>
          </div>
        </Modal>
      )}
      {report && (
        <Modal title="通報する" close={() => setReport(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const reason = new FormData(e.currentTarget).get("reason");
              run(async () => {
                await api("/reports", "POST", { ...report, reason });
                setReport(null);
              }, "通報を受け付けました。運営が確認します。");
            }}
          >
            <label>
              理由
              <textarea
                name="reason"
                maxLength="500"
                required
                placeholder="運営に確認してほしい内容を教えてください。"
              />
            </label>
            <p className="quiet">通報者の情報は、相手に公開されません。</p>
            <button className="button full" disabled={busy}>
              通報を送信する
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Auth({ demo, onLogin }) {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const login = async (data) => {
    setBusy(true);
    setError("");
    try {
      await api("/auth/" + (register ? "register" : "login"), "POST", data);
      onLogin();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <a className="brand" href="#">
          <Mark />
          <span>ENISHI</span>
        </a>
        <div className="auth-copy">
          <h1>
            偶然が重なって、
            <br />
            いつか、ご縁に。
          </h1>
          <p>
            同じ場所を好きな、誰かと。
            <br />
            いつもの時間から、ゆっくりつながる。
          </p>
          <div className="auth-rings">
            <span />
            <span />
            <span />
          </div>
          <p className="auth-privacy">
            <Icon name="shield" />
            現在地や滞在時刻を公開せずに、
            <br />
            お互いの気持ちで会話をはじめられます。
          </p>
        </div>
        <span className="auth-bottom">何気ない日常に、ゆっくり育つ縁。</span>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <h2>{register ? "ENISHIをはじめる" : "おかえりなさい"}</h2>
          <p>
            {register
              ? "いつもの場所に、小さな出会いを。"
              : "今日も、あなたらしい時間を。"}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login(Object.fromEntries(new FormData(e.currentTarget)));
            }}
          >
            {register && (
              <label>
                ニックネーム
                <input
                  name="nickname"
                  required
                  maxLength="30"
                  autoComplete="nickname"
                  placeholder="あおい"
                />
              </label>
            )}
            <label>
              メールアドレス
              <input
                name="email"
                type="email"
                required
                maxLength="254"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label>
              パスワード
              <input
                name="password"
                type="password"
                required
                minLength={register ? 10 : 1}
                maxLength="128"
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={register ? "10文字以上" : "パスワードを入力"}
              />
            </label>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button className="button full" disabled={busy}>
              {busy
                ? "確認しています…"
                : register
                  ? "アカウントを作成"
                  : "ログイン"}
            </button>
          </form>
          <button
            className="text-button auth-switch"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "アカウントをお持ちの方はログイン"
              : "はじめての方は、新規登録"}
          </button>
          {demo && (
            <div className="demo-auth">
              <b>サンプルで体験する</b>
              <p>架空のユーザーで、ENISHIを試せます。</p>
              <div className="demo-users">
                {[
                  ["aoi", "あおい"],
                  ["haru", "はる"],
                  ["nagi", "なぎ"],
                  ["admin", "運営"],
                ].map(([key, name]) => (
                  <button
                    key={key}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await api("/auth/login", "POST", {
                          email: key + "@enishi.example",
                          password: "EnishiDemo2026!",
                        });
                        onLogin();
                      } catch (e) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
function Stay({ visit, busy, go, checkout }) {
  return (
    <section className={"stay-panel " + (visit ? "checked" : "")}>
      <div>
        <span className="stay-status">
          <span className="status-dot" />
          {visit ? "チェックイン中" : "まだチェックインしていません"}
        </span>
        <h2>{visit ? visit.name : "今日は、どこで過ごしますか？"}</h2>
        <p>
          {visit
            ? "この場所で過ごす時間が、ご縁につながります。"
            : "お気に入りの場所で、いつものひとときを。"}
        </p>
        {visit ? (
          <div className="stay-actions">
            <button className="button light" disabled={busy} onClick={checkout}>
              チェックアウト
            </button>
            <button
              className="text-button inverse"
              onClick={() => go("letters")}
            >
              この場所の置き手紙
              <Icon name="chevron" size={16} />
            </button>
          </div>
        ) : (
          <button className="button light" onClick={() => go("spots")}>
            <Icon name="pin" size={17} />
            スポットを探す
          </button>
        )}
        {visit && (
          <small>
            自動終了：{time(visit.expires_at)}（日本時間）・あなたにだけ表示
          </small>
        )}
      </div>
      <div className="stay-motif" aria-hidden="true">
        <span />
        <span />
        <span />
        <Icon name="leaf" size={38} />
      </div>
    </section>
  );
}
function SpotCard({ spot, open, favorite }) {
  return (
    <article className="spot-card">
      <div className="spot-photo">
        <button
          className="photo-link"
          aria-label={spot.name + "の詳細"}
          onClick={open}
        >
          <img
            src={"/enishi/photos/" + spot.cover + ".jpg"}
            alt={spot.category + "のイメージ写真"}
            loading="lazy"
          />
        </button>
        <span className="category-tag">{spot.category}</span>
        <button
          className={"favorite-button " + (spot.favorite ? "selected" : "")}
          aria-label={spot.favorite ? "お気に入りを解除" : "お気に入りに登録"}
          aria-pressed={spot.favorite}
          onClick={favorite}
        >
          <Icon name="heart" />
        </button>
      </div>
      <button className="spot-description" onClick={open}>
        <h3>
          {spot.name}
          <Icon name="chevron" size={18} />
        </h3>
        <p>
          <Icon name="pin" size={14} />
          {spot.address.replace("（デモ施設）", "")}
        </p>
        <span>{spot.description.split("。")[0]}。</span>
      </button>
    </article>
  );
}
function Spots({ state, run, openSpot }) {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("すべて"),
    [favorites, setFavorites] = useState(false);
  const places = state.spots.filter(
    (s) =>
      (s.name + s.address + s.description).includes(q) &&
      (category === "すべて" || s.category === category) &&
      (!favorites || s.favorite),
  );
  return (
    <>
      <PageTitle
        title="いつもの場所を、探そう。"
        description="気になる場所を見つけたら、まずは足を運んでみませんか。"
      />
      <div className="search-field">
        <Icon name="search" />
        <input
          aria-label="スポットを検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="スポット名・エリア・キーワードで検索"
        />
      </div>
      <div className="filter-bar">
        <div className="tabs">
          {["すべて", "図書館", "カフェ", "書店", "ラウンジ"].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          className={"chip " + (favorites ? "selected" : "")}
          aria-pressed={favorites}
          onClick={() => setFavorites(!favorites)}
        >
          <Icon name="heart" size={16} />
          お気に入り
        </button>
      </div>
      <p className="muted result-count">
        {places.length}件のスポット
        {state.config.demo && " · すべて動作確認用の架空施設です"}
      </p>
      <div className="spot-grid all-spots">
        {places.map((s) => (
          <SpotCard
            key={s.id}
            spot={s}
            open={() => openSpot(s)}
            favorite={() =>
              run(() =>
                api("/favorites/" + s.id, "POST", { value: !s.favorite }),
              )
            }
          />
        ))}
      </div>
      {!places.length && (
        <Empty icon="search" title="スポットが見つかりませんでした">
          キーワードやカテゴリーを変えて探してみてください。
        </Empty>
      )}
    </>
  );
}
function SpotDetail({ state, spot, checkin, run, busy, back }) {
  const here = state.visit?.spot_id === spot.id;
  return (
    <>
      <button className="text-button back-link" onClick={back}>
        スポット一覧に戻る
      </button>
      <div className="detail-layout">
        <div>
          <img
            className="detail-cover"
            src={"/enishi/photos/" + spot.cover + ".jpg"}
            alt={spot.name + "のイメージ写真"}
          />
          <div className="detail-heading">
            <div>
              <span className="category-text">{spot.category}</span>
              <h1>{spot.name}</h1>
            </div>
            <button
              className={
                "icon-button " + (spot.favorite ? "favorite-active" : "")
              }
              aria-label="お気に入りを切り替え"
              aria-pressed={spot.favorite}
              onClick={() =>
                run(() =>
                  api("/favorites/" + spot.id, "POST", {
                    value: !spot.favorite,
                  }),
                )
              }
            >
              <Icon name="heart" size={25} />
            </button>
          </div>
          <p className="address">
            <Icon name="pin" />
            {spot.address}
          </p>
          <p className="description">{spot.description}</p>
          <p className="quiet">
            緯度 {spot.lat} ／ 経度 {spot.lng}
            <br />
            写真は施設の雰囲気を伝えるイメージです。
          </p>
        </div>
        <section className="checkin-box">
          <Icon name="pin" size={28} />
          <h2>{here ? "ここで過ごしています" : "この場所で、ひとときを。"}</h2>
          <p>
            スポットの半径{state.config.radiusMeters}
            m以内でチェックインできます。
          </p>
          <button
            className="button full"
            disabled={busy || Boolean(state.visit && !here)}
            onClick={() =>
              here
                ? run(
                    () => api("/visits/checkout", "POST"),
                    "チェックアウトしました。",
                  )
                : checkin(spot)
            }
          >
            {busy
              ? "確認しています…"
              : here
                ? "チェックアウト"
                : "位置情報でチェックイン"}
          </button>
          {state.visit && !here && (
            <p className="field-error">
              先に現在のスポットをチェックアウトしてください。
            </p>
          )}
          <ul>
            <li>チェックインは同時に1か所まで</li>
            <li>{state.config.visitHours}時間後に自動チェックアウト</li>
            <li>居場所や滞在時刻は公開しません</li>
          </ul>
          {state.config.demo &&
            spot.id === "spot-library" &&
            state.user.id.startsWith("demo-") && (
              <div className="demo-checkin">
                <b>動作確認用</b>
                <p>
                  位置情報を使わず、デモ図書室へ入れます。本番では無効です。
                </p>
                <button
                  className="button outline full"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api("/demo/checkin", "POST"),
                      "デモ図書室にチェックインしました。",
                    )
                  }
                >
                  デモでチェックイン
                </button>
              </div>
            )}
        </section>
      </div>
    </>
  );
}
function PageTitle({ title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
function Candidates({ state, run, busy, onBlock, onReport }) {
  const [hidden, setHidden] = useState(false);
  const people = state.candidates.filter((c) => c.hidden === hidden);
  return (
    <>
      <PageTitle
        title="ゆっくり育った、ご縁。"
        description="同じ場所で3回以上すれ違った方と、お互いの気持ちでつながれます。"
      />
      <div className="info-strip">
        <Icon name="shield" />
        <p>
          あなたが「縁を結ぶ」を選んでも、相手には伝わりません。
          <br />
          双方が選んだときだけ、縁が結ばれます。
        </p>
      </div>
      <div className="tabs line-tabs">
        <button
          className={!hidden ? "active" : ""}
          onClick={() => setHidden(false)}
        >
          縁の候補
        </button>
        <button
          className={hidden ? "active" : ""}
          onClick={() => setHidden(true)}
        >
          見送った候補
        </button>
      </div>
      <div className="people-list">
        {people.map((c) => (
          <article className="person-card" key={c.profile.id}>
            <Avatar user={c.profile} size="large" />
            <div className="person-content">
              <h2>
                {c.profile.nickname}
                <span>さん</span>
              </h2>
              <p>
                {c.profile.bio ||
                  "これから少しずつ、お互いを知っていきましょう。"}
              </p>
              <div className="common-spots">
                {c.spots.map((s) => (
                  <span key={s.id}>
                    <Icon name="pin" size={15} />
                    {s.name}で3回以上のすれ違い
                  </span>
                ))}
              </div>
              <div className="person-actions">
                <button
                  className={"button " + (c.selected ? "outline" : "")}
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api(
                          "/candidates/" +
                            c.profile.id +
                            "/" +
                            (hidden
                              ? "restore"
                              : c.selected
                                ? "cancel"
                                : "select"),
                          "POST",
                        ),
                      hidden
                        ? "候補一覧に戻しました。"
                        : c.selected
                          ? "選択を取り消しました。"
                          : "「縁を結ぶ」を選択しました。選択はあなただけに表示されます。",
                    )
                  }
                >
                  <Icon name={c.selected ? "check" : "heart"} size={17} />
                  {hidden
                    ? "候補に戻す"
                    : c.selected
                      ? "選択済み・取り消す"
                      : "縁を結ぶ"}
                </button>
                {!hidden && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          api("/candidates/" + c.profile.id + "/hide", "POST"),
                        "候補を見送りました。後から戻せます。",
                      )
                    }
                  >
                    今回は見送る
                  </button>
                )}
              </div>
              <div className="safety-actions">
                <button onClick={() => onReport("user", c.profile.id)}>
                  通報
                </button>
                <button onClick={() => onBlock(c.profile.id)}>ブロック</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!people.length && (
        <Empty
          icon="heart"
          title={hidden ? "見送った候補はありません" : "ご縁は、これから。"}
        >
          同じ場所で連続5分以上、3日間すれ違うと候補が表示されます。気負わず、いつもの時間を楽しんでください。
        </Empty>
      )}
    </>
  );
}
function Chats({ state, run, busy, confirmAction, onBlock, onReport }) {
  const [selected, setSelected] = useState(null),
    [messages, setMessages] = useState([]),
    [body, setBody] = useState(""),
    [chatError, setChatError] = useState("");
  const end = useRef(null);
  const chosen = state.matches.find((m) => m.id === selected);
  useEffect(() => {
    if (!state.matches.some((m) => m.id === selected)) {
      setSelected(null);
      setMessages([]);
    }
  }, [state.matches, selected]);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setMessages([]);
    setChatError("");
    const load = () =>
      api("/matches/" + selected + "/messages")
        .then((m) => {
          if (alive) setMessages(m);
        })
        .catch((e) => {
          if (alive) {
            setMessages([]);
            setChatError(e.message);
          }
        });
    load();
    const s = new EventSource(API + "/matches/" + selected + "/events");
    s.addEventListener("refresh", load);
    s.addEventListener("revoked", () => {
      s.close();
      if (alive) {
        setMessages([]);
        setChatError("このチャットの利用は終了しました。");
      }
    });
    return () => {
      alive = false;
      s.close();
    };
  }, [selected]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  return (
    <>
      <PageTitle
        title="つながり"
        description="お互いの気持ちが重なった方と、言葉を交わしてみましょう。"
      />
      <div className={"chat-layout " + (chosen ? "chat-open" : "")}>
        <aside className="chat-people">
          {state.matches.map((m) => (
            <button
              key={m.id}
              className={"chat-person " + (m.id === selected ? "active" : "")}
              onClick={() => setSelected(m.id)}
            >
              <Avatar user={m.profile} />
              <span>
                <b>{m.profile.nickname}さん</b>
                <small>{m.spots[0]?.name}でのご縁</small>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
          {!state.matches.length && (
            <Empty icon="chat" title="会話は、ここから。">
              双方が「縁を結ぶ」を選ぶとチャットがはじまります。
            </Empty>
          )}
        </aside>
        <section className="chat-room">
          {chosen ? (
            <>
              <div className="chat-header">
                <button
                  className="text-button mobile-only"
                  onClick={() => setSelected(null)}
                >
                  一覧
                </button>
                <Avatar user={chosen.profile} />
                <h2>{chosen.profile.nickname}さん</h2>
                <details className="safety-menu">
                  <summary aria-label="チャットの操作">
                    <Icon name="more" />
                  </summary>
                  <div>
                    <button onClick={() => onReport("user", chosen.profile.id)}>
                      ユーザーを通報
                    </button>
                    <button onClick={() => onBlock(chosen.profile.id)}>
                      ブロック
                    </button>
                    <button
                      onClick={() =>
                        confirmAction(
                          "縁を解除しますか？",
                          "チャットの閲覧・送信を終了します。再びつながるには双方の新たな同意が必要です。",
                          () => api("/matches/" + chosen.id, "DELETE"),
                        )
                      }
                    >
                      縁を解除
                    </button>
                  </div>
                </details>
              </div>
              <div className="chat-messages">
                <p className="chat-guidance">
                  ご縁が結ばれました。まずは、気軽にごあいさつを。
                </p>
                {chatError && (
                  <p role="alert" className="field-error">
                    {chatError}
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      "message " + (m.sender_id === state.user.id ? "mine" : "")
                    }
                  >
                    <p>{m.body}</p>
                    <small>
                      {date(m.created_at)} {time(m.created_at)}
                    </small>
                  </div>
                ))}
                <div ref={end} />
              </div>
              <form
                className="chat-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!body.trim()) return;
                  const value = body;
                  run(async () => {
                    await api("/matches/" + selected + "/messages", "POST", {
                      body: value,
                      clientId: crypto.randomUUID(),
                    });
                    setBody("");
                    setMessages(
                      await api("/matches/" + selected + "/messages"),
                    );
                  });
                }}
              >
                <input
                  aria-label="メッセージ"
                  maxLength="1000"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="メッセージを入力…"
                />
                <button
                  className="button"
                  disabled={busy || !body.trim() || !!chatError}
                  aria-label="送信"
                >
                  <Icon name="send" />
                </button>
              </form>
            </>
          ) : (
            <Empty icon="chat" title="言葉から、はじめよう。">
              左の一覧から、話したい相手を選んでください。
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}
function Letters({ state, run, busy, confirmAction, onReport }) {
  const [mine, setMine] = useState(false),
    [letters, setLetters] = useState([]),
    [selected, setSelected] = useState(null),
    [detail, setDetail] = useState(null),
    [compose, setCompose] = useState(false),
    [body, setBody] = useState(""),
    [anonymous, setAnonymous] = useState(false),
    [reply, setReply] = useState(""),
    [localError, setLocalError] = useState("");
  const load = useCallback(
    () =>
      api("/letters?mine=" + mine)
        .then(setLetters)
        .catch((e) => setLocalError(e.message)),
    [mine, state],
  );
  useEffect(() => {
    load();
  }, [load]);
  const loadDetail = useCallback(() => {
    if (selected)
      api("/letters/" + selected)
        .then((d) => {
          setDetail(d);
          setLocalError("");
        })
        .catch((e) => {
          setDetail(null);
          setLocalError(e.message);
        });
  }, [selected, state]);
  useEffect(() => {
    setDetail(null);
  }, [selected, state.visit?.id]);
  useEffect(() => {
    loadDetail();
  }, [loadDetail]);
  useEffect(() => {
    const timer = setInterval(() => {
      load();
      loadDetail();
    }, 15000);
    return () => clearInterval(timer);
  }, [load, loadDetail]);
  const mutate = (fn, msg) =>
    run(async () => {
      await fn();
      await load();
      loadDetail();
    }, msg);
  const blockAuthor = (type, id) =>
    confirmAction(
      "投稿者をブロックしますか？",
      "お互いの投稿を非表示にし、つながりがある場合はチャットも終了します。",
      async () => {
        await api("/content/" + type + "/" + id + "/block-author", "POST");
        setSelected(null);
        await load();
      },
    );
  return (
    <>
      <PageTitle
        title="この場所に、言葉を残す。"
        description="おすすめの一冊も、今日の小さな発見も。気軽に置いていきませんか。"
      >
        {state.visit && (
          <button className="button" onClick={() => setCompose(!compose)}>
            <Icon name="mail" size={18} />
            {compose ? "投稿欄を閉じる" : "手紙を置く"}
          </button>
        )}
      </PageTitle>
      <div className="letter-location">
        <Icon name="pin" />
        <span>
          {state.visit ? state.visit.name : "現在チェックインしていません"}
        </span>
        {state.visit && <span className="tag">自分の滞在先</span>}
      </div>
      <div className="tabs line-tabs">
        <button
          className={!mine ? "active" : ""}
          onClick={() => {
            setMine(false);
            setSelected(null);
          }}
        >
          この場所の手紙
        </button>
        <button
          className={mine ? "active" : ""}
          onClick={() => {
            setMine(true);
            setSelected(null);
          }}
        >
          自分の手紙・返信履歴
        </button>
      </div>
      {localError && (
        <p role="alert" className="field-error">
          {localError}
        </p>
      )}
      {compose && (
        <form
          className="paper composer"
          onSubmit={(e) => {
            e.preventDefault();
            mutate(async () => {
              await api("/letters", "POST", { body, anonymous });
              setBody("");
              setCompose(false);
            }, "手紙を置きました。7日間公開されます。");
          }}
        >
          <h2>小さな言葉を、ひとつ。</h2>
          <label>
            <span className="sr-only">手紙の本文</span>
            <textarea
              required
              maxLength="200"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="この場所で、誰かに伝えたいこと。"
            />
          </label>
          <div className="compose-meta">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
              匿名で置く
            </label>
            <small>{Array.from(body).length}/200</small>
          </div>
          <p className="quiet">
            <Icon name="shield" size={15} />
            連絡先などの個人情報や、具体的な行動予定は書かないでください。
          </p>
          <button className="button" disabled={busy || !body.trim()}>
            手紙を置く
          </button>
        </form>
      )}
      {selected && detail ? (
        <div className="letter-thread">
          <button
            className="text-button back-link"
            onClick={() => setSelected(null)}
          >
            手紙の一覧に戻る
          </button>
          <LetterCard
            letter={detail}
            open={() => {}}
            react={() =>
              mutate(() =>
                api("/letters/" + detail.id + "/reaction", "POST", {
                  value: !detail.reacted,
                }),
              )
            }
          />
          <div className="thread-actions">
            {detail.own ? (
              <button
                className="text-button danger-text"
                onClick={() =>
                  confirmAction(
                    "手紙を削除しますか？",
                    "本文と返信スレッドが非表示になります。",
                    async () => {
                      await api("/content/letter/" + detail.id, "DELETE");
                      setSelected(null);
                      load();
                    },
                  )
                }
              >
                手紙を削除
              </button>
            ) : (
              <>
                <button
                  className="text-button"
                  onClick={() => onReport("letter", detail.id)}
                >
                  この手紙を通報
                </button>
                <button
                  className="text-button"
                  onClick={() => blockAuthor("letter", detail.id)}
                >
                  投稿者をブロック
                </button>
              </>
            )}
          </div>
          <h2 className="reply-heading">
            届いたお返事 <span>{detail.replies.length}</span>
          </h2>
          {detail.replies.map((r) => (
            <article className="reply" key={r.id}>
              <Avatar user={r.author} />
              <div>
                <b>{r.author.nickname}さん</b>
                <p>{r.body}</p>
                <small>{date(r.created_at)}</small>
                <button
                  className="text-button"
                  onClick={() =>
                    r.own
                      ? mutate(
                          () => api("/content/reply/" + r.id, "DELETE"),
                          "返信を削除しました。",
                        )
                      : onReport("reply", r.id)
                  }
                >
                  {r.own ? "削除" : "通報"}
                </button>
                {!r.own && (
                  <button
                    className="text-button"
                    onClick={() => blockAuthor("reply", r.id)}
                  >
                    投稿者をブロック
                  </button>
                )}
              </div>
            </article>
          ))}
          {detail.canReply ? (
            <form
              className="reply-form"
              onSubmit={(e) => {
                e.preventDefault();
                mutate(async () => {
                  await api("/letters/" + detail.id + "/replies", "POST", {
                    body: reply,
                  });
                  setReply("");
                }, "お返事を届けました。");
              }}
            >
              <label>
                お返事を書く
                <textarea
                  required
                  maxLength="200"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="伝えたいことを、200文字以内で。"
                />
              </label>
              <p className="quiet">
                個人情報や具体的な行動予定は書かないでください。返信はこの手紙を読める人に公開されます。
              </p>
              <button className="button" disabled={busy || !reply.trim()}>
                お返事を届ける
              </button>
            </form>
          ) : (
            <div className="info-strip">
              <Icon name="shield" />
              <p>
                自分の手紙と返信は、退出後もここで読めます。返信やリアクションには、公開期間内のチェックインが必要です。
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {!state.visit && !mine ? (
            <Empty icon="mail" title="手紙は、その場所で。">
              スポットにチェックインすると、その場所の手紙を読んだり、返信したりできます。
            </Empty>
          ) : !letters.length ? (
            <Empty
              icon="mail"
              title={
                mine
                  ? "まだ、あなたの手紙はありません"
                  : "最初の手紙を、置いてみませんか。"
              }
            >
              自分の手紙と届いた返信は、チェックアウトした後も確認できます。
            </Empty>
          ) : (
            <div className="letter-grid">
              {letters.map((l) => (
                <LetterCard
                  key={l.id}
                  letter={l}
                  open={() => setSelected(l.id)}
                  react={() =>
                    mutate(() =>
                      api("/letters/" + l.id + "/reaction", "POST", {
                        value: !l.reacted,
                      }),
                    )
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
      {mine && !selected && <OwnReplies run={run} busy={busy} />}
    </>
  );
}
function OwnReplies({ run, busy }) {
  const [replies, setReplies] = useState([]);
  const load = () => api("/replies/mine").then(setReplies);
  useEffect(() => {
    load().catch(() => {});
  }, []);
  return (
    <section className="own-replies">
      <h2>自分が書いた返信</h2>
      <p className="quiet">
        退出後も、自分の返信を削除できます。他の方の手紙は表示しません。
      </p>
      {replies.map((r) => (
        <article className="reply" key={r.id}>
          <div>
            <p>{r.body}</p>
            <small>{date(r.created_at)}</small>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("/content/reply/" + r.id, "DELETE");
                  await load();
                }, "返信を削除しました。")
              }
            >
              削除
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
function LetterCard({ letter, open, react }) {
  return (
    <article className="paper">
      <div className="letter-byline">
        <Avatar user={letter.author} />
        <div>
          <b>
            {letter.author.nickname}
            {!letter.anonymous && "さん"}
          </b>
          <small>
            {letter.spotName} · {date(letter.created_at)}
          </small>
        </div>
        {letter.own && <span className="tag">自分の手紙</span>}
        <Icon name="mail" />
      </div>
      <button className="letter-body" onClick={open}>
        {letter.body}
      </button>
      <div className="letter-bottom">
        <button
          className={"text-button " + (letter.reacted ? "reaction-active" : "")}
          disabled={!letter.canReply}
          onClick={react}
          aria-label="共感する"
          aria-pressed={letter.reacted}
        >
          <Icon name="heart" size={17} />
          {letter.reactions}
        </button>
        <button className="text-button" onClick={open}>
          <Icon name="chat" size={17} />
          お返事 {letter.replyCount}
        </button>
        <span>
          {new Date(letter.expires_at) > new Date()
            ? "7日間の置き手紙"
            : "公開終了"}
        </span>
      </div>
    </article>
  );
}
function Notifications({ state, run, go }) {
  return (
    <>
      <PageTitle
        title="お知らせ"
        description="育ったご縁や、新しい言葉が届いています。"
      />
      <div className="notification-list">
        {state.notifications.map((n) => (
          <button
            className={"notice " + (!n.is_read ? "unread" : "")}
            key={n.id}
            onClick={() =>
              run(async () => {
                await api("/notifications/" + n.id + "/read", "POST");
                go(n.kind === "eligible" ? "candidates" : "matches");
              })
            }
          >
            <span className="notice-icon">
              <Icon name={n.kind === "message" ? "chat" : "heart"} />
            </span>
            <div>
              <h2>{n.title}</h2>
              <p>{n.body}</p>
              <small>{date(n.created_at)}</small>
            </div>
            {!n.is_read && <span className="unread-dot" aria-label="未読" />}
            <Icon name="chevron" size={18} />
          </button>
        ))}
      </div>
      {!state.notifications.length && (
        <Empty icon="bell" title="今は、静かな時間。">
          縁の候補やマッチング、新しいメッセージが届いたら、ここでお知らせします。
        </Empty>
      )}
    </>
  );
}
function Profile({ state, run, busy, go }) {
  const [name, setName] = useState(state.user.nickname),
    [bio, setBio] = useState(state.user.bio),
    [avatar, setAvatar] = useState(state.user.avatar),
    [imageError, setImageError] = useState("");
  const image = async (file) => {
    setImageError("");
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5_000_000
    ) {
      setImageError("JPEG・PNG・WebP形式で5MB以内の画像を選んでください。");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d"),
        side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
      setAvatar(canvas.toDataURL("image/jpeg", 0.85));
      bitmap.close();
    } catch {
      setImageError("画像を読み込めません。別の画像でお試しください。");
    }
  };
  return (
    <>
      <PageTitle
        title="あなたのことを、少し。"
        description="プロフィールは、縁の候補になった方から表示されます。"
      />
      <form
        className="profile-form panel"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => api("/profile", "PATCH", { nickname: name, bio, avatar }),
            "プロフィールを保存しました。",
          );
        }}
      >
        <div className="avatar-editor">
          <Avatar user={{ nickname: name, avatar }} size="large" />
          <label className="button outline">
            写真を選ぶ
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => image(e.target.files[0])}
            />
          </label>
          {avatar && (
            <button
              type="button"
              className="text-button"
              onClick={() => setAvatar("")}
            >
              写真を削除
            </button>
          )}
        </div>
        {imageError && (
          <p className="field-error" role="alert">
            {imageError}
          </p>
        )}
        <label>
          ニックネーム
          <input
            required
            maxLength="30"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          自己紹介
          <textarea
            maxLength="300"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="好きな本や、好きなことなど。"
          />
        </label>
        <p className="quiet">
          メールアドレス：{state.user.email}（自分にのみ表示）
        </p>
        <p className="quiet">
          具体的な行動予定や連絡先は、プロフィールに書かないでください。
        </p>
        <button className="button" disabled={busy}>
          プロフィールを保存
        </button>
      </form>
      <button
        className="text-button settings-link"
        onClick={() => go("settings")}
      >
        <Icon name="settings" />
        アカウントとプライバシーの設定
      </button>
    </>
  );
}
function Settings({ state, run, busy, confirmAction, logout, go }) {
  const [blocks, setBlocks] = useState([]),
    [deleting, setDeleting] = useState(false),
    [password, setPassword] = useState("");
  useEffect(() => {
    api("/blocks")
      .then(setBlocks)
      .catch(() => {});
  }, [state]);
  return (
    <>
      <PageTitle title="設定" description="あなたが安心して過ごせるように。" />
      <div className="settings-grid">
        <section className="panel">
          <h2>
            <Icon name="shield" />
            プライバシーについて
          </h2>
          <p>
            現在地、チェックイン状態、具体的な滞在日時は、他のユーザーに公開されません。
          </p>
          <p>
            「縁を結ぶ」の選択や見送りも、双方の気持ちが重なるまでは、あなただけのものです。
          </p>
        </section>
        <section className="panel">
          <h2>ブロックしたユーザー</h2>
          {blocks.length ? (
            blocks.map((b) => (
              <div className="block-row" key={b.id}>
                <Avatar user={b} />
                <b>{b.nickname}さん</b>
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("/blocks/" + b.id, "POST", { value: false });
                      setBlocks(await api("/blocks"));
                    }, "ブロックを解除しました。再マッチングには双方の新たな同意が必要です。")
                  }
                >
                  解除
                </button>
              </div>
            ))
          ) : (
            <p className="muted">ブロックしているユーザーはいません。</p>
          )}
        </section>
        <section className="panel">
          <h2>アカウント</h2>
          {state.user.admin && (
            <button className="settings-row" onClick={() => go("admin")}>
              運営者向け・通報の確認
              <Icon name="chevron" />
            </button>
          )}
          <button className="settings-row" onClick={logout}>
            <span>
              <Icon name="logout" />
              ログアウト
            </span>
            <Icon name="chevron" />
          </button>
          <button
            className="settings-row danger-text"
            onClick={() => setDeleting(!deleting)}
          >
            アカウントを削除
            <Icon name="chevron" />
          </button>
          {deleting && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirmAction(
                  "アカウントを削除しますか？",
                  "この操作は取り消せません。プロフィール・投稿を非表示にし、すべてのチャットを終了します。",
                  () => api("/account", "DELETE", { password }),
                );
              }}
            >
              <p>確認のため、パスワードを入力してください。</p>
              <label>
                パスワード
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <button className="button danger" disabled={busy}>
                削除の確認へ
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
function Reports({ run, busy }) {
  const [reports, setReports] = useState([]),
    [error, setError] = useState("");
  const load = () =>
    api("/admin/reports")
      .then(setReports)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <PageTitle
        title="通報の確認"
        description="受付内容を確認し、対応状況を更新できます。"
      />
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!reports.length ? (
        <Empty icon="shield" title="未確認の通報はありません">
          新しい通報はここに表示されます。
        </Empty>
      ) : (
        reports.map((r) => (
          <article className="report panel" key={r.id}>
            <div className="section-heading">
              <b>
                {
                  { user: "ユーザー", letter: "置き手紙", reply: "返信" }[
                    r.target_type
                  ]
                }
                への通報
              </b>
              <time>
                {date(r.created_at)} {time(r.created_at)}
              </time>
            </div>
            <p>{r.reason}</p>
            <blockquote>{r.snapshot}</blockquote>
            <p className="quiet">
              対象：{r.target_id}
              <br />
              通報者：{r.reporter_id}
              <br />
              受付ID：{r.id}
            </p>
            <label>
              対応状況
              <select
                disabled={busy}
                value={r.status}
                onChange={(e) =>
                  run(async () => {
                    await api("/admin/reports/" + r.id, "PATCH", {
                      status: e.target.value,
                    });
                    await load();
                  }, "対応状況を更新しました。")
                }
              >
                {Object.entries({
                  open: "未対応",
                  reviewing: "確認中",
                  resolved: "対応済み",
                  dismissed: "対象外",
                }).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </article>
        ))
      )}
    </>
  );
}
function Modal({ title, close, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="閉じる" onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

createRoot(document.getElementById("root")).render(<App />);
