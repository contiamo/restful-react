declare module "tiny-lru" {
  export declare class Lru<T = any> {
    constructor(max?: number, ttl?: number);

    public has(key: string): boolean;
    public get(key: string): T;
    public set(key: string, value: T, bypass?: boolean);
    // set(key: string, value: T, bypass?: boolean): this;
    // clear(): this;
    // delete(key: string): this;
    // evict(): this;
    // keys(): string[];
  }
  export default Lru;
}
