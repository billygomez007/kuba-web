import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  aiEmployees,
  knowledgeSources,
} from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";

import { ingestKnowledgeSource } from "@/lib/knowledge/ingest";


const MAX_FILE_SIZE =
  100 * 1024 * 1024;


const ALLOWED_TYPES = new Set([
  "application/pdf",

  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "text/csv",
  "text/plain",

  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  "video/mp4",
  "video/webm",
  "video/quicktime",
]);


function getFileType(
  mimeType: string,
  fileName: string,
) {
  const extension =
    path
      .extname(fileName)
      .replace(".", "")
      .toLowerCase();


  if (
    mimeType ===
    "application/pdf"
  ) {
    return "pdf";
  }


  if (
    mimeType ===
      "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "word";
  }


  if (
    mimeType ===
      "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "excel";
  }


  if (
    mimeType === "text/csv" ||
    extension === "csv"
  ) {
    return "csv";
  }


  if (
    mimeType === "text/plain" ||
    extension === "txt"
  ) {
    return "text";
  }


  if (
    mimeType.startsWith("image/")
  ) {
    return "image";
  }


  if (
    mimeType.startsWith("video/")
  ) {
    return "video";
  }


  return extension || "file";
}


export async function POST(
  request: Request,
) {
  try {

    const session =
      await auth.api.getSession({
        headers: await headers(),
      });


    if (!session?.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }


    const business = await getCurrentMembership();


    if (!business) {
      return NextResponse.json(
        {
          error:
            "Business not found",
        },
        {
          status: 404,
        },
      );
    }
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.KNOWLEDGE_MANAGE)) return NextResponse.json({ error: "Knowledge management access denied." }, { status: 403 });


    const formData =
      await request.formData();


    const file =
      formData.get("file");

    const employeeIdValue =
      formData.get("employeeId");

    const employeeId =
      employeeIdValue
        ? String(employeeIdValue).trim()
        : null;


    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Please select a file to upload.",
        },
        {
          status: 400,
        },
      );
    }


    if (employeeId) {
      const employee =
        await db
          .select({
            id: aiEmployees.id,
          })
          .from(aiEmployees)
          .where(
            and(
              eq(
                aiEmployees.id,
                employeeId,
              ),
              eq(
                aiEmployees.businessId,
                business.businessId,
              ),
            ),
          )
          .limit(1);

      if (!employee[0]) {
        return NextResponse.json(
          {
            error:
              "AI employee not found.",
          },
          {
            status: 404,
          },
        );
      }
    }


    if (file.size <= 0) {
      return NextResponse.json(
        {
          error:
            "The selected file is empty.",
        },
        {
          status: 400,
        },
      );
    }


    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "Files must be 100 MB or smaller.",
        },
        {
          status: 400,
        },
      );
    }


    if (
      !ALLOWED_TYPES.has(
        file.type,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This file type is not supported yet.",
          supportedTypes: [
            "PDF",
            "Word",
            "Excel",
            "CSV",
            "Text",
            "Images",
            "Videos",
          ],
        },
        {
          status: 400,
        },
      );
    }


    const originalName =
      path.basename(file.name);


    const extension =
      path.extname(
        originalName,
      );


    const fileId =
      crypto.randomUUID();


    const storageKey =
      `${business.businessId}/${fileId}${extension}`;


    const storageRoot =
      path.join(
        process.cwd(),
        "storage",
        "knowledge",
      );


    const businessDirectory =
      path.join(
        storageRoot,
        business.businessId,
      );


    await mkdir(
      businessDirectory,
      {
        recursive: true,
      },
    );


    const storagePath =
      path.join(
        businessDirectory,
        `${fileId}${extension}`,
      );


    const bytes =
      await file.arrayBuffer();


    const buffer =
      Buffer.from(bytes);


    await writeFile(
      storagePath,
      buffer,
    );


    const now =
      new Date();


    const fileType =
      getFileType(
        file.type,
        originalName,
      );


    const source = {
      id: fileId,

      businessId:
        business.businessId,

      employeeId,

      name:
        originalName
          .replace(extension, "")
          .trim() ||
        originalName,

      originalName,

      fileType,

      mimeType:
        file.type || null,

      fileSize:
        file.size,

      storageKey,

      status:
        "processing",

      processingError:
        null,

      description:
        null,

      createdAt:
        now,

      updatedAt:
        now,
    };


    await db
      .insert(
        knowledgeSources,
      )
      .values(source);


    /*
     * Images and videos are accepted and
     * stored, but their AI processing pipeline
     * will be added separately.
     *
     * Text-based files are processed immediately.
     */

    if (
      fileType === "pdf" ||
      fileType === "word" ||
      fileType === "excel" ||
      fileType === "csv" ||
      fileType === "text"
    ) {

      await ingestKnowledgeSource(
        fileId,
        buffer,
      );

    } else {

      await db
        .update(
          knowledgeSources,
        )
        .set({
          status:
            "stored",

          updatedAt:
            new Date(),
        })
        .where(
          eq(
            knowledgeSources.id,
            fileId,
          ),
        );

    }


    const updatedSource =
      await db
        .select()
        .from(
          knowledgeSources,
        )
        .where(
          eq(
            knowledgeSources.id,
            fileId,
          ),
        )
      .limit(1);

    await createAuditLog({ businessId: business.businessId, userId: session.user.id, action: "business_brain.source.uploaded", resource: "knowledge_source", resourceId: fileId, description: `Uploaded knowledge source ${originalName}.`, metadata: { fileType, employeeId, status: updatedSource[0]?.status || source.status } });


    return NextResponse.json(
      {
        success: true,

        source:
          updatedSource[0] ||
          source,
      },
      {
        status: 201,
      },
    );


  } catch (error) {

    console.error(
      "Knowledge file upload error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload knowledge file.",
      },
      {
        status: 500,
      },
    );
  }
}
