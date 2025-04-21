import { jest } from '@jest/globals';
import { execSync } from 'child_process';
import got from "got";
import { signEncryptApp, postApplication } from "../dist/build"
import { checkEnvVariables } from "../dist/utils/config"
import { Result } from '../dist/utils/result';

jest.mock('got');
got.post = jest.fn();

const testSignKey = "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEICddxLgkW1jk8G7A8e7FcFrOvDIB58wh5SDB+j3ZJCF5\n-----END PRIVATE KEY-----";

describe('CLI', () => {
  it('Displays help when called with --help', () => {
    const output = execSync('node dist/index.js --help').toString();
    expect(output).toContain('xtblish CLI');
  });

  it('Opens and parses xtblish config correctly', () => {
    let result = null

    let path = null
    result = checkEnvVariables(path);
    expect(result.isError()).toEqual(true);

    path = ".xtblish.json"
    result = checkEnvVariables(path);
    expect(result).toBeInstanceOf(Result);
    expect(result.isOk()).toEqual(true);

    const jsonObj = result.unwrap()
    expect(jsonObj.outAppDir).toBeDefined();
    expect(jsonObj.user).toBeDefined();
    expect(jsonObj.user.apiKey).toBeDefined();
    expect(jsonObj.user.id).toBeDefined();
    expect(jsonObj.user.signKey).toBeDefined();
    expect(jsonObj.org).toBeDefined();
    expect(jsonObj.org.id).toBeDefined();

    // expect(jsonObj.outImageDir).toBeDefined();
  });

  it('It signs and encrypts app safely', () => {
    let result;
    let config = {
      user: {
        id: 123,
        signKey: "12345",
        apiKey: "12345"
      }
    }
    const app = Buffer.alloc(16, 0xff);

    result = signEncryptApp(app, config);
    expect(result).toBeInstanceOf(Result);
    expect(result.isError()).toEqual(true);

    // It works when a valid key is added.
    config.user.signKey = testSignKey;
    result = signEncryptApp(app, config);
    expect(result.isOk()).toEqual(true);

    const data = result.unwrap();
    const symKeyLength = data.readUInt16LE();

    // SymKey is always 256 bytes long.
    expect(symKeyLength).toEqual(256);

    const padding = 12; // AES encrypts in 16 byte blocks.
    expect(data.length).toEqual(2 + symKeyLength + 16 + (64 + 512 + 4 + app.length + padding));
  });

  it('Deploys app to xtblish server', async () => {
    got.post.mockResolvedValue({
      statusCode: 200,
      body: '{"status": true}',
    });

    const data = Buffer.alloc(32, 0xff);
    const config = {
      user: {
        id: 123,
        signKey: "12345",
        apiKey: "12345"
      },
      org: {
        id: 1
      }
    }
    const groupId = 1;
    const response = await postApplication(data, config, groupId);

    expect(response).toBeInstanceOf(Result);
    expect(response.isOk()).toBeTruthy();

    const jsonObj = response.unwrap();
    expect(jsonObj.statusCode).toEqual(200);
    expect(jsonObj.body).toEqual('{"status": true}');
  });
});
