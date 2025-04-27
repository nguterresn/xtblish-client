import got, { PlainResponse } from "got";
import { xtblishConfig } from "./config.js";
import { failure, ok, Result } from "./utils/result.js";
import dotenv from "dotenv";
dotenv.config();
export interface provisionOptions {
  board: string;
  config: string;
  flash?: boolean;
}

export async function getFactoryImage(
  board: string,
  config: xtblishConfig
): Promise<Result<PlainResponse>> {
  const urlSafeBoard = board.replace(/\//g, "-");
  let response;
  try {
    response = await got.get(
      `https://${process.env.HOST}/factory/image/${urlSafeBoard}`,
      {
        headers: {
          Authorization: `${config.user.apiKey}`,
        },
      }
    );
  } catch (e: any) {
    return failure(
      `On attempt to GET /factory/image/${urlSafeBoard}: ${
        e instanceof Error ? e.message : e
      }`
    );
  }

  return ok(response);
}
