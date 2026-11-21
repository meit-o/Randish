// Matches the existing Spring Boot /api/health response. This function is
// intentionally independent of user data and does not imply database health.
Deno.serve((request: Request) => {
  if (request.method !== "GET") {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }
  return Response.json({ status: "ok" });
});
