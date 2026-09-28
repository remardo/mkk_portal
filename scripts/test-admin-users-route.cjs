const fs = require("fs");
const path = require("path");
const Module = require("module");
const assert = require("assert");

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const ts = require("typescript");

const routePath = path.join(
  __dirname,
  "..",
  "src",
  "app",
  "api",
  "admin",
  "users",
  "route.ts"
);
const source = fs.readFileSync(routePath, "utf8");
const { outputText, diagnostics } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
    esModuleInterop: true,
  },
});
const errors = (diagnostics || []).filter(
  (d) => d.category === ts.DiagnosticCategory.Error
);
assert.strictEqual(errors.length, 0, "route.ts must transpile without errors");

const mockState = {
  user: null,
  profile: null,
  body: null,
  origin: null,
  serviceBehavior: {},
  calls: {},
};

function resetCalls() {
  mockState.calls = {};
}

function makeCookieClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: mockState.user } }),
    },
    from: (table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: mockState.profile,
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error("unexpected cookie table: " + table);
    },
  };
}

function makeServiceClient() {
  mockState.calls.serviceCreated = true;
  return {
    from: (table) => {
      if (table === "branches") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: mockState.serviceBehavior.branchData || null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          update: (payload) => {
            mockState.calls.profileUpdateArgs = payload;
            return {
              eq: (col, val) => {
                mockState.calls.profileUpdateEq = { col, val };
                return {
                  select: () => ({
                    single: async () => {
                      if (mockState.serviceBehavior.profileUpdateError) {
                        return {
                          data: null,
                          error: mockState.serviceBehavior.profileUpdateError,
                        };
                      }
                      if (mockState.serviceBehavior.profileUpdateMissing) {
                        return { data: null, error: null };
                      }
                      return {
                        data:
                          mockState.serviceBehavior.profileUpdateData || {
                            id: val,
                          },
                        error: null,
                      };
                    },
                  }),
                };
              },
            };
          },
        };
      }
      throw new Error("unexpected service table: " + table);
    },
    auth: {
      admin: {
        createUser: async (args) => {
          mockState.calls.createUserArgs = args;
          if (mockState.serviceBehavior.createUserError) {
            return {
              data: { user: null },
              error: mockState.serviceBehavior.createUserError,
            };
          }
          return {
            data: { user: mockState.serviceBehavior.createUserData },
            error: null,
          };
        },
        deleteUser: async (id) => {
          mockState.calls.deleteUserCalledWith = id;
          return { error: null };
        },
      },
    },
  };
}

const NextResponse = {
  json: (body, init) => ({
    status: (init && init.status) || 200,
    headers: {
      get: (k) => (init && init.headers && init.headers[k]) || null,
    },
    _body: body,
    json: async () => body,
  }),
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "next/server")
    return { NextResponse, NextRequest: class {} };
  if (request === "@/lib/supabase/server")
    return { createClient: async () => makeCookieClient() };
  if (request === "@supabase/supabase-js")
    return { createClient: (...a) => makeServiceClient() };
  return origLoad.apply(this, arguments);
};

const routeModule = new Module(routePath, null);
routeModule.filename = routePath;
routeModule.paths = Module._nodeModulePaths(path.dirname(routePath));
routeModule._compile(outputText, routePath);
const { POST } = routeModule.exports;
assert.strictEqual(typeof POST, "function", "route must export POST");

function makeReq() {
  return {
    nextUrl: { origin: "http://localhost:3000" },
    headers: {
      get: (name) =>
        String(name).toLowerCase() === "origin" ? mockState.origin || null : null,
    },
    json: async () => mockState.body,
  };
}

