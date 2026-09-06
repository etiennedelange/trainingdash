import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root";
import { Route as indexRoute } from "./routes/index";
import { Route as activitiesRoute } from "./routes/activities";
import { Route as progressRoute } from "./routes/progress";

const routeTree = rootRoute.addChildren([indexRoute, activitiesRoute, progressRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
