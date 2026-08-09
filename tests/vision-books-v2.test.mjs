import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { beforeEach, mock, test } from "node:test";

const sourceRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return {
        shortCircuit: true,
        url: new URL(`${specifier.slice(2)}.ts`, sourceRoot).href,
      };
    }

    if (specifier === "next/server") {
      return nextResolve(`${specifier}.js`, context);
    }

    return nextResolve(specifier, context);
  },
});

function createAsyncStub() {
  const stub = async (...args) => {
    stub.calls.push(args);
    return stub.implementation(...args);
  };
  stub.calls = [];
  stub.implementation = async () => null;
  stub.reset = () => {
    stub.calls = [];
    stub.implementation = async () => null;
  };
  return stub;
}

const getServerSession = createAsyncStub();
const bookFindFirst = createAsyncStub();
const bookUpdate = createAsyncStub();
const bookDeleteMany = createAsyncStub();
const visionDeleteMany = createAsyncStub();

const prisma = {
  book: {
    findFirst: bookFindFirst,
    update: bookUpdate,
    deleteMany: bookDeleteMany,
  },
  visionImage: {
    deleteMany: visionDeleteMany,
  },
};

mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});
mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  namedExports: { authOptions: {} },
});
mock.module("next-auth/next", { namedExports: { getServerSession } });

const { NextRequest } = await import("next/server");
const { PATCH: patchBook, DELETE: deleteBook } = await import(
  "../src/app/api/books/[id]/route.ts"
);
const { DELETE: deleteVision } = await import("../src/app/api/vision/route.ts");
const {
  createBookPayloadSchema,
  createVisionImagePayloadSchema,
  updateBookProgressPayloadSchema,
} = await import("../src/lib/api-validation.ts");

const USER_ID = "user-1";
const BOOK_ID = "11111111-1111-4111-8111-111111111111";
const VISION_ID = "22222222-2222-4222-8222-222222222222";
const stubs = [
  getServerSession,
  bookFindFirst,
  bookUpdate,
  bookDeleteMany,
  visionDeleteMany,
];

beforeEach(() => {
  for (const stub of stubs) stub.reset();
});

function authenticate(userId = USER_ID) {
  getServerSession.implementation = async () => ({ user: { id: userId } });
}

function bookPatchRequest(payload) {
  return new NextRequest(`http://localhost/api/books/${BOOK_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function bodyWithStatus(response, status) {
  assert.equal(response.status, status);
  return response.json();
}

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("books and vision payloads are strict", () => {
  assert.equal(
    createBookPayloadSchema.safeParse({
      title: "Livro",
      author: "Autor",
      totalPages: 300,
      userId: "attacker",
    }).success,
    false
  );
  assert.equal(
    createBookPayloadSchema.safeParse({
      title: "Livro",
      author: "Autor",
      totalPages: 0,
    }).success,
    false
  );
  assert.equal(
    updateBookProgressPayloadSchema.safeParse({ readPages: -1 }).success,
    false
  );
  assert.equal(
    updateBookProgressPayloadSchema.safeParse({ readPages: 12.5 }).success,
    false
  );
  assert.equal(
    createVisionImagePayloadSchema.safeParse({
      imageUrl: "not-a-url",
    }).success,
    false
  );
  assert.equal(
    createVisionImagePayloadSchema.safeParse({
      imageUrl: "https://example.com/image.jpg",
      userId: "attacker",
    }).success,
    false
  );
});

test("book progress returns 401 without a session", async () => {
  const response = await patchBook(bookPatchRequest({ readPages: 10 }), {
    params: Promise.resolve({ id: BOOK_ID }),
  });

  await bodyWithStatus(response, 401);
  assert.equal(bookFindFirst.calls.length, 0);
});

test("book progress validates id and payload before ownership lookup", async () => {
  authenticate();
  const response = await patchBook(bookPatchRequest({ readPages: -1 }), {
    params: Promise.resolve({ id: "invalid-id" }),
  });

  await bodyWithStatus(response, 400);
  assert.equal(bookFindFirst.calls.length, 0);
});

test("book progress returns 404 outside ownership", async () => {
  authenticate();
  bookFindFirst.implementation = async () => null;

  const response = await patchBook(bookPatchRequest({ readPages: 10 }), {
    params: Promise.resolve({ id: BOOK_ID }),
  });

  await bodyWithStatus(response, 404);
  assert.deepEqual(bookFindFirst.calls[0][0], {
    where: { id: BOOK_ID, userId: USER_ID },
    select: { id: true, totalPages: true },
  });
  assert.equal(bookUpdate.calls.length, 0);
});

test("book progress cannot exceed total pages", async () => {
  authenticate();
  bookFindFirst.implementation = async () => ({ id: BOOK_ID, totalPages: 100 });

  const response = await patchBook(bookPatchRequest({ readPages: 101 }), {
    params: Promise.resolve({ id: BOOK_ID }),
  });

  const body = await bodyWithStatus(response, 400);
  assert.match(body.error, /exceder/);
  assert.equal(bookUpdate.calls.length, 0);
});

test("book progress updates an owned book", async () => {
  authenticate();
  const updated = {
    id: BOOK_ID,
    title: "Livro",
    author: "Autor",
    totalPages: 100,
    readPages: 45,
    userId: USER_ID,
  };
  bookFindFirst.implementation = async () => ({ id: BOOK_ID, totalPages: 100 });
  bookUpdate.implementation = async () => updated;

  const response = await patchBook(bookPatchRequest({ readPages: 45 }), {
    params: Promise.resolve({ id: BOOK_ID }),
  });
  const body = await bodyWithStatus(response, 200);

  assert.equal(body.readPages, 45);
  assert.deepEqual(bookUpdate.calls[0][0], {
    where: { id: BOOK_ID },
    data: { readPages: 45 },
  });
});

test("book delete is scoped to the authenticated user", async () => {
  authenticate();
  bookDeleteMany.implementation = async () => ({ count: 1 });

  const response = await deleteBook(
    new NextRequest(`http://localhost/api/books/${BOOK_ID}`, { method: "DELETE" }),
    { params: Promise.resolve({ id: BOOK_ID }) }
  );

  await bodyWithStatus(response, 200);
  assert.deepEqual(bookDeleteMany.calls[0][0], {
    where: { id: BOOK_ID, userId: USER_ID },
  });
});