async function run() {
  // 1. unauth -> 401
  resetCalls();
  mockState.user = null;
  mockState.profile = null;
  mockState.body = null;
  mockState.origin = null;
  mockState.serviceBehavior = {};
  let res = await POST(makeReq());
  assert.strictEqual(res.status, 401, "unauth must be 401");
  console.log("PASS unauth401");

  // 2. non-admin -> 403, service client must not be created
  resetCalls();
  mockState.user = { id: "u1" };
  mockState.profile = { role: "agent", is_active: true };
  mockState.origin = null;
  mockState.body = {
    full_name: "Test",
    email: "t@example.com",
    role: "agent",
  };
  mockState.serviceBehavior = {};
  res = await POST(makeReq());
  assert.strictEqual(res.status, 403, "nonadmin must be 403");
  assert.strictEqual(
    mockState.calls.serviceCreated,
    undefined,
    "service client must not be created before admin check"
  );
  console.log("PASS nonadmin403");

  // 3. invalid body -> 400
  resetCalls();
  mockState.user = { id: "admin1" };
  mockState.profile = { role: "it_admin", is_active: true };
  mockState.origin = null;
  mockState.body = { full_name: "", email: "not-an-email", role: "agent" };
  mockState.serviceBehavior = {};
  res = await POST(makeReq());
  assert.strictEqual(res.status, 400, "invalid body must be 400");
  console.log("PASS invalid400");

  // 4. success: signup called, profile role/phone/branch mapped
  resetCalls();
  const branchId = "123e4567-e89b-12d3-a456-426614174000";
  mockState.user = { id: "admin1" };
  mockState.profile = { role: "it_admin", is_active: true };
  mockState.origin = null;
  mockState.body = {
    full_name: "  Ivanov Ivan  ",
    email: "newuser@example.com",
    phone: "+79990001122",
    role: "branch_manager",
    branch_id: branchId,
  };
  mockState.serviceBehavior = {
    branchData: { id: branchId, is_active: true },
    createUserData: { id: "new-user-id" },
  };
  res = await POST(makeReq());
  assert.strictEqual(res.status, 201, "success must be 201");
  assert.ok(
    mockState.calls.createUserArgs,
    "service createUser must be called"
  );
  assert.strictEqual(
    mockState.calls.createUserArgs.email,
    "newuser@example.com"
  );
  assert.strictEqual(mockState.calls.createUserArgs.email_confirm, true);
  assert.deepStrictEqual(
    Object.keys(mockState.calls.createUserArgs.user_metadata || {}),
    ["full_name"],
    "user_metadata must contain full_name only"
  );
  assert.strictEqual(
    mockState.calls.profileUpdateArgs.role,
    "branch_manager"
  );
  assert.strictEqual(
    mockState.calls.profileUpdateArgs.phone,
    "+79990001122"
  );
  assert.strictEqual(
    mockState.calls.profileUpdateArgs.branch_id,
    branchId
  );
  assert.strictEqual(mockState.calls.profileUpdateEq.val, "new-user-id");
  assert.ok(res._body.temporary_password, "must return temporary_password");
  assert.ok(res._body.user && res._body.user.id === "new-user-id");
  assert.strictEqual(
    res.headers.get("Cache-Control"),
    "no-store",
    "must send Cache-Control: no-store"
  );
  console.log("PASS signup+profile");

  // 5. rollback on failed profile update
  resetCalls();
  mockState.user = { id: "admin1" };
  mockState.profile = { role: "it_admin", is_active: true };
  mockState.body = {
    full_name: "Petrov Petr",
    email: "p@example.com",
    role: "agent",
    branch_id: null,
  };
  mockState.origin = null;
  mockState.serviceBehavior = {
    createUserData: { id: "rollback-id" },
    profileUpdateError: { message: "db fail" },
  };
  res = await POST(makeReq());
  assert.strictEqual(res.status, 502, "failed profile must be 502");
  assert.strictEqual(
    mockState.calls.deleteUserCalledWith,
    "rollback-id",
    "must rollback auth user on profile failure"
  );
  console.log("PASS rollback");

  // 6. missing row -> rollback 502
  resetCalls();
  mockState.user = { id: "admin1" };
  mockState.profile = { role: "it_admin", is_active: true };
  mockState.body = {
    full_name: "Sidorov Sidr",
    email: "s@example.com",
    role: "agent",
    branch_id: null,
  };
  mockState.origin = null;
  mockState.serviceBehavior = {
    createUserData: { id: "missing-row-id" },
    profileUpdateMissing: true,
  };
  res = await POST(makeReq());
  assert.strictEqual(res.status, 502, "missing profile row must be 502");
  assert.strictEqual(
    mockState.calls.deleteUserCalledWith,
    "missing-row-id",
    "must rollback auth user on missing profile row"
  );
  console.log("PASS missing-row-rollback");

  // 7. mismatched Origin -> 403
  resetCalls();
  mockState.user = { id: "admin1" };
  mockState.profile = { role: "it_admin", is_active: true };
  mockState.body = {
    full_name: "Test",
    email: "t@example.com",
    role: "agent",
  };
  mockState.origin = "https://evil.invalid";
  mockState.serviceBehavior = {};
  res = await POST(makeReq());
  assert.strictEqual(res.status, 403, "mismatched origin must be 403");
  console.log("PASS origin403");

  // 8. inactive admin -> 403, service client must not be created
  resetCalls();
  mockState.user = { id: "admin1" };
  mockState.profile = { role: "it_admin", is_active: false };
  mockState.body = {
    full_name: "Test",
    email: "t@example.com",
    role: "agent",
  };
  mockState.origin = null;
  mockState.serviceBehavior = {};
  res = await POST(makeReq());
  assert.strictEqual(res.status, 403, "inactive admin must be 403");
  assert.strictEqual(
    mockState.calls.serviceCreated,
    undefined,
    "service client must not be created for inactive admin"
  );
  console.log("PASS inactive-admin403");

  // 9. duplicate email -> 409, no rollback delete
  resetCalls();
  mockState.user = { id: "admin1" };
  mockState.profile = { role: "it_admin", is_active: true };
  mockState.body = {
    full_name: "Dup User",
    email: "dup@example.com",
    role: "agent",
  };
  mockState.origin = null;
  mockState.serviceBehavior = {
    createUserError: { message: "User already registered" },
  };
  res = await POST(makeReq());
  assert.strictEqual(res.status, 409, "duplicate email must be 409");
  assert.strictEqual(
    mockState.calls.deleteUserCalledWith,
    undefined,
    "must not delete on duplicate"
  );
  console.log("PASS duplicate409");

  console.log("ALL PASS");
}

run().catch((e) => {
  console.error("FAIL", e && e.message ? e.message : e);
  process.exit(1);
});
