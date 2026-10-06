/**
 * TextDecoder 与 TextEncoder 是浏览器与 Node 都提供的宿主 API，但它们不在
 * ES2023 的 lib 里。这里只声明 BMS 文件解码与其测试实际使用的最小面
 * （按编码构造、decode 与 encode），让类型上下文保持"只有 ES 加上这几条
 * 两种运行时共有的宿主 API"，既不引入整个 DOM 类型面，也不引入 Node 的类型。
 */
interface TextDecoderOptions {
  fatal?: boolean;
}

interface TextDecoder {
  decode(input?: Uint8Array): string;
}

declare const TextDecoder: new (encoding?: string, options?: TextDecoderOptions) => TextDecoder;

interface TextEncoder {
  encode(input?: string): Uint8Array;
}

declare const TextEncoder: new () => TextEncoder;
