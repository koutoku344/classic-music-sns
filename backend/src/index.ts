  interface Env {
    DATABASE_URL: string;
  }

  export default {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return Response.json(
          { status: "ok", service: "sonolii-api" },
          { headers: { "Cache-Control": "no-store" } },
        );
      }

      return Response.json(
        { error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    },
  };
