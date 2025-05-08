import { jest } from '@jest/globals';
import { execSync } from 'child_process';
import got from "got";
import { signApp, postApplication, compileAssemblyScript } from "../dist/build"
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
    expect(jsonObj.user.id).toBeDefined();
    expect(jsonObj.user.apiKey).toBeDefined();
    expect(jsonObj.org).toBeDefined();
    expect(jsonObj.org.id).toBeDefined();
    expect(jsonObj.org.signKey).toBeDefined();
  });

  it('It signs and encrypts app safely', () => {
    let result;
    let config = {
      user: {
        id: 123,
        apiKey: "12345"
      },
      org: {
        id: 1,
        signKey: "12345"
      }
    }
    const app = Buffer.alloc(16, 0xff);

    result = signApp(app, config);
    expect(result).toBeInstanceOf(Result);
    expect(result.isError()).toEqual(true);

    // It works when a valid key is added.
    config.org.signKey = testSignKey;
    result = signApp(app, config);
    expect(result.isOk()).toEqual(true);
  });

  it('Deploys app to xtblish server', async () => {
    got.post.mockResolvedValue({ statusCode: 200 });

    const data = Buffer.alloc(32, 0xff);
    const config = {
      user: {
        id: 123,
        apiKey: "12345"
      },
      org: {
        id: 1,
        signKey: "12345",
      }
    }
    const groupId = 1;
    const response = await postApplication(data, config, groupId);

    expect(response).toBeInstanceOf(Result);
    expect(response.isOk()).toBeTruthy();

    const jsonObj = response.unwrap();
    expect(jsonObj.statusCode).toEqual(200);
  });

  it('Compile AssemblyScript with flags', async () => {
    const options = {
      source: "local/assembly/index.ts",
      group: 123,
      config: "local/xtblish.json",
      flags: "--stats"
    }
    const config = {
      user: {
        id: 123,
        apiKey: "12345"
      },
      org: {
        id: 1,
        signKey: "12345"
      }
    }
    const response = await compileAssemblyScript(options, config);
    expect(response.isOk()).toBeTruthy();
  });
});
