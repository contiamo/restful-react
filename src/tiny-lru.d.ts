declare module "tiny-lru" {
  export declare class Lru<T = any> {
    constructor(max?: number, ttl?: number);

    public has(key: string): boolean;
    public get(key: string): T;
    public set(key: string, value: T, bypass?: boolean): this;
    public clear(): this;
    public delete(key: string): this;
    public evict(): this;
    public keys(): string[];
  }
  export default Lru;
}
