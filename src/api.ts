import debuglog from "debug";
import merge from "deepmerge";
import { EventEmitter } from "events";
import grpc from "grpc";
import protobuf from "protobufjs/light";
import retryInterceptor from "./retryInterceptor";
import { USER_AGENT } from "./ua";

/**
 * Custom formatter for call options.
 * By default we hide the credentials from being logged to the console.
 * @hidden
 */
debuglog.formatters.C = function callOptionsFormatter(
  options: CallOptions
): string {
  if (
    process.env.DEBUG_SHOW_CREDS &&
    process.env.DEBUG_SHOW_CREDS.toLowerCase() === "true"
  ) {
    return JSON.stringify(options);
  }
  return JSON.stringify({ deadline: options.deadline, credentials: "hidden" });
};

/**
 * debug message logger
 * @hidden
 */
const debug = debuglog("sajari:api");

/**
 * The default API endpoint
 * @hidden
 */
const API_ENDPOINT = "api.sajari.com:443";

/**
 * The deault grpc authority
 * @hidden
 */
const AUTHORITY = "api.sajari.com";

/**
 * @hidden
 */
export type Encoder<T> = (
  message: T,
  writer?: protobuf.Writer
) => protobuf.Writer;
/**
 * @hidden
 */
export type Decoder<T> = (data: Buffer) => T;

export interface CallOptions {
  deadline?: number;
  credentials?: {
    key: string;
    secret: string;
  };
}
/*
export interface SajariResponse extends Response {
  key: string;
  pipeline: string;
  nextPageToken: string;
  record: object;
} 
*/

/**
 * APIClient wraps the grpc client, providing a single call method for
 * creating an unary request.
 * @hidden
 */
export class APIClient {
  private endpoint: string;
  private client: grpc.Client;
  private metadata: grpc.Metadata;
  private credentials: { key: string; secret: string };
  private emitter: EventEmitter | undefined;
  private insecure: boolean;

  constructor(
    project: string,
    collection: string,
    credentials: { key: string; secret: string },
    endpoint: string = API_ENDPOINT,
    insecure: boolean = false
  ) {
    this.credentials = credentials;
    this.endpoint = endpoint;
    this.insecure = insecure;
    this.client = this.reconnect();

    this.metadata = new grpc.Metadata();
    this.metadata.add("project", project);
    this.metadata.add("collection", collection);
  }

  public call<Request, Response>(
    path: string,
    request: Request,
    encoder: Encoder<Request>,
    decoder: Decoder<Response>,
    options: CallOptions = {}
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const callOptions = merge(
        {
          deadline: 5,
          credentials: this.credentials
        },
        options
      );

      debug("endpoint: %j", this.endpoint);
      debug("grpc method: %j", path);
      debug("call options: %C", callOptions);
      debug("request: %j", request);

      const metadata = this.metadata.clone();
      metadata.set(
        "authorization",
        `keysecret ${callOptions.credentials.key} ${
          callOptions.credentials.secret
        }`
      );

      this.emitter = this.client.makeUnaryRequest(
        path,
        wrapEncoder(encoder),
        decoder,
        request,
        metadata,
        {
          deadline: deadline(callOptions.deadline),
          // tslint:disable-next-line:no-bitwise
          propagate_flags: grpc.propagate.DEFAULTS & ~grpc.propagate.DEADLINE,

          // NOTE(@bhinchley): credentials is required by the type CallOptions,
          // but this appears to do nothing.
          credentials: createCallCredentials(
            callOptions.credentials.key,
            callOptions.credentials.secret
          ),
          interceptors: [retryInterceptor(3)]
        },
        (err: grpc.ServiceError | null, value?: Response) => {
          if (err) {
            return reject(err);
          }
          debug("response: %j", value);

          return resolve(value);
        }
      );

      // Reconnect to gRPC server on unexpected disconnects...
      if (this.emitter) {
        this.emitter.on('cancelled', this.reconnect);
      }
    });
  }

  /**
   * wait until the grpc socket is ready
   * @param seconds number of seconds to wait before erroring
   */
  public wait(seconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.waitForReady(deadline(seconds), (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  public close() {
    this.unbindEmitter();

    if (this.client) {
      this.client.close();
    }
  }

  public reconnect(): grpc.Client {
    // Close any existing client before reconnecting if open
    if (this.client) {
      this.close();
    }

    return this.client = new grpc.Client(
      this.endpoint,
      this.insecure
        ? grpc.credentials.createInsecure()
        : grpc.credentials.createSsl(),
      {
        "grpc.default_authority": AUTHORITY,
        "grpc.primary_user_agent": USER_AGENT
      }
    );
  }

  private unbindEmitter(): void {
    if (this.emitter) {
      this.emitter.off('cancelled', this.reconnect);
    }
  }
}

/**
 * createCallCredentials creates the grpc.CallCredientials from the
 * passed sajari credentials
 * @hidden
 */
function createCallCredentials(
  key: string,
  secret: string
): grpc.CallCredentials {
  return grpc.credentials.createFromMetadataGenerator((_, callback) => {
    const metadata = new grpc.Metadata();
    metadata.add("authorization", `keysecret ${key} ${secret}`);
    callback(null, metadata);
  });
}

/**
 * wrapEncoder turns a protobufjs message encode fn into a grpc.serialize fn
 * @hidden
 */
function wrapEncoder<T>(
  encode: (message: T, writer?: protobuf.Writer) => protobuf.Writer
): (message: T) => Buffer {
  return function serialize(message: T): Buffer {
    const msg = encode(message).finish();
    return Buffer.from(msg);
  };
}

/**
 * @hidden
 */
function deadline(seconds: number): number {
  return new Date().setSeconds(new Date().getSeconds() + seconds);
}
