// Local ENISHI launcher. Does not read Randish's .env files.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(root, "server");
const windows = process.platform === "win32";
const args = new Set(process.argv.slice(2));
for (const arg of args)
  if (!["--demo", "--test", "--build"].includes(arg))
    throw new Error(
      "使用方法: node scripts/enishi.mjs [--demo | --test | --build]",
    );
function javaExecutable() {
  if (process.env.JAVA_HOME)
    return join(process.env.JAVA_HOME, "bin", windows ? "java.exe" : "java");
  if (windows)
    for (const base of [
      "C:/Program Files/Java",
      "C:/Program Files/Eclipse Adoptium",
    ]) {
      if (!existsSync(base)) continue;
      const jdk = readdirSync(base)
        .filter((n) => n.startsWith("jdk"))
        .sort()
        .reverse()[0];
      if (jdk) return join(base, jdk, "bin", "java.exe");
    }
  return "java";
}
const java = javaExecutable();
function mavenCommand(goals) {
  let home = process.env.MAVEN_HOME || process.env.M2_HOME;
  if (!home && windows) {
    try {
      home = resolve(
        dirname(
          execFileSync("where.exe", ["mvn.cmd"], { encoding: "utf8" })
            .trim()
            .split(/\r?\n/)[0],
        ),
        "..",
      );
    } catch {}
  }
  if (home && existsSync(join(home, "boot"))) {
    const jar = readdirSync(join(home, "boot")).find(
      (n) => n.startsWith("plexus-classworlds-") && n.endsWith(".jar"),
    );
    return [
      java,
      [
        `-Dmaven.home=${home}`,
        `-Dclassworlds.conf=${join(home, "bin", "m2.conf")}`,
        `-Dmaven.multiModuleProjectDirectory=${server}`,
        "-cp",
        join(home, "boot", jar),
        "org.codehaus.plexus.classworlds.launcher.Launcher",
        ...goals,
      ],
      false,
    ];
  }
  return [windows ? "mvn.cmd" : "mvn", goals, windows];
}
async function run(command, arguments_, cwd, shell = false) {
  const child = spawn(command, arguments_, { cwd, shell, stdio: "inherit" });
  const interrupt = () => child.kill("SIGINT");
  process.once("SIGINT", interrupt);
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) =>
        code === 0 || signal === "SIGINT"
          ? resolve()
          : reject(
              new Error(`${command} が終了コード ${code} で停止しました。`),
            ),
      );
    });
  } finally {
    process.removeListener("SIGINT", interrupt);
  }
}
async function maven(goals) {
  const [command, parameters, shell] = mavenCommand(goals);
  await run(command, parameters, server, shell);
}
async function npm(parameters) {
  const cli = join(
    dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  if (windows && existsSync(cli))
    return run(process.execPath, [cli, ...parameters], join(root, "web"));
  return run(
    windows ? "npm.cmd" : "npm",
    parameters,
    join(root, "web"),
    windows,
  );
}
try {
  if (args.has("--test")) {
    await maven(["-Dtest=EnishiServiceTest", "test"]);
  } else {
    if (!existsSync(join(root, "web", "node_modules")))
      await npm(["ci", "--no-audit", "--no-fund"]);
    await npm(["run", "build"]);
    if (args.has("--build")) await maven(["-DskipTests", "package"]);
    else {
      await maven([
        "-q",
        "-DskipTests",
        "compile",
        "dependency:build-classpath",
        "-Dmdep.outputFile=target/enishi-classpath.txt",
      ]);
      const classpath =
        join(server, "target", "classes") +
        (windows ? ";" : ":") +
        readFileSync(
          join(server, "target", "enishi-classpath.txt"),
          "utf8",
        ).trim();
      const parameters = [
        "-cp",
        classpath,
        "com.example.enishi.EnishiApplication",
      ];
      if (args.has("--demo"))
        parameters.push(
          "--enishi.demo.enabled=true",
          "--spring.datasource.url=jdbc:h2:file:./data/enishi-demo;MODE=PostgreSQL;DATABASE_TO_UPPER=false",
        );
      console.log(
        `\nENISHI: http://127.0.0.1:${process.env.ENISHI_PORT || 8085}/enishi/index.html\n終了: Ctrl+C\n`,
      );
      await run(java, parameters, server);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
