import { anyApi, type ApiFromModules, type FilterApi, type FunctionReference } from "convex/server";
import type * as store from "../store";
import type * as intelligence from "../intelligence";
type Modules = ApiFromModules<{ store: typeof store; intelligence: typeof intelligence }>;
export const api = anyApi as unknown as FilterApi<Modules, FunctionReference<"query" | "mutation" | "action", "public">>;
