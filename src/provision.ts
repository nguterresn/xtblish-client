import got, { PlainResponse } from "got";
import { xtblishConfig } from "./config.js";
import { failure, ok, Result } from "./utils/result.js";

export interface provisionOptions {
  board: string;
  config: string;
  flash?: boolean;
}

export async function getFactoryImage(
  board: string,
  config: xtblishConfig
): Promise<Result<PlainResponse>> {
  let response;
  try {
    response = await got.get(
      `http://192.168.0.140:3000/factory/image/${board}`,
      {
        headers: {
          Authorization: `${config.user.apiKey}`,
        },
      }
    );
  } catch (e: any) {
    return failure(
      `On attempt to GET /factory/image/${board}: ${
        e instanceof Error ? e.message : e
      }`
    );
  }

  return ok(response);
}
