export type LogCtx = Record<string, unknown>;

function ts() {
  return new Date().toISOString();
}

export function info(msg: string, ctx: LogCtx = {}) {
  console.log(`[INFO] ${ts()} ${msg}`, Object.keys(ctx).length ? ctx : "");
}

export function warn(msg: string, ctx: LogCtx = {}) {
  console.warn(`[WARN] ${ts()} ${msg}`, Object.keys(ctx).length ? ctx : "");
}

export function error(msg: string, ctx: LogCtx = {}) {
  console.error(`[ERROR] ${ts()} ${msg}`, Object.keys(ctx).length ? ctx : "");
}