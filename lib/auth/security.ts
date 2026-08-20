import { NextResponse } from "next/server";

export function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "Unauthorized",
    },
    {
      status: 401,
    },
  );
}

export function forbiddenResponse() {
  return NextResponse.json(
    {
      error: "Forbidden",
      message:
        "You do not have permission to perform this action.",
    },
    {
      status: 403,
    },
  );
}

export function notFoundResponse() {
  return NextResponse.json(
    {
      error: "Not found",
    },
    {
      status: 404,
    },
  );
}