test("vision delete validates id and scopes deletion to the session", async () => {
  authenticate();

  const invalidResponse = await deleteVision(
    new NextRequest("http://localhost/api/vision?id=invalid-id", {
      method: "DELETE",
    })
  );
  await bodyWithStatus(invalidResponse, 400);
  assert.equal(visionDeleteMany.calls.length, 0);

  visionDeleteMany.implementation = async () => ({ count: 1 });
  const response = await deleteVision(
    new NextRequest(`http://localhost/api/vision?id=${VISION_ID}`, {
      method: "DELETE",
    })
  );
  await bodyWithStatus(response, 200);
  assert.deepEqual(visionDeleteMany.calls[0][0], {
    where: { id: VISION_ID, userId: USER_ID },
  });
});

test("vision uploader authenticates the file route and persists server-side", () => {
  const core = read("src/app/api/uploadthing/core.ts");
  const route = read("src/app/api/uploadthing/route.ts");

  assert.match(core, /getToken/);
  assert.match(core, /\.middleware\(async \(\{ req \}\)/);
  assert.match(core, /token\?\.sub/);
  assert.match(core, /UploadThingError/);
  assert.match(core, /userId: token\.sub/);
  assert.match(core, /file\.ufsUrl/);
  assert.match(core, /userId: metadata\.userId/);
  assert.match(core, /prisma\.visionImage\.create/);
  assert.match(route, /createRouteHandler/);
  assert.doesNotMatch(route, /getServerSession|getToken/);
});

test("books and vision pages use dedicated foundation workspaces", () => {
  const books = read("src/app/livros/page.tsx");
  const vision = read("src/app/visao/page.tsx");
  const goals = read("src/app/metas/page.tsx");
  const navigation = read("src/components/application-navigation.ts");

  for (const source of [books, vision]) {
    assert.match(source, /PageHeader/);
    assert.match(source, /LoadingState/);
    assert.match(source, /EmptyState/);
    assert.match(source, /ErrorState/);
  }

  assert.match(books, /\/api\/books\/\$\{book\.id\}/);
  assert.match(books, /readPages === book\.totalPages/);
  assert.match(vision, /serverData\?\.image/);
  assert.doesNotMatch(vision, /method:\s*"POST"[\s\S]*\/api\/vision/);
  assert.doesNotMatch(goals, /\/api\/books|interface Book|Fontes de conhecimento/);
  assert.match(navigation, /href: "\/livros"/);
});
