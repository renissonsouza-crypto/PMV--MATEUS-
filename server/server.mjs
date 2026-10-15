import "./config/environment.mjs";
// Ponto de entrada local. O controller coordena as rotas e os models SQLite.
import { requireSupportedNode } from "../scripts/dev-config.mjs";

requireSupportedNode();
await import("./controllers/localServerController.mjs");
