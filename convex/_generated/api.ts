import { anyApi, type ApiFromModules, type FilterApi, type FunctionReference } from "convex/server";
import type * as store from "../store";
import type * as intelligence from "../intelligence";
import type * as admin from "../admin";
type Modules = ApiFromModules<{ store: typeof store; intelligence: typeof intelligence; admin: typeof admin }>;
export const api = anyApi as unknown as FilterApi<Modules, FunctionReference<"query" | "mutation" | "action", "public">>;
