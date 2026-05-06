// AWS Lambda: order-processor
// Runtime: nodejs20.x | Memory: 3072 MB | Avg duration: 920 ms | Invocations/mo: 2.4M
//
// This file is intentionally suboptimal — the code agent should flag the
// cost anti-patterns in it. Keeping it in the repo so demo scans have real
// source to read.

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import * as XLSX from "xlsx"; // 6 MB at module load — we don't even use it on most invocations

type OrderEvent = {
  orderIds: string[];
  notifyAdminEmail?: string;
};

export const handler = async (event: OrderEvent) => {
  // Clients re-created on every invocation. They should live above the handler
  // so connection pools survive between warm invocations.
  const s3 = new S3Client({});
  const ddb = new DynamoDBClient({});
  const ses = new SESClient({});

  const orders: unknown[] = [];

  // One DynamoDB GetItem call per order, awaited sequentially.
  // 100 orders = 100 round trips. BatchGetItem can do 100 in 1 call.
  for (const id of event.orderIds) {
    const cmd = new GetItemCommand({
      TableName: "orders",
      Key: { id: { S: id } },
    });
    const result = await ddb.send(cmd);
    orders.push(result.Item);
  }

  // Loads the entire order archive (often >50 MB) into Lambda memory just to
  // filter the last 24 hours. Should be a Date-range query against an indexed
  // store, not a full S3 download + JS filter.
  const archiveObj = await s3.send(
    new GetObjectCommand({ Bucket: "orders-archive", Key: "all-history.json" })
  );
  const fullHistory = JSON.parse(await archiveObj.Body!.transformToString());
  const recent = fullHistory.filter(
    (h: { timestamp: number }) => h.timestamp > Date.now() - 86_400_000
  );

  // Email send is wrapped in await but we don't use the result — could fire
  // and forget after the response is computed. Keeps cold invocation latency
  // bounded by the SES round-trip.
  if (event.notifyAdminEmail) {
    await ses.send(
      new SendEmailCommand({
        Source: "ops@cloudsync.demo",
        Destination: { ToAddresses: [event.notifyAdminEmail] },
        Message: {
          Subject: { Data: "Order batch processed" },
          Body: { Text: { Data: `Processed ${orders.length} orders` } },
        },
      })
    );
  }

  return { orders, recent };
};
